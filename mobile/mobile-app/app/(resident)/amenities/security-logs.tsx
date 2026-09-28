import React, { useState, useMemo } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { KPIRow } from '@/components/ui/KPIRow';
import { KPICardProps } from '@/components/ui/KPICard';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Button } from '@/components/ui/button';
import { AmenitySecurityLogCard } from '@/src/features/amenities/components/AmenitySecurityLogCard';
import { SecurityLogDetailModal } from '@/src/features/amenities/components/SecurityLogDetailModal';
import { SecurityLog } from '@/src/features/amenities/services/securityLogApi';
import { useSecurityLogs } from '@/src/features/amenities/hooks/useSecurityLogs';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';

export default function AmenitySecurityLogsScreen() {
  const { user } = useAuth();

  // Guard: Users without security guard / log permissions are redirected
  const hasLogsAccess =
    isFeatureAllowedForUser({ id: 'amenities_security_logs', permission: 'amenities:security_logs' }, user) ||
    isFeatureAllowedForUser({ id: 'amenities_dashboard', permission: 'amenities:dashboard' }, user) ||
    isFeatureAllowedForUser({ id: 'amenities_master', permission: 'amenities:amenities' }, user);

  if (user && !hasLogsAccess) {
    if (isFeatureAllowedForUser({ id: 'amenities_discover', permission: 'amenities:discover' }, user)) {
      return <Redirect href="/(resident)/amenities/discover" />;
    }
    return <Redirect href="/(resident)/dashboard" />;
  }
  const {
    logs,
    dashboard,
    pagination,
    filters,
    loading,
    error,
    loadData,
    handleFilterChange,
    handlePageChange,
    handleClearFilters,
    handleDeleteLog,
  } = useSecurityLogs();

  const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null);

  const scanTypeTabs = useMemo(
    () => [
      { value: '', label: 'All Types' },
      { value: 'Entry', label: 'Entry' },
      { value: 'Exit', label: 'Exit' },
      { value: 'Denied', label: 'Denied' },
      { value: 'Manual Verification', label: 'Manual' },
    ],
    []
  );

  const activeVisitors = Math.max(0, (dashboard?.entries || 0) - (dashboard?.exits || 0));

  const kpiCards: KPICardProps[] = useMemo(
    () => [
      {
        title: "Today's Entries",
        value: dashboard?.entries || 0,
        iconName: 'DoorOpen',
        variant: 'success',
      },
      {
        title: "Today's Exits",
        value: dashboard?.exits || 0,
        iconName: 'DoorClosed',
        variant: 'info',
      },
      {
        title: 'Denied Access',
        value: dashboard?.denied || 0,
        iconName: 'ShieldAlert',
        variant: 'destructive',
      },
      {
        title: 'Active in Facility',
        value: activeVisitors,
        iconName: 'Users',
        variant: 'default',
      },
    ],
    [dashboard?.entries, dashboard?.exits, dashboard?.denied, activeVisitors]
  );

  const renderHeader = () => (
    <View className="mb-3 gap-3">
      {/* 2x2 Telemetry Header KPI Grid */}
      <KPIRow layout="grid" cards={kpiCards} loading={loading && logs.length === 0} className="px-0" />

      {/* Search & Moveable Slide Status Filter Bar */}
      <View className="gap-2.5">
        <SearchFilterBar
          searchValue={filters.search || ''}
          onSearchChange={(text) => handleFilterChange('search', text)}
          searchPlaceholder="Search resident, amenity, guard..."
          sortOptions={scanTypeTabs}
          currentSort={filters.scanType || ''}
          onSortChange={(tabKey) => handleFilterChange('scanType', tabKey)}
          variant="default"
          className="px-0 py-0 border-0"
        />

        {Boolean(filters.search || filters.scanType) && (
          <Button
            variant="outline"
            size="sm"
            onPress={handleClearFilters}
            className="self-end py-1 h-8"
          >
            Clear Filters
          </Button>
        )}
      </View>

      {/* Error Retry Banner */}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={loadData}
          className="my-1"
        />
      )}
    </View>
  );

  return (
    <ScreenShell
      title="Security Audit Logs"
      subtitle="Gate scanner verification audit logs & real-time entry history"
      iconName="ClipboardList"
      loading={loading && logs.length === 0}
      error={error}
      onRetry={loadData}
    >
      <View className="flex-1 bg-background">
        {/* Virtualized Paginated Log List */}
        <PaginatedList<SecurityLog>
          data={logs}
          renderItem={(item) => (
            <AmenitySecurityLogCard
              key={item._id}
              log={item}
              onPress={setSelectedLog}
            />
          )}
          pagination={{
            currentPage: (pagination as any).currentPage || pagination.page || 1,
            totalPages: pagination.totalPages || 1,
            totalRecords: (pagination as any).totalRecords || pagination.total || logs.length,
            limit: pagination.limit || 20,
          }}
          onLoadMore={() => {
            const current = (pagination as any).currentPage || pagination.page || 1;
            if (current < pagination.totalPages) {
              handlePageChange(current + 1);
            }
          }}
          onRefresh={loadData}
          loading={loading}
          paginationSummary
          ListHeaderComponent={renderHeader()}
          emptyIcon="ClipboardList"
          emptyTitle="No Audit Logs Found"
          emptySubtitle="Security scanner logs matching your search and filter will appear here."
          contentContainerClassName="px-4 pt-2 pb-28"
        />
      </View>

      {/* Security Log Details Inspection Modal */}
      <SecurityLogDetailModal
        visible={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        onDelete={handleDeleteLog}
        log={selectedLog}
      />
    </ScreenShell>
  );
}
