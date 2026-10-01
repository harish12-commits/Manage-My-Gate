import React from 'react';
import { View, TouchableOpacity, ActivityIndicator, Switch, Image } from 'react-native';
import { Text } from '@/components/ui/text';
import { Avatar } from '@/components/common/Avatar';
import { useTranslation } from '@/src/utils/i18n';
import { Building2, Camera, Home, Pencil } from 'lucide-react-native';
import { getImageUrl } from '@/src/utils/imageUrl';
import { cn } from '@/lib/utils';

export interface ProfileHeaderCardProps {
  name: string;
  email?: string;
  phone?: string;
  unitName?: string;
  roleName?: string;
  communityName?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  avatarFallback?: string;
  status?: string;
  className?: string;
  onAvatarPress?: () => void;
  onBannerPress?: () => void;
  onUnitPress?: () => void;
  showCameraBadge?: boolean;
  isAvatarLoading?: boolean;
}

/** A compact, editable profile hero which leaves the account fields below it. */
export const ProfileHeaderCard = ({
  name,
  unitName,
  roleName = 'Resident',
  avatarUrl,
  bannerUrl,
  avatarFallback,
  className,
  onAvatarPress,
  onBannerPress,
  onUnitPress,
  showCameraBadge = false,
  isAvatarLoading = false,
}: ProfileHeaderCardProps) => {
  const { t, tRole } = useTranslation();
  const initialLetter = avatarFallback || (name ? name.charAt(0).toUpperCase() : 'U');
  const resolvedAvatarUrl = avatarUrl ? getImageUrl(avatarUrl) : null;
  const resolvedBannerUrl = bannerUrl 
    ? getImageUrl(bannerUrl) 
    : 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop'; // Default aesthetic placeholder

  return (
    <View className={cn('relative pb-2', className)}>
      <TouchableOpacity 
        activeOpacity={0.9} 
        disabled={!onBannerPress}
        onPress={onBannerPress}
        className="h-36 rounded-[28px] overflow-hidden bg-muted relative"
      >
        <Image
          source={{ uri: resolvedBannerUrl }}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />
        {onBannerPress && (
          <View className="absolute right-4 top-4 size-10 rounded-full bg-black/40 items-center justify-center backdrop-blur-md border border-white/20">
            <Camera size={18} className="text-white" strokeWidth={2.1} />
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onAvatarPress}
        disabled={!onAvatarPress || isAvatarLoading}
        activeOpacity={0.85}
        className="absolute left-7 top-24"
        accessibilityRole={onAvatarPress ? 'button' : 'none'}
        accessibilityLabel={t('change_profile_photo', 'Change profile photo')}
      >
        <Avatar
          source={resolvedAvatarUrl ? { uri: resolvedAvatarUrl } : null}
          fallback={initialLetter}
          size="xl"
          style={{ width: 96, height: 96, borderRadius: 48 }}
          className="border-4 border-card bg-primary/80 shadow-sm"
          fallbackClassName="text-3xl text-primary-foreground"
        />
        {isAvatarLoading ? (
          <View className="absolute inset-0 rounded-full bg-black/45 items-center justify-center">
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        ) : showCameraBadge ? (
          <View className="absolute bottom-0 right-0 size-9 rounded-full bg-card border border-border items-center justify-center shadow-sm">
            <Pencil size={16} className="text-foreground" strokeWidth={2.3} />
          </View>
        ) : null}
      </TouchableOpacity>

      <View className="pt-14 px-1 gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <Text
            className="flex-1 text-[26px] font-extrabold font-bold text-foreground tracking-tight"
            style={{ fontWeight: 'bold' }}
            numberOfLines={1}
          >
            {name}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-x-5 gap-y-2">
          {unitName ? (
            <TouchableOpacity
              onPress={onUnitPress}
              disabled={!onUnitPress}
              activeOpacity={0.7}
              className="flex-row items-center gap-2"
              accessibilityRole={onUnitPress ? 'button' : 'none'}
              accessibilityLabel={onUnitPress ? t('switch_unit', 'Switch villa unit') : unitName}
            >
              <Building2 size={17} className="text-muted-foreground" />
              <Text className="text-sm font-medium text-muted-foreground">{unitName}</Text>
            </TouchableOpacity>
          ) : null}
          <View className="flex-row items-center gap-2">
            <Home size={17} className="text-muted-foreground" />
            <Text className="text-sm font-medium text-muted-foreground">{tRole(roleName, roleName)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ProfileHeaderCard;
