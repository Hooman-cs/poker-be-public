import mongoose, { Schema, Document } from 'mongoose';
import User from './user'; // Adjust the path if necessary
import PokerGameArchive from './pokerGameArchive';
import {
  IPokerTable,
  ISeat,
  PlayerAction,
  ICard,
  IPokerGame,
  ISidePot,
  IPlayer,
  IRound,
  IPlayerActionRecord,
  IPlayerBets,
  RPokerGame,
  IWalletTransaction
} from '../utils/pokerModelTypes'; // Adjust the path based on your folder structure
// import {evaluateHands, evaluatePots} from '../utils/pokerHand';
import {evaluatePots} from '../utils/evaluate';
import createPots from '@/utils/createPots';
 
// Define your Seat schema
const SeatSchema = new Schema<ISeat>({
  seatNumber: { type: Number, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  buyInAmount: { type: Number, default: 0 },
  balanceAtTable: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'disconnected', 'sittingOut'], default: 'active' },
}, { _id: false });

// Define your Player schema (embedded in game)
const PlayerSchema = new Schema<IPlayer>({
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

// Define Round schema
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

const PotSchema = new Schema({
  amount: { type: Number, required: true, default: 0 }, // Total amount in the pot
  contributors: [
    {
      playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // The ID of the player contributing to the pot
      contribution: { type: Number, required: true, default: 0 }, // The amount contributed by the player
    },
  ],
  winners: [ {
    playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // The ID of the player contributing to the pot
    amount: { type: Number, required: true, default: 0 },// Each winner's ID maps to the amount they won from this pot
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
 
// Define the PokerGame schema embedded within PokerDesk
const PokerGameSchema = new Schema<IPokerGame>({
  players: [PlayerSchema],
  currentTurnPlayer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  totalBet: { type: Number, default: 0 },
  status: { type: String, enum: ['waiting', 'in-progress', 'finished'], default: 'waiting' },
  rounds: [RoundSchema],
  communityCards: [{
    suit: { type: String, enum: ['hearts', 'diamonds', 'clubs', 'spades'] },
    rank: { type: String, enum: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] }
  }],
  pots: { type: [PotSchema], default: null }, // Updated field
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Define your PokerDesk schema
const PokerDeskSchema = new Schema<IPokerTable>({
  pokerModeId: { type: Schema.Types.ObjectId, ref: 'PokerMode', required: true },
  tableName: { type: String, required: true },
  maxSeats: { type: Number, required: true },
  seats: { type: [SeatSchema], default: [] },
  observers: [{ type: Schema.Types.ObjectId, ref: 'User' }],

  // Embed current game with its own _id
  currentGame: {
    type: PokerGameSchema,  // Embedded schema
    default: null,  // Set default to null
  }, // Embedded poker game schema
  currentGameStatus: { type: String, enum: ['waiting', 'in-progress', 'finished'], default: 'waiting' },
  totalBuyIns: { type: Number, default: 0 },
  stake: {
    type: Number,
    default : 0,
  },
  minBuyIn: {
    type: Number,
    required: true,
  },
  maxBuyIn: {
    type: Number,
    required: true,
  },
  minPlayerCount: {
    type: Number,
    default:2,
    required: true,
  },
  bType: {
    type: String,
    enum: ['blinds', 'antes','both'],
    required: true,
  },
   // Game types
  gameType: {
    type: String,
    enum: [
      'NLH',       // No Limit Hold'em
      'PLO4',      // Pot Limit Omaha (4 cards)
      'PLO5',      // Pot Limit Omaha (5 cards)
      'OmahaHILO', // High-Low split games (e.g., Omaha Hi-Lo)
      'SDH',       // Short Deck Hold'em
      'STUD',      // Seven Card Stud
      'RAZZ',      // Razz (lowball)
      'PINEAPPLE', // Pineapple Poker
      'COURCHEVEL',// Courchevel Poker
      '5CD',       // Five Card Draw
      'BADUGI',    // Badugi Poker
      'MIXED',     // Mixed Games (e.g., H.O.R.S.E)
    ],
    default : 'NLH',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'disable'],
    default: 'active',
    required: true,
  },
  mode: {
    type: String,
    enum: ['practice', 'cash'],
    default: 'cash',
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}); 

// Pre-save middleware to update the updatedAt field
PokerDeskSchema.pre<IPokerTable>('save', function (next) {
  this.updatedAt = new Date();
  next();
});
 
PokerDeskSchema.methods.addUserToSeat = async function (userId: mongoose.Types.ObjectId, buyInAmount: number): Promise<ISeat> {
  // Validate input parameters
  if (!userId || !buyInAmount) {
    throw new Error('User ID and buy-in amount are required.');
  }
   
  if(!(buyInAmount >= this.minBuyIn || buyInAmount <= this.maxBuyIn)) { 
    throw new Error('buy in amount is less than minimum buy in amount or greater than maximum buyIn amount');
  }

  // Check for available seats
  if (this.seats.length >= this.maxSeats) {
    throw new Error('No available seats.');
  }

  // Fetch user information
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

 if(this.mode === 'cash'){ // Check if user has sufficient balance
  if (user.wallet.balance < buyInAmount) {
    throw new Error('Insufficient balance to join the table.');
  }

  // Update user's balance
  user.wallet.balance -= buyInAmount;
 }
  // Create the new seat
  const seatNumber = this.seats.length + 1;

  const newSeat: ISeat = {
    seatNumber,
    userId,
    buyInAmount,
    balanceAtTable: buyInAmount,
    status: 'active',
  };

  // Add the new seat to the table
  this.seats.push(newSeat);
  this.totalBuyIns += buyInAmount;

if(this.mode === 'cash'){
  if(buyInAmount>0){ 
        // Create a wallet transaction for the buy-in
    const transaction: IWalletTransaction = {
    createdOn: new Date(),
    completedOn: new Date(),  // Will be set when completed
    status: 'completed',  // Assuming it is successful immediately
    amount: {
      cashAmount: buyInAmount,
      instantBonus: 0,
      lockedBonus: 0,
      gst: 0,
      tds: 0,
      otherDeductions: 0,
      total: buyInAmount,  // Total is equal to the buy-in amount in this case
    },
    type: 'deskIn',  // Transaction type indicating user joined the table
    remark: `User joined the table with seat number ${seatNumber}`,
    DeskId: this._id,  // Assuming `this._id` is the current desk's ID
        }; 
         // Add the transaction to the user's wallet
    user.wallet.transactions.push(transaction); 
  }
  try {
    await user.save(); // Save user with updated balance and transaction
  } catch (error: any) {
    throw new Error('Error saving the updated table or user: ' + error.message);
  }
}
  // Save the updated user and PokerDesk instances
  try {
    await this.save(); // Save PokerDesk with the new seat
    return newSeat; // Return the newly created seat
  } catch (error: any) {
    throw new Error('Error saving the updated table or user: ' + error.message);
  }
};

PokerDeskSchema.methods.addWalletBalance = async function (userId: mongoose.Types.ObjectId, buyInAmount: number): Promise<void> {
  // Validate input parameters
  if (!userId || !buyInAmount) {
    throw new Error('User ID and buy-in amount are required.');
  }

  // Fetch user information
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  // Validate buy-in amount range
  if (buyInAmount < this.minBuyIn || buyInAmount > this.maxBuyIn) {
    throw new Error('Buy-in amount is less than the minimum or greater than the maximum buy-in amount.');
  }

  if (this.mode === 'cash') {
    // Check if user has sufficient balance
    if (user.wallet.balance < buyInAmount) {
      throw new Error('Insufficient balance to add more balance to the table.');
    }

    // Deduct the buy-in amount from user's wallet
    user.wallet.balance -= buyInAmount;
  }

  // Increment total buy-ins
  this.totalBuyIns += buyInAmount;

  if (this.mode === 'cash' && buyInAmount > 0) {
    // Create a wallet transaction for the buy-in in cash mode
    const transaction: IWalletTransaction = {
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
      remark: `User added more balance to table: ${buyInAmount}`,
      DeskId: this._id,
    };

    // Add the transaction to the user's wallet
    user.wallet.transactions.push(transaction);
  }

  // Save the updated user and PokerDesk instances
  try {
    if (this.mode === 'cash') {
      await user.save(); // Save user only in cash mode
    }
  } catch (error: any) {
    throw new Error('Error saving the updated user or table: ' + error.message);
  }
};

// PokerDeskSchema.methods.userLeavesSeat = async function (userId: mongoose.Types.ObjectId): Promise<number> {
//   // Find the seat occupied by the user
//   const seatToRemove = this.seats.find((seat: ISeat) => seat.userId && seat.userId.equals(userId));

//   if (!seatToRemove) {
//     throw new Error('User is not seated at this table.');
//   }

//   // Fetch the user from the database
//   const user = await User.findById(userId);
//   if (!user) {
//     throw new Error('User not found.');
//   }

//   // Update the user's balance and create a wallet transaction
//  const amountToAdd = Math.ceil(seatToRemove.balanceAtTable * 100) / 100;

//   // Create a wallet transaction for the balance being returned to the user
//   if(amountToAdd>0){
//     const transaction: IWalletTransaction = {
//     createdOn: new Date(),                 // Current timestamp for creation
//     completedOn: new Date(),               // Timestamp when the transaction is completed
//     status: 'completed',                  // Status of the transaction
//     amount: {                              // Updated amount structure
//       cashAmount: amountToAdd,             // Cash portion of the transaction
//       instantBonus: 0,                     // No instant bonus applied here
//       lockedBonus: 0,                      // No locked bonus applied here
//       gst: 0,                              // Assuming no GST for this transaction
//       tds: 0,                              // Assuming no TDS deductions
//       otherDeductions: 0,                  // Assuming no other deductions
//       total: amountToAdd,                  // Total amount matches cashAmount
//     },
//     type: 'deskWithdraw',                  // Type indicating user leaving the table
//     remark: `User left the table and withdrew ${amountToAdd}`, // Remark for clarity
//     DeskId: this._id,                      // Reference to this PokerDesk
//        };
//       // Update the user's wallet balance
//       user.wallet.balance += amountToAdd;
//       user.wallet.transactions.push(transaction);
//   }
//   // Filter out the seat from the array
//   this.seats = this.seats.filter((seat: ISeat) => !seat.userId?.equals(userId));

//   try {
//     // Save the updated user and PokerDesk instances
//     await user.save(); // Save user with updated balance and transaction
//     await this.save(); // Save PokerDesk with the updated seats
//     return seatToRemove.seatNumber; // Return the seat number that was removed
//   } catch (error: any) {
//     throw new Error('Error saving the updated table or user: ' + error.message);
//   }
// };

PokerDeskSchema.methods.userLeavesSeat = async function (userId: mongoose.Types.ObjectId): Promise<number> {
  // Find the seat occupied by the user
  const seatToRemove = this.seats.find((seat: ISeat) => seat.userId && seat.userId.equals(userId));

  if (!seatToRemove) {
    throw new Error('User is not seated at this table.');
  }

  // Fetch the user from the database
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  const amountToAdd = Math.ceil(seatToRemove.balanceAtTable * 100) / 100;

  if (this.mode === 'cash' && amountToAdd > 0) {
    // For cash mode, update user's wallet balance and create a transaction
    const transaction: IWalletTransaction = {
      createdOn: new Date(),
      completedOn: new Date(),
      status: 'completed',
      amount: {
        cashAmount: amountToAdd,
        instantBonus: 0,
        lockedBonus: 0,
        gst: 0,
        tds: 0,
        otherDeductions: 0,
        total: amountToAdd,
      },
      type: 'deskWithdraw',
      remark: `User left the table and withdrew ${amountToAdd}`,
      DeskId: this._id,
    };

    user.wallet.balance += amountToAdd;
    user.wallet.transactions.push(transaction);
  }

  // Remove the seat from the table
  this.seats = this.seats.filter((seat: ISeat) => !seat.userId?.equals(userId));

  try {
    // Save the updated user and PokerDesk instances
    if (this.mode === 'cash') {
      await user.save(); // Save user only for cash mode
    }

    await this.save(); // Save PokerDesk with the updated seats
    return seatToRemove.seatNumber; // Return the seat number that was removed
  } catch (error: any) {
    throw new Error('Error saving the updated table or user: ' + error.message);
  }
};

PokerDeskSchema.methods.updateSeatStatus = async function (
  userId: mongoose.Types.ObjectId,
  status: 'active' | 'disconnected' | 'sittingOut'
): Promise<void> {
  try {
    // Check if there is an ongoing game on this table
    const isGameActive = this.currentGame && this.currentGame.status === 'in-progress';

    if (status === 'disconnected') {
      if (isGameActive) {
        // If a game is active, just set the user's seat status to disconnected
        const seat = this.seats.find((seat: ISeat) => seat.userId?.equals(userId));
        if (seat) {
          seat.status = 'disconnected';
        }
      } else { 
        await this.userLeavesSeat(userId); 
      }
    } else if (status === 'active' || status === 'sittingOut') {
      // Set the user's seat status to active
      const seat = this.seats.find((seat: ISeat) => seat.userId?.equals(userId));
      if (seat) {
        seat.status = 'active'; 
      }
    } 
    // Save changes to the desk instance
    await this.save();
  } catch (error: any) {
    console.error(`Failed to update seat status for user ${userId} at table ${this._id}: ${error.message}`);
    throw new Error(`Error updating seat status: ${error.message}`);
  }
};

// Method to add a user as an observer
PokerDeskSchema.methods.addObserver = async function (userId: mongoose.Types.ObjectId): Promise<void> {
  if (!this.observers.includes(userId)) {
    this.observers.push(userId);
    await this.save();
  }
};

// Method to remove a user from observers
PokerDeskSchema.methods.removeObserver = async function (userId: mongoose.Types.ObjectId): Promise<void> {
  this.observers = this.observers.filter((id:any)  => !id.equals(userId));
  await this.save();
};

// Method to check if a user is already seated
PokerDeskSchema.methods.isUserSeated = function (userId: mongoose.Types.ObjectId): boolean {
  return this.seats.some((seat: ISeat) => seat.userId && seat.userId.equals(userId));
};

const generateDeck = (): ICard[] => {
  const suits: ICard['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: ICard['rank'][] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  // Generate a deck of 52 cards
  const deck: ICard[] = suits.flatMap(suit => 
    ranks.map(rank => ({ suit, rank }))
  );

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]; // Swap cards
  }

  return deck;
};

// PokerDeskSchema.methods.createGameFromTable = async function (): Promise<RPokerGame> {
//   // Check if a current game already exists and if it's finished
//   if (this.currentGame && this.currentGame.status !== 'finished') {
//     throw new Error('There is already an active game.');
//   }


//   // Filter and set up active players from seats, ensuring they meet the min buy-in
//   const activePlayers = this.seats
//     .filter((seat: ISeat) => seat.userId && seat.status === 'active' && seat.balanceAtTable >= this.minBuyIn)
//     .map((seat:ISeat) => ({
//       userId: seat.userId!,
//       balanceAtTable: seat.balanceAtTable,
//       status: 'active',
//       totalBet: 0,
//       holeCards: [],
//       role: 'player',
//     }));

//   if (activePlayers.length < 2) {
//     throw new Error('Not enough active players to start a game.');
//   }

//   let blindType = 'blind';

//   switch (this.gameType) {
//     case 'NLH': 
//     case 'PLO4':
//     case 'PLO5':
//       blindType = 'blind';  
//       break;
//     case 'STUD':
//     case 'RAZZ':
//       blindType = 'ante';
//       break;
//     default:
//       throw new Error('Unsupported game type.');
//   }


//   // Assign roles: small blind (SB) and big blind (BB)
//   activePlayers[0].role = 'sb';
//   activePlayers[1].role = 'bb';

//   // Set SB and BB bet amounts
//   const smallBlindAmount = 1;
//   const bigBlindAmount = 2;
//   activePlayers[0].totalBet = smallBlindAmount;
//   activePlayers[1].totalBet = bigBlindAmount;
//   activePlayers[0].balanceAtTable -= smallBlindAmount;
//   activePlayers[1].balanceAtTable -= bigBlindAmount;

//   // Initialize the pot with SB and BB
//   const initialPotAmount = smallBlindAmount + bigBlindAmount;
//   const deck: ICard[] = generateDeck();

//   // Deal hole cards to each player
//   activePlayers.forEach((player : IPlayer) => {
//     player.holeCards = [deck.pop()!, deck.pop()!];
//   });

//   // Create a new game object
//   const newGame : RPokerGame  = {
//     players: activePlayers,
//     currentTurnPlayer: activePlayers[2]?.userId || activePlayers[0].userId,
//     totalBet: initialPotAmount,
//     pots: null,
//     status: 'in-progress',
//     rounds: [{
//       name: 'pre-flop',
//       bettingRoundStartedAt: new Date(),
//       actions: [
//         { userId: activePlayers[0].userId, action: 'small-blind', amount: smallBlindAmount, timestamp: new Date()},
//         { userId: activePlayers[1].userId, action: 'big-blind', amount: bigBlindAmount, timestamp: new Date() },
//       ],
//     }],
//     communityCards: [],
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   };

//   // Update the poker desk with the new game
//   this.currentGame = newGame;
//   this.currentGameStatus = 'in-progress';

//   // Deduct balances in seats and remove players below the minimum buy-in
//   this.seats.forEach((seat: ISeat, index: number) => {
//     const matchingPlayer = activePlayers.find((player:IPlayer) => player.userId.equals(seat.userId));
//     if (matchingPlayer) {
//       seat.balanceAtTable = matchingPlayer.balanceAtTable;
//     } else if (seat.balanceAtTable < this.minBuyIn) {
//       this.seats.splice(index, 1); // Remove player from the seat
//     }
//   });

//   await this.save();
//   return newGame;
// };


PokerDeskSchema.methods.createGameFromTable = async function (): Promise<RPokerGame> {
  // Ensure there is no active unfinished game
  if (this.currentGame && this.currentGame.status !== 'finished') {
    throw new Error('There is already an active game.');
  }

  // Filter active players meeting the minimum buy-in
  const activePlayers = this.seats
    .filter((seat: ISeat) => seat.userId && seat.status === 'active' && seat.balanceAtTable >= this.minBuyIn)
    .map((seat: ISeat) => ({
      userId: seat.userId!,
      balanceAtTable: seat.balanceAtTable,
      status: 'active',
      totalBet: 0,
      holeCards: [],
      role: 'player',
    })); 
  if (activePlayers.length < 2) {
    throw new Error('Not enough active players to start a game.');
  }
 
  // Determine game rules based on game type
  let holeCardsCount = 2; // Default for NLH
  let blindType = 'blind';
  let anteAmount = this.stake; // Default no ante
  let smallBlindAmount = this.stake;
  let bigBlindAmount = 2 * this.stake;

  switch (this.gameType) {
    case 'NLH':
      holeCardsCount = 2; // No Limit Hold'em
      break;
    case 'PLO4':
      holeCardsCount = 4; // Pot Limit Omaha (4 hole cards)
      break;
    case 'PLO5':
      holeCardsCount = 5; // Pot Limit Omaha (5 hole cards)
      break;
    case 'STUD':
    case 'RAZZ':
      smallBlindAmount = 0;
      bigBlindAmount = 0; 
      break;
    default:
      throw new Error('Unsupported game type.');
  }
  
 
 
  // Set roles for SB and BB if applicable
  if (blindType === 'blind') {
    activePlayers[0].role = 'sb';
    activePlayers[1].role = 'bb';
    activePlayers[0].totalBet = smallBlindAmount;
    activePlayers[1].totalBet = bigBlindAmount;
    activePlayers[0].balanceAtTable -= smallBlindAmount;
    activePlayers[1].balanceAtTable -= bigBlindAmount;
  }

  // Apply ante to all players if applicable
  if (blindType === 'ante') {
    activePlayers.forEach((player: IPlayer) => {
      player.balanceAtTable -= anteAmount;
      player.totalBet += anteAmount;
    });
  }

  // Calculate initial pot
  const initialPotAmount = activePlayers.reduce((total: any, player: { totalBet: any; }) => total + player.totalBet, 0);

  // Create a deck and deal hole cards
  const deck: ICard[] = generateDeck();
  activePlayers.forEach((player: IPlayer) => {
    player.holeCards = Array.from({ length: holeCardsCount }, () => deck.pop()!);
  });
 

  // Create a new game object
  const newGame: RPokerGame = {
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
          { userId: activePlayers[1].userId, action: 'big-blind', amount: bigBlindAmount, timestamp: new Date() },
        ]
        : activePlayers.map((player: IPlayer) => ({
          userId: player.userId,
          action: 'ante',
          amount: anteAmount,
          timestamp: new Date(),
        })),
    }],
    communityCards: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Update the poker desk with the new game
  this.currentGame = newGame;
  this.currentGameStatus = 'in-progress';

  // Deduct balances in seats and remove players below the minimum buy-in
  this.seats.forEach((seat: ISeat, index: number) => {
    const matchingPlayer = activePlayers.find((player: IPlayer) => player.userId.equals(seat.userId));
    if (matchingPlayer) {
      seat.balanceAtTable = matchingPlayer.balanceAtTable;
    } else if (seat.balanceAtTable < this.minBuyIn) {
      this.seats.splice(index, 1); // Remove player from the seat
    }
  });

  await this.save();
  return newGame;
};

PokerGameSchema.methods.dealCards = function (
  count: number,
  cardType: 'hole' | 'community' = 'community'
): ICard[] {
  // Get all cards already dealt (hole cards and community cards)
  const usedCards = new Set<string>(
    this.players
      .flatMap((player : IPlayer) => player.holeCards) // Collect hole cards of all players
      .concat(this.communityCards) // Combine with community cards
      .map((card :ICard)=> `${card.rank}${card.suit}`) // Convert to a string representation for easy comparison
  );

  // Generate a full shuffled deck and filter out already dealt cards
  let deck = generateDeck().filter(
    card => !usedCards.has(`${card.rank}${card.suit}`)
  );

  // Fisher-Yates shuffle (to ensure a truly random shuffle)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const dealtCards: ICard[] = [];

  // Deal the required number of cards
  while (dealtCards.length < count && deck.length > 0) {
    dealtCards.push(deck.pop()!); // Get the top card from the shuffled and filtered deck
  }

  return dealtCards;
};

PokerGameSchema.methods.getNextActivePlayer = function (currentUserId: mongoose.Types.ObjectId): mongoose.Types.ObjectId | null {
  // Get the index of the current player
  const currentIndex = this.players.findIndex((player:IPlayer) => player.userId.equals(currentUserId));
  if (currentIndex === -1) {
    return null; // Current user not found in the players array
  }

  // Find the next active player
  let nextIndex = (currentIndex + 1) % this.players.length;
  for (let i = 0; i < this.players.length; i++) {
    const nextPlayer = this.players[nextIndex];
    if (nextPlayer.status === 'active' ) {
      return nextPlayer.userId; // Return the next active player's userId
    }
    nextIndex = (nextIndex + 1) % this.players.length; // Move to the next player
  }

  return null; // No active players found
};

PokerGameSchema.methods.getFirstActivePlayer = function (): mongoose.Types.ObjectId | null {
  for (const player of this.players) {
    if (player.status === 'active') {
      return player.userId; // Return the first active player's userId
    }
  }
  return null; // No active players found
};

PokerGameSchema.methods.startNextRound = async function (prevRoundName?: 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown') {
  // Define the round order
  const roundOrder = ['pre-flop', 'flop', 'turn', 'river', 'showdown'];
  let roundName;
  // Determine the next round based on prevRoundName
  if (prevRoundName) {
    const currentRoundIndex = roundOrder.indexOf(prevRoundName);
    const nextRoundIndex = currentRoundIndex + 1;

    if (nextRoundIndex >= roundOrder.length) {
      throw new Error('All rounds have been completed.');
    }

    // Set roundName based on the next index
    roundName = roundOrder[nextRoundIndex] as 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown';
  } else {
    // If no prevRoundName is provided, determine the next round from the last round played
    const lastRound = this.rounds.length ? this.rounds[this.rounds.length - 1].name : null;
    const nextRoundIndex = lastRound ? roundOrder.indexOf(lastRound) + 1 : 0;

    if (nextRoundIndex >= roundOrder.length) {
      throw new Error('All rounds have been completed.');
    }

    roundName = roundOrder[nextRoundIndex] as 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown';
  }

  // Check if the round has already started
  if (this.rounds.some((round:IRound) => round.name === roundName)) {
    throw new Error(`Round "${roundName}" already started.`);
  }

  // Add the new round to the rounds array
  const newRound: IRound = {
    name: roundName,
    bettingRoundStartedAt: new Date(),
    actions: [],
  };
  this.rounds.push(newRound);

  // Handle card dealing based on the round name
  switch (roundName) {
    case 'pre-flop':
      // Deal hole cards at the start of the pre-flop round
      this.dealCards(this.players.length * 2, 'hole'); // 2 cards per player
      break;
    case 'flop':
      // Deal 3 community cards
      this.communityCards.push(...this.dealCards(3, 'community'));
      break;
    case 'turn':
      this.communityCards.push(...this.dealCards(1, 'community'));
      break;
    case 'river':
      // Deal 1 community card (turn or river)
      this.communityCards.push(...this.dealCards(1, 'community'));
      break;
    case 'showdown':
       // await this.showdown();
      return;
    default:
      throw new Error('Invalid round name.');
  }

  // Reset players' total bet for the new roun
   this.currentTurnPlayer = await this.getFirstActivePlayer();
  // Save the updated game state
  await this.save();
};

PokerDeskSchema.methods.handlePlayerAction = async function (userId: mongoose.Types.ObjectId, action: PlayerAction, amount: number = 0) {
  if (!this.currentGame.currentTurnPlayer.equals(userId)) {
    throw new Error("It's not this player's turn");
  }

  const playerSeat : ISeat = this.seats.find((seat:ISeat) => seat.userId.equals(userId));
  const player : IPlayer = this.currentGame.players.find((p : IPlayer) => p.userId.equals(userId));
  if (!player) throw new Error('Player not found.');

  const currentRound = this.currentGame.rounds[this.currentGame.rounds.length - 1];
  if (!currentRound || currentRound.name === "showdown") {
    throw new Error('No round in progress');
  }

  // Reduce actions to get player total bets and max bet
  let playerTotalBet = 0;
  let maxBet = 0;
  const playerBets : IPlayerBets  = currentRound?.actions?.reduce((acc:any, action:any) => {
    acc[action.userId] = (acc[action.userId] || 0) + action.amount;
    maxBet = Math.max(maxBet, acc[action.userId]);
    return acc;
  }, {}) || {};

  const maxBalance: number = this.currentGame.players.reduce(
    ({ maxBalance }: { maxBalance: number }, currentPlayer: IPlayer) => Math.max(maxBalance, currentPlayer.balanceAtTable),
    0 // Ensure a minimum value of 0
  );

  playerTotalBet = playerBets[userId.toString()] || 0;

  const callAmount : number = Math.max(0, maxBet - playerTotalBet); // To avoid negative values
  let newAction: IPlayerActionRecord = { userId, timestamp: new Date(), action: 'fold', amount: 0 };

  // Handle actions
  if (action === 'fold') {
    player.status = 'folded';
    newAction.action = 'fold';

  } else if (action === 'check' && callAmount === 0) {
    newAction.action = 'check';

  } 
  else if (action === 'call' || action === 'raise' || "all-in") {
    const isRaise = action === 'raise';
    let finalAmount = isRaise ? amount : callAmount;
    if(action !== "all-in"){
    // Handle all-in condition
    if (finalAmount >= player.balanceAtTable) {
      finalAmount = player.balanceAtTable;
      newAction.action = 'all-in';
      player.status = 'all-in';
    } else if (finalAmount < player.balanceAtTable) {
      // If final amount is less, auto-check or all-in
      if (finalAmount === callAmount) { 
        newAction.action = 'call';
      }
    }
   }else{
       newAction.action = callAmount === 0 ? 'check' : 'all-in';
        finalAmount = player.balanceAtTable;
        if( newAction.action == 'all-in'){ 
          player.status = 'all-in';
        } 
   }

    // Adjust balances
    player.balanceAtTable -= finalAmount;
    player.totalBet += finalAmount;
    playerSeat.balanceAtTable -= finalAmount;
    this.currentGame.totalBet += finalAmount;
    newAction.amount = finalAmount;

  } else {
    throw new Error('Invalid action.');
  }

  currentRound.actions.push(newAction); 
  // Check remaining active players
  const activePlayers = this.currentGame.players.filter((p : IPlayer) => p.status === 'active' ||  p.status === 'all-in' );

  if (activePlayers.length <= 1) { 
    await this.showdown();
  } 
  else {
    const activeN = this.currentGame.players.filter((p : IPlayer) => p.status === 'active');
    
    const actionPlayerIds = new Set(currentRound.actions.map((a:IPlayerActionRecord) => a.userId.toString()));
    const nextPlayerId = await this.currentGame.getNextActivePlayer(userId);
    const activeCount = activePlayers.filter((p:IPlayer) => p.status === 'active').length;
    if(!nextPlayerId){
      await this.showdown();
      return;
    }else{
      if (activeCount <= 1){
        const nextPlayerTotalBet = playerBets[nextPlayerId.toString()] || 0;
        let nextMaxBet =  callAmount;
        if(newAction.amount >= nextMaxBet){
          nextMaxBet = newAction.amount;
        }
        const NextPlayerCallAmount : number = Math.max(0, nextMaxBet - nextPlayerTotalBet);
        if(NextPlayerCallAmount === 0){
          await this.showdown();
          return;
        }
      } 
    }

    const nextPlayerHasActed = actionPlayerIds.has(nextPlayerId.toString());
   
    if (!nextPlayerHasActed) { 
      this.currentGame.currentTurnPlayer = nextPlayerId;
    } else {

      interface ITotalBets {
        [userId: string]: number; // Allow string keys for user IDs
      }

    const totalBets = currentRound.actions.reduce((acc: ITotalBets, action: IPlayerActionRecord) => {
        acc[action.userId.toString()] = (acc[action.userId.toString()] || 0) + action.amount;
        return acc;
    }, {} as ITotalBets); // Type assertion for the initial value
    
      const uniqueBets = new Set(Object.values(totalBets));
       
      if (uniqueBets.size === 1 && currentRound.name === 'river' || uniqueBets.size === 1 && activeCount === 1 || activeCount <= 0 ) {         
        await this.showdown();
      } else if (uniqueBets.size === 1) {
         await this.currentGame.startNextRound(currentRound.name);
      } 
      else {
        this.currentGame.currentTurnPlayer = nextPlayerId;
      }
    }
  }
  // Save state and return the player's action
  await this.save();
  return newAction;
};

PokerDeskSchema.methods.showdown = async function () {

  if (!this.currentGame || this.currentGame.status !== 'in-progress') {
    throw new Error('Game is not currently in progress.');
  }

  
  // Gather players who are still eligible (active or all-in)
  const eligiblePlayers = this.currentGame.players.filter((player : IPlayer) => 
    player.status === 'active' || player.status === 'all-in'
  );

  // Evaluate hands for eligible players
 // const playerHands = evaluateHands(eligiblePlayers, this.currentGame.communityCards);
  
  const gamePots = createPots(this.currentGame.rounds)
  // Evaluate pots and determine winners
  const potResults = evaluatePots(this.currentGame.players, this.currentGame.communityCards, gamePots, this.gameType);
  // Save the evaluated pot results to the current game
  this.currentGame.pots = potResults;
  // Process each pot to distribute winnings

 for (const pot of potResults) {
  const winners = pot.winners;

  // If there are winning players, distribute the winnings
  if (winners.length > 0) {
    // Update each winning player's balance using the winning amounts from evaluatePots
    for (const winner of winners) {
      const { playerId, amount } = winner; // Extract playerId and winning amount
      const playerSeat = this.seats.find((seat:ISeat) => seat.userId.toString() === playerId.toString());
      if (playerSeat) {
        playerSeat.balanceAtTable += amount; // Distribute winnings
      }
    }
  }
}

  const archivedGame = new PokerGameArchive({
    deskId: this._id, // Assuming this is the desk's ID
    stack: this.stack, // Add stack from the current context
    bType : this.bType,
    mode : this.mode,
    deskName : this.tableName,
    gameType: this.gameType, // Add gameType (ensure it's sourced correctly)
    players: this.currentGame.players,
    currentTurnPlayer: this.currentGame.currentTurnPlayer,
    totalBet: this.currentGame.totalBet, // Add totalBet from the current game's context
    status: 'finished',
    rounds: this.currentGame.rounds,
    communityCards: this.currentGame.communityCards,
    pots: potResults, // Assuming potResults is calculated elsewhere
});

  
  await archivedGame.save();
  console.log("archivedGame",archivedGame);
  // Set the current game status to finished
  this.currentGame.status = 'finished';
   this.currentGame.pots = potResults;
  // Save the updated desk state to the database
  
  await this.save();

  for (const player of this.currentGame.players) {
    if (player.status === 'disconnected') {
      
      await this.userLeavesSeat(player.userId);
    }
  }
};

const PokerDesk = mongoose.models.PokerDesk || mongoose.model<IPokerTable>('PokerDesk', PokerDeskSchema);
 
export default PokerDesk;
