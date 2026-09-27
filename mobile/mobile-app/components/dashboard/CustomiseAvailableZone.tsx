import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '../ui/text';
import { Star } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import FeatureIcon from '../ui/FeatureIcon';
import { ALL_AVAILABLE_FEATURES, AppFeatureItem } from '../../src/features/dashboard/dashboardCatalog';
import { useTranslation } from '../../src/utils/i18n';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

export type AvailableFeatureCardItem = AppFeatureItem;

export interface CustomiseAvailableZoneProps {
  features: AvailableFeatureCardItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
}

interface AvailableFeatureCardProps {
  feature: AvailableFeatureCardItem;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

const AvailableFeatureCard: React.FC<AvailableFeatureCardProps> = React.memo(({
  feature,
  isSelected,
  onToggleSelect,
}) => {
  const { t, tFeatureName } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const meta = ALL_AVAILABLE_FEATURES.find((item) => item.id === feature.id);
  const iconName = meta?.iconName || feature.iconName;
  const colorIcon = meta?.colorIcon || feature.colorIcon || '#245FA8';
  const colorBg = meta?.colorBg || feature.colorBg || 'bg-secondary';

  const tapGesture = useMemo(
    () => Gesture.Tap().runOnJS(true).onEnd(() => onToggleSelect(feature.id)),
    [feature.id, onToggleSelect]
  );

  return (
    <View className="w-1/4 px-1.5 pb-4">
      <GestureDetector gesture={tapGesture}>
        <View
          className="relative items-center"
          accessibilityRole="button"
          accessibilityLabel={`${meta?.name || feature.name}, ${isSelected ? 'Pinned quick action' : 'Add to quick actions'}`}
        >
          <View
            style={{ backgroundColor: isDark ? '#262626' : '#FFFFFF' }}
            className={`h-[88px] w-full items-center justify-center rounded-[22px] border ${
              isSelected ? 'border-amber-400 shadow-xs' : 'border-border/65'
            }`}
          >
            <View className={`size-12 items-center justify-center rounded-[17px] border border-border/40 ${colorBg}`}>
              <FeatureIcon iconName={iconName} color={colorIcon} size={24} strokeWidth={1.9} />
            </View>
          </View>

          {isSelected ? (
            <View className="absolute -right-1.5 -top-1.5 size-7 rounded-full bg-amber-500 items-center justify-center border-2 border-card z-10">
              <Star size={13} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          ) : null}

          <Text
            className={`mt-2 min-h-[30px] text-[11px] font-semibold text-center leading-tight ${
              isSelected ? 'text-foreground' : 'text-muted-foreground'
            }`}
            numberOfLines={2}
          >
            {tFeatureName(feature.id, meta?.name || feature.name)}
          </Text>
        </View>
      </GestureDetector>
    </View>
  );
});

/** One selectable catalogue: starred tiles are the current first seven Quick Actions. */
export const CustomiseAvailableZone: React.FC<CustomiseAvailableZoneProps> = ({
  features,
  selectedIds,
  onToggleSelect,
}) => {
  return (
    <View className="px-3.5 pt-5 pb-2">
      <View className="flex-row flex-wrap -mx-1.5">
        {features.map((feature) => (
          <AvailableFeatureCard
            key={feature.id}
            feature={feature}
            isSelected={selectedIds.includes(feature.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </View>
    </View>
  );
};

export default CustomiseAvailableZone;
