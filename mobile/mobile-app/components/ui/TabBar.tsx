import * as React from 'react';
import { View, Pressable, Platform, ScrollView } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { Text } from './text';
import { cn } from '../../lib/utils';
import { getStatusSemanticType, getStatusTabStyle } from './statusTabColors';

const tabBarVariants = cva('flex-row my-1', {
  variants: {
    variant: {
      pill: 'bg-secondary border border-border/80 rounded-2xl p-1',
      underline: 'border-b border-border/80',
    },
  },
  defaultVariants: {
    variant: 'pill',
  },
});

const tabItemVariants = cva(
  cn(
    'flex-1 items-center justify-center relative flex-row px-2',
    Platform.select({ web: 'cursor-pointer select-none transition-colors' })
  ),
  {
    variants: {
      variant: {
        pill: 'py-2 rounded-xl',
        underline: 'py-3 border-b-2 -mb-[1px]',
      },
      isActive: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'pill',
        isActive: true,
        className: 'bg-card border border-border/60 shadow-xs',
      },
      {
        variant: 'pill',
        isActive: false,
        className: 'bg-transparent active:bg-card/40',
      },
      {
        variant: 'underline',
        isActive: true,
        className: 'border-primary',
      },
      {
        variant: 'underline',
        isActive: false,
        className: 'border-transparent active:bg-secondary/40',
      },
    ],
    defaultVariants: {
      variant: 'pill',
      isActive: false,
    },
  }
);

const tabTextVariants = cva('text-sm text-center', {
  variants: {
    variant: {
      pill: '',
      underline: '',
    },
    isActive: {
      true: 'text-foreground font-semibold',
      false: 'text-muted-foreground font-medium',
    },
  },
  defaultVariants: {
    variant: 'pill',
    isActive: false,
  },
});

export interface TabItem {
  key: string;
  label: string;
  badge?: number;
}

export interface TabBarProps extends VariantProps<typeof tabBarVariants> {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
  variant?: 'pill' | 'underline';
  scrollable?: boolean;
  className?: string;
}

export const TabBar = React.forwardRef<View, TabBarProps>(
  (
    {
      tabs,
      activeTab,
      onTabChange,
      variant = 'pill',
      scrollable,
      className,
      ...props
    },
    ref
  ) => {
    const isScrollable = scrollable ?? tabs.length > 4;

    const renderTabs = () =>
      tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const hasBadge = typeof tab.badge === 'number' && tab.badge > 0;
        const semantic = getStatusSemanticType(tab.key || tab.label);
        const isStatusTab = semantic !== 'default';
        const statusStyle = isStatusTab ? getStatusTabStyle(tab.key || tab.label, isActive) : null;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            className={cn(
              tabItemVariants({ variant, isActive }),
              isScrollable && 'flex-none px-3.5 min-w-[64px]',
              isStatusTab && variant === 'pill' && isActive && `${statusStyle?.containerClass} shadow-xs`
            )}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Text
              className={cn(
                tabTextVariants({ variant, isActive }),
                isStatusTab && isActive && statusStyle?.textClass
              )}
            >
              {tab.label}
            </Text>

            {hasBadge && (
              <View className="absolute top-1 right-2 min-w-[18px] h-[18px] rounded-full bg-destructive items-center justify-center px-1">
                <Text className="text-white text-[10px] font-bold leading-none text-center">
                  {tab.badge! > 99 ? '99+' : tab.badge}
                </Text>
              </View>
            )}
          </Pressable>
        );
      });

    if (isScrollable) {
      return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="flex-row items-center gap-1 px-0.5"
          className={cn(tabBarVariants({ variant }), className)}
        >
          {renderTabs()}
        </ScrollView>
      );
    }

    return (
      <View
        ref={ref}
        className={cn(tabBarVariants({ variant }), className)}
        {...props}
      >
        {renderTabs()}
      </View>
    );
  }
);

TabBar.displayName = 'TabBar';

export { tabBarVariants, tabItemVariants, tabTextVariants };
export default TabBar;
