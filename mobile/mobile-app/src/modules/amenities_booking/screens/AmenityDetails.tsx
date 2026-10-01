import React, { useState, useMemo } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Clock,
  Users,
  MapPin,
  Star,
  CheckCircle2,
  ShieldCheck,
  Share2,
  Heart,
} from 'lucide-react-native';
import { Amenity } from '../models/amenity.model';
import { BookingSlot } from '../models/booking.model';
import { generateMockSlots } from '../data/mockAmenitiesData';
import { TimeSlotPicker } from '../components/TimeSlotPicker';
import { StickyBottomCTA } from '../components/StickyBottomCTA';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Text } from '@/components/ui/text';

export interface AmenityDetailsProps {
  amenity: Amenity;
  onBack?: () => void;
  onBookingConfirmed?: (bookingDetails: {
    amenity: Amenity;
    date: string;
    slots: BookingSlot[];
    totalPrice: number;
  }) => void;
}

export const AmenityDetails: React.FC<AmenityDetailsProps> = ({
  amenity,
  onBack,
  onBookingConfirmed,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
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

  const handleDateChange = (newDateStr: string) => {
    setSelectedDate(newDateStr);
    setSelectedSlotIds([]); // Reset slot selection when date changes
  };

  const handleReservePress = () => {
    if (selectedSlots.length === 0) return;
    setIsConfirmModalOpen(true);
  };

  const handleConfirmReservation = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsConfirmModalOpen(false);

      const totalPrice = selectedSlots.length * amenity.pricePerHour;
      const bookingData = {
        amenity,
        date: selectedDate,
        slots: selectedSlots,
        totalPrice,
      };

      if (onBookingConfirmed) {
        onBookingConfirmed(bookingData);
      } else {
        Alert.alert(
          'Reservation Confirmed! 🎉',
          `Your slot for ${amenity.name} on ${selectedDate} (${selectedSlots.map((s) => s.startTime).join(', ')}) has been reserved.`,
          [{ text: 'Great!', onPress: () => onBack?.() }]
        );
      }
    }, 1000);
  };

  const heroImage = amenity.imageUrls[0] || 'https://via.placeholder.com/600x400';

  return (
    <View className="flex-1 bg-background relative">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Large Hero Image Top Section */}
        <View className="relative h-72 w-full bg-muted">
          <Image
            source={{ uri: heroImage }}
            className="h-full w-full"
            resizeMode="cover"
          />

          {/* Floating Navigation Header Actions */}
          <View className="absolute top-12 left-4 right-4 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Go back to catalog"
              className="h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
            >
              <ArrowLeft size={20} color="#ffffff" />
            </TouchableOpacity>

            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => setIsFavorited(!isFavorited)}
                activeOpacity={0.8}
                className="h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
                accessibilityLabel="Bookmark facility"
              >
                <Heart
                  size={20}
                  color={isFavorited ? '#ef4444' : '#ffffff'}
                  fill={isFavorited ? '#ef4444' : 'none'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                className="h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
                accessibilityLabel="Share facility details"
              >
                <Share2 size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Category Pill Overlay */}
          <View className="absolute bottom-4 left-4 flex-row items-center">
            <View className="rounded-full bg-black/60 px-3.5 py-1.5 backdrop-blur-md me-2">
              <Text className="text-xs font-bold text-white">{amenity.category}</Text>
            </View>
            <StatusBadge
              label={amenity.isAvailableNow ? 'Open Now' : 'Closed Now'}
              variant={amenity.isAvailableNow ? 'success' : 'neutral'}
              size="md"
              dot={amenity.isAvailableNow}
            />
          </View>
        </View>

        {/* Details Content Container */}
        <View className="px-5 pt-5">
          {/* Title & Price Header */}
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1 me-3">
              <Text className="text-2xl font-black text-foreground text-start">
                {amenity.name}
              </Text>

              {amenity.location && (
                <View className="flex-row items-center mt-1">
                  <MapPin size={14} color="#64748b" className="me-1" />
                  <Text className="text-xs font-medium text-muted-foreground me-1">
                    {amenity.location}
                  </Text>
                </View>
              )}
            </View>

            <View className="items-end">
              <Text className="text-2xl font-black text-primary">₹{amenity.pricePerHour}</Text>
              <Text className="text-[10px] text-muted-foreground">per hour</Text>
            </View>
          </View>

          {/* Quick Info Badges Row */}
          <View className="flex-row items-center gap-3 my-3 p-3 rounded-2xl bg-card border border-border">
            {amenity.rating && (
              <View className="flex-row items-center pe-3 border-e border-border">
                <Star size={16} color="#f59e0b" fill="#f59e0b" className="me-1.5" />
                <View>
                  <Text className="text-xs font-bold text-foreground">{amenity.rating} / 5.0</Text>
                  <Text className="text-[10px] text-muted-foreground">
                    {amenity.reviewCount} reviews
                  </Text>
                </View>
              </View>
            )}

            <View className="flex-row items-center pe-3 border-e border-border">
              <Clock size={16} color="#2563eb" className="me-1.5" />
              <View>
                <Text className="text-xs font-bold text-foreground">Hours</Text>
                <Text className="text-[10px] text-muted-foreground">
                  {amenity.operatingHours.open} - {amenity.operatingHours.close}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <Users size={16} color="#16a34a" className="me-1.5" />
              <View>
                <Text className="text-xs font-bold text-foreground">Capacity</Text>
                <Text className="text-[10px] text-muted-foreground">{amenity.capacity} Max</Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View className="my-3">
            <Text className="text-sm font-bold text-foreground mb-1">About Facility</Text>
            <Text className="text-xs leading-5 text-muted-foreground text-start">
              {amenity.description}
            </Text>
          </View>

          {/* Key Features & Amenities */}
          {amenity.features && amenity.features.length > 0 && (
            <View className="my-3">
              <Text className="text-sm font-bold text-foreground mb-2">Features & Services</Text>
              <View className="flex-row flex-wrap gap-2">
                {amenity.features.map((feature, idx) => (
                  <View
                    key={idx}
                    className="flex-row items-center rounded-xl bg-card border border-border px-3 py-1.5"
                  >
                    <CheckCircle2 size={13} color="#16a34a" className="me-1.5" />
                    <Text className="text-xs font-medium text-foreground">{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Rules & Guidelines */}
          {amenity.rules && amenity.rules.length > 0 && (
            <View className="my-3 rounded-2xl bg-amber-500/10 p-4 border border-amber-500/20">
              <View className="flex-row items-center mb-2">
                <ShieldCheck size={16} color="#d97706" className="me-2" />
                <Text className="text-xs font-bold text-amber-800 dark:text-amber-400">
                  Facility Rules & Guidelines
                </Text>
              </View>
              {amenity.rules.map((rule, idx) => (
                <Text
                  key={idx}
                  className="text-xs text-amber-900/80 dark:text-amber-300 text-start mb-1"
                >
                  • {rule}
                </Text>
              ))}
            </View>
          )}

          {/* Divider */}
          <View className="h-[1px] bg-border my-5" />

          {/* Time Slot Picker Component */}
          <TimeSlotPicker
            slots={slotsForDate}
            selectedSlotIds={selectedSlotIds}
            onToggleSlot={handleToggleSlot}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            pricePerHour={amenity.pricePerHour}
          />
        </View>
      </ScrollView>

      {/* Fixed Sticky Bottom CTA Footer */}
      <StickyBottomCTA
        pricePerHour={amenity.pricePerHour}
        selectedSlotsCount={selectedSlots.length}
        onReserve={handleReservePress}
        isLoading={isSubmitting}
      />

      {/* Booking Confirmation Dialog Modal */}
      <ConfirmationModal
        visible={isConfirmModalOpen}
        onCancel={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmReservation}
        title="Confirm Slot Reservation"
        message={`Are you sure you want to reserve ${selectedSlots.length} slot(s) for ${amenity.name} on ${selectedDate} for a total of ₹${selectedSlots.length * amenity.pricePerHour}?`}
        confirmLabel="Confirm Reservation"
        cancelLabel="Review Slots"
        variant="info"
        loading={isSubmitting}
      />
    </View>
  );
};
