import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Clock, Users, Star, ChevronRight } from 'lucide-react-native';
import { Amenity } from '../models/amenity.model';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';

export interface AmenityCardProps {
  amenity: Amenity;
  onPress: (amenity: Amenity) => void;
  className?: string;
}

export const AmenityCard: React.FC<AmenityCardProps> = ({ amenity, onPress, className }) => {
  const heroImage = amenity.imageUrls[0] || 'https://via.placeholder.com/400x250';

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => onPress(amenity)}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${amenity.name}`}
      className={cn(
        'mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm active:scale-[0.99]',
        className
      )}
      style={{ minHeight: 180 }}
    >
      {/* Hero Image Container */}
      <View className="relative h-44 w-full bg-muted">
        <Image
          source={{ uri: heroImage }}
          className="h-full w-full"
          resizeMode="cover"
        />

        {/* Top Badges Overlay */}
        <View className="absolute top-3 left-3 right-3 flex-row items-center justify-between">
          <View className="rounded-full bg-black/60 px-3 py-1 backdrop-blur-md">
            <Text className="text-xs font-semibold text-white">{amenity.category}</Text>
          </View>

          <StatusBadge
            label={amenity.isAvailableNow ? 'Available Now' : 'Booked Out'}
            variant={amenity.isAvailableNow ? 'success' : 'danger'}
            size="sm"
            dot={amenity.isAvailableNow}
          />
        </View>

        {/* Price Tag Overlay at Bottom Right of Image */}
        <View className="absolute bottom-3 right-3 rounded-xl bg-primary px-3 py-1.5 shadow-sm">
          <Text className="text-xs font-bold text-primary-foreground">
            ₹{amenity.pricePerHour}
            <Text className="text-[10px] font-normal opacity-90"> / hr</Text>
          </Text>
        </View>
      </View>

      {/* Card Content Body */}
      <View className="p-4">
        {/* Title and Rating Row */}
        <View className="flex-row items-center justify-between mb-1.5">
          <Text
            className="flex-1 text-lg font-bold text-foreground text-start me-2"
            numberOfLines={1}
          >
            {amenity.name}
          </Text>

          {amenity.rating && (
            <View className="flex-row items-center rounded-md bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 border border-amber-200 dark:border-amber-900">
              <Star size={13} color="#f59e0b" fill="#f59e0b" className="me-1" />
              <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                {amenity.rating}
              </Text>
            </View>
          )}
        </View>

        {/* Short Description */}
        <Text
          className="text-xs text-muted-foreground text-start mb-3 leading-4"
          numberOfLines={2}
        >
          {amenity.description}
        </Text>

        {/* Metadata Footer Row: Hours & Capacity */}
        <View className="flex-row items-center justify-between pt-2 border-t border-border/60">
          <View className="flex-row items-center me-3">
            <Clock size={14} className="text-muted-foreground me-1.5" color="#64748b" />
            <Text className="text-xs font-medium text-muted-foreground">
              {amenity.operatingHours.open} - {amenity.operatingHours.close}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Users size={14} className="text-muted-foreground me-1.5" color="#64748b" />
            <Text className="text-xs font-medium text-muted-foreground">
              Max {amenity.capacity} people
            </Text>
          </View>

          <ChevronRight size={18} color="#94a3b8" className="ms-auto" />
        </View>
      </View>
    </TouchableOpacity>
  );
};
