import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '../common/BottomSheet';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react-native';
import GorhomBottomSheet from '@gorhom/bottom-sheet';

export interface ActionSheetOption {
  key: string;
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
}

export interface ActionSheetProps {
  sheetRef: React.RefObject<GorhomBottomSheet>;
  title?: string;
  options: ActionSheetOption[];
  onSelect: (key: string) => void;
  onCancel?: () => void;
  className?: string;
}

export const ActionSheet = ({
  sheetRef,
  title,
  options,
  onSelect,
  onCancel,
  className,
}: ActionSheetProps) => {
  // Dynamically calculate snap points based on content height
  const baseHeight = title ? 60 : 20;
  const itemHeight = 56;
  const totalHeight = baseHeight + (options.length * itemHeight) + (onCancel ? itemHeight + 16 : 0) + 40; // padding

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={[`${totalHeight}`]}
      className={className}
    >
      {Boolean(title) && (
        <Text className="mb-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
          {title}
        </Text>
      )}
      
      <View className="overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-900">
        {options.map((option, index) => {
          const Icon = option.icon;
          return (
            <Pressable
              key={option.key}
              onPress={() => {
                onSelect(option.key);
                sheetRef.current?.close();
              }}
              className={cn(
                'flex-row items-center justify-center p-4',
                index < options.length - 1 && 'border-b border-slate-200 dark:border-slate-800'
              )}
            >
              {Icon && (
                <Icon
                  size={20}
                  className={cn(
                    'mr-2',
                    option.destructive ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'
                  )}
                />
              )}
              <Text
                className={cn(
                  'text-lg font-medium',
                  option.destructive ? 'text-red-500' : 'text-primary'
                )}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      
      {onCancel && (
        <Pressable
          onPress={() => {
            onCancel();
            sheetRef.current?.close();
          }}
          className="mt-4 items-center justify-center rounded-xl bg-slate-50 p-4 dark:bg-slate-900"
        >
          <Text className="text-lg font-bold text-slate-900 dark:text-white">
            Cancel
          </Text>
        </Pressable>
      )}
    </BottomSheet>
  );
};
