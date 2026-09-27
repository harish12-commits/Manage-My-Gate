import React from 'react';
import { View, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
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
  avatarFallback?: string;
  status?: string;
  className?: string;
  onAvatarPress?: () => void;
  showCameraBadge?: boolean;
  isAvatarLoading?: boolean;
  allowCalls?: boolean;
  onAllowCallsChange?: (value: boolean) => void;
}

/** A compact, editable profile hero which leaves the account fields below it. */
export const ProfileHeaderCard = ({
  name,
  unitName,
  roleName = 'Resident',
  avatarUrl,
  avatarFallback,
  className,
  onAvatarPress,
  showCameraBadge = false,
  isAvatarLoading = false,
  allowCalls = false,
  onAllowCallsChange,
}: ProfileHeaderCardProps) => {
  const { t, tRole } = useTranslation();
  const initialLetter = avatarFallback || (name ? name.charAt(0).toUpperCase() : 'U');
  const resolvedAvatarUrl = avatarUrl ? getImageUrl(avatarUrl) : null;

  return (
    <View className={cn('relative pb-2', className)}>
      <View className="h-36 rounded-[28px] bg-rose-300 overflow-hidden">
        <View className="absolute -right-10 -top-14 size-48 rounded-full bg-orange-200/50" />
        <View className="absolute -left-12 -bottom-16 size-44 rounded-full bg-rose-400/35" />
        <TouchableOpacity
          onPress={onAvatarPress}
          disabled={!onAvatarPress || isAvatarLoading}
          activeOpacity={0.85}
          className="absolute right-4 top-4 size-12 rounded-full bg-card/90 items-center justify-center shadow-sm"
          accessibilityRole={onAvatarPress ? 'button' : 'none'}
          accessibilityLabel={t('change_profile_photo', 'Change profile photo')}
        >
          <Camera size={22} className="text-foreground" strokeWidth={2.1} />
        </TouchableOpacity>
      </View>

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
          <Text className="flex-1 text-[25px] font-extrabold text-foreground tracking-tight" numberOfLines={1}>
            {name}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-bold text-foreground">
              {t('enable_calling', 'Enable calling')}
            </Text>
            <Switch
              value={allowCalls}
              onValueChange={onAllowCallsChange}
              disabled={!onAllowCallsChange}
              trackColor={{ false: '#D6D3D1', true: '#0F4C5C' }}
              thumbColor="#FFFFFF"
              accessibilityLabel={t('enable_calling', 'Enable calling')}
            />
          </View>
        </View>

        <View className="flex-row flex-wrap gap-x-5 gap-y-2">
          {unitName ? (
            <View className="flex-row items-center gap-2">
              <Building2 size={17} className="text-muted-foreground" />
              <Text className="text-sm font-medium text-muted-foreground">{unitName}</Text>
            </View>
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
