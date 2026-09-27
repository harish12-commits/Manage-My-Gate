import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '../ui/text';
import { X, Plus, ChevronLeft, ChevronRight, ArrowDown } from 'lucide-react-native';
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
}

export const CustomiseDeckZone: React.FC<CustomiseDeckZoneProps> = ({
  activeItems,
  maxCapacity = 7,
  onRemoveItem,
  onReorderItem,
  isDropTargetActive = false,
}) => {
  const { t, tFeatureName, language } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const emptySlotsCount = Math.max(0, maxCapacity - activeItems.length);

  const handleMoveLeft = (index: number) => {
    if (index > 0 && onReorderItem) {
      onReorderItem(index, index - 1);
    }
  };

  const handleMoveRight = (index: number) => {
    if (index < activeItems.length - 1 && onReorderItem) {
      onReorderItem(index, index + 1);
    }
  };

  return (
    <View
      style={{
        backgroundColor: isDropTargetActive
          ? (isDark ? 'rgba(194, 65, 12, 0.2)' : 'rgba(194, 65, 12, 0.1)')
          : (isDark ? '#262626' : '#F5F5F4'),
      }}
      className={`px-3.5 pt-3 pb-3.5 border-b transition-colors duration-200 ${
        isDropTargetActive
          ? 'border-primary shadow-lg'
          : 'border-border/70'
      }`}
    >
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-xs font-bold font-sans text-foreground uppercase tracking-wider">
            {t('active_quick_actions_deck', 'Active Quick Actions Bar')}
          </Text>
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
        {activeItems.map((item, index) => {
          const meta = ALL_AVAILABLE_FEATURES.find((f) => f.id === item.id);
          const iconName = meta?.iconName || item.iconName;
          const colorIcon = meta?.colorIcon || item.colorIcon || '#245FA8';
          const colorBg = meta?.colorBg || item.colorBg || 'bg-secondary';

          return (
            <View key={item.id} className="w-1/4 px-1">
              <View
                style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }}
                className="relative h-[110px] w-full items-center rounded-2xl border border-border/70 px-1.5 py-2 shadow-xs"
              >
                <View className="relative">
                  <View className={`w-11 h-11 items-center justify-center rounded-[15px] border border-border/50 ${colorBg}`}>
                    <FeatureIcon iconName={iconName} color={colorIcon} size={22} strokeWidth={1.9} />
                  </View>

                  {/* Red X Badge to remove */}
                  <TouchableOpacity
                    onPress={() => onRemoveItem(item.id)}
                    activeOpacity={0.7}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-destructive rounded-full items-center justify-center shadow-sm border-2 border-card"
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.name}`}
                  >
                    <X size={10} color="#fff" />
                  </TouchableOpacity>
                </View>

                <Text
                  className="h-[29px] mt-1 text-[11px] font-semibold font-sans text-foreground text-center px-0.5 leading-tight"
                  numberOfLines={2}
                >
                  {tFeatureName(item.id, meta?.name || item.name)}
                </Text>

                {/* Consistent reorder row keeps every card the same height. */}
                {onReorderItem && activeItems.length > 1 ? (
                  <View className="absolute bottom-2 flex-row items-center justify-center gap-2">
                    {index > 0 ? (
                      <TouchableOpacity
                        onPress={() => handleMoveLeft(index)}
                        className="w-6 h-6 rounded-full bg-secondary/80 items-center justify-center border border-border/60"
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Move action left"
                      >
                        <ChevronLeft size={12} className="text-muted-foreground" />
                      </TouchableOpacity>
                    ) : (
                      <View className="w-6 h-6 opacity-0" />
                    )}

                    {index < activeItems.length - 1 ? (
                      <TouchableOpacity
                        onPress={() => handleMoveRight(index)}
                        className="w-6 h-6 rounded-full bg-secondary/80 items-center justify-center border border-border/60"
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Move action right"
                      >
                        <ChevronRight size={12} className="text-muted-foreground" />
                      </TouchableOpacity>
                    ) : (
                      <View className="w-6 h-6 opacity-0" />
                    )}
                  </View>
                ) : null}
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
                  : (isDark ? '#262626' : '#F5F5F4'),
              }}
              className={`w-full h-[110px] border border-dashed rounded-[18px] items-center justify-center p-2 transition-colors ${
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
