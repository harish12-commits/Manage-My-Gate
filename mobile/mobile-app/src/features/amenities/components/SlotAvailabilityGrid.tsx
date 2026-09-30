import React from 'react';
import { View, Pressable } from 'react-native';
import { Clock, Check } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AmenitySlot } from '../store/amenitySlice';
import { formatTimeRange12Hour } from '../utils/amenityStateHelpers';
import { cn } from '@/lib/utils';

export interface SlotAvailabilityGridProps {
  slots: AmenitySlot[];
  selectedSlot?: AmenitySlot | null;
  onSlotSelect?: (slot: AmenitySlot) => void;
  onBookSlot?: (slot: AmenitySlot) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  className?: string;
  selectedDate?: string;
}

export function SlotAvailabilityGrid({
  slots,
  selectedSlot,
  onSlotSelect,
  onBookSlot,
  loading = false,
  emptyTitle = 'No Slots Available',
  emptySubtitle = 'No operational time slots found for the selected date.',
  className,
  selectedDate,
}: SlotAvailabilityGridProps) {
  if (loading) {
    return (
      <View className="py-8 items-center justify-center">
        <Text variant="muted" className="text-xs text-muted-foreground">
          Checking available hourly slots...
        </Text>
      </View>
    );
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isToday = selectedDate ? selectedDate === todayStr : false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const visibleSlots = (slots || []).filter((slot) => {
    if (!slot) return false;
    if (slot.status?.toLowerCase() === 'closed') return false;

    if (isToday && slot.startTime) {
      const [startH = 0, startM = 0] = slot.startTime.split(':').map(Number);
      const slotStartMinutes = startH * 60 + startM;
      if (slotStartMinutes <= currentMinutes) {
        return false;
      }
    }

    return true;
  });

  if (visibleSlots.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title={emptyTitle}
        description={emptySubtitle}
        className="my-4"
      />
    );
  }

  return (
    <View className={cn('gap-2.5', className)}>
      <View className="flex-row flex-wrap justify-between gap-y-2.5">
        {visibleSlots.map((slot, index) => {
          const slotStartTime = slot?.startTime || '00:00';
          const slotEndTime = slot?.endTime || '00:00';
          const slotId = slot?._id || `${slotStartTime}-${slotEndTime}-${index}`;
          const isSelected =
            selectedSlot &&
            ((selectedSlot._id && slot?._id && selectedSlot._id === slot._id) ||
              (selectedSlot?.startTime === slotStartTime && selectedSlot?.endTime === slotEndTime));

          const availableCount =
            slot?.availableCount !== undefined
              ? slot.availableCount
              : slot?.capacity
              ? Math.max(0, slot.capacity - (slot.bookedCount || 0))
              : 1;

          const isAvailable =
            slot?.isAvailable !== undefined
              ? slot.isAvailable
              : slot?.status
              ? slot.status === 'Available' || slot.status === 'AVAILABLE'
              : availableCount > 0;

          return (
            <Pressable
              key={slotId}
              disabled={!isAvailable && !onSlotSelect}
              onPress={() => onSlotSelect && onSlotSelect(slot)}
              accessibilityRole={onBookSlot ? undefined : 'button'}
              accessibilityLabel={`Time slot ${slotStartTime} to ${slotEndTime}. ${
                isAvailable ? `Available with capacity ${availableCount}` : 'Booked or unavailable'
              }`}
              className={cn(
                'w-[48.5%] rounded-2xl p-3 border flex-col justify-between min-h-[96px] active:scale-[0.98] transition-all bg-card shadow-xs',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : isAvailable
                  ? 'border-border active:border-primary/50'
                  : 'border-border/60 bg-muted/30 opacity-70'
              )}
            >
              {/* Header: Time Window & Selection Indicator */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Clock
                    size={13}
                    className={
                      isSelected
                        ? 'text-primary'
                        : isAvailable
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }
                  />
                  <Text
                    className={cn(
                      'text-xs font-bold',
                      isSelected
                        ? 'text-primary'
                        : isAvailable
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {formatTimeRange12Hour(slotStartTime, slotEndTime)}
                  </Text>
                </View>

                {isSelected && (
                  <View className="w-4 h-4 rounded-full bg-primary items-center justify-center">
                    <Check size={10} className="text-primary-foreground" />
                  </View>
                )}
              </View>

              {/* Status Badge & Capacity Footnote */}
              <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border/40">
                <StatusBadge
                  label={isAvailable ? 'AVAILABLE' : 'BOOKED'}
                  variant={isAvailable ? 'success' : 'danger'}
                  size="sm"
                />

                <Text variant="muted" className="text-[11px] font-medium text-muted-foreground">
                  {isAvailable ? `${availableCount} Left` : 'Full'}
                </Text>
              </View>

              {/* Optional Quick Book Button */}
              {onBookSlot && isAvailable && (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    onBookSlot(slot);
                  }}
                  className="mt-2 h-7 py-0.5 border-primary/30 bg-primary/5"
                  accessibilityLabel={`Book ${slot.startTime} to ${slot.endTime}`}
                >
                  <Text className="text-[11px] font-bold text-primary">Book</Text>
                </Button>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default SlotAvailabilityGrid;
