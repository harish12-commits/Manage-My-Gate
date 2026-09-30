import { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from 'expo-router';
import { RootState, AppDispatch } from '@/src/store/store';
import {
  fetchDirectory,
  setSearchQuery,
  setActiveTab,
} from '../store/directorySlice';
import { Alert, Linking } from 'react-native';

export const useDirectory = () => {
  const dispatch = useDispatch<AppDispatch>();
  const directoryState = useSelector((state: RootState) => (state as any).directory);
  const {
    members = [],
    pagination = { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 50 },
    searchQuery = '',
    activeTab = 'all',
    loading = false,
    refreshing = false,
    error = null,
  } = directoryState || {};

  const safeMembers = Array.isArray(members) ? members : [];

  const filteredMembers = safeMembers.filter((m) => {
    // 1. Role Filter Tab
    if (activeTab && activeTab.toLowerCase() !== 'all') {
      const memberRole = (m.role || '').toLowerCase();
      const targetTab = activeTab.toLowerCase();

      if (targetTab === 'guard' || targetTab === 'security') {
        if (memberRole !== 'guard' && memberRole !== 'security') return false;
      } else if (targetTab === 'staff') {
        if (memberRole !== 'staff') return false;
      } else if (targetTab === 'maintenance') {
        if (memberRole !== 'maintenance' && memberRole !== 'staff') return false;
      } else if (targetTab === 'management' || targetTab === 'admin') {
        if (memberRole !== 'admin' && memberRole !== 'management') return false;
      } else if (targetTab === 'resident') {
        if (memberRole !== 'resident' && memberRole !== 'tenant' && memberRole !== 'owner') return false;
      } else if (memberRole !== targetTab) {
        return false;
      }
    }

    // 2. Search Query Filter
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (m.name || '').toLowerCase().includes(q);
      const matchUnit = (m.unitNumber || '').toLowerCase().includes(q);
      const matchPhone = (m.phone || '').toLowerCase().includes(q);
      const matchEmail = (m.email || '').toLowerCase().includes(q);
      const matchDesignation = (m.designation || '').toLowerCase().includes(q);
      const matchRole = (m.role || '').toLowerCase().includes(q);
      const matchInterests = (m.interests || []).some((i: string) => i.toLowerCase().includes(q));

      return matchName || matchUnit || matchPhone || matchEmail || matchDesignation || matchRole || matchInterests;
    }

    return true;
  });

  const loadData = useCallback(
    (page = 1, isRefreshing = false) => {
      const validRoles = ['resident', 'guard', 'security', 'staff', 'maintenance', 'management', 'admin'];
      const roleFilter = validRoles.includes(activeTab.toLowerCase()) ? activeTab.toLowerCase() : undefined;

      dispatch(
        fetchDirectory({
          role: roleFilter,
          search: searchQuery.trim() || undefined,
          page,
          limit: 50,
          refreshing: isRefreshing,
        })
      );
    },
    [dispatch, activeTab, searchQuery]
  );

  useFocusEffect(
    useCallback(() => {
      // Refresh on focus so role assignments saved on another screen appear
      // immediately. The short delay also debounces search and tab changes.
      const timer = setTimeout(() => {
        loadData(1);
      }, 300);
      return () => clearTimeout(timer);
    }, [loadData])
  );

  const handleRefresh = useCallback(() => {
    loadData(1, true);
  }, [loadData]);

  const handleLoadMore = useCallback(() => {
    if (!loading && (pagination?.currentPage || 1) < (pagination?.totalPages || 1)) {
      loadData((pagination?.currentPage || 1) + 1);
    }
  }, [loading, pagination, loadData]);

  const handleCall = useCallback((phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  }, []);

  const handleIntercom = useCallback((intercom: string) => {
    if (!intercom) return;
    Alert.alert(
      'Calling Community Intercom',
      `Initiating direct voice intercom call to Unit #${intercom}...`,
      [{ text: 'End Call', style: 'cancel' }]
    );
  }, []);

  return {
    members: filteredMembers,
    pagination,
    searchQuery,
    setSearchQuery: (q: string) => dispatch(setSearchQuery(q)),
    activeTab,
    setActiveTab: (t: string) => dispatch(setActiveTab(t)),
    loading,
    refreshing,
    error,
    totalCount: pagination?.totalRecords ?? filteredMembers.length,
    onRefresh: handleRefresh,
    onLoadMore: handleLoadMore,
    onCall: handleCall,
    onIntercom: handleIntercom,
  };
};

export default useDirectory;
