import React, { useState, useMemo } from 'react';
import {
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronLeft, Calendar as CalendarIcon } from 'lucide-react-native';
import { Amenity } from '../models/amenity.model';
import { BookingSlot } from '../models/booking.model';
import { generateMockSlots, MOCK_AMENITIES } from '../data/mockAmenitiesData';
import { TimeSlotPicker } from '../components/TimeSlotPicker';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

export interface AmenityBookingModalProps {
  amenity?: Amenity;
  onBack?: () => void;
  onProceedToCheckout?: (selectedSlots: BookingSlot[], totalPrice: number) => void;
}

export const AmenityBookingModal: React.FC<AmenityBookingModalProps> = ({
  amenity: passedAmenity,
  onBack,
  onProceedToCheckout,
}) => {
  const amenity = passedAmenity || {
    id: 'default',
    name: 'Amenity',
    category: 'Facility',
    description: '',
    location: '',
    pricePerHour: 0,
    isActive: true,
  };

  const defaultDate = '13/08/2026';
  const isoDate = '2026-08-13';

  const [selectedDate, setSelectedDate] = useState<string>(isoDate);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate dynamic mock time slots for the selected date
  const slotsForDate = useMemo(() => {
    return generateMockSlots(amenity.id, selectedDate);
  }, [amenity.id, selectedDate]);

  // Handle slot toggle selection
  const handleToggleSlot = (slot: BookingSlot) => {
    setSelectedSlotIds((prev) =>
      prev.includes(slot.id)
        ? prev.filter((id) => id !== slot.id)
        : [...prev, slot.id]
    );
  };

  // Get selected slot objects
  const selectedSlots = useMemo(() => {
    return slotsForDate.filter((slot) => selectedSlotIds.includes(slot.id));
  }, [slotsForDate, selectedSlotIds]);

  const slotPrice = amenity.pricePerHour || 500;
  const totalPrice = selectedSlots.length > 0 ? selectedSlots.length * slotPrice : 0;

  const handleCheckout = () => {
    if (selectedSlots.length === 0) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);

      if (onProceedToCheckout) {
        onProceedToCheckout(selectedSlots, totalPrice);
      } else {
        Alert.alert(
          'Proceeding to Checkout',
          `Selected ${selectedSlots.length} slot(s) for ${amenity.name} on ${defaultDate}. Total: ₹${totalPrice}`,
          [{ text: 'OK', onPress: () => onBack?.() }]
        );
      }
    }, 800);
  };

  return (
    <View className="flex-1 bg-slate-100 dark:bg-slate-950 items-center justify-center p-2 sm:p-4">
      {/* Mobile Phone Card Shell Container matching Image 1 */}
      <View className="w-full max-w-md flex-1 rounded-3xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header Bar matching Image 1 */}
        <View className="flex-row items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-4 py-3.5 bg-white dark:bg-slate-900">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.7}
              className="p-1 me-2 rounded-lg"
              accessibilityLabel="Go back"
            >
              <ChevronLeft size={20} color="#0f172a" />
            </TouchableOpacity>

            <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 me-3">
              <CalendarIcon size={18} color="#334155" />
            </View>

            <View>
              <Text className="text-base font-extrabold text-slate-900 dark:text-white">
                {amenity.name}
              </Text>
              <Text className="text-xs font-semibold text-slate-400">
                {amenity.category || 'Workspace'}
              </Text>
            </View>
          </View>
        </View>

        {/* Scrollable Screen Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          className="flex-1"
        >
          {/* Top Summary Card matching Image 1 */}
          <View className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-lg font-black text-slate-900 dark:text-white">
                {amenity.name}
              </Text>
              <View className="rounded-full bg-[#dcfce7] dark:bg-emerald-950/60 px-3 py-0.5">
                <Text className="text-xs font-bold text-[#059669] dark:text-emerald-400">
                  active
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <Text className="text-xs font-medium text-slate-400 flex-1 me-2" numberOfLines={1}>
                Location: {amenity.location || 'Block A Floor 1 Near'}
              </Text>
              <Text className="text-xs font-extrabold text-slate-900 dark:text-white">
                Rate: ₹{slotPrice}/slot
              </Text>
            </View>
          </View>

          {/* Booking Date Input Box matching Image 1 */}
          <View className="mb-5">
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Booking Date
            </Text>
            <View className="flex-row items-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5">
              <CalendarIcon size={18} color="#64748b" className="me-3" />
              <Text className="text-sm font-bold text-slate-900 dark:text-white">
                {defaultDate}
              </Text>
            </View>
          </View>

          {/* Select Time Slot Section Header */}
          <Text className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            Select Time Slot
          </Text>

          {/* 2-Column Time Slot Grid matching Image 2 */}
          <TimeSlotPicker
            slots={slotsForDate}
            selectedSlotIds={selectedSlotIds}
            onToggleSlot={handleToggleSlot}
            pricePerHour={slotPrice}
          />
        </ScrollView>

        {/* Bottom Full-Width Checkout Button matching Image 1 */}
        <View className="border-t border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
          <TouchableOpacity
            disabled={selectedSlots.length === 0 || isSubmitting}
            onPress={handleCheckout}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Proceed to Checkout"
            className={cn(
              'w-full min-h-[52px] items-center justify-center rounded-2xl py-3.5 transition-all shadow-md',
              selectedSlots.length > 0
                ? 'bg-slate-900 dark:bg-white active:scale-[0.99]'
                : 'bg-slate-400 dark:bg-slate-700 opacity-80'
            )}
          >
            <Text
              className={cn(
                'text-sm font-extrabold tracking-wide',
                selectedSlots.length > 0
                  ? 'text-white dark:text-slate-900'
                  : 'text-slate-200 dark:text-slate-400'
              )}
            >
              {selectedSlots.length > 0
                ? `Proceed to Checkout (₹${totalPrice.toFixed(2)})`
                : 'Select a Time Slot'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
