import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { ExportReportButton } from '@/components/analytics/ExportReportButton';
import { AdminGateLogCard, AdminGateLogItem } from '@/src/features/visitor/components/admin/AdminGateLogCard';
import { AdminForceCheckoutModal } from '@/src/features/visitor/components/admin/AdminForceCheckoutModal';
import { VisitorLogDetailsModal } from '@/src/features/visitor/components/history/VisitorLogDetailsModal';
import { useAdminVisitor } from '@/src/features/visitor/hooks/useAdminVisitor';
import visitorService from '@/src/features/visitor/services/visitorService';
import { mapBackendPassToHistoryItem } from '@/src/features/visitor/utils/mapBackendPassToHistoryItem';
import { mapBackendLogToGateLogItem } from '@/src/features/visitor/utils/mapBackendLogToGateLogItem';
import { selectActiveOrgId, selectAuthUser } from '@/src/features/auth/store/authSelectors';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';
import { Redirect } from 'expo-router';
import { downloadCSVFile } from '@/src/utils/downloadHelper';
import { useTranslation } from '@/src/utils/i18n';

const PAGE_SIZE = 10;

function AdminGateLogsContent() {
  const { t } = useTranslation();
  const activeOrgId = useSelector(selectActiveOrgId);
  const { actionStatus, forceCheckout } = useAdminVisitor();

  // The audit trail is the gate's own event log (check-ins, walk-ins, check-outs),
  // not the pass registry: times, guard and gate come from what actually happened.
  const [gateLogs, setGateLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalRecords: 0, limit: PAGE_SIZE });
  const [status, setStatus] = useState<'idle' | 'loading' | 'succeeded' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AdminGateLogItem | null>(null);
  const [selectedPassForModal, setSelectedPassForModal] = useState<any | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(
    async (page: number, append: boolean = false) => {
      if (!activeOrgId) return;
      setStatus('loading');
      try {
        const params: any = { skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE };
        if (activeTab !== 'ALL') {
          params.status = activeTab;
        }
        const response: any = await visitorService.getHistoryLogs(activeOrgId, params);
        const body = response && response.success !== undefined ? response : response?.data;
        const inner = body?.data || body || {};
        const rows = Array.isArray(inner) ? inner : inner.data || [];
        const totalRecords = typeof inner.totalRecords === 'number' ? inner.totalRecords : rows.length;
        setGateLogs((prev) => (append ? [...prev, ...rows] : rows));
        setPagination({
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(totalRecords / PAGE_SIZE)),
          totalRecords,
          limit: PAGE_SIZE,
        });
        setError(null);
        setStatus('succeeded');
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load gate logs.');
        setStatus('failed');
      }
    },
    [activeOrgId, activeTab]
  );

  useEffect(() => {
    loadData(1, false);
  }, [activeTab, loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(1, false);
    setRefreshing(false);
  }, [loadData]);

  const handleLoadMore = useCallback(async () => {
    if (
      status === 'loading' ||
      loadingMore ||
      refreshing ||
      pagination.currentPage >= pagination.totalPages
    ) {
      return;
    }
    setLoadingMore(true);
    await loadData(pagination.currentPage + 1, true);
    setLoadingMore(false);
  }, [status, loadingMore, refreshing, pagination, loadData]);

  const mappedLogs: AdminGateLogItem[] = useMemo(() => gateLogs.map(mapBackendLogToGateLogItem), [gateLogs]);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return mappedLogs;
    const query = search.toLowerCase().trim();
    return mappedLogs.filter((log) => {
      const matchName = log.visitorName ? log.visitorName.toLowerCase().includes(query) : false;
      const matchVehicle = log.vehicleNo ? log.vehicleNo.toLowerCase().includes(query) : false;
      const matchVilla = log.villaNumber ? log.villaNumber.toLowerCase().includes(query) : false;
      const matchGuard = log.guardName ? log.guardName.toLowerCase().includes(query) : false;
      const matchPhone = log.phone ? log.phone.includes(query) : false;
      return matchName || matchVehicle || matchVilla || matchGuard || matchPhone;
    });
  }, [mappedLogs, search]);

  const handleOpenForceCheckout = (log: AdminGateLogItem) => {
    setSelectedLog(log);
    setCheckoutModalOpen(true);
  };

  const handleConfirmForceCheckout = async (reason: string) => {
    if (selectedLog?._id) {
      const res: any = await forceCheckout(selectedLog._id, reason);
      setError(res?.meta?.requestStatus === 'rejected' ? String(res.payload || 'Failed to check out visitor.') : null);
      setCheckoutModalOpen(false);
      setSelectedLog(null);
      loadData(1, false);
    }
  };

  const handleOpenDetails = (log: AdminGateLogItem) => {
    if (log.rawPass) {
      setSelectedPassForModal(mapBackendPassToHistoryItem(log.rawPass));
      setDetailsModalOpen(true);
    }
  };

  const generateGateLogsCSV = (logs: AdminGateLogItem[]) => {
    const headers = [
      'Log ID',
      'Visitor Name',
      'Phone',
      'Pass Category',
      'Pass Code',
      'Vehicle Plate',
      'Destination Unit',
      'Status',
      'Check-In Time',
      'Check-Out Time',
      'Security Guard',
      'Gate Used',
      'Purpose',
    ];

    const escapeCSV = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = logs.map((log) => [
      escapeCSV(log._id),
      escapeCSV(log.visitorName),
      escapeCSV(log.phone || 'N/A'),
      escapeCSV(log.passType || log.category || 'GUEST'),
      escapeCSV(log.shortKey || log.code || 'N/A'),
      escapeCSV(log.vehicleNo || 'N/A'),
      escapeCSV(log.villaNumber || 'Community'),
      escapeCSV(log.status || 'N/A'),
      escapeCSV(log.entryTime ? new Date(log.entryTime).toLocaleString() : 'N/A'),
      escapeCSV(log.exitTime ? new Date(log.exitTime).toLocaleString() : log.status === 'INSIDE' ? 'Active Inside' : 'N/A'),
      escapeCSV(log.guardName || 'N/A'),
      escapeCSV(log.gateName || 'N/A'),
      escapeCSV(log.purpose || 'Visitor Entry'),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  };

  const handleExportCSV = async () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      Alert.alert('No Logs to Export', 'There are no gate audit logs matching the current filter.');
      return;
    }
    try {
      setExporting(true);
      const csvContent = generateGateLogsCSV(filteredLogs);
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `gate_audit_logs_${dateStr}.csv`;
      await downloadCSVFile(csvContent, fileName);
    } catch (err) {
      console.error('Export CSV error:', err);
    } finally {
      setExporting(false);
    }
  };

  const renderHeader = () => (
    <View className="gap-3 mb-3">
      {/* Search & Filter Bar with Uniform Horizontal Status Pills */}
      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('search_visitor_vehicle_plate_guard_or_villa', 'Search visitor, vehicle plate, guard or villa...')}
        sortOptions={[
          { label: t('all_logs', 'All Logs'), value: 'ALL' },
          { label: t('inside_now', 'Inside Now'), value: 'INSIDE' },
          { label: t('awaiting_host', 'Awaiting Host'), value: 'PENDING' },
          { label: t('completed', 'Completed'), value: 'COMPLETED' },
          { label: t('revoked_denied', 'Revoked/Denied'), value: 'REJECTED' },
        ]}
        currentSort={activeTab}
        onSortChange={(tabKey) => {
          setSearch('');
          setActiveTab(tabKey);
        }}
        variant="default"
        className="px-0 py-0 border-0"
      />

      {/* Error notification banner with retry */}
      {status === 'failed' && error && (
        <ErrorBanner
          message={error}
          onRetry={() => loadData(1, false)}
          className="my-1"
        />
      )}
    </View>
  );

  return (
    <ScreenShell
      title={t('admin_gate_audit_logs', 'Admin Gate Audit Logs')}
      subtitle={t('complete_community_entry_exit_logs_times', 'Complete community entry/exit logs & timestamp security audit')}
      iconName="ShieldCheck"
      headerRight={
        <ExportReportButton onExport={handleExportCSV} loading={exporting} />
      }
    >
      <View className="flex-1 bg-background">
        {/* Virtualized Paginated Audit Log Feed */}
        <PaginatedList<AdminGateLogItem>
          data={filteredLogs}
          pagination={{
            currentPage: pagination.currentPage,
            totalPages: pagination.totalPages,
            totalRecords: pagination.totalRecords,
            limit: pagination.limit,
          }}
          onLoadMore={handleLoadMore}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          loading={status === 'loading' && !refreshing && !loadingMore && gateLogs.length === 0}
          ListHeaderComponent={renderHeader()}
          emptyIcon="ClipboardList"
          emptyTitle={t('no_audit_logs_found', 'No Audit Logs Found')}
          emptySubtitle={t('no_visitor_entry_exit_records_match_your_filt', 'No visitor entry/exit records match your filter criteria.')}
          contentContainerClassName="px-4 pt-2 pb-28"
          renderItem={(log) => (
            <AdminGateLogCard
              key={log._id}
              log={log}
              onForceCheckout={handleOpenForceCheckout}
              onPress={handleOpenDetails}
            />
          )}
        />
      </View>

      {/* Admin Force Checkout Confirmation Modal */}
      <AdminForceCheckoutModal
        visible={checkoutModalOpen}
        visitorName={selectedLog?.visitorName}
        loading={actionStatus === 'loading'}
        onClose={() => {
          setCheckoutModalOpen(false);
          setSelectedLog(null);
        }}
        onConfirm={handleConfirmForceCheckout}
      />

      {/* Full Pass Detail Inspector Modal */}
      <VisitorLogDetailsModal
        visible={detailsModalOpen}
        pass={selectedPassForModal}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedPassForModal(null);
        }}
      />
    </ScreenShell>
  );
}

/** The audit log is an admin console; deep links must not bypass the role. */
export default function AdminGateLogsScreen() {
  const authUser = useSelector(selectAuthUser);
  const hasAdminAccess = isFeatureAllowedForUser({ id: 'visitor_admin_logs', permission: 'visitor:admin' }, authUser);
  if (authUser && !hasAdminAccess) {
    return <Redirect href="/(resident)/dashboard" />;
  }
  return <AdminGateLogsContent />;
}
