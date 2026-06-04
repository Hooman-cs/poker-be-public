/**
 * @fileoverview Shared transport / DTO types — the cross-module catalog.
 *
 * What lives here: TYPES THAT CROSS MODULE BOUNDARIES — response shapes for
 * API endpoints, list-item shapes consumed by multiple frontend pages, and
 * the view-model shapes the admin UI reads. If a type describes "what comes
 * back from this endpoint" or "what this widget reads," it belongs here.
 *
 * What does NOT live here: types describing one function's signature (request
 * bodies, service inputs, component props). Those stay inline with the code
 * that owns them. If a single-use type later acquires a second consumer, it
 * gets promoted here and the migration is recorded in LOGS.md.
 *
 * Derivation rule: wherever possible, COMPOSE from model interfaces
 * (`Pick`, `Omit`, intersection) rather than restating fields. This prevents
 * the types from drifting away from the models — the original sin of the
 * previous developer's codebase.
 *
 * Money fields here are INTEGER MINOR UNITS, identical to how the models
 * store them. Display-string fields (formatted via formatMoney) are tagged
 * with the `Display` suffix where they appear alongside the raw value.
 */

import type {
  IPokerGameArchive,
  IGamePlayer as IArchiveGamePlayer,
  IGamePot,
  IPotWinner,
} from '@/models/pokerGameArchive';
import type { IWallet } from '@/models/wallet';
import type {
  ITransaction,
  IAmountBreakdown,
  TransactionType,
  TransactionStatus,
} from '@/models/walletTransaction';
import type {
  IBankTransaction,
  BankTransactionType,
  BankTransactionStatus,
} from '@/models/bankTransaction';
import type { IUser, UserStatus, DeviceType } from '@/models/user';
import type { PokerGameType } from '@/models/poker';
import type { Currency } from '@/config/constants';
import type { Types } from 'mongoose';

// ============================================================================
// Game history
// ============================================================================
//
// Two views of the same archive document:
//   - IGameHistoryAdmin: the full row, used by the admin "games list" page.
//   - IGameHistoryUser: the same archive projected to the calling user's
//     perspective ("myResult" — what THIS player did/won), used by the
//     user-facing GET /api/user/games/history endpoint.
//
// Both derive directly from IPokerGameArchive so changes to the archive
// model propagate here without manual restatement.

/**
 * Admin's view of an archived game: every player, every pot, full detail.
 * Composed by Omit'ing nothing — it's essentially the archive plus a string
 * id (since Mongo's `_id` arrives as ObjectId from queries but is a string
 * after JSON serialization at the API edge).
 */
export interface IGameHistoryAdmin extends IPokerGameArchive {
  /** The archive's `_id`, serialized to string at the API edge. */
  _id: string;
}

/**
 * One player's "what happened to me" projection of an archive entry.
 * Used by the user-facing history endpoint where the caller only sees
 * their own outcome, not opponents'.
 *
 * Derived directly from the archive's player shape so adding a field to
 * `players[]` in the archive shows up here automatically.
 */
export type IMyGameResult = Pick<
  IArchiveGamePlayer,
  'startingStack' | 'endingStack' | 'totalBet' | 'isWinner'
>;

/**
 * One row in the user-facing game-history list. Carries the game-level
 * metadata the user needs to identify the hand plus their own per-hand
 * outcome.
 */
export interface IGameHistoryUser {
  _id: string;
  gameType: PokerGameType;
  currency: Currency;
  /** Total pot across all side pots, minor units. */
  totalPot: number;
  startedAt: Date;
  completedAt: Date;
  myResult: IMyGameResult;
}

// ============================================================================
// User views (admin-side)
// ============================================================================
//
// Admin pages display users with several layers of context: profile (from the
// User model), wallet snapshot (Wallet model), aggregated game stats (computed
// at query time), and financial totals (also aggregated). Each is its own
// concern, composed via intersection so consumers can `Pick` what they need.

/**
 * The non-sensitive parts of a user record fit for admin viewing.
 * `authProviders` and `lastLogin` are intentionally included since admins
 * need to see who's linked which providers and when they last signed in.
 * Mongoose timestamp fields (`createdAt`, `updatedAt`) come along since
 * admin lists sort/filter by registration date.
 */
export type IUserProfile = Pick<
  IUser,
  | 'email'
  | 'username'
  | 'usernameLocked'
  | 'status'
  | 'deviceType'
  | 'mobileNumber'
  | 'authProviders'
  | 'lastLogin'
> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The wallet snapshot a user-detail page renders. Identical to IWallet
 * minus the userId reference (the page already knows whose user this is).
 */
export type IWalletSnapshot = Pick<
  IWallet,
  'balance' | 'instantBonus' | 'lockedBonus' | 'currency'
>;

/**
 * Per-user game aggregates computed via archive aggregation. Not a slice
 * of any model — this is a transport shape produced by the admin
 * analytics route.
 */
export interface IUserGameAggregates {
  gamesPlayed: number;
  /** Sum of `players.totalBet` across all archives where this user appears. */
  totalBet: number;
  /** Count of archives where the user is a winner in any pot. */
  totalWins: number;
}

