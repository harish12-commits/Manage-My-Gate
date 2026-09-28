import * as React from 'react';
import {
  View,
  TextInput,
  Pressable,
  Platform,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { Search, X, SlidersHorizontal, QrCode, Check, RotateCcw } from 'lucide-react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { Text } from './text';
import { Icon } from './icon';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import { GlobalFilterPanel } from './GlobalFilterPanel';
import { Button } from './button';
import { Chip } from '../common/Chip';
import { useTranslation } from '../../src/utils/i18n';

export interface SortOption {
  label: string;
  value: string;
  icon?: any;
}

const searchFilterBarVariants = cva('w-full flex-col px-4 py-2', {
  variants: {
    variant: {
      default: '',
      bordered: 'border-b border-border',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const filterButtonVariants = cva(
  'h-11 w-11 rounded-2xl items-center justify-center relative shrink-0 active:opacity-80 active:bg-accent border border-border/80 bg-card shadow-2xs',
  {
    variants: {
      hasActiveFilter: {
        true: 'border-primary/40 bg-primary/10',
        false: 'border-border/80 bg-card',
      },
    },
    defaultVariants: {
      hasActiveFilter: false,
    },
  }
);

export interface SearchFilterBarProps
  extends React.ComponentPropsWithoutRef<typeof View>,
    VariantProps<typeof searchFilterBarVariants> {
  searchValue: string;
  onSearchChange: (text: string) => void;
  searchPlaceholder?: string; // default: 'Search...'
  onScanPress?: () => void; // opens hardware QR / barcode camera scanner
  onFilterPress?: () => void; // opens filter bottom sheet
  activeFilterCount?: number; // badge count on filter button
  sortOptions?: SortOption[];
  onSortChange?: (value: string) => void;
  currentSort?: string;
  filterTitle?: string;
  className?: string;
}

export const SearchFilterBar = React.forwardRef<View, SearchFilterBarProps>(
  (
    {
      searchValue,
      onSearchChange,
      searchPlaceholder = 'Search...',
      onScanPress,
      onFilterPress,
      activeFilterCount = 0,
      sortOptions,
      onSortChange,
      currentSort,
      filterTitle = 'Filter & Sort Options',
      variant,
      className,
      ...props
    },
    ref
  ) => {
    const { t, translateText } = useTranslation();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const placeholderColor = isDark ? '#9ca3af' : '#6b7280';

    const [isInternalModalOpen, setIsInternalModalOpen] = React.useState(false);

    const isNonDefaultSort = Boolean(
      currentSort &&
      currentSort !== 'ALL' &&
      currentSort !== 'All' &&
      currentSort !== 'all' &&
      currentSort !== ''
    );

    const effectiveFilterCount = activeFilterCount > 0
      ? activeFilterCount
      : isNonDefaultSort
      ? 1
      : 0;

    const hasActiveFilter = effectiveFilterCount > 0;

    const handleFilterButtonPress = () => {
      if (onFilterPress) {
        onFilterPress();
      } else if (sortOptions && sortOptions.length > 0) {
        setIsInternalModalOpen(true);
      }
    };

    const handleSelectOption = (value: string) => {
      onSortChange?.(value);
      setIsInternalModalOpen(false);
    };

    const handleResetSort = () => {
      if (sortOptions && sortOptions.length > 0) {
        const defaultOpt = sortOptions.find(
          (o) => o.value === 'ALL' || o.value === 'all' || o.value === ''
        ) || sortOptions[0];
        onSortChange?.(defaultOpt.value);
      }
      setIsInternalModalOpen(false);
    };

    const showFilterButton = Boolean(onFilterPress || (sortOptions && sortOptions.length > 0));

    return (
      <View
        ref={ref}
        className={cn(searchFilterBarVariants({ variant }), className)}
        {...props}
      >
        {/* Single Clean Row: Search Input + Filter Icon Button */}
        <View className="flex-row items-center gap-2">
          {/* Search input container */}
          <View className="flex-1 flex-row items-center bg-card border border-border/80 rounded-2xl px-3.5 h-11 text-foreground shadow-2xs">
            <Icon
              as={Search}
              size={18}
              className="text-muted-foreground me-2 shrink-0"
            />
            <TextInput
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder={translateText(searchPlaceholder)}
              placeholderTextColor={placeholderColor}
              className={cn(
                // Search prompts can be much longer than the available phone width.
                // A compact type scale keeps the full prompt useful instead of clipping it.
                'flex-1 min-w-0 text-foreground text-[12px] font-sans p-0 bg-transparent h-full',
                Platform.select({
                  web: 'outline-none',
                })
              )}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              numberOfLines={1}
            />
            {searchValue.length > 0 && (
              <Pressable
                onPress={() => onSearchChange('')}
                hitSlop={8}
                className="p-1 rounded-full active:bg-secondary ms-1 shrink-0"
                accessibilityRole="button"
                accessibilityLabel="Clear search text"
              >
                <Icon as={X} size={16} className="text-muted-foreground" />
              </Pressable>
            )}

            {onScanPress && (
              <Pressable
                onPress={onScanPress}
                hitSlop={8}
                className="p-1.5 rounded-full active:bg-primary/10 ms-1 shrink-0"
                accessibilityRole="button"
                accessibilityLabel="Scan QR or Barcode"
              >
                <Icon as={QrCode} size={18} className="text-primary" />
              </Pressable>
            )}
          </View>

          {/* Filter button */}
          {showFilterButton && (
            <Pressable
              onPress={handleFilterButtonPress}
              className={cn(filterButtonVariants({ hasActiveFilter }))}
              accessibilityRole="button"
              accessibilityLabel="Open filter options"
            >
              <Icon
                as={SlidersHorizontal}
                size={18}
                className={hasActiveFilter ? 'text-primary' : 'text-foreground'}
              />
              {hasActiveFilter && (
                <View className="absolute -top-1 -right-1 bg-primary rounded-full min-w-[18px] h-[18px] px-1 items-center justify-center border-2 border-card shadow-2xs">
                  <Text className="text-primary-foreground text-[10px] font-bold font-sans leading-none text-center">
                    {effectiveFilterCount > 99 ? '99+' : effectiveFilterCount}
                  </Text>
                </View>
              )}
            </Pressable>
          )}
        </View>

        {/* Built-in Two-Pane Filter Panel for sortOptions when no custom onFilterPress is supplied */}
        {sortOptions && sortOptions.length > 0 && !onFilterPress && (
          <GlobalFilterPanel
            visible={isInternalModalOpen}
            onClose={() => setIsInternalModalOpen(false)}
            title={translateText(filterTitle)}
            categories={[
              {
                id: 'status_category',
                label: t('status_category', 'Status & Options'),
                type: 'radio',
                options: sortOptions.map((opt) => ({
                  id: opt.value,
                  label: opt.label,
                  icon: opt.icon,
                })),
                selectedValues: currentSort,
                selectedCount: isNonDefaultSort ? 1 : 0,
                onOptionSelect: (val) => handleSelectOption(val),
              },
            ]}
            onApply={() => setIsInternalModalOpen(false)}
            onClearAll={handleResetSort}
            totalActiveCount={effectiveFilterCount}
          />
        )}
      </View>
    );
  }
);

SearchFilterBar.displayName = 'SearchFilterBar';

export { searchFilterBarVariants, filterButtonVariants };
export default SearchFilterBar;
