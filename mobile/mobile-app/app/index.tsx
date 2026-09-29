import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/features/auth/hooks/useAuth';

export default function IndexScreen() {
  const { isAuthenticated, isInitialized, user } = useAuth();

  // Show a neutral themed loading spinner until auth state bootstrapping finishes
  if (!isInitialized) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#FF5E00" />
      </View>
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

