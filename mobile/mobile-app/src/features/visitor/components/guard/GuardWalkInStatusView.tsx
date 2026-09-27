import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { ListCard } from '@/components/ui/ListCard';
import { StatusBadge, type StatusVariant } from '@/components/ui/StatusBadge';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { Button } from '@/components/ui/button';
import { Clock, Phone, Car, RefreshCw, Building } from 'lucide-react-native';
import { useVisitorPass } from '../../hooks/useVisitorPass';
import { useVisitorSocket } from '../../hooks/useVisitorSocket';
import { WalkInApprovalItem } from '../../mocks/visitorMocks';

const mapWalkInBadge = (status: 'PENDING' | 'APPROVED' | 'REJECTED'): { label: string; variant: StatusVariant } => {
  switch (status) {
    case 'APPROVED':
      return { label: 'APPROVED', variant: 'success' };
    case 'REJECTED':
      return { label: 'DENIED BY HOST', variant: 'danger' };
    case 'PENDING':
    default:
      return { label: 'PENDING APPROVAL', variant: 'warning' };
  }
};

export const GuardWalkInStatusView: React.FC = () => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Activate real-time socket listener
  useVisitorSocket();

  const { walkIns, loadPendingWalkIns } = useVisitorPass();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPendingWalkIns();
    setRefreshing(false);
  }, [loadPendingWalkIns]);

  useEffect(() => {
    loadPendingWalkIns();
  }, [loadPendingWalkIns]);

  // Outcomes received live first, then requests still awaiting the host.
  const items: WalkInApprovalItem[] = useMemo(
    () => [...(walkIns?.resolvedList || []), ...(walkIns?.pendingList || [])],
    [walkIns?.resolvedList, walkIns?.pendingList]
  );

  const filteredItems = useMemo(() => {
    if (filter === 'ALL') return items;
    return items.filter((item) => item.status === filter);
  }, [items, filter]);

  const renderHeader = () => (
    <View className="mb-3 px-1">
      {/* Top Filter Chips & Sync Status Header */}
      <View className="bg-card/80 border border-border p-2 rounded-2xl flex-row items-center justify-between gap-2 shadow-xs">
        <View className="flex-row gap-1.5 flex-1">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${f}`}
              className={`px-3 py-1.5 rounded-full border ${
                filter === f
                  ? 'bg-primary border-primary'
                  : 'bg-card border-border'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  filter === f ? 'text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          variant="ghost"
          size="sm"
          onPress={handleRefresh}
          className="h-8 w-8 p-0 rounded-full bg-muted items-center justify-center"
          accessibilityLabel="Refresh Queue"
        >
          <RefreshCw size={14} className="text-muted-foreground" />
        </Button>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      {/* Paginated Requests List */}
      <PaginatedList<WalkInApprovalItem>
        data={filteredItems}
        pagination={{
          currentPage: 1,
          totalPages: 1,
          totalRecords: filteredItems.length,
          limit: 20,
        }}
        onLoadMore={handleRefresh}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        loading={walkIns?.status === 'loading' && !refreshing && items.length === 0}
        ListHeaderComponent={renderHeader()}
        emptyIcon="ShieldAlert"
        emptyTitle="No Walk-In Requests Found"
        emptySubtitle="Walk-in entry requests initiated at the gate will appear here with live status updates."
        contentContainerClassName="px-4 pt-3 pb-28"
        renderItem={(item) => {
          if (!item) return null;
          const badge = mapWalkInBadge(item.status);
          const subtitle = item.phone ? `Ph: ${item.phone}` : 'Unplanned Gate Visitor';

          return (
            <ListCard
              key={item.id}
              title={item.visitorName}
              subtitle={subtitle}
              leftIcon="ShieldAlert"
              leftIconBgColor="bg-status-warning/15"
              status={{
                label: badge.label,
                variant: badge.variant,
              }}
              showChevron={false}
              className="mb-3"
            >
              {/* Target Host Details & Gate */}
              <View className="bg-muted/40 p-2.5 rounded-xl gap-1 mt-1">
                <View className="flex-row items-center gap-2">
                  <Building size={14} className="text-primary" />
                  <Text className="text-xs font-semibold text-foreground flex-1">
                    {item.purpose || 'Target Resident Host'}
                  </Text>
                </View>
                {Boolean(item.gateName) && (
                  <Text className="text-[11px] text-muted-foreground ms-5">
                    Gate: {item.gateName}
                  </Text>
                )}
              </View>

              {/* Additional Metadata Footer */}
              <View className="flex-row items-center justify-between text-xs text-muted-foreground pt-2">
                {item.vehicleNo ? (
                  <View className="flex-row items-center gap-1">
                    <Car size={13} className="text-muted-foreground" />
                    <Text className="text-xs font-mono font-medium text-foreground">{item.vehicleNo}</Text>
                  </View>
                ) : (
                  <View />
                )}

                <View className="flex-row items-center gap-1">
                  <Clock size={12} className="text-muted-foreground" />
                  <Text className="text-xs text-muted-foreground">
                    {item.waitingDurationMinutes ? `Waiting ${item.waitingDurationMinutes} mins` : 'Just now'}
                  </Text>
                </View>
              </View>
            </ListCard>
          );
        }}
      />
    </View>
  );
};

export default GuardWalkInStatusView;
