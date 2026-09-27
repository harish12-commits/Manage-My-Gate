import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '../ui/text';
import { SlidersHorizontal } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import FeatureIcon from '../ui/FeatureIcon';
import ActionTile from './ActionTile';
import { FeatureItem } from '../../src/features/dashboard/dashboardService';
import { useAuth } from '../../src/features/auth/hooks/useAuth';
import { ALL_AVAILABLE_FEATURES } from '../../src/features/dashboard/dashboardCatalog';
import { isFeatureAllowedForUser, getDefaultQuickActionsForUser } from '../../src/utils/rbac';
import { useTranslation } from '../../src/utils/i18n';

interface QuickActionsGridProps {
  activeFeatureIds?: string[];
  equippedFeatures?: FeatureItem[];
  onOpenCustomise: () => void;
  onTilePress?: (tileId: string) => void;
}

export const QuickActionsGrid: React.FC<QuickActionsGridProps> = ({
  activeFeatureIds,
  equippedFeatures: propEquippedFeatures,
  onOpenCustomise,
  onTilePress,
}) => {
  const { user } = useAuth();
  const { t, tFeatureName, tFeatureSubtitle, language } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Permitted features for the user's role (up to 7 cards, plus View More).
  const displayFeatures = React.useMemo(() => {
    // 1. If equipped features passed from hook, filter strictly to permitted items
    if (propEquippedFeatures && propEquippedFeatures.length > 0) {
      const allowed = propEquippedFeatures.filter((item) => isFeatureAllowedForUser(item, user));
      if (allowed.length > 0) {
        return allowed.slice(0, 7);
      }
    }

    const defaultIds = getDefaultQuickActionsForUser(user);
    const candidateIds = activeFeatureIds && activeFeatureIds.length > 0 ? activeFeatureIds : defaultIds;

    // 2. Filter candidate IDs strictly to permitted features only
    const allowedItems = candidateIds
      .map((id) => ALL_AVAILABLE_FEATURES.find((item) => item.id === id))
      .filter((item): item is typeof ALL_AVAILABLE_FEATURES[0] => Boolean(item) && isFeatureAllowedForUser(item!, user));

    if (allowedItems.length > 0) {
      return allowedItems.slice(0, 7);
    }

    // 3. Fallback strictly to default permitted items for this persona
    return defaultIds
      .map((id) => ALL_AVAILABLE_FEATURES.find((item) => item.id === id))
      .filter((item): item is typeof ALL_AVAILABLE_FEATURES[0] => Boolean(item) && isFeatureAllowedForUser(item!, user))
      .slice(0, 7);
  }, [propEquippedFeatures, activeFeatureIds, user, language]);

  return (
    <View className="gap-5 my-3">
      {/* Section Header with Customise Button */}
      <View className="flex-row items-center justify-between px-1">
        <Text
          style={{ fontFamily: 'HankenGrotesk_700Bold' }}
          className="text-[20px] font-bold text-foreground tracking-tight"
        >
          {t('quick_actions', 'Quick Actions')}
        </Text>

        <TouchableOpacity
          onPress={onOpenCustomise}
          activeOpacity={0.75}
          style={{
            backgroundColor: isDark ? 'rgba(30, 58, 138, 0.25)' : 'rgba(23, 43, 112, 0.08)',
            borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(23, 43, 112, 0.25)',
          }}
          className="flex-row min-h-11 items-center gap-1.5 border px-3.5 py-1.5 rounded-full shadow-2xs"
          accessibilityRole="button"
          accessibilityLabel={t('customise', 'Customise')}
        >
          <SlidersHorizontal size={13} color={isDark ? '#93C5FD' : '#172B70'} strokeWidth={2.4} />
          <Text className="text-[13px] font-bold text-[#172B70] dark:text-[#93C5FD]">{t('customise', 'Customise')}</Text>
        </TouchableOpacity>
      </View>

      {/* Four quick actions per row keeps the dashboard aligned with the customiser. */}
      <View className="flex-row flex-wrap justify-start gap-x-[2%] gap-y-4">
        {displayFeatures.map((tile) => {
          const meta = ALL_AVAILABLE_FEATURES.find((f) => f.id === tile.id);
          const iconName = meta?.iconName || tile.iconName;
          const colorIcon = meta?.colorIcon || tile.colorIcon || '#EA580C';
          const badge = meta?.badge || tile.badge;
          const badgeColor = meta?.badgeColor || tile.badgeColor;

          return (
            <ActionTile
              key={tile.id}
              containerClassName="w-[23.5%]"
              icon={<FeatureIcon iconName={iconName} color={colorIcon} size={30} strokeWidth={2.0} />}
              label={tFeatureName(tile.id, meta?.name || tile.name)}
              subtitle={tFeatureSubtitle(tile.id, meta?.subtitle || tile.subtitle)}
              metaValue={tFeatureSubtitle(tile.id, meta?.subtitle || tile.subtitle)}
              badge={badge}
              badgeColor={badgeColor}
              onPress={() => onTilePress && onTilePress(tile.id)}
            />
          );
        })}

      </View>
    </View>
  );
};

export default QuickActionsGrid;
