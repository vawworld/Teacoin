import { Stack } from 'expo-router';
import { AuthProvider } from '../../contexts/AuthContext';
import { SocketProvider } from '../../contexts/SocketContext';

export default function AuthLayout() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SocketProvider>
    </AuthProvider>
  );
}