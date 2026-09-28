/**
 * NAHOM / Connect Harmony - Mobile Phase 3: FinancialHistoryScreen
 * Unified resident-facing financial history across Invoices, Amenities, Wallet & Refunds.
 * Strictly presentation-only: never modifies or persists local financial records.
 */

import React, { useMemo, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useFinancialHistory } from '../hooks/useFinancialHistory';
import { useFinancialDiagnostics } from '../hooks/useFinancialDiagnostics';
import { FinancialHistoryItem, FinancialHistoryFilterTab } from '../types/financialHistory.types';
import { FinancialHistoryItemCard } from '../components/FinancialHistoryItemCard';
import { FinancialHistoryDetailModal } from '../components/FinancialHistoryDetailModal';
import { FinancialRecoveryBanner } from '../components/FinancialRecoveryBanner';
import { FinancialSupportModal } from '../components/FinancialSupportModal';
import { PaymentReceiptModal } from '../../billing/components/PaymentReceiptModal';
import { useTranslation } from '@/src/utils/i18n';
import { Layers, CreditCard, Receipt, Calendar, Wallet, RotateCcw, AlertCircle, Search } from 'lucide-react-native';

export function FinancialHistoryScreen() {
  const { t } = useTranslation();
  const {
    filteredItems,
    isLoading,
    isRefreshing,
    partialError,
    hasAllFailed,
    selectedTab,
    setSelectedTab,
    searchQuery,
    setSearchQuery,
    selectedItem,
    setSelectedItem,
    refresh,
  } = useFinancialHistory();

  const {
    unresolvedDiagnostics,
    isReconciling,
    reconcileAll,
    reconcileSingle,
    selectedDiagnostic,
    isSupportModalOpen,
    openSupportModal,
    closeSupportModal,
  } = useFinancialDiagnostics();

  const [activeReceiptInvoice, setActiveReceiptInvoice] = useState<any | null>(null);

  const sortOptions = useMemo(
    () => [
      { label: t('all', 'All'), value: 'ALL', icon: Layers },
      { label: t('payments', 'Payments'), value: 'PAYMENTS', icon: CreditCard },
      { label: t('invoices', 'Invoices'), value: 'INVOICES', icon: Receipt },
      { label: t('amenities', 'Amenities'), value: 'AMENITIES', icon: Calendar },
      { label: t('wallet', 'Wallet'), value: 'WALLET', icon: Wallet },
      { label: t('refunds', 'Refunds'), value: 'REFUNDS', icon: RotateCcw },
    ],
    [t]
  );

  const handleOpenReceipt = (invoice: any) => {
    setActiveReceiptInvoice(invoice);
  };

  const renderHeader = () => (
    <View className="gap-2.5 mb-3">
      {/* Canonical Search & Filter Bar */}
      <SearchFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t('search_financial_history_placeholder', 'Search by invoice #, booking ID, or keyword...')}
        sortOptions={sortOptions}
        currentSort={selectedTab}
        onSortChange={(tab) => setSelectedTab(tab as FinancialHistoryFilterTab)}
        filterTitle={t('filter_financial_history', 'Filter Financial Records')}
        variant="bordered"
        className="px-0 py-0 border-0"
      />

      {/* Partial Domain Failure Banner (Section 30) */}
      {partialError && (
        <ErrorBanner
          message={partialError}
          onRetry={refresh}
          className="my-0.5"
        />
      )}

      {/* Pending / Unresolved Operations Recovery Center */}
      <FinancialRecoveryBanner
        unresolvedDiagnostics={unresolvedDiagnostics}
        onCheckStatus={(diag) => reconcileSingle(diag.referenceType, diag.referenceId || '')}
        onOpenSupportInfo={openSupportModal}
        onReconcileAll={reconcileAll}
        isReconciling={isReconciling}
      />
    </View>
  );

  const renderEmptyState = () => {
    if (isLoading) return null;

    if (hasAllFailed) {
      return (
        <EmptyState
          icon={AlertCircle}
          title={t('records_unavailable', 'Records Unavailable')}
          description={t('failed_to_retrieve_financial_records', 'Failed to retrieve financial history records from the server.')}
          actionLabel={t('retry', 'Retry')}
          onAction={refresh}
          className="py-12"
        />
      );
    }

    if (searchQuery.trim().length > 0) {
      return (
        <EmptyState
          icon={Search}
          title={t('no_matching_records', 'No Matching Records')}
          description={`${t('no_financial_transactions_match', 'No financial transactions match')} "${searchQuery}".`}
          className="py-12"
        />
      );
    }

    if (selectedTab === 'INVOICES') {
      return (
        <EmptyState
          icon={Receipt}
          title={t('no_invoices', 'No Invoices')}
          description={t('no_outstanding_invoices', 'No outstanding invoices.')}
          className="py-12"
        />
      );
    }

    if (selectedTab === 'WALLET') {
      return (
        <EmptyState
          icon={Receipt}
          title={t('no_wallet_transactions', 'No Wallet Transactions')}
          description={t('no_wallet_transactions_yet', 'No wallet transactions yet.')}
          className="py-12"
        />
      );
    }

    if (selectedTab === 'AMENITIES') {
      return (
        <EmptyState
          icon={Receipt}
          title={t('no_amenity_bookings', 'No Amenity Bookings')}
          description={t('no_amenity_bookings', 'No amenity payment history yet.')}
          className="py-12"
        />
      );
    }

    if (selectedTab !== 'ALL') {
      return (
        <EmptyState
          icon={Receipt}
          title={`No ${selectedTab.replace(/_/g, ' ')} Records`}
          description={`You currently have no financial items in the "${selectedTab.toLowerCase()}" category.`}
          className="py-12"
        />
      );
    }

    return (
      <EmptyState
        icon={Receipt}
        title={t('no_financial_transactions_yet', 'No Financial Transactions Yet')}
        description={t('no_financial_transactions_yet', 'No financial transactions yet.')}
        className="py-12"
      />
    );
  };

  return (
    <ScreenShell
      title={t('financial_history', 'Financial History')}
      subtitle={t('financial_history_subtitle', 'Unified chronological statement of payments, dues & transactions')}
      iconName="Receipt"
      loading={isLoading}
    >
      <View className="flex-1 bg-background">
        <FlatList<FinancialHistoryItem>
          data={filteredItems}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={({ item }) => (
            <FinancialHistoryItemCard
              item={item}
              onPress={setSelectedItem}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerClassName="px-4 pt-3 pb-28"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor="#6366f1"
              colors={['#6366f1']}
            />
          }
        />
      </View>

      {/* Authoritative Detail Modal */}
      <FinancialHistoryDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onOpenReceipt={handleOpenReceipt}
      />

      {/* In-App Authoritative Receipt Modal */}
      <PaymentReceiptModal
        visible={!!activeReceiptInvoice}
        invoice={activeReceiptInvoice}
        onClose={() => setActiveReceiptInvoice(null)}
      />

      {/* Support Diagnostic Information Modal */}
      <FinancialSupportModal
        visible={isSupportModalOpen}
        diagnostic={selectedDiagnostic}
        onClose={closeSupportModal}
      />
    </ScreenShell>
  );
}

export default FinancialHistoryScreen;
