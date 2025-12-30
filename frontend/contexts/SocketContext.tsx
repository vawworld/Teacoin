import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  sendMessage: (conversationId: string, content?: string, image?: string) => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  connectSocket: (token: string) => void;
  disconnectSocket: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    if (sessionToken) {
      const newSocket = io(BACKEND_URL!, {
        path: '/api/socket.io/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        setConnected(true);
        
        // Authenticate
        newSocket.emit('authenticate', { token: sessionToken });
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setConnected(false);
      });

      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } else if (socket) {
      socket.close();
      setSocket(null);
      setConnected(false);
    }
  }, [sessionToken]);

  const connectSocket = (token: string) => {
    setSessionToken(token);
  };

  const disconnectSocket = () => {
    setSessionToken(null);
    if (socket) {
      socket.close();
      setSocket(null);
      setConnected(false);
    }
  };

  const sendMessage = (conversationId: string, content?: string, image?: string) => {
    if (socket && connected) {
      socket.emit('send_message', {
        conversation_id: conversationId,
        content,
        image
      });
    }
  };

  const startTyping = (conversationId: string) => {
    if (socket && connected) {
      socket.emit('typing', {
        conversation_id: conversationId,
        is_typing: true
      });
    }
  };

  const stopTyping = (conversationId: string) => {
    if (socket && connected) {
      socket.emit('typing', {
        conversation_id: conversationId,
        is_typing: false
      });
    }
  };

  return (
    <SocketContext.Provider value={{ socket, connected, sendMessage, startTyping, stopTyping, connectSocket, disconnectSocket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};