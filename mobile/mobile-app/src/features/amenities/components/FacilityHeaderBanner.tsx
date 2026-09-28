import React from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Clock, MapPin } from 'lucide-react-native';
import { cn } from '@/lib/utils';

export interface FacilityHeaderBannerProps {
  facilityName: string;
  category?: string;
  openTime?: string;
  closeTime?: string;
  location?: string;
  capacity?: number;
  bookingFee?: number;
  onBookPress?: () => void;
  bookButtonLabel?: string;
  className?: string;
}

export function FacilityHeaderBanner({
  facilityName,
  category,
  openTime,
  closeTime,
  location,
  capacity,
  bookingFee,
  onBookPress,
  bookButtonLabel = 'Book Slot',
  className,
}: FacilityHeaderBannerProps) {
  const hasOperatingHours = Boolean(openTime && closeTime);

  return (
    <View
      className={cn(
        'bg-card p-3.5 rounded-2xl border border-border flex-row items-center justify-between shadow-xs',
        className
      )}
    >
      <View className="flex-1 min-w-0 me-3">
        {/* Facility Title & Category */}
        <View className="flex-row items-center gap-1.5 flex-wrap">
          <Text variant="large" className="flex-shrink font-bold text-foreground" numberOfLines={2}>
            {facilityName}
          </Text>
          {Boolean(category) && (
            <View className="px-2 py-0.5 rounded-full bg-muted border border-border/60">
              <Text className="text-[10px] font-semibold text-muted-foreground uppercase">
                {category}
              </Text>
            </View>
          )}
        </View>

        {/* Operating Hours Snippet */}
        {hasOperatingHours && (
          <View className="flex-row items-center gap-1 mt-1">
            <Clock size={12} className="text-muted-foreground" />
            <Text variant="muted" className="text-xs text-muted-foreground">
              Operating: {openTime} - {closeTime}
            </Text>
          </View>
        )}

        {/* Location & Fee Snippet */}
        {(location || bookingFee !== undefined) && (
          <View className="flex-row items-center gap-2 mt-0.5 flex-wrap">
            {Boolean(location) && (
              <View className="flex-row items-center gap-1">
                <MapPin size={11} className="text-muted-foreground" />
                <Text variant="muted" className="flex-shrink text-[11px] text-muted-foreground" numberOfLines={1}>
                  {location}
                </Text>
              </View>
            )}
            {bookingFee !== undefined && (
              <Text className="text-[11px] font-semibold text-primary">
                {bookingFee === 0 ? 'Free Entry' : `₹${bookingFee}/slot`}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Primary CTA */}
      {onBookPress && (
        <Button
          variant="default"
          size="sm"
          onPress={onBookPress}
          className="shrink-0 rounded-full px-3.5"
          accessibilityLabel={`${bookButtonLabel} for ${facilityName}`}
        >
          <Text className="text-primary-foreground font-bold text-xs">
            {bookButtonLabel}
          </Text>
        </Button>
      )}
    </View>
  );
}

export default FacilityHeaderBanner;
