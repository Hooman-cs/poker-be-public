import mongoose from 'mongoose';

export interface ISeat {
  seatNumber: number;
  userId: string | any; // Supports raw string or populated Mongoose object
  buyInAmount: number;
  balanceAtTable: number;
  status: 'active' | 'disconnected' | 'sittingOut';
}

export interface IPlayerBets {
  [userId: string]: number;
}
 
export interface IPot {
  amount: number; // The total amount in the pot
  contributors: {
    playerId: string; // The ID of the player contributing to the pot
    contribution: number; // The amount contributed by the player
  }[];
  winners: { 
    playerId: string; // The ID of the winning player
    amount: number;   // The amount the player won from this pot
  }[];
}  

export interface RPokerGame {
  players: IPlayer[];  // List of active players in the game
  currentTurnPlayer: string;  // User ID of the player whose turn it is
  totalBet: number;  // Total amount in the main pot
  pots: IPot[] | null;  // Array of pots if there are side pots, else null
  status: 'in-progress' | 'finished';  // Current status of the game
  rounds: IRound[];  // Array of betting rounds
  communityCards: ICard[];  // Shared community cards on the table
  createdAt: Date;  // Timestamp for when the game was created
  updatedAt: Date;  // Timestamp for the latest update to the game
}

// Define types for player status and actions
export type PlayerStatus = 'active' | 'all-in' | 'folded' | 'sitting-out';
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in' | 'small-blind' | 'big-blind' | 'ante';

// Card interface
export interface ICard {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
}

// Player action record interface
export interface IPlayerActionRecord {
  userId: mongoose.Types.ObjectId;
  action: PlayerAction;
  amount: number; // Only for actions that require an amount, like 'raise' or 'bet'
  timestamp: Date;
}

// Round interface
export interface IRound {
  name: 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown';
  bettingRoundStartedAt: Date;
  actions: IPlayerActionRecord[]; // Array of player actions in this round
}

// Player interface
export interface IPlayer {
  userId: mongoose.Types.ObjectId;
  balanceAtTable: number;
  status: PlayerStatus;
  totalBet: number;
  holeCards: ICard[];
  role: 'sb' | 'bb' | 'player';
}

// SidePot interface
export interface ISidePot {
  amount: number;
  players: mongoose.Types.ObjectId[];
}

// PokerDesk interface

