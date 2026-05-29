/**
 * @fileoverview Game Service — orchestration layer between API/socket handlers
 * and the persistence layer (Mongo) + game engine (pure logic).
 *
 * Responsibilities owned here (not in the model, not in the engine):
 *   - Wallet ↔ seat money transfers, wrapped in Mongo transactions for atomicity.
 *   - Concurrency control via per-desk async mutexes (see `withDeskLock`).
 *   - Game lifecycle: createGame, handlePlayerAction, advanceRound, showdown.
 *   - Username resolution for archive writes (one User.find per showdown).
 *   - Mode-aware behavior: cash mode persists wallets; practice mode skips wallet ops.
 *
 * Engine functions stay pure — they take data, return data. This service is the
 * only place where engine results meet documents and money.
 *
 * Money is INTEGER MINOR UNITS throughout. Mode/currency/buy-in fields are
 * denormalized onto each desk (read `desk.mode`, `desk.currency`, etc. directly
 * — do NOT populate `desk.mode`; it's a string enum, not a reference).
 *
 * Dependency note: `async-mutex` is required (npm install async-mutex). Per the
 * "install at point of use" rule, this is the moment.
 */

import mongoose, { ClientSession, Types } from 'mongoose';
import { Mutex } from 'async-mutex';

import PokerDesk, { IPokerDeskDocument, ISeat } from '@/models/pokerDesk';
import Wallet from '@/models/wallet';
import WalletTransaction from '@/models/walletTransaction';
import PokerGameArchive from '@/models/pokerGameArchive';
import User from '@/models/user';

import {
  initializeGameState,
  processPlayerAction,
  determineRoundProgression,
  advanceRound as engineAdvanceRound,
  buildArchiveData,
} from '@/engine/gameEngine';
import { calculatePots } from '@/engine/potCalculator';
import { evaluatePots } from '@/engine/handEvaluator';
import { PRACTICE_STARTING_STACK_MINOR } from '@/config/constants';
import type { PlayerAction } from '@/models/pokerDesk';

// =============================================================================
// Custom error types
// =============================================================================
//
// The service throws typed errors; the API/socket layer translates them to
// HTTP status codes / socket error events. Each error carries enough context
// that the caller can build a useful response without re-querying.

