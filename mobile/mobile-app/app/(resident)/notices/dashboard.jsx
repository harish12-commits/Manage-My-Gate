import React, { useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { ListChecks, CheckCircle, PenTool, Pin, AlertTriangle, Info, Bell, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { KPIDashboardStrip } from '@/components/ui/KPIDashboardStrip';

import { ActionGrid } from '@/components/ui/ActionGrid';
import { SectionHeader } from '@/components/common/SectionHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { FAB } from '@/components/ui/FAB';

import { ActivityLogItem } from '@/components/data/ActivityLogItem';
import { useNoticeBoard } from '@/src/features/noticeBoard/hooks/useNoticeBoard';
import { useNoticeSocket } from '@/src/features/noticeBoard/hooks/useNoticeSocket';

export default function NoticeDashboardScreen() {
  useNoticeSocket();
  const router = useRouter();
  const { dashboardStats, dashboardLoading, dashboardError, loadNoticeStats, setFilters } = useNoticeBoard();

  useEffect(() => {
    loadNoticeStats();
  }, []);

  const handleRefresh = useCallback(() => {
    loadNoticeStats();
  }, [loadNoticeStats]);

  const stats = dashboardStats?.kpis || {};
  const recentActivity = dashboardStats?.recentActivity || [];

  const noticeKpis = [
    {
      title: 'Active Notices',
      value: String(stats.activeNotices || 0),
      iconName: 'CheckCircle',
      variant: 'success',
      subtitle: 'Published live',
    },
    {
      title: 'Drafts',
      value: String(stats.draftNotices || 0),
      iconName: 'PenTool',
      variant: 'warning',
      subtitle: 'Unpublished',
    },
    {
      title: 'Pinned',
      value: String(stats.pinnedNotices || 0),
      iconName: 'Pin',
      variant: 'info',
      subtitle: 'Featured top',
    },
    {
      title: 'Urgent Notices',
      value: String(stats.urgentNotices || 0),
      iconName: 'AlertTriangle',
      variant: 'destructive',
      subtitle: 'High priority',
    },
  ];

  const noticeActions = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      iconName: 'Info',
      colorBg: 'bg-blue-500/10',
      colorIcon: '#3b82f6',
      route: '/(resident)/notices/dashboard',
    },
    {
      id: 'active',
      name: 'Active Notices',
      iconName: 'CheckCircle',
      colorBg: 'bg-emerald-500/10',
      colorIcon: '#10b981',
      route: '/(resident)/notices',
    },
    {
      id: 'manage',
      name: 'Manage',
      iconName: 'ListChecks',
      colorBg: 'bg-primary/10',
      colorIcon: '#6366f1',
      onPress: () => {
        setFilters({});
        router.push('/(resident)/notices/manage');
      },
    },
    {
      id: 'polls',
      name: 'Polls & Votes',
      iconName: 'PenTool',
      colorBg: 'bg-indigo-500/10',
      colorIcon: '#6366f1',
      route: '/(resident)/polls',
    },
  ];

  return (
    <ScreenShell
      title="Notice Board Dashboard"
      subtitle="Broadcast notices, drafts & resident polls"
      iconName="Bell"
      scrollable={false}
      error={dashboardError}
      onRetry={handleRefresh}
      loading={dashboardLoading && !dashboardStats}
      headerRight={
        <View className="flex-row items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onPress={() => {
              setFilters({});
              router.push('/(resident)/notices/manage');
            }}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Manage Notices"
          >
            <ListChecks size={13} className="text-foreground" />
            <Text className="text-xs font-semibold text-foreground">Manage</Text>
          </Button>
          <Button
            size="sm"
            onPress={() => router.push('/(resident)/notices/create')}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 active:bg-emerald-700"
            accessibilityRole="button"
            accessibilityLabel="Create New Notice"
          >
            <Plus size={14} color="#ffffff" />
            <Text className="text-xs font-bold text-white">New Notice</Text>
          </Button>
        </View>
      }
    >
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="p-4 pb-28 gap-4"
        refreshControl={
          <RefreshControl refreshing={dashboardLoading && !!dashboardStats} onRefresh={handleRefresh} />
        }
      >
        {/* Universal 2x2 KPI Grid */}
        <KPIDashboardStrip cards={noticeKpis} />

        {/* Universal 3-Column ActionGrid */}
        <ActionGrid title="Quick Actions" items={noticeActions} />

        {/* Canonical Section Header & Live Activity Log */}
        <View className="gap-2">
          <SectionHeader
            title="Recent Activity"
            actionLabel="View All"
            onAction={() => router.push('/(resident)/notices')}
            className="px-0 bg-transparent dark:bg-transparent"
          />
          {recentActivity.length > 0 ? (
            <View className="gap-2.5">
              {recentActivity.slice(0, 3).map((activity, index) => (
                <ActivityLogItem
                  key={activity.id || activity._id || index}
                  title={activity.title}
                  category={activity.category || 'General'}
                  priority={activity.priority || 'Normal'}
                  status={activity.status || 'Active'}
                  createdAt={activity.createdAt || activity.date}
                  variant="card"
                  onPress={() => router.push({
                    pathname: '/(resident)/notices/[id]',
                    params: { id: activity.id || activity._id }
                  })}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon={Bell}
              title="No Recent Activity"
              description="No recent notices or broadcast updates to display."
            />
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}
