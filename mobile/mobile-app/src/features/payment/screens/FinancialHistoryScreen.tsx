/**
 * NAHOM / Connect Harmony - Mobile Phase 3: FinancialHistoryScreen
 * Unified resident-facing financial history across Invoices, Amenities, Wallet & Refunds.
 * Strictly presentation-only: never modifies or persists local financial records.
 */

import React, { useMemo, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { TabBar } from '@/components/ui/TabBar';
import { TextInput } from '@/components/forms/TextInput';
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
import { Search, AlertCircle, Receipt } from 'lucide-react-native';

export function FinancialHistoryScreen() {
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

  // Filter tab configuration
  const filterTabs = useMemo(
    () => [
      { key: 'ALL', label: 'All' },
      { key: 'PAYMENTS', label: 'Payments' },
      { key: 'INVOICES', label: 'Invoices' },
      { key: 'AMENITIES', label: 'Amenities' },
      { key: 'WALLET', label: 'Wallet' },
      { key: 'REFUNDS', label: 'Refunds' },
    ],
    []
  );

  const handleOpenReceipt = (invoice: any) => {
    setActiveReceiptInvoice(invoice);
  };

  const renderHeader = () => (
    <View className="gap-3 mb-3">
      {/* Search Input Bar */}
      <View className="bg-card border border-border rounded-2xl px-3 py-1 shadow-xs">
        <TextInput
          placeholder="Search by invoice #, booking ID, or keyword..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={16} className="text-muted-foreground" />}
          clearButtonMode="while-editing"
          className="border-0 bg-transparent px-0 py-1"
        />
      </View>

      {/* Partial Domain Failure Banner (Section 30) */}
      {partialError && (
        <ErrorBanner
          message={partialError}
          onRetry={refresh}
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

      {/* Filter Category Tabs (Section 18) */}
      <View className="bg-card border border-border rounded-2xl p-1 shadow-xs">
        <TabBar
          tabs={filterTabs}
          activeTab={selectedTab}
          onTabChange={(tab) => setSelectedTab(tab as FinancialHistoryFilterTab)}
          variant="pill"
        />
      </View>
    </View>
  );

  const renderEmptyState = () => {
    if (isLoading) return null;

    if (hasAllFailed) {
      return (
        <EmptyState
          icon={AlertCircle}
          title="Records Unavailable"
          description="Failed to retrieve financial history records from the server."
          actionLabel="Retry"
          onAction={refresh}
          className="py-12"
        />
      );
    }

    if (searchQuery.trim().length > 0) {
      return (
        <EmptyState
          icon={Search}
          title="No Matching Records"
          description={`No financial transactions match "${searchQuery}".`}
          className="py-12"
        />
      );
    }

    if (selectedTab === 'INVOICES') {
      return (
        <EmptyState
          icon={Receipt}
          title="No Invoices"
          description="No outstanding invoices."
          className="py-12"
        />
      );
    }

    if (selectedTab === 'WALLET') {
      return (
        <EmptyState
          icon={Receipt}
          title="No Wallet Transactions"
          description="No wallet transactions yet."
          className="py-12"
        />
      );
    }

    if (selectedTab === 'AMENITIES') {
      return (
        <EmptyState
          icon={Receipt}
          title="No Amenity Bookings"
          description="No amenity payment history yet."
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
        title="No Financial Transactions Yet"
        description="No financial transactions yet."
        className="py-12"
      />
    );
  };

  return (
    <ScreenShell
      title="Financial History"
      subtitle="Unified chronological statement of payments, dues & transactions"
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
