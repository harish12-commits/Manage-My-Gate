/**
 * Amenity Calendar — Resident Slot Discovery Screen
 *
 * Allows residents to:
 *  1. Pick a reservation date from the catalog Calendar component.
 *  2. Choose a facility from a dropdown.
 *  3. View time slots generated for that date + facility.
 *  4. Tap an available slot to launch the booking wizard.
 *
 * Architecture:
 *  - Thin route wrapper — all state and logic lives in useResidentCalendar hook.
 *  - Every component pulled from @/components catalog — no raw primitives.
 */

import React, { useMemo } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { Calendar } from '@/components/common/Calendar';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonLoader } from '@/components/feedback/SkeletonLoader';
import { ScheduleDateNavigator } from '../../../src/features/amenities/components/ScheduleDateNavigator';
import { useResidentCalendar } from '../../../src/features/amenities/hooks/useResidentCalendar';
import { AmenitySlot } from '../../../src/features/amenities/store/amenitySlice';
import { Clock, CalendarDays, ChevronRight } from 'lucide-react-native';

export default function ResidentAmenityCalendarScreen() {
  const router = useRouter();

  const {
    slots,
    slotsLoading,
    loading,
    error,
    selectedDate,
    selectedAmenityId,
    selectedSlot,
    amenityOptions,
    currentAmenity,
    setSelectedAmenityId,
    handleRefresh,
    navigateDate,
    setToday,
    handleDateChange,
    handleSlotSelect,
  } = useResidentCalendar();

  // Convert "YYYY-MM-DD" string → Date for the Calendar component
  const selectedDateObj = useMemo(() => {
    if (!selectedDate) return new Date();
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  // Partition slots into available vs unavailable for visual grouping
  const { availableSlots, unavailableSlots } = useMemo(() => {
    const avail: AmenitySlot[] = [];
    const unavail: AmenitySlot[] = [];
    for (const slot of slots) {
      const isAvail =
        slot.isAvailable !== undefined
          ? slot.isAvailable
          : !slot.status || slot.status === 'Available' || slot.status === 'AVAILABLE';
      if (isAvail) avail.push(slot);
      else unavail.push(slot);
    }
    return { availableSlots: avail, unavailableSlots: unavail };
  }, [slots]);

  const handleCalendarDateSelect = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    handleDateChange(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  };

  const handleSlotBook = (slot: AmenitySlot) => {
    handleSlotSelect(slot);
    if (selectedAmenityId) {
      router.navigate({
        pathname: '/(resident)/amenities/booking/[id]',
        params: { id: selectedAmenityId },
      });
    }
  };

  const renderSlotChip = (slot: AmenitySlot, isAvailable: boolean) => {
    const isSelected =
      selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime;

    return (
      <TouchableOpacity
        key={`${slot.startTime}-${slot.endTime}`}
        onPress={() => isAvailable && handleSlotBook(slot)}
        disabled={!isAvailable}
        activeOpacity={isAvailable ? 0.7 : 1}
        accessibilityRole="button"
        accessibilityLabel={`Slot ${slot.startTime} to ${slot.endTime}${isAvailable ? ', available, tap to book' : ', unavailable'}`}
        className={`flex-row items-center justify-between p-3 rounded-2xl border mb-2 ${
          isSelected
            ? 'bg-primary border-primary'
            : isAvailable
            ? 'bg-card border-border active:bg-muted/60'
            : 'bg-muted/30 border-border/40 opacity-60'
        }`}
      >
        {/* Time Window + Fee */}
        <View className="flex-row items-center gap-2.5">
          <View
            className={`p-2 rounded-xl ${
              isSelected ? 'bg-primary-foreground/20' : isAvailable ? 'bg-primary/10' : 'bg-muted'
            }`}
          >
            <Clock
              size={16}
              className={
                isSelected
                  ? 'text-primary-foreground'
                  : isAvailable
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }
            />
          </View>
          <View>
            <Text
              className={`font-bold text-sm ${
                isSelected ? 'text-primary-foreground' : 'text-foreground'
              }`}
            >
              {slot.startTime} – {slot.endTime}
            </Text>
            <Text
              className={`text-xs ${
                isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
              }`}
            >
              {slot.fee != null && slot.fee > 0 ? `₹${slot.fee} / slot` : 'Free Access'}
            </Text>
          </View>
        </View>

        {/* Availability Indicator */}
        <View className="flex-row items-center gap-2">
          {isAvailable ? (
            <>
              {slot.availableCount != null && (
                <StatusBadge
                  label={`${slot.availableCount} left`}
                  variant={slot.availableCount <= 2 ? 'warning' : 'success'}
                  dot
                />
              )}
              {!isSelected && (
                <ChevronRight size={16} className="text-muted-foreground" />
              )}
            </>
          ) : (
            <StatusBadge label="FULL" variant="danger" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenShell
      title="Slot Calendar"
      subtitle="Browse & reserve facility time slots"
      iconName="CalendarDays"
      loading={loading && (!slots || slots.length === 0) && !selectedAmenityId}
      error={error}
      onRetry={handleRefresh}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pt-3 pb-28 gap-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Facility Selector */}
        <View className="bg-card p-4 rounded-2xl border border-border shadow-xs">
          <DropdownSelect
            label="Select Facility"
            options={
              amenityOptions.length > 0
                ? amenityOptions
                : [{ label: 'Loading facilities...', value: '' }]
            }
            value={selectedAmenityId}
            onValueChange={setSelectedAmenityId}
          />
          {currentAmenity?.description ? (
            <Text variant="muted" className="text-xs mt-2 leading-relaxed">
              {currentAmenity.description}
            </Text>
          ) : null}
        </View>

        {/* Month Calendar Grid (from catalog) */}
        <Calendar
          selectedDate={selectedDateObj}
          onSelectDate={handleCalendarDateSelect}
          minDate={new Date()}
        />

        {/* Date Navigation Bar */}
        <ScheduleDateNavigator
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onPrevDate={() => navigateDate(-1)}
          onNextDate={() => navigateDate(1)}
          onToday={setToday}
          title="Jump to Date"
        />

        {/* Slot Grid Section */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between px-1">
            <View className="flex-row items-center gap-2">
              <CalendarDays size={16} className="text-primary" />
              <Text className="font-bold text-sm text-foreground">Time Slots</Text>
            </View>
            {slots.length > 0 && (
              <Text variant="muted" className="text-xs">
                {availableSlots.length} open · {unavailableSlots.length} full
              </Text>
            )}
          </View>

          {/* Skeleton while loading */}
          {slotsLoading ? (
            <View className="gap-2">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonLoader key={i} className="h-16 rounded-2xl" />
              ))}
            </View>
          ) : slots.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No Slots Available"
              description={
                selectedAmenityId
                  ? 'No scheduled time slots found for the selected date. Try another day or facility.'
                  : 'Select a facility above to view available booking slots.'
              }
            />
          ) : (
            <View>
              {/* Available slots — bookable */}
              {availableSlots.map((slot) => renderSlotChip(slot, true))}

              {/* Divider before full slots */}
              {unavailableSlots.length > 0 && availableSlots.length > 0 && (
                <View className="flex-row items-center gap-2 my-2">
                  <View className="flex-1 h-px bg-border/60" />
                  <Text variant="muted" className="text-[11px]">
                    Fully booked
                  </Text>
                  <View className="flex-1 h-px bg-border/60" />
                </View>
              )}

              {/* Unavailable slots — greyed out, non-interactive */}
              {unavailableSlots.map((slot) => renderSlotChip(slot, false))}
            </View>
          )}
        </View>

        {/* Facility Operating Hours Info Footer */}
        {currentAmenity && (
          <View className="bg-muted/30 border border-border/50 rounded-2xl p-4 gap-1.5">
            <Text className="font-semibold text-xs text-foreground">Operating Hours</Text>
            <Text variant="muted" className="text-xs">
              {currentAmenity.openTime || '06:00'} – {currentAmenity.closeTime || '22:00'}
            </Text>
            {(currentAmenity.bookingRules?.cancelNoticeHours ?? 0) > 0 && (
              <Text variant="muted" className="text-xs">
                Cancellation requires {currentAmenity.bookingRules.cancelNoticeHours}h advance notice.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}
