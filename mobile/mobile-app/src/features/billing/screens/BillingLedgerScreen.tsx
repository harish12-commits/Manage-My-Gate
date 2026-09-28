import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/common/Button';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { ShieldAlert } from 'lucide-react-native';
import { InvoiceCard } from '../components/InvoiceCard';
import { InvoiceActionsBottomSheet } from '../components/InvoiceActionsBottomSheet';
import { AdminOfflineSettleSheet } from '../components/AdminOfflineSettleSheet';
import { LedgerQRScannerModal } from '../components/LedgerQRScannerModal';
import { LedgerFilterDrawer, LedgerFilterValues } from '../components/LedgerFilterDrawer';
import { LedgerGroupingToggle, LedgerGroupingMode } from '../components/LedgerGroupingToggle';
import { UnitLedgerGroupCard } from '../components/grouping/UnitLedgerGroupCard';
import { ResidentLedgerGroupCard } from '../components/grouping/ResidentLedgerGroupCard';
import { CycleLedgerGroupCard } from '../components/grouping/CycleLedgerGroupCard';
import { Invoice } from '../types';
import { useBilling } from '../hooks/useBilling';
import { useBillingSocket } from '../hooks/useBillingSocket';
import { parseAndValidateAppBarcode } from '@/src/utils/appBarcodeProtocol';
import { useTranslation } from '@/src/utils/i18n';

