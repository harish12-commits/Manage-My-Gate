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
  onDragStart?: (feature: AvailableFeatureCardItem, absoluteX: number, absoluteY: number) => void;
  onDragMove?: (absoluteX: number, absoluteY: number) => void;
  onDragEnd?: (feature: AvailableFeatureCardItem, absoluteX: number, absoluteY: number) => void;
}

interface AvailableFeatureCardProps {
  feature: AvailableFeatureCardItem;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDragStart?: (feature: AvailableFeatureCardItem, absoluteX: number, absoluteY: number) => void;
  onDragMove?: (absoluteX: number, absoluteY: number) => void;
  onDragEnd?: (feature: AvailableFeatureCardItem, absoluteX: number, absoluteY: number) => void;
}

const AvailableFeatureCard: React.FC<AvailableFeatureCardProps> = React.memo(({
  feature,
  isSelected,
  onToggleSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}) => {
  const { t, tFeatureName, language } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const meta = ALL_AVAILABLE_FEATURES.find((f) => f.id === feature.id);
  const iconName = meta?.iconName || feature.iconName;
  const colorIcon = meta?.colorIcon || feature.colorIcon || '#245FA8';
  const colorBg = meta?.colorBg || feature.colorBg || 'bg-secondary';

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd(() => {
          onToggleSelect(feature.id);
        }),
    [feature.id, onToggleSelect]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activateAfterLongPress(160)
        .onStart((e) => {
          onDragStart?.(feature, e.absoluteX, e.absoluteY);
        })
        .onUpdate((e) => {
          onDragMove?.(e.absoluteX, e.absoluteY);
        })
        .onEnd((e) => {
          onDragEnd?.(feature, e.absoluteX, e.absoluteY);
        })
        .onFinalize(() => {
          onDragEnd?.(feature, -1, -1);
        }),
    [feature, onDragStart, onDragMove, onDragEnd]
  );

  const composedGesture = useMemo(
    () => Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture]
  );

  return (
    <View className="w-1/4 px-1">
      <GestureDetector gesture={composedGesture}>
        <View
          style={{ backgroundColor: isDark ? '#262626' : '#FFFFFF' }}
          className={`relative h-[112px] p-2 rounded-2xl border items-center justify-between ${
            isSelected
              ? 'border-primary/60 shadow-xs'
              : 'border-border/80 shadow-xs'
          }`}
          accessibilityRole="button"
          accessibilityLabel={`${meta?.name || feature.name}, ${isSelected ? 'Added' : 'Tap or Drag to Add'}`}
        >
          {isSelected ? (
            <View className="absolute -right-1.5 -top-1.5 size-7 rounded-full bg-primary items-center justify-center border-2 border-card z-10">
              <Star size={13} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          ) : null}
          <View className={`w-12 h-12 items-center justify-center rounded-[17px] border border-border/40 ${colorBg}`}>
            <FeatureIcon iconName={iconName} color={colorIcon} size={23} strokeWidth={1.9} />
          </View>

          <View className="h-[29px] items-center justify-center w-full px-0.5">
            <Text
              className="text-[11px] font-semibold font-sans text-foreground text-center leading-tight w-full"
              numberOfLines={2}
            >
              {tFeatureName(feature.id, meta?.name || feature.name)}
            </Text>
          </View>

          <Text className={`text-[9px] font-semibold ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
            {isSelected ? t('added', 'Added') : t('tap_to_add', 'Tap to add')}
          </Text>
        </View>
      </GestureDetector>
    </View>
  );
});

export const CustomiseAvailableZone: React.FC<CustomiseAvailableZoneProps> = ({
  features,
  selectedIds,
  onToggleSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}) => {
  const { t, tCategoryName, language } = useTranslation();

  // Group features by categoryKey/categoryName
  const groupedCategories = useMemo(() => {
    const map = new Map<string, { categoryKey?: string; categoryName: string; items: AvailableFeatureCardItem[] }>();

    features.forEach((feature) => {
      const catKey = feature.categoryKey || 'other';
      const catName = feature.categoryName || 'Other Actions';
      if (!map.has(catKey)) {
        map.set(catKey, { categoryKey: feature.categoryKey, categoryName: catName, items: [] });
      }
      map.get(catKey)!.items.push(feature);
    });

    return Array.from(map.values());
  }, [features, language]);

  return (
    <View className="p-3.5 gap-4">
      {groupedCategories.map((group) => (
        <View key={group.categoryKey || group.categoryName} className="gap-2">
          {/* Category Sub-header */}
          <View className="flex-row items-center justify-between pb-1 border-b border-border/60">
            <Text className="text-xs font-extrabold text-foreground tracking-wide">
              {tCategoryName(group.categoryKey, group.categoryName)}
            </Text>
            <Text className="text-[10px] font-semibold text-muted-foreground">
              {group.items.filter((i) => selectedIds.includes(i.id)).length}/{group.items.length} {t('enabled', 'Enabled')}
            </Text>
          </View>

          {/* Four compact action tiles match the dashboard customisation layout. */}
          <View className="flex-row flex-wrap gap-y-2.5 -mx-1">
            {group.items.map((feature) => (
              <AvailableFeatureCard
                key={feature.id}
                feature={feature}
                isSelected={selectedIds.includes(feature.id)}
                onToggleSelect={onToggleSelect}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

export default CustomiseAvailableZone;
