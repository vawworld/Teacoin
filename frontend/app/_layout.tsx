import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { SocketProvider, useSocket } from '../contexts/SocketContext';
import { useEffect } from 'react';

function SocketConnector() {
  const { sessionToken, onSocketConnect, onSocketDisconnect } = useAuth();
  const { connectSocket, disconnectSocket } = useSocket();

  useEffect(() => {
    if (onSocketConnect) {
      onSocketConnect(connectSocket);
    }
    if (onSocketDisconnect) {
      onSocketDisconnect(disconnectSocket);
    }
  }, [onSocketConnect, onSocketDisconnect, connectSocket, disconnectSocket]);

  useEffect(() => {
    if (sessionToken) {
      connectSocket(sessionToken);
    } else {
      disconnectSocket();
    }
  }, [sessionToken]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <SocketConnector />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="create-group" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SocketProvider>
        <RootLayoutNav />
      </SocketProvider>
    </AuthProvider>
  );
}