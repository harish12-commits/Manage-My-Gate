import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, BarChart3, CheckCircle, Clock, CheckSquare } from 'lucide-react-native';

import { ScreenShell } from '@/components/ui/ScreenShell';
import { TabBar } from '@/components/ui/TabBar';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { KPIDashboardStrip } from '@/components/ui/KPIDashboardStrip';
import { ActionGrid } from '@/components/ui/ActionGrid';
import { SectionHeader } from '@/components/common/SectionHeader';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

import { usePolls } from '../hooks/usePolls.js';
import { usePollSocket } from '../hooks/usePollSocket';
import { PollCard } from '../components/PollCard';
import { CreatePollModal } from '../components/CreatePollModal';
import { checkIsAdmin } from '@/src/utils/rbac';

/**
 * PollDashboardScreen Component (Pure JSX)
 * Displays community polls divided into Active, Closed, and My Polls.
 * Features Visitor Management standard UI:
 * - Rounded headerRight "Create Poll" button
 * - Universal KPI statistics strip
 * - Universal 3-column ActionGrid for poll views
 * - One consistent header-level "Create Poll" action
 */
export default function PollDashboardScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('active');
  const [pageByTab, setPageByTab] = useState({ active: 1, closed: 1, my: 1 });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [votingPollIds, setVotingPollIds] = useState({});

  const {
    activePolls,
    activeTotal,
    activeLoading,
    closedPolls,
    closedTotal,
    closedLoading,
    myPolls,
    myTotal,
    myLoading,
    submitting,
    user,
    canCreate,
    loadActivePolls,
    loadClosedPolls,
    loadMyPolls,
    createNewPoll,
    selectCurrentPoll,
    castVote,
  } = usePolls();

  const isCommunityAdmin = checkIsAdmin(user);

  // Socket listener synchronization
  usePollSocket(isCommunityAdmin ? activeTab : 'active');

  const loadData = useCallback(
    (tab, page = 1) => {
      const params = { page, limit: 20 };
      if (!isCommunityAdmin || tab === 'active') {
        loadActivePolls(params);
      } else if (tab === 'closed') {
        loadClosedPolls(params);
      } else if (tab === 'my') {
        loadMyPolls(params);
      }
    },
    [isCommunityAdmin, loadActivePolls, loadClosedPolls, loadMyPolls]
  );

  useEffect(() => {
    loadActivePolls({ page: 1, limit: 20 });
    if (isCommunityAdmin) {
      loadClosedPolls({ page: 1, limit: 20 });
      loadMyPolls({ page: 1, limit: 20 });
    }
  }, [isCommunityAdmin, loadActivePolls, loadClosedPolls, loadMyPolls]);

  useEffect(() => {
    loadData(isCommunityAdmin ? activeTab : 'active');
  }, [activeTab, isCommunityAdmin, loadData]);

  const handleRefresh = () => {
    const listKey = !isCommunityAdmin ? 'active' : activeTab;
    setPageByTab((current) => ({ ...current, [listKey]: 1 }));
    loadData(isCommunityAdmin ? activeTab : 'active');
  };

  const handleCreateSubmit = async (pollPayload) => {
    try {
      await createNewPoll(pollPayload);
      setActiveTab('active');
      loadActivePolls({ page: 1, limit: 20 });
      if (isCommunityAdmin) {
        loadMyPolls({ page: 1, limit: 20 });
      }
      if (Platform.OS === 'web') {
        window.alert('Poll created successfully!');
      } else {
        Alert.alert('Success', 'Poll created successfully!');
      }
    } catch (err) {
      if (Platform.OS === 'web') {
        window.alert('Error creating poll: ' + (err?.message || 'Unknown error'));
      } else {
        Alert.alert('Error', err?.message || 'Failed to create poll');
      }
      throw err;
    }
  };

  const handleCardPress = (poll) => {
    if (!poll || !poll._id) return;
    selectCurrentPoll(poll);
    router.navigate(`/(resident)/polls/${poll._id}`);
  };

  const handleDirectVote = async (poll, optionIndex) => {
    if (!poll || poll.hasVoted || votingPollIds[poll._id]) {
      return;
    }
    setVotingPollIds((prev) => ({ ...prev, [poll._id]: true }));
    try {
      await castVote(poll._id, {
        optionIndex,
        selectedOptions: [optionIndex],
        selectedOptionIndices: [optionIndex],
        optionIndices: [optionIndex],
        selectedOptionIndex: optionIndex,
        unitNumber: user?.unitNumber || user?.unit || '',
      });
      loadData(isCommunityAdmin ? activeTab : 'active');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to submit vote';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Voting Error', msg);
      }
      if (isCommunityAdmin) {
        handleCardPress(poll);
      }
    } finally {
      setVotingPollIds((prev) => ({ ...prev, [poll._id]: false }));
    }
  };

  // Get current list data and loading status
  const getCurrentData = () => {
    if (!isCommunityAdmin || activeTab === 'active') return activePolls;
    if (activeTab === 'closed') return closedPolls;
    return myPolls;
  };

  const getCurrentLoading = () => {
    if (!isCommunityAdmin || activeTab === 'active') return activeLoading;
    if (activeTab === 'closed') return closedLoading;
    return myLoading;
  };

  const getCurrentTotal = () => {
    if (!isCommunityAdmin || activeTab === 'active') return activeTotal;
    if (activeTab === 'closed') return closedTotal;
    return myTotal;
  };

  const currentList = getCurrentData();
  const isLoading = getCurrentLoading();
  const totalCount = getCurrentTotal();
  const activeListKey = !isCommunityAdmin ? 'active' : activeTab;
  const currentPagination = {
    currentPage: pageByTab[activeListKey] || 1,
    totalPages: Math.max(1, Math.ceil(totalCount / 20)),
    limit: 20,
  };

  const handleLoadMore = () => {
    if (isLoading || currentPagination.currentPage >= currentPagination.totalPages) return;
    const nextPage = currentPagination.currentPage + 1;
    setPageByTab((current) => ({ ...current, [activeListKey]: nextPage }));
    loadData(isCommunityAdmin ? activeTab : 'active', nextPage);
  };

  const tabs = [
    { key: 'active', label: 'Active Polls' },
    { key: 'closed', label: 'Closed Polls' },
    { key: 'my', label: 'My Polls' },
  ];

  // Visitor Management style KPI metrics
  const pollKpis = useMemo(() => {
    if (!isCommunityAdmin) {
      return [
        {
          title: 'Active Polls',
          value: String(activeTotal || 0),
          iconName: 'BarChart3',
          variant: 'info',
          trend: { direction: 'up', value: 'Live' },
        },
      ];
    }
    return [
      {
        title: 'Active Polls',
        value: String(activeTotal || 0),
        iconName: 'BarChart3',
        variant: 'info',
        trend: { direction: 'up', value: 'Live' },
      },
      {
        title: 'My Created',
        value: String(myTotal || 0),
        iconName: 'CheckCircle',
        variant: 'success',
        trend: { direction: 'up', value: 'Mine' },
      },
      {
        title: 'Closed Polls',
        value: String(closedTotal || 0),
        iconName: 'Clock',
        variant: 'default',
        trend: { direction: 'down', value: 'Archived' },
      },
    ];
  }, [isCommunityAdmin, activeTotal, myTotal, closedTotal]);

  // Visitor Management style ActionGrid items (Community Admin only)
  const pollActions = useMemo(() => [
    {
      id: 'active_polls',
      name: 'Active Polls',
      iconName: 'BarChart3',
      colorBg: activeTab === 'active' ? 'bg-blue-500/20' : 'bg-blue-500/10',
      colorIcon: '#3b82f6',
      badge: activeTotal > 0 ? activeTotal : undefined,
      badgeColor: 'bg-blue-600',
      onPress: () => setActiveTab('active'),
    },
    {
      id: 'closed_polls',
      name: 'Closed Polls',
      iconName: 'Clock',
      colorBg: activeTab === 'closed' ? 'bg-slate-500/20' : 'bg-slate-500/10',
      colorIcon: '#64748b',
      badge: closedTotal > 0 ? closedTotal : undefined,
      badgeColor: 'bg-slate-600',
      onPress: () => setActiveTab('closed'),
    },
    {
      id: 'my_polls',
      name: 'My Polls',
      iconName: 'CheckSquare',
      colorBg: activeTab === 'my' ? 'bg-purple-500/20' : 'bg-purple-500/10',
      colorIcon: '#8b5cf6',
      badge: myTotal > 0 ? myTotal : undefined,
      badgeColor: 'bg-purple-600',
      onPress: () => setActiveTab('my'),
    },
  ], [activeTab, activeTotal, closedTotal, myTotal]);

  // Visitor Management style ListHeaderComponent
  const renderHeader = () => (
    <View className="gap-3 mb-3">
      {/* Universal KPI Statistics Strip */}
      <KPIDashboardStrip cards={pollKpis} />

      {/* Universal 3-Column ActionGrid - Community Admin only */}
      {isCommunityAdmin && (
        <ActionGrid title="Quick Actions" items={pollActions} />
      )}

      {/* Tab Navigation - Community Admin only */}
      {isCommunityAdmin && (
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setPageByTab((current) => ({ ...current, [tab]: 1 }));
          }}
          variant="pill"
        />
      )}

      {/* Section Header */}
      <SectionHeader
        title={!isCommunityAdmin || activeTab === 'active' ? 'Active Polls' : activeTab === 'closed' ? 'Closed Polls' : 'My Created Polls'}
        className="px-0 bg-transparent dark:bg-transparent"
      />
    </View>
  );

  return (
    <ScreenShell
      title="Community Polls"
      subtitle="Voice your opinion on community decisions"
      iconName="BarChart2"
      headerRight={
        isCommunityAdmin && canCreate ? (
          <Button
            variant="default"
            size="sm"
            onPress={() => router.navigate('/(resident)/community-engagement/create?type=POLL')}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Create Poll"
          >
            <Plus size={15} color="#ffffff" />
            <Text className="text-xs font-bold text-primary-foreground">Create Poll</Text>
          </Button>
        ) : undefined
      }
    >
      <View className="flex-1 bg-background">
        {/* Paginated Polls List with ListHeaderComponent */}
        <PaginatedList
          data={currentList}
          renderItem={(item) => (
            <PollCard
              poll={item}
              currentUser={user}
              showViewDetails={true}
              onPress={() => handleCardPress(item)}
              onVote={(optionIndex) => handleDirectVote(item, optionIndex)}
            />
          )}
          keyExtractor={(item) => item._id}
          loading={isLoading && currentList.length === 0}
          onRefresh={handleRefresh}
          refreshing={isLoading}
          onLoadMore={handleLoadMore}
          ListHeaderComponent={renderHeader()}
          emptyIcon="BarChart2"
          emptyTitle={`No ${!isCommunityAdmin || activeTab === 'active' ? 'Active Polls' : activeTab === 'closed' ? 'Closed Polls' : 'Polls Created'}`}
          emptySubtitle={
            !isCommunityAdmin || activeTab === 'active'
              ? 'There are no active polls requiring your vote right now.'
              : activeTab === 'closed'
              ? 'There are no closed community polls to display.'
              : 'You have not created any polls yet.'
          }
          contentContainerClassName="px-4 pt-3 pb-28 gap-3"
          pagination={{
            currentPage: currentPagination.currentPage,
            totalPages: currentPagination.totalPages,
            totalRecords: totalCount,
            limit: currentPagination.limit,
          }}
          paginationSummary
        />
      </View>

      {/* Create Poll Modal */}
      <CreatePollModal
        visible={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
        loading={submitting}
      />
    </ScreenShell>
  );
}
