import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="create-group" />
      <Stack.Screen name="order-tea" />
      <Stack.Screen name="my-orders" />
      <Stack.Screen name="become-seller" />
      <Stack.Screen name="seller-dashboard" />
    </Stack>
  );
}