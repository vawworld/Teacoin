import { Stack } from 'expo-router';
import { AuthProvider } from '../../contexts/AuthContext';
import { SocketProvider } from '../../contexts/SocketContext';

export default function AppLayout() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SocketProvider>
    </AuthProvider>
  );
}