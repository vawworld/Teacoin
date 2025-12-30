import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { SocketProvider } from '../contexts/SocketContext';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="create-group" />
    </Stack>
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