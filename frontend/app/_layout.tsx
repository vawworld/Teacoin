import { Slot } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { SocketProvider } from '../contexts/SocketContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Slot />
      </SocketProvider>
    </AuthProvider>
  );
}