import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import PokerDesk from "../../models/pokerDesk";
import User from "../../models/user"; // Adjust path if needed
import dbConnect from "../../config/dbConnect";
const socketRegistry = {};
const activeTimers = {}; 

// Add a socket to the registry
const addSocket = async (userId, tableId, socketId,io) => {
  if (!userId || !tableId) throw new Error("User ID and Table ID are required to add socket");
  if (!socketRegistry[tableId]) socketRegistry[tableId] = {}; // Ensure table entry exists
  if (!socketRegistry[tableId][userId]) socketRegistry[tableId][userId] = []; // Ensure user entry exists
  if (!socketRegistry[tableId][userId].includes(socketId)) {
    socketRegistry[tableId][userId].push(socketId);
    await checkReconnection(tableId,userId,io);
  }
};
// updateSeatStatus function
const updateSeatStatus = async (userId, tableId, status,io) => {
  try {
    // Find the desk by tableId
    const desk = await PokerDesk.findById(tableId);
    
    if (!desk) {
      console.error(`Desk not found for tableId ${tableId}`);
      return;
    }
    
    // Update the user's status at the desk
    await desk.updateSeatStatus(userId, status); // Assuming desk.updateStatus is a defined method

    console.log(`User ${userId} status updated to ${status} at table ${tableId}`);

    await  sendSeatData(io,tableId);
  } catch (error) {
    console.error(`Failed to update seat status for user ${userId} at table ${tableId}: ${error.message}`);
  }
};
 
const removeSocket = (socketId,io) => {
  for (const tableId in socketRegistry) {
    for (const userId in socketRegistry[tableId]) {
      const socketList = socketRegistry[tableId][userId];
      const index = socketList.indexOf(socketId);
      
      if (index !== -1) {
        socketList.splice(index, 1); // Remove the socketId

        // If no more sockets exist for this user at this table, update status
        if (socketList.length === 0) {
          updateSeatStatus(userId, tableId, 'disconnected',io); // Call your status update function
          delete socketRegistry[tableId][userId];
        }

        // If no more users on this table, remove the table from the registry
        if (Object.keys(socketRegistry[tableId]).length === 0) {
          delete socketRegistry[tableId];
        }

        return; // Exit once socket is found and removed
      }
    }
  }
};

const sendSeatData = async (io, tableId) => {
  const pokerTable = await PokerDesk.findById(tableId)
  .populate("seats.userId", "username");

  try {  
    if (!pokerTable) throw new Error("Poker table not found");

    const formattedSeats = pokerTable.seats
      .map((seat) => {
        if (seat.userId) {
          return {
            userId: seat.userId._id.toString(),
            username: seat.userId.username,
            seatNumber: seat.seatNumber,
            buyInAmount: seat.buyInAmount,
            balanceAtTable: seat.balanceAtTable,
            status: seat.status || 'active',
          };
        } else {
          return null;
        }
      })
      .filter((seat) => seat !== null);


    io.to(`table-${tableId}`).emit("seatData", formattedSeats);
    
  } catch (error) {
    console.error(`Error sending seat data: ${error.message}`);
  }

  if (
    !pokerTable.currentGame ||
    pokerTable.currentGame.status !== 'in-progress'
  ) {
    if (pokerTable.seats.length <= pokerTable.minPlayerCount) {  
      try {
        await pokerTable.createGameFromTable(tableId); // Call your createGameForTable function
       // await sendGame(io, tableId)
       await sendGameDataAfterCreation(io, tableId);
      } catch (error) {
       console.log(error);
      }
        // Update currentGame
    }
  }
};

const sendSeatDataAfterGame = async (io, tableId) => {
  const pokerTable = await PokerDesk.findById(tableId)
  .populate("seats.userId", "username");

  if (
    !pokerTable.currentGame ||
    pokerTable.currentGame.status !== 'in-progress'
  ) {
  setTimeout(async () => {
      if (pokerTable.seats.length <= pokerTable.minPlayerCount) {  
        try {
          await pokerTable.createGameFromTable(tableId); // Call your createGameForTable function
          await sendGame(io, tableId);
        } catch (error) {
          console.error('Error creating game:', error);
        }
        // Update currentGame
      }
    
  }, 5000); // 5 seconds
 } 
 
 await sendSeatData(io, tableId);
};

