import { Stack } from 'expo-router';
import { premiumScreenTransition, fadeScreenTransition, instantTransition } from '@/src/utils/screenTransitions';

export default function ResidentLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, freezeOnBlur: true, ...premiumScreenTransition }}>
      <Stack.Screen name="index" options={{ ...instantTransition }} />
      <Stack.Screen name="dashboard" options={{ ...instantTransition }} />
      <Stack.Screen name="showcase" />
      <Stack.Screen name="all-features" options={{ ...instantTransition }} />
      <Stack.Screen name="admin" />
      <Stack.Screen name="amenities" />
      <Stack.Screen name="billing" />
      <Stack.Screen name="complaints" />
      <Stack.Screen name="notices" />
      <Stack.Screen name="polls/index" />
      <Stack.Screen name="polls/[id]" />
      <Stack.Screen name="community-engagement" />
      <Stack.Screen name="visitor" />
      <Stack.Screen name="profile/index" />
      <Stack.Screen name="account/index" />
      <Stack.Screen name="directory/index" />
      <Stack.Screen name="directory/conversation/[id]" options={{ ...premiumScreenTransition }} />
      <Stack.Screen name="notes/index" />
      <Stack.Screen name="settings/index" options={{ ...instantTransition }} />
      <Stack.Screen name="settings/report-issue" options={{ ...premiumScreenTransition }} />
      <Stack.Screen name="notifications" options={{ ...fadeScreenTransition }} />
    </Stack>
  );
}
