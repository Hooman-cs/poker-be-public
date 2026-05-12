// /**
//  * @fileoverview Standalone Socket.io Game Engine
//  * Runs independently from Next.js to handle persistent real-time poker logic.
//  */

// import express from 'express';
// import { createServer } from 'http';
// import { Server as SocketIOServer, Socket } from 'socket.io';
// import jwt from 'jsonwebtoken';
// import dotenv from 'dotenv';
// // IMPORTANT: Adjust these paths to match your actual project structure
// import dbConnect from './config/dbConnect';
// import PokerDesk from './models/pokerDesk'; 
// dotenv.config();
/**
 * @fileoverview Standalone Socket.io Game Engine
 */

import dotenv from 'dotenv';
import path from 'path';

// 1. FIX: Load .env.local BEFORE importing dbConnect or Mongoose models
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

// Now it is safe to import these because the env variables are loaded
import dbConnect from './config/dbConnect';
import PokerDesk from './models/pokerDesk';

// -----------------------------------------------------------------------------
// Strict Interfaces & Types
// -----------------------------------------------------------------------------

interface TokenPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

interface SocketRegistry {
  [tableId: string]: {
    [userId: string]: string[];
  };
}

// Partial interface for Mongoose document methods used in this file
interface IPokerTableDoc extends Document {
  _id: any;
  seats: any[];
  minPlayerCount: number;
  currentGame?: any;
  updateSeatStatus: (userId: string, status: string) => Promise<void>;
  createGameFromTable: (tableId?: string) => Promise<void>;
  isUserSeated: (userId: string) => Promise<boolean>;
  addUserToSeat: (userId: string, buyInAmount: number) => Promise<void>;
  addWalletBalance: (userId: string, buyInAmount: number) => Promise<void>;
  handlePlayerAction: (userId: string, action: string, amount: number) => Promise<void>;
  removeObserver: (userId: string) => Promise<void>;
}

// -----------------------------------------------------------------------------
// In-Memory State
// -----------------------------------------------------------------------------
const socketRegistry: SocketRegistry = {};
const activeTimers: Record<string, NodeJS.Timeout> = {};

// -----------------------------------------------------------------------------
// Server Initialization
// -----------------------------------------------------------------------------
const app = express();
const httpServer = createServer(app);

