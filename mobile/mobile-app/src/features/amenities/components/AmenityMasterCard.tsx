import React from 'react';
import { View, Image, Pressable } from 'react-native';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { AmenityFacility } from '../types/amenityDomain.types';
import {
  getArchetypeMeta,
  getFacilityStatusMeta,
  formatFacilityPricing,
} from '../utils/amenityPresentation';
import {
  Users,
  Clock,
  Edit2,
  Power,
  Trash2,
  Building2,
  MapPin,
  Sparkles,
  Timer,
  DoorOpen,
  Wrench,
  ShieldCheck,
} from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/src/utils/i18n';

export interface AmenityMasterCardProps {
  item: AmenityFacility | any;
  onPress: (item: AmenityFacility) => void;
  onEdit: (item: AmenityFacility) => void;
  onToggleStatus: (item: AmenityFacility) => void;
  onDelete: (item: AmenityFacility) => void;
}

export const AmenityMasterCard: React.FC<AmenityMasterCardProps> = ({
  item,
  onPress,
  onEdit,
  onToggleStatus,
  onDelete,
}) => {
  const { t, translateText } = useTranslation();
  const archetypeMeta = getArchetypeMeta(item.archetype || item.type || item.category);
  const statusMeta = getFacilityStatusMeta(item.status);
  const isActive = statusMeta.status === 'ACTIVE' || item.isActive === true;

  const pricingInfo = formatFacilityPricing(
    item.pricingConfig || {
      type: item.bookingFee ? 'HOURLY' : 'FREE',
      baseRate: item.bookingFee || 0,
      depositAmount: item.securityDeposit || 0,
      currency: 'INR',
    }
  );

  const slotDuration = item.slotDurationMinutes || item.bookingRules?.slotDurationMinutes || 60;
  const bufferTime = item.setupBufferMinutes || item.bookingRules?.bufferTimeMinutes || 0;
  const capacity = item.maxCapacity || item.capacity || 1;
  const maxHeadcount = item.maxHeadcountPerReservation || item.maxBookingsPerUserPerSlot || 1;

  const openTime =
    item.bookingRules?.openTime ||
    item.openTime ||
    (item.operatingHours?.[0]?.openTime || item.operatingHours?.[0]?.opensAt) ||
    '06:00';
  const closeTime =
    item.bookingRules?.closeTime ||
    item.closeTime ||
    (item.operatingHours?.[0]?.closeTime || item.operatingHours?.[0]?.closesAt) ||
    '22:00';

  const imageUrl =
    item.imageUrl || (Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : '');

  const requiresApproval =
    Boolean(item.requiresApproval) || Boolean(item.bookingRules?.requiresApproval);

  const renderArchetypeIcon = () => {
    switch (archetypeMeta.archetype) {
      case 'EXCLUSIVE_HOURLY':
        return <Timer size={11} color="#818cf8" />;
      case 'EVENT_SPACE':
        return <Sparkles size={11} color="#fbbf24" />;
      case 'ROOM_RESOURCE':
        return <DoorOpen size={11} color="#c084fc" />;
      case 'INVENTORY_TOOLS':
        return <Wrench size={11} color="#34d399" />;
      default:
        return <Users size={11} color="#60a5fa" />;
    }
  };

  return (
    <View className="bg-card rounded-3xl border border-border/80 overflow-hidden mb-4 shadow-sm">
      {/* 1. Clickable Card Area: Hero Cover Image & Facility Details */}
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`View ${item.name} master details`}
        className="active:opacity-95"
      >
        {/* Hero Cover Image Header */}
        <View className="h-44 w-full relative bg-muted overflow-hidden">
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center bg-primary/10">
              <Building2 size={44} className="text-primary/50" />
            </View>
          )}

          {/* Top Badges Row */}
          <View className="absolute top-3 inset-x-3 flex-row justify-between items-center gap-2 z-10">
            {/* Canonical Archetype Pill */}
            <View className="flex-1 min-w-0 bg-black/75 px-3 py-1 rounded-full flex-row items-center gap-1.5 border border-white/20 shadow-xs">
              {renderArchetypeIcon()}
              <Text className="flex-1 min-w-0 text-xs font-bold text-white uppercase tracking-wider" numberOfLines={1}>
                {translateText(archetypeMeta.label)}
              </Text>
            </View>

            {/* Status Badge with Live Pulsing Dot */}
            <StatusBadge
              label={translateText(statusMeta.label)}
              variant={statusMeta.variant}
              dot={statusMeta.pulseDot}
              className="shrink-0"
            />
          </View>

          {/* Facility Code Chip */}
          {item.code ? (
            <View className="absolute bottom-3 left-3 z-10">
              <View className="bg-black/70 px-2.5 py-1 rounded-lg border border-white/15 shadow-xs">
                <Text className="text-[10px] font-mono font-bold text-white tracking-widest">
                  {item.code}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Bottom-Right Price Tag Pill on Image */}
          <View className="absolute bottom-3 right-3 z-10">
            <View className="bg-card/95 px-3 py-1.5 rounded-xl border border-border/70 shadow-sm flex-row items-center gap-1">
              <Text className="text-[11px] font-semibold text-muted-foreground">{t('fee', 'Fee')}:</Text>
              <Text className="text-xs font-extrabold text-primary">
                {pricingInfo.displayRate}
              </Text>
            </View>
          </View>
        </View>

        {/* Card Content & Metadata Body */}
        <View className="p-4 pb-3">
          {/* Title & Location */}
          <View className="mb-2">
            <Text className="text-lg font-extrabold text-foreground tracking-tight shrink truncate" numberOfLines={1}>
              {translateText(item.name)}
            </Text>
            <View className="flex-row items-center gap-1 mt-1">
              <MapPin size={13} className="text-muted-foreground shrink-0" />
              <Text className="text-xs font-medium text-muted-foreground shrink truncate" numberOfLines={1}>
                {translateText(item.location || 'Community Facilities')}
              </Text>
            </View>
          </View>

          {/* Spec Chips Row */}
          <View className="flex-row flex-wrap items-center gap-2 pt-2.5 border-t border-border/40">
            {/* Archetype Short Pill */}
            <View className={cn('flex-row items-center gap-1 px-2 py-1 rounded-lg', archetypeMeta.badgeBg)}>
              <Text className={cn('text-[11px] font-bold', archetypeMeta.badgeText)}>
                {translateText(archetypeMeta.shortLabel)}
              </Text>
            </View>

            {/* Capacity & Headcount */}
            <View className="flex-row items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-lg">
              <Users size={12} className="text-muted-foreground" />
              <Text className="text-[11px] font-semibold text-foreground">
                {t('cap', 'Cap')}: {capacity} ({t('max', 'Max')}: {maxHeadcount})
              </Text>
            </View>

            {/* Hours */}
            <View className="flex-row items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-lg">
              <Clock size={12} className="text-muted-foreground" />
              <Text className="text-[11px] font-semibold text-foreground">
                {openTime} - {closeTime}
              </Text>
            </View>

            {/* Duration */}
            <View className="flex-row items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-lg">
              <Timer size={12} className="text-muted-foreground" />
              <Text className="text-[11px] font-semibold text-foreground">
                {item.pricingConfig?.type === 'DAILY' ? t('full_day', 'Full Day') : `${slotDuration}${t('mins_unit', 'm')}`}
                {bufferTime > 0 ? ` (+${bufferTime}${t('mins_unit', 'm')})` : ''}
              </Text>
            </View>

            {/* Approval Required Badge */}
            {requiresApproval ? (
              <View className="flex-row items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-lg">
                <ShieldCheck size={11} className="text-amber-600 dark:text-amber-400" />
                <Text className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  {t('approval_req', 'Approval Req.')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* 2. Admin Action Controls Row */}
      <View className="flex-row items-center justify-between gap-2 px-4 pb-4 pt-3 border-t border-border/40">
        <Button
          variant="edit"
          size="sm"
          onPress={() => onEdit(item)}
          className="flex-1 flex-row items-center justify-center gap-1.5 h-9 rounded-xl"
          accessibilityLabel={`Edit ${item.name}`}
        >
          <Edit2 size={13} color="#059669" />
          <Text>{t('edit', 'Edit')}</Text>
        </Button>

        <Button
          variant={isActive ? 'warning' : 'info'}
          size="sm"
          onPress={() => onToggleStatus(item)}
          className="flex-1 flex-row items-center justify-center gap-1.5 h-9 rounded-xl"
          accessibilityLabel={isActive ? `Deactivate ${item.name}` : `Activate ${item.name}`}
        >
          <Power size={13} color={isActive ? '#d97706' : '#245fa8'} />
          <Text>{isActive ? t('deactivate', 'Deactivate') : t('activate', 'Activate')}</Text>
        </Button>

        <Button
          variant="destructive-outline"
          size="sm"
          onPress={() => onDelete(item)}
          className="flex-1 flex-row items-center justify-center gap-1.5 h-9 rounded-xl"
          accessibilityLabel={`Delete ${item.name}`}
        >
          <Trash2 size={13} color="#e11d48" />
          <Text>{t('delete', 'Delete')}</Text>
        </Button>
      </View>
    </View>
  );
};

export default AmenityMasterCard;
