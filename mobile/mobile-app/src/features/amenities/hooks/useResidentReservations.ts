/**
 * Amenity Management Phase 6C.1 - Resident Reservations Hook
 * Orchestrates resident reservation browsing, filtering, detail drilldown,
 * digital pass retrieval, and cancellation workflows using frozen Phase 5 backend contracts.
 * Preserves the five orthogonal status dimensions without flattening or client-side status synthesis.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store/store';
import {
  AmenityReservation,
  AmenityAccessPass,
  AmenityErrorDetails,
} from '../types/amenityDomain.types';
import {
  fetchReservationsThunk,
  fetchReservationByIdThunk,
  cancelReservationThunk,
  fetchPassesByReservationThunk,
  clearV2Errors,
} from '../store/amenityBookingSlice';
import { useAuth } from '@/src/features/auth/hooks/useAuth';

export const RESERVATION_FILTER_TABS = [
  'All',
  'Upcoming',
  'Awaiting Approval',
  'Past',
  'Cancelled',
] as const;
export type ReservationFilterTab = typeof RESERVATION_FILTER_TABS[number];

export interface ReservationFilterParams {
  page?: number;
  limit?: number;
  facilityId?: string;
  resourceId?: string;
  residentId?: string;
  unitId?: string;
  bookingStatus?: string;
  paymentStatus?: string;
  approvalStatus?: string;
  startDate?: string;
  endDate?: string;
}

export function useResidentReservations(initialParams: ReservationFilterParams = {}) {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useAuth();
  const userId = user?.id || (user as any)?._id;

  const [selectedTab, setSelectedTab] = useState<ReservationFilterTab>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cancelTarget, setCancelTargetState] = useState<AmenityReservation | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const setCancelTarget = useCallback((target: AmenityReservation | null) => {
    setCancelError(null);
    setCancelTargetState(target);
  }, []);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [backendFilters, setBackendFilters] = useState<ReservationFilterParams>(initialParams);

  const {
    v2Reservations,
    v2CurrentReservation,
    v2AccessPasses,
    v2Loading,
    v2Error,
    pagination,
  } = useSelector((state: RootState) => state.amenityBookings);

  // Fetch reservations with server-side pagination & filters
  const loadReservations = useCallback(
    async (params?: ReservationFilterParams) => {
      const mergedParams = {
        residentId: userId,
        ...backendFilters,
        ...params,
      };
      return await dispatch(fetchReservationsThunk(mergedParams)).unwrap();
    },
    [dispatch, backendFilters, userId]
  );

  // Initial load
  useEffect(() => {
    loadReservations({ page: 1 });
  }, [loadReservations]);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadReservations({ page: 1 });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadReservations]);

  // Load next page
  const handleLoadMore = useCallback(async () => {
    if (v2Loading || isRefreshing) return;
    if (pagination && pagination.currentPage < pagination.totalPages) {
      await loadReservations({ page: pagination.currentPage + 1 });
    }
  }, [v2Loading, isRefreshing, pagination, loadReservations]);

  // Fetch single reservation by ID
  const fetchReservationById = useCallback(
    async (reservationId: string) => {
      return await dispatch(fetchReservationByIdThunk(reservationId)).unwrap();
    },
    [dispatch]
  );

  // Fetch passes for a reservation
  const fetchPassesByReservation = useCallback(
    async (reservationId: string) => {
      return await dispatch(fetchPassesByReservationThunk(reservationId)).unwrap();
    },
    [dispatch]
  );

  // Cancel reservation
  const handleCancelReservation = useCallback(
    async (reservationId: string, reason?: string) => {
      setIsCancelling(true);
      setCancelError(null);
      try {
        const payload = reason ? { reason } : undefined;
        const res = await dispatch(
          cancelReservationThunk({ id: reservationId, payload })
        ).unwrap();
        setCancelTargetState(null);
        return res;
      } catch (err: any) {
        setCancelError(err?.message || 'The booking could not be cancelled.');
        throw err;
      } finally {
        setIsCancelling(false);
      }
    },
    [dispatch]
  );

  // Clear errors
  const handleClearError = useCallback(() => {
    dispatch(clearV2Errors());
  }, [dispatch]);

  // Presentation-level filtering across the 5 orthogonal dimensions
  const filteredReservations = useMemo(() => {
    let list = v2Reservations;

    // Apply presentation tab
    if (selectedTab !== 'All') {
      list = list.filter((item) => {
        const isBookingConfirmed = item.bookingStatus === 'CONFIRMED';
        const isBookingCancelled = item.bookingStatus === 'CANCELLED' || item.bookingStatus === 'REJECTED';
        const isApprovalPending = item.approvalStatus === 'PENDING_REVIEW' || item.bookingStatus === 'PENDING_APPROVAL';
        const isPaymentPending = item.paymentStatus === 'PENDING' || item.paymentStatus === 'HELD_AUTHORIZED';
        const isAccessRevoked = item.accessStatus === 'ACCESS_REVOKED';
        const isCompleted =
          item.completionStatus === 'COMPLETED' ||
          item.completionStatus === 'NO_SHOW' ||
          item.accessStatus === 'CHECKED_OUT';

        switch (selectedTab as string) {
          case 'Upcoming':
          case 'Active':
            return isBookingConfirmed && !isApprovalPending && !isCompleted && !isBookingCancelled && !isAccessRevoked;
          case 'Awaiting Approval':
          case 'Pending':
            return isApprovalPending || isPaymentPending;
          case 'Past':
            return isCompleted;
          case 'Cancelled':
            return isBookingCancelled || isAccessRevoked;
          default:
            return true;
        }
      });
    }

    // Apply keyword search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const matchFac = item.facilityName?.toLowerCase().includes(q);
        const matchRes = item.reservationNumber?.toLowerCase().includes(q);
        const matchResId = item.resourceName?.toLowerCase().includes(q);
        const matchId = item._id?.toLowerCase().includes(q);
        return matchFac || matchRes || matchResId || matchId;
      });
    }

    return list;
  }, [v2Reservations, selectedTab, searchQuery]);

  return {
    // Redux State (preserving 5 dimensions)
    reservations: v2Reservations,
    filteredReservations,
    currentReservation: v2CurrentReservation,
    accessPasses: v2AccessPasses,
    loading: v2Loading,
    isRefreshing,
    isCancelling,
    error: v2Error,
    pagination,

    // Filter & Search Controls
    selectedTab,
    setSelectedTab,
    filterTabs: RESERVATION_FILTER_TABS,
    searchQuery,
    setSearchQuery,
    backendFilters,
    setBackendFilters,

    // Cancellation Modal State Helpers
    cancelTarget,
    setCancelTarget,
    cancelError,

    // Actions
    fetchReservations: loadReservations,
    fetchReservationById,
    fetchPassesByReservation,
    cancelReservation: handleCancelReservation,
    refresh: handleRefresh,
    loadMore: handleLoadMore,
    clearError: handleClearError,
  };
}

export default useResidentReservations;