const sendResultData = async (io, tableId) => {
  try {
    const pokerTable = await PokerDesk.findById(tableId);

    if (!pokerTable || !pokerTable.currentGame) throw new Error("No active game for this table");

    const resultData = pokerTable.currentGame.pots;

    io.to(`table-${tableId}`).emit("resultData", resultData);
 
  } catch (error) {
    console.error(`Error sending result data: ${error.message}`);
  }
};
 
const sendGameData = async (io, tableId) => {
  try {
    const pokerTable = await PokerDesk.findById(tableId);

    if (!pokerTable || !pokerTable.currentGame) throw new Error("No active game for this table");

    const pokerGame = pokerTable.currentGame;

    const gameData = {
      currentTurnPlayer: pokerGame.currentTurnPlayer || null,
      totalBet: pokerGame.totalBet,
      status: pokerGame.status,
      communityCards: pokerGame.communityCards || [],
      latestRound: pokerGame.rounds[pokerGame.rounds.length - 1],
      players : pokerGame.players,
    };
     
   
    io.to(`table-${tableId}`).emit("gameData", gameData); 
    if(pokerGame.status === 'finished'){
      await sendSeatData(io,tableId);
      await sendResultData(io,tableId);
    };
  } catch (error) {
    console.error(`Error sending game data: ${error.message}`);
  }
};

const sendGameDataAfterCreation = async (io, tableId) => {
  try {
    const pokerTable = await PokerDesk.findById(tableId);

    if (!pokerTable || !pokerTable.currentGame) throw new Error("No active game for this table");

    const pokerGame = pokerTable.currentGame;

    const gameData = {
      currentTurnPlayer: pokerGame.currentTurnPlayer || null,
      totalBet: pokerGame.totalBet,
      status: pokerGame.status,
      communityCards: pokerGame.communityCards || [],
      latestRound: pokerGame.rounds[pokerGame.rounds.length - 1],
      players : pokerGame.players,
    };
     
   
    io.to(`table-${tableId}`).emit("gameData", gameData); 

    const nextPlayerId = pokerGame.currentTurnPlayer;
    if (nextPlayerId) {
      activeTimers[tableId] = setTimeout(async () => {
        console.log(`Auto-folding for player ${nextPlayerId}`);
        await handlePlayerActionAndSendGame(io, tableId, nextPlayerId, 'fold', 0);
      }, 30000); // 30 seconds timer
    }

    if(pokerGame.status === 'finished'){
      await sendSeatData(io,tableId);
      await sendResultData(io,tableId);
    };
  } catch (error) {
    console.error(`Error sending game data: ${error.message}`);
  }
};

const sendGame = async (io, tableId) => {
  try {
    const pokerTable = await PokerDesk.findById(tableId);

    if (!pokerTable || !pokerTable.currentGame) throw new Error("No active game for this table");

    const pokerGame = pokerTable.currentGame;
    
    io.to(`table-${tableId}`).emit("wGameData", pokerGame); 
  } catch (error) {
    console.error(`Error sending game data: ${error.message}`);
  }
};

const checkReconnection = async (tableId, userId, io) => {
  
  const pokerTable = await PokerDesk.findById(tableId);

  const isAlreadySeated = await pokerTable.isUserSeated(userId);
  if (isAlreadySeated) {
    await pokerTable.updateSeatStatus(userId,"active");
    await sendSeatData(io,tableId);
  }

}

