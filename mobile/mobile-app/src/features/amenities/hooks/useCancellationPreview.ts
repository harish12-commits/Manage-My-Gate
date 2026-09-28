/**
 * Loads what cancelling a booking now would refund (server-computed, read-only) while
 * the cancel sheet is open, so the resident sees the exact amount before confirming.
 */

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../store/store';
import { fetchCancellationPreviewThunk } from '../store/amenityBookingSlice';
import { AmenityCancellationPreview } from '../types/amenityDomain.types';

export function useCancellationPreview(reservationId?: string | null) {
  const dispatch = useDispatch<AppDispatch>();
  const [preview, setPreview] = useState<AmenityCancellationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(null);
    setError(null);
    if (!reservationId) return;
    let active = true;
    setLoading(true);
    dispatch(fetchCancellationPreviewThunk(reservationId))
      .unwrap()
      .then((data) => active && setPreview(data))
      .catch((err: any) => active && setError(err?.message || 'Could not load the refund details.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [dispatch, reservationId]);

  return { preview, loading, error };
}

export default useCancellationPreview;
