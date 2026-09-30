import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Check } from 'lucide-react-native';
import { BookingSlot } from '../models/booking.model';
import { cn } from '@/lib/utils';

export interface TimeSlotPickerProps {
  slots: BookingSlot[];
  selectedSlotIds: string[];
  onToggleSlot: (slot: BookingSlot) => void;
  selectedDate?: string;
  onDateChange?: (dateStr: string) => void;
  pricePerHour?: number;
  className?: string;
}

function getSlotDuration(start: string, end: string): string {
  try {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const diff = (endH * 60 + (endM || 0)) - (startH * 60 + (startM || 0));
    return diff > 0 ? `${diff}m` : '60m';
  } catch {
    return '60m';
  }
}

export const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  slots,
  selectedSlotIds,
  onToggleSlot,
  selectedDate,
  pricePerHour = 500,
  className,
}) => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isToday = selectedDate ? selectedDate === todayStr : false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const visibleSlots = (slots || []).filter((slot) => {
    if (!slot) return false;
    if ((slot.status as string)?.toLowerCase() === 'closed') return false;
    if (isToday && slot.startTime) {
      const [startH = 0, startM = 0] = slot.startTime.split(':').map(Number);
      if (startH * 60 + startM <= currentMinutes) return false;
    }
    return true;
  });

  return (
    <View className={cn('w-full', className)}>
      {/* Top Legend Indicator */}
      <View className="flex-row items-center mb-2 px-0.5">
        <View className="w-2 h-2 rounded-full bg-emerald-500 me-1.5" />
        <Text className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {visibleSlots.length} Available
        </Text>
      </View>

      {/* Sleek & Compact 2-Column Grid Cards */}
      <View className="flex-row flex-wrap justify-between gap-y-2">
        {visibleSlots.map((slot, index) => {
          const slotStartTime = slot?.startTime || '00:00';
          const slotEndTime = slot?.endTime || '00:00';
          const slotId = slot?.id || `${slotStartTime}-${slotEndTime}-${index}`;
          const isSelected = selectedSlotIds.includes(slotId);
          const isBooked = slot?.status === 'booked';
          const isMaintenance = slot?.status === 'maintenance';
          const isDisabled = isBooked || isMaintenance;
          const duration = getSlotDuration(slotStartTime, slotEndTime);

          return (
            <TouchableOpacity
              key={slotId}
              disabled={isDisabled}
              onPress={() => onToggleSlot(slot)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: isDisabled }}
              accessibilityLabel={`Time slot starting at ${slotStartTime}, ending at ${slotEndTime}, ${slot?.status || 'available'}`}
              className={cn(
                'w-[48.5%] rounded-xl p-2.5 border flex-col justify-between min-h-[78px] active:scale-[0.97] transition-all bg-card',
                isSelected
                  ? 'border-2 border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20 shadow-xs'
                  : !isDisabled
                  ? 'border-slate-200/90 dark:border-slate-800/90 shadow-2xs hover:border-slate-300'
                  : 'border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 opacity-50'
              )}
            >
              {/* Top Row: Start Time & Checkmark if selected */}
              <View className="flex-row items-center justify-between">
                <Text
                  className={cn(
                    'text-base font-black tracking-tight text-start leading-5',
                    isSelected
                      ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                      : isDisabled
                      ? 'text-slate-400 dark:text-slate-600 line-through'
                      : 'text-slate-900 dark:text-white'
                  )}
                >
                  {slotStartTime}
                </Text>

                {isSelected && (
                  <View className="h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                    <Check size={10} color="#ffffff" strokeWidth={3} />
                  </View>
                )}
              </View>

              {/* Middle Row: End Time & Duration */}
              <View className="flex-row items-center my-0.5">
                <Text
                  className={cn(
                    'text-[10px] font-semibold me-1.5',
                    isDisabled ? 'text-slate-400/60' : 'text-slate-400 dark:text-slate-400'
                  )}
                >
                  {slotEndTime}
                </Text>
                <Text
                  className={cn(
                    'text-[10px] font-medium',
                    isDisabled ? 'text-slate-400/40' : 'text-slate-400/80 dark:text-slate-500'
                  )}
                >
                  {duration}
                </Text>
              </View>

              {/* Bottom Row: Ultra-Sleek Status Pill Badge */}
              <View
                className={cn(
                  'flex-row items-center self-start px-2 py-0.5 rounded-full',
                  isSelected
                    ? 'bg-emerald-500'
                    : !isDisabled
                    ? 'bg-emerald-100/90 dark:bg-emerald-950/80'
                    : 'bg-slate-100 dark:bg-slate-800'
                )}
              >
                {/* Solid Status Indicator Dot */}
                <View
                  className={cn(
                    'w-1.5 h-1.5 rounded-full me-1',
                    isSelected
                      ? 'bg-white'
                      : isMaintenance
                      ? 'bg-red-500'
                      : !isDisabled
                      ? 'bg-emerald-500'
                      : 'bg-slate-400'
                  )}
                />
                <Text
                  className={cn(
                    'text-[10px] font-bold tracking-wide',
                    isSelected
                      ? 'text-white'
                      : isMaintenance
                      ? 'text-red-700 dark:text-red-400'
                      : !isDisabled
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {isMaintenance
                    ? 'Closed'
                    : isDisabled
                    ? 'Closed'
                    : isSelected
                    ? 'Selected'
                    : 'Available'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};
