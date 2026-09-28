import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';

import { ScreenShell } from '@/components/ui/ScreenShell';
import { SearchFilterBar, SortOption } from '@/components/ui/SearchFilterBar';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Chip } from '@/components/common/Chip';
import { useTranslation } from '@/src/utils/i18n';

import { useNoticeBoard } from '../hooks/useNoticeBoard';
import { useNoticeSocket } from '../hooks/useNoticeSocket';
import {
  NoticePostCard,
  PollPostCard,
  ActiveBoardFilterDrawer,
  DEFAULT_ACTIVE_BOARD_FILTERS,
  ErrorBoundary,
  NoticeBoardLoadingSkeleton,
} from '../components';
import { pollApi } from '@/src/features/poll/services/pollApi';
import { debounce } from '../utils/debounce';
import {
  Megaphone,
  BarChart3,
  Layers,
  RotateCcw,
} from 'lucide-react-native';

import { usePolls } from '@/src/features/poll/hooks/usePolls.js';

export default function ActiveBoardScreen() {
  const router = useRouter();
  const { openNoticeId } = useLocalSearchParams();
  const { t, language } = useTranslation();
  const { selectCurrentPoll } = usePolls();

  // Real-time socket sync
  useNoticeSocket();

  const {
    notices,
    loading,
    pagination,
    search,
    filters,
    sort,
    loadNotices,
    setSearch,
    setFilters,
    setCurrentPage,
    selectNotice,
    readNotice,
    toggleBookmark,
    acknowledgeNotice,
    clearNotices,
    user,
    canManage,
    isAdmin,
  } = useNoticeBoard();

  // Perspective mode: 'ALL' | 'NOTICES' | 'POLLS'
  const [perspectiveMode, setPerspectiveMode] = useState('ALL');

  // Quick pill filter: 'ALL' | 'URGENT' | 'PINNED' | 'SIGNOFF' | 'Maintenance' | 'Events' | 'General' | 'Meetings'
  const [activeQuickPill, setActiveQuickPill] = useState('ALL');

  // Local debounced search
  const [localSearch, setLocalSearch] = useState(search || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search || '');

  // Advanced Filter Drawer state
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState(DEFAULT_ACTIVE_BOARD_FILTERS);

  // Polls dataset
  const [polls, setPolls] = useState([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [pollPagination, setPollPagination] = useState({ currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 });
  const requestVersionRef = useRef(0);
  const communityId = String(user?.activeOrgId || user?.orgId || user?.organizationId || user?.activeOrganizationId || '');

  // Fetch active polls
  const fetchActivePolls = useCallback(async (page = 1) => {
    const requestVersion = requestVersionRef.current;
    try {
      setPollsLoading(true);
      const res = await pollApi.getPolls({ status: 'Active', page, limit: 20 });
      const raw = res?.data?.data?.polls || res?.data?.data || res?.data?.polls || res?.data || [];
      if (requestVersion !== requestVersionRef.current) return;
      const nextPolls = Array.isArray(raw) ? raw : [];
      setPolls((current) => page > 1
        ? [...current, ...nextPolls.filter((poll) => !current.some((existing) => String(existing._id || existing.id) === String(poll._id || poll.id)))]
        : nextPolls);
      const paginationMeta = res?.data?.data?.pagination || res?.data?.pagination || {};
      setPollPagination({
        currentPage: Number(paginationMeta.currentPage || paginationMeta.page || page),
        totalPages: Number(paginationMeta.totalPages || paginationMeta.pages || 1),
        totalRecords: Number(paginationMeta.totalRecords || paginationMeta.total || nextPolls.length),
        limit: Number(paginationMeta.limit || 20),
      });
    } catch {
      if (requestVersion === requestVersionRef.current && page === 1) setPolls([]);
    } finally {
      setPollsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Prevent old community data or an in-flight response from rendering while
    // the tenant context changes.
    requestVersionRef.current += 1;
    clearNotices();
    setPolls([]);
    setPollPagination({ currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 });
  }, [communityId, clearNotices]);

  // Initialize board and apply default Published status on mount & focus
  useFocusEffect(
    useCallback(() => {
      setFilters({ status: 'Published' });
      setCurrentPage(1);
      loadNotices({ page: 1, status: 'Published' });
      fetchActivePolls(1);
    }, [communityId, setFilters, setCurrentPage, loadNotices, fetchActivePolls])
  );

  // Deep-linking to automatically open notice details
  useEffect(() => {
    if (openNoticeId && notices.length > 0) {
      const notice = notices.find((n) => n._id === openNoticeId);
      if (notice) {
        selectNotice(notice);
        if (!notice.isReadByUser) {
          readNotice(notice._id);
        }
        router.push({
          pathname: '/(resident)/notices/[id]',
          params: { id: notice._id },
        });
      }
    }
  }, [openNoticeId, notices, selectNotice, readNotice, router]);

  // Debounced search updates
  const debouncedSearchUpdate = useMemo(
    () =>
      debounce((val) => {
        setDebouncedSearch(val);
        setSearch(val);
      }, 300),
    [setSearch]
  );

  const handleSearchChange = useCallback(
    (value) => {
      setLocalSearch(value);
      debouncedSearchUpdate(value);
    },
    [debouncedSearchUpdate]
  );

  const handleRefresh = useCallback(() => {
    setCurrentPage(1);
    loadNotices({ page: 1, status: 'Published' });
    fetchActivePolls(1);
  }, [loadNotices, fetchActivePolls, setCurrentPage]);

  const handleLoadMore = useCallback(() => {
    const hasMoreNotices = pagination.currentPage < pagination.totalPages;
    const hasMorePolls = pollPagination.currentPage < pollPagination.totalPages;
    if ((!hasMoreNotices && !hasMorePolls) || loading || pollsLoading) return;

    const nextPage = Math.max(pagination.currentPage, pollPagination.currentPage) + 1;
    if (hasMoreNotices) {
      setCurrentPage(nextPage);
      loadNotices({ page: nextPage, status: 'Published' });
    }
    if (hasMorePolls) fetchActivePolls(nextPage);
  }, [pagination, loading, pollsLoading, setCurrentPage, loadNotices, pollPagination, fetchActivePolls]);

  const handleCardPress = useCallback(
    (notice) => {
      selectNotice(notice);
      if (!notice.isReadByUser) {
        readNotice(notice._id);
      }
      router.push({
        pathname: '/(resident)/notices/[id]',
        params: { id: notice._id },
      });
    },
    [selectNotice, readNotice, router]
  );

  const handlePollPress = useCallback(
    (poll) => {
      if (poll) {
        selectCurrentPoll(poll);
      }
      router.push({
        pathname: '/(resident)/polls/[id]',
        params: { id: poll._id || poll.id },
      });
    },
    [router, selectCurrentPoll]
  );

  const handleBookmarkPress = useCallback(
    (id, isBookmarked) => {
      toggleBookmark(id, isBookmarked);
    },
    [toggleBookmark]
  );

  const handleAcknowledgePress = useCallback(
    async (id) => {
      try {
        await acknowledgeNotice(id, '');
        handleRefresh();
      } catch {
        router.push({
          pathname: '/(resident)/notices/[id]',
          params: { id },
        });
      }
    },
    [acknowledgeNotice, handleRefresh, router]
  );

  // Combine raw notices & active polls based on perspective mode
  const combinedItems = useMemo(() => {
    const rawNotices = (notices || []).map((n) => ({ ...n, itemType: 'NOTICE' }));
    const rawPolls = (polls || []).map((p) => ({ ...p, itemType: 'POLL' }));

    if (perspectiveMode === 'NOTICES') return rawNotices;
    if (perspectiveMode === 'POLLS') return rawPolls;

    return [...rawNotices, ...rawPolls].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [perspectiveMode, notices, polls]);

  // Live item count calculations for quick pill badges
  const liveCounts = useMemo(() => {
    let all = 0;
    let urgent = 0;
    let pinned = 0;
    let signoff = 0;
    let maintenance = 0;
    let events = 0;
    let general = 0;
    let meetings = 0;

    (notices || []).forEach((n) => {
      all++;
      const isUrgent = n.priority === 'High' || n.priority === 'Critical' || n.isCritical;
      if (isUrgent) urgent++;
      if (n.isPinned) pinned++;
      if (n.requiresAcknowledgement && !n.hasAcknowledged) signoff++;
      if (n.category === 'Maintenance') maintenance++;
      if (n.category === 'Events') events++;
      if (n.category === 'General') general++;
      if (n.category === 'Meetings') meetings++;
    });

    return { all, urgent, pinned, signoff, maintenance, events, general, meetings };
  }, [notices]);

  // Quick pill options for the horizontal scroll bar in SearchFilterBar
  const quickPillOptions = useMemo(
    () => [
      { label: `${t('all', 'All')} (${liveCounts.all})`, value: 'ALL' },
      { label: `🚨 ${t('priority_urgent', 'Urgent')} (${liveCounts.urgent})`, value: 'URGENT' },
      { label: `📌 ${t('pinned', 'Pinned')} (${liveCounts.pinned})`, value: 'PINNED' },
      { label: `✍️ ${t('needs_signoff', 'Needs Sign-off')} (${liveCounts.signoff})`, value: 'SIGNOFF' },
      { label: `🛠️ ${t('maintenance', 'Maintenance')} (${liveCounts.maintenance})`, value: 'Maintenance' },
      { label: `🎉 ${t('events', 'Events')} (${liveCounts.events})`, value: 'Events' },
      { label: `📢 ${t('general', 'General')} (${liveCounts.general})`, value: 'General' },
      { label: `🏛️ ${t('meetings', 'Meetings')} (${liveCounts.meetings})`, value: 'Meetings' },
    ],
    [liveCounts, t]
  );

  // Apply Quick Pill, Search, and Advanced Drawer Filters
  const filteredFeedItems = useMemo(() => {
    return combinedItems.filter((item) => {
      // If it's a poll, only filter by search keyword unless in poll mode
      if (item.itemType === 'POLL') {
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase();
          const match =
            item.question?.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      }

      // 1. Quick Pill Filter
      if (activeQuickPill === 'URGENT') {
        const isUrgent =
          item.priority === 'High' || item.priority === 'Critical' || item.isCritical;
        if (!isUrgent) return false;
      } else if (activeQuickPill === 'PINNED') {
        if (!item.isPinned) return false;
      } else if (activeQuickPill === 'SIGNOFF') {
        if (!item.requiresAcknowledgement || item.hasAcknowledged) return false;
      } else if (activeQuickPill !== 'ALL') {
        if (item.category !== activeQuickPill) return false;
      }

      // 2. Debounced Search Keyword Filter
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        const matchAuthor =
          item.author?.name?.toLowerCase().includes(q) ||
          item.createdBy?.name?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCat && !matchAuthor) return false;
      }

      // 3. Advanced Drawer Filters
      if (activeFilters.categories.length > 0) {
        if (!activeFilters.categories.includes(item.category)) return false;
      }

      if (activeFilters.priorities.length > 0) {
        if (!activeFilters.priorities.includes(item.priority)) return false;
      }

      if (activeFilters.requiresSignoffOnly) {
        if (!item.requiresAcknowledgement || item.hasAcknowledged) return false;
      }

      if (activeFilters.unreadOnly) {
        if (item.isReadByUser) return false;
      }

      if (activeFilters.isPinnedOnly) {
        if (!item.isPinned) return false;
      }

      if (activeFilters.hasImagesOnly) {
        if (!item.images || item.images.length === 0) return false;
      }

      if (activeFilters.hasDocsOnly) {
        if (!item.attachments || item.attachments.length === 0) return false;
      }

      // Date range filter
      if (activeFilters.datePreset !== 'ALL_TIME') {
        const itemDate = new Date(item.createdAt).getTime();
        const now = new Date().getTime();
        if (activeFilters.datePreset === 'TODAY') {
          const oneDayMs = 24 * 60 * 60 * 1000;
          if (now - itemDate > oneDayMs) return false;
        } else if (activeFilters.datePreset === 'THIS_WEEK') {
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
          if (now - itemDate > sevenDaysMs) return false;
        } else if (activeFilters.datePreset === 'PAST_30_DAYS') {
          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
          if (now - itemDate > thirtyDaysMs) return false;
        }
      }

      return true;
    });
  }, [combinedItems, activeQuickPill, debouncedSearch, activeFilters]);

  // Active filter count badge for drawer button
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilters.categories?.length > 0) count++;
    if (activeFilters.priorities?.length > 0) count++;
    if (activeFilters.requiresSignoffOnly) count++;
    if (activeFilters.unreadOnly) count++;
    if (activeFilters.isPinnedOnly) count++;
    if (activeFilters.hasImagesOnly) count++;
    if (activeFilters.hasDocsOnly) count++;
    if (activeFilters.datePreset !== 'ALL_TIME') count++;
    return count;
  }, [activeFilters]);

  const isFilterActive =
    activeQuickPill !== 'ALL' ||
    Boolean(debouncedSearch) ||
    activeFilterCount > 0 ||
    perspectiveMode !== 'ALL';

  const handleResetAllFilters = useCallback(() => {
    setActiveQuickPill('ALL');
    setLocalSearch('');
    setDebouncedSearch('');
    setSearch('');
    setActiveFilters(DEFAULT_ACTIVE_BOARD_FILTERS);
    setPerspectiveMode('ALL');
  }, [setSearch]);

  const renderHeader = () => (
    <View className="mb-2 gap-2.5">
      {/* 1. Search Input First */}
      <SearchFilterBar
        searchValue={localSearch}
        onSearchChange={handleSearchChange}
        searchPlaceholder={t('search_notices', 'Search announcements, updates, keywords...')}
        sortOptions={quickPillOptions}
        currentSort={activeQuickPill}
        onSortChange={setActiveQuickPill}
        onFilterPress={() => setFilterDrawerVisible(true)}
        activeFilterCount={activeFilterCount}
        className="px-0 py-0 border-0"
      />

      {/* 2. Below Search Bar: Perspective Mode Boxes */}
      <View className="flex-row items-center gap-2 pt-0.5 pb-0.5">
        {[
          {
            id: 'ALL',
            label: t('all_active', 'All Active'),
            count: (notices?.length || 0) + (polls?.length || 0),
            icon: Layers,
          },
          {
            id: 'NOTICES',
            label: t('announcements', 'Announcements'),
            count: notices?.length || 0,
            icon: Megaphone,
          },
          {
            id: 'POLLS',
            label: t('live_polls', 'Live Polls'),
            count: polls?.length || 0,
            icon: BarChart3,
          },
        ].map((item) => {
          const isSelected = perspectiveMode === item.id;
          const Icon = item.icon;
          return (
            <Pressable
              key={item.id}
              onPress={() => setPerspectiveMode(item.id)}
              className={`flex-1 flex-col items-center justify-center py-2 px-1.5 rounded-xl border min-h-[58px] shadow-2xs active:opacity-85 ${
                isSelected
                  ? 'border-primary bg-primary'
                  : 'border-border/80 bg-card active:bg-secondary/60'
              }`}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}, ${item.count}`}
            >
              <View className="flex-row items-center justify-center gap-1.5 mb-1">
                <Icon
                  size={14}
                  className={isSelected ? 'text-white' : 'text-primary'}
                />
                <View
                  className={`px-1.5 py-0.2 rounded-full items-center justify-center ${
                    isSelected ? 'bg-white/25' : 'bg-primary/10'
                  }`}
                >
                  <Text
                    className={`text-[10.5px] font-bold font-sans ${
                      isSelected ? 'text-white' : 'text-primary'
                    }`}
                  >
                    {item.count}
                  </Text>
                </View>
              </View>
              <Text
                numberOfLines={1}
                className={`text-[11.5px] font-semibold text-center leading-tight ${
                  isSelected ? 'text-white font-bold' : 'text-foreground'
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderFeedItem = useCallback(
    (item) => {
      if (item.itemType === 'POLL' || (!item.category && item.question)) {
        return (
          <PollPostCard
            key={`poll-${item._id || item.id}`}
            poll={item}
            onPress={handlePollPress}
          />
        );
      }

      return (
        <NoticePostCard
          key={`notice-${item._id || item.id}`}
          notice={item}
          onPress={handleCardPress}
          onBookmarkToggle={handleBookmarkPress}
          onAcknowledge={handleAcknowledgePress}
          isAdmin={isAdmin}
        />
      );
    },
    [handleCardPress, handlePollPress, handleBookmarkPress, handleAcknowledgePress, isAdmin]
  );

  const isLoadingInitial = loading && notices.length === 0;

  return (
    <ErrorBoundary>
      <ScreenShell
        title={t('notice_board', 'Notice Board')}
        subtitle={t('official_announcements', 'Live community announcements & resident votes')}
        iconName="Megaphone"
        loading={false}
        scrollable={false}
        headerRight={
          <Button
            variant="ghost"
            size="sm"
            onPress={handleRefresh}
            className="w-9 h-9 rounded-full items-center justify-center p-0"
            accessibilityRole="button"
            accessibilityLabel="Refresh notices"
          >
            <RotateCcw size={16} className="text-foreground" />
          </Button>
        }
      >
        <View className="flex-1 bg-background">
          {isLoadingInitial ? (
            <View className="p-4">
              <NoticeBoardLoadingSkeleton />
            </View>
          ) : (
            <PaginatedList
              data={filteredFeedItems}
              extraData={language}
              renderItem={renderFeedItem}
              keyExtractor={(item) =>
                item.itemType === 'POLL'
                  ? `poll-${item._id || item.id}-${language}`
                  : `notice-${item._id || item.id}-${language}`
              }
              loading={loading || pollsLoading}
              onRefresh={handleRefresh}
              onLoadMore={handleLoadMore}
              pagination={{
                currentPage: Math.max(pagination.currentPage, pollPagination.currentPage),
                totalPages: Math.max(pagination.totalPages, pollPagination.totalPages),
                totalRecords: pagination.totalRecords + pollPagination.totalRecords,
                limit: pagination.limit || 10,
              }}
              paginationSummary
              emptyIcon="Megaphone"
              emptyTitle={
                isFilterActive
                  ? t('no_matching_notices', 'No Matching Announcements')
                  : t('no_notices', 'No Active Announcements')
              }
              emptySubtitle={
                isFilterActive
                  ? t(
                      'try_adjusting_filters',
                      'No announcements match the selected filter criteria. Tap below to reset.'
                    )
                  : t(
                      'check_back_later',
                      'There are currently no active community announcements or live ballots.'
                    )
              }
              emptyAction={
                isFilterActive ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={handleResetAllFilters}
                    className="mt-2 rounded-xl"
                  >
                    <Text className="text-xs font-semibold text-foreground">
                      {t('reset_all_filters', 'Reset All Filters')}
                    </Text>
                  </Button>
                ) : undefined
              }
              ListHeaderComponent={renderHeader()}
              contentContainerClassName="px-4 pt-2 pb-36 gap-3"
              contentContainerStyle={{ paddingBottom: 110 }}
            />
          )}
        </View>

        {/* Advanced Filter Sliding Drawer */}
        <ActiveBoardFilterDrawer
          visible={filterDrawerVisible}
          onClose={() => setFilterDrawerVisible(false)}
          filters={activeFilters}
          onApply={setActiveFilters}
          onReset={() => setActiveFilters(DEFAULT_ACTIVE_BOARD_FILTERS)}
          matchCount={filteredFeedItems.length}
        />
      </ScreenShell>
    </ErrorBoundary>
  );
}
