import { InteractionManager } from 'react-native';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { TabBar } from '@/components/ui/TabBar';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { VisitorPassCard } from '../VisitorPassCard';
import { VisitorLogDetailsModal } from './VisitorLogDetailsModal';
import { ExtendedVisitorPass } from '../../mocks/visitorMocks';
import { useVisitorPass } from '../../hooks/useVisitorPass';
import { mapBackendPassToHistoryItem } from '../../utils/mapBackendPassToHistoryItem';
import { useTranslation } from '@/src/utils/i18n';

export const VisitorHistoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('ACTIVE');
  const [search, setSearch] = useState<string>('');
  const [selectedPass, setSelectedPass] = useState<ExtendedVisitorPass | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const { t } = useTranslation();

  const { passes, pagination, status, error, fetchPasses } = useVisitorPass();

  const tabs = useMemo(
    () => [
      { key: 'ACTIVE', label: t('active', 'Active') },
      { key: 'PENDING', label: t('upcoming', 'Upcoming') },
      { key: 'EXPIRED', label: t('expired', 'Completed') },
      { key: 'REVOKED', label: t('cancelled', 'Rejected') },
    ],
    [t]
  );

  const mappedHistoryPasses = useMemo(() => {
    if (!Array.isArray(passes)) return [];
    return passes.map((pass: any) => mapBackendPassToHistoryItem(pass));
  }, [passes]);

  const loadData = useCallback(
    (page: number, append: boolean = false) => {
      return fetchPasses({
        page,
        limit: 10,
        statuses: activeTab,
        search: search.trim() || undefined,
        append,
      });
    },
    [fetchPasses, activeTab, search]
  );

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
        loadData(1, false);
      });
    return () => {
      task.cancel();
    };
  }, [activeTab, loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(1, false);
    setRefreshing(false);
  }, [loadData]);

  const handleLoadMore = useCallback(async () => {
    if (
      status === 'loading' ||
      loadingMore ||
      refreshing ||
      pagination.currentPage >= pagination.totalPages
    ) {
      return;
    }
    setLoadingMore(true);
    await loadData(pagination.currentPage + 1, true);
    setLoadingMore(false);
  }, [status, loadingMore, refreshing, pagination, loadData]);

  const filteredPasses = useMemo(() => {
    if (!search.trim()) return mappedHistoryPasses;
    const query = search.toLowerCase().trim();
    return mappedHistoryPasses.filter((pass) => {
      const matchName = pass.visitorName ? pass.visitorName.toLowerCase().includes(query) : false;
      const matchPhone = pass.phone ? pass.phone.includes(query) : false;
      const matchCode = pass.code ? pass.code.toLowerCase().includes(query) : false;
      const matchProvider = pass.provider ? pass.provider.toLowerCase().includes(query) : false;
      const matchVehicle = pass.vehicleNo ? pass.vehicleNo.toLowerCase().includes(query) : false;
      const matchOrder = pass.orderId ? pass.orderId.toLowerCase().includes(query) : false;

      return matchName || matchPhone || matchCode || matchProvider || matchVehicle || matchOrder;
    });
  }, [mappedHistoryPasses, search]);

  const isLoadingInitial = status === 'loading' && !refreshing && !loadingMore && passes.length === 0;

  const renderHeader = () => (
    <View className="gap-3 mb-3">
      {/* Status Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabKey) => {
          setSearch('');
          setActiveTab(tabKey);
        }}
        variant="pill"
        className="my-1"
      />

      {/* Search Bar */}
      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('search_visitor_passes', 'Search loaded history by name, phone, or code...')}
        variant="bordered"
        className="px-0 py-0 border-0"
      />

      {/* Canonical Error Retry Banner */}
      {status === 'failed' && (
        <ErrorBanner
          message={error || 'Failed to load visitor history.'}
          onRetry={() => loadData(1, false)}
          className="my-1"
        />
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      {/* Paginated List of History Passes */}
      <PaginatedList<ExtendedVisitorPass>
        data={filteredPasses}
        pagination={{
          currentPage: pagination.currentPage,
          totalPages: pagination.totalPages,
          totalRecords: pagination.totalRecords,
          limit: pagination.limit,
        }}
        onLoadMore={handleLoadMore}
        onRefresh={handleRefresh}
        paginationSummary
        refreshing={refreshing}
        loading={isLoadingInitial}
        ListHeaderComponent={renderHeader()}
        emptyIcon="History"
        emptyTitle={t('no_recent_visitor_activity', 'No History Passes Found')}
        emptySubtitle={`${t('no_recent_visitor_sub', 'No visitor passes found.')}`}
        contentContainerClassName="px-4 pt-3 pb-28"
        renderItem={(pass) => {
          if (!pass) return null;
          return (
            <VisitorPassCard
              pass={pass}
              onPress={(p) => {
                setSelectedPass(p as ExtendedVisitorPass);
                setDetailsModalOpen(true);
              }}
              onShowQR={(p) => {
                setSelectedPass(p as ExtendedVisitorPass);
                setDetailsModalOpen(true);
              }}
            />
          );
        }}
      />

      {/* Details & Log View Modal */}
      <VisitorLogDetailsModal
        visible={detailsModalOpen}
        pass={selectedPass}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedPass(null);
        }}
      />
    </View>
  );
};

export default VisitorHistoryView;
