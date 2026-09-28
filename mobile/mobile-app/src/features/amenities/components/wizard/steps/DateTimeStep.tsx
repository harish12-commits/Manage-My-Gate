/**
 * Booking wizard step: when to book. Shows only the windows the server offers for the
 * facility's archetype (slots, event sessions, the full day, an overnight check-in or a
 * loan pickup) and, for stays and loans, how many nights / days.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Chip } from '@/components/common/Chip';
import { DatePicker } from '@/components/common/DatePicker';
import { QuantitySelector } from '@/components/common/QuantitySelector';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { CalendarX } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityFacility, AmenityAvailabilityResult } from '../../../types/amenityDomain.types';
import { ApiDailySlot } from '../../../services/amenityManagementService';
import { formatBookingWindow } from '../../../utils/amenityStateHelpers';
import { isLoanFacility, isOvernightFacility, maxStayNights } from '../../../utils/amenityBookingWindow';

export interface DateTimeStepProps {
  facility: AmenityFacility;
  selectedDate: string;
  onDateChange: (date: string) => void;
  slots?: ApiDailySlot[];
  slotsLoading?: boolean;
  selectedSlot: ApiDailySlot | null;
  onSelectSlot: (slot: ApiDailySlot) => void;
  nights: number;
  onNightsChange: (nights: number) => void;
  loanDays: number;
  onLoanDaysChange: (days: number) => void;
  maxLoanDays: number;
  endUtcIso: string;
  availabilityResult?: AmenityAvailabilityResult | null;
  error?: string | null;
}

const toDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : new Date();
};
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function DateTimeStep({
  facility,
  selectedDate,
  onDateChange,
  slots,
  slotsLoading = false,
  selectedSlot,
  onSelectSlot,
  nights,
  onNightsChange,
  loanDays,
  onLoanDaysChange,
  maxLoanDays,
  endUtcIso,
  error,
}: DateTimeStepProps) {
  const { t } = useTranslation();
  const tz = facility.timezone || 'Asia/Kolkata';
  const overnight = isOvernightFacility(facility);
  const loan = isLoanFacility(facility);
  const eventMode = facility.archetype === 'EVENT_SPACE' ? facility.bookingMode || 'FULL_DAY' : null;

  const maxDate = useMemo(() => {
    const days = Number(facility.advanceBookingDays) || 0;
    if (!days) return undefined;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }, [facility.advanceBookingDays]);

  const dateLabel = overnight
    ? t('amenity_booking_checkin_date', 'Check-in date')
    : loan
      ? t('amenity_booking_pickup_date', 'Pickup date')
      : t('amenity_booking_date', 'Date');

  const windowsTitle = overnight
    ? t('amenity_booking_checkin_time', 'Check-in')
    : loan
      ? t('amenity_booking_pickup_time', 'Pickup time')
      : eventMode === 'SESSION'
        ? t('amenity_booking_sessions', 'Available sessions')
        : eventMode === 'FULL_DAY'
          ? t('amenity_booking_full_day', 'Full day')
          : t('amenity_booking_slots', 'Available time slots');

  const loanOptions = useMemo(() => Array.from({ length: maxLoanDays + 1 }, (_, i) => i), [maxLoanDays]);

  return (
    <View className="gap-4">
      <View>
        <Text variant="large" className="font-bold text-foreground">
          {t('amenity_booking_when_title', 'When would you like to book?')}
        </Text>
        <Text variant="muted" className="text-xs mt-0.5">
          {t('amenity_booking_when_sub', 'Times are shown in the facility time zone ({tz}).', { tz })}
        </Text>
      </View>

      <View className="bg-card p-4 rounded-2xl border border-border gap-2">
        <DatePicker
          label={dateLabel}
          value={toDate(selectedDate)}
          onChange={(d) => onDateChange(toYmd(d))}
          minDate={new Date()}
          maxDate={maxDate}
        />
        {facility.advanceBookingDays ? (
          <Text variant="muted" className="text-[11px]">
            {t('amenity_booking_advance_window', 'Bookings open up to {days} day(s) ahead.', { days: facility.advanceBookingDays })}
          </Text>
        ) : null}
      </View>

      <View className="bg-card p-4 rounded-2xl border border-border gap-3">
        <Text className="font-semibold text-sm text-foreground">{windowsTitle}</Text>
        {slotsLoading ? (
          <View className="gap-2">
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-2/3 rounded-xl" />
          </View>
        ) : slots && slots.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {slots.map((slot) => {
              const left =
                facility.archetype === 'SHARED_CAPACITY' && slot.maxCapacity && slot.maxCapacity > 1
                  ? ` · ${t('amenity_booking_places_left', '{n} left', { n: slot.availableUnits ?? 0 })}`
                  : '';
              return (
                <Chip
                  key={slot.startUtc}
                  label={`${slot.label}${left}`}
                  selected={selectedSlot?.startUtc === slot.startUtc}
                  onPress={() => onSelectSlot(slot)}
                  accessibilityLabel={`${t('amenity_booking_select_window', 'Select')} ${slot.label}`}
                />
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon={CalendarX}
            title={t('amenity_booking_no_windows', 'Nothing available on this day')}
            description={t('amenity_booking_no_windows_sub', 'It may be fully booked, closed or past. Try another date.')}
          />
        )}
      </View>

      {overnight && selectedSlot ? (
        <View className="bg-card p-4 rounded-2xl border border-border gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-semibold text-sm text-foreground">{t('amenity_booking_nights', 'Nights')}</Text>
            <QuantitySelector value={nights} min={1} max={maxStayNights(facility)} onChange={onNightsChange} />
          </View>
        </View>
      ) : null}

      {loan && selectedSlot && maxLoanDays > 0 ? (
        <View className="bg-card p-4 rounded-2xl border border-border gap-3">
          <Text className="font-semibold text-sm text-foreground">{t('amenity_booking_return', 'Return')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {loanOptions.map((d) => (
              <Chip
                key={d}
                label={
                  d === 0
                    ? t('amenity_booking_return_same_day', 'Same day')
                    : t('amenity_booking_return_after_days', 'After {n} day(s)', { n: d })
                }
                selected={loanDays === d}
                onPress={() => onLoanDaysChange(d)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {selectedSlot && endUtcIso ? (
        <View className="p-3 rounded-xl bg-muted/40 border border-border/60">
          <Text className="text-xs font-medium text-foreground">
            {t('amenity_booking_selected', 'Selected')}: {formatBookingWindow(selectedSlot.startUtc, endUtcIso, tz)}
          </Text>
        </View>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}
    </View>
  );
}

export default DateTimeStep;