// Encapsulated function to handle player action
async function handlePlayerActionAndSendGame(io, tableId, userId, action, amount) {
  try {
    // Fetch the table and current game in one step
    const pokerTable = await PokerDesk.findById(tableId);
    if (!pokerTable) throw new Error('Table not found.');

    const pokerGame = pokerTable.currentGame;
    if (!pokerGame) throw new Error('Game not found.');

    // If userId is provided, validate and process the action
    if (userId) {
      // Check if it's the player's turn
      if (!pokerGame.currentTurnPlayer.equals(userId)) {
        throw new Error("It's not your turn.");
      }

      // Handle the player action
      await pokerTable.handlePlayerAction(userId, action, amount);

      // Clear any existing timer for this table
      if (activeTimers[tableId]) {
        clearTimeout(activeTimers[tableId]);
        delete activeTimers[tableId];
      }
    }
    
    const pokerTableSend = await PokerDesk.findById(tableId);

    try {
      if (!pokerTableSend || !pokerTableSend.currentGame) throw new Error("No active game for this table");
  
      const pokerGameSend = pokerTableSend.currentGame;
  
      const gameData = {
        currentTurnPlayer: pokerGameSend.currentTurnPlayer || null,
        totalBet: pokerGameSend.totalBet,
        status: pokerGameSend.status,
        communityCards: pokerGameSend.communityCards || [],
        latestRound: pokerGameSend.rounds[pokerGameSend.rounds.length - 1],
        players : pokerGameSend.players,
      };
       
     
      io.to(`table-${tableId}`).emit("gameData", gameData); 

     if(pokerGameSend.status === 'finished'){
        if (activeTimers[tableId]) {
          clearTimeout(activeTimers[tableId]);
          delete activeTimers[tableId];
        }
       
        await sendResultData(io,tableId);
        await sendSeatDataAfterGame(io,tableId);
      }else{
        const nextPlayerId = pokerGameSend.currentTurnPlayer;
        if (nextPlayerId) {
          activeTimers[tableId] = setTimeout(async () => {
            console.log(`Auto-folding for player ${nextPlayerId}`);
            await handlePlayerActionAndSendGame(io, tableId, nextPlayerId, 'fold', 0);
          }, 30000); // 30 seconds timer
        }
      }
    } catch (error) {
      console.error(`Error sending game data: ${error.message}`);
    }

  } catch (error) {
    console.error(`Error in handlePlayerActionAndSendGame: ${error.message}`);
    throw error;
  }
}