export class ServiceError extends Error {
  /** Stable machine-readable code; used by routes/sockets to map to status. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}

export class NotFoundError extends ServiceError {
  constructor(entity: string, id?: string) {
    super('NOT_FOUND', `${entity}${id ? ` (${id})` : ''} not found`);
    this.name = 'NotFoundError';
  }
}

export class InsufficientFundsError extends ServiceError {
  constructor(needed: number, available: number) {
    super(
      'INSUFFICIENT_FUNDS',
      `Insufficient funds: needed ${needed}, available ${available} (minor units)`
    );
    this.name = 'InsufficientFundsError';
  }
}

export class SeatTakenError extends ServiceError {
  constructor(seatNumber: number) {
    super('SEAT_TAKEN', `Seat ${seatNumber} is already occupied`);
    this.name = 'SeatTakenError';
  }
}

export class DeskFullError extends ServiceError {
  constructor() {
    super('DESK_FULL', 'No seats available at this desk');
    this.name = 'DeskFullError';
  }
}

export class AlreadySeatedError extends ServiceError {
  constructor() {
    super('ALREADY_SEATED', 'User is already seated at this desk');
    this.name = 'AlreadySeatedError';
  }
}

export class NotSeatedError extends ServiceError {
  constructor() {
    super('NOT_SEATED', 'User is not seated at this desk');
    this.name = 'NotSeatedError';
  }
}

export class BuyInOutOfRangeError extends ServiceError {
  constructor(amount: number, min: number, max: number) {
    super(
      'BUY_IN_OUT_OF_RANGE',
      `Buy-in ${amount} is outside the allowed range [${min}, ${max}] (minor units)`
    );
    this.name = 'BuyInOutOfRangeError';
  }
}

export class InvalidStateError extends ServiceError {
  constructor(message: string) {
    super('INVALID_STATE', message);
    this.name = 'InvalidStateError';
  }
}

// =============================================================================
// Per-desk mutex registry
// =============================================================================
//
// Every desk-mutating service function MUST run inside `withDeskLock(deskId, fn)`.
// This serializes all mutations against a single desk in this Node process.
//
// Why this is safe for our deployment: the standalone socket server (port 3001)
// is the only process that mutates live game state. The admin API (port 3000)
// only reads, or mutates non-live entities (modes, archives, users). So a
// single-process in-memory mutex is sufficient. If the game server is ever
// scaled to multiple processes, this must move to a distributed lock — see
// the parking-lot note.

const deskMutexes = new Map<string, Mutex>();

function getDeskMutex(deskId: string): Mutex {
  let mutex = deskMutexes.get(deskId);
  if (!mutex) {
    mutex = new Mutex();
    deskMutexes.set(deskId, mutex);
  }
  return mutex;
}

/**
 * Runs `fn` while holding the mutex for the given desk. All desk-mutating
 * service functions are wrapped in this. NEVER call another desk-locking
 * service function from inside `fn` for the same deskId — it will deadlock.
 */
export async function withDeskLock<T>(
  deskId: string,
  fn: () => Promise<T>
): Promise<T> {
  return getDeskMutex(deskId).runExclusive(fn);
}

// =============================================================================
// Mode helpers
// =============================================================================

/**
 * Returns true when a desk runs in cash mode (real money). Practice mode
 * desks skip every wallet operation. The flag lives on the desk's PokerMode
 * — `mode === 'cash'`.
 */
function isCashMode(modeName: string): boolean {
  return modeName === 'cash';
}

// =============================================================================
// Seat / wallet operations
// =============================================================================
//
// These three functions are the only places where the wallet moves money
// in or out of a seat. All three are wrapped in a Mongo transaction in cash
// mode so a partial failure leaves wallet+seat consistent. Practice mode
// skips the transaction since there are no wallet writes.

export interface AddUserToSeatInput {
  deskId: string;
  userId: Types.ObjectId | string;
  seatNumber: number;
  buyInAmount: number; // minor units
}

/**
 * Seats a user at a desk.
 *  - Cash mode: debits wallet, creates seat, records WalletTransaction — atomic.
 *    The caller's `buyInAmount` is validated against [minBuyIn, maxBuyIn].
 *  - Practice mode: creates seat with `PRACTICE_STARTING_STACK_MINOR` ALWAYS.
 *    The caller's `buyInAmount` is ignored — practice stacks are fixed.
 *
 * Rejects if: desk not found, user already seated, seat taken, desk full,
 * buy-in out of range (cash), or wallet has insufficient balance (cash).
 */
export async function addUserToSeat(
  input: AddUserToSeatInput
): Promise<IPokerDeskDocument> {
  return withDeskLock(input.deskId, async () => {
    const desk = await PokerDesk.findById(input.deskId);
    if (!desk) throw new NotFoundError('Desk', input.deskId);

    const userIdStr = input.userId.toString();
    const userObjectId = new Types.ObjectId(userIdStr);

    // Reject if user is already at this desk.
    if (desk.seats.some((s: ISeat) => s.userId.equals(userObjectId))) {
      throw new AlreadySeatedError();
    }

    // Stakes/buy-in/currency/mode are denormalized onto the desk itself —
    // PokerMode is the template but each desk owns its effective values.
    // Read directly from the desk; do NOT populate (desk.mode is a string).
    const deskMode = desk.mode;             // 'cash' | 'practice'
    const deskCurrency = desk.currency;     // 'INR' | 'USD'
    const deskMinBuyIn = desk.minBuyIn;
    const deskMaxBuyIn = desk.maxBuyIn;
    const deskMaxSeats = desk.maxSeats;

    // Seat-availability checks.
    if (desk.seats.length >= deskMaxSeats) throw new DeskFullError();
    if (desk.seats.some((s: ISeat) => s.seatNumber === input.seatNumber)) {
      throw new SeatTakenError(input.seatNumber);
    }

    if (isCashMode(deskMode)) {
      // Cash mode: wallet debit + seat create in one Mongo transaction.
      // If any step throws, nothing is persisted.
      if (
        input.buyInAmount < deskMinBuyIn ||
        input.buyInAmount > deskMaxBuyIn
      ) {
        throw new BuyInOutOfRangeError(
          input.buyInAmount,
          deskMinBuyIn,
          deskMaxBuyIn
        );
      }

      const session: ClientSession = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const wallet = await Wallet.findOne({ userId: userObjectId }).session(
            session
          );
          if (!wallet) throw new NotFoundError('Wallet', userIdStr);
          if (wallet.currency !== deskCurrency) {
            throw new InvalidStateError(
              `Wallet currency ${wallet.currency} does not match desk currency ${deskCurrency}`
            );
          }
          if (wallet.balance < input.buyInAmount) {
            throw new InsufficientFundsError(input.buyInAmount, wallet.balance);
          }

          // Wallet debit.
          wallet.balance -= input.buyInAmount;
          await wallet.save({ session });

          // Audit row for the debit. WalletTransaction shape:
          //   walletId (not userId); type from a fixed enum ('deskIn' for buy-in);
          //   amount is a breakdown object — buy-ins are pure cash, so cashAmount=total.
          await WalletTransaction.create(
            [
              {
                walletId: wallet._id,
                type: 'deskIn',
                status: 'completed',
                amount: {
                  cashAmount: input.buyInAmount,
                  total: input.buyInAmount,
                },
                currency: deskCurrency,
                deskId: desk._id,
                completedAt: new Date(),
              },
            ],
            { session }
          );

          // Seat create.
          desk.seats.push({
            userId: userObjectId,
            seatNumber: input.seatNumber,
            buyInAmount: input.buyInAmount,
            balanceAtTable: input.buyInAmount,
            status: 'active',
            joinedAt: new Date(),
          } as ISeat);

          await desk.save({ session });
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Practice mode: no wallet, no transaction, no caller-supplied amount.
      // The buy-in is ALWAYS PRACTICE_STARTING_STACK_MINOR regardless of what
      // the caller passed in. This is a defense against misuse — a buggy or
      // malicious caller can't grant themselves a giant practice stack.
      const practiceStack = PRACTICE_STARTING_STACK_MINOR;
      desk.seats.push({
        userId: userObjectId,
        seatNumber: input.seatNumber,
        buyInAmount: practiceStack,
        balanceAtTable: practiceStack,
        status: 'active',
        joinedAt: new Date(),
      } as ISeat);
      await desk.save();
    }

    return desk;
  });
}

export interface UserLeavesSeatInput {
  deskId: string;
  userId: Types.ObjectId | string;
}

export interface UserLeavesSeatResult {
  desk: IPokerDeskDocument;
  /**
   * True if the leave collapsed the table to a single remaining
   * active/all-in player and the caller must invoke `showdown(deskId)` next.
   */
  needsShowdown: boolean;
}

/**
 * Removes a user from a desk and returns their `balanceAtTable` to the wallet
 * in cash mode (practice mode just removes the seat).
 *
 * Behavior choice (settled with the team): if called mid-hand, the user is
 * auto-folded and vacates immediately — option 2 from our discussion. This
 * mirrors the original code; a friendlier sit-out flow can be added in
 * Phase 2 if product wants.
 *
 * Mid-hand bookkeeping (the part that's easy to forget):
 *   - If the leaver was the current turn player, advance the turn to the
 *     next active player. Otherwise the game stalls — every subsequent
 *     handlePlayerAction would reject "it's not your turn" because the turn
 *     pointer still points at a folded player.
 *   - If the leave collapses the table to a single active/all-in player,
 *     the hand should end immediately. We signal this with `needsShowdown`;
 *     the caller invokes `showdown(deskId)` to finalize.
 *
 * Cash mode is fully atomic: seat removal + wallet credit + audit row in one
 * Mongo transaction. If the wallet write fails, the seat is not removed.
 */
export async function userLeavesSeat(
  input: UserLeavesSeatInput
): Promise<UserLeavesSeatResult> {
  return withDeskLock(input.deskId, async () => {
    const desk = await PokerDesk.findById(input.deskId);
    if (!desk) throw new NotFoundError('Desk', input.deskId);

    const userIdStr = input.userId.toString();
    const userObjectId = new Types.ObjectId(userIdStr);

    const seatIndex = desk.seats.findIndex((s: ISeat) =>
      s.userId.equals(userObjectId)
    );
    if (seatIndex === -1) throw new NotSeatedError();

    const seat = desk.seats[seatIndex];
    const refundAmount = seat.balanceAtTable;

    // Mode/currency live on the desk doc itself (denormalized from PokerMode).
    const deskMode = desk.mode;             // 'cash' | 'practice'
    const deskCurrency = desk.currency;     // 'INR' | 'USD'

    let needsShowdown = false;

    // Mid-hand handling: fold the leaver, advance turn if needed, check
    // whether the table just collapsed to a single survivor.
    if (desk.currentGame) {
      const game = desk.currentGame;
      const player = game.players.find((p) =>
        p.userId.equals(userObjectId)
      );
      if (player && player.status === 'active') {
        player.status = 'folded';

        // If the leaver was about to act, advance to the next active player
        // so the hand doesn't stall on a folded turn pointer.
        if (
          game.currentTurnPlayer &&
          game.currentTurnPlayer.equals(userObjectId)
        ) {
          const nextActive = game.players.find((p) => p.status === 'active');
          game.currentTurnPlayer = nextActive ? nextActive.userId : null;
        }

        // If only one active/all-in player remains, the hand resolves to them.
        const remaining = game.players.filter(
          (p) => p.status === 'active' || p.status === 'all-in'
        );
        if (remaining.length <= 1) {
          game.currentTurnPlayer = null;
          needsShowdown = true;
        }
      }
    }

    if (isCashMode(deskMode) && refundAmount > 0) {
      const session: ClientSession = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const wallet = await Wallet.findOne({ userId: userObjectId }).session(
            session
          );
          if (!wallet) throw new NotFoundError('Wallet', userIdStr);
          if (wallet.currency !== deskCurrency) {
            throw new InvalidStateError(
              `Wallet currency ${wallet.currency} does not match desk currency ${deskCurrency}`
            );
          }

          wallet.balance += refundAmount;
          await wallet.save({ session });

          // Audit row for the leave refund: type='deskWithdraw' (money out of desk
          // back to wallet), cash-only breakdown.
          await WalletTransaction.create(
            [
              {
                walletId: wallet._id,
                type: 'deskWithdraw',
                status: 'completed',
                amount: {
                  cashAmount: refundAmount,
                  total: refundAmount,
                },
                currency: deskCurrency,
                deskId: desk._id,
                completedAt: new Date(),
              },
            ],
            { session }
          );

          desk.seats.splice(seatIndex, 1);
          await desk.save({ session });
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Practice mode (or cash with zero balance — defensive): just remove.
      desk.seats.splice(seatIndex, 1);
      await desk.save();
    }

    return { desk, needsShowdown };
  });
}

export interface AddUserBalanceAtTableInput {
  deskId: string;
  userId: Types.ObjectId | string;
  amount: number; // minor units, positive
}

/**
 * Top-up: moves additional funds from the user's wallet to their seat's
 * balanceAtTable. Cash mode only — practice seats have a fixed stack.
 *
 * Subject to the same maxBuyIn ceiling as the initial buy-in (you can't
 * suddenly turn a small-stakes seat into a big-stakes one mid-session).
 */
export async function addUserBalanceAtTable(
  input: AddUserBalanceAtTableInput
): Promise<IPokerDeskDocument> {
  if (input.amount <= 0) {
    throw new InvalidStateError('Top-up amount must be positive');
  }

  return withDeskLock(input.deskId, async () => {
    const desk = await PokerDesk.findById(input.deskId);
    if (!desk) throw new NotFoundError('Desk', input.deskId);

    const userIdStr = input.userId.toString();
    const userObjectId = new Types.ObjectId(userIdStr);

    const seat = desk.seats.find((s: ISeat) => s.userId.equals(userObjectId));
    if (!seat) throw new NotSeatedError();

    // Mode/currency/buy-in ceiling live on the desk doc itself.
    const deskMode = desk.mode;             // 'cash' | 'practice'
    const deskCurrency = desk.currency;     // 'INR' | 'USD'
    const deskMaxBuyIn = desk.maxBuyIn;

    if (!isCashMode(deskMode)) {
      throw new InvalidStateError('Top-up is not available in practice mode');
    }

    // Ceiling check: new balanceAtTable can't exceed maxBuyIn.
    const newBalance = seat.balanceAtTable + input.amount;
    if (newBalance > deskMaxBuyIn) {
      throw new BuyInOutOfRangeError(newBalance, 0, deskMaxBuyIn);
    }

    const session: ClientSession = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const wallet = await Wallet.findOne({ userId: userObjectId }).session(
          session
        );
        if (!wallet) throw new NotFoundError('Wallet', userIdStr);
        if (wallet.currency !== deskCurrency) {
          throw new InvalidStateError(
            `Wallet currency ${wallet.currency} does not match desk currency ${deskCurrency}`
          );
        }
        if (wallet.balance < input.amount) {
          throw new InsufficientFundsError(input.amount, wallet.balance);
        }

        wallet.balance -= input.amount;
        await wallet.save({ session });

        // Audit row for the top-up: also type='deskIn' (money moving into a desk).
        // The deskId reference disambiguates this from the initial buy-in by
        // pairing with the createdAt timestamp in any historical view.
        await WalletTransaction.create(
          [
            {
              walletId: wallet._id,
              type: 'deskIn',
              status: 'completed',
              amount: {
                cashAmount: input.amount,
                total: input.amount,
              },
              currency: deskCurrency,
              deskId: desk._id,
              completedAt: new Date(),
            },
          ],
          { session }
        );

        seat.balanceAtTable = newBalance;
        seat.buyInAmount += input.amount;
        await desk.save({ session });
      });
    } finally {
      await session.endSession();
    }

