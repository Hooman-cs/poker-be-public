import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const useSocket = (username) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!username) {
      console.error('Username is required to initialize socket.');
      return;
    }

    // Initialize socket connection
    const socketIo = io('', {
      path: '/api/socket',
    });


    // Register with username when connected
    socketIo.on('connect', () => {
      console.log(`Connected: ${socketIo.id}`);
      socketIo.emit('register', { username });
    });

    // Handle disconnection
    socketIo.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Set socket instance
    setSocket(socketIo);

    // Cleanup when component unmounts
    return () => {
      if (socketIo) {
        socketIo.disconnect();
        console.log('Socket disconnected on unmount');
      }
    };
  }, [username]);

  return socket;
};

export default useSocket;
