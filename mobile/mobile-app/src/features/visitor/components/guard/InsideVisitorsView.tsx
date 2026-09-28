import React, { useState, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { useSelector } from 'react-redux';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ListCard } from '@/components/ui/ListCard';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { selectActiveOrgId } from '@/src/features/auth/store/authSelectors';
import { useVisitorPass } from '../../hooks/useVisitorPass';
import { ActiveVisitorLog } from '../../store/visitorPassSlice';
import { LogOut, Users } from 'lucide-react-native';

export const InsideVisitorsView: React.FC = () => {
  const activeOrgId = useSelector(selectActiveOrgId);
  const {
    activeVisitors,
    activeVisitorsStatus,
    fetchActiveVisitors,
    checkoutVisitor,
  } = useVisitorPass();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!activeOrgId) return;
    await fetchActiveVisitors(activeOrgId);
  }, [activeOrgId, fetchActiveVisitors]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  }, [fetchLogs]);

  const handleConfirmCheckout = async () => {
    if (selectedLogId) {
      try {
        await checkoutVisitor(selectedLogId);
        setCheckoutError(null);
      } catch (err: any) {
        // e.g. already checked out at another gate: tell the guard and refresh the list.
        setCheckoutError(err?.message || 'Failed to check out visitor.');
        fetchLogs();
      } finally {
        setSelectedLogId(null);
      }
    }
  };

  const renderHeader = () => (
    <>
      {checkoutError ? (
        <ErrorBanner message={checkoutError} onDismiss={() => setCheckoutError(null)} className="mb-3" />
      ) : null}
      <View className="flex-row items-center justify-between bg-card border border-border rounded-2xl p-3.5 mb-3">
        <View className="flex-row items-center gap-2">
          <Users size={18} className="text-status-success" />
          <Text className="text-sm font-bold text-foreground">Active Visitors Inside</Text>
        </View>
        <Text className="text-xs font-extrabold text-status-success bg-status-success/15 px-3 py-1 rounded-full">
          {activeVisitors.length} On-Premises
        </Text>
      </View>
    </>
  );

  return (
    <View className="flex-1 bg-background">
      <PaginatedList<ActiveVisitorLog>
        data={activeVisitors}
        pagination={{
          currentPage: 1,
          totalPages: 1,
          totalRecords: activeVisitors.length,
          limit: 50,
        }}
        onLoadMore={handleRefresh}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        loading={activeVisitorsStatus === 'loading' && !refreshing && activeVisitors.length === 0}
        ListHeaderComponent={renderHeader()}
        emptyIcon="ShieldCheck"
        emptyTitle="No Active Visitors Inside"
        emptySubtitle="All entered visitors have been checked out at the security gate."
        contentContainerClassName="px-4 pt-3 pb-28 gap-3"
        renderItem={(log) => {
          if (!log) return null;

          const villaInfo = log.passId?.villaId || log.residentId?.villaId;
          const villaUnit = villaInfo?.unitNumber || villaInfo?.villaNumber || '';
          const villaBlock = villaInfo?.blockOrBuilding || villaInfo?.block ? ` (${villaInfo.blockOrBuilding || villaInfo.block})` : '';
          const villaText = villaUnit ? `Villa ${villaUnit}${villaBlock}` : 'Estate Premises';

          const hostName = log.residentId?.name || log.residentId?.username || 'Host Resident';
          const vehiclePlate = log.snapshot?.vehicleNumber || log.passId?.vehicleDetails?.number || '';
          const passType = log.passId?.passType || log.entryType || 'VISITOR';
          const inTime = log.checkInTime
            ? new Date(log.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Recently';

          const subtitle = `📍 ${villaText} • Host: ${hostName}\n⏰ In: ${inTime}${vehiclePlate ? ` • 🚗 ${vehiclePlate}` : ''} • ${passType}`;

          return (
            <ListCard
              title={log.snapshot?.visitorName || log.visitorName || 'Visitor'}
              subtitle={subtitle}
              leftIcon="ShieldCheck"
              leftIconBgColor="bg-status-success/15"
              status={{ label: 'INSIDE', variant: 'success' }}
              rightContent={
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setSelectedLogId(log._id)}
                  className="flex-row items-center gap-1 h-8 px-2.5 rounded-xl border-status-success/30 bg-status-success/10"
                  accessibilityLabel="Check Out Visitor"
                >
                  <LogOut size={13} className="text-status-success" />
                  <Text className="text-xs font-bold text-status-success">Check Out</Text>
                </Button>
              }
            />
          );
        }}
      />

      <ConfirmationModal
        visible={Boolean(selectedLogId)}
        title="Check Out Visitor?"
        message="Are you sure you want to mark this visitor as checked out at the gate desk?"
        variant="info"
        confirmLabel="Confirm Check-Out"
        onConfirm={handleConfirmCheckout}
        onCancel={() => setSelectedLogId(null)}
      />
    </View>
  );
};

export default InsideVisitorsView;