export function BillingLedgerScreen() {
  const { t, hasKey } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string; invoiceId?: string }>();
  const initialStatus =
    params.status &&
    ['ALL', 'VERIFICATION_PENDING', 'OVERDUE', 'UNPAID', 'PARTIALLY_PAID', 'PAID'].includes(params.status)
      ? params.status
      : 'ALL';

  const {
    invoicesList,
    statusCounts,
    pagination,
    loadingStates,
    error,
    activeOrgId,
    changeTablePage,
    approveOffline,
    rejectOffline,
    resetBillingError,
  } = useBilling();

  // Socket sync for real-time ledger updates
  useBillingSocket();

  // Permission check from auth state
  const hasLedgerPermission = useSelector((state: any) => {
    const role = state.auth?.user?.role || '';
    const adminRoles = [
      'Super Admin',
      'Platform Super Admin',
      'Community Admin',
      'Admin',
      'SuperAdmin',
      'Finance Manager',
      'Finance Admin',
    ];
    if (adminRoles.includes(role)) return true;
    const permissions = state.auth?.user?.permissions;
    if (!Array.isArray(permissions)) return false;
    return (
      permissions.includes('billing:dashboard') ||
      permissions.includes('billing:assessment_manager') ||
      permissions.includes('*')
    );
  });

  // `/billing/ledger` is retained for deep-link compatibility, but the ledger
  // itself is an admin-only tool. Residents go directly to their own dues.
  useEffect(() => {
    if (!hasLedgerPermission) {
      router.replace('/(resident)/billing/my-dues' as any);
    }
  }, [hasLedgerPermission, router]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  // Sync if route params change while mounted
  useEffect(() => {
    if (
      params.status &&
      ['ALL', 'VERIFICATION_PENDING', 'OVERDUE', 'UNPAID', 'PARTIALLY_PAID', 'PAID'].includes(params.status)
    ) {
      setStatusFilter(params.status);
    }
  }, [params.status]);
  const [groupMode, setGroupMode] = useState<LedgerGroupingMode>('flat');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [settleInvoice, setSettleInvoice] = useState<Invoice | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Auto-open invoice if navigated with invoiceId
  useEffect(() => {
    if (params.invoiceId && groupMode === 'flat' && !loadingStates.fetchGrid && invoicesList.length > 0) {
      const targetInvoice = invoicesList.find((inv: any) => inv._id === params.invoiceId);
      if (targetInvoice) {
        setSelectedInvoice(targetInvoice);
        router.setParams({ invoiceId: '' });
      }
    }
  }, [params.invoiceId, groupMode, loadingStates.fetchGrid, invoicesList, router]);

  const lastScannedCodeRef = useRef<string>('');

  // Auto-open invoice when scanned code matches an invoice in the fetched list
  useEffect(() => {
    if (lastScannedCodeRef.current && groupMode === 'flat' && !loadingStates.fetchGrid && invoicesList.length > 0) {
      const matchTerm = lastScannedCodeRef.current.toLowerCase();
      const targetInvoice = invoicesList.find((inv: any) =>
        String(inv.invoiceNumber || '').toLowerCase() === matchTerm ||
        String(inv._id || '').toLowerCase() === matchTerm ||
        String(inv.id || '').toLowerCase() === matchTerm ||
        String(inv.offlineReference || '').toLowerCase() === matchTerm
      );
      if (targetInvoice) {
        setSelectedInvoice(targetInvoice);
        lastScannedCodeRef.current = '';
      } else if (invoicesList.length === 1 && search.trim()) {
        setSelectedInvoice(invoicesList[0]);
        lastScannedCodeRef.current = '';
      }
    }
  }, [invoicesList, groupMode, loadingStates.fetchGrid, search]);

  // Advanced filters state
  const [activeFilters, setActiveFilters] = useState<LedgerFilterValues>({
    startDate: '',
    endDate: '',
    datePreset: 'ALL_TIME',
    block: 'ALL',
    paymentMethod: 'ALL',
  });

  const handleScannedCode = useCallback(
    (scannedCode: string) => {
      if (!scannedCode) return;
      setShowScanner(false);

      const parsed = parseAndValidateAppBarcode(scannedCode);
      const targetCode = (parsed.isValid && (parsed.code || parsed.passId))
        ? (parsed.code || parsed.passId || '').trim()
        : scannedCode.replace(/^[#]/, '').trim();

      lastScannedCodeRef.current = targetCode;

      // 1. Reset all restrictive filters so the scanned record is always returned
      setStatusFilter('ALL');
      setGroupMode('flat');
      setActiveFilters({
        startDate: '',
        endDate: '',
        datePreset: 'ALL_TIME',
        block: 'ALL',
        paymentMethod: 'ALL',
      });

      // 2. Set search to the extracted clean invoice number / ID
      setSearch(targetCode);

      // 3. Immediately query backend with status ALL
      changeTablePage(1, {
        search: targetCode,
        status: 'ALL',
        groupBy: 'none',
      });
    },
    [changeTablePage]
  );

  // Calculate active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter && statusFilter !== 'ALL') count++;
    if (activeFilters.startDate || activeFilters.endDate) count++;
    if (activeFilters.block && activeFilters.block !== 'ALL') count++;
    if (activeFilters.paymentMethod && activeFilters.paymentMethod !== 'ALL') count++;
    return count;
  }, [activeFilters, statusFilter]);

  // Combined query params object
  const currentQueryParams = useMemo(() => ({
    search,
    status: statusFilter,
    startDate: activeFilters.startDate || undefined,
    endDate: activeFilters.endDate || undefined,
    block: activeFilters.block !== 'ALL' ? activeFilters.block : undefined,
    paymentMethod: activeFilters.paymentMethod !== 'ALL' ? activeFilters.paymentMethod : undefined,
    groupBy: groupMode === 'flat' ? 'none' : groupMode,
  }), [search, statusFilter, activeFilters, groupMode]);

  // Dynamic status pill options with live count badges
  const statusSortOptions = useMemo(() => [
    { label: `${t('all_statuses', 'All Statuses')}${statusCounts?.ALL !== undefined ? ` (${statusCounts.ALL})` : ''}`, value: 'ALL' },
    { label: `${t('status_verification_pending', 'Pending')}${statusCounts?.VERIFICATION_PENDING !== undefined ? ` (${statusCounts.VERIFICATION_PENDING})` : ''}`, value: 'VERIFICATION_PENDING' },
    { label: `${t('status_overdue', 'Overdue')}${statusCounts?.OVERDUE !== undefined ? ` (${statusCounts.OVERDUE})` : ''}`, value: 'OVERDUE' },
    { label: `${t('status_unpaid', 'Unpaid')}${statusCounts?.UNPAID !== undefined ? ` (${statusCounts.UNPAID})` : ''}`, value: 'UNPAID' },
    { label: `${t('status_partially_paid', 'Partially Paid')}${statusCounts?.PARTIALLY_PAID !== undefined ? ` (${statusCounts.PARTIALLY_PAID})` : ''}`, value: 'PARTIALLY_PAID' },
    { label: `${t('status_paid', 'Paid')}${statusCounts?.PAID !== undefined ? ` (${statusCounts.PAID})` : ''}`, value: 'PAID' },
  ], [statusCounts, t]);

  // Trigger server-side query when status filter, advanced filters, grouping mode, or active organization changes
  useEffect(() => {
    if (hasLedgerPermission) {
      changeTablePage(1, currentQueryParams);
    }
  }, [statusFilter, activeFilters, groupMode, hasLedgerPermission, activeOrgId]);

  // Debounced search trigger (300ms)
  useEffect(() => {
    if (!hasLedgerPermission) return;
    const timer = setTimeout(() => {
      changeTablePage(1, currentQueryParams);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, hasLedgerPermission, activeOrgId]);

  const handleRefresh = useCallback(() => {
    changeTablePage(1, currentQueryParams);
  }, [changeTablePage, currentQueryParams]);

  const handleLoadMore = useCallback(() => {
    if (pagination.currentPage < pagination.totalPages && !loadingStates.fetchGrid) {
      changeTablePage(pagination.currentPage + 1, currentQueryParams);
    }
  }, [changeTablePage, pagination, currentQueryParams, loadingStates.fetchGrid]);

  // Differentiated Empty Subtitles (Must be declared before any conditional return)
  const emptySubtitle = useMemo(() => {
    if (search.trim()) return t('no_billing_records_matching_search', `No billing records match "${search.trim()}".`, { search: search.trim() });
    if (statusFilter !== 'ALL') {
      const statusKey = `status_${statusFilter.toLowerCase()}`;
      const statusName = hasKey(statusKey) ? t(statusKey) : statusFilter.replace(/_/g, ' ');
      return `${t('no_invoices_matching_filter', 'No invoice records match status filter')} "${statusName}".`;
    }
    return t('no_community_billing_records', 'No community billing records found in the ledger.');
  }, [search, statusFilter, t, hasKey]);

  // Guaranteed unique key extractor for FlatList across all ledger modes
  const ledgerKeyExtractor = useCallback((item: any, index: number): string => {
    if (!item) return `ledger-item-${index}`;
    if (groupMode === 'cycle') {
      const period = item.billingPeriodString || (typeof item._id === 'object' ? item._id?.period : '') || '';
      const assess = item.assessmentName || (typeof item._id === 'object' ? item._id?.assessmentId : '') || '';
      return `cycle-${period}-${assess}-${index}`;
    }
    if (groupMode === 'unit') {
      const unit = item.unitNumber || item.unitId || (typeof item._id === 'string' ? item._id : '') || '';
      return `unit-${unit}-${index}`;
    }
    if (groupMode === 'resident') {
      const resident = item.residentName || item.residentId || (typeof item._id === 'string' ? item._id : '') || '';
      return `resident-${resident}-${index}`;
    }
    if (typeof item._id === 'string' && item._id) return item._id;
    if (item.invoiceNumber) return String(item.invoiceNumber);
    if (typeof item.id === 'string' && item.id) return item.id;
    return `invoice-${index}`;
  }, [groupMode]);

  return (
    <ScreenShell
      title="Billing Ledger"
      subtitle={
        !hasLedgerPermission
          ? 'Access Restricted'
          : `Total ${pagination.totalRecords || 0} community invoices`
      }
      iconName="Receipt"
      loading={hasLedgerPermission && loadingStates.fetchGrid && invoicesList.length === 0}
    >
      {!hasLedgerPermission ? (
        <View className="flex-1 bg-background p-6 items-center justify-center">
          <View className="w-16 h-16 rounded-full bg-destructive/10 items-center justify-center mb-4">
            <Icon as={ShieldAlert} size={32} className="text-destructive" />
          </View>
          <Text className="text-xl font-bold text-foreground text-center mb-2">Access Denied</Text>
          <Text className="text-sm text-muted-foreground text-center mb-6 px-4">
            You do not have the required administrative permission (<Text className="font-mono text-xs font-bold">billing:dashboard</Text>) to inspect community ledgers.
          </Text>
          <Button
            variant="default"
            size="lg"
            onPress={() => router.push('/(resident)/billing/my-dues' as any)}
            accessibilityRole="button"
            accessibilityLabel="Return to My Dues"
          >
            Return to My Dues
          </Button>
        </View>
      ) : (
        <View className="flex-1 bg-background">
          {/* Error Banner */}
          {error ? (
            <View className="px-4 pt-2">
              <ErrorBanner message={error} onDismiss={resetBillingError} />
            </View>
          ) : null}

          {/* Unified Filter Pills (Row 2) & Search Input with Scanner & Filter Drawer trigger (Row 1) */}
          <SearchFilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('search_ledger_placeholder', "Search unit 'Villa 104', Chq #, or resident...")}
            sortOptions={statusSortOptions}
            currentSort={statusFilter}
            onSortChange={(val) => setStatusFilter(val as any)}
            onScanPress={() => setShowScanner(true)}
            onFilterPress={() => setShowFilterDrawer(true)}
            filterTitle={t('filter_ledger_options', 'Filter Ledger Options')}
            activeFilterCount={activeFilterCount}
          />

          {/* Multi-Mode Grouping Toggle (Row 4) */}
          <LedgerGroupingToggle
            mode={groupMode}
            onModeChange={setGroupMode}
          />

          {/* Paginated Cards List (Flat or Grouped View) */}
          <PaginatedList<any>
            data={invoicesList}
            keyExtractor={ledgerKeyExtractor}
            renderItem={(item) => {
              if (groupMode === 'unit') {
                return (
                  <UnitLedgerGroupCard
                    key={item._id || item.unitNumber}
                    unitGroup={item}
                    onSelectInvoice={(inv) => setSelectedInvoice(inv)}
                  />
                );
              }
              if (groupMode === 'resident') {
                return (
                  <ResidentLedgerGroupCard
                    key={item._id || item.residentName}
                    residentGroup={item}
                    onSelectInvoice={(inv) => setSelectedInvoice(inv)}
                  />
                );
              }
              if (groupMode === 'cycle') {
                return (
                  <CycleLedgerGroupCard
                    key={`${item.billingPeriodString}_${item.assessmentName}`}
                    cycleGroup={item}
                    onSelectInvoice={(inv) => setSelectedInvoice(inv)}
                  />
                );
              }
              return (
                <InvoiceCard
                  key={item._id || item.invoiceNumber}
                  invoice={item}
                  onPress={() => setSelectedInvoice(item)}
                />
              );
            }}
            pagination={pagination}
            onLoadMore={handleLoadMore}
            onRefresh={handleRefresh}
            loading={loadingStates.fetchGrid}
            emptyIcon="Receipt"
            emptyTitle={t('no_records_found', 'No Records Found')}
            emptySubtitle={emptySubtitle}
            paginationSummary
            contentContainerClassName="px-4 py-2 pb-28"
            contentContainerStyle={{ paddingBottom: 110 }}
          />

        {/* Advanced Filter Drawer */}
        <LedgerFilterDrawer
          visible={showFilterDrawer}
          onClose={() => setShowFilterDrawer(false)}
          filters={{ ...activeFilters, status: statusFilter }}
          onApply={(newFilters) => {
            if (newFilters.status) {
              setStatusFilter(newFilters.status);
            }
            setActiveFilters(newFilters);
          }}
          onReset={() => {
            setStatusFilter('ALL');
            setActiveFilters({
              startDate: '',
              endDate: '',
              datePreset: 'ALL_TIME',
              block: 'ALL',
              paymentMethod: 'ALL',
              status: 'ALL',
            });
          }}
        />

        {/* Hardware QR / Barcode Scanner Modal */}
        <LedgerQRScannerModal
          visible={showScanner}
          onClose={() => setShowScanner(false)}
          onScanCode={handleScannedCode}
        />

        {/* Quick Actions / Review Details BottomSheet */}
        <InvoiceActionsBottomSheet
          visible={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          invoice={selectedInvoice}
          onApproveOffline={approveOffline}
          onRejectOffline={rejectOffline}
          onSettleOfflineModal={(inv) => setSettleInvoice(inv)}
        />

        {/* Admin Offline Payment Settlement Sheet */}
        <AdminOfflineSettleSheet
          visible={!!settleInvoice}
          onClose={() => setSettleInvoice(null)}
          invoice={settleInvoice}
          onSuccess={() => {
            changeTablePage(pagination?.currentPage || 1, currentQueryParams);
          }}
        />
      </View>
      )}
    </ScreenShell>
  );
}

export default BillingLedgerScreen;