// 2. FIX: Configure Socket.io to accept the legacy path and allow Next.js CORS
const io = new SocketIOServer(httpServer, {
  path: '/api/socket', // Matches the path your frontend is already requesting
  cors: {
    origin: process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});
// const app = express();
// const httpServer = createServer(app);

// // Configure CORS for standalone server
// const io = new SocketIOServer(httpServer, {
//   cors: {
//     origin: process.env.NEXT_PUBLIC_FRONTEND_URL || '*', // Update in production
//     methods: ['GET', 'POST'],
//     credentials: true,
//   },
// });

// -----------------------------------------------------------------------------
// Core Engine Functions
// -----------------------------------------------------------------------------

const checkReconnection = async (tableId: string, userId: string, serverIo: SocketIOServer) => {
  const pokerTable = await PokerDesk.findById(tableId) as unknown as IPokerTableDoc;
  if (!pokerTable) return;

  const isAlreadySeated = await pokerTable.isUserSeated(userId);
  if (isAlreadySeated) {
    await pokerTable.updateSeatStatus(userId, 'active');
    await sendSeatData(serverIo, tableId);
  }
};

const addSocket = async (userId: string, tableId: string, socketId: string, serverIo: SocketIOServer) => {
  if (!userId || !tableId) throw new Error('User ID and Table ID are required to add socket');
  
  if (!socketRegistry[tableId]) socketRegistry[tableId] = {};
  if (!socketRegistry[tableId][userId]) socketRegistry[tableId][userId] = [];
  
  if (!socketRegistry[tableId][userId].includes(socketId)) {
    socketRegistry[tableId][userId].push(socketId);
    await checkReconnection(tableId, userId, serverIo);
  }
};

const updateSeatStatus = async (userId: string, tableId: string, status: string, serverIo: SocketIOServer) => {
  try {
    const desk = await PokerDesk.findById(tableId) as unknown as IPokerTableDoc;
    if (!desk) {
      console.error(`Desk not found for tableId ${tableId}`);
      return;
    }
    
    await desk.updateSeatStatus(userId, status);
    console.log(`User ${userId} status updated to ${status} at table ${tableId}`);
    await sendSeatData(serverIo, tableId);
  } catch (error: any) {
    console.error(`Failed to update seat status: ${error.message}`);
  }
};

const removeSocket = (socketId: string, serverIo: SocketIOServer) => {
  for (const tableId in socketRegistry) {
    for (const userId in socketRegistry[tableId]) {
      const socketList = socketRegistry[tableId][userId];
      const index = socketList.indexOf(socketId);
      
      if (index !== -1) {
        socketList.splice(index, 1);

        if (socketList.length === 0) {
          updateSeatStatus(userId, tableId, 'disconnected', serverIo);
          delete socketRegistry[tableId][userId];
        }

        if (Object.keys(socketRegistry[tableId]).length === 0) {
          delete socketRegistry[tableId];
        }
        return; 
      }
    }
  }
};

// -----------------------------------------------------------------------------
// Data Emitters
// -----------------------------------------------------------------------------

const sendSeatData = async (serverIo: SocketIOServer, tableId: string) => {
  try {
    const pokerTable = await PokerDesk.findById(tableId).populate('seats.userId', 'username') as any;
    if (!pokerTable) throw new Error('Poker table not found');

    const formattedSeats = pokerTable.seats
      .map((seat: any) => {
        if (seat.userId) {
          return {
            userId: seat.userId._id.toString(),
            username: seat.userId.username,
            seatNumber: seat.seatNumber,
            buyInAmount: seat.buyInAmount,
            balanceAtTable: seat.balanceAtTable,
            status: seat.status || 'active',
          };
        }
        return null;
      })
      .filter((seat: any) => seat !== null);

    serverIo.to(`table-${tableId}`).emit('seatData', formattedSeats);

    // Auto-start game logic
    if (!pokerTable.currentGame || pokerTable.currentGame.status !== 'in-progress') {
      if (pokerTable.seats.length <= pokerTable.minPlayerCount) {
        await (pokerTable as IPokerTableDoc).createGameFromTable(tableId);
        await sendGameDataAfterCreation(serverIo, tableId);
      }
    }
  } catch (error: any) {
    console.error(`Error sending seat data: ${error.message}`);
  }
};

const sendSeatDataAfterGame = async (serverIo: SocketIOServer, tableId: string) => {
  const pokerTable = await PokerDesk.findById(tableId).populate('seats.userId', 'username') as any;

  if (!pokerTable.currentGame || pokerTable.currentGame.status !== 'in-progress') {
    setTimeout(async () => {
      if (pokerTable.seats.length <= pokerTable.minPlayerCount) {
        try {
          await (pokerTable as IPokerTableDoc).createGameFromTable(tableId);
          await sendGame(serverIo, tableId);
        } catch (error) {
          console.error('Error creating game:', error);
        }
      }
    }, 5000);
  }
  await sendSeatData(serverIo, tableId);
};

const sendResultData = async (serverIo: SocketIOServer, tableId: string) => {
  try {
    const pokerTable = await PokerDesk.findById(tableId) as any;
    if (!pokerTable || !pokerTable.currentGame) throw new Error('No active game');
    serverIo.to(`table-${tableId}`).emit('resultData', pokerTable.currentGame.pots);
  } catch (error: any) {
    console.error(`Error sending result data: ${error.message}`);
  }
};

const sendGameData = async (serverIo: SocketIOServer, tableId: string) => {
  try {
    const pokerTable = await PokerDesk.findById(tableId) as any;
    if (!pokerTable || !pokerTable.currentGame) throw new Error('No active game');

    const pokerGame = pokerTable.currentGame;
    const gameData = {
      currentTurnPlayer: pokerGame.currentTurnPlayer || null,
      totalBet: pokerGame.totalBet,
      status: pokerGame.status,
      communityCards: pokerGame.communityCards || [],
      latestRound: pokerGame.rounds[pokerGame.rounds.length - 1],
      players: pokerGame.players,
    };
     
    serverIo.to(`table-${tableId}`).emit('gameData', gameData); 
    if (pokerGame.status === 'finished') {
      await sendSeatData(serverIo, tableId);
      await sendResultData(serverIo, tableId);
    }
  } catch (error: any) {
    console.error(`Error sending game data: ${error.message}`);
  }
};

const sendGameDataAfterCreation = async (serverIo: SocketIOServer, tableId: string) => {
  try {
    const pokerTable = await PokerDesk.findById(tableId) as any;
    if (!pokerTable || !pokerTable.currentGame) throw new Error('No active game');

    const pokerGame = pokerTable.currentGame;
    const gameData = {
      currentTurnPlayer: pokerGame.currentTurnPlayer || null,
      totalBet: pokerGame.totalBet,
      status: pokerGame.status,
      communityCards: pokerGame.communityCards || [],
      latestRound: pokerGame.rounds[pokerGame.rounds.length - 1],
      players: pokerGame.players,
    };
     
    serverIo.to(`table-${tableId}`).emit('gameData', gameData); 

    const nextPlayerId = pokerGame.currentTurnPlayer;
    if (nextPlayerId) {
      activeTimers[tableId] = setTimeout(async () => {
        console.log(`Auto-folding for player ${nextPlayerId}`);
        await handlePlayerActionAndSendGame(serverIo, tableId, nextPlayerId, 'fold', 0);
      }, 30000); 
    }

    if (pokerGame.status === 'finished') {
      await sendSeatData(serverIo, tableId);
      await sendResultData(serverIo, tableId);
    }
  } catch (error: any) {
    console.error(`Error sending game data: ${error.message}`);
  }
};

const sendGame = async (serverIo: SocketIOServer, tableId: string) => {
  try {
    const pokerTable = await PokerDesk.findById(tableId) as any;
    if (!pokerTable || !pokerTable.currentGame) throw new Error('No active game');
    serverIo.to(`table-${tableId}`).emit('wGameData', pokerTable.currentGame); 
  } catch (error: any) {
    console.error(`Error sending game data: ${error.message}`);
  }
};

// -----------------------------------------------------------------------------
// Action Handlers
// -----------------------------------------------------------------------------

async function handlePlayerActionAndSendGame(serverIo: SocketIOServer, tableId: string, userId: string, action: string, amount: number) {
  try {
    const pokerTable = await PokerDesk.findById(tableId) as unknown as IPokerTableDoc;
    if (!pokerTable) throw new Error('Table not found.');

    const pokerGame = pokerTable.currentGame;
    if (!pokerGame) throw new Error('Game not found.');

    if (userId) {
      if (pokerGame.currentTurnPlayer.toString() !== userId.toString()) {
        throw new Error("It's not your turn.");
      }

      await pokerTable.handlePlayerAction(userId, action, amount);

      if (activeTimers[tableId]) {
        clearTimeout(activeTimers[tableId]);
        delete activeTimers[tableId];
      }
    }
    
    const pokerTableSend = await PokerDesk.findById(tableId) as any;
    if (!pokerTableSend || !pokerTableSend.currentGame) throw new Error('No active game');

    const pokerGameSend = pokerTableSend.currentGame;
    const gameData = {
      currentTurnPlayer: pokerGameSend.currentTurnPlayer || null,
      totalBet: pokerGameSend.totalBet,
      status: pokerGameSend.status,
      communityCards: pokerGameSend.communityCards || [],
      latestRound: pokerGameSend.rounds[pokerGameSend.rounds.length - 1],
      players: pokerGameSend.players,
    };
     
    serverIo.to(`table-${tableId}`).emit('gameData', gameData); 

    if (pokerGameSend.status === 'finished') {
      if (activeTimers[tableId]) {
        clearTimeout(activeTimers[tableId]);
        delete activeTimers[tableId];
      }
      await sendResultData(serverIo, tableId);
      await sendSeatDataAfterGame(serverIo, tableId);
    } else {
      const nextPlayerId = pokerGameSend.currentTurnPlayer;
      if (nextPlayerId) {
        activeTimers[tableId] = setTimeout(async () => {
          console.log(`Auto-folding for player ${nextPlayerId}`);
          await handlePlayerActionAndSendGame(serverIo, tableId, nextPlayerId, 'fold', 0);
        }, 30000);
      }
    }
  } catch (error: any) {
    console.error(`Error in handlePlayerAction: ${error.message}`);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Socket Connection Listener
// -----------------------------------------------------------------------------

io.on('connection', (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);

  let currentUserId: string | null = null;
  let currentTableId: string | null = null;

  socket.on('register', ({ token, tableId }) => {
    try {
      if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing');
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as TokenPayload;
      currentUserId = decoded.userId;
      
      addSocket(currentUserId, tableId, socket.id, io);
      socket.emit('registrationSuccess', { message: 'User registered successfully' });
    } catch (error: any) {
      console.error('User registration error:', error.message);
      socket.emit('error', { message: 'Invalid token' });
    }
  });

  socket.on('joinTable', async ({ token, tableId }) => {
    try {
      if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing');
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as TokenPayload;
      const userId = decoded.userId;
      currentTableId = tableId;

      socket.join(`table-${tableId}`); 
      addSocket(userId, tableId, socket.id, io);

      const pokerTable = await PokerDesk.findById(tableId);
      if (!pokerTable) throw new Error('Poker table not found');

      await sendGame(io, tableId);
    } catch (error: any) {
      console.error(`Error joining table: ${error.message}`);
      socket.emit('error', { message: 'Error joining table' });
    }
  });

  socket.on('playerAction', async ({ tableId, action, amount, userId }) => {
    await handlePlayerActionAndSendGame(io, tableId, userId, action, amount);
  });

  socket.on('sitAtTable', async ({ token, tableId, buyInAmount }) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
      const userId = decoded.userId; 
      const pokerTable = await PokerDesk.findById(tableId) as unknown as IPokerTableDoc; 

      if (!pokerTable) throw new Error('Poker table not found'); 

      const isAlreadySeated = await pokerTable.isUserSeated(userId);
      if (isAlreadySeated) {
        socket.emit('error', { message: 'User already seated at this table' });
        return;
      }

      await pokerTable.addUserToSeat(userId, buyInAmount); 
      await sendSeatData(io, tableId);
    } catch (error: any) {
      socket.emit('error', { message: 'Error sitting at table' });
    }
  });

  socket.on('addBalance', async ({ token, tableId, buyInAmount }) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
      const userId = decoded.userId; 
      const pokerTable = await PokerDesk.findById(tableId) as unknown as IPokerTableDoc; 

      if (!pokerTable) throw new Error('Poker table not found'); 

      const isAlreadySeated = await pokerTable.isUserSeated(userId);
      if (!isAlreadySeated) {
        socket.emit('error', { message: 'Player not seated on this table' });
        return;
      }

      await pokerTable.addWalletBalance(userId, buyInAmount); 
      await sendSeatData(io, tableId);
    } catch (error: any) {
      socket.emit('error', { message: 'Error adding balance' });
    }
  });

  socket.on('leaveSeat', async ({ token, tableId }) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
      updateSeatStatus(decoded.userId, tableId, 'disconnected', io);
      await sendSeatData(io, tableId);
    } catch (error: any) {
      socket.emit('error', { message: 'Error leaving seat' });
    }
  });

  socket.on('createGame', async ({ token, tableId }) => {
    try {
      jwt.verify(token, process.env.JWT_SECRET as string);
      const pokerTable = await PokerDesk.findById(tableId) as unknown as IPokerTableDoc;
      if (!pokerTable) throw new Error('Poker table not found');
  
      await pokerTable.createGameFromTable(tableId);  
      await sendGameData(io, tableId);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('disconnect', async () => {
    console.log(`Client disconnected: ${socket.id}`);
    removeSocket(socket.id, io);
    if (currentTableId && currentUserId) {
      const pokerTable = await PokerDesk.findById(currentTableId) as unknown as IPokerTableDoc;
      if (pokerTable) {
        await pokerTable.removeObserver(currentUserId);
        socket.leave(`table-${currentTableId}`);
      }
    }
  });
});

// -----------------------------------------------------------------------------
// Boot Server
// -----------------------------------------------------------------------------
const PORT = process.env.SOCKET_PORT || 3001;

dbConnect().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Standalone Poker Engine running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to database on startup:', err);
});