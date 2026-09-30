import { Platform } from 'react-native';
import React from 'react';
import { FlatList, FlatListProps, View, Text } from 'react-native';
import { cn } from '../../lib/utils';
import { ProgressLoader } from '../feedback/ProgressLoader';

export interface VirtualizedListProps<T> extends Omit<FlatListProps<T>, 'ListEmptyComponent'> {
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export const VirtualizedList = <T extends any>({
  data,
  loading = false,
  emptyMessage = 'No data available',
  className,
  ...props
}: VirtualizedListProps<T>) => {
  const EmptyComponent = () => (
    <View className="flex-1 items-center justify-center p-8 min-h-[200px]">
      <Text className="text-center text-slate-500 dark:text-slate-400">
        {emptyMessage}
      </Text>
    </View>
  );

  if (loading && data.length === 0) {
    return (
      <View className={cn('flex-1 items-center justify-center min-h-[200px]', className)}>
        <ProgressLoader size="large" />
      </View>
    );
  }

  const defaultKeyExtractor = (item: any, index: number): string => {
    if (item && typeof item === 'object') {
      if (typeof item._id === 'string') return item._id;
      if (typeof item.id === 'string') return item.id;
      if (typeof item.key === 'string') return item.key;
      if (typeof item._id === 'number') return String(item._id);
      if (typeof item.id === 'number') return String(item.id);
      if (typeof item.code === 'string') return item.code;
    }
    return `virt-item-${index}`;
  };

  return (
    <FlatList
      data={data}
      keyExtractor={props.keyExtractor || defaultKeyExtractor}
      className={cn('flex-1', className)}
      style={{ flex: 1 }}
      contentContainerStyle={[{ flexGrow: 1 }, props.contentContainerStyle]}
      ListEmptyComponent={EmptyComponent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
      alwaysBounceVertical={true}
      bounces={true}
      overScrollMode="always"
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews={Platform.OS !== 'web'}
      {...props}
    />
  );
};
