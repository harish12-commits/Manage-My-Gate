import { Stack } from 'expo-router';
import { premiumScreenTransition } from '@/src/utils/screenTransitions';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...premiumScreenTransition }}>
      <Stack.Screen name="billing" />
      <Stack.Screen name="audit-logs" />
      <Stack.Screen name="integrations" />
      <Stack.Screen name="role-builder" />
      <Stack.Screen name="users" />
      <Stack.Screen name="invitations" />
      <Stack.Screen name="villas" />
      <Stack.Screen name="workspace-settings" />
    </Stack>
  );
}
