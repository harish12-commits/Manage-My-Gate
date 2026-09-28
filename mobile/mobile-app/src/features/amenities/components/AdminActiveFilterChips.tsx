import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Chip } from '@/components/common/Chip';
import { Text } from '@/components/ui/text';
import { CalendarFilterState } from './AdminCalendarFilterDrawer';
import { useTranslation } from '@/src/utils/i18n';

export interface AdminActiveFilterChipsProps {
  filters: CalendarFilterState;
  searchQuery?: string;
  onRemoveFilter: (key: keyof CalendarFilterState | 'searchQuery', value?: string) => void;
  onClearAll: () => void;
  amenities: Array<{ _id: string; name: string }>;
  availableResources?: Array<{ _id: string; name: string }>;
}

export function AdminActiveFilterChips({
  filters,
  searchQuery,
  onRemoveFilter,
  onClearAll,
  amenities,
  availableResources = [],
}: AdminActiveFilterChipsProps) {
  const { t, hasKey } = useTranslation();
  const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];

  // Search
  if (searchQuery && searchQuery.trim()) {
    chips.push({
      id: 'search',
      label: `Search: "${searchQuery}"`,
      onRemove: () => onRemoveFilter('searchQuery'),
    });
  }

  // Facility Multi-Select Chips
  if (filters.facilityIds && filters.facilityIds.length > 0) {
    filters.facilityIds.forEach((facId) => {
      if (facId !== 'All') {
        const facility = amenities.find((a) => a._id === facId);
        chips.push({
          id: `facility-${facId}`,
          label: `Facility: ${facility ? facility.name : facId}`,
          onRemove: () => onRemoveFilter('facilityIds', facId),
        });
      }
    });
  }

  // Resource Multi-Select Chips
  if (filters.resourceIds && filters.resourceIds.length > 0) {
    filters.resourceIds.forEach((resId) => {
      if (resId !== 'All') {
        const resource = availableResources.find((r) => r._id === resId);
        chips.push({
          id: `resource-${resId}`,
          label: `Resource: ${resource ? resource.name : resId}`,
          onRemove: () => onRemoveFilter('resourceIds', resId),
        });
      }
    });
  }

  // Availability Chip
  if (filters.availability && filters.availability !== 'ALL') {
    const availLabelMap: Record<string, string> = {
      AVAILABLE: 'Available',
      PARTIALLY_AVAILABLE: 'Partially Avail',
      FULLY_BOOKED: 'Fully Booked',
      MAINTENANCE: 'Maintenance',
      BLOCKED: 'Blocked',
    };
    chips.push({
      id: 'availability',
      label: `Avail: ${availLabelMap[filters.availability] || filters.availability}`,
      onRemove: () => onRemoveFilter('availability'),
    });
  }

  // Booking Status Multi-Select Chips
  if (filters.bookingStatuses && filters.bookingStatuses.length > 0) {
    filters.bookingStatuses.forEach((status) => {
      if (status !== 'All') {
        chips.push({
          id: `status-${status}`,
          label: `Status: ${status}`,
          onRemove: () => onRemoveFilter('bookingStatuses', status),
        });
      }
    });
  }

  // Payment Status Multi-Select Chips
  if (filters.paymentStatuses && filters.paymentStatuses.length > 0) {
    filters.paymentStatuses.forEach((payment) => {
      if (payment !== 'All') {
        chips.push({
          id: `payment-${payment}`,
          label: `Payment: ${payment}`,
          onRemove: () => onRemoveFilter('paymentStatuses', payment),
        });
      }
    });
  }

  if (chips.length === 0) return null;

  return (
    <View className="py-1">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
        {chips.map((chip) => (
          <Chip
            key={chip.id}
            label={chip.label}
            onRemove={chip.onRemove}
            className="bg-primary/10 border-primary/20"
            labelClassName="text-primary font-medium text-[11px]"
          />
        ))}

        {/* Clear All Button */}
        <Pressable
          onPress={onClearAll}
          className="justify-center px-2 py-1 rounded-full bg-muted/70 active:bg-muted"
          accessibilityLabel={t('clear_all_filters', 'Clear all filters')}
        >
          <Text className="text-[11px] font-bold text-destructive">{t('clear_all', 'Clear All')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export default AdminActiveFilterChips;
