import { Platform } from 'react-native';
import React, { memo } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { cn } from '../../lib/utils';
import { EmptyState } from '../feedback/EmptyState';
import { LayoutGrid } from 'lucide-react-native';

export interface GridColumn<T> {
  key: string;
  header: string;
  flex?: number;
  width?: number;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface OptimizedDataGridProps<T> {
  data: T[];
  columns: GridColumn<T>[];
  keyExtractor: (item: T, index: number) => string;
  onRefresh?: () => void;
  refreshing?: boolean;
  onEndReached?: () => void;
  emptyMessage?: string;
  className?: string;
  scrollEnabled?: boolean;
}

const OptimizedDataGridComponent = <T extends any>({
  data,
  columns,
  keyExtractor,
  onRefresh,
  refreshing = false,
  onEndReached,
  emptyMessage = 'No data available',
  className,
  scrollEnabled = true,
}: OptimizedDataGridProps<T>) => {
  const renderHeader = () => (
    <View className="flex-row border-b border-border bg-secondary px-4 py-3">
      {columns.map((col) => (
        <View
          key={col.key}
          style={{ flex: col.flex || (col.width ? undefined : 1), width: col.width }}
        >
          <Text className="text-xs font-bold font-sans text-muted-foreground uppercase tracking-wider">
            {col.header}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderItem = ({ item, index }: { item: T; index: number }) => (
    <View key={keyExtractor(item, index)} className="flex-row items-center border-b border-border/60 bg-card px-4 py-3.5">
      {columns.map((col) => (
        <View
          key={col.key}
          style={{ flex: col.flex || (col.width ? undefined : 1), width: col.width }}
        >
          {col.render ? (
            col.render(item, index)
          ) : (
            <Text
              className="text-sm font-sans text-foreground"
              numberOfLines={1}
            >
              {String((item as any)[col.key] || '')}
            </Text>
          )}
        </View>
      ))}
    </View>
  );

  if (!scrollEnabled) {
    return (
      <View className={cn('rounded-2xl overflow-hidden border border-border bg-card', className)}>
        {renderHeader()}
        {data.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No records"
            description={emptyMessage}
          />
        ) : (
          data.map((item, index) => renderItem({ item, index }))
        )}
      </View>
    );
  }

  return (
    <View className={cn('flex-1 rounded-2xl overflow-hidden border border-border bg-card', className)}>
      {renderHeader()}
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        scrollEnabled={scrollEnabled}
        nestedScrollEnabled={true}
        ListEmptyComponent={
          <EmptyState
            icon={LayoutGrid}
            title="No records"
            description={emptyMessage}
          />
        }
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={Platform.OS !== 'web'}
        maxToRenderPerBatch={15}
        initialNumToRender={10}
        windowSize={5}
      />
    </View>
  );
};

export const OptimizedDataGrid = memo(OptimizedDataGridComponent) as typeof OptimizedDataGridComponent;
