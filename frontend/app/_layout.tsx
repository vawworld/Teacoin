import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { SocketProvider } from '../contexts/SocketContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="profile-setup" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="user/[id]" />
          <Stack.Screen name="create-group" />
        </Stack>
      </SocketProvider>
    </AuthProvider>
  );
}