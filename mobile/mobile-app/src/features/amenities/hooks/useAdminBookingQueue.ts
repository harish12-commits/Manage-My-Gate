/**
 * Staff booking queue (Amenity Management V2): approvals, bookings flagged for a staff
 * decision, upcoming and all bookings — with the actions staff take on one booking
 * (approve, reject with a reason, decide a review, cancel with a reason, record cash).
 * Queue data and filters live in the amenityBookings slice.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store/store';
import {
  AdminQueueTab,
  fetchAdminQueueThunk,
  fetchAdminQueueCountsThunk,
  reviewReservationThunk,
  resolveReservationReviewThunk,
  cancelReservationThunk,
  collectBalancePaymentThunk,
  setAdminQueueTab,
  setAdminQueueSearch,
  clearAdminQueueError,
} from '../store/amenityBookingSlice';
import { AmenityReservation } from '../types/amenityDomain.types';

export type ReviewResolution = 'FORFEIT' | 'REFUND_POLICY' | 'REFUND_CUSTOM' | 'EXTEND';

export function useAdminBookingQueue() {
  const dispatch = useDispatch<AppDispatch>();
  const queue = useSelector((state: RootState) => (state as any).amenityBookings.adminQueue);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (page = 1) => {
      await dispatch(fetchAdminQueueThunk({ page }));
      if (page === 1) dispatch(fetchAdminQueueCountsThunk());
    },
    [dispatch]
  );

  // Reload page 1 whenever the tab changes (search reloads after a short pause).
  useEffect(() => {
    load(1);
  }, [queue.tab, load]);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const setTab = useCallback((tab: AdminQueueTab) => dispatch(setAdminQueueTab(tab)), [dispatch]);

  const setSearch = useCallback(
    (text: string) => {
      dispatch(setAdminQueueSearch(text));
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => load(1), 350);
    },
    [dispatch, load]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(1);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const loadMore = useCallback(() => {
    const { currentPage, totalPages } = queue.pagination;
    if (!queue.loading && currentPage < totalPages) load(currentPage + 1);
  }, [queue.pagination, queue.loading, load]);

  const selected: AmenityReservation | null = useMemo(
    () => queue.items.find((r: AmenityReservation) => r._id === selectedId) || null,
    [queue.items, selectedId]
  );

  /** Runs one staff action; on success the queue and its counts are reloaded. */
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setActionLoading(true);
      setActionError(null);
      try {
        await action();
        await load(1);
        return true;
      } catch (err: any) {
        setActionError(err?.message || 'The action could not be completed.');
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [load]
  );

  const approve = useCallback(
    (id: string) => run(() => dispatch(reviewReservationThunk({ id, action: 'APPROVE' })).unwrap()),
    [dispatch, run]
  );
  const reject = useCallback(
    (id: string, reason: string) =>
      run(() => dispatch(reviewReservationThunk({ id, action: 'REJECT', rejectionReason: reason })).unwrap()),
    [dispatch, run]
  );
  const resolveReview = useCallback(
    (id: string, action: ReviewResolution, options: { refundPercentage?: number; notes?: string } = {}) =>
      run(() => dispatch(resolveReservationReviewThunk({ id, action, ...options })).unwrap()),
    [dispatch, run]
  );
  const cancel = useCallback(
    (id: string, reason?: string) =>
      run(() => dispatch(cancelReservationThunk({ id, payload: reason ? { reason } : undefined })).unwrap()),
    [dispatch, run]
  );
  const collectCash = useCallback(
    (id: string, amount: number) => run(() => dispatch(collectBalancePaymentThunk({ reservationId: id, amount })).unwrap()),
    [dispatch, run]
  );

  return {
    items: queue.items as AmenityReservation[],
    pagination: queue.pagination,
    tab: queue.tab as AdminQueueTab,
    search: queue.search as string,
    counts: queue.counts as { approvals: number; review: number },
    loading: queue.loading as boolean,
    error: queue.error as string | null,
    refreshing,
    setTab,
    setSearch,
    refresh,
    loadMore,
    clearError: () => dispatch(clearAdminQueueError()),
    selected,
    select: (reservation: AmenityReservation | null) => {
      setActionError(null);
      setSelectedId(reservation?._id || null);
    },
    actionLoading,
    actionError,
    clearActionError: () => setActionError(null),
    approve,
    reject,
    resolveReview,
    cancel,
    collectCash,
  };
}

export default useAdminBookingQueue;
