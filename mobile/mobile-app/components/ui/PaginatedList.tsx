import { Icon } from './icon';
import { Skeleton } from './Skeleton';
import { Text } from './text';
import { cn } from '../../lib/utils';
import * as LucideIcons from 'lucide-react-native';
import { Inbox } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View, StyleProp, ViewStyle } from 'react-native';

import { useBottomNavScroll } from '../navigation/BottomNavScrollContext';
import { useTranslation } from '../../src/utils/i18n';

export interface PaginatedListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  pagination: { currentPage: number; totalPages: number; totalRecords: number; limit: number };
  onLoadMore: () => void;
  onRefresh: () => void;
  loading: boolean;
  refreshing?: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  ListHeaderComponent?: React.ReactNode;
  ListEmptyComponent?: React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  contentContainerClassName?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onScroll?: (event: any) => void;
  extraData?: any;
  paginationSummary?: boolean;
}

const getEmptyIconComponent = (iconName?: string): LucideIcons.LucideIcon => {
  if (iconName && iconName in LucideIcons) {
    const IconComp = (LucideIcons as Record<string, any>)[iconName];
    if (typeof IconComp === 'function' || typeof IconComp === 'object') {
      return IconComp as LucideIcons.LucideIcon;
    }
  }
  return Inbox;
};

export function PaginatedList<T>({
  data,
  renderItem: renderItemProp,
  pagination,
  onLoadMore,
  onRefresh,
  loading,
  refreshing = false,
  emptyIcon,
  emptyTitle = 'Nothing here yet',
  emptySubtitle = '',
  ListHeaderComponent,
  ListEmptyComponent,
  keyExtractor,
  contentContainerClassName,
  contentContainerStyle,
  onScroll: onScrollProp,
  extraData: extraDataProp,
  paginationSummary = false,
}: PaginatedListProps<T>) {
  const { language } = useTranslation();
  const { handleScroll } = useBottomNavScroll();
  const onEndReachedCalledDuringMomentum = React.useRef(false);

  const currentPage = pagination?.currentPage ?? (pagination as any)?.page ?? 1;
  const totalPages = pagination?.totalPages ?? 1;
  const totalRecords = pagination?.totalRecords ?? data.length;

  React.useEffect(() => {
    onEndReachedCalledDuringMomentum.current = false;
  }, [loading, data.length, currentPage]);

  const handleEndReached = () => {
    if (
      !onEndReachedCalledDuringMomentum.current &&
      !loading &&
      !refreshing &&
      currentPage < totalPages
    ) {
      onEndReachedCalledDuringMomentum.current = true;
      onLoadMore();
    }
  };

  const handleMomentumScrollBegin = () => {
    onEndReachedCalledDuringMomentum.current = false;
  };

  const handleScrollBeginDrag = () => {
    onEndReachedCalledDuringMomentum.current = false;
  };

  const defaultKeyExtractor = (item: T, index: number): string => {
    if (item && typeof item === 'object') {
      const itemRecord = item as Record<string, any>;
      const rawKey = itemRecord._id ?? itemRecord.id ?? itemRecord.bookingId ?? itemRecord.key;
      if (rawKey != null) {
        const keyStr = typeof rawKey === 'object' ? JSON.stringify(rawKey) : String(rawKey);
        return `${keyStr}-${index}`;
      }
    }
    return String(index);
  };

  const renderFooter = () => {
    if (data.length > 0 && (paginationSummary || (loading && currentPage < totalPages))) {
      return (
        <View className="py-4 items-center justify-center">
          {loading && currentPage < totalPages ? (
            <ActivityIndicator size="small" color="#FF6A00" />
          ) : null}
          {paginationSummary ? (
            <Text className="mt-2 text-xs font-medium text-muted-foreground">
              {currentPage < totalPages
                ? `Showing ${Math.min(data.length, totalRecords)} of ${totalRecords}`
                : `${totalRecords} record${totalRecords === 1 ? '' : 's'} shown`}
            </Text>
          ) : null}
        </View>
      );
    }
    return null;
  };

  const renderEmptyOrSkeleton = () => {
    if (loading && data.length === 0) {
      return (
        <View className="p-4 flex-1 justify-center">
          <Skeleton variant="listItem" count={5} />
        </View>
      );
    }

    if (!loading && data.length === 0) {
      const IconComponent = getEmptyIconComponent(emptyIcon);
      return (
        <View className="flex-1 justify-center items-center p-6 min-h-[300px]">
          <Icon as={IconComponent} size={48} className="text-muted-foreground/60" />
          <Text className="text-center mt-4 text-muted-foreground font-sans font-bold text-[18px]">
            {emptyTitle}
          </Text>
          {emptySubtitle ? (
            <Text variant="muted" className="text-center mt-2 text-muted-foreground font-sans text-[14px]">
              {emptySubtitle}
            </Text>
          ) : null}
        </View>
      );
    }

    return null;
  };

  return (
    <FlatList
      className="flex-1"
      style={{ flex: 1 }}
      data={data}
      extraData={extraDataProp !== undefined ? extraDataProp : language}
      renderItem={({ item, index }) => renderItemProp(item, index) as React.ReactElement | null}
      keyExtractor={keyExtractor || defaultKeyExtractor}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.4}
      onMomentumScrollBegin={handleMomentumScrollBegin}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScroll={(event) => {
        handleScroll(event);
        if (onScrollProp) {
          onScrollProp(event);
        }
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
      alwaysBounceVertical={true}
      bounces={true}
      overScrollMode="always"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#FF6A00"
          colors={['#FF6A00']}
        />
      }
      ListHeaderComponent={ListHeaderComponent as React.ReactElement | undefined}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={
        (ListEmptyComponent !== undefined
          ? (ListEmptyComponent as React.ReactElement | null)
          : renderEmptyOrSkeleton())
      }
      contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
      contentContainerClassName={cn(
        // A screen-supplied empty state belongs below its header/search controls.
        // Only vertically centre the built-in generic empty state.
        data.length === 0 && ListEmptyComponent === undefined && 'justify-center',
        contentContainerClassName
      )}
    />
  );
}

export default PaginatedList;
