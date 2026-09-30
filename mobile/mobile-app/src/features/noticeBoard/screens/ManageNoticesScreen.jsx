import React, { useEffect, useState, useCallback } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import { ScreenShell } from '@/components/ui/ScreenShell';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { FAB } from '@/components/ui/FAB';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

import { useNoticeBoard } from '../hooks/useNoticeBoard';
import { useNoticeSocket } from '../hooks/useNoticeSocket';
import { 
  NoticeCard, 
  ErrorBoundary,
  NoticeBoardEmptyState,
  NoticeBoardLoadingSkeleton
} from '../components';
import { CommunityEngagementTypeSheet } from '@/src/features/communityEngagement';
import { debounce } from '../utils/debounce';
import {
  Plus,
  Filter,
  CheckCircle,
  FileText,
  Clock,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  ChevronDown,
  Check,
} from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

const STATUS_FILTER_OPTIONS = [
  { label: 'All', value: 'ALL' },
  { label: 'Published', value: 'Published' },
  { label: 'Draft', value: 'Draft' },
  { label: 'Scheduled', value: 'Scheduled' },
  { label: 'Expired', value: 'Expired' },
  { label: 'Archived', value: 'Archived' },
];

const PRIORITY_FILTER_OPTIONS = [
  { label: 'All', value: 'ALL' },
  { label: 'Low', value: 'Low' },
  { label: 'Medium', value: 'Medium' },
  { label: 'High', value: 'High' },
];

const CATEGORY_FILTER_OPTIONS = [
  { label: 'All', value: 'ALL' },
  { label: 'Maintenance', value: 'Maintenance' },
  { label: 'Events', value: 'Events' },
  { label: 'Emergency', value: 'Emergency' },
  { label: 'Meetings', value: 'Meetings' },
  { label: 'General', value: 'General' },
];

