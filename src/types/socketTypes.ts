import type { ICard } from '@/models/pokerDesk';

// Client → Server payloads

export interface JoinPayload {
  deskId: string;
  seatNumber: number;
  buyInAmount: number;
}

export interface ActionPayload {
  deskId: string;
  action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  amount?: number;
}

export interface LeavePayload {
  deskId: string;
}

// Server → Client payloads

/**
 * Player shape included in every room broadcast. holeCards is ALWAYS [].
 * The actual cards are sent only via targeted HoleCardsPayload after game:start.
 */
export interface RedactedGamePlayer {
  userId: string;
  balanceAtTable: number;
  status: 'active' | 'all-in' | 'folded' | 'sitting-out';
  totalBet: number;
  holeCards: [];
  role: string;
}

export interface PlayerJoinedPayload {
  desk: unknown;
}

export interface PlayerLeftPayload {
  desk: unknown;
}

export interface GameStartPayload {
  desk: unknown;
}

/** Targeted to each player's socket after the game:start room broadcast. */
export interface HoleCardsPayload {
  holeCards: ICard[];
}

export interface GameActionPayload {
  desk: unknown;
}

export interface GameRoundAdvancePayload {
  desk: unknown;
}

export interface GameShowdownPayload {
  desk: unknown;
  potResults: {
    potNumber: number;
    amount: number;
    winners: { userId: string; username: string; amount: number }[];
  }[];
}

export interface DeskClosedPayload {
  message?: string;
}

export interface TurnStartPayload {
  deadline: Date;
}

export interface ErrorPayload {
  code: string;
  message: string;
}
