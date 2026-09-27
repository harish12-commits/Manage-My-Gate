/**
 * NAHOM / Connect Harmony - Mobile Phase 3: useFinancialHistory Custom Hook
 * Encapsulates presentation aggregation, search, filtering, and partial-failure handling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import financialHistoryService from '../services/financialHistoryService';
import {
  FinancialHistoryItem,
  FinancialHistoryFilterTab,
  FinancialHistoryDomainState,
} from '../types/financialHistory.types';
import { useBillingSocket } from '../../billing/hooks/useBillingSocket';

export function useFinancialHistory() {
  // Listen for realtime socket updates (invoice/payment updates)
  useBillingSocket();

  const user = useSelector((state: RootState) => state.auth?.user);
  const activeOrgId = useSelector((state: any) =>
    state.workspace?.activeOrganizationId ||
    state.auth?.activeOrganizationId ||
    state.auth?.user?.orgId ||
    state.auth?.user?.organizationId ||
    state.auth?.user?.org?._id ||
    state.auth?.user?.activeOrgId ||
    state.auth?.user?.activeOrganizationId
  );
  const communityId = activeOrgId || user?.activeOrganizationId || user?.orgId || user?.communityId;

  const [domainState, setDomainState] = useState<FinancialHistoryDomainState>({
    invoices: { data: [], status: 'idle' },
    wallet: { data: [], status: 'idle' },
    amenities: { data: [], status: 'idle' },
  });

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<FinancialHistoryFilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<FinancialHistoryItem | null>(null);

  // Load records across all domains
  const loadHistory = useCallback(
    async (isPullToRefresh = false) => {
      if (isPullToRefresh) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }

      try {
        const { invoices, wallet, amenities } =
          await financialHistoryService.fetchDomainRecords(communityId);

        setDomainState({
          invoices,
          wallet,
          amenities,
        });
      } catch (err: any) {
        // Fallback catch (fetchDomainRecords uses allSettled so this is rare)
        setDomainState((prev) => ({
          invoices: { ...prev.invoices, status: 'error', error: err?.message || 'Error' },
          wallet: { ...prev.wallet, status: 'error', error: err?.message || 'Error' },
          amenities: { ...prev.amenities, status: 'error', error: err?.message || 'Error' },
        }));
      } finally {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [communityId]
  );

  useEffect(() => {
    loadHistory(false);
  }, [loadHistory]);

  // Compute merged and deduplicated chronological list
  const allItems = useMemo<FinancialHistoryItem[]>(() => {
    return financialHistoryService.normalizeAndMergeHistory(
      domainState.invoices.data,
      domainState.wallet.data,
      domainState.amenities.data
    );
  }, [domainState]);

  // Apply active category tab and search query
  const filteredItems = useMemo<FinancialHistoryItem[]>(() => {
    return financialHistoryService.filterHistory(allItems, selectedTab, searchQuery);
  }, [allItems, selectedTab, searchQuery]);

  // Compute partial-failure message if one or more domains failed
  const partialError = useMemo<string | null>(() => {
    const failedDomains: string[] = [];
    if (domainState.invoices.status === 'error') failedDomains.push('Invoices');
    if (domainState.wallet.status === 'error') failedDomains.push('Wallet');
    if (domainState.amenities.status === 'error') failedDomains.push('Amenities');

    if (failedDomains.length === 3) {
      return 'Unable to load financial records. Please check your connection.';
    }
    if (failedDomains.length > 0) {
      return `Some records could not be loaded: ${failedDomains.join(', ')}.`;
    }
    return null;
  }, [domainState]);

  const hasAllFailed = useMemo<boolean>(() => {
    return (
      domainState.invoices.status === 'error' &&
      domainState.wallet.status === 'error' &&
      domainState.amenities.status === 'error'
    );
  }, [domainState]);

  const handleRefresh = useCallback(() => {
    return loadHistory(true);
  }, [loadHistory]);

  return {
    allItems,
    filteredItems,
    domainState,
    isLoading: isInitialLoading && allItems.length === 0,
    isRefreshing,
    partialError,
    hasAllFailed,
    selectedTab,
    setSelectedTab,
    searchQuery,
    setSearchQuery,
    selectedItem,
    setSelectedItem,
    refresh: handleRefresh,
  };
}

export default useFinancialHistory;
