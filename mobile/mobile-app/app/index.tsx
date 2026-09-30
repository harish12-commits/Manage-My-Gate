import React from 'react';
import { AppLoader } from '@/components/ui/AppLoader';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/features/auth/hooks/useAuth';

export default function IndexScreen() {
  const { isAuthenticated, isInitialized, user } = useAuth();

  // Show a neutral themed loading spinner until auth state bootstrapping finishes
  if (!isInitialized) {
    return (
      <AppLoader variant="fullscreen" />
    );
  }

  // If already authenticated, redirect to workspace or dashboard
  if (isAuthenticated) {
    const u = user as any;
    const hasOrg = !!(
      u && (
        u.orgId ||
        u.activeOrgId ||
        u.organizationId ||
        (Array.isArray(u.availableWorkspaces) && u.availableWorkspaces.length > 0)
      )
    );

    if (!hasOrg) {
      return <Redirect href="/(auth)/setup-organization" />;
    }
    return <Redirect href="/(resident)" />;
  }

  // Unauthenticated users land directly on the Nahom Login screen
  return <Redirect href="/(auth)/login" />;
}

