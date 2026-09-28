import React, { useState, useMemo } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { Calendar as CalendarIcon, Wrench } from 'lucide-react-native';

import { useAdminCalendar, formatDateString } from '../../../src/features/amenities/hooks/useAdminCalendar';
import { AdminCalendarView } from '../../../src/features/amenities/components/AdminCalendarView';
import { AdminReservationCard } from '../../../src/features/amenities/components/AdminReservationCard';
import { AdminCalendarFilterDrawer } from '../../../src/features/amenities/components/AdminCalendarFilterDrawer';
import { AdminActiveFilterChips } from '../../../src/features/amenities/components/AdminActiveFilterChips';
import { AdminAvailabilitySummary } from '../../../src/features/amenities/components/AdminAvailabilitySummary';
import { BookingDetailModal } from '../../../src/features/amenities/components/BookingDetailModal';
import { AmenityBooking } from '../../../src/features/amenities/store/amenityBookingSlice';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';

export default function AdminAmenityCalendarScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Guard: Non-admin users or users without amenity permissions are redirected
  if (user && !isFeatureAllowedForUser({ id: 'amenities_admin_calendar', permission: 'amenities:admin_calander' }, user)) {
    if (isFeatureAllowedForUser({ id: 'amenities_discover', permission: 'amenities:discover' }, user)) {
      return <Redirect href="/(resident)/amenities/discover" />;
    }
    if (isFeatureAllowedForUser({ id: 'amenities_scanner', permission: 'amenities:scanner' }, user)) {
      return <Redirect href="/(resident)/amenities/scanner" />;
    }
    return <Redirect href="/(resident)/dashboard" />;
  }

  const {
    adminBookings,
    filteredBookings,
    selectedRangeBookings,
    groupedReservationsByDate,
    bookingCountsByDate,
    amenities,
    availableResources,
    conflictedBookingIds,
    availabilitySummary,
    availabilityCounts,
    currentDate,
    startDate,
    endDate,
    handleSelectCalendarDate,
    navigateDate,
    selectWholeMonth,
    filters,
    searchQuery,
    setSearchQuery,
    handleApplyFilters,
    handleResetFilters,
    handleAvailabilityQuickFilter,
    handleRemoveFilter,
    activeFilterCount,
    selectedBookingDetail,
    setSelectedBookingDetail,
    pagination,
    handleLoadMore,
    loading,
    error,
    loadData,
  } = useAdminCalendar();

  // Availability sort options for Quick Filter bar outside
  const availabilitySortOptions = useMemo(() => [
    { label: `All (${availabilityCounts.ALL})`, value: 'ALL' },
    { label: `Available (${availabilityCounts.AVAILABLE})`, value: 'AVAILABLE' },
    { label: `Partially Available (${availabilityCounts.PARTIALLY_AVAILABLE})`, value: 'PARTIALLY_AVAILABLE' },
    { label: `Fully Booked (${availabilityCounts.FULLY_BOOKED})`, value: 'FULLY_BOOKED' },
    { label: `Maintenance (${availabilityCounts.MAINTENANCE})`, value: 'MAINTENANCE' },
    { label: `Blocked (${availabilityCounts.BLOCKED})`, value: 'BLOCKED' },
  ], [availabilityCounts]);

  // Format dates for compact summary
  const formatDateToShort = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const d =
      parts.length === 3
        ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
        : new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const isRangeSelected = Boolean(endDate && endDate !== startDate);
  const isWaitingForEndDate = Boolean(startDate && endDate === null);

  const isWholeMonth = useMemo(() => {
    if (!startDate || !endDate) return false;
    const curr = new Date(currentDate);
    const startOfMonth = formatDateString(new Date(curr.getFullYear(), curr.getMonth(), 1));
    const endOfMonth = formatDateString(new Date(curr.getFullYear(), curr.getMonth() + 1, 0));
    return startDate === startOfMonth && endDate === endOfMonth;
  }, [startDate, endDate, currentDate]);

  // Selected date/range label
  const formattedRangeLabel = useMemo(() => {
    if (!startDate) return '';
    if (isWholeMonth) {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' (All Month)';
    }
    if (isWaitingForEndDate) {
      return formatDateToShort(startDate);
    }
    if (isRangeSelected) {
      return `${formatDateToShort(startDate)} – ${formatDateToShort(endDate!)}`;
    }
    return formatDateToShort(startDate);
  }, [startDate, endDate, isWaitingForEndDate, isRangeSelected, isWholeMonth, currentDate]);

  const renderDateGroup = (group: { date: string; formattedDate: string; bookings: AmenityBooking[] }) => {
    if (!group) return null;
    return (
      <View key={group.date} className="gap-2 mb-3">
        {/* Date Section Header */}
        <View className="flex-row items-center justify-between px-1 border-b border-border/40 pb-1">
          <Text className="font-bold text-xs text-foreground uppercase tracking-wider font-sans">
            {group.formattedDate} · {group.bookings.length} {group.bookings.length === 1 ? 'reservation' : 'reservations'}
          </Text>
        </View>

        {/* Reservations for this date */}
        <View className="gap-2">
          {group.bookings.map((item) => (
            <AdminReservationCard
              key={item._id || item.bookingId}
              booking={item}
              isConflicted={conflictedBookingIds.has(item._id)}
              onPress={(b) => setSelectedBookingDetail(b)}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View className="mb-2.5 gap-2.5">
      {/* Search Bar with Filter Drawer Trigger */}
      <SearchFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search resident, villa #, ref ID..."
        onFilterPress={() => setIsFilterDrawerOpen(true)}
        activeFilterCount={activeFilterCount}
        variant="default"
        className="px-0 py-0 border-0"
      />

      {/* Active Filter Chips Row */}
      <AdminActiveFilterChips
        filters={filters}
        searchQuery={searchQuery}
        onRemoveFilter={handleRemoveFilter}
        onClearAll={handleResetFilters}
        amenities={amenities}
        availableResources={availableResources}
      />

      {/* Compact Month Calendar with Date Range Selection */}
      <AdminCalendarView
        currentDate={currentDate}
        startDate={startDate}
        endDate={endDate}
        onSelectDate={handleSelectCalendarDate}
        bookingCountsByDate={bookingCountsByDate}
        onPrevDate={() => navigateDate(-1)}
        onNextDate={() => navigateDate(1)}
      />

      {/* Compact Availability Summary for Selected Context */}
      <AdminAvailabilitySummary items={availabilitySummary} />

      {/* Selected Date / Range Header & Total Reservation Count */}
      <View className="flex-row items-center justify-between px-1 pt-1">
        <View>
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-semibold text-muted-foreground">
              Selected
            </Text>
            {!isWholeMonth && (
              <Button
                variant="ghost"
                size="sm"
                onPress={selectWholeMonth}
                className="h-6 px-2 py-0 rounded-md bg-primary/10 border border-primary/20 active:bg-primary/20"
                accessibilityRole="button"
                accessibilityLabel="View all month"
              >
                <Text className="text-[11px] font-bold text-primary font-sans">View All Month</Text>
              </Button>
            )}
          </View>
          <View className="flex-row items-baseline gap-2">
            <Text variant="large" className="font-bold text-foreground text-base mt-0.5">
              {formattedRangeLabel}
            </Text>
            {isWaitingForEndDate && (
              <Text className="text-xs font-medium text-primary italic">
                Select end date
              </Text>
            )}
          </View>
        </View>
        <Text variant="large" className="font-bold text-foreground text-base">
          Reservations ({selectedRangeBookings.length})
        </Text>
      </View>
    </View>
  );

  const hasActiveFilters =
    activeFilterCount > 0 ||
    Boolean(searchQuery.trim()) ||
    filters.availability !== 'ALL';

  const renderEmptyComponent = () => {
    if (hasActiveFilters) {
      return (
        <View className="items-center justify-center p-6 bg-card rounded-2xl border border-border mt-1">
          <Icon as={CalendarIcon} size={32} className="text-muted-foreground mb-2" />
          <Text className="text-sm font-bold text-foreground text-center">
            No reservations match the selected filters
          </Text>
          <Text className="text-xs text-muted-foreground text-center mt-1 mb-3">
            Try adjusting your filter settings or selecting another date.
          </Text>
          <Button variant="outline" size="sm" onPress={handleResetFilters}>
            Clear Filters
          </Button>
        </View>
      );
    }

    return (
      <View className="items-center justify-center p-6 bg-card rounded-2xl border border-border mt-1">
        <Icon as={CalendarIcon} size={32} className="text-muted-foreground mb-2" />
        <Text className="text-sm font-bold text-foreground text-center">
          No reservations for this date
        </Text>
        <Text className="text-xs text-muted-foreground text-center mt-1">
          There are no bookings or maintenance events scheduled for this day.
        </Text>
      </View>
    );
  };

  return (
    <ScreenShell
      title="Facility Schedule & Occupancy"
      subtitle="Track occupancy & monitor reservations"
      iconName="Calendar"
      loading={loading && adminBookings.length === 0}
      error={error}
    >
      <View className="flex-1 bg-background">
        <PaginatedList<{ date: string; formattedDate: string; bookings: AmenityBooking[] }>
          data={groupedReservationsByDate}
          renderItem={renderDateGroup}
          pagination={
            pagination || {
              currentPage: 1,
              totalPages: 1,
              totalRecords: groupedReservationsByDate.length,
              limit: 50,
            }
          }
          onLoadMore={handleLoadMore}
          onRefresh={loadData}
          loading={loading}
          paginationSummary
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={renderEmptyComponent()}
          contentContainerClassName="p-3 pt-2.5 pb-28 gap-2.5"
        />
      </View>

      {/* Filter Bottom Sheet */}
      <AdminCalendarFilterDrawer
        visible={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={filters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        amenities={amenities}
        availableResources={availableResources}
      />

      {/* Booking Details Inspection Modal */}
      <BookingDetailModal
        visible={!!selectedBookingDetail}
        onClose={() => setSelectedBookingDetail(null)}
        booking={selectedBookingDetail}
      />
    </ScreenShell>
  );
}
