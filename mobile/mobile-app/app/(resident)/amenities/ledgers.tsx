import React, { useMemo, useState } from 'react';
import { View, Alert } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { KPIRow } from '@/components/ui/KPIRow';
import { KPICardProps } from '@/components/ui/KPICard';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { Text } from '@/components/ui/text';
import { ExportReportButton } from '@/components/analytics/ExportReportButton';
import { downloadCSVFile } from '@/src/utils/downloadHelper';
import { useAdminLedgers } from '@/src/features/amenities/hooks/useAdminLedgers';
import { BookingDetailModal } from '@/src/features/amenities/components/BookingDetailModal';
import { AmenityLedgerCard } from '@/src/features/amenities/components/AmenityLedgerCard';
import { AmenityBooking } from '@/src/features/amenities/store/amenityBookingSlice';

export default function AmenityLedgersScreen() {
  const {
    adminBookings,
    filteredBookings,
    amenities,
    pagination,
    currentPage,
    handlePageChange,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    paymentStatusFilter,
    setPaymentStatusFilter,
    selectedAmenityId,
    setSelectedAmenityId,
    selectedLedgerDetail,
    setSelectedLedgerDetail,
    kpis,
    loading,
    error,
    handleRefresh,
  } = useAdminLedgers();

  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    if (!filteredBookings || filteredBookings.length === 0) {
      Alert.alert('No Data to Export', 'There are no financial ledger entries matching the current filter.');
      return;
    }

    try {
      setExporting(true);
      const headers = [
        'Booking Ref ID',
        'Resident Name',
        'Unit / Villa',
        'Amenity Name',
        'Booking Date',
        'Start Time',
        'End Time',
        'Persons',
        'Total Amount (INR)',
        'Payment Status',
        'Booking Status',
        'Payment Method',
        'Transaction Ref',
      ];

      const escapeCSV = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = filteredBookings.map((b: AmenityBooking) => {
        const userObj: any = b.userId || {};
        const amenityObj: any = b.amenityId || {};
        const residentName = userObj.name || userObj.username || b.userName || 'Community Resident';
        const villaUnit = b.villaNumber || userObj.villaNumber || userObj.flatNumber || userObj.unit || 'N/A';
        const amenityName = amenityObj.name || b.amenityName || 'Amenity';
        const totalAmt = b.pricingDetails?.totalAmount || b.totalPrice || b.bookingAmount || 0;

        return [
          escapeCSV(b.bookingId || b._id),
          escapeCSV(residentName),
          escapeCSV(villaUnit),
          escapeCSV(amenityName),
          escapeCSV(b.bookingDate || ''),
          escapeCSV(b.startTime || ''),
          escapeCSV(b.endTime || ''),
          escapeCSV(b.numberOfPersons || 1),
          escapeCSV(totalAmt),
          escapeCSV((b.paymentStatus || 'pending').toUpperCase()),
          escapeCSV((b.status || 'pending').toUpperCase()),
          escapeCSV(b.paymentMethod || 'Online'),
          escapeCSV(b.paymentId || b.razorpayTransactionId || 'N/A'),
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows.map((r) => r)].join('\n');
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `amenity_master_ledger_${dateStr}.csv`;
      await downloadCSVFile(csvContent, fileName);
    } catch (err) {
      console.error('Export CSV error:', err);
    } finally {
      setExporting(false);
    }
  };

  const amenityOptions = useMemo(() => {
    const opts = amenities.map((a) => ({ label: a.name, value: a._id }));
    return [{ label: 'All Facilities', value: 'All' }, ...opts];
  }, [amenities]);

  const statusOptions = [
    { label: 'All Statuses', value: 'All' },
    { label: 'Confirmed', value: 'CONFIRMED' },
    { label: 'Checked In', value: 'CHECKED_IN' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Cancelled', value: 'CANCELLED' },
  ];

  const paymentStatusOptions = [
    { label: 'All Payment Statuses', value: 'All' },
    { label: 'Paid', value: 'PAID' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Refunded', value: 'REFUNDED' },
    { label: 'Failed', value: 'FAILED' },
  ];

  const kpiCards: KPICardProps[] = useMemo(
    () => [
      {
        title: 'Total Revenue',
        value: `₹${kpis.totalMasterRevenue.toLocaleString('en-IN')}`,
        iconName: 'DollarSign',
        variant: 'success',
      },
      {
        title: 'Today Earnings',
        value: `₹${kpis.todayEarnings.toLocaleString('en-IN')}`,
        iconName: 'TrendingUp',
        variant: 'warning',
      },
      {
        title: 'Total Entries',
        value: kpis.totalEntries,
        iconName: 'Receipt',
        variant: 'info',
      },
    ],
    [kpis.totalMasterRevenue, kpis.todayEarnings, kpis.totalEntries]
  );

  const renderHeader = () => (
    <View className="mb-3 gap-3">
      {/* Financial Master KPI Summary */}
      <KPIRow cards={kpiCards} className="px-0" />

      {/* Search & Moveable Slide Status Filter Bar */}
      <SearchFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search booking ID, resident, villa #..."
        sortOptions={statusOptions}
        currentSort={statusFilter}
        onSortChange={setStatusFilter}
        variant="default"
        className="px-0 py-0 border-0"
      />

      {/* Facility & Payment Filter Bar */}
      <View className="flex-row gap-2">
        <View className="flex-1 bg-card p-2.5 rounded-2xl border border-border shadow-xs">
          <DropdownSelect
            label="Facility Filter"
            options={amenityOptions}
            value={selectedAmenityId}
            onValueChange={setSelectedAmenityId}
          />
        </View>
        <View className="flex-1 bg-card p-2.5 rounded-2xl border border-border shadow-xs">
          <DropdownSelect
            label="Payment Filter"
            options={paymentStatusOptions}
            value={paymentStatusFilter}
            onValueChange={setPaymentStatusFilter}
          />
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-1">
        <Text variant="large" className="font-bold text-foreground">
          Master Financial Ledger Entries ({filteredBookings.length})
        </Text>
        <ExportReportButton onExport={handleExportCSV} loading={exporting} />
      </View>
    </View>
  );

  return (
    <ScreenShell
      title="Master Ledgers & Accounts"
      subtitle="Financial accounts, master booking ledger & transaction audit trail"
      iconName="Receipt"
      headerRight={<ExportReportButton onExport={handleExportCSV} loading={exporting} />}
      loading={loading && adminBookings.length === 0}
      error={error}
      onRetry={handleRefresh}
    >
      <View className="flex-1 bg-background">
        <PaginatedList<AmenityBooking>
          data={filteredBookings}
          renderItem={(item: AmenityBooking) => (
            <AmenityLedgerCard
              key={item._id}
              booking={item}
              onPress={() => setSelectedLedgerDetail(item)}
              className="mb-2"
            />
          )}
          pagination={pagination}
          onLoadMore={() => {
            if (currentPage < pagination.totalPages) {
              handlePageChange(currentPage + 1);
            }
          }}
          onRefresh={handleRefresh}
          loading={loading}
          ListHeaderComponent={renderHeader()}
          emptyIcon="Receipt"
          emptyTitle="No Master Ledger Entries"
          emptySubtitle="No financial ledger entries match your filter."
          contentContainerClassName="px-4 pt-2 pb-28"
        />
      </View>

      {/* Booking Details Inspection Modal */}
      <BookingDetailModal
        visible={!!selectedLedgerDetail}
        onClose={() => setSelectedLedgerDetail(null)}
        booking={selectedLedgerDetail}
      />
    </ScreenShell>
  );
}
