import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '../ui/text';
import { Plus, ArrowDown, Star } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import FeatureIcon from '../ui/FeatureIcon';
import { ALL_AVAILABLE_FEATURES } from '../../src/features/dashboard/dashboardCatalog';
import { useTranslation } from '../../src/utils/i18n';

export interface DeckItem {
  id: string;
  name: string;
  iconName: string;
  colorBg: string;
  colorIcon: string;
}

export interface CustomiseDeckZoneProps {
  activeItems: DeckItem[];
  maxCapacity?: number;
  onRemoveItem: (id: string) => void;
  onReorderItem?: (fromIndex: number, toIndex: number) => void;
  isDropTargetActive?: boolean;
  embedded?: boolean;
}

export const CustomiseDeckZone: React.FC<CustomiseDeckZoneProps> = ({
  activeItems,
  maxCapacity = 7,
  onRemoveItem,
  onReorderItem,
  isDropTargetActive = false,
  embedded = false,
}) => {
  const { t, tFeatureName, language } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const emptySlotsCount = Math.max(0, maxCapacity - activeItems.length);

  return (
    <View
      style={isDropTargetActive ? {
        backgroundColor: isDark ? 'rgba(194, 65, 12, 0.2)' : 'rgba(194, 65, 12, 0.1)',
      } : undefined}
      className={`px-3.5 pt-3 pb-3.5 transition-colors duration-200 ${
        isDropTargetActive
          ? 'border-primary shadow-lg'
          : embedded ? '' : 'border-b border-border/70 bg-muted/35'
      }`}
    >
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-xs font-bold font-sans text-foreground uppercase tracking-wider">
            {t('active_quick_actions_deck', 'Quick Actions')}
          </Text>
          <View className="size-5 rounded-full bg-amber-500 items-center justify-center">
            <Star size={10} color="#FFFFFF" fill="#FFFFFF" />
          </View>
          {isDropTargetActive ? (
            <View className="bg-primary px-2 py-0.5 rounded-full flex-row items-center gap-1">
              <ArrowDown size={10} color="#fff" />
              <Text className="text-[9px] font-bold text-primary-foreground uppercase">{t('drop_here', 'Drop Here')}</Text>
            </View>
          ) : null}
        </View>
        <Text className="text-[11px] font-medium font-sans text-muted-foreground">
          {activeItems.length}/{maxCapacity} {t('selected', 'Selected')}
        </Text>
      </View>

      {/* Fixed-height cards keep the two-row, four-column action deck aligned. */}
      <View className="flex-row flex-wrap gap-y-2.5 -mx-1">
        {activeItems.map((item) => {
          const meta = ALL_AVAILABLE_FEATURES.find((f) => f.id === item.id);
          const iconName = meta?.iconName || item.iconName;

          return (
            <View key={item.id} className="w-1/4 px-1">
              <View className="relative items-center">
                <View
                  style={{ backgroundColor: isDark ? '#262626' : '#FFFFFF' }}
                  className="h-[82px] w-full items-center justify-center rounded-[22px] border border-border/50 shadow-xs"
                >
                  <FeatureIcon
                    iconName={iconName}
                    color={isDark ? '#D6F4F2' : '#103A3F'}
                    size={29}
                    strokeWidth={1.9}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => onRemoveItem(item.id)}
                  activeOpacity={0.7}
                  className="absolute -right-1.5 -top-1.5 size-7 rounded-full bg-[#34565A] items-center justify-center border-2 border-card shadow-sm"
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name} from quick actions`}
                >
                  <Star size={12} color="#FFFFFF" fill="#FFFFFF" />
                </TouchableOpacity>

                <Text
                  className="h-[34px] mt-2 text-[11px] font-semibold font-sans text-foreground text-center px-0.5 leading-tight"
                  numberOfLines={2}
                >
                  {tFeatureName(item.id, meta?.name || item.name)}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Empty Slots with Dashed Borders */}
        {Array.from({ length: emptySlotsCount }).map((_, index) => (
          <View key={`empty_${index}`} className="w-1/4 px-1">
            <View
              style={{
                backgroundColor: isDropTargetActive
                  ? (isDark ? 'rgba(194, 65, 12, 0.2)' : 'rgba(194, 65, 12, 0.1)')
                  : (isDark ? '#262626' : '#FFFFFF'),
              }}
              className={`w-full h-[82px] border border-dashed rounded-[22px] items-center justify-center p-2 transition-colors ${
                isDropTargetActive
                  ? 'border-primary/80'
                  : 'border-border/70'
              }`}
            >
              <Plus size={16} className={isDropTargetActive ? 'text-primary' : 'text-muted-foreground/50'} />
              <Text
                className={`text-[10px] font-medium font-sans mt-1 ${
                  isDropTargetActive ? 'text-primary font-bold' : 'text-muted-foreground/60'
                }`}
              >
                {isDropTargetActive ? 'Drop Here' : t('empty_slot', 'Empty Slot')}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default CustomiseDeckZone;