    return desk;
  });
}

// =============================================================================
// Game lifecycle
// =============================================================================
//
// createGame, handlePlayerAction, advanceGameRound — all desk-locked, all
// pure-engine + desk-doc-mutation. None of these touch wallets; the engine
// computes results and we apply them. Wallet movements happen only on buy-in
// (Turn 1) and at showdown (Turn 3 — winners' seat balances are credited
// from pot results, and game-end wallet ops use the same transaction pattern
// as the seat ops).

export interface CreateGameInput {
  deskId: string;
}

/**
 * Starts a new game at a desk. Requires:
 *   - desk has at least `minPlayerCount` active seats with balance >= minBuyIn,
 *   - no game currently in progress (currentGameStatus is 'waiting' or 'finished').
 *
 * Calls engine's initializeGameState (which handles deck/cards/blinds/antes),
 * persists the resulting IPokerGame as desk.currentGame, and flips
 * currentGameStatus to 'in-progress'.
 *
 * Seats with insufficient balance to meet minBuyIn are filtered by the engine
 * (they remain at the desk but don't participate). If the resulting player
 * count is below minPlayerCount, we throw and don't start.
 */
export async function createGame(
  input: CreateGameInput
): Promise<IPokerDeskDocument> {
  return withDeskLock(input.deskId, async () => {
    const desk = await PokerDesk.findById(input.deskId);
    if (!desk) throw new NotFoundError('Desk', input.deskId);

    if (desk.currentGameStatus === 'in-progress') {
      throw new InvalidStateError('A game is already in progress at this desk');
    }

    // Engine filters to active seats with balance >= minBuyIn; we precheck
    // the count here so we throw a meaningful error before initializing.
    const eligibleCount = desk.seats.filter(
      (s) => s.status === 'active' && s.balanceAtTable >= desk.minBuyIn
    ).length;
    if (eligibleCount < desk.minPlayerCount) {
      throw new InvalidStateError(
        `Not enough eligible players: need ${desk.minPlayerCount}, have ${eligibleCount}`
      );
    }

    // Engine call — pure, returns the initial IPokerGame plus a deck we
    // discard (the deck isn't persisted; only the dealt cards on players
    // and the empty communityCards array are).
    const initial = initializeGameState(
      desk.seats as unknown as ISeat[],
      desk.bType === 'blinds' ? 'blinds' : 'antes',
      desk.stake,
      desk.gameType,
      desk.minBuyIn
    );

    // Apply blind/ante deductions back to the seat docs so seat.balanceAtTable
    // reflects what the engine took. The engine returned new balances on
    // initial.players[i].balanceAtTable; mirror them onto the matching seats.
    for (const player of initial.players) {
      const seat = desk.seats.find((s) => s.userId.equals(player.userId));
      if (seat) {
        seat.balanceAtTable = player.balanceAtTable;
      }
    }

    desk.currentGame = {
      players: initial.players,
      currentTurnPlayer: initial.currentTurnPlayer,
      totalBet: initial.totalBet,
      status: 'in-progress',
      rounds: initial.rounds,
      communityCards: initial.communityCards,
      pots: initial.pots,
    };
    desk.currentGameStatus = 'in-progress';

    await desk.save();
    return desk;
  });
}

export interface HandlePlayerActionInput {
  deskId: string;
  userId: Types.ObjectId | string;
  action: PlayerAction;
  /** Required for 'raise'; ignored otherwise. Minor units. */
  amount?: number;
}

export interface HandlePlayerActionResult {
  desk: IPokerDeskDocument;
  /** What progression the engine decided after this action. */
  progression: 'continue' | 'nextRound' | 'showdown';
  /** True if the caller should now invoke `showdown(deskId)`. */
  needsShowdown: boolean;
}

/**
 * Applies a single player action to the current game. Returns what should
 * happen next:
 *   - 'continue': hand continues, currentTurnPlayer moved to the next player.
 *   - 'nextRound': the engine auto-advanced to the next betting round (deal
 *     community cards, reset turn to first active player). Already applied.
 *   - 'showdown': all betting is done, the caller must invoke `showdown(...)`.
 *
 * Validates that:
 *   - a game is in progress,
 *   - it's actually this player's turn,
 *   - the action is legal for the current state (engine validates the rest).
 *
 * If progression is 'nextRound', this function calls the engine's advanceRound
 * helper synchronously and persists everything in one save. The caller does
 * NOT need to make a follow-up call for that case — only for 'showdown'.
 */
export async function handlePlayerAction(
  input: HandlePlayerActionInput
): Promise<HandlePlayerActionResult> {
  return withDeskLock(input.deskId, async () => {
    const desk = await PokerDesk.findById(input.deskId);
    if (!desk) throw new NotFoundError('Desk', input.deskId);

    if (desk.currentGameStatus !== 'in-progress' || !desk.currentGame) {
      throw new InvalidStateError('No game is currently in progress');
    }

    const userIdStr = input.userId.toString();
    const userObjectId = new Types.ObjectId(userIdStr);
    const game = desk.currentGame;

    // Turn check: only the current turn player may act.
    if (
      !game.currentTurnPlayer ||
      !game.currentTurnPlayer.equals(userObjectId)
    ) {
      throw new InvalidStateError(`It is not your turn`);
    }

    const player = game.players.find((p) => p.userId.equals(userObjectId));
    if (!player) {
      // Should be impossible — currentTurnPlayer pointed at them — but treat
      // defensively in case of a data anomaly.
      throw new InvalidStateError('Acting user is not a player in this game');
    }
    if (player.status !== 'active') {
      throw new InvalidStateError(
        `Player is not eligible to act (status: ${player.status})`
      );
    }

    const seat = desk.seats.find((s) => s.userId.equals(userObjectId));
    if (!seat) {
      // Same defensive check — a player without a seat shouldn't reach here.
      throw new InvalidStateError('Acting user has no seat at this desk');
    }

    const currentRound = game.rounds[game.rounds.length - 1];
    if (!currentRound) {
      throw new InvalidStateError('Game has no active round');
    }

    // Engine call — pure, returns updated player/seat/totalBet + the action
    // record to append to the current round.
    const result = processPlayerAction(
      player,
      seat.balanceAtTable,
      game.totalBet,
      currentRound,
      input.action,
      input.amount ?? 0
    );

    // Apply the engine's result to the documents.
    Object.assign(player, result.updatedPlayer);
    seat.balanceAtTable = result.updatedSeatBalance;
    game.totalBet = result.updatedTotalBet;
    currentRound.actions.push(result.actionRecord);

    // Decide what happens next.
    const progression = determineRoundProgression(
      game.players,
      currentRound,
      userObjectId
    );

    let progressionType: 'continue' | 'nextRound' | 'showdown' = progression.type;
    let needsShowdown = false;

    if (progression.type === 'continue') {
      game.currentTurnPlayer = progression.nextPlayerId;
    } else if (progression.type === 'nextRound') {
      // Auto-advance: engine deals community cards, resets turn. We apply
      // the result; no second call required from the caller.
      const advanced = engineAdvanceRound(
        currentRound.name,
        game.players,
        game.communityCards
      );
      game.rounds.push(advanced.newRound);
      game.communityCards.push(...advanced.newCommunityCards);
      game.currentTurnPlayer = advanced.nextTurnPlayer;
    } else {
      // 'showdown' — the caller (socket/route layer) must invoke showdown next.
      // We don't do it inline because showdown wants its own lock acquisition
      // and a clean save boundary, and because callers may want to broadcast
      // intermediate state ("hand ending...") between this save and the showdown.
      game.currentTurnPlayer = null;
      needsShowdown = true;
    }

    await desk.save();
    return { desk, progression: progressionType, needsShowdown };
  });
}

/**
 * Standalone round-advance entry point. Most callers won't need this —
 * handlePlayerAction auto-advances on 'nextRound'. It exists for cases where
 * the lifecycle layer needs to force progression (e.g. all-in run-out: when
 * every remaining player is all-in, no more betting can occur and the hand
 * should deal out remaining streets without further action).
 *
 * Throws if there's no current game or if the current round is already
 * 'showdown' (use `showdown()` instead).
 */
