import { createServer } from 'http';
import { Server } from 'socket.io';
import { Types } from 'mongoose';

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
import { addBotToSeat } from '@/services/botService';
import { getBotStrategy } from '@/lib/bots/index';
import PokerDesk from '@/models/pokerDesk';
import type { IPokerDeskDocument } from '@/models/pokerDesk';
import PracticeSession from '@/models/practiceSession';
import { PRACTICE_STARTING_CHIPS } from '@/config/constants';
import type { BotDifficulty } from '@/config/constants';
import type { JoinPayload, ActionPayload, LeavePayload } from '@/types/socketTypes';

// Ephemeral per-desk server state — never persisted. Lost on restart.
interface DeskRuntimeState {
  userSockets: Map<string, string>; // userId → socketId (enables targeted emits)
  botSeats: Map<string, { strategy: 'easy' | 'medium' | 'hard' }>; // botUserId → config
  skipCounts: Map<string, number>; // userId → consecutive auto-folds
  turnTimer: ReturnType<typeof setTimeout> | null;
  turnTimerUserId: string | null; // which player the current turnTimer belongs to
  autoStartTimer: ReturnType<typeof setTimeout> | null;
  practiceSessions: Map<string, string>; // userId → PracticeSession _id string
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
    turnTimerUserId: null,
    autoStartTimer: null,
    practiceSessions: new Map(),
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

// Closes the PracticeSession record for a leaving player (if one exists).
async function closePracticeSession(
  deskId: string,
  userId: string,
  finalChips: number | null
): Promise<void> {
  const runtime = deskRuntime.get(deskId);
  if (!runtime) return;
  const sessionId = runtime.practiceSessions.get(userId);
  if (!sessionId) return;
  await PracticeSession.findByIdAndUpdate(sessionId, {
    endedAt: new Date(),
    finalChips: finalChips ?? undefined,
  });
  runtime.practiceSessions.delete(userId);
}

// Clears any existing turn timer, emits turn:start to the player's socket,
// and sets a new 60s server-side timer for that player. On expiry: auto-folds
// the player, increments skip counter, then either starts the next player's
// timer (normal path) or evicts the player (3-skip path).
//
// Bot routing: if userId belongs to a bot, schedules a 1.5s think delay
// instead of the 60s human timer. The bot reads desk state, picks an action,
// and executes it using the same result-handling logic as the action handler.
function startTurnTimer(deskId: string, userId: string): void {
  const runtime = getOrCreateRuntime(deskId);
  if (runtime.turnTimer) clearTimeout(runtime.turnTimer);
  runtime.turnTimerUserId = userId;

  // Bot path: 1.5s think delay, then auto-act and return without setting the 60s timer.
  if (runtime.botSeats.has(userId)) {
    runtime.turnTimer = setTimeout(async () => {
      runtime.turnTimer = null;
      runtime.turnTimerUserId = null;
      try {
        const deskLean = await PokerDesk.findById(deskId).lean();
        if (!deskLean?.currentGame) return;
        const strategy = getBotStrategy(runtime.botSeats.get(userId)!.strategy);
        const botObjId = new Types.ObjectId(userId);
        const { action, amount } = strategy.selectAction(deskLean.currentGame, botObjId);
        const result = await handlePlayerAction({ deskId, userId, action, amount });
        deskRuntime.get(deskId)?.skipCounts.delete(userId);
        if (result.needsShowdown) { await handleNeedsShowdown(deskId); return; }
        if (result.progression === 'nextRound') {
          broadcastDeskState(deskId, 'game:roundAdvance', result.desk);
        } else {
          broadcastDeskState(deskId, 'game:action', result.desk);
        }
        const game = result.desk.currentGame;
        if (game) {
          const active = game.players.filter((p) => p.status === 'active').length;
          const allIn = game.players.filter((p) => p.status === 'all-in').length;
          if (active === 0 && allIn >= 2) { await handleAllInRunout(deskId); return; }
        }
        const nextTurn = result.desk.currentGame?.currentTurnPlayer;
        if (nextTurn) startTurnTimer(deskId, nextTurn.toString());
      } catch { /* bot action failed silently */ }
    }, 1500);
    return; // skip the 60s human timer
  }

  // Notify the player it's their turn and set the deadline.
  targetedEmit(deskId, userId, 'turn:start', {
    deadline: new Date(Date.now() + 60 * 1000),
  });

  runtime.turnTimer = setTimeout(async () => {
    runtime.turnTimer = null;
    runtime.turnTimerUserId = null;

    // Increment before folding so eviction check sees the updated count.
    const newSkipCount = (runtime.skipCounts.get(userId) ?? 0) + 1;
    runtime.skipCounts.set(userId, newSkipCount);

    let foldResult: Awaited<ReturnType<typeof handlePlayerAction>>;
    try {
      foldResult = await handlePlayerAction({ deskId, userId, action: 'fold' });
    } catch (err) {
      // Race: the player already acted; the action handler cleared this timer
      // and has already set the next one. Silently discard.
      if (err instanceof InvalidStateError) return;
      return;
    }

    io.to(deskId).emit('turn:timeout', { userId });

    if (newSkipCount >= 3) {
      // Eviction path: resolve any pending hand state from the auto-fold first.
      if (foldResult.needsShowdown) {
        await handleNeedsShowdown(deskId);
        if (!deskRuntime.has(deskId)) return; // desk closed during showdown
      } else if (foldResult.progression === 'nextRound') {
        broadcastDeskState(deskId, 'game:roundAdvance', foldResult.desk);
      } else {
        broadcastDeskState(deskId, 'game:action', foldResult.desk);
        const game = foldResult.desk.currentGame;
        if (game) {
          const active = game.players.filter((p) => p.status === 'active').length;
          const allIn = game.players.filter((p) => p.status === 'all-in').length;
          if (active === 0 && allIn >= 2) {
            await handleAllInRunout(deskId);
            if (!deskRuntime.has(deskId)) return;
          }
        }
      }

      // Force-remove the player from the desk.
      try {
        const { desk: evictDesk, needsShowdown: evictNeedsShowdown, finalChips: evictFinalChips } =
          await userLeavesSeat({ deskId, userId });
        await closePracticeSession(deskId, userId, evictFinalChips);
        runtime.userSockets.delete(userId);
        runtime.skipCounts.delete(userId);

        if (evictNeedsShowdown) {
          await handleNeedsShowdown(deskId);
          return;
        }

        const game = evictDesk.currentGame;
        if (game) {
          const active = game.players.filter((p) => p.status === 'active').length;
          const allIn = game.players.filter((p) => p.status === 'all-in').length;
          if (active === 0 && allIn >= 2) {
            await handleAllInRunout(deskId);
            return;
          }
        }

        broadcastDeskState(deskId, 'player:left', evictDesk);
        const nextTurn = evictDesk.currentGame?.currentTurnPlayer;
        const rt = deskRuntime.get(deskId);
        if (nextTurn && rt && !rt.turnTimer) {
          startTurnTimer(deskId, nextTurn.toString());
        }
        if (evictDesk.status === 'closed') {
          io.to(deskId).emit('desk:closed', {});
          deskRuntime.delete(deskId);
        }
      } catch {
        // userLeavesSeat failed (player already gone between fold and eviction).
      }
    } else {
      // Normal path: handle auto-fold result exactly like the action handler.
      if (foldResult.needsShowdown) {
        await handleNeedsShowdown(deskId);
        return;
      }

      if (foldResult.progression === 'nextRound') {
        broadcastDeskState(deskId, 'game:roundAdvance', foldResult.desk);
      } else {
        broadcastDeskState(deskId, 'game:action', foldResult.desk);
      }

      const game = foldResult.desk.currentGame;
      if (game) {
        const active = game.players.filter((p) => p.status === 'active').length;
        const allIn = game.players.filter((p) => p.status === 'all-in').length;
        if (active === 0 && allIn >= 2) {
          await handleAllInRunout(deskId);
          return;
        }
      }

      const nextTurnPlayer = foldResult.desk.currentGame?.currentTurnPlayer;
      if (nextTurnPlayer) {
        startTurnTimer(deskId, nextTurnPlayer.toString());
      }
    }
  }, 60_000);
}

async function handleNeedsShowdown(deskId: string): Promise<void> {
  // Clear the turn timer — no one is acting during showdown resolution.
  const runtime = deskRuntime.get(deskId);
  if (runtime?.turnTimer) {
    clearTimeout(runtime.turnTimer);
    runtime.turnTimer = null;
    runtime.turnTimerUserId = null;
  }

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
          startTurnTimer(deskId, game.currentTurnPlayer.toString());
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

      // Check for reconnect: user is already seated at this desk.
      const existingDesk = await PokerDesk.findById(deskId);
      const alreadySeated = existingDesk?.seats.some(
        (s) => s.userId.equals(new Types.ObjectId(userId))
      );

      if (alreadySeated && existingDesk) {
        // Reconnect path — do NOT call addUserToSeat.
        socket.join(deskId);
        const runtime = getOrCreateRuntime(deskId);
        runtime.userSockets.set(userId, socket.id);

        // Reset seat status to 'active'.
        await PokerDesk.findOneAndUpdate(
          { _id: deskId, 'seats.userId': new Types.ObjectId(userId) },
          { $set: { 'seats.$.status': 'active' } }
        );

        // Reload desk after status update so the broadcast reflects 'active'.
        const refreshedDesk = await PokerDesk.findById(deskId);
        if (!refreshedDesk) return;

        broadcastDeskState(deskId, 'player:joined', refreshedDesk);

        // Re-send hole cards if a game is in progress.
        const game = refreshedDesk.currentGame;
        if (game) {
          const player = game.players.find(
            (p) => p.userId.equals(new Types.ObjectId(userId))
          );
          if (player?.holeCards?.length) {
            targetedEmit(deskId, userId, 'game:start', { holeCards: player.holeCards });
          }

          // Restart turn timer only if it's this player's turn AND no timer
          // is already running (the existing timer continues if still active).
          const isTheirTurn = game.currentTurnPlayer?.equals(new Types.ObjectId(userId));
          if (isTheirTurn && !runtime.turnTimer) {
            startTurnTimer(deskId, userId);
          }
        }
        return; // reconnect complete — skip normal join flow
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
    const { deskId, action, amount } = payload ?? {};

    // Clear turn timer at the TOP — before acquiring the service lock.
    // Prevents the timer from firing between action receipt and lock acquisition.
    if (deskId && typeof deskId === 'string') {
      const runtime = deskRuntime.get(deskId);
      if (runtime?.turnTimer) {
        clearTimeout(runtime.turnTimer);
        runtime.turnTimer = null;
        runtime.turnTimerUserId = null;
      }
    }

    try {
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

      // Voluntary action succeeded — reset the skip counter.
      deskRuntime.get(deskId)?.skipCounts.delete(userId);

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
        const active = game.players.filter((p) => p.status === 'active').length;
        const allIn = game.players.filter((p) => p.status === 'all-in').length;
        if (active === 0 && allIn >= 2) {
          await handleAllInRunout(deskId);
          return;
        }
      }

      // Start the next player's turn timer.
      const nextTurnPlayer = desk.currentGame?.currentTurnPlayer;
      if (nextTurnPlayer) {
        startTurnTimer(deskId, nextTurnPlayer.toString());
      }
    } catch (err) {
      const code = err instanceof ServiceError ? err.code : 'INTERNAL_ERROR';
      const message = err instanceof Error ? err.message : 'Action failed';
      socket.emit('error', { code, message });

      // Action failed — the turn still belongs to whoever currentGame says.
      // Re-read from DB (desk state not returned from a thrown error) and restart timer.
      if (deskId && typeof deskId === 'string') {
        try {
          const lean = await PokerDesk.findById(deskId).lean<{
            currentGame?: { currentTurnPlayer?: { toString(): string } | null } | null;
          }>();
          const currentPlayer = lean?.currentGame?.currentTurnPlayer;
          if (currentPlayer) startTurnTimer(deskId, currentPlayer.toString());
        } catch {
          // DB read failed — no timer restarted; acceptable fallback.
        }
      }
    }
  });

  socket.on('leave', async (payload: LeavePayload) => {
    try {
      const { deskId } = payload ?? {};
      if (!deskId || typeof deskId !== 'string') {
        socket.emit('error', { code: 'INVALID_STATE', message: 'Invalid leave payload' });
        return;
      }

      // If the leaver currently holds the turn timer, clear it — userLeavesSeat
      // will advance currentTurnPlayer to the next active player.
      const runtime = deskRuntime.get(deskId);
      if (runtime?.turnTimerUserId === userId) {
        clearTimeout(runtime.turnTimer!);
        runtime.turnTimer = null;
        runtime.turnTimerUserId = null;
      }

      const { desk, needsShowdown, finalChips } = await userLeavesSeat({ deskId, userId });
      await closePracticeSession(deskId, userId, finalChips);
      socket.leave(deskId);
      if (runtime) runtime.userSockets.delete(userId);

      if (needsShowdown) {
        await handleNeedsShowdown(deskId);
        return;
      }

      // Same all-in runout check applies after a leave — a player leaving
      // mid-hand could leave only all-in players behind.
      const game = desk.currentGame;
      if (game) {
        const active = game.players.filter((p) => p.status === 'active').length;
        const allIn = game.players.filter((p) => p.status === 'all-in').length;
        if (active === 0 && allIn >= 2) {
          await handleAllInRunout(deskId);
          return;
        }
      }

      broadcastDeskState(deskId, 'player:left', desk);
      const nextTurn = desk.currentGame?.currentTurnPlayer;
      const rt = deskRuntime.get(deskId);
      if (nextTurn && rt && !rt.turnTimer) {
        startTurnTimer(deskId, nextTurn.toString());
      }

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

  // practice: join a practice desk and optionally fill remaining seats with bots.
  // Payload: { deskId, seatNumber, numBots, strategy }
  socket.on('practice', async (payload) => {
    try {
      const { deskId, seatNumber, numBots, strategy } = payload ?? {};
      if (
        !deskId || typeof deskId !== 'string' ||
        typeof seatNumber !== 'number' ||
        typeof numBots !== 'number' ||
        !strategy || typeof strategy !== 'string'
      ) {
        socket.emit('error', { code: 'INVALID_STATE', message: 'Invalid practice payload' });
        return;
      }

      // Seat the human player (practice desks ignore buyInAmount; PRACTICE_STARTING_CHIPS is used).
      const humanDesk = await addUserToSeat({
        deskId,
        userId,
        seatNumber,
        buyInAmount: PRACTICE_STARTING_CHIPS,
      });

      socket.join(deskId);
      const runtime = getOrCreateRuntime(deskId);
      runtime.userSockets.set(userId, socket.id);

      // Find available seat numbers for bots (all seats not yet occupied).
      const availableSeats = Array.from(
        { length: humanDesk.maxSeats },
        (_, i) => i + 1
      ).filter((n) => !humanDesk.seats.some((s) => s.seatNumber === n));

      const botsToAdd = availableSeats.slice(0, numBots);

      // Seat each bot — addBotToSeat acquires its own lock, never call inside withDeskLock.
      let latestDesk = humanDesk;
      for (const botSeatNumber of botsToAdd) {
        const { desk: botDesk, botUserId } = await addBotToSeat({
          deskId,
          seatNumber: botSeatNumber,
          strategy: strategy as BotDifficulty,
        });
        runtime.botSeats.set(botUserId.toString(), { strategy: strategy as BotDifficulty });
        latestDesk = botDesk;
      }

      // Create the PracticeSession record for this human player.
      const session = await PracticeSession.create({
        userId,
        deskId,
        startedAt: new Date(),
      });
      runtime.practiceSessions.set(userId, session._id.toString());

      broadcastDeskState(deskId, 'player:joined', latestDesk);

      // Auto-start check — same threshold logic as the join handler.
      const threshold = latestDesk.firstGameStartedAt
        ? latestDesk.minToContinue
        : latestDesk.minToStart;
      if (latestDesk.seats.length >= threshold) {
        scheduleAutoStart(deskId);
      }
    } catch (err) {
      const code = err instanceof ServiceError ? err.code : 'INTERNAL_ERROR';
      const message = err instanceof Error ? err.message : 'Practice join failed';
      socket.emit('error', { code, message });
    }
  });

  // On disconnect: clean up the userId→socketId mapping and mark seat as disconnected.
  // Do NOT call userLeavesSeat — the 3-skip rule handles eviction.
  socket.on('disconnect', async () => {
    for (const [deskId, runtime] of deskRuntime) {
      for (const [uid, socketId] of runtime.userSockets) {
        if (socketId === socket.id) {
          runtime.userSockets.delete(uid);
          // Mark seat as disconnected so other players can see the status change.
          // Fire-and-forget — if this fails, the seat stays 'active' which is
          // a minor display issue, not a game-logic problem.
          PokerDesk.findOneAndUpdate(
            { _id: deskId, 'seats.userId': new Types.ObjectId(uid) },
            { $set: { 'seats.$.status': 'disconnected' } }
          ).catch(() => { /* silent — display-only field */ });
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
