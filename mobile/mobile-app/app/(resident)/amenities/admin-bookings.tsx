/**
 * Staff booking queue route. Access check only; the screen holds the queue.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { AdminBookingQueueScreen } from '@/src/features/amenities/screens/AdminBookingQueueScreen';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';

export default function AdminBookingQueueRoute() {
  const { user } = useAuth();
  const allowed = isFeatureAllowedForUser({ id: 'amenities_admin_bookings', permission: 'amenities:admin_calander' }, user);
  if (user && !allowed) return <Redirect href="/(resident)/dashboard" />;
  return <AdminBookingQueueScreen />;
}
