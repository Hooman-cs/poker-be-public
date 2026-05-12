/**
 * @fileoverview Poker Desk Database Model & Game Engine
 * Acts as the Active Record state machine for all live poker games.
 */

import mongoose, { Schema, Document, Types, Model } from 'mongoose';
import User from './user';
import PokerGameArchive from './pokerGameArchive';
import {
  IPokerTable,
  ISeat,
  PlayerAction,
  ICard,
  IPokerGame,
  IPlayer,
  IRound,
  IPlayerActionRecord,
  IWalletTransaction
} from '@/utils/pokerModelTypes'; 
import { evaluatePots } from '@/utils/evaluate';
import { createPots } from '@/utils/createPots';

// -----------------------------------------------------------------------------
// Strict Mongoose Engine Interfaces (Backend Only)
// -----------------------------------------------------------------------------

export interface ISeatDocument extends Omit<ISeat, 'userId'> {
  userId: Types.ObjectId;
}

export interface IArchivePotDocument extends Types.Subdocument {
  amount: number;
  contributors: { playerId: Types.ObjectId; contribution: number }[];
  winners: { playerId: Types.ObjectId; amount: number }[];
  createdAt: Date;
  updatedAt: Date;
}

// Typing the embedded Game Subdocument and its methods
// export interface IPokerGameSubdocument extends Omit<IPokerGame, '_id' | 'players' | 'currentTurnPlayer'>, Types.Subdocument {
//   players: (Omit<IPlayer, 'userId'> & { userId: Types.ObjectId })[];
//   currentTurnPlayer: Types.ObjectId | null;
//   dealCards(count: number, cardType?: 'hole' | 'community'): ICard[];
//   getNextActivePlayer(currentUserId: Types.ObjectId): Types.ObjectId | null;
//   getFirstActivePlayer(): Types.ObjectId | null;
//   startNextRound(prevRoundName?: 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown'): Promise<void>;
// }
export interface IPokerGameSubdocument extends Omit<IPokerGame, '_id' | 'players' | 'currentTurnPlayer' | 'pots'>, Types.Subdocument {
  players: (Omit<IPlayer, 'userId'> & { userId: Types.ObjectId })[];
  currentTurnPlayer: Types.ObjectId | null;
  pots: Types.DocumentArray<IArchivePotDocument>; // Use the ArchivePot doc type we have
  dealCards(count: number, cardType?: 'hole' | 'community'): ICard[];
  getNextActivePlayer(currentUserId: Types.ObjectId): Types.ObjectId | null;
  getFirstActivePlayer(): Types.ObjectId | null;
  startNextRound(prevRoundName?: 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown'): Promise<void>;
}

// Typing the main Desk Document and its methods
export interface IPokerDeskDocument extends Omit<IPokerTable, '_id' | 'pokerModeId' | 'seats' | 'observers' | 'currentGame'>, Document {
  pokerModeId: Types.ObjectId;
  seats: Types.DocumentArray<ISeatDocument>;
  observers: Types.Array<Types.ObjectId>;
  currentGame: IPokerGameSubdocument | null;
  
  addUserToSeat(userId: Types.ObjectId, buyInAmount: number): Promise<ISeat>;
  addWalletBalance(userId: Types.ObjectId, buyInAmount: number): Promise<void>;
  userLeavesSeat(userId: Types.ObjectId): Promise<number>;
  updateSeatStatus(userId: Types.ObjectId, status: 'active' | 'disconnected' | 'sittingOut'): Promise<void>;
  addObserver(userId: Types.ObjectId): Promise<void>;
  removeObserver(userId: Types.ObjectId): Promise<void>;
  isUserSeated(userId: Types.ObjectId): boolean;
  createGameFromTable(): Promise<any>;
  handlePlayerAction(userId: Types.ObjectId, action: PlayerAction, amount?: number): Promise<IPlayerActionRecord>;
  showdown(): Promise<void>;
}

// -----------------------------------------------------------------------------
// Sub-Schemas
// -----------------------------------------------------------------------------

const SeatSchema = new Schema<ISeatDocument>({
  seatNumber: { type: Number, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  buyInAmount: { type: Number, default: 0 },
  balanceAtTable: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'disconnected', 'sittingOut'], default: 'active' },
}, { _id: false });

const PlayerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  balanceAtTable: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'all-in', 'folded', 'sitting-out'], default: 'active' },
  totalBet: { type: Number, default: 0 },
  holeCards: [{
    suit: { type: String, enum: ['hearts', 'diamonds', 'clubs', 'spades'] },
    rank: { type: String, enum: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] }
  }],
  role: { type: String, enum: ['sb', 'bb', 'player'], default: 'player' }
}, { _id: false });

const RoundSchema = new Schema<IRound>({
  name: { type: String, enum: ['pre-flop', 'flop', 'turn', 'river', 'showdown'] },
  bettingRoundStartedAt: { type: Date, default: Date.now },
  actions: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: ['fold', 'check', 'call', 'raise', 'all-in', 'small-blind', 'big-blind'] },
    amount: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
  }]
}, { _id: false });

// const PotSchema = new Schema({
const PotSchema = new Schema<IArchivePotDocument>({
  amount: { type: Number, required: true, default: 0 },
  contributors: [{
    playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contribution: { type: Number, required: true, default: 0 },
  }],
  winners: [{
    playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, default: 0 },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// -----------------------------------------------------------------------------
// Embedded Game Schema & Engine Logic
// -----------------------------------------------------------------------------

// const PokerGameSchema = new Schema<IPokerGameSubdocument>({
//   players: [PlayerSchema],
//   currentTurnPlayer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
//   totalBet: { type: Number, default: 0 },
//   status: { type: String, enum: ['waiting', 'in-progress', 'finished'], default: 'waiting' },
//   rounds: [RoundSchema],
//   communityCards: [{
//     suit: { type: String, enum: ['hearts', 'diamonds', 'clubs', 'spades'] },
//     rank: { type: String, enum: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] }
//   }],
//   pots: { type: [PotSchema], default: null },
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });
const PokerGameSchema = new Schema<IPokerGameSubdocument>({
  players: [PlayerSchema],
  currentTurnPlayer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  totalBet: { type: Number, default: 0 },
  status: { type: String, enum: ['waiting', 'in-progress', 'finished'], default: 'waiting' },
  rounds: [RoundSchema],
  communityCards: [{
    suit: { type: String, enum: ['hearts', 'diamonds', 'clubs', 'spades'] },
    rank: { type: String, enum: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] }
  }],
  // FIX: Explicitly define the type as an array containing PotSchema
  pots: {
    type: [PotSchema],
    default: []
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const generateDeck = (): ICard[] => {
  const suits: ICard['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: ICard['rank'][] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: ICard[] = suits.flatMap(suit => ranks.map(rank => ({ suit, rank })));

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

PokerGameSchema.methods.dealCards = function (count: number, cardType: 'hole' | 'community' = 'community'): ICard[] {
  const usedCards = new Set<string>(
    this.players.flatMap((p: any) => p.holeCards)
      .concat(this.communityCards)
      .map((c: ICard) => `${c.rank}${c.suit}`)
  );

  let deck = generateDeck().filter(c => !usedCards.has(`${c.rank}${c.suit}`));

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const dealtCards: ICard[] = [];
  while (dealtCards.length < count && deck.length > 0) {
    dealtCards.push(deck.pop()!);
  }
  return dealtCards;
};

PokerGameSchema.methods.getNextActivePlayer = function (currentUserId: Types.ObjectId): Types.ObjectId | null {
  const currentIndex = this.players.findIndex((p: any) => p.userId.equals(currentUserId));
  if (currentIndex === -1) return null;

  let nextIndex = (currentIndex + 1) % this.players.length;
  for (let i = 0; i < this.players.length; i++) {
    const nextPlayer = this.players[nextIndex];
    if (nextPlayer.status === 'active') return nextPlayer.userId;
    nextIndex = (nextIndex + 1) % this.players.length;
  }
  return null;
};

PokerGameSchema.methods.getFirstActivePlayer = function (): Types.ObjectId | null {
  for (const player of this.players) {
    if (player.status === 'active') return player.userId;
  }
  return null;
};

PokerGameSchema.methods.startNextRound = async function (prevRoundName?: 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown') {
  const roundOrder = ['pre-flop', 'flop', 'turn', 'river', 'showdown'];
  let roundName;

  if (prevRoundName) {
    const nextRoundIndex = roundOrder.indexOf(prevRoundName) + 1;
    if (nextRoundIndex >= roundOrder.length) throw new Error('All rounds completed.');
    roundName = roundOrder[nextRoundIndex] as 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown';
  } else {
    const lastRound = this.rounds.length ? this.rounds[this.rounds.length - 1].name : null;
    const nextRoundIndex = lastRound ? roundOrder.indexOf(lastRound) + 1 : 0;
    if (nextRoundIndex >= roundOrder.length) throw new Error('All rounds completed.');
    roundName = roundOrder[nextRoundIndex] as 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown';
  }

  if (this.rounds.some((r: IRound) => r.name === roundName)) {
    throw new Error(`Round "${roundName}" already started.`);
  }

  this.rounds.push({ name: roundName, bettingRoundStartedAt: new Date(), actions: [] });

  switch (roundName) {
    case 'pre-flop':
      this.dealCards(this.players.length * 2, 'hole');
      break;
    case 'flop':
      this.communityCards.push(...this.dealCards(3, 'community'));
      break;
    case 'turn':
    case 'river':
      this.communityCards.push(...this.dealCards(1, 'community'));
      break;
    case 'showdown':
      return;
    default:
      throw new Error('Invalid round name.');
  }

  this.currentTurnPlayer = this.getFirstActivePlayer();
  const parent = this.parent() as any;
  if (parent) await parent.save();
};

// -----------------------------------------------------------------------------
// Main Desk Schema & Engine Logic
// -----------------------------------------------------------------------------

const PokerDeskSchema = new Schema<IPokerDeskDocument>({
  pokerModeId: { type: Schema.Types.ObjectId, ref: 'PokerMode', required: true },
  tableName: { type: String, required: true },
  maxSeats: { type: Number, required: true },
  seats: { type: [SeatSchema], default: [] },
  observers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  currentGame: { type: PokerGameSchema, default: null },
  currentGameStatus: { type: String, enum: ['waiting', 'in-progress', 'finished'], default: 'waiting' },
  totalBuyIns: { type: Number, default: 0 },
  stake: { type: Number, default: 0 },
  minBuyIn: { type: Number, required: true },
  maxBuyIn: { type: Number, required: true },
  minPlayerCount: { type: Number, default: 2, required: true },
  bType: { type: String, enum: ['blinds', 'antes', 'both'], required: true },
  gameType: {
    type: String,
    enum: ['NLH', 'PLO4', 'PLO5', 'OmahaHILO', 'SDH', 'STUD', 'RAZZ', 'PINEAPPLE', 'COURCHEVEL', '5CD', 'BADUGI', 'MIXED'],
    default: 'NLH',
    required: true,
  },
  status: { type: String, enum: ['active', 'disable'], default: 'active', required: true },
  mode: { type: String, enum: ['practice', 'cash'], default: 'cash', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

PokerDeskSchema.pre<IPokerDeskDocument>('save', function (next) {
  this.updatedAt = new Date();
  next();
});

PokerDeskSchema.methods.addUserToSeat = async function (userId: Types.ObjectId, buyInAmount: number): Promise<ISeat> {
  if (!userId || !buyInAmount) throw new Error('User ID and buy-in amount are required.');
  if (buyInAmount < this.minBuyIn || buyInAmount > this.maxBuyIn) {
    throw new Error('Buy-in amount outside allowed range.');
  }
  if (this.seats.length >= this.maxSeats) throw new Error('No available seats.');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  if (this.mode === 'cash') {
    if (user.wallet.balance < buyInAmount) throw new Error('Insufficient balance.');
    user.wallet.balance -= buyInAmount;
  }

  const seatNumber = this.seats.length + 1;
  const newSeat = { seatNumber, userId, buyInAmount, balanceAtTable: buyInAmount, status: 'active' as const };
  
  this.seats.push(newSeat);
  this.totalBuyIns += buyInAmount;

  if (this.mode === 'cash' && buyInAmount > 0) {
    user.wallet.transactions.push({
      createdOn: new Date(),
      completedOn: new Date(),
      status: 'completed',
      amount: {
        cashAmount: buyInAmount,
        instantBonus: 0,
        lockedBonus: 0,
        gst: 0,
        tds: 0,
        otherDeductions: 0,
        total: buyInAmount,
      },
      type: 'deskIn',
      remark: `User joined table seat ${seatNumber}`,
      DeskId: this._id,
    } as any);
    await user.save();
  }

  await this.save();
  return newSeat;
};

PokerDeskSchema.methods.addWalletBalance = async function (userId: Types.ObjectId, buyInAmount: number): Promise<void> {
  if (!userId || !buyInAmount) throw new Error('Required fields missing.');
  if (buyInAmount < this.minBuyIn || buyInAmount > this.maxBuyIn) throw new Error('Amount out of range.');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  if (this.mode === 'cash') {
    if (user.wallet.balance < buyInAmount) throw new Error('Insufficient balance.');
    user.wallet.balance -= buyInAmount;
  }

  this.totalBuyIns += buyInAmount;

  if (this.mode === 'cash' && buyInAmount > 0) {
    user.wallet.transactions.push({
      createdOn: new Date(),
      completedOn: new Date(),
      status: 'completed',
      amount: { cashAmount: buyInAmount, instantBonus: 0, lockedBonus: 0, gst: 0, tds: 0, otherDeductions: 0, total: buyInAmount },
      type: 'deskIn',
      remark: `User added balance: ${buyInAmount}`,
      DeskId: this._id,
    } as any);
    await user.save();
  }
};

PokerDeskSchema.methods.userLeavesSeat = async function (userId: Types.ObjectId): Promise<number> {
  const seatToRemove = this.seats.find((s: any) => s.userId.equals(userId));
  if (!seatToRemove) throw new Error('User not seated.');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  const amountToAdd = Math.ceil(seatToRemove.balanceAtTable * 100) / 100;

  if (this.mode === 'cash' && amountToAdd > 0) {
    user.wallet.transactions.push({
      createdOn: new Date(),
      completedOn: new Date(),
      status: 'completed',
      amount: { cashAmount: amountToAdd, instantBonus: 0, lockedBonus: 0, gst: 0, tds: 0, otherDeductions: 0, total: amountToAdd },
      type: 'deskWithdraw',
      remark: `User left table, withdrew ${amountToAdd}`,
      DeskId: this._id,
    } as any);
    user.wallet.balance += amountToAdd;
  }

  this.seats = this.seats.filter((s: any) => !s.userId.equals(userId)) as any;

  if (this.mode === 'cash') await user.save();
  await this.save();
  return seatToRemove.seatNumber;
};

PokerDeskSchema.methods.updateSeatStatus = async function (userId: Types.ObjectId, status: 'active' | 'disconnected' | 'sittingOut'): Promise<void> {
  const isGameActive = this.currentGame && this.currentGame.status === 'in-progress';
  
  if (status === 'disconnected' && !isGameActive) {
    await this.userLeavesSeat(userId);
  } else {
    const seat = this.seats.find((s: any) => s.userId.equals(userId));
    if (seat) seat.status = status;
  }
  await this.save();
};

PokerDeskSchema.methods.addObserver = async function (userId: Types.ObjectId): Promise<void> {
  if (!this.observers.includes(userId)) {
    this.observers.push(userId);
    await this.save();
  }
};

PokerDeskSchema.methods.removeObserver = async function (userId: Types.ObjectId): Promise<void> {
  this.observers = this.observers.filter((id: any) => !id.equals(userId)) as any;
  await this.save();
};

PokerDeskSchema.methods.isUserSeated = function (userId: Types.ObjectId): boolean {
  return this.seats.some((s: any) => s.userId.equals(userId));
};

PokerDeskSchema.methods.createGameFromTable = async function () {
  if (this.currentGame && this.currentGame.status !== 'finished') {
    throw new Error('Active game exists.');
  }

  const activePlayers = this.seats
    .filter((s: any) => s.status === 'active' && s.balanceAtTable >= this.minBuyIn)
    .map((s: any) => ({ userId: s.userId, balanceAtTable: s.balanceAtTable, status: 'active', totalBet: 0, holeCards: [], role: 'player' }));
  
  if (activePlayers.length < 2) throw new Error('Not enough players.');

  let holeCardsCount = this.gameType === 'PLO4' ? 4 : this.gameType === 'PLO5' ? 5 : 2;
  let blindType = ['STUD', 'RAZZ'].includes(this.gameType) ? 'ante' : 'blind';
  let anteAmount = this.stake;
  let smallBlindAmount = ['STUD', 'RAZZ'].includes(this.gameType) ? 0 : this.stake;
  let bigBlindAmount = ['STUD', 'RAZZ'].includes(this.gameType) ? 0 : 2 * this.stake;

  if (blindType === 'blind') {
    activePlayers[0].role = 'sb';
    activePlayers[1].role = 'bb';
    activePlayers[0].totalBet = smallBlindAmount;
    activePlayers[1].totalBet = bigBlindAmount;
    activePlayers[0].balanceAtTable -= smallBlindAmount;
    activePlayers[1].balanceAtTable -= bigBlindAmount;
  } else {
    activePlayers.forEach((p: any) => { p.balanceAtTable -= anteAmount; p.totalBet += anteAmount; });
  }

  const initialPotAmount = activePlayers.reduce((sum: number, p: any) => sum + p.totalBet, 0);
  const deck = generateDeck();
  activePlayers.forEach((p: any) => p.holeCards = Array.from({ length: holeCardsCount }, () => deck.pop()!));

  this.currentGame = {
    players: activePlayers,
    currentTurnPlayer: activePlayers[blindType === 'blind' ? 2 : 0]?.userId || activePlayers[0].userId,
    totalBet: initialPotAmount,
    pots: null,
    status: 'in-progress',
    rounds: [{
      name: 'pre-flop',
      bettingRoundStartedAt: new Date(),
      actions: blindType === 'blind'
        ? [
            { userId: activePlayers[0].userId, action: 'small-blind', amount: smallBlindAmount, timestamp: new Date() },
            { userId: activePlayers[1].userId, action: 'big-blind', amount: bigBlindAmount, timestamp: new Date() }
          ]
        : activePlayers.map((p: any) => ({ userId: p.userId, action: 'ante', amount: anteAmount, timestamp: new Date() }))
    }],
    communityCards: [],
  } as any;

  this.currentGameStatus = 'in-progress';

  this.seats.forEach((seat: any, i: number) => {
    const mp = activePlayers.find((p: any) => p.userId.equals(seat.userId));
    if (mp) seat.balanceAtTable = mp.balanceAtTable;
    else if (seat.balanceAtTable < this.minBuyIn) this.seats.splice(i, 1);
  });

  await this.save();
  return this.currentGame;
};

PokerDeskSchema.methods.handlePlayerAction = async function (userId: Types.ObjectId, action: PlayerAction, amount: number = 0) {
  if (!this.currentGame!.currentTurnPlayer!.equals(userId)) throw new Error("Not player's turn.");

  const playerSeat = this.seats.find((s: any) => s.userId.equals(userId));
  const player = this.currentGame!.players.find((p: any) => p.userId.equals(userId));
  if (!player || !playerSeat) throw new Error('Player/Seat not found.');

  const currentRound = this.currentGame!.rounds[this.currentGame!.rounds.length - 1];
  if (!currentRound || currentRound.name === "showdown") throw new Error('No active round.');

  let maxBet = 0;
  const playerBets = currentRound.actions.reduce((acc: any, act: any) => {
    acc[act.userId] = (acc[act.userId] || 0) + act.amount;
    maxBet = Math.max(maxBet, acc[act.userId]);
    return acc;
  }, {});

  const playerTotalBet = playerBets[userId.toString()] || 0;
  const callAmount = Math.max(0, maxBet - playerTotalBet);
  
  let newAction: IPlayerActionRecord = { userId: userId as any, timestamp: new Date(), action: 'fold', amount: 0 };

  if (action === 'fold') {
    player.status = 'folded';
    newAction.action = 'fold';
  } else if (action === 'check' && callAmount === 0) {
    newAction.action = 'check';
  } else if (['call', 'raise', 'all-in'].includes(action)) {
    let finalAmount = action === 'raise' ? amount : callAmount;
    
    if (action === 'all-in' || finalAmount >= player.balanceAtTable) {
      finalAmount = player.balanceAtTable;
      newAction.action = callAmount === 0 && finalAmount === 0 ? 'check' : 'all-in';
      if (newAction.action === 'all-in') player.status = 'all-in';
    } else {
      if (finalAmount === callAmount) newAction.action = 'call';
      else newAction.action = 'raise'; // implicit raise
    }

    player.balanceAtTable -= finalAmount;
    player.totalBet += finalAmount;
    playerSeat.balanceAtTable -= finalAmount;
    this.currentGame!.totalBet += finalAmount;
    newAction.amount = finalAmount;
  } else {
    throw new Error('Invalid action.');
  }

  currentRound.actions.push(newAction as any);

  const activePlayers = this.currentGame!.players.filter((p: any) => p.status === 'active' || p.status === 'all-in');
  
  if (activePlayers.length <= 1) {
    await this.showdown();
  } else {
    const nextPlayerId = this.currentGame!.getNextActivePlayer(userId);
    const actionPlayerIds = new Set(currentRound.actions.map((a: any) => a.userId.toString()));
    
    if (!nextPlayerId) {
      await this.showdown();
      return newAction;
    }

    if (!actionPlayerIds.has(nextPlayerId.toString())) {
      this.currentGame!.currentTurnPlayer = nextPlayerId;
    } else {
      const totalBets = currentRound.actions.reduce((acc: any, act: any) => {
        acc[act.userId.toString()] = (acc[act.userId.toString()] || 0) + act.amount;
        return acc;
      }, {});
      
      const uniqueBets = new Set(Object.values(totalBets));
      const activeCount = activePlayers.filter((p: any) => p.status === 'active').length;

      if ((uniqueBets.size === 1 && currentRound.name === 'river') || (uniqueBets.size === 1 && activeCount === 1)) {
        await this.showdown();
      } else if (uniqueBets.size === 1) {
        await this.currentGame!.startNextRound(currentRound.name);
      } else {
        this.currentGame!.currentTurnPlayer = nextPlayerId;
      }
    }
  }

  await this.save();
  return newAction;
};

PokerDeskSchema.methods.showdown = async function () {
  if (!this.currentGame || this.currentGame.status !== 'in-progress') throw new Error('Game not in progress.');

  const gamePots = createPots(this.currentGame.rounds);
  const potResults = evaluatePots(this.currentGame.players, this.currentGame.communityCards, gamePots, this.gameType);
  this.currentGame.pots = potResults as any;

  for (const pot of potResults) {
    if (pot.winners.length > 0) {
      for (const winner of pot.winners) {
        const playerSeat = this.seats.find((s: any) => s.userId.equals(winner.playerId));
        if (playerSeat) playerSeat.balanceAtTable += winner.amount;
      }
    }
  }

  const archivedGame = new PokerGameArchive({
    deskId: this._id,
    stack: this.stake, // corrected from this.stack
    bType: this.bType,
    mode: this.mode,
    deskName: this.tableName,
    gameType: this.gameType,
    players: this.currentGame.players,
    currentTurnPlayer: this.currentGame.currentTurnPlayer,
    totalBet: this.currentGame.totalBet,
    status: 'finished',
    rounds: this.currentGame.rounds,
    communityCards: this.currentGame.communityCards,
    pots: potResults,
  });

  await archivedGame.save();
  
  this.currentGame.status = 'finished';
  await this.save();

  // BUG FIX: Look at the Seats to determine disconnection, not the game player.
  for (const player of this.currentGame.players) {
    const seat = this.seats.find((s: any) => s.userId.equals(player.userId));
    if (seat && seat.status === 'disconnected') {
      await this.userLeavesSeat(player.userId);
    }
  }
};

const PokerDesk = mongoose.models.PokerDesk || mongoose.model<IPokerDeskDocument>('PokerDesk', PokerDeskSchema);

export default PokerDesk;