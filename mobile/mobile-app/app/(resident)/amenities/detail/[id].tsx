/**
 * Standalone Amenity Detail Route: /(resident)/amenities/detail/[id]
 * Renders the authoritative ResidentAmenityDetailView within a ScreenShell.
 * Loads facility and resources via useResidentAmenities.
 */

import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { useResidentAmenities } from '../../../../src/features/amenities/hooks/useResidentAmenities';
import { ResidentAmenityDetailView } from '../../../../src/features/amenities/components/ResidentAmenityDetailView';
import { getArchetypeMeta } from '../../../../src/features/amenities/utils/amenityPresentation';

export default function AmenityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    selectedFacility,
    resources,
    selectFacility,
    loading,
    error,
    clearError,
  } = useResidentAmenities();

  useEffect(() => {
    if (id) {
      clearError();
      selectFacility(id).catch(() => {});
    }
  }, [id, selectFacility, clearError]);

  const navigateToBooking = (facilityId: string) => {
    router.navigate({
      pathname: '/(resident)/amenities/booking/[id]' as any,
      params: { id: facilityId },
    });
  };

  const archetypeMeta = selectedFacility?.archetype
    ? getArchetypeMeta(selectedFacility.archetype)
    : null;

  return (
    <ScreenShell
      title={selectedFacility?.name || 'Amenity Details'}
      subtitle={archetypeMeta?.label || 'Facility Overview'}
      iconName={archetypeMeta?.iconName || 'Building2'}
      loading={loading && !selectedFacility}
      error={error?.message || null}
      onRetry={() => {
        if (id) {
          clearError();
          selectFacility(id);
        }
      }}
      scrollable={false}
    >
      <ResidentAmenityDetailView
        facility={selectedFacility}
        resources={resources}
        onBookClick={navigateToBooking}
        scrollable={true}
      />
    </ScreenShell>
  );
}