function ManageNoticesContent() {
  const router = useRouter();
  const { t, language } = useTranslation();

  // Real-time socket events
  useNoticeSocket();

  const {
    notices,
    loading,
    error,
    pagination,
    search,
    filters,
    activeKpiCard,
    sort,
    dashboardStats,
    dashboardLoading,
    loadNotices,
    setSearch,
    setFilters,
    setActiveKpiCard,
    setSort,
    resetFilters,
    setCurrentPage,
    removeNotice,
    changePinStatus,
    modifyNotice,
    loadNoticeStats,
    canCreate,
    canUpdate,
    canDelete,
    canPin,
  } = useNoticeBoard();

  const [filterType, setFilterType] = useState('STATUS'); // 'STATUS' | 'PRIORITY' | 'CATEGORY'
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [localSearch, setLocalSearch] = useState(search);
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);

  // Re-fetch data on active screen focus (e.g. returning from Create / Edit notice screen)
  useFocusEffect(
    useCallback(() => {
      loadNotices();
      loadNoticeStats();
    }, [loadNotices, loadNoticeStats])
  );

  // Sync notice listings on state modifications
  useEffect(() => {
    loadNotices();
  }, [search, filters, sort, pagination.currentPage, activeKpiCard]);

  // Sync local search when search resets
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleRefresh = useCallback(() => {
    setCurrentPage(1);
    loadNotices();
    loadNoticeStats();
  }, [loadNotices, loadNoticeStats, setCurrentPage]);

  const handleLoadMore = useCallback(() => {
    if (pagination.currentPage < pagination.totalPages && !loading) {
      setCurrentPage(pagination.currentPage + 1);
    }
  }, [pagination, loading, setCurrentPage]);

  // Debounced search updates to Redux
  const debouncedSetSearch = useCallback(
    debounce((value) => {
      setSearch(value);
    }, 300),
    [setSearch]
  );

  const handleSearchChange = useCallback((value) => {
    setLocalSearch(value);
    debouncedSetSearch(value);
  }, [debouncedSetSearch]);

  const handleStatusFilterChange = useCallback((statusValue) => {
    setActiveKpiCard(null);
    setCurrentPage(1);
    setFilters({ status: (statusValue === 'ALL' || !statusValue) ? '' : statusValue });
  }, [setFilters, setActiveKpiCard, setCurrentPage]);

  const handlePriorityFilterChange = useCallback((priorityValue) => {
    setActiveKpiCard(null);
    setCurrentPage(1);
    setFilters({ priority: (priorityValue === 'ALL' || !priorityValue) ? '' : priorityValue });
  }, [setFilters, setActiveKpiCard, setCurrentPage]);

  const handleCategoryFilterChange = useCallback((categoryValue) => {
    setActiveKpiCard(null);
    setCurrentPage(1);
    setFilters({ category: (categoryValue === 'ALL' || !categoryValue) ? '' : categoryValue });
  }, [setFilters, setActiveKpiCard, setCurrentPage]);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirmId) {
      await removeNotice(deleteConfirmId);
      setDeleteConfirmId(null);
      handleRefresh();
    }
  }, [deleteConfirmId, removeNotice, handleRefresh]);

  const handleStatusChange = useCallback(async (id, newStatus) => {
    try {
      await modifyNotice(id, { status: newStatus });
      handleRefresh();
    } catch (err) {
      console.error('Failed to change notice status:', err);
    }
  }, [modifyNotice, handleRefresh]);

  const handlePinToggle = useCallback(async (id, currentPinState) => {
    await changePinStatus(id, !currentPinState);
    handleRefresh();
  }, [changePinStatus, handleRefresh]);

  const handleEditPress = useCallback((id) => {
    router.navigate({
      pathname: '/(resident)/notices/create',
      params: { id },
    });
  }, [router]);

  const handleCardPress = useCallback((notice) => {
    router.navigate({
      pathname: '/(resident)/notices/[id]',
      params: { id: notice._id },
    });
  }, [router]);

  const handleDeletePress = useCallback((id) => {
    setDeleteConfirmId(id);
  }, []);

  const stats = dashboardStats?.kpis || {};
  const currentStatusFilter = filters.status || 'ALL';

  const renderNoticeItem = useCallback((notice) => (
    <NoticeCard
      key={`${notice._id || notice.id}-${language}`}
      notice={notice}
      onPress={handleCardPress}
      onPinToggle={handlePinToggle}
      onStatusChange={handleStatusChange}
      onEditPress={handleEditPress}
      onDeletePress={handleDeletePress}
      isAdmin={true}
      canPin={canPin}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  ), [handleCardPress, handlePinToggle, handleStatusChange, handleEditPress, handleDeletePress, canPin, canUpdate, canDelete, language]);

  // Visitor Management style ListHeaderComponent
  const renderHeader = () => (
    <View className="gap-3 mb-3">
      {/* Filter Mode Switcher (Status vs Priority vs Category) */}
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Filter by:
        </Text>
        <View className="flex-row bg-muted/60 p-0.5 rounded-xl gap-1">
          <TouchableOpacity
            onPress={() => setFilterType('STATUS')}
            className={`px-2.5 py-1 rounded-lg ${filterType === 'STATUS' ? 'bg-card shadow-xs' : 'bg-transparent'}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: filterType === 'STATUS' }}
          >
            <Text className={`text-xs font-bold ${filterType === 'STATUS' ? 'text-primary' : 'text-muted-foreground'}`}>
              Status
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterType('PRIORITY')}
            className={`px-2.5 py-1 rounded-lg ${filterType === 'PRIORITY' ? 'bg-card shadow-xs' : 'bg-transparent'}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: filterType === 'PRIORITY' }}
          >
            <Text className={`text-xs font-bold ${filterType === 'PRIORITY' ? 'text-primary' : 'text-muted-foreground'}`}>
              Priority
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterType('CATEGORY')}
            className={`px-2.5 py-1 rounded-lg ${filterType === 'CATEGORY' ? 'bg-card shadow-xs' : 'bg-transparent'}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: filterType === 'CATEGORY' }}
          >
            <Text className={`text-xs font-bold ${filterType === 'CATEGORY' ? 'text-primary' : 'text-muted-foreground'}`}>
              Category
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Filter Bar with Dynamic Status, Priority, or Category Pills matching reference UI */}
      <SearchFilterBar
        searchValue={localSearch}
        onSearchChange={handleSearchChange}
        searchPlaceholder={
          filterType === 'STATUS'
            ? 'Search notices by title, description...'
            : filterType === 'PRIORITY'
            ? 'Search notices by priority, title...'
            : 'Search notices by category, title...'
        }
        sortOptions={
          filterType === 'STATUS'
            ? STATUS_FILTER_OPTIONS
            : filterType === 'PRIORITY'
            ? PRIORITY_FILTER_OPTIONS
            : CATEGORY_FILTER_OPTIONS
        }
        currentSort={
          filterType === 'STATUS'
            ? (filters.status || 'ALL')
            : filterType === 'PRIORITY'
            ? (filters.priority || 'ALL')
            : (filters.category || 'ALL')
        }
        onSortChange={
          filterType === 'STATUS'
            ? handleStatusFilterChange
            : filterType === 'PRIORITY'
            ? handlePriorityFilterChange
            : handleCategoryFilterChange
        }
        variant="default"
        className="px-0 py-0 border-0"
      />
    </View>
  );

  return (
    <ScreenShell
      title="All Community Notices"
      subtitle="Master notice registry & audience dispatch filters"
      headerRight={
        canCreate ? (
          <Button
            size="sm"
            onPress={() => router.navigate('/(resident)/notices/create')}
            className="bg-emerald-600 active:bg-emerald-700 flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Create New Community Notice"
          >
            <Plus size={14} color="#ffffff" />
            <Text className="text-xs font-bold text-white">New Notice</Text>
          </Button>
        ) : null
      }
    >
      <View className="flex-1 bg-background">
        {/* Error message if any */}
        {error && notices.length === 0 && (
          <View className="m-4 p-3 bg-destructive/10 rounded-xl border border-destructive/20">
            <Text className="text-destructive font-semibold text-center">{error}</Text>
          </View>
        )}

        {/* Paginated List matching Visitor Management structure */}
        {loading && notices.length === 0 ? (
          <View className="px-4 pt-3">
            {renderHeader()}
            <NoticeBoardLoadingSkeleton />
          </View>
        ) : (
          <PaginatedList
            data={notices}
            extraData={language}
            renderItem={renderNoticeItem}
            keyExtractor={(item) => `${item._id || item.id}-${language}`}
            loading={loading}
            onRefresh={handleRefresh}
            onLoadMore={handleLoadMore}
            pagination={{
              currentPage: pagination.currentPage,
              totalPages: pagination.totalPages,
            }}
            ListHeaderComponent={renderHeader()}
            emptyIcon="Megaphone"
            emptyTitle={t('no_notices', 'No Community Notices Found')}
            emptySubtitle={t('no_matching_notices', 'No notices matched your search or status filter parameters.')}
            contentContainerClassName="px-4 pt-3 pb-28"
          />
        )}

        {/* Floating Action Button for Community Engagement Creation */}
        {canCreate && (
          <FAB
            icon={Plus}
            onPress={() => setTypeSheetOpen(true)}
            accessibilityLabel="Create Community Engagement Content"
          />
        )}

        {/* Stage 1 Selection Sheet for Community Engagement Archetypes */}
        <CommunityEngagementTypeSheet
          visible={typeSheetOpen}
          onClose={() => setTypeSheetOpen(false)}
          onSelectType={(type) => {
            router.navigate(`/(resident)/community-engagement/create?type=${type}`);
          }}
        />

        {/* Force Delete Confirmation Modal */}
        <ConfirmationModal
          visible={!!deleteConfirmId}
          title="Delete Notice?"
          message="Are you sure you want to permanently delete this notice? This action cannot be undone."
          variant="danger"
          confirmLabel="Delete Notice"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirmId(null)}
        />
      </View>
    </ScreenShell>
  );
}

export default function ManageNoticesScreen() {
  return (
    <ErrorBoundary>
      <ManageNoticesContent />
    </ErrorBoundary>
  );
}
