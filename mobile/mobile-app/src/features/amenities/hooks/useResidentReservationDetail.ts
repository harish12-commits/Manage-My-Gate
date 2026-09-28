/**
 * useResidentReservationDetail Hook - Phase 6C.3
 * Manages server-authoritative single reservation detail & access passes.
 * Uses existing v2 thunks (fetchReservationByIdThunk, fetchPassesByReservationThunk, cancelReservationThunk).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AnyAction } from '@reduxjs/toolkit';
import {
  fetchReservationByIdThunk,
  fetchPassesByReservationThunk,
  cancelReservationThunk,
  clearV2Errors,
} from '../store/amenityBookingSlice';
import {
  AmenityReservation,
  AmenityAccessPass,
  AmenityErrorDetails,
} from '../types/amenityDomain.types';

export interface UseResidentReservationDetailResult {
  reservation: AmenityReservation | null;
  accessPasses: AmenityAccessPass[];
  loading: boolean;
  passesLoading: boolean;
  isRefreshing: boolean;
  isCancelling: boolean;
  cancelModalOpen: boolean;
  setCancelModalOpen: (open: boolean) => void;
  cancelError: string | null;
  error: AmenityErrorDetails | null;
  isCancellable: boolean;
  refresh: () => Promise<void>;
  cancelReservation: (reason?: string) => Promise<AmenityReservation>;
  clearError: () => void;
}

export function useResidentReservationDetail(
  reservationId?: string
): UseResidentReservationDetailResult {
  const dispatch = useDispatch();

  const v2CurrentReservation = useSelector(
    (state: any) => state.amenityBookings?.v2CurrentReservation as AmenityReservation | null
  );
  const v2Reservations = useSelector(
    (state: any) => (state.amenityBookings?.v2Reservations || []) as AmenityReservation[]
  );
  const v2AccessPasses = useSelector(
    (state: any) => (state.amenityBookings?.v2AccessPasses || []) as AmenityAccessPass[]
  );
  const v2Loading = useSelector(
    (state: any) => Boolean(state.amenityBookings?.v2Loading)
  );
  const v2Error = useSelector(
    (state: any) => (state.amenityBookings?.v2Error || null) as AmenityErrorDetails | null
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelModalOpen, setCancelModalOpenState] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const setCancelModalOpen = useCallback((open: boolean) => {
    setCancelError(null);
    setCancelModalOpenState(open);
  }, []);
  const [passesLoading, setPassesLoading] = useState(false);

  // Authoritative server reservation: preferred from currentReservation if matching id, else fallback to list cache during fetch
  const reservation: AmenityReservation | null = useMemo(() => {
    if (!reservationId) return null;
    if (v2CurrentReservation && v2CurrentReservation._id === reservationId) {
      return v2CurrentReservation;
    }
    const cached = v2Reservations.find((r) => r._id === reservationId);
    return cached || null;
  }, [reservationId, v2CurrentReservation, v2Reservations]);

  // Passes filtered for this reservation
  const accessPasses: AmenityAccessPass[] = useMemo(() => {
    if (!reservationId) return [];
    return v2AccessPasses.filter(
      (p) => !p.reservationId || p.reservationId === reservationId
    );
  }, [reservationId, v2AccessPasses]);

  // Load authoritative data on mount or ID change
  const loadData = useCallback(
    async (id: string) => {
      setPassesLoading(true);
      try {
        await Promise.allSettled([
          (dispatch as any)(fetchReservationByIdThunk(id)).unwrap(),
          (dispatch as any)(fetchPassesByReservationThunk(id)).unwrap(),
        ]);
      } finally {
        setPassesLoading(false);
      }
    },
    [dispatch]
  );

  useEffect(() => {
    if (reservationId) {
      dispatch(clearV2Errors() as unknown as AnyAction);
      loadData(reservationId);
    }
  }, [reservationId, loadData, dispatch]);

  // Pull-to-refresh
  const refresh = useCallback(async () => {
    if (!reservationId) return;
    setIsRefreshing(true);
    try {
      await loadData(reservationId);
    } finally {
      setIsRefreshing(false);
    }
  }, [reservationId, loadData]);

  // Cancellation
  const handleCancelReservation = useCallback(
    async (reason?: string): Promise<AmenityReservation> => {
      if (!reservationId) {
        throw new Error('No reservation ID available to cancel');
      }
      setIsCancelling(true);
      setCancelError(null);
      try {
        const payload = reason ? { reason } : undefined;
        const res = await (dispatch as any)(
          cancelReservationThunk({ id: reservationId, payload })
        ).unwrap();

        // Refresh passes after cancellation to ensure revoked state is reflected
        try {
          await (dispatch as any)(fetchPassesByReservationThunk(reservationId)).unwrap();
        } catch {
          // Swallow pass refresh error; cancellation already succeeded
        }

        setCancelModalOpenState(false);
        return res;
      } catch (err: any) {
        setCancelError(err?.message || 'The booking could not be cancelled.');
        throw err;
      } finally {
        setIsCancelling(false);
      }
    },
    [dispatch, reservationId]
  );

  // Clear errors
  const handleClearError = useCallback(() => {
    dispatch(clearV2Errors() as unknown as AnyAction);
  }, [dispatch]);

  // Cancellation allowed check
  const isCancellable = useMemo(() => {
    if (!reservation) return false;
    return (
      reservation.bookingStatus !== 'CANCELLED' &&
      reservation.bookingStatus !== 'REJECTED' &&
      reservation.completionStatus !== 'COMPLETED' &&
      reservation.completionStatus !== 'NO_SHOW' &&
      reservation.accessStatus !== 'CHECKED_OUT'
    );
  }, [reservation]);

  return {
    reservation,
    accessPasses,
    loading: v2Loading,
    passesLoading,
    isRefreshing,
    isCancelling,
    cancelModalOpen,
    setCancelModalOpen,
    cancelError,
    error: v2Error,
    isCancellable,
    refresh,
    cancelReservation: handleCancelReservation,
    clearError: handleClearError,
  };
}

export default useResidentReservationDetail;
