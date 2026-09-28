/**
 * Amenity settings route. Access check only; the screen holds the form.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { AmenitySettingsScreen } from '@/src/features/amenities/screens/AmenitySettingsScreen';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';

export default function AmenitySettingsRoute() {
  const { user } = useAuth();

  if (user && !isFeatureAllowedForUser({ id: 'amenities_settings', permission: 'amenities:settings' }, user)) {
    return <Redirect href="/(resident)/dashboard" />;
  }

  return <AmenitySettingsScreen />;
}
