import { Stack } from 'expo-router';
import { premiumScreenTransition } from '@/src/utils/screenTransitions';

export default function NoticesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...premiumScreenTransition }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="manage" />
      <Stack.Screen name="create" />
      <Stack.Screen name="active-board" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="polls" />
    </Stack>
  );
}