export async function advanceGameRound(
  deskId: string
): Promise<IPokerDeskDocument> {
  return withDeskLock(deskId, async () => {
    const desk = await PokerDesk.findById(deskId);
    if (!desk) throw new NotFoundError('Desk', deskId);
    if (!desk.currentGame) {
      throw new InvalidStateError('No game in progress');
    }

    const game = desk.currentGame;
    const currentRound = game.rounds[game.rounds.length - 1];
    if (!currentRound) {
      throw new InvalidStateError('Game has no active round');
    }
    if (currentRound.name === 'showdown') {
      throw new InvalidStateError(
        'Already at showdown — call showdown() instead'
      );
    }

    const advanced = engineAdvanceRound(
      currentRound.name,
      game.players,
      game.communityCards
    );
    game.rounds.push(advanced.newRound);
    game.communityCards.push(...advanced.newCommunityCards);
    game.currentTurnPlayer = advanced.nextTurnPlayer;

    await desk.save();
    return desk;
  });
}

// =============================================================================
// Showdown
// =============================================================================
//
// Showdown is the most complex operation in the service because it ties
// together: the pot calculator, the hand evaluator, the username lookup, the
// archive write, and the credit-back of winnings to seat balances. It runs
// inside the desk mutex and uses a Mongo transaction for the archive +
// desk-update pair so the system can't end up with an archived game whose
// payouts didn't land (or paid-out winnings without an archive row).
//
// Wallets are NOT touched at showdown. Winners' chips land in their seat
// (balanceAtTable); they become wallet money only when the user leaves the
// seat via userLeavesSeat. This matches how real poker works — you're
// allowed to keep playing after a win — and keeps the showdown's transaction
// scope smaller (no per-winner wallet writes).

export interface ShowdownInput {
  deskId: string;
}

export interface ShowdownResult {
  desk: IPokerDeskDocument;
  /** The archive document that was written. */
  archive: { _id: Types.ObjectId };
  /** Per-pot winners with amounts, for the socket layer to broadcast. */
  potResults: {
    potNumber: number;
    amount: number;
    winners: { userId: Types.ObjectId; username: string; amount: number }[];
  }[];
}

/**
 * Finalizes a hand. Steps:
 *   1. Validate there's a game in progress at the showdown round (or with
 *      ≤1 active player remaining — single-survivor case).
 *   2. Build the userId → username map via one User.find against the live
 *      players. This is the fix for the empty-username archive crash.
 *   3. Run calculatePots over the rounds to derive main + side pots.
 *   4. Run evaluatePots to pick winners (single-survivor case skips this and
 *      awards everything to the lone remaining player).
 *   5. Apply winnings to each winner's seat.balanceAtTable.
 *   6. Build the archive payload via engine.buildArchiveData, augment with
 *      desk-level fields (deskId/pokerModeId/gameType/currency), persist.
 *   7. Clear currentGame, flip currentGameStatus to 'finished'.
 *   8. Save desk + archive in one Mongo transaction.
 *
 * The desk's totalBuyIns counter is NOT touched here (it represents the
 * cumulative all-time buy-ins, not per-hand pot totals — that's a separate
 * concern handled at buy-in time).
 */
export async function showdown(
  input: ShowdownInput
): Promise<ShowdownResult> {
  return withDeskLock(input.deskId, async () => {
    const desk = await PokerDesk.findById(input.deskId);
    if (!desk) throw new NotFoundError('Desk', input.deskId);
    if (!desk.currentGame || desk.currentGameStatus !== 'in-progress') {
      throw new InvalidStateError('No game in progress to finalize');
    }

    const game = desk.currentGame;

    // Resolve userId -> username for every player who participated. One
    // query, then a Map lookup downstream. This is THE fix for the original
    // bug where the archive's required:true on username rejected blanks.
    const playerUserIds = game.players.map((p) => p.userId);
    const userDocs = await User.find({ _id: { $in: playerUserIds } })
      .select('username')
      .lean();
    const usernameByUserId = new Map<string, string>(
      userDocs.map((u: { _id: Types.ObjectId; username: string }) => [
        u._id.toString(),
        u.username,
      ])
    );

    // Determine pots and winners.
    //
    // Single-survivor short-circuit: if everyone but one player has folded,
    // there's no hand to evaluate — the survivor gets every pot they
    // contributed to. We still build pots (for accurate side-pot accounting)
    // but skip the hand evaluator.
    const activeOrAllIn = game.players.filter(
      (p) => p.status === 'active' || p.status === 'all-in'
    );

    const pots = calculatePots(game.rounds);

    let evaluatedPots: {
      amount: number;
      contributors: { playerId: string; contribution: number }[];
      winners: { playerId: Types.ObjectId; amount: number }[];
    }[];

    if (activeOrAllIn.length === 1) {
      // Single survivor wins each pot they contributed to.
      const survivor = activeOrAllIn[0];
      const survivorId = survivor.userId;
      evaluatedPots = pots.map((pot) => {
        const isContributor = pot.contributors.some(
          (c) => c.playerId === survivorId.toString()
        );
        return {
          amount: pot.amount,
          contributors: pot.contributors,
          winners: isContributor
            ? [{ playerId: survivorId, amount: pot.amount }]
            : [],
        };
      });
    } else {
      // Genuine showdown — evaluator picks winners (handles split pots).
      const evaluated = evaluatePots(
        game.players,
        game.communityCards,
        pots,
        desk.gameType
      );
      evaluatedPots = evaluated.map((p) => ({
        amount: p.amount,
        contributors: p.contributors,
        winners: p.winners,
      }));
    }

    // Credit winnings to each winner's seat.balanceAtTable. A winner may
    // appear in multiple pots (main + side); we accumulate per userId.
    const creditsByUserId = new Map<string, number>();
    for (const pot of evaluatedPots) {
      for (const w of pot.winners) {
        const key = w.playerId.toString();
        creditsByUserId.set(key, (creditsByUserId.get(key) ?? 0) + w.amount);
      }
    }
    for (const [userIdStr, credit] of creditsByUserId) {
      const seat = desk.seats.find((s) => s.userId.toString() === userIdStr);
      if (seat) {
        seat.balanceAtTable += credit;
      }
      // If no seat exists for the winner, the winnings are dropped on the
      // floor. This shouldn't happen — the player was at this desk when the
      // hand started — but we don't crash the showdown. The archive still
      // records the win for accounting; the discrepancy is loggable.
    }

    // Build the archive payload. Engine fills in players/pots/totals; we add
    // the top-level desk metadata (deskId/pokerModeId/gameType/currency)
    // which the archive model requires.
    const startedAt = game.rounds[0]?.bettingRoundStartedAt ?? new Date();
    const archiveCore = buildArchiveData(
      desk.seats as unknown as ISeat[],
      game.players,
      evaluatedPots,
      game.totalBet,
      startedAt,
      usernameByUserId
    );

    const archivePayload = {
      deskId: desk._id,
      pokerModeId: desk.pokerModeId,
      gameType: desk.gameType,
      currency: desk.currency,
      players: archiveCore.players,
      pots: archiveCore.pots,
      totalPot: archiveCore.totalPot,
      startedAt: archiveCore.startedAt,
      completedAt: archiveCore.completedAt,
    };

    // Clear the game state so the desk is ready for the next hand.
    desk.currentGame = null;
    desk.currentGameStatus = 'finished';

    // Persist the archive write + desk update atomically.
    const session: ClientSession = await mongoose.startSession();
    let createdArchive: { _id: Types.ObjectId } | null = null;
    try {
      await session.withTransaction(async () => {
        const docs = await PokerGameArchive.create([archivePayload], {
          session,
        });
        createdArchive = { _id: docs[0]._id };
        await desk.save({ session });
      });
    } finally {
      await session.endSession();
    }

    if (!createdArchive) {
      // Transaction body either committed (setting createdArchive) or threw
      // (skipping this line). If we got here without it being set, something
      // unusual happened — surface as a real error.
      throw new InvalidStateError('Showdown completed but no archive was created');
    }

    // Shape per-pot winner output for the socket layer.
    const potResults = evaluatedPots.map((pot, i) => ({
      potNumber: i + 1,
      amount: pot.amount,
      winners: pot.winners.map((w) => ({
        userId: w.playerId,
        username: usernameByUserId.get(w.playerId.toString()) ?? 'unknown',
        amount: w.amount,
      })),
    }));

    return { desk, archive: createdArchive, potResults };
  });
}

// =============================================================================
// END OF FILE — Phase 0 task 0.8b complete.
// Next phase: API routes (Phase 3) and socket transport (Phase 5) call into
// these service functions; they don't reimplement game logic or wallet ops.
// =============================================================================


