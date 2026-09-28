/**
 * Amenity ledger (V2): every booking with its money — paid, balance still owed, refunds —
 * filtered by a view pill and a server-side search, loaded page by page. The summary
 * covers everything matching the filter, not just the loaded rows.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../../store/store';
import {
  AmenityBooking,
  AmenityLedgerView,
  fetchAmenityLedgerThunk,
  exportAmenityLedgerThunk,
  setLedgerView,
  setLedgerSearch,
  clearLedgerError,
} from '../store/amenityBookingSlice';

export function useAdminLedgers() {
  const dispatch = useDispatch<AppDispatch>();
  const ledger = useSelector((state: RootState) => (state as any).amenityBookings.ledger);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<AmenityBooking | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((page = 1) => dispatch(fetchAmenityLedgerThunk({ page })), [dispatch]);

  // Page 1 whenever the view changes (search reloads after a short pause).
  useEffect(() => {
    load(1);
  }, [ledger.view, load]);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    []
  );

  const setView = useCallback(
    (view: AmenityLedgerView) => {
      dispatch(setLedgerView(view));
    },
    [dispatch]
  );

  const setSearch = useCallback(
    (text: string) => {
      dispatch(setLedgerSearch(text));
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
    const { currentPage, totalPages } = ledger.pagination;
    if (!ledger.loading && currentPage < totalPages) load(currentPage + 1);
  }, [ledger.pagination, ledger.loading, load]);

  /** Every row matching the current view and search. */
  const fetchAllForExport = useCallback(async () => dispatch(exportAmenityLedgerThunk()).unwrap(), [dispatch]);

  return {
    items: ledger.items as AmenityBooking[],
    pagination: ledger.pagination,
    summary: ledger.summary,
    view: ledger.view as AmenityLedgerView,
    search: ledger.search as string,
    loading: ledger.loading as boolean,
    error: ledger.error as string | null,
    refreshing,
    setView,
    setSearch,
    refresh,
    loadMore,
    clearError: () => dispatch(clearLedgerError()),
    retry: () => load(1),
    selected,
    select: setSelected,
    fetchAllForExport,
  };
}

export default useAdminLedgers;