export default function handler(req, res) {
  if (!res.socket.server.io) { 
     dbConnect();
     
    // origin: ["http://localhost:8081"],
    const io = new Server(res.socket.server, {
      path: "/api/socket",
      cors: {
        origin: "*", // Allowed origins
        methods: ["GET", "POST"],
        credentials: true,
        
     },
    });

    res.socket.server.io = io;

    io.on("connection", (socket) => {
      console.log(`Client connected: ${socket.id}`);

      let currentUserId = null;
      let currentTableId = null;
      let currentGameId = null;
      

      socket.on("register", ({ token, tableId }) => {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const currentUserId = decoded.userId; // Avoid global variables for each socket instance
          // Add the socket to the registry with userId, tableId, and socket.id
          addSocket(currentUserId, tableId, socket.id,io);
          // Emit an event confirming registration success (optional)
          socket.emit("registrationSuccess", { message: "User registered successfully" });
          // Optionally check and update seat status if reconnecting
          //handleReconnection(currentUserId, tableId, socket.id);
        } catch (error) {
          console.error("User registration error:", error.message);
          socket.emit("error", { message: "Invalid token" });
        }
      });
      

      // Join a table
      socket.on("joinTable", async ({ token, tableId }) => {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const userId = decoded.userId;
          currentTableId = tableId;

          socket.join(`table-${tableId}`); 

          addSocket(userId, tableId, socket.id,io);
           
          // Emit an event confirming registration success (optional)
         // socket.emit("registrationSuccess", { message: "User registered successfully" });

          const pokerTable = await PokerDesk.findById(tableId);
          if (!pokerTable) throw new Error("Poker table not found");

        await sendGame(io, tableId);
        } catch (error) {
          console.error(`Error joining table: ${error.message}`);
          socket.emit("error", { message: "Error joining table" });
        }
      });

       
      socket.on('playerAction', async ({ tableId, action, amount, userId }) => {
        // try {
          
        //   if (!userId) {
        //     throw new Error('User not registered or not in a table.');
        //   }

        //   const pokerTable = await PokerDesk.findById(tableId);
        //   if (!pokerTable) throw new Error('Table not found.');

        //   const pokerGame = pokerTable.currentGame;
        //   if (!pokerGame) throw new Error('Game not found.');

        //   // Check if it's the player's turn
        //   if (!pokerGame.currentTurnPlayer.equals(userId)) {
        //     throw new Error("It's not your turn.");
        //   }
        //   // Handle the player action
        //   await pokerTable.handlePlayerAction(userId, action, amount);

        // //  await updateGameForRoom(io, tableId);
        // await sendGameData(io, tableId);
        // } catch (error) {
        //   console.error(`Error handling player action: ${error.message}`);
        //   socket.emit('error', { message: error.message });
        // }
        handlePlayerActionAndSendGame(io, tableId, userId, action, amount);
      });

      socket.on("sitAtTable", async ({ token, tableId, buyInAmount }) => {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const userId = decoded.userId; 

          const pokerTable = await PokerDesk.findById(tableId); 

          if (!pokerTable) throw new Error("Poker table not found"); 

          const isAlreadySeated = await pokerTable.isUserSeated(userId);
          if (isAlreadySeated) {
            socket.emit("error", {
              message: "User already seated at this table",
            });
            return;
          }

          // Add user to seat with only userId and username
          await pokerTable.addUserToSeat(userId, buyInAmount); 

          await sendSeatData(io, tableId);
           
        } catch (error) {
          console.error(`Error sitting at table: ${error.message}`);

          socket.emit("error", { message: "Error sitting at table" });
        }
      });

      socket.on("addBalance", async ({ token, tableId, buyInAmount }) => {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const userId = decoded.userId; 

          const pokerTable = await PokerDesk.findById(tableId); 

          if (!pokerTable) throw new Error("Poker table not found"); 

          const isAlreadySeated = await pokerTable.isUserSeated(userId);
          if (!isAlreadySeated) {
            socket.emit("error", {
              message: "player not seated on this table",
            });
            return;
          }

          // Add user to seat with only userId and username
          await pokerTable.addWalletBalance(userId, buyInAmount); 

          await sendSeatData(io, tableId);
           
        } catch (error) {
          console.error(`Error sitting at table: ${error.message}`);

          socket.emit("error", { message: "Error sitting at table" });
        }
      });

      // Leave a seat
      socket.on("leaveSeat", async ({ token, tableId }) => {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const userId = decoded.userId;

          const pokerTable = await PokerDesk.findById(tableId);
          if (!pokerTable) throw new Error("Poker table not found");
          updateSeatStatus(userId, tableId, 'disconnected',io);
         
        await sendSeatData(io, tableId);
        } catch (error) {
          console.error(`Error leaving seat: ${error.message}`);
          socket.emit("error", { message: "Error leaving seat" });
        }
      });

      socket.on('createGame', async ({ token, tableId }) => {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const currentUserId = decoded.userId;
      
          const pokerTable = await PokerDesk.findById(tableId);
          if (!pokerTable) throw new Error('Poker table not found');
      
          // Check if a game can be created
          await pokerTable.createGameFromTable();  // Ensure this call is on a valid instance
          await sendGameData(io, tableId);
         // await updateGameForRoom(io, tableId);
        } catch (error) {
          console.error(`Error creating game: ${error.message}`);
          socket.emit('error', { message: error.message });
        }
      });
      

      // Handle user disconnection
      socket.on("disconnect", async () => {
        console.log(`Client disconnected: ${socket.id}`);
        removeSocket(socket.id,io);
        if (currentTableId && currentUserId) {
          const pokerTable = await PokerDesk.findById(currentTableId);
          if (pokerTable) {
            await pokerTable.removeObserver(currentUserId);
          //  await updateTableForRoom(io, currentTableId);
          
            socket.leave(`table-${currentTableId}`);
            console.log(
              `User ${currentUserId} left table room ${currentTableId}`
            );
          }
        }
      });
    });
  }

  res.end();
}

