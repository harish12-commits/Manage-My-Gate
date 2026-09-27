/**
 * AmenityCatalogCard Component
 * Displays an Amenity Facility in the resident discovery catalog with cover image,
 * archetype badge, status pill with live pulsing dot, capacity chips, pricing summary,
 * and Book Now action button.
 * Fully supports AmenityFacility (Phase 6A/6B) and preserves backwards compatibility with legacy Amenity.
 */

import React from 'react';
import { View, Image, Pressable } from 'react-native';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { AmenityFacility, AmenityArchetype } from '../types/amenityDomain.types';
import { Amenity } from '../store/amenitySlice';
import {
  getArchetypeMeta,
  getFacilityStatusMeta,
  formatFacilityPricing,
  isFacilityBookable,
} from '../utils/amenityPresentation';
import { cn } from '@/lib/utils';
import {
  MapPin,
  Users,
  Clock,
  Timer,
  CalendarCheck,
  Building2,
  Wrench,
  DoorOpen,
  Sparkles,
} from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

export interface AmenityCatalogCardProps {
  amenity: AmenityFacility | Amenity;
  onPress: (amenity: any) => void;
  onBookClick?: (amenityId: string) => void;
}

export function AmenityCatalogCard({
  amenity,
  onPress,
  onBookClick,
}: AmenityCatalogCardProps) {
  const { t, translateText } = useTranslation();

  // Normalize facility fields
  const facility = amenity as AmenityFacility;
  const legacyAmenity = amenity as Amenity;

  const rawArchetype = facility.archetype || legacyAmenity.type || legacyAmenity.category || 'SHARED_CAPACITY';
  const archetypeMeta = getArchetypeMeta(rawArchetype as AmenityArchetype);

  const rawStatus = String(amenity.status || 'ACTIVE').toUpperCase();
  const statusMeta = getFacilityStatusMeta(rawStatus);
  const bookableCheck = isFacilityBookable(facility);

  // Pricing
  const pricingConfig = facility.pricingConfig;
  const pricingFormatted = pricingConfig
    ? formatFacilityPricing(pricingConfig)
    : {
        displayRate: legacyAmenity.bookingFee ? `₹${legacyAmenity.bookingFee}/slot` : 'Free Access',
        displayDeposit: '',
        pricingTypeLabel: legacyAmenity.pricing?.pricingType || 'hourly',
        isFree: !legacyAmenity.bookingFee,
      };

  // Image
  const imageUrl =
    (Array.isArray(amenity.images) && amenity.images.length > 0 ? amenity.images[0] : null) ||
    legacyAmenity.imageUrl ||
    '';

  // Capacity & specs
  const maxCapacity = facility.maxCapacity || legacyAmenity.capacity || 20;
  const maxHeadcount = facility.maxHeadcountPerReservation;
  const slotDuration = facility.slotDurationMinutes || legacyAmenity.bookingRules?.slotDurationMinutes || 60;

  // Operating Hours string summary
  let hoursDisplay = '08:00 - 22:00';
  if (Array.isArray(facility.operatingHours) && facility.operatingHours.length > 0) {
    const openDay = facility.operatingHours.find((h) => h.isOpen);
    if (openDay) {
      const openTime = (openDay as any).opensAt || (openDay as any).openTime || '08:00';
      const closeTime = (openDay as any).closesAt || (openDay as any).closeTime || '22:00';
      hoursDisplay = `${openTime} - ${closeTime}`;
    }
  } else if (legacyAmenity.openTime && legacyAmenity.closeTime) {
    hoursDisplay = `${legacyAmenity.openTime} - ${legacyAmenity.closeTime}`;
  }

  // Location
  const locationDisplay = legacyAmenity.location || 'Community Facilities';

  return (
    <View className="bg-card rounded-3xl border border-border/80 overflow-hidden mb-4 shadow-sm">
      {/* 1. Clickable Card Area */}
      <Pressable
        onPress={() => onPress(amenity)}
        accessibilityRole="button"
        accessibilityLabel={`View ${amenity.name} details`}
        className="active:opacity-95"
      >
        {/* Hero Cover Image with Floating Glass Badges */}
        <View className="h-40 w-full relative bg-muted overflow-hidden">
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full items-center justify-center bg-primary/10">
              <Building2 size={40} className="text-primary/50" />
            </View>
          )}

          {/* Top Badges Row */}
          <View className="absolute top-3 inset-x-3 flex-row justify-between items-center gap-2 z-10">
            {/* Archetype Pill */}
            <View className="flex-1 min-w-0 bg-black/60 px-2.5 py-1 rounded-full flex-row items-center gap-1.5 border border-white/20 shadow-xs">
              {rawArchetype === 'INVENTORY_TOOLS' ? (
                <Wrench size={11} color="#10b981" />
              ) : rawArchetype === 'ROOM_RESOURCE' ? (
                <DoorOpen size={11} color="#a855f7" />
              ) : (
                <Sparkles size={11} color="#f59e0b" />
              )}
              <Text className="flex-1 min-w-0 text-[11px] font-bold text-white uppercase tracking-wider" numberOfLines={1}>
                {translateText(archetypeMeta.label)}
              </Text>
            </View>

            {/* Status Badge with Live Pulsing Dot */}
            <StatusBadge
              label={statusMeta.label}
              variant={statusMeta.variant}
              dot={statusMeta.pulseDot}
              size="sm"
              className="shrink-0"
            />
          </View>

          {/* Bottom-End Price Tag Pill */}
          <View className="absolute bottom-2.5 end-2.5 z-10">
            <View className="bg-card/95 px-2.5 py-1 rounded-lg border border-border/70 shadow-sm flex-row items-center gap-1">
              <Text className="text-[10.5px] font-semibold text-muted-foreground">{t('fee', 'Fee')}:</Text>
              <Text className="text-[11.5px] font-extrabold text-primary">
                {pricingFormatted.displayRate}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Card Content & Metadata Body */}
        <View className="p-3.5 pb-2">
          {/* Title & Location */}
          <View className="mb-1.5">
            <Text className="text-base font-bold text-foreground tracking-tight" numberOfLines={2}>
              {translateText(amenity.name)}
            </Text>
            <View className="flex-row items-center gap-1 mt-0.5 min-w-0">
              <MapPin size={12} className="text-muted-foreground shrink-0" />
              <Text className="flex-1 min-w-0 text-xs font-medium text-muted-foreground" numberOfLines={1}>
                {translateText(locationDisplay)}
              </Text>
            </View>
          </View>

          {/* Optional Description Snippet */}
          {amenity.description ? (
            <Text numberOfLines={2} className="text-xs text-muted-foreground/90 leading-relaxed mb-3">
              {translateText(amenity.description)}
            </Text>
          ) : null}

          {/* Spec Chips Row */}
          <View className="flex-row flex-wrap items-center gap-2 pt-2.5 border-t border-border/40">
            {/* Capacity Chip */}
            <View className="flex-row items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-lg">
              <Users size={12} className="text-muted-foreground" />
              <Text className="text-[11px] font-semibold text-foreground">
                {t('max', 'Max')} {maxCapacity} {maxHeadcount ? `(Per res: ${maxHeadcount})` : t('persons', 'persons')}
              </Text>
            </View>

            {/* Operating Hours Chip */}
            <View className="flex-row items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-lg">
              <Clock size={12} className="text-muted-foreground" />
              <Text className="text-[11px] font-semibold text-foreground">
                {hoursDisplay}
              </Text>
            </View>

            {/* Slot Duration Chip */}
            <View className="flex-row items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-lg">
              <Timer size={12} className="text-muted-foreground" />
              <Text className="text-[11px] font-semibold text-foreground">
                {slotDuration}m {t('slots', 'slots')}
              </Text>
            </View>

            {/* Resource Indicator Chip for ROOM_RESOURCE / INVENTORY_TOOLS */}
            {rawArchetype === 'INVENTORY_TOOLS' ? (
              <View className="flex-row items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <Wrench size={11} className="text-emerald-600 dark:text-emerald-400" />
                <Text className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Tool Checkout
                </Text>
              </View>
            ) : rawArchetype === 'ROOM_RESOURCE' ? (
              <View className="flex-row items-center gap-1.5 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
                <DoorOpen size={11} className="text-purple-600 dark:text-purple-400" />
                <Text className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                  Room Resources
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* 3. Primary Action Footer CTA */}
      {onBookClick ? (
        <View className="px-3.5 pb-3.5 pt-1.5">
          <Button
            variant={bookableCheck.canBook ? 'default' : 'outline'}
            size="default"
            disabled={!bookableCheck.canBook}
            onPress={() => onBookClick(amenity._id)}
            className={cn(
              'w-full h-9 rounded-xl flex-row items-center justify-center gap-2 shadow-xs',
              bookableCheck.canBook && 'bg-emerald-600 active:bg-emerald-700 border-0'
            )}
            accessibilityRole="button"
            accessibilityLabel={`Book ${amenity.name}`}
          >
            <CalendarCheck
              size={15}
              className={bookableCheck.canBook ? 'text-white' : 'text-muted-foreground'}
            />
            <Text
              className={cn(
                'text-xs font-bold',
                bookableCheck.canBook ? 'text-white' : 'text-muted-foreground'
              )}
            >
              {rawStatus === 'MAINTENANCE'
                ? t('under_maintenance', 'Under Maintenance')
                : rawStatus === 'INACTIVE' || rawStatus === 'DECOMMISSIONED'
                ? t('facility_inactive', 'Facility Inactive')
                : t('reserve_book_slot', 'Reserve & Book Slot')}
            </Text>
          </Button>
        </View>
      ) : null}
    </View>
  );
}

export default AmenityCatalogCard;