// /**
//  * @fileoverview Game Service — orchestration layer between API/socket handlers
//  * and the persistence layer (Mongo) + game engine (pure logic).
//  *
//  * Responsibilities owned here (not in the model, not in the engine):
//  *   - Wallet ↔ seat money transfers, wrapped in Mongo transactions for atomicity.
//  *   - Concurrency control via per-desk async mutexes (see `withDeskLock`).
//  *   - Game lifecycle: createGame, handlePlayerAction, advanceRound, showdown.
//  *   - Username resolution for archive writes (one User.find per showdown).
//  *   - Mode-aware behavior: cash mode persists wallets; practice mode skips wallet ops.
//  *
//  * Engine functions stay pure — they take data, return data. This service is the
//  * only place where engine results meet documents and money.
//  *
//  * Money is INTEGER MINOR UNITS throughout. Mode/currency/buy-in fields are
//  * denormalized onto each desk (read `desk.mode`, `desk.currency`, etc. directly
//  * — do NOT populate `desk.mode`; it's a string enum, not a reference).
//  *
//  * Dependency note: `async-mutex` is required (npm install async-mutex). Per the
//  * "install at point of use" rule, this is the moment.
//  */

// import mongoose, { ClientSession, Types } from 'mongoose';
// import { Mutex } from 'async-mutex';

// import PokerDesk, { IPokerDeskDocument, ISeat } from '@/models/pokerDesk';
// import PokerMode from '@/models/pokerMode';
// import Wallet from '@/models/wallet';
// import WalletTransaction from '@/models/walletTransaction';
// import PokerGameArchive from '@/models/pokerGameArchive';
// import User from '@/models/user';

// import {
//   initializeGameState,
//   processPlayerAction,
//   determineRoundProgression,
//   advanceRound as engineAdvanceRound,
//   calculateCallAmount,
//   buildArchiveData,
// } from '@/engine/gameEngine';
// import { calculatePots } from '@/engine/potCalculator';
// import { evaluatePots } from '@/engine/handEvaluator';
// import type { PlayerAction } from '@/models/pokerDesk';

// // =============================================================================
// // Custom error types
// // =============================================================================
// //
// // The service throws typed errors; the API/socket layer translates them to
// // HTTP status codes / socket error events. Each error carries enough context
// // that the caller can build a useful response without re-querying.

// export class ServiceError extends Error {
//   /** Stable machine-readable code; used by routes/sockets to map to status. */
//   readonly code: string;

//   constructor(code: string, message: string) {
//     super(message);
//     this.name = 'ServiceError';
//     this.code = code;
//   }
// }

// export class NotFoundError extends ServiceError {
//   constructor(entity: string, id?: string) {
//     super('NOT_FOUND', `${entity}${id ? ` (${id})` : ''} not found`);
//     this.name = 'NotFoundError';
//   }
// }

// export class InsufficientFundsError extends ServiceError {
//   constructor(needed: number, available: number) {
//     super(
//       'INSUFFICIENT_FUNDS',
//       `Insufficient funds: needed ${needed}, available ${available} (minor units)`
//     );
//     this.name = 'InsufficientFundsError';
//   }
// }

// export class SeatTakenError extends ServiceError {
//   constructor(seatNumber: number) {
//     super('SEAT_TAKEN', `Seat ${seatNumber} is already occupied`);
//     this.name = 'SeatTakenError';
//   }
// }

// export class DeskFullError extends ServiceError {
//   constructor() {
//     super('DESK_FULL', 'No seats available at this desk');
//     this.name = 'DeskFullError';
//   }
// }

// export class AlreadySeatedError extends ServiceError {
//   constructor() {
//     super('ALREADY_SEATED', 'User is already seated at this desk');
//     this.name = 'AlreadySeatedError';
//   }
// }

// export class NotSeatedError extends ServiceError {
//   constructor() {
//     super('NOT_SEATED', 'User is not seated at this desk');
//     this.name = 'NotSeatedError';
//   }
// }

// export class BuyInOutOfRangeError extends ServiceError {
//   constructor(amount: number, min: number, max: number) {
//     super(
//       'BUY_IN_OUT_OF_RANGE',
//       `Buy-in ${amount} is outside the allowed range [${min}, ${max}] (minor units)`
//     );
//     this.name = 'BuyInOutOfRangeError';
//   }
// }

// export class InvalidStateError extends ServiceError {
//   constructor(message: string) {
//     super('INVALID_STATE', message);
//     this.name = 'InvalidStateError';
//   }
// }

// // =============================================================================
// // Per-desk mutex registry
// // =============================================================================
// //
// // Every desk-mutating service function MUST run inside `withDeskLock(deskId, fn)`.
// // This serializes all mutations against a single desk in this Node process.
// //
// // Why this is safe for our deployment: the standalone socket server (port 3001)
// // is the only process that mutates live game state. The admin API (port 3000)
// // only reads, or mutates non-live entities (modes, archives, users). So a
// // single-process in-memory mutex is sufficient. If the game server is ever
// // scaled to multiple processes, this must move to a distributed lock — see
// // the parking-lot note.

// const deskMutexes = new Map<string, Mutex>();

// function getDeskMutex(deskId: string): Mutex {
//   let mutex = deskMutexes.get(deskId);
//   if (!mutex) {
//     mutex = new Mutex();
//     deskMutexes.set(deskId, mutex);
//   }
//   return mutex;
// }

// /**
//  * Runs `fn` while holding the mutex for the given desk. All desk-mutating
//  * service functions are wrapped in this. NEVER call another desk-locking
//  * service function from inside `fn` for the same deskId — it will deadlock.
//  */
// export async function withDeskLock<T>(
//   deskId: string,
//   fn: () => Promise<T>
// ): Promise<T> {
//   return getDeskMutex(deskId).runExclusive(fn);
// }

// // =============================================================================
// // Mode helpers
// // =============================================================================

// /**
//  * Returns true when a desk runs in cash mode (real money). Practice mode
//  * desks skip every wallet operation. The flag lives on the desk's PokerMode
//  * — `mode === 'cash'`.
//  */
// function isCashMode(modeName: string): boolean {
//   return modeName === 'cash';
// }

// // =============================================================================
// // Seat / wallet operations
// // =============================================================================
// //
// // These three functions are the only places where the wallet moves money
// // in or out of a seat. All three are wrapped in a Mongo transaction in cash
// // mode so a partial failure leaves wallet+seat consistent. Practice mode
// // skips the transaction since there are no wallet writes.

// export interface AddUserToSeatInput {
//   deskId: string;
//   userId: Types.ObjectId | string;
//   seatNumber: number;
//   buyInAmount: number; // minor units
// }

// /**
//  * Seats a user at a desk.
//  *  - Cash mode: debits wallet, creates seat, records WalletTransaction — atomic.
//  *  - Practice mode: creates seat at PRACTICE_STARTING_STACK_MINOR (passed in
//  *    by the caller — practice flow ignores the requested buyInAmount and
//  *    supplies the constant).
//  *
//  * Rejects if: desk not found, user already seated, seat taken, desk full,
//  * buy-in out of range (cash), or wallet has insufficient balance (cash).
//  */
// export async function addUserToSeat(
//   input: AddUserToSeatInput
// ): Promise<IPokerDeskDocument> {
//   return withDeskLock(input.deskId, async () => {
//     const desk = await PokerDesk.findById(input.deskId);
//     if (!desk) throw new NotFoundError('Desk', input.deskId);

//     const userIdStr = input.userId.toString();
//     const userObjectId = new Types.ObjectId(userIdStr);

//     // Reject if user is already at this desk.
//     if (desk.seats.some((s: ISeat) => s.userId.equals(userObjectId))) {
//       throw new AlreadySeatedError();
//     }

//     // Stakes/buy-in/currency/mode are denormalized onto the desk itself —
//     // PokerMode is the template but each desk owns its effective values.
//     // Read directly from the desk; do NOT populate (desk.mode is a string).
//     const deskMode = desk.mode;             // 'cash' | 'practice'
//     const deskCurrency = desk.currency;     // 'INR' | 'USD'
//     const deskMinBuyIn = desk.minBuyIn;
//     const deskMaxBuyIn = desk.maxBuyIn;
//     const deskMaxSeats = desk.maxSeats;

//     // Seat-availability checks.
//     if (desk.seats.length >= deskMaxSeats) throw new DeskFullError();
//     if (desk.seats.some((s: ISeat) => s.seatNumber === input.seatNumber)) {
//       throw new SeatTakenError(input.seatNumber);
//     }

//     if (isCashMode(deskMode)) {
//       // Cash mode: wallet debit + seat create in one Mongo transaction.
//       // If any step throws, nothing is persisted.
//       if (
//         input.buyInAmount < deskMinBuyIn ||
//         input.buyInAmount > deskMaxBuyIn
//       ) {
//         throw new BuyInOutOfRangeError(
//           input.buyInAmount,
//           deskMinBuyIn,
//           deskMaxBuyIn
//         );
//       }

