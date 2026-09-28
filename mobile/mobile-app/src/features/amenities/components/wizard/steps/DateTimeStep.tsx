/**
 * Amenity Management Phase 6B.2 - Step: Date & Time Selection
 * Handles date picker, operating hours slot calculation, facility timezone display,
 * and live availability verification.
 */

import React, { useMemo } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { DatePicker } from '@/components/common/DatePicker';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { formatTo12Hour, formatTimeRange12Hour } from '../../../utils/amenityStateHelpers';
import { AmenityFacility, AmenityAvailabilityResult } from '../../../types/amenityDomain.types';

export interface DateTimeStepProps {
  facility: AmenityFacility;
  selectedDate: string;
  startTime: string;
  endTime: string;
  onDateChange: (date: string) => void;
  onTimeChange: (start: string, end: string) => void;
  checkingAvailability?: boolean;
  availabilityResult?: AmenityAvailabilityResult | null;
  onCheckAvailability: () => Promise<boolean>;
  availableSlots?: Array<{ start: string; end: string; label: string }>;
  slotsLoading?: boolean;
  error?: string | null;
}

export function DateTimeStep({
  facility,
  selectedDate,
  startTime,
  endTime,
  onDateChange,
  onTimeChange,
  checkingAvailability = false,
  availabilityResult,
  onCheckAvailability,
  availableSlots,
  slotsLoading = false,
  error,
}: DateTimeStepProps) {
  const selectedDateObj = useMemo(() => {
    if (!selectedDate || typeof selectedDate !== 'string') return new Date();
    const [y, m, d] = selectedDate.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date();
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  // Compute day of week for operating hours matching (0 = Sun, 6 = Sat)
  const dayOfWeek = selectedDateObj.getDay();
  const daySchedule = useMemo(() => {
    return facility.operatingHours?.find((h: any) => h.dayOfWeek === dayOfWeek);
  }, [facility.operatingHours, dayOfWeek]);

  // Generate suggested slot chunks based on slotDurationMinutes, operating hours, and server availability
  const suggestedSlots = useMemo(() => {
    if (!daySchedule || !daySchedule.isOpen) return [];

    const opensAtStr = daySchedule.opensAt || (daySchedule as any).openTime || '06:00';
    const closesAtStr = daySchedule.closesAt || (daySchedule as any).closeTime || '22:00';

    const [openH, openM] = typeof opensAtStr === 'string' ? opensAtStr.split(':').map(Number) : [6, 0];
    const [closeH, closeM] = typeof closesAtStr === 'string' ? closesAtStr.split(':').map(Number) : [22, 0];
    const duration = facility.slotDurationMinutes || 60;

    const startMinutes = (isNaN(openH) ? 6 : openH) * 60 + (isNaN(openM) ? 0 : openM);
    const endMinutes = (isNaN(closeH) ? 22 : closeH) * 60 + (isNaN(closeM) ? 0 : closeM);

    // Check if viewing today's date
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const isToday = selectedDate === todayStr;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const baseSlots: { start: string; end: string; label: string }[] = [];
    let current = startMinutes;

    while (current + duration <= endMinutes) {
      const slotStartH = Math.floor(current / 60);
      const slotStartM = current % 60;
      const slotEndH = Math.floor((current + duration) / 60);
      const slotEndM = (current + duration) % 60;

      const startStr = `${pad(slotStartH)}:${pad(slotStartM)}`;
      const endStr = `${pad(slotEndH)}:${pad(slotEndM)}`;

      // Filter out slots that have already passed if viewing today (2 min grace)
      const isPast = isToday && current < currentMinutes - 2;

      if (!isPast) {
        baseSlots.push({
          start: startStr,
          end: endStr,
          label: formatTimeRange12Hour(startStr, endStr),
        });
      }

      current += duration;
    }

    // If server provided vetted available slots, filter out booked slots (they disappear)
    if (availableSlots !== undefined && availableSlots !== null) {
      if (availableSlots.length > 0) {
        const availableSet = new Set(availableSlots.map((s) => s.start));
        return baseSlots.filter((s) => availableSet.has(s.start));
      }
      // If server explicitly returned empty slots and is not loading, all slots are booked/passed
      if (!slotsLoading) {
        return [];
      }
    }

    return baseSlots;
  }, [availableSlots, daySchedule, facility.slotDurationMinutes, selectedDate, slotsLoading]);

  const handleDateSelected = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    onDateChange(formatted);
  };

  const isOperatingDayClosed = daySchedule && !daySchedule.isOpen;

  return (
    <View className="gap-4">
      {/* Header Description */}
      <View>
        <Text variant="large" className="font-bold text-foreground">
          Select Date & Time Window
        </Text>
        <Text variant="muted" className="text-xs text-muted-foreground mt-0.5">
          Schedule your reservation in facility local time ({facility.timezone || 'UTC'}).
        </Text>
      </View>

      {/* Date Picker */}
      <View className="bg-card p-4 rounded-2xl border border-border">
        <DatePicker
          label="Reservation Date"
          value={selectedDateObj}
          onChange={handleDateSelected}
          minDate={new Date()}
        />

        {facility.bookingRules?.maxAdvanceBookingDays ? (
          <Text variant="muted" className="text-[11px] text-muted-foreground mt-2">
            Reservations may be booked up to {facility.bookingRules.maxAdvanceBookingDays} days in advance.
          </Text>
        ) : null}
      </View>

      {/* Operating Schedule Notice */}
      {isOperatingDayClosed ? (
        <View className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex-row items-center gap-3">
          <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
          <View className="flex-1">
            <Text className="text-amber-800 dark:text-amber-200 font-bold text-xs">
              Facility Closed on this Day
            </Text>
            <Text className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
              Please choose another day of the week when this facility is open.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Time Slot Selection */}
      {!isOperatingDayClosed && (
        <View className="bg-card p-4 rounded-2xl border border-border gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-semibold text-sm text-foreground">Available Time Slots</Text>
            {daySchedule?.isOpen ? (
              <StatusBadge
                label={formatTimeRange12Hour(
                  daySchedule.opensAt || (daySchedule as any).openTime || '06:00',
                  daySchedule.closesAt || (daySchedule as any).closeTime || '22:00'
                )}
                variant="info"
              />
            ) : null}
          </View>

          {slotsLoading ? (
            <View className="py-6 items-center justify-center gap-2">
              <ActivityIndicator size="small" className="text-primary" />
              <Text variant="muted" className="text-xs text-muted-foreground">Checking available slots...</Text>
            </View>
          ) : suggestedSlots.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {suggestedSlots.map((slot) => {
                const isSelected = startTime === slot.start && endTime === slot.end;

                return (
                  <TouchableOpacity
                    key={slot.label}
                    onPress={() => onTimeChange(slot.start, slot.end)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Select slot ${slot.label}`}
                    className={`px-3 py-2 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-primary border-primary'
                        : 'bg-muted/40 border-border'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        isSelected ? 'text-primary-foreground' : 'text-foreground'
                      }`}
                    >
                      {slot.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View className="p-4 rounded-xl bg-muted/30 border border-border items-center justify-center gap-1 my-1">
              <Clock size={20} className="text-muted-foreground" />
              <Text className="text-xs font-semibold text-foreground text-center">
                No Available Time Slots
              </Text>
              <Text variant="muted" className="text-[11px] text-muted-foreground text-center">
                All slots for this date may be booked or have passed. Please select another date.
              </Text>
            </View>
          )}

          {/* Current Selection Indicator */}
          <View className="p-3 rounded-xl bg-muted/30 border border-border/60 gap-2.5 mt-1">
            <View className="flex-row items-center gap-2 min-w-0">
              <Clock size={16} className="text-primary" />
              <Text className="flex-1 min-w-0 text-xs font-medium text-foreground" numberOfLines={1}>
                Selected: {formatTo12Hour(startTime)} to {formatTo12Hour(endTime)}
              </Text>
            </View>

            <Button
              variant="outline"
              onPress={onCheckAvailability}
              disabled={checkingAvailability}
              className="w-full h-11 rounded-xl bg-primary/10 border-primary/25 flex-row items-center justify-center gap-2"
              accessibilityLabel="Verify selected slot availability"
            >
              {checkingAvailability ? (
                <ActivityIndicator size="small" className="text-primary" />
              ) : (
                <CheckCircle2 size={14} className="text-primary" />
              )}
              <Text className="text-xs font-semibold text-primary">Verify Availability</Text>
            </Button>
          </View>
        </View>
      )}

      {/* Availability Result Feedback */}
      {availabilityResult ? (
        <View
          className={`p-4 rounded-2xl border ${
            availabilityResult.available
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-destructive/10 border-destructive/30'
          }`}
        >
          <View className="flex-row items-center gap-2">
            {availabilityResult.available ? (
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle size={18} className="text-destructive" />
            )}
            <Text
              className={`font-bold text-xs ${
                availabilityResult.available
                  ? 'text-emerald-800 dark:text-emerald-200'
                  : 'text-destructive'
              }`}
            >
              {availabilityResult.available
                ? 'Slot Available for Booking'
                : 'Selected Slot is Unavailable'}
            </Text>
          </View>

          {availabilityResult.reason ? (
            <Text
              className={`text-xs mt-1 ${
                availabilityResult.available
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-destructive/90'
              }`}
            >
              {availabilityResult.reason}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Local validation error */}
      {error ? (
        <View className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <Text className="text-xs text-destructive font-medium">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default DateTimeStep;
