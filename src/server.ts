import { createServer } from 'http';
import { Server } from 'socket.io';

import dbConnect from '@/config/dbConnect';
import { verifyToken } from '@/utils/jwt';
import {
  addUserToSeat,
  userLeavesSeat,
  createGame,
  handlePlayerAction,
  advanceGameRound,
  showdown,
  ServiceError,
  InvalidStateError,
} from '@/services/gameService';
import type { IPokerDeskDocument } from '@/models/pokerDesk';
import type { JoinPayload, ActionPayload, LeavePayload } from '@/types/socketTypes';

// Ephemeral per-desk server state — never persisted. Lost on restart.
interface DeskRuntimeState {
  userSockets: Map<string, string>; // userId → socketId (enables targeted emits)
  botSeats: Map<string, { strategy: 'easy' | 'medium' | 'hard' }>; // botUserId → config
  skipCounts: Map<string, number>; // userId → consecutive auto-folds (unused until 5.2)
  turnTimer: ReturnType<typeof setTimeout> | null;
  autoStartTimer: ReturnType<typeof setTimeout> | null;
}

const deskRuntime = new Map<string, DeskRuntimeState>();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL ?? '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Reject unauthenticated connections before they reach the event handlers.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token || typeof token !== 'string') {
    return next(new Error('MISSING_AUTH'));
  }
  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return next(new Error('INVALID_TOKEN'));
  }
  socket.data.userId = payload.userId;
  socket.data.role = payload.role ?? 'user';
  next();
});

function getOrCreateRuntime(deskId: string): DeskRuntimeState {
  const existing = deskRuntime.get(deskId);
  if (existing) return existing;
  const runtime: DeskRuntimeState = {
    userSockets: new Map(),
    botSeats: new Map(),
    skipCounts: new Map(),
    turnTimer: null,
    autoStartTimer: null,
  };
  deskRuntime.set(deskId, runtime);
  return runtime;
}

// Produces a plain desk object with holeCards stripped from every player.
// This is the shape sent on every room broadcast — hole cards are NEVER leaked.
function redactDesk(desk: IPokerDeskDocument): Record<string, unknown> {
  const obj = desk.toObject() as Record<string, unknown> & {
    currentGame?: {
      players?: Array<Record<string, unknown>>;
    } | null;
  };
  if (obj.currentGame?.players) {
    obj.currentGame.players = obj.currentGame.players.map((p) => ({
      ...p,
      holeCards: [],
    }));
  }
  return obj;
}

function broadcastDeskState(
  deskId: string,
  event: string,
  desk: IPokerDeskDocument,
  extraPayload?: Record<string, unknown>
): void {
  io.to(deskId).emit(event, { desk: redactDesk(desk), ...extraPayload });
}

function targetedEmit(
  deskId: string,
  userId: string,
  event: string,
  payload: Record<string, unknown>
): void {
  const runtime = deskRuntime.get(deskId);
  if (!runtime) return;
  const socketId = runtime.userSockets.get(userId);
  if (!socketId) return;
  io.to(socketId).emit(event, payload);
}

async function handleNeedsShowdown(deskId: string): Promise<void> {
  const { desk, potResults } = await showdown({ deskId });
  broadcastDeskState(deskId, 'game:showdown', desk, {
    potResults: potResults.map((pr) => ({
      ...pr,
      winners: pr.winners.map((w) => ({ ...w, userId: w.userId.toString() })),
    })),
  });
  if (desk.status === 'closed') {
    io.to(deskId).emit('desk:closed', {});
    deskRuntime.delete(deskId);
  } else {
    scheduleAutoStart(deskId);
  }
}

// Loops advanceGameRound until the 'showdown' round is reached, then resolves the hand.
// Called when all remaining players are all-in and no more betting is possible.
async function handleAllInRunout(deskId: string): Promise<void> {
  while (true) {
    const updatedDesk = await advanceGameRound(deskId);
    const lastRound = updatedDesk.currentGame?.rounds.at(-1);
    if (!lastRound || lastRound.name === 'showdown') break;
    broadcastDeskState(deskId, 'game:roundAdvance', updatedDesk);
  }
  await handleNeedsShowdown(deskId);
}

// Schedules a new game to start after delayMs. Replaces any existing timer
// to prevent double-starts when two triggers fire within the same window.
function scheduleAutoStart(deskId: string, delayMs = 3000): void {
  const runtime = getOrCreateRuntime(deskId);
  if (runtime.autoStartTimer) clearTimeout(runtime.autoStartTimer);
  runtime.autoStartTimer = setTimeout(async () => {
    runtime.autoStartTimer = null;
    try {
      const desk = await createGame({ deskId });
      // Redacted broadcast first, then targeted hole cards to each player.
      broadcastDeskState(deskId, 'game:start', desk);
      const game = desk.currentGame;
      if (game) {
        for (const player of game.players) {
          targetedEmit(deskId, player.userId.toString(), 'game:start', {
            holeCards: player.holeCards,
          });
        }
        if (game.currentTurnPlayer) {
          targetedEmit(deskId, game.currentTurnPlayer.toString(), 'turn:start', {
            deadline: new Date(Date.now() + 60 * 1000),
          });
        }
      }
    } catch (err) {
      if (err instanceof InvalidStateError) {
        // Desk was closed between the timer being set and firing.
        if (err.message.includes('closed')) {
          io.to(deskId).emit('desk:closed', {});
          deskRuntime.delete(deskId);
        }
        // Game already in progress or not enough players — discard silently.
      }
      // Any other error is also discarded to prevent crashing the server process.
    }
  }, delayMs);
}

