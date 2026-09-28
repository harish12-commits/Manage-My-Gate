/**
 * Amenity gate scanner route. Access check only; the console holds all scanner state.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { AmenityGateConsole } from '@/src/features/amenities/components/AmenityGateConsole';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';

export default function AmenitySecurityGateScannerScreen() {
  const { user } = useAuth();

  const hasScannerAccess =
    isFeatureAllowedForUser({ id: 'amenities_scanner', permission: 'amenities:scanner' }, user) ||
    isFeatureAllowedForUser({ id: 'amenities_dashboard', permission: 'amenities:dashboard' }, user) ||
    isFeatureAllowedForUser({ id: 'amenities_master', permission: 'amenities:amenities' }, user);

  if (user && !hasScannerAccess) {
    if (isFeatureAllowedForUser({ id: 'amenities_discover', permission: 'amenities:discover' }, user)) {
      return <Redirect href="/(resident)/amenities/discover" />;
    }
    return <Redirect href="/(resident)/dashboard" />;
  }

  return <AmenityGateConsole />;
}
