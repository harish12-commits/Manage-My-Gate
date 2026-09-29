import { Redirect, Stack } from 'expo-router';
import { useSelector } from 'react-redux';
import { selectAuthUser } from '@/src/features/auth/store/authSelectors';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';
import { premiumScreenTransition } from '@/src/utils/screenTransitions';

export default function VisitorAdminLayout() {
  const authUser = useSelector(selectAuthUser);
  // Every screen in this stack is a community-admin console; deep links must not bypass the role.
  const hasAdminAccess = isFeatureAllowedForUser({ id: 'visitor_admin_dashboard', permission: 'visitor:admin' }, authUser);
  if (authUser && !hasAdminAccess) {
    return <Redirect href="/(resident)/dashboard" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, ...premiumScreenTransition }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="blacklist" />
      <Stack.Screen name="community-passes" />
      <Stack.Screen name="create-pass" />
      <Stack.Screen name="walk-in-console" />
    </Stack>
  );
}