io.on('connection', (socket) => {
  const userId = socket.data.userId as string;

  socket.on('join', async (payload: JoinPayload) => {
    try {
      const { deskId, seatNumber, buyInAmount } = payload ?? {};
      if (
        !deskId || typeof deskId !== 'string' ||
        typeof seatNumber !== 'number' ||
        typeof buyInAmount !== 'number'
      ) {
        socket.emit('error', { code: 'INVALID_STATE', message: 'Invalid join payload' });
        return;
      }

      const desk = await addUserToSeat({ deskId, userId, seatNumber, buyInAmount });
      socket.join(deskId);
      const runtime = getOrCreateRuntime(deskId);
      runtime.userSockets.set(userId, socket.id);

      broadcastDeskState(deskId, 'player:joined', desk);

      // Cold desk: gate is minToStart. Warm desk (firstGameStartedAt set): gate is minToContinue.
      const threshold = desk.firstGameStartedAt ? desk.minToContinue : desk.minToStart;
      if (desk.seats.length >= threshold) {
        scheduleAutoStart(deskId);
      }
    } catch (err) {
      const code = err instanceof ServiceError ? err.code : 'INTERNAL_ERROR';
      const message = err instanceof Error ? err.message : 'Join failed';
      socket.emit('error', { code, message });
    }
  });

  socket.on('action', async (payload: ActionPayload) => {
    try {
      const { deskId, action, amount } = payload ?? {};
      if (!deskId || typeof deskId !== 'string' || typeof action !== 'string') {
        socket.emit('error', { code: 'INVALID_STATE', message: 'Invalid action payload' });
        return;
      }

      const { desk, progression, needsShowdown } = await handlePlayerAction({
        deskId,
        userId,
        action: action as 'fold' | 'check' | 'call' | 'raise' | 'all-in',
        amount,
      });

      if (needsShowdown) {
        await handleNeedsShowdown(deskId);
        return;
      }

      if (progression === 'nextRound') {
        broadcastDeskState(deskId, 'game:roundAdvance', desk);
      } else {
        broadcastDeskState(deskId, 'game:action', desk);
      }

      // All-in runout: if no one can bet but multiple players are all-in, run out the board.
      const game = desk.currentGame;
      if (game) {
        const activePlayers = game.players.filter((p) => p.status === 'active').length;
        const allInPlayers = game.players.filter((p) => p.status === 'all-in').length;
        if (activePlayers === 0 && allInPlayers >= 2) {
          await handleAllInRunout(deskId);
          return;
        }
      }

      // Notify the next player it's their turn.
      const nextTurnPlayer = desk.currentGame?.currentTurnPlayer;
      if (nextTurnPlayer) {
        targetedEmit(deskId, nextTurnPlayer.toString(), 'turn:start', {
          deadline: new Date(Date.now() + 60 * 1000),
        });
      }
    } catch (err) {
      const code = err instanceof ServiceError ? err.code : 'INTERNAL_ERROR';
      const message = err instanceof Error ? err.message : 'Action failed';
      socket.emit('error', { code, message });
    }
  });

  socket.on('leave', async (payload: LeavePayload) => {
    try {
      const { deskId } = payload ?? {};
      if (!deskId || typeof deskId !== 'string') {
        socket.emit('error', { code: 'INVALID_STATE', message: 'Invalid leave payload' });
        return;
      }

      const { desk, needsShowdown } = await userLeavesSeat({ deskId, userId });
      socket.leave(deskId);
      const runtime = deskRuntime.get(deskId);
      if (runtime) runtime.userSockets.delete(userId);

      if (needsShowdown) {
        await handleNeedsShowdown(deskId);
        return;
      }

      // Same all-in runout check applies after a leave — a player folding out
      // mid-hand could leave only all-in players behind.
      const game = desk.currentGame;
      if (game) {
        const activePlayers = game.players.filter((p) => p.status === 'active').length;
        const allInPlayers = game.players.filter((p) => p.status === 'all-in').length;
        if (activePlayers === 0 && allInPlayers >= 2) {
          await handleAllInRunout(deskId);
          return;
        }
      }

      broadcastDeskState(deskId, 'player:left', desk);

      if (desk.status === 'closed') {
        io.to(deskId).emit('desk:closed', {});
        deskRuntime.delete(deskId);
      }
    } catch (err) {
      const code = err instanceof ServiceError ? err.code : 'INTERNAL_ERROR';
      const message = err instanceof Error ? err.message : 'Leave failed';
      socket.emit('error', { code, message });
    }
  });

  // On disconnect: clean up the userId→socketId mapping.
  // Do NOT call userLeavesSeat — the 3-skip rule (task 5.2) handles eviction.
  socket.on('disconnect', () => {
    for (const [, runtime] of deskRuntime) {
      for (const [uid, socketId] of runtime.userSockets) {
        if (socketId === socket.id) {
          runtime.userSockets.delete(uid);
          break;
        }
      }
    }
  });
});

const port = parseInt(process.env.SOCKET_PORT ?? '3001', 10);

dbConnect()
  .then(() => {
    httpServer.listen(port, () => {
      console.log(`[socket] server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('[socket] failed to connect to database:', err);
    process.exit(1);
  });
