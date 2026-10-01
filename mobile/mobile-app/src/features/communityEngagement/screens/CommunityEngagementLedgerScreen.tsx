import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { SearchFilterBar, SortOption } from '@/components/ui/SearchFilterBar';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { HeaderActionButton } from '@/components/ui/HeaderActionButton';
import { Text } from '@/components/ui/text';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { CommunityEngagementTypeSheet } from '../components/CommunityEngagementTypeSheet';
import { CommunityEngagementFilterDrawer } from '../components/CommunityEngagementFilterDrawer';
import { EngagementGroupingToggle, EngagementPerspectiveMode } from '../components/EngagementGroupingToggle';
import { EngagementCard, EngagementCardItem } from '../components/EngagementCard';
import { EngagementActionsBottomSheet } from '../components/EngagementActionsBottomSheet';
import {
  EngagementContentType,
  CommunityEngagementFilterValues,
} from '../types/communityEngagement.types';
import * as noticeBoardService from '@/src/features/noticeBoard/services/noticeBoardService';
import { pollApi } from '@/src/features/poll/services/pollApi';
import { useTranslation } from '@/src/utils/i18n';

const DEFAULT_FILTERS: CommunityEngagementFilterValues = {
  datePreset: 'ALL_TIME',
  startDate: '',
  endDate: '',
  priorities: [],
  categories: [],
  audienceScope: 'ALL',
  selectedRoleIds: [],
  pollVotingModes: [],
  pollChoiceTypes: [],
  isPinnedOnly: false,
  requiresAcknowledgementOnly: false,
};

export function CommunityEngagementLedgerScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tab?: string; status?: string; priority?: string }>();

  // Row 4: Perspective mode state ('ALL' | 'NOTICES' | 'POLLS')
  const [perspectiveMode, setPerspectiveMode] = useState<EngagementPerspectiveMode>(
    params.tab?.toUpperCase() === 'NOTICES'
      ? 'NOTICES'
      : params.tab?.toUpperCase() === 'POLLS'
      ? 'POLLS'
      : 'ALL'
  );

  // Row 2: Status filter
  const [selectedStatus, setSelectedStatus] = useState<string>(
    params.status
      ? ['ACTIVE', 'PUBLISHED'].includes(params.status.toUpperCase())
        ? 'ACTIVE'
        : params.status.toUpperCase() === 'DRAFT'
        ? 'DRAFT'
        : ['CLOSED', 'EXPIRED'].includes(params.status.toUpperCase())
        ? 'EXPIRED'
        : 'ALL'
      : 'ALL'
  );

  // Row 3: Debounced search state
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Advanced Filter Drawer state
  const [filterDrawerVisible, setFilterDrawerVisible] = useState<boolean>(false);
  const [activeFilters, setActiveFilters] = useState<CommunityEngagementFilterValues>(DEFAULT_FILTERS);

  // Creation Type Sheet state
  const [typeSheetVisible, setTypeSheetVisible] = useState<boolean>(false);

  // Contextual Actions Bottom Sheet state
  const [selectedItem, setSelectedItem] = useState<EngagementCardItem | null>(null);

  // Data & Pagination state
  const [rawNotices, setRawNotices] = useState<EngagementCardItem[]>([]);
  const [rawPolls, setRawPolls] = useState<EngagementCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch raw dataset from both services
  const fetchLedgerData = useCallback(
    async (currentPage = 1, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const fetchNotices = perspectiveMode === 'ALL' || perspectiveMode === 'NOTICES';
        const fetchPolls = perspectiveMode === 'ALL' || perspectiveMode === 'POLLS';

        const promises: Promise<any>[] = [];

        const statusFilter = selectedStatus !== 'ALL' ? selectedStatus : undefined;

        // 1. Notices query
        if (fetchNotices) {
          promises.push(
            noticeBoardService
              .getNotices({
                page: currentPage,
                limit: 50,
                search: debouncedSearch || undefined,
                status: statusFilter,
                priority: params.priority || undefined,
                sortBy: 'createdAt',
                sortOrder: 'desc',
              })
              .catch(() => ({ data: { data: { notices: [] } } }))
          );
        } else {
          promises.push(Promise.resolve(null));
        }

        // 2. Polls query
        if (fetchPolls) {
          promises.push(
            pollApi
              .getPolls({
                page: currentPage,
                limit: 50,
                search: debouncedSearch || undefined,
                status: statusFilter,
                sort: 'latest',
              })
              .catch(() => ({ data: { data: { polls: [] } } }))
          );
        } else {
          promises.push(Promise.resolve(null));
        }

        const [noticeRes, pollRes] = await Promise.all(promises);

        // Normalize notices
        const collectedNotices: EngagementCardItem[] = [];
        if (noticeRes?.data) {
          const payload = noticeRes.data?.data || noticeRes.data;
          const raw = Array.isArray(payload?.notices)
            ? payload.notices
            : Array.isArray(payload)
            ? payload
            : [];

          raw.forEach((n: any) => {
            if (!n?._id) return;
            collectedNotices.push({
              id: n._id,
              type: 'NOTICE',
              title: n.title || 'Untitled Notice',
              subtitle: n.category ? `${n.category} • ${n.priority || 'Medium'} Priority` : 'Notice',
              description: n.description,
              status: n.status || 'Published',
              priority: n.priority,
              category: n.category,
              isPinned: Boolean(n.isPinned),
              requiresAcknowledgement: Boolean(n.requiresAcknowledgement),
              targetAudience: n.targetAudience,
              createdAt: n.createdAt || new Date().toISOString(),
              expiryDate: n.expiryDate,
              route: `/(resident)/notices/${n._id}`,
            });
          });
        }

        // Normalize polls
        const collectedPolls: EngagementCardItem[] = [];
        if (pollRes?.data) {
          const payload = pollRes.data?.data || pollRes.data;
          const raw = Array.isArray(payload?.polls)
            ? payload.polls
            : Array.isArray(payload)
            ? payload
            : [];

          raw.forEach((p: any) => {
            if (!p?._id) return;
            const votesTotal = Array.isArray(p.options)
              ? p.options.reduce((acc: number, opt: any) => acc + (opt.votesCount || 0), 0)
              : 0;

            collectedPolls.push({
              id: p._id,
              type: 'POLL',
              title: p.question || 'Untitled Poll',
              subtitle: `${p.options?.length || 0} Options • ${votesTotal} Votes Submitted`,
              description: p.description,
              status: p.status || 'Active',
              votingMode: p.votingMode || 'PUBLIC',
              choiceType: p.choiceType || 'SINGLE_CHOICE',
              targetAudience: p.targetAudience,
              votesCount: votesTotal,
              optionsCount: p.options?.length || 0,
              createdAt: p.createdAt || new Date().toISOString(),
              expiryDate: p.endDate,
              route: `/(resident)/polls/${p._id}`,
            });
          });
        }

        if (currentPage === 1) {
          setRawNotices(collectedNotices);
          setRawPolls(collectedPolls);
        } else {
          setRawNotices((prev) => [...prev, ...collectedNotices]);
          setRawPolls((prev) => [...prev, ...collectedPolls]);
        }

        setHasMore(collectedNotices.length + collectedPolls.length >= 20);
      } catch (err: any) {
        console.error('[CommunityEngagementLedger] Failed to fetch items:', err);
        setError('Failed to load community engagement items. Please pull to refresh.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [perspectiveMode, debouncedSearch, selectedStatus, params.priority]
  );

  useEffect(() => {
    setPage(1);
    fetchLedgerData(1);
  }, [fetchLedgerData]);

  const handleRefresh = useCallback(() => {
    setPage(1);
    fetchLedgerData(1, true);
  }, [fetchLedgerData]);

  const handleLoadMore = useCallback(() => {
    if (!loading && !refreshing && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchLedgerData(nextPage);
    }
  }, [loading, refreshing, hasMore, page, fetchLedgerData]);

  // Combine raw dataset according to perspective selection
  const combinedRawItems = useMemo(() => {
    if (perspectiveMode === 'NOTICES') return rawNotices;
    if (perspectiveMode === 'POLLS') return rawPolls;
    return [...rawNotices, ...rawPolls].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [perspectiveMode, rawNotices, rawPolls]);

  // Dynamic live count calculations for Status Pills (Row 2)
  const statusCounts = useMemo(() => {
    let all = 0;
    let active = 0;
    let draft = 0;
    let expired = 0;

    combinedRawItems.forEach((item) => {
      all++;
      const s = (item.status || '').toUpperCase();
      if (s === 'ACTIVE' || s === 'PUBLISHED') {
        active++;
      } else if (s === 'DRAFT') {
        draft++;
      } else if (s === 'CLOSED' || s === 'EXPIRED' || s === 'ARCHIVED') {
        expired++;
      }
    });

    return { all, active, draft, expired };
  }, [combinedRawItems]);

  // Row 2: Status pill options with dynamic count badges
  const statusSortOptions: SortOption[] = useMemo(
    () => [
      { label: `${t('all')} (${statusCounts.all})`, value: 'ALL' },
      { label: `🟢 ${t('status_active')} (${statusCounts.active})`, value: 'ACTIVE' },
      { label: `🟡 ${t('status_draft')} (${statusCounts.draft})`, value: 'DRAFT' },
      { label: `⚪ ${t('status_expired')} (${statusCounts.expired})`, value: 'EXPIRED' },
    ],
    [statusCounts, t]
  );

  // Apply Advanced Filters + Status Filter on combined dataset
  const filteredItems = useMemo(() => {
    return combinedRawItems.filter((item) => {
      // 1. Status Filter
      if (selectedStatus !== 'ALL') {
        const s = (item.status || '').toUpperCase();
        if (selectedStatus === 'ACTIVE' && s !== 'ACTIVE' && s !== 'PUBLISHED') return false;
        if (selectedStatus === 'DRAFT' && s !== 'DRAFT') return false;
        if (
          selectedStatus === 'EXPIRED' &&
          s !== 'EXPIRED' &&
          s !== 'CLOSED' &&
          s !== 'ARCHIVED'
        )
          return false;
      }

      // 2. Date Range Filter
      if (activeFilters.startDate || activeFilters.endDate) {
        const itemDate = new Date(item.createdAt).getTime();
        if (activeFilters.startDate) {
          const start = new Date(`${activeFilters.startDate}T00:00:00`).getTime();
          if (itemDate < start) return false;
        }
        if (activeFilters.endDate) {
          const end = new Date(`${activeFilters.endDate}T23:59:59`).getTime();
          if (itemDate > end) return false;
        }
      }

      // 3. Notice Priority Multi-select
      if (item.type === 'NOTICE' && activeFilters.priorities.length > 0) {
        if (!item.priority || !activeFilters.priorities.includes(item.priority as any)) {
          return false;
        }
      }

      // 4. Notice Category Multi-select
      if (item.type === 'NOTICE' && activeFilters.categories.length > 0) {
        if (!item.category || !activeFilters.categories.includes(item.category as any)) {
          return false;
        }
      }

      // 5. Governance Flags
      if (activeFilters.isPinnedOnly && !item.isPinned) return false;
      if (activeFilters.requiresAcknowledgementOnly && !item.requiresAcknowledgement) return false;

      return true;
    });
  }, [combinedRawItems, selectedStatus, activeFilters]);

  // Calculate active filter count badge for drawer trigger button
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilters.datePreset !== 'ALL_TIME' || activeFilters.startDate || activeFilters.endDate)
      count++;
    if (activeFilters.priorities?.length > 0) count++;
    if (activeFilters.categories?.length > 0) count++;
    if (activeFilters.audienceScope !== 'ALL') count++;
    if (activeFilters.selectedRoleIds?.length > 0) count++;
    if (activeFilters.pollVotingModes?.length > 0) count++;
    if (activeFilters.pollChoiceTypes?.length > 0) count++;
    if (activeFilters.isPinnedOnly) count++;
    if (activeFilters.requiresAcknowledgementOnly) count++;
    return count;
  }, [activeFilters]);

  const handleSelectType = (type: EngagementContentType) => {
    setTypeSheetVisible(false);
    router.navigate({
      pathname: '/(resident)/community-engagement/create' as any,
      params: { type },
    });
  };

  const paginationMeta = useMemo(
    () => ({
      currentPage: page,
      totalPages: hasMore ? page + 1 : page,
      totalRecords: filteredItems.length,
      limit: 20,
    }),
    [page, hasMore, filteredItems.length]
  );

  return (
    <ScreenShell
      title={t('manage_engagement', 'Manage Engagement')}
      subtitle={t('total_engagements_count', { count: combinedRawItems.length })}
      iconName="FilePenLine"
      scrollable={false}
      showBackButton={true}
      showIconWithBackButton={false}
      loading={loading && combinedRawItems.length === 0}
      headerRight={
        <HeaderActionButton
          icon={Plus}
          label={t('create_engagement', 'Create Engagement')}
          onPress={() => setTypeSheetVisible(true)}
          accessibilityLabel={t('create_engagement')}
        />
      }
    >
      <View className="flex-1 bg-background">
        {/* Error Banner */}
        {error ? (
          <View className="px-4 pt-2">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </View>
        ) : null}

        {/* 1. Search Bar First */}
        <SearchFilterBar
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder={t('search_engagements_placeholder', 'Search notices, polls, keywords...')}
          sortOptions={statusSortOptions}
          currentSort={selectedStatus}
          onSortChange={(val) => setSelectedStatus(val as any)}
          onFilterPress={() => setFilterDrawerVisible(true)}
          activeFilterCount={activeFilterCount}
          className="px-4 py-2"
        />

        {/* 2. Below Search Bar: Perspective Grouping Boxes */}
        <EngagementGroupingToggle
          mode={perspectiveMode}
          onModeChange={setPerspectiveMode}
          noticeCount={rawNotices.length}
          pollCount={rawPolls.length}
        />

        {/* 3. Paginated Record Feed */}
        <PaginatedList<EngagementCardItem>
          data={filteredItems}
          pagination={paginationMeta}
          onLoadMore={handleLoadMore}
          onRefresh={handleRefresh}
          loading={loading && !refreshing}
          refreshing={refreshing}
          emptyIcon="Megaphone"
          emptyTitle={t('no_engagements_found')}
          emptySubtitle={
            searchInput.trim() || activeFilterCount > 0 || selectedStatus !== 'ALL'
              ? t('no_engagements_match_filters')
              : t('no_engagements_yet')
          }
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerClassName="px-4 pt-2 pb-28 gap-2.5"
          contentContainerStyle={{ paddingBottom: 110 }}
          renderItem={(item) => (
            <EngagementCard
              key={`${item.type}-${item.id}`}
              item={item}
              onPress={() => setSelectedItem(item)}
            />
          )}
        />

        {/* Contextual Action Sheet */}
        <EngagementActionsBottomSheet
          visible={!!selectedItem}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onActionSuccess={handleRefresh}
        />

        {/* Advanced Filter Drawer */}
        <CommunityEngagementFilterDrawer
          visible={filterDrawerVisible}
          onClose={() => setFilterDrawerVisible(false)}
          filters={activeFilters}
          activeTypeFilter={perspectiveMode}
          onApply={(newFilters) => setActiveFilters(newFilters)}
          onReset={() => setActiveFilters(DEFAULT_FILTERS)}
        />

        {/* Unified Creation Archetype Selection Sheet */}
        <CommunityEngagementTypeSheet
          visible={typeSheetVisible}
          onClose={() => setTypeSheetVisible(false)}
          onSelectType={handleSelectType}
        />
      </View>
    </ScreenShell>
  );
}

export default CommunityEngagementLedgerScreen;
