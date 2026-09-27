import React, { useState, useEffect, useMemo } from 'react';
import { View, TextInput as RNTextInput, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { GlobalFilterPanel, FilterCategoryConfig } from '@/components/ui/GlobalFilterPanel';
import { Chip } from '@/components/common/Chip';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import {
  Layers,
  Search,
  X,
  Boxes,
  Tag,
  CircleDollarSign,
} from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

export interface CalendarFilterState {
  facilityIds: string[]; // multi-select; empty or ['All'] means All
  resourceIds: string[]; // multi-select; empty means All
  availability: string; // 'ALL' | 'AVAILABLE' | ...
  bookingStatuses: string[]; // multi-select; empty means All
  paymentStatuses: string[]; // multi-select; empty means All
}

export interface AdminCalendarFilterDrawerProps {
  visible: boolean;
  onClose: () => void;
  filters: CalendarFilterState;
  onApply: (newFilters: CalendarFilterState) => void;
  onReset: () => void;
  amenities: Array<{ _id: string; name: string; category?: string }>;
  availableResources?: Array<{ _id: string; name: string; facilityId?: string }>;
}

export function AdminCalendarFilterDrawer({
  visible,
  onClose,
  filters,
  onApply,
  onReset,
  amenities,
  availableResources = [],
}: AdminCalendarFilterDrawerProps) {
  const { t } = useTranslation();

  const availabilityOptions = useMemo(() => [
    { id: 'ALL', label: t('all_availability', 'All Availability') },
    { id: 'AVAILABLE', label: t('status_available', 'Available') },
    { id: 'PARTIALLY_AVAILABLE', label: t('partially_available', 'Partially Available') },
    { id: 'FULLY_BOOKED', label: t('fully_booked', 'Fully Booked') },
  ], [t]);

  const statusOptions = useMemo(() => [
    { id: 'CONFIRMED', label: t('status_confirmed', 'Confirmed') },
    { id: 'CHECKED_IN', label: t('status_checked_in', 'Checked In') },
    { id: 'COMPLETED', label: t('status_completed', 'Completed') },
    { id: 'CANCELLED', label: t('status_cancelled', 'Cancelled') },
  ], [t]);

  const paymentOptions = useMemo(() => [
    { id: 'PAID', label: t('status_paid', 'Paid') },
    { id: 'PARTIALLY_PAID', label: t('status_partially_paid', 'Partially Paid') },
    { id: 'PENDING', label: t('status_pending', 'Pending') },
    { id: 'NOT_REQUIRED', label: t('status_not_required', 'Not Required') },
    { id: 'REFUNDED', label: t('status_refunded', 'Refunded') },
  ], [t]);

  const [draft, setDraft] = useState<CalendarFilterState>(filters);
  const [facilitySearch, setFacilitySearch] = useState('');

  // Sync draft whenever drawer opens
  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setFacilitySearch('');
    }
  }, [visible, filters]);

  // Specific facilities selected (excluding 'All')
  const specificFacilityIds = useMemo(
    () => draft.facilityIds.filter((id) => id !== 'All'),
    [draft.facilityIds]
  );
  const isAllFacilities = specificFacilityIds.length === 0;

  // Filtered available facilities based on search
  const filteredAmenities = useMemo(() => {
    if (!facilitySearch.trim()) return [];
    const q = facilitySearch.toLowerCase().trim();
    return amenities.filter((a) => a.name.toLowerCase().includes(q));
  }, [amenities, facilitySearch]);

  // Derived applicable resources based on selected facilities
  const applicableResources = useMemo(() => {
    if (specificFacilityIds.length === 0) return availableResources;
    return availableResources.filter((res) =>
      res.facilityId ? specificFacilityIds.includes(res.facilityId) : true
    );
  }, [specificFacilityIds, availableResources]);

  // Handle facility toggle
  const handleToggleFacility = (id: string) => {
    if (id === 'All') {
      setDraft((p) => ({ ...p, facilityIds: [] }));
      return;
    }

    setDraft((p) => {
      const current = p.facilityIds.filter((fid) => fid !== 'All');
      const isSelected = current.includes(id);
      const next = isSelected ? current.filter((fid) => fid !== id) : [...current, id];
      return { ...p, facilityIds: next };
    });
  };

  // Handle resource toggle
  const handleToggleResource = (id: string) => {
    if (id === 'All') {
      setDraft((p) => ({ ...p, resourceIds: [] }));
      return;
    }
    setDraft((p) => {
      const isSelected = p.resourceIds.includes(id);
      const next = isSelected
        ? p.resourceIds.filter((rid) => rid !== id)
        : [...p.resourceIds, id];
      return { ...p, resourceIds: next };
    });
  };

  // Handle booking status toggle
  const handleToggleBookingStatus = (status: string) => {
    if (status === 'All') {
      setDraft((p) => ({ ...p, bookingStatuses: [] }));
      return;
    }
    setDraft((p) => {
      const isSelected = p.bookingStatuses.includes(status);
      const next = isSelected
        ? p.bookingStatuses.filter((s) => s !== status)
        : [...p.bookingStatuses, status];
      return { ...p, bookingStatuses: next };
    });
  };

  // Handle payment status toggle
  const handleTogglePaymentStatus = (payment: string) => {
    if (payment === 'All') {
      setDraft((p) => ({ ...p, paymentStatuses: [] }));
      return;
    }
    setDraft((p) => {
      const isSelected = p.paymentStatuses.includes(payment);
      const next = isSelected
        ? p.paymentStatuses.filter((s) => s !== payment)
        : [...p.paymentStatuses, payment];
      return { ...p, paymentStatuses: next };
    });
  };

  // Apply filters
  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  // Reset filters
  const handleReset = () => {
    const cleared: CalendarFilterState = {
      facilityIds: [],
      resourceIds: [],
      availability: 'ALL',
      bookingStatuses: [],
      paymentStatuses: [],
    };
    setDraft(cleared);
    setFacilitySearch('');
    onReset();
    onClose();
  };

  const currentSelectionCount =
    (isAllFacilities ? 0 : specificFacilityIds.length) +
    draft.resourceIds.length +
    (draft.availability !== 'ALL' ? 1 : 0) +
    draft.bookingStatuses.length +
    draft.paymentStatuses.length;

  const renderFacilitySection = () => (
    <View className="gap-3 pt-1">
      {/* Search Input for Facilities */}
      <View className="flex-row items-center bg-card border border-border/80 rounded-xl px-2.5 h-10">
        <Icon as={Search} size={14} className="text-muted-foreground me-2 shrink-0" />
        <RNTextInput
          value={facilitySearch}
          onChangeText={setFacilitySearch}
          placeholder={t('search_facility_or_feature', 'Search facility or feature...')}
          placeholderTextColor="#9ca3af"
          className="flex-1 text-xs text-foreground font-sans p-0"
        />
        {facilitySearch ? (
          <Pressable onPress={() => setFacilitySearch('')} hitSlop={6}>
            <Icon as={X} size={14} className="text-muted-foreground" />
          </Pressable>
        ) : null}
      </View>

      {/* Quick All Chip */}
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={t('all_facilities', 'All Facilities')}
          selected={isAllFacilities}
          onPress={() => handleToggleFacility('All')}
          className="py-1.5 px-3"
        />
        {amenities.map((a) => {
          const isSelected = specificFacilityIds.includes(a._id);
          // Only show when searched or selected
          const isSearching = Boolean(facilitySearch.trim());
          const matches = isSearching && a.name.toLowerCase().includes(facilitySearch.toLowerCase().trim());
          if (!isSearching && !isSelected) return null;
          if (isSearching && !matches) return null;

          return (
            <Chip
              key={a._id}
              label={a.name}
              selected={isSelected}
              onPress={() => handleToggleFacility(a._id)}
              className="py-1.5 px-3"
            />
          );
        })}
      </View>

      {/* Resources section if applicable */}
      {applicableResources.length > 0 && (
        <View className="gap-2 pt-2 border-t border-border/40 mt-1">
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
            {t('resources', 'Resources')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t('all_resources', 'All Resources')}
              selected={draft.resourceIds.length === 0}
              onPress={() => handleToggleResource('All')}
              className="py-1.5 px-3"
            />
            {applicableResources.map((res) => {
              const isSelected = draft.resourceIds.includes(res._id);
              return (
                <Chip
                  key={res._id}
                  label={res.name}
                  selected={isSelected}
                  onPress={() => handleToggleResource(res._id)}
                  className="py-1.5 px-3"
                />
              );
            })}
          </View>
        </View>
      )}
    </View>
  );

  const categoryConfigs: FilterCategoryConfig[] = useMemo(() => [
    {
      id: 'facilities',
      label: t('facilities', 'Facilities'),
      icon: Layers,
      type: 'custom',
      selectedCount: (isAllFacilities ? 0 : specificFacilityIds.length) + draft.resourceIds.length,
      renderCustom: renderFacilitySection,
    },
    {
      id: 'availability',
      label: t('availability_status', 'Availability Status'),
      icon: Boxes,
      type: 'radio',
      options: availabilityOptions,
      selectedValues: draft.availability,
      selectedCount: draft.availability !== 'ALL' ? 1 : 0,
      onOptionSelect: (val) => setDraft((p) => ({ ...p, availability: val })),
    },
    {
      id: 'bookingStatus',
      label: t('booking_status', 'Booking Status'),
      icon: Tag,
      type: 'checkbox',
      options: statusOptions,
      selectedValues: draft.bookingStatuses,
      selectedCount: draft.bookingStatuses.length,
      onOptionToggle: handleToggleBookingStatus,
    },
    {
      id: 'paymentStatus',
      label: t('payment_status', 'Payment Status'),
      icon: CircleDollarSign,
      type: 'checkbox',
      options: paymentOptions,
      selectedValues: draft.paymentStatuses,
      selectedCount: draft.paymentStatuses.length,
      onOptionToggle: handleTogglePaymentStatus,
    },
  ], [draft, isAllFacilities, specificFacilityIds, facilitySearch, amenities, applicableResources, availabilityOptions, statusOptions, paymentOptions, t]);

  return (
    <GlobalFilterPanel
      visible={visible}
      onClose={onClose}
      title={t('filter_calendar_schedule', 'Filter Calendar Schedule')}
      categories={categoryConfigs}
      onApply={handleApply}
      onClearAll={handleReset}
      applyLabel={currentSelectionCount > 0 ? `${t('apply_filters', 'Apply Filters')} (${currentSelectionCount})` : t('apply_filters', 'Apply Filters')}
      totalActiveCount={currentSelectionCount}
    />
  );
}

export default AdminCalendarFilterDrawer;
