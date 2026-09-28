/**
 * Amenity Management Phase 6B.2 - Route: Resident Facility Booking Wizard
 * Thin route wrapper that retrieves authoritative facility data by route ID,
 * guards against non-ACTIVE facilities, and delegates orchestration to AmenityBookingWizard.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AmenityFacility } from '../../../../src/features/amenities/types/amenityDomain.types';
import amenityManagementService from '../../../../src/features/amenities/services/amenityManagementService';
import { normalizeFacilityFromApi } from '../../../../src/features/amenities/utils/amenityPayloadMappers';
import { AmenityBookingWizard } from '../../../../src/features/amenities/components/wizard/AmenityBookingWizard';
import { AlertTriangle, ArrowLeft } from 'lucide-react-native';

export default function AmenityBookingRoute() {
  // `date` (YYYY-MM-DD) pre-selects a day, e.g. when arriving from the calendar.
  // `residentId`/`residentName` are set when amenity staff book for a resident.
  const { id, date, residentId, residentName } = useLocalSearchParams<{
    id: string;
    date?: string;
    residentId?: string;
    residentName?: string;
  }>();
  const onBehalfOf = useMemo(
    () => (residentId ? { residentId, residentName: residentName || '' } : null),
    [residentId, residentName]
  );
  const router = useRouter();

  const [facility, setFacility] = useState<AmenityFacility | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!id) {
      setError('Facility ID is missing from navigation context.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    amenityManagementService
      .getFacilityById(id)
      .then((response) => {
        if (!isMounted) return;
        const rawData = (response?.data || response) as any;
        if (rawData && (rawData._id || rawData.id)) {
          const facilityData = normalizeFacilityFromApi(rawData);
          setFacility(facilityData);
        } else {
          setError('Facility record could not be found.');
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setError(err?.message || 'Failed to load facility details.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Loading State
  if (loading) {
    return (
      <ScreenShell title="Reserve Facility" subtitle="Loading facility..." loading>
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" className="text-primary" />
          <Text variant="muted" className="text-sm mt-3">Fetching facility details...</Text>
        </View>
      </ScreenShell>
    );
  }

  // Error State / Not Found
  if (error || !facility) {
    return (
      <ScreenShell title="Reserve Facility" subtitle="Facility unavailable" error={error}>
        <View className="flex-1 items-center justify-center p-6 gap-3">
          <AlertTriangle size={36} className="text-destructive" />
          <Text className="font-bold text-base text-foreground text-center">
            Unable to Open Booking Wizard
          </Text>
          <Text variant="muted" className="text-xs text-center text-muted-foreground max-w-xs">
            {error || 'The requested facility does not exist or could not be loaded.'}
          </Text>
          <Button
            variant="outline"
            onPress={() => router.back()}
            className="mt-2 h-11 px-4 rounded-xl flex-row items-center gap-1.5"
          >
            <ArrowLeft size={16} className="text-foreground" />
            <Text className="font-semibold text-foreground">Return to Catalog</Text>
          </Button>
        </View>
      </ScreenShell>
    );
  }

  // Non-ACTIVE Facility Guard
  if (facility.status !== 'ACTIVE') {
    return (
      <ScreenShell title={facility.name} subtitle="Booking unavailable">
        <View className="flex-1 items-center justify-center p-6 gap-4">
          <View className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 items-center w-full max-w-sm gap-2">
            <AlertTriangle size={32} className="text-amber-600 dark:text-amber-400" />
            <Text className="font-bold text-sm text-amber-800 dark:text-amber-200 text-center">
              Facility Not Open for Reservations
            </Text>
            <Text className="text-xs text-amber-700 dark:text-amber-300 text-center leading-relaxed">
              This facility is currently {facility.status.toLowerCase()}. Reservations are only allowed when the facility is in ACTIVE status.
            </Text>
            <StatusBadge
              label={facility.status}
              variant={facility.status === 'MAINTENANCE' ? 'warning' : 'neutral'}
            />
          </View>

          <Button
            variant="outline"
            onPress={() => router.back()}
            className="h-11 px-4 rounded-xl flex-row items-center gap-1.5"
          >
            <ArrowLeft size={16} className="text-foreground" />
            <Text className="font-semibold text-foreground">Back to Amenities</Text>
          </Button>
        </View>
      </ScreenShell>
    );
  }

  // ACTIVE Facility: Delegate to AmenityBookingWizard
  return (
    <AmenityBookingWizard
      facility={facility}
      onBehalfOf={onBehalfOf}
      initialDate={typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined}
      onClose={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(resident)');
        }
      }}
    />
  );
}
