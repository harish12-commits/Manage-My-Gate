import { Stack } from 'expo-router';
import { premiumScreenTransition } from '@/src/utils/screenTransitions';

export default function ComplaintsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...premiumScreenTransition }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="my-tickets" />
      <Stack.Screen name="raise-ticket" />
      <Stack.Screen name="manage" />
      <Stack.Screen name="assignee" />
      <Stack.Screen name="staff" />
      <Stack.Screen name="issue-reports" />
    </Stack>
  );
}
