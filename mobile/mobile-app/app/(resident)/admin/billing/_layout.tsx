import { Stack } from 'expo-router';
import { premiumScreenTransition } from '@/src/utils/screenTransitions';

export default function AdminBillingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...premiumScreenTransition }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="assessments" />
      <Stack.Screen name="ledger" />
    </Stack>
  );
}
