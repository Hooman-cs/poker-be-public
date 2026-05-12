/**
 * @fileoverview Custom React Hook for initializing and managing Socket.io connections.
 */

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Define the environment variable or fallback to the new standalone port
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export default function useSocket(username?: string, token?: string): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Both are highly recommended, but token is required for registration
    if (!username && !token) {
      console.warn('Username or Token is recommended to initialize socket.');
      return;
    }

    // Initialize socket connection to the standalone server
    const socketIo = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // Prefer websocket for speed
      reconnectionAttempts: 5,
    });

    socketIo.on('connect', () => {
      console.log(`Connected to Game Engine: ${socketIo.id}`);
      
      // If we have a token, we can auto-register. 
      // (Requires tableId as per your backend logic, usually passed later via joinTable)
      if (username) {
        socketIo.emit('register', { username, token });
      }
    });

    socketIo.on('disconnect', (reason) => {
      console.warn(`Disconnected from server. Reason: ${reason}`);
    });

    setSocket(socketIo);

    // Cleanup memory and disconnect on unmount
    return () => {
      if (socketIo) {
        socketIo.disconnect();
        console.log('Socket disconnected on unmount');
      }
    };
  }, [username, token]);

  return socket;
}