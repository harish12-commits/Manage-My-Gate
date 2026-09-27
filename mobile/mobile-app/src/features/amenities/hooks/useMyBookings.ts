import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store/store';
import {
  fetchMyBookingsThunk,
  cancelBookingThunk,
  AmenityBooking,
} from '../store/amenityBookingSlice';
import { fetchWalletThunk } from '../../wallet/store/walletSlice';

export const FILTER_TABS = ['All', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
export type BookingFilterTab = typeof FILTER_TABS[number];

export function useMyBookings() {
  const dispatch = useDispatch<AppDispatch>();
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [selectedPassForQR, setSelectedPassForQR] = useState<AmenityBooking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AmenityBooking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const { myBookings, loading, error, pagination } = useSelector(
    (state: RootState) => state.amenityBookings
  );

  const loadBookings = useCallback((page = 1) => {
    dispatch(fetchMyBookingsThunk({ page }));
  }, [dispatch]);

  useEffect(() => {
    loadBookings(1);
  }, [loadBookings]);

  const filteredBookings = useMemo(() => {
    if (selectedFilter === 'All') return myBookings;
    return myBookings.filter((b) => (b.status || '').toUpperCase() === selectedFilter);
  }, [myBookings, selectedFilter]);

  const handleRefresh = useCallback(() => {
    loadBookings(1);
    dispatch(fetchWalletThunk());
  }, [loadBookings, dispatch]);

  const handleLoadMore = useCallback(() => {
    if (pagination && pagination.currentPage < pagination.totalPages) {
      loadBookings(pagination.currentPage + 1);
    }
  }, [pagination, loadBookings]);

  const handleConfirmCancel = useCallback(async (reason: string) => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await dispatch(cancelBookingThunk({ bookingId: cancelTarget._id, reason }));
      dispatch(fetchWalletThunk());
      setCancelTarget(null);
      loadBookings(1);
    } finally {
      setIsCancelling(false);
    }
  }, [cancelTarget, dispatch, loadBookings]);

  return {
    myBookings,
    filteredBookings,
    loading,
    error,
    pagination,
    selectedFilter,
    filterTabs: FILTER_TABS,
    selectedPassForQR,
    cancelTarget,
    isCancelling,
    setSelectedFilter,
    setSelectedPassForQR,
    setCancelTarget,
    handleRefresh,
    handleLoadMore,
    handleConfirmCancel,
  };
}

export default useMyBookings;