//       const session: ClientSession = await mongoose.startSession();
//       try {
//         await session.withTransaction(async () => {
//           const wallet = await Wallet.findOne({ userId: userObjectId }).session(
//             session
//           );
//           if (!wallet) throw new NotFoundError('Wallet', userIdStr);
//           if (wallet.currency !== deskCurrency) {
//             throw new InvalidStateError(
//               `Wallet currency ${wallet.currency} does not match desk currency ${deskCurrency}`
//             );
//           }
//           if (wallet.balance < input.buyInAmount) {
//             throw new InsufficientFundsError(input.buyInAmount, wallet.balance);
//           }

//           // Wallet debit.
//           wallet.balance -= input.buyInAmount;
//           await wallet.save({ session });

//           // Audit row for the debit. WalletTransaction shape:
//           //   walletId (not userId); type from a fixed enum ('deskIn' for buy-in);
//           //   amount is a breakdown object — buy-ins are pure cash, so cashAmount=total.
//           await WalletTransaction.create(
//             [
//               {
//                 walletId: wallet._id,
//                 type: 'deskIn',
//                 status: 'completed',
//                 amount: {
//                   cashAmount: input.buyInAmount,
//                   total: input.buyInAmount,
//                 },
//                 currency: deskCurrency,
//                 deskId: desk._id,
//                 completedAt: new Date(),
//               },
//             ],
//             { session }
//           );

//           // Seat create.
//           desk.seats.push({
//             userId: userObjectId,
//             seatNumber: input.seatNumber,
//             buyInAmount: input.buyInAmount,
//             balanceAtTable: input.buyInAmount,
//             status: 'active',
//             joinedAt: new Date(),
//           } as ISeat);

//           await desk.save({ session });
//         });
//       } finally {
//         await session.endSession();
//       }
//     } else {
//       // Practice mode: no wallet, no transaction. Caller supplies the practice
//       // starting stack (PRACTICE_STARTING_STACK_MINOR) as buyInAmount.
//       desk.seats.push({
//         userId: userObjectId,
//         seatNumber: input.seatNumber,
//         buyInAmount: input.buyInAmount,
//         balanceAtTable: input.buyInAmount,
//         status: 'active',
//         joinedAt: new Date(),
//       } as ISeat);
//       await desk.save();
//     }

//     return desk;
//   });
// }

// export interface UserLeavesSeatInput {
//   deskId: string;
//   userId: Types.ObjectId | string;
// }

// /**
//  * Removes a user from a desk and returns their `balanceAtTable` to the wallet
//  * in cash mode (practice mode just removes the seat).
//  *
//  * Behavior choice (settled with the team): if called mid-hand, the user is
//  * auto-folded and vacates immediately — option 2 from our discussion. This
//  * mirrors the original code; a friendlier sit-out flow can be added in
//  * Phase 2 if product wants.
//  *
//  * Cash mode is fully atomic: seat removal + wallet credit + audit row in one
//  * Mongo transaction. If the wallet write fails, the seat is not removed.
//  */
// export async function userLeavesSeat(
//   input: UserLeavesSeatInput
// ): Promise<IPokerDeskDocument> {
//   return withDeskLock(input.deskId, async () => {
//     const desk = await PokerDesk.findById(input.deskId);
//     if (!desk) throw new NotFoundError('Desk', input.deskId);

//     const userIdStr = input.userId.toString();
//     const userObjectId = new Types.ObjectId(userIdStr);

//     const seatIndex = desk.seats.findIndex((s: ISeat) =>
//       s.userId.equals(userObjectId)
//     );
//     if (seatIndex === -1) throw new NotSeatedError();

//     const seat = desk.seats[seatIndex];
//     const refundAmount = seat.balanceAtTable;

//     // Mode/currency live on the desk doc itself (denormalized from PokerMode).
//     const deskMode = desk.mode;             // 'cash' | 'practice'
//     const deskCurrency = desk.currency;     // 'INR' | 'USD'

//     // If a hand is in flight and this user is in it, mark them folded so the
//     // engine cleanly excludes them on the next progression check. The actual
//     // round-progression handling is the lifecycle layer's job (Turn 2); we
//     // just leave a clean game state behind.
//     if (desk.currentGame) {
//       const player = desk.currentGame.players.find((p) =>
//         p.userId.equals(userObjectId)
//       );
//       if (player && player.status === 'active') {
//         player.status = 'folded';
//       }
//     }

//     if (isCashMode(deskMode) && refundAmount > 0) {
//       const session: ClientSession = await mongoose.startSession();
//       try {
//         await session.withTransaction(async () => {
//           const wallet = await Wallet.findOne({ userId: userObjectId }).session(
//             session
//           );
//           if (!wallet) throw new NotFoundError('Wallet', userIdStr);
//           if (wallet.currency !== deskCurrency) {
//             throw new InvalidStateError(
//               `Wallet currency ${wallet.currency} does not match desk currency ${deskCurrency}`
//             );
//           }

//           wallet.balance += refundAmount;
//           await wallet.save({ session });

//           // Audit row for the leave refund: type='deskWithdraw' (money out of desk
//           // back to wallet), cash-only breakdown.
//           await WalletTransaction.create(
//             [
//               {
//                 walletId: wallet._id,
//                 type: 'deskWithdraw',
//                 status: 'completed',
//                 amount: {
//                   cashAmount: refundAmount,
//                   total: refundAmount,
//                 },
//                 currency: deskCurrency,
//                 deskId: desk._id,
//                 completedAt: new Date(),
//               },
//             ],
//             { session }
//           );

//           desk.seats.splice(seatIndex, 1);
//           await desk.save({ session });
//         });
//       } finally {
//         await session.endSession();
//       }
//     } else {
//       // Practice mode (or cash with zero balance — defensive): just remove.
//       desk.seats.splice(seatIndex, 1);
//       await desk.save();
//     }

//     return desk;
//   });
// }

// export interface AddUserBalanceAtTableInput {
//   deskId: string;
//   userId: Types.ObjectId | string;
//   amount: number; // minor units, positive
// }

// /**
//  * Top-up: moves additional funds from the user's wallet to their seat's
//  * balanceAtTable. Cash mode only — practice seats have a fixed stack.
//  *
//  * Subject to the same maxBuyIn ceiling as the initial buy-in (you can't
//  * suddenly turn a small-stakes seat into a big-stakes one mid-session).
//  */
// export async function addUserBalanceAtTable(
//   input: AddUserBalanceAtTableInput
// ): Promise<IPokerDeskDocument> {
//   if (input.amount <= 0) {
//     throw new InvalidStateError('Top-up amount must be positive');
//   }

//   return withDeskLock(input.deskId, async () => {
//     const desk = await PokerDesk.findById(input.deskId);
//     if (!desk) throw new NotFoundError('Desk', input.deskId);

//     const userIdStr = input.userId.toString();
//     const userObjectId = new Types.ObjectId(userIdStr);

//     const seat = desk.seats.find((s: ISeat) => s.userId.equals(userObjectId));
//     if (!seat) throw new NotSeatedError();

//     // Mode/currency/buy-in ceiling live on the desk doc itself.
//     const deskMode = desk.mode;             // 'cash' | 'practice'
//     const deskCurrency = desk.currency;     // 'INR' | 'USD'
//     const deskMaxBuyIn = desk.maxBuyIn;

//     if (!isCashMode(deskMode)) {
//       throw new InvalidStateError('Top-up is not available in practice mode');
//     }

//     // Ceiling check: new balanceAtTable can't exceed maxBuyIn.
//     const newBalance = seat.balanceAtTable + input.amount;
//     if (newBalance > deskMaxBuyIn) {
//       throw new BuyInOutOfRangeError(newBalance, 0, deskMaxBuyIn);
//     }

//     const session: ClientSession = await mongoose.startSession();
//     try {
//       await session.withTransaction(async () => {
//         const wallet = await Wallet.findOne({ userId: userObjectId }).session(
//           session
//         );
//         if (!wallet) throw new NotFoundError('Wallet', userIdStr);
//         if (wallet.currency !== deskCurrency) {
//           throw new InvalidStateError(
//             `Wallet currency ${wallet.currency} does not match desk currency ${deskCurrency}`
//           );
//         }
//         if (wallet.balance < input.amount) {
//           throw new InsufficientFundsError(input.amount, wallet.balance);
//         }

//         wallet.balance -= input.amount;
//         await wallet.save({ session });

//         // Audit row for the top-up: also type='deskIn' (money moving into a desk).
//         // The deskId reference disambiguates this from the initial buy-in by
//         // pairing with the createdAt timestamp in any historical view.
//         await WalletTransaction.create(
//           [
//             {
//               walletId: wallet._id,
//               type: 'deskIn',
//               status: 'completed',
//               amount: {
//                 cashAmount: input.amount,
//                 total: input.amount,
//               },
//               currency: deskCurrency,
//               deskId: desk._id,
//               completedAt: new Date(),
//             },
//           ],
//           { session }
//         );

//         seat.balanceAtTable = newBalance;
//         seat.buyInAmount += input.amount;
//         await desk.save({ session });
//       });
//     } finally {
//       await session.endSession();
//     }

//     return desk;
//   });
// }

// // =============================================================================
// // Game lifecycle
// // =============================================================================
// //
// // createGame, handlePlayerAction, advanceGameRound — all desk-locked, all
// // pure-engine + desk-doc-mutation. None of these touch wallets; the engine
// // computes results and we apply them. Wallet movements happen only on buy-in
// // (Turn 1) and at showdown (Turn 3 — winners' seat balances are credited
// // from pot results, and game-end wallet ops use the same transaction pattern
// // as the seat ops).

// export interface CreateGameInput {
//   deskId: string;
// }

// /**
//  * Starts a new game at a desk. Requires:
//  *   - desk has at least `minPlayerCount` active seats with balance >= minBuyIn,
//  *   - no game currently in progress (currentGameStatus is 'waiting' or 'finished').
//  *
//  * Calls engine's initializeGameState (which handles deck/cards/blinds/antes),
//  * persists the resulting IPokerGame as desk.currentGame, and flips
//  * currentGameStatus to 'in-progress'.
//  *
//  * Seats with insufficient balance to meet minBuyIn are filtered by the engine
//  * (they remain at the desk but don't participate). If the resulting player
//  * count is below minPlayerCount, we throw and don't start.
//  */
// export async function createGame(
//   input: CreateGameInput
// ): Promise<IPokerDeskDocument> {
//   return withDeskLock(input.deskId, async () => {
//     const desk = await PokerDesk.findById(input.deskId);
//     if (!desk) throw new NotFoundError('Desk', input.deskId);

//     if (desk.currentGameStatus === 'in-progress') {
//       throw new InvalidStateError('A game is already in progress at this desk');
//     }

//     // Engine filters to active seats with balance >= minBuyIn; we precheck
//     // the count here so we throw a meaningful error before initializing.
//     const eligibleCount = desk.seats.filter(
//       (s) => s.status === 'active' && s.balanceAtTable >= desk.minBuyIn
//     ).length;
//     if (eligibleCount < desk.minPlayerCount) {
//       throw new InvalidStateError(
//         `Not enough eligible players: need ${desk.minPlayerCount}, have ${eligibleCount}`
//       );
//     }

//     // Engine call — pure, returns the initial IPokerGame plus a deck we
//     // discard (the deck isn't persisted; only the dealt cards on players
//     // and the empty communityCards array are).
//     const initial = initializeGameState(
//       desk.seats as unknown as ISeat[],
//       desk.bType === 'blinds' ? 'blinds' : 'antes',
//       desk.stake,
//       desk.gameType,
//       desk.minBuyIn
//     );

//     // Apply blind/ante deductions back to the seat docs so seat.balanceAtTable
//     // reflects what the engine took. The engine returned new balances on
//     // initial.players[i].balanceAtTable; mirror them onto the matching seats.
//     for (const player of initial.players) {
//       const seat = desk.seats.find((s) => s.userId.equals(player.userId));
//       if (seat) {
//         seat.balanceAtTable = player.balanceAtTable;
//       }
//     }

//     desk.currentGame = {
//       players: initial.players,
//       currentTurnPlayer: initial.currentTurnPlayer,
//       totalBet: initial.totalBet,
//       status: 'in-progress',
//       rounds: initial.rounds,
//       communityCards: initial.communityCards,
//       pots: initial.pots,
//     };
//     desk.currentGameStatus = 'in-progress';

//     await desk.save();
//     return desk;
//   });
// }

// export interface HandlePlayerActionInput {
//   deskId: string;
//   userId: Types.ObjectId | string;
//   action: PlayerAction;
//   /** Required for 'raise'; ignored otherwise. Minor units. */
//   amount?: number;
// }

// export interface HandlePlayerActionResult {
//   desk: IPokerDeskDocument;
//   /** What progression the engine decided after this action. */
//   progression: 'continue' | 'nextRound' | 'showdown';
//   /** True if the caller should now invoke `showdown(deskId)`. */
//   needsShowdown: boolean;
// }

// /**
//  * Applies a single player action to the current game. Returns what should
//  * happen next:
//  *   - 'continue': hand continues, currentTurnPlayer moved to the next player.
//  *   - 'nextRound': the engine auto-advanced to the next betting round (deal
//  *     community cards, reset turn to first active player). Already applied.
//  *   - 'showdown': all betting is done, the caller must invoke `showdown(...)`.
//  *
//  * Validates that:
//  *   - a game is in progress,
//  *   - it's actually this player's turn,
//  *   - the action is legal for the current state (engine validates the rest).
//  *
//  * If progression is 'nextRound', this function calls the engine's advanceRound
//  * helper synchronously and persists everything in one save. The caller does
//  * NOT need to make a follow-up call for that case — only for 'showdown'.
//  */
// export async function handlePlayerAction(
//   input: HandlePlayerActionInput
// ): Promise<HandlePlayerActionResult> {
//   return withDeskLock(input.deskId, async () => {
//     const desk = await PokerDesk.findById(input.deskId);
//     if (!desk) throw new NotFoundError('Desk', input.deskId);

//     if (desk.currentGameStatus !== 'in-progress' || !desk.currentGame) {
//       throw new InvalidStateError('No game is currently in progress');
//     }

//     const userIdStr = input.userId.toString();
//     const userObjectId = new Types.ObjectId(userIdStr);
//     const game = desk.currentGame;

//     // Turn check: only the current turn player may act.
//     if (
//       !game.currentTurnPlayer ||
//       !game.currentTurnPlayer.equals(userObjectId)
//     ) {
//       throw new InvalidStateError(`It is not your turn`);
//     }

//     const player = game.players.find((p) => p.userId.equals(userObjectId));
//     if (!player) {
//       // Should be impossible — currentTurnPlayer pointed at them — but treat
//       // defensively in case of a data anomaly.
//       throw new InvalidStateError('Acting user is not a player in this game');
//     }
//     if (player.status !== 'active') {
//       throw new InvalidStateError(
//         `Player is not eligible to act (status: ${player.status})`
//       );
//     }

//     const seat = desk.seats.find((s) => s.userId.equals(userObjectId));
//     if (!seat) {
//       // Same defensive check — a player without a seat shouldn't reach here.
//       throw new InvalidStateError('Acting user has no seat at this desk');
//     }

//     const currentRound = game.rounds[game.rounds.length - 1];
//     if (!currentRound) {
//       throw new InvalidStateError('Game has no active round');
//     }

//     // Engine call — pure, returns updated player/seat/totalBet + the action
//     // record to append to the current round.
//     const result = processPlayerAction(
//       player,
//       seat.balanceAtTable,
//       game.totalBet,
//       currentRound,
//       input.action,
//       input.amount ?? 0
//     );

//     // Apply the engine's result to the documents.
//     Object.assign(player, result.updatedPlayer);
//     seat.balanceAtTable = result.updatedSeatBalance;
//     game.totalBet = result.updatedTotalBet;
//     currentRound.actions.push(result.actionRecord);

//     // Decide what happens next.
//     const progression = determineRoundProgression(
//       game.players,
//       currentRound,
//       userObjectId
//     );

//     let progressionType: 'continue' | 'nextRound' | 'showdown' = progression.type;
//     let needsShowdown = false;

//     if (progression.type === 'continue') {
//       game.currentTurnPlayer = progression.nextPlayerId;
//     } else if (progression.type === 'nextRound') {
//       // Auto-advance: engine deals community cards, resets turn. We apply
//       // the result; no second call required from the caller.
//       const advanced = engineAdvanceRound(
//         currentRound.name,
//         game.players,
//         game.communityCards
//       );
//       game.rounds.push(advanced.newRound);
//       game.communityCards.push(...advanced.newCommunityCards);
//       game.currentTurnPlayer = advanced.nextTurnPlayer;
//     } else {
//       // 'showdown' — the caller (socket/route layer) must invoke showdown next.
//       // We don't do it inline because showdown wants its own lock acquisition
//       // and a clean save boundary, and because callers may want to broadcast
//       // intermediate state ("hand ending...") between this save and the showdown.
//       game.currentTurnPlayer = null;
//       needsShowdown = true;
//     }

//     await desk.save();
//     return { desk, progression: progressionType, needsShowdown };
//   });
// }

// /**
//  * Standalone round-advance entry point. Most callers won't need this —
//  * handlePlayerAction auto-advances on 'nextRound'. It exists for cases where
//  * the lifecycle layer needs to force progression (e.g. all-in run-out: when
//  * every remaining player is all-in, no more betting can occur and the hand
//  * should deal out remaining streets without further action).
//  *
//  * Throws if there's no current game or if the current round is already
//  * 'showdown' (use `showdown()` instead).
//  */
// export async function advanceGameRound(
//   deskId: string
// ): Promise<IPokerDeskDocument> {
//   return withDeskLock(deskId, async () => {
//     const desk = await PokerDesk.findById(deskId);
//     if (!desk) throw new NotFoundError('Desk', deskId);
//     if (!desk.currentGame) {
//       throw new InvalidStateError('No game in progress');
//     }

