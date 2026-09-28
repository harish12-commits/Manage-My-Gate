import * as React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './button';
import { Text } from './text';
import { cn } from '../../lib/utils';

export interface ActionItem {
  label: string;
  onPress: () => void;
  loading?: boolean;
}

export interface ActionBarProps {
  primaryAction?: ActionItem;
  secondaryAction?: Omit<ActionItem, 'loading'>;
  destructiveAction?: Omit<ActionItem, 'loading'>;
  children?: React.ReactNode;
  className?: string;
}

export const ActionBar = React.forwardRef<View, ActionBarProps>(
  (
    {
      primaryAction,
      secondaryAction,
      destructiveAction,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const insets = useSafeAreaInsets();
    const bottomPadding = Math.max(insets.bottom, 12);

    return (
      <View
        ref={ref}
        style={{ paddingBottom: bottomPadding }}
        className={cn(
          'border-t border-border bg-card px-4 pt-3 flex-row items-center gap-3',
          className
        )}
        {...props}
      >
        {children ? (
          children
        ) : (
          <>
        {destructiveAction && (
          <Button
            variant="ghost"
            onPress={destructiveAction.onPress}
            className="active:bg-destructive/10"
          >
            <Text className="text-destructive font-semibold font-sans text-[15px]">
              {destructiveAction.label}
            </Text>
          </Button>
        )}

        {secondaryAction && (
          <Button
            variant="outline"
            onPress={secondaryAction.onPress}
            className="flex-1"
          >
            <Text className="font-semibold font-sans text-[15px]">
              {secondaryAction.label}
            </Text>
          </Button>
        )}

        {primaryAction && (
          <Button
            variant="default"
            onPress={primaryAction.onPress}
            disabled={primaryAction.loading}
            className="flex-1 flex-row items-center justify-center gap-2"
          >
            {primaryAction.loading ? (
              <ActivityIndicator
                size="small"
                color="#ffffff"
                className="mr-1"
              />
            ) : null}
            <Text className="text-primary-foreground font-bold font-sans text-[15px]">
              {primaryAction.label}
            </Text>
          </Button>
        )}
          </>
        )}
      </View>
    );
  }
);

ActionBar.displayName = 'ActionBar';

export default ActionBar;
