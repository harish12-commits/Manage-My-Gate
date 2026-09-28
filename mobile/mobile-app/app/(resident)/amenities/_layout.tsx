import { Stack } from 'expo-router';
import { useAmenitySocket } from '../../../src/features/amenities/hooks/useAmenitySocket';

export default function AmenitiesLayout() {
  useAmenitySocket(); // Initialize real-time updates for amenities

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="discover" />
      <Stack.Screen name="detail/[id]" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="booking/[id]" />
      <Stack.Screen name="admin-bookings" />
      <Stack.Screen name="admin-calendar" />
      <Stack.Screen name="admin-master" />
      <Stack.Screen name="ledgers" />
      <Stack.Screen name="maintenance" />
      <Stack.Screen name="my-bookings" />
      <Stack.Screen name="scanner" />
      <Stack.Screen name="security-logs" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="wallet" />
    </Stack>
  );
}