//     const game = desk.currentGame;
//     const currentRound = game.rounds[game.rounds.length - 1];
//     if (!currentRound) {
//       throw new InvalidStateError('Game has no active round');
//     }
//     if (currentRound.name === 'showdown') {
//       throw new InvalidStateError(
//         'Already at showdown — call showdown() instead'
//       );
//     }

//     const advanced = engineAdvanceRound(
//       currentRound.name,
//       game.players,
//       game.communityCards
//     );
//     game.rounds.push(advanced.newRound);
//     game.communityCards.push(...advanced.newCommunityCards);
//     game.currentTurnPlayer = advanced.nextTurnPlayer;

//     await desk.save();
//     return desk;
//   });
// }

// // =============================================================================
// // Showdown
// // =============================================================================
// //
// // Showdown is the most complex operation in the service because it ties
// // together: the pot calculator, the hand evaluator, the username lookup, the
// // archive write, and the credit-back of winnings to seat balances. It runs
// // inside the desk mutex and uses a Mongo transaction for the archive +
// // desk-update pair so the system can't end up with an archived game whose
// // payouts didn't land (or paid-out winnings without an archive row).
// //
// // Wallets are NOT touched at showdown. Winners' chips land in their seat
// // (balanceAtTable); they become wallet money only when the user leaves the
// // seat via userLeavesSeat. This matches how real poker works — you're
// // allowed to keep playing after a win — and keeps the showdown's transaction
// // scope smaller (no per-winner wallet writes).

// export interface ShowdownInput {
//   deskId: string;
// }

// export interface ShowdownResult {
//   desk: IPokerDeskDocument;
//   /** The archive document that was written. */
//   archive: { _id: Types.ObjectId };
//   /** Per-pot winners with amounts, for the socket layer to broadcast. */
//   potResults: {
//     potNumber: number;
//     amount: number;
//     winners: { userId: Types.ObjectId; username: string; amount: number }[];
//   }[];
// }

// /**
//  * Finalizes a hand. Steps:
//  *   1. Validate there's a game in progress at the showdown round (or with
//  *      ≤1 active player remaining — single-survivor case).
//  *   2. Build the userId → username map via one User.find against the live
//  *      players. This is the fix for the empty-username archive crash.
//  *   3. Run calculatePots over the rounds to derive main + side pots.
//  *   4. Run evaluatePots to pick winners (single-survivor case skips this and
//  *      awards everything to the lone remaining player).
//  *   5. Apply winnings to each winner's seat.balanceAtTable.
//  *   6. Build the archive payload via engine.buildArchiveData, augment with
//  *      desk-level fields (deskId/pokerModeId/gameType/currency), persist.
//  *   7. Clear currentGame, flip currentGameStatus to 'finished'.
//  *   8. Save desk + archive in one Mongo transaction.
//  *
//  * The desk's totalBuyIns counter is NOT touched here (it represents the
//  * cumulative all-time buy-ins, not per-hand pot totals — that's a separate
//  * concern handled at buy-in time).
//  */
// export async function showdown(
//   input: ShowdownInput
// ): Promise<ShowdownResult> {
//   return withDeskLock(input.deskId, async () => {
//     const desk = await PokerDesk.findById(input.deskId);
//     if (!desk) throw new NotFoundError('Desk', input.deskId);
//     if (!desk.currentGame || desk.currentGameStatus !== 'in-progress') {
//       throw new InvalidStateError('No game in progress to finalize');
//     }

//     const game = desk.currentGame;

//     // Resolve userId -> username for every player who participated. One
//     // query, then a Map lookup downstream. This is THE fix for the original
//     // bug where the archive's required:true on username rejected blanks.
//     const playerUserIds = game.players.map((p) => p.userId);
//     const userDocs = await User.find({ _id: { $in: playerUserIds } })
//       .select('username')
//       .lean();
//     const usernameByUserId = new Map<string, string>(
//       userDocs.map((u: { _id: Types.ObjectId; username: string }) => [
//         u._id.toString(),
//         u.username,
//       ])
//     );

//     // Determine pots and winners.
//     //
//     // Single-survivor short-circuit: if everyone but one player has folded,
//     // there's no hand to evaluate — the survivor gets every pot they
//     // contributed to. We still build pots (for accurate side-pot accounting)
//     // but skip the hand evaluator.
//     const activeOrAllIn = game.players.filter(
//       (p) => p.status === 'active' || p.status === 'all-in'
//     );

//     const pots = calculatePots(game.rounds);

//     let evaluatedPots: {
//       amount: number;
//       contributors: { playerId: string; contribution: number }[];
//       winners: { playerId: Types.ObjectId; amount: number }[];
//     }[];

//     if (activeOrAllIn.length === 1) {
//       // Single survivor wins each pot they contributed to.
//       const survivor = activeOrAllIn[0];
//       const survivorId = survivor.userId;
//       evaluatedPots = pots.map((pot) => {
//         const isContributor = pot.contributors.some(
//           (c) => c.playerId === survivorId.toString()
//         );
//         return {
//           amount: pot.amount,
//           contributors: pot.contributors,
//           winners: isContributor
//             ? [{ playerId: survivorId, amount: pot.amount }]
//             : [],
//         };
//       });
//     } else {
//       // Genuine showdown — evaluator picks winners (handles split pots).
//       const evaluated = evaluatePots(
//         game.players,
//         game.communityCards,
//         pots,
//         desk.gameType
//       );
//       evaluatedPots = evaluated.map((p) => ({
//         amount: p.amount,
//         contributors: p.contributors,
//         winners: p.winners,
//       }));
//     }

//     // Credit winnings to each winner's seat.balanceAtTable. A winner may
//     // appear in multiple pots (main + side); we accumulate per userId.
//     const creditsByUserId = new Map<string, number>();
//     for (const pot of evaluatedPots) {
//       for (const w of pot.winners) {
//         const key = w.playerId.toString();
//         creditsByUserId.set(key, (creditsByUserId.get(key) ?? 0) + w.amount);
//       }
//     }
//     for (const [userIdStr, credit] of creditsByUserId) {
//       const seat = desk.seats.find((s) => s.userId.toString() === userIdStr);
//       if (seat) {
//         seat.balanceAtTable += credit;
//       }
//       // If no seat exists for the winner, the winnings are dropped on the
//       // floor. This shouldn't happen — the player was at this desk when the
//       // hand started — but we don't crash the showdown. The archive still
//       // records the win for accounting; the discrepancy is loggable.
//     }

//     // Build the archive payload. Engine fills in players/pots/totals; we add
//     // the top-level desk metadata (deskId/pokerModeId/gameType/currency)
//     // which the archive model requires.
//     const startedAt = game.rounds[0]?.bettingRoundStartedAt ?? new Date();
//     const archiveCore = buildArchiveData(
//       desk.seats as unknown as ISeat[],
//       game.players,
//       evaluatedPots,
//       game.totalBet,
//       startedAt,
//       usernameByUserId
//     );

//     const archivePayload = {
//       deskId: desk._id,
//       pokerModeId: desk.pokerModeId,
//       gameType: desk.gameType,
//       currency: desk.currency,
//       players: archiveCore.players,
//       pots: archiveCore.pots,
//       totalPot: archiveCore.totalPot,
//       startedAt: archiveCore.startedAt,
//       completedAt: archiveCore.completedAt,
//     };

//     // Clear the game state so the desk is ready for the next hand.
//     desk.currentGame = null;
//     desk.currentGameStatus = 'finished';

//     // Persist the archive write + desk update atomically.
//     const session: ClientSession = await mongoose.startSession();
//     let createdArchive: { _id: Types.ObjectId } | null = null;
//     try {
//       await session.withTransaction(async () => {
//         const docs = await PokerGameArchive.create([archivePayload], {
//           session,
//         });
//         createdArchive = { _id: docs[0]._id };
//         await desk.save({ session });
//       });
//     } finally {
//       await session.endSession();
//     }

//     if (!createdArchive) {
//       // Transaction body either committed (setting createdArchive) or threw
//       // (skipping this line). If we got here without it being set, something
//       // unusual happened — surface as a real error.
//       throw new InvalidStateError('Showdown completed but no archive was created');
//     }

//     // Shape per-pot winner output for the socket layer.
//     const potResults = evaluatedPots.map((pot, i) => ({
//       potNumber: i + 1,
//       amount: pot.amount,
//       winners: pot.winners.map((w) => ({
//         userId: w.playerId,
//         username: usernameByUserId.get(w.playerId.toString()) ?? 'unknown',
//         amount: w.amount,
//       })),
//     }));

//     return { desk, archive: createdArchive, potResults };
//   });
// }