import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../../store/store';
import {
  fetchBookingQueueThunk,
  AmenityBooking,
} from '../store/amenityBookingSlice';
import { fetchWalletThunk } from '../../wallet/store/walletSlice';
import { fetchAmenitiesThunk } from '../store/amenitySlice';

export type LedgerViewMode = 'master' | 'wallet';

export function useAdminLedgers() {
  const dispatch = useDispatch<AppDispatch>();

  const [viewMode, setViewMode] = useState<LedgerViewMode>('master');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('All');
  const [selectedAmenityId, setSelectedAmenityId] = useState<string>('All');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedLedgerDetail, setSelectedLedgerDetail] = useState<AmenityBooking | null>(null);

  const { adminBookings, ledgerSummary, amenitySummary, pagination, loading, error } = useSelector(
    (state: RootState) => state.amenityBookings
  );
  const { balance, transactions, loading: walletLoading } = useSelector(
    (state: RootState) => (state as any).amenityWallet || state.wallet
  );
  const { amenities } = useSelector((state: RootState) => state.amenities);

  const loadMasterLedger = useCallback(
    (page: number = 1) => {
      dispatch(
        fetchBookingQueueThunk({
          page,
          limit: 10,
          search: searchQuery.trim() || undefined,
          status: statusFilter !== 'All' ? statusFilter : undefined,
          paymentStatus: paymentStatusFilter !== 'All' ? paymentStatusFilter : undefined,
          amenityId: selectedAmenityId !== 'All' ? selectedAmenityId : undefined,
          datePreset: datePreset !== 'all' && datePreset !== 'custom' ? datePreset : undefined,
          startDate: datePreset === 'custom' && startDate ? startDate : undefined,
          endDate: datePreset === 'custom' && endDate ? endDate : undefined,
        } as any)
      );
      dispatch(fetchAmenitiesThunk({}));
    },
    [dispatch, searchQuery, statusFilter, paymentStatusFilter, selectedAmenityId, datePreset, startDate, endDate]
  );

  const loadWalletLedger = useCallback(() => {
    dispatch(fetchWalletThunk());
  }, [dispatch]);

  useEffect(() => {
    if (viewMode === 'master') {
      loadMasterLedger(currentPage);
    } else {
      loadWalletLedger();
    }
  }, [viewMode, currentPage, loadMasterLedger, loadWalletLedger]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleRefresh = () => {
    if (viewMode === 'master') {
      loadMasterLedger(1);
    } else {
      loadWalletLedger();
    }
  };

  // Master Financial KPIs (from backend summary or computed as fallback)
  const kpis = useMemo(() => {
    if (ledgerSummary) {
      return {
        totalMasterRevenue: Number(ledgerSummary.totalRevenue || 0),
        todayEarnings: Number(ledgerSummary.todayRevenue || 0),
        totalEntries: Number(ledgerSummary.totalBookings || pagination.totalRecords || adminBookings.length),
        paidBookings: Number(ledgerSummary.paidBookings || 0),
        pendingPayments: Number(ledgerSummary.pendingPayments || 0),
        refundedAmount: Number(ledgerSummary.refundedAmount || 0),
        cancelledCount: Number(ledgerSummary.cancelledBookings || 0),
      };
    }

    let totalMasterRevenue = 0;
    let todayEarnings = 0;
    let paidBookings = 0;
    let pendingPayments = 0;
    let cancelledCount = 0;
    let refundedAmount = 0;

    const dNow = new Date();
    const todayStr = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;

    adminBookings.forEach((b) => {
      const statusUpper = (b.status || '').toUpperCase();
      const isCancelled = statusUpper === 'CANCELLED' || statusUpper === 'REJECTED';
      const fee = Number(
        b.bookingAmount ??
        b.totalFee ??
        (b as any).totalPrice ??
        (b as any).pricingDetails?.totalAmount ??
        (b as any).totalAmount ??
        (b as any).amount ??
        0
      );

      if (isCancelled) {
        cancelledCount++;
        refundedAmount += Number((b as any).pricingDetails?.refundAmount || (b as any).refundAmount || 0);
      } else {
        totalMasterRevenue += fee;
        paidBookings++;

        const bDate = b.date || b.bookingDate || ((b as any).createdAt ? (b as any).createdAt.split('T')[0] : '');
        if (bDate === todayStr) {
          todayEarnings += fee;
        }
      }
    });

    return {
      totalMasterRevenue,
      todayEarnings,
      totalEntries: pagination.totalRecords || adminBookings.length,
      paidBookings,
      pendingPayments,
      refundedAmount,
      cancelledCount,
    };
  }, [ledgerSummary, adminBookings, pagination.totalRecords]);

  const filteredBookings = adminBookings || [];

  return {
    viewMode,
    setViewMode,
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
    datePreset,
    setDatePreset,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedLedgerDetail,
    setSelectedLedgerDetail,
    balance,
    transactions,
    kpis,
    amenitySummary: amenitySummary || [],
    loading: viewMode === 'master' ? loading : walletLoading,
    error,
    handleRefresh,
  };
}

export default useAdminLedgers;