export interface IPokerGame {
  _id?: string;
  players: IPlayer[];
  currentTurnPlayer: string | any | null;
  totalBet: number;
  status: 'waiting' | 'in-progress' | 'finished';
  rounds: IRound[];
  communityCards: ICard[];
  // Change from any[] | null to just any[] to play nicer with Mongoose arrays
  pots: any[]; 
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IPokerTable {
  _id?: string;
  pokerModeId: string | any;
  tableName: string;
  maxSeats: number;
  seats: ISeat[];
  observers: string[] | any[];
  currentGame: IPokerGame | null;
  currentGameStatus: 'waiting' | 'in-progress' | 'finished';
  totalBuyIns: number;
  stake: number;
  minBuyIn: number;
  maxBuyIn: number;
  minPlayerCount: number; 
  bType: 'blinds' | 'antes' | 'both';
  status: 'active' | 'disable'; 
  gameType: 'NLH' | 'PLO4' | 'PLO5' | 'OmahaHILO' | 'SDH' | 'STUD' | 'RAZZ' | 'PINEAPPLE' | 'COURCHEVEL' | '5CD' | 'BADUGI' | 'MIXED';
  mode: 'practice' | 'cash';
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IBankAccount {
  _id?: string;
  userId?: string | any; // 'any' allows for Mongoose populated objects or raw ObjectIds
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  accountHolderName: string;
  isDefault: boolean;
  status: 'active' | 'blocked' | 'inactive';
}

export interface IAmountBreakdown {
  cashAmount: number;       // Cash portion of the transaction
  instantBonus: number;     // Instant bonus portion
  lockedBonus: number;      // Locked bonus portion
  gst: number;              // GST portion (negative value)
  tds: number;              // TDS deductions (negative value)
  otherDeductions: number;  // Other deductions (negative value)
  total: number;            // Total amount for the transaction
}

export interface IWalletTransaction {
  createdOn: Date;
  completedOn?: Date;
  status: 'failed' | 'completed' | 'pending' | 'reversed'; // <-- Added 'reversed' here
  amount: IAmountBreakdown;
  type: 'deposit' | 'withdraw' | 'deskIn' | 'deskWithdraw' | 'bonus' | 'pgDeposit';
  remark?: string;
  DeskId?: mongoose.Types.ObjectId;
  BankTransactionId?: mongoose.Types.ObjectId;  
  pmgtId?: mongoose.Types.ObjectId;
}

// Interface for the wallet containing balances and transactions
export interface IWallet {
  balance: number;        // Wallet cash balance
  instantBonus: number;   // Instant bonus balance
  lockedBonus: number;    // Locked bonus balance
  transactions: IWalletTransaction[]; // Array of wallet transactions
}

export interface ILoginMetaData {
  ipAddress: string;
  deviceInfo: string;
  deviceType?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface IUser extends Document {
  mobileNumber: string;
  username: string; 
  registrationDate: Date;
  lastLogin: Date;
  isActive: boolean;
  status: string;
  role?: 'user' | 'editor' | 'superadmin' | 'viewer';
  wallet: IWallet;
  bankAccounts: IBankAccount[];
  deviceInfo: string;       // Device information string (e.g., browser or device details)
  ipAddress: string;        // IP address of the user
  deviceType: string;       // Device type (default to 'android')
  latitude?: number;        // Optional latitude for location
  longitude?: number;       // Optional longitude for location
  // updateLastLogin(req: Request): Promise<void>;
  // Update this line specifically to use the new meta data interface:
  updateLastLogin?: (metaData: ILoginMetaData) => Promise<void>;
  toggleActiveStatus?: () => Promise<void>;
} 

// -----------------------------------------------------------------------------
// Core Game Types
// -----------------------------------------------------------------------------

export interface IPoker {
  _id?: string;
  name: string;
  gameType: 'NLH' | 'PLO4' | 'PLO5' | 'OmahaHILO' | 'SDH' | 'STUD' | 'RAZZ' | 'PINEAPPLE' | 'COURCHEVEL' | '5CD' | 'BADUGI' | 'MIXED';
  objective?: string;
  rules?: Record<string, string>; // Type-safe equivalent for Mongoose Map
  description?: string;
  status: 'active' | 'maintenance' | 'disable';
  blindsOrAntes?: 'blinds' | 'antes' | 'both'; 
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// -----------------------------------------------------------------------------
// Poker Mode Types
// -----------------------------------------------------------------------------

export interface IPokerMode {
  _id?: string;
  pokerId?: string | any; // 'any' allows for Mongoose populated objects
  stake: number;          // Strictly required
  minBuyIn: number;
  maxBuyIn: number; 
  bType: 'blinds' | 'antes' | 'both'; 
  status: 'active' | 'disable'; 
  mode: 'practice' | 'cash';
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// -----------------------------------------------------------------------------
// Populated API Response Types
// -----------------------------------------------------------------------------

export interface IPopulatedBankTransaction {
  _id: mongoose.Types.ObjectId;
  createdOn: Date;
  status: string;
  amount: number;
  type: string;
  remark?: string;
  imageUrl?: string;
  bankId?: {
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    accountHolderName: string;
  };
}

// -----------------------------------------------------------------------------
// Admin Dashboard Component Types
// -----------------------------------------------------------------------------

export interface IUserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  suspendedUsers: number;
  usersRegisteredToday: number;
}

export interface IDeviceStat {
  _id: 'android' | 'ios';
  count: number;
}

export interface IGameHistoryPlayer {
  username: string;
  totalBet: number;
  status: string;
}

export interface IGameHistoryPotWinner {
  username: string;
  amount: number;
}

export interface IGameHistoryPot {
  winners: IGameHistoryPotWinner[];
}

export interface IGameHistory {
  tableId: string;
  deskName: string;
  totalBet: number;
  smallBlind: number | null;
  bigBlind: number | null;
  players: IGameHistoryPlayer[];
  pots: IGameHistoryPot[];
  createdAt: string;
  gameType: string;
}

// -----------------------------------------------------------------------------
// Transaction Types
// -----------------------------------------------------------------------------
// IBankTransactionHistory is now represented as IPopulatedBankTransaction for better clarity and consistency with the populated data structure. If you still need a separate interface for the admin dashboard, you can create one that extends or picks from IPopulatedBankTransaction as needed.
export interface IBankTransaction {
  _id?: string;
  userId?: string | any; // 'any' allows for Mongoose populated objects (User)
  bankId?: string | any; // 'any' allows for Mongoose populated objects (BankAccount)
  createdOn?: Date | string;
  completedOn?: Date | string;
  status: 'failed' | 'completed' | 'pending' | 'successful' | 'waiting';
  amount: number;
  type: 'deposit' | 'withdraw';
  remark?: string;
  imageUrl: string;
}

export interface IPmgTransaction {
  _id?: string;
  userId?: string | any; // 'any' allows for populated User objects
  orderId?: string | null;
  status: 'created' | 'successful' | 'failed' | 'pending';
  amount: number;
  currency: string;
  notes: Record<string, any>;
  razPayId?: string | null;
  razSignature?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// -----------------------------------------------------------------------------
// OTP Types
// -----------------------------------------------------------------------------

export interface IOtp {
  mobileNumber: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
  requestCount: number;
  blockedUntil: Date | null;
}

export interface IArchivePot {
  _id?: string;
  amount: number;
  contributors: {
    playerId: string | any; // 'any' supports Mongoose population
    contribution: number;
  }[];
  winners: {
    playerId: string | any;
    amount: number;
  }[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IPokerGameArchive {
  _id?: string;
  deskId: string | any;
  deskName: string;
  stack: number;
  mode: 'practice' | 'cash';
  bType: 'blinds' | 'antes' | 'both';
  gameType: IPoker['gameType']; // Link it dynamically to the master list
  players: IPlayer[]; // Assuming IPlayer is already in pokerModelTypes.ts
  currentTurnPlayer?: string | any | null;
  totalBet: number;
  status: 'waiting' | 'in-progress' | 'finished';
  rounds: IRound[]; // Assuming IRound is already in pokerModelTypes.ts
  communityCards: {
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
  }[];
  pots: IArchivePot[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// -----------------------------------------------------------------------------
// Engine Evaluation Types
// -----------------------------------------------------------------------------

/**
 * Represents a Working Pot (WPot) before winners have been evaluated.
 * Used exclusively as input data for the evaluation engine.
 */
export interface WPot {
  amount: number; 
  contributors: {
    playerId: string | any; 
    contribution: number; 
  }[];
}

/**
 * Represents the final mathematical evaluation of a single player's hand.
 */
export interface IPlayerHand {
  playerId: string | any;
  hand: string;
  handRank: number;
  highCard: number;
}