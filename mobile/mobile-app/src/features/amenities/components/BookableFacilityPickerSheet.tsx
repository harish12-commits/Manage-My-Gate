/**
 * Staff choose which published facility to book for a resident.
 */

import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ListCard } from '@/components/ui/ListCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityFacility } from '../types/amenityDomain.types';
import { AppLoader } from '@/components/ui/AppLoader';

export interface BookableFacilityPickerSheetProps {
  visible: boolean;
  residentName?: string | null;
  facilities: AmenityFacility[];
  loading?: boolean;
  onClose: () => void;
  onSelect: (facility: AmenityFacility) => void;
}

export function BookableFacilityPickerSheet({
  visible,
  residentName,
  facilities,
  loading = false,
  onClose,
  onSelect,
}: BookableFacilityPickerSheetProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('amenity_staff_pick_facility', 'Choose a facility')}>
      <View testID="facility-picker-sheet" className="gap-3 pb-4">
        {residentName ? (
          <Text variant="muted" className="text-xs">
            {t('amenity_booking_staff_for', 'Booking for {name}', { name: residentName })}
          </Text>
        ) : null}
        {loading && facilities.length === 0 ? <AppLoader variant="inline" /> : null}
        <View className="gap-2 pb-2">
          {facilities.map((f) => (
            <ListCard
              key={f._id}
              testID={`facility-option-${f._id}`}
              title={f.name}
              subtitle={[f.category, f.location].filter(Boolean).join(' · ')}
              leftIcon="Building2"
              showChevron
              onPress={() => onSelect(f)}
            />
          ))}
          {!loading && facilities.length === 0 ? (
            <EmptyState
              title={t('amenity_staff_no_facilities', 'No facilities to book')}
              description={t('amenity_staff_no_facilities_sub', 'Publish a facility in the amenity catalog first.')}
            />
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

export default BookableFacilityPickerSheet;
