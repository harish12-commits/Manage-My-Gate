/**
 * Amenity ledger: every booking with its money, laid out like the visitor Admin Gate
 * Audit Logs — search and status pills above a paginated list, export in the header.
 */
import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { ExportReportButton } from '@/components/analytics/ExportReportButton';
import { Text } from '@/components/ui/text';
import { downloadCSVFile } from '@/src/utils/downloadHelper';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';
import { useTranslation } from '@/src/utils/i18n';
import { useAdminLedgers } from '@/src/features/amenities/hooks/useAdminLedgers';
import { AmenityLedgerCard, ledgerState } from '@/src/features/amenities/components/AmenityLedgerCard';
import { AmenityLedgerDetailSheet } from '@/src/features/amenities/components/AmenityLedgerDetailSheet';
import type { AmenityBooking, AmenityLedgerView } from '@/src/features/amenities/store/amenityBookingSlice';
import { formatAmenityAmount } from '@/src/features/amenities/utils/amenityStateHelpers';

const csvCell = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;

function AmenityLedgerContent() {
  const { t } = useTranslation();
  const ledger = useAdminLedgers();
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const rows = await ledger.fetchAllForExport();
      if (!rows.length) {
        Alert.alert(
          t('amenity_ledger_export_empty_title', 'Nothing to export'),
          t('amenity_ledger_export_empty', 'No ledger entries match the current filter.')
        );
        return;
      }
      const headers = [
        'Booking #',
        'Facility',
        'Space / item',
        'Resident',
        'Unit',
        'Date',
        'Start',
        'End',
        'Party size',
        'Status',
        'Total (INR)',
        'Deposit (INR)',
        'Paid (INR)',
        'Paid by',
        'Balance due (INR)',
        'Refunded (INR)',
      ];
      const lines = rows.map((b: AmenityBooking) => {
        const any = b as any;
        return [
          b.reservationNumber || b.bookingId || b._id,
          b.amenityName,
          any.resourceName || '',
          b.residentName,
          any.villaNumber || any.flatNumber || '',
          b.date,
          b.startTime,
          b.endTime,
          b.numberOfPersons || 1,
          ledgerState(b).label,
          any.bookingAmount ?? b.totalFee ?? 0,
          any.depositAmount || 0,
          any.paidAmount || 0,
          any.paymentMethod || '',
          any.remainingAmount || 0,
          any.refundAmount || 0,
        ]
          .map(csvCell)
          .join(',');
      });
      await downloadCSVFile([headers.join(','), ...lines].join('\n'), `amenity_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err: any) {
      Alert.alert(t('amenity_ledger_export_failed', 'Export failed'), err?.message || String(err));
    } finally {
      setExporting(false);
    }
  };

  const summary = ledger.summary;

  const renderHeader = () => (
    <View className="gap-3 mb-3">
      <SearchFilterBar
        searchValue={ledger.search}
        onSearchChange={ledger.setSearch}
        searchPlaceholder={t('amenity_ledger_search', 'Search booking # or resident...')}
        sortOptions={[
          { label: t('amenity_ledger_all', 'All Entries'), value: 'ALL' },
          { label: t('amenity_ledger_state_paid', 'Paid'), value: 'PAID' },
          { label: t('amenity_ledger_state_due', 'Balance due'), value: 'DUE' },
          { label: t('amenity_ledger_state_refunded', 'Refunded'), value: 'REFUNDED' },
          { label: t('amenity_ledger_state_cancelled', 'Cancelled'), value: 'CANCELLED' },
        ]}
        currentSort={ledger.view}
        onSortChange={(value) => ledger.setView(value as AmenityLedgerView)}
        variant="default"
        className="px-0 py-0 border-0"
      />

      {summary ? (
        <Text testID="ledger-summary" variant="muted" className="text-xs px-1">
          {t('amenity_ledger_summary', '{count} bookings · Net {net} · Due {due} · Refunded {refunded}', {
            count: summary.totalBookings,
            net: formatAmenityAmount(summary.totalRevenue),
            due: formatAmenityAmount(summary.pendingPayments),
            refunded: formatAmenityAmount(summary.refundedAmount),
          })}
        </Text>
      ) : null}

      {ledger.error ? <ErrorBanner message={ledger.error} onRetry={ledger.retry} className="my-1" /> : null}
    </View>
  );

  return (
    <ScreenShell
      title={t('amenity_ledger_title', 'Amenity Ledger')}
      subtitle={t('amenity_ledger_sub', 'Every booking with its payments, balances and refunds')}
      iconName="Receipt"
      headerRight={<ExportReportButton onExport={handleExportCSV} loading={exporting} />}
    >
      <View className="flex-1 bg-background">
        <PaginatedList<AmenityBooking>
          data={ledger.items}
          keyExtractor={(item) => item._id}
          renderItem={(item) => <AmenityLedgerCard key={item._id} booking={item} onPress={ledger.select} />}
          pagination={ledger.pagination}
          onLoadMore={ledger.loadMore}
          onRefresh={ledger.refresh}
          refreshing={ledger.refreshing}
          loading={ledger.loading && !ledger.refreshing && ledger.items.length === 0}
          ListHeaderComponent={renderHeader()}
          emptyIcon="Receipt"
          emptyTitle={t('amenity_ledger_empty_title', 'No Ledger Entries Found')}
          emptySubtitle={t('amenity_ledger_empty', 'No bookings match your filter.')}
          contentContainerClassName="px-4 pt-2 pb-28"
        />
      </View>

      <AmenityLedgerDetailSheet booking={ledger.selected} visible={!!ledger.selected} onClose={() => ledger.select(null)} />
    </ScreenShell>
  );
}

/** The ledger is staff-only; deep links must not bypass the role. */
export default function AmenityLedgersScreen() {
  const { user } = useAuth();
  const allowed =
    isFeatureAllowedForUser({ id: 'amenities_ledgers', permission: 'amenities:ledgers' }, user) ||
    isFeatureAllowedForUser({ id: 'amenities_dashboard', permission: 'amenities:dashboard' }, user);
  if (user && !allowed) return <Redirect href="/(resident)/dashboard" />;
  return <AmenityLedgerContent />;
}