/**
 * Per-user financial aggregates: lifetime deposits/withdrawals from bank
 * transactions, both in minor units.
 */
export interface IUserFinancialAggregates {
  totalDeposited: number;
  totalWithdrawn: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
}

/**
 * The fully-assembled "user detail" view rendered by the admin user-detail
 * page. Each section is its own well-named slice; consumers can `Pick` if
 * they only need part of it.
 */
export interface IUserDetailView {
  profile: IUserProfile;
  wallet: IWalletSnapshot;
  gameStats: IUserGameAggregates;
  financialStats: IUserFinancialAggregates;
}

/**
 * The shape returned by the admin users-list endpoint per row. Lighter than
 * IUserDetailView — no full breakdowns, just the fields a list-page table
 * actually displays.
 */
export interface IUserListItem {
  profile: IUserProfile;
  wallet: IWalletSnapshot;
  gamesPlayed: number;
  totalBet: number;
}

// ============================================================================
// Wallet transactions (view shape)
// ============================================================================
//
// Wallet transactions carry an IAmountBreakdown object. That's the right
// storage shape (it preserves cash/bonus/gst breakdown) but it's awkward
// for list-row display. This view collapses to the most-used fields and
// keeps the full breakdown available for detail expansion.

export interface IWalletTransactionView {
  _id: string;
  type: TransactionType;
  status: TransactionStatus;
  /** The total movement, minor units. Pulled from amount.total. */
  total: number;
  currency: Currency;
  /** Full breakdown for detail views; preserved as-stored. */
  breakdown: IAmountBreakdown;
  remark?: string;
  /** Mongoose timestamps surface here for sorted lists. */
  createdAt: Date;
  completedAt?: Date;
}

// ============================================================================
// Bank transactions (view shape)
// ============================================================================
//
// The admin bank-transactions list joins each row with the user's username
// and the bank account's bankName/accountNumber. Without this view shape
// every consumer would re-implement the populate-and-flatten boilerplate.
//
// `bankAccountId` here is the populated object after the route does
// `.populate('bankAccountId', 'bankName accountNumber accountHolderName')`.
// The two embedded fields are what the admin list actually displays.

export interface IPopulatedBankAccount {
  _id: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
}

/**
 * Admin/user-facing bank transaction list row. Composed from the model's
 * IBankTransaction minus the raw bankAccountId reference (replaced with the
 * populated object) plus the username from the user join.
 */
export interface IBankTransactionView
  extends Omit<IBankTransaction, 'userId' | 'bankAccountId'> {
  _id: string;
  /** Populated user reference — just the bits the list shows. */
  user: {
    _id: string;
    username: string;
  };
  bankAccount: IPopulatedBankAccount;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Gateway transactions (view shape)
// ============================================================================
//
// The admin payment-gateway list flattens the GatewayTransaction model + the
// joined user.username into one row. This is the "PMG" surface that previously
// drifted between API and UI; defining it once kills the drift.

export interface IGatewayTransactionView {
  _id: string;
  username: string;
  /** Gateway's order id (e.g. Razorpay order_xyz). Canonical name. */
  gatewayOrderId?: string;
  /** Total amount in minor units. */
  amount: number;
  currency: Currency;
  status: 'created' | 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

// ============================================================================
// Dashboard widgets
// ============================================================================
//
// The admin statistics page renders several aggregate widgets. Each has a
// well-defined shape produced by the analytics route — they're not slices
// of any one model, but they're consumed by multiple components on the
// dashboard, so they live here.

export interface IUserStatsWidget {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  suspendedUsers: number;
  registeredToday: number;
  deviceSplit: Record<DeviceType, number>;
}

export interface IBankStatsWidget {
  deposits: {
    completed: number;
    pending: number;
    failed: number;
  };
  withdrawals: {
    completed: number;
    pending: number;
    failed: number;
  };
}

export interface IGameStatsWidget {
  /** Total archived (= completed) games. */
  finishedGames: number;
  /** Sum of totalPot across all archives, minor units. */
  totalPotSum: number;
  /** The desk id with the most archived games. */
  mostPlayedDeskId: string | null;
  topPlayersByTotalBet: {
    userId: string;
    username: string;
    totalBet: number;
  }[];
}

// ============================================================================
// Pagination envelope (used by every list endpoint)
// ============================================================================
//
// Every paginated list endpoint returns the same outer shape. Capturing it
// here means new list endpoints don't reinvent the envelope and consumers
// can write one paging hook for the whole admin frontend.

export interface IPaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================================================
// Re-exports of model-owned enums that appear in DTOs above
// ============================================================================
//
// Consumers of this file should be able to discriminate on these enums
// without also importing from the model file. Re-exporting (as `type`)
// keeps the DTOs self-contained without duplicating the values.

export type {
  TransactionType,
  TransactionStatus,
  BankTransactionType,
  BankTransactionStatus,
  UserStatus,
  DeviceType,
  PokerGameType,
  Currency,
};