import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { View, ScrollView, RefreshControl, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { KPIDashboardStrip } from '@/components/ui/KPIDashboardStrip';
import { type KPICardProps } from '@/components/ui/KPICard';
import { ActionGrid, type ActionGridItem } from '@/components/ui/ActionGrid';
import { SectionHeader } from '@/components/common/SectionHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/forms/SearchBar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { TextInput } from '@/components/forms/TextInput';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { ComplaintCard } from '../components/ComplaintCard';
import { ComplaintDetailSheet } from '../components/ComplaintDetailSheet';
import { ComplaintTypeSheet } from '../components/ComplaintTypeSheet';
import { Complaint } from '../types';
import { useComplaints } from '../hooks/useComplaints';
import amenityManagementService from '@/src/features/amenities/services/amenityManagementService';
import { ApiAmenityFacility } from '@/src/features/amenities/types/amenityApi.types';
import { useTranslation } from '@/src/utils/i18n';
import {
  Wrench,
  Plus,
  AlertTriangle,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react-native';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export function ComplaintDashboardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    complaints,
    dashboardAnalytics,
    isLoading,
    error,
    fetchComplaints,
    fetchDashboardAnalytics,
    createComplaint,
    confirmCompletion,
    addComment,
    updateStatus,
    clearErrors,
  } = useComplaints();

  const [facilities, setFacilities] = useState<ApiAmenityFacility[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modals & Sheets State
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);

  // General Community Feedback State
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [generalFeedback, setGeneralFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await Promise.all([
        fetchComplaints(),
        fetchDashboardAnalytics(),
        amenityManagementService
          .getFacilities({ page: 1, limit: 50 })
          .then((res) => {
            if (res?.data?.items) {
              setFacilities(res.data.items);
            }
          })
          .catch((err) => {
            console.warn('Failed to load facility maintenance notices:', err);
          }),
      ]);
    } catch (err) {
      console.warn('Error loading complaints dashboard data:', err);
    }
  }, [fetchComplaints, fetchDashboardAnalytics]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSelectCategory = (category: string) => {
    setTypeSheetOpen(false);
    router.push({
      pathname: '/(resident)/complaints/raise-ticket' as any,
      params: { category },
    });
  };

  // Facility Maintenance Outages & Backend Notices
  const maintenanceNotices = useMemo(() => {
    const notices: Array<{
      id: string;
      title: string;
      message: string;
      date: string;
      variant?: 'warning' | 'danger' | 'info';
    }> = [];

    // 1. Active Amenity Maintenance Statuses
    if (facilities && Array.isArray(facilities) && facilities.length > 0) {
      facilities.forEach((facility: ApiAmenityFacility) => {
        const statusRaw = String(facility.status || '').toUpperCase();
        if (statusRaw === 'MAINTENANCE') {
          const alreadyExists = notices.some((n) => n.title.includes(facility.name));
          if (!alreadyExists) {
            notices.push({
              id: `fac-maint-${facility._id}`,
              title: `${facility.name} Under Maintenance`,
              message: `The ${facility.name} is currently undergoing scheduled upkeep and temporary blackout.`,
              date: 'Active',
              variant: 'warning',
            });
          }
        }
      });
    }

    // 2. Backend System Facility Notices
    if (dashboardAnalytics?.notices && Array.isArray(dashboardAnalytics.notices)) {
      dashboardAnalytics.notices.forEach((n: any) => {
        notices.push({
          id: `backend-${n.id || Math.random()}`,
          title: n.title || 'Facility Maintenance Notice',
          message: n.message || n.description || 'Scheduled facility maintenance notice.',
          date: n.timestamp ? new Date(n.timestamp).toLocaleDateString() : 'Active Notice',
          variant: 'info',
        });
      });
    }

    return notices;
  }, [facilities, dashboardAnalytics]);

  const handleFeedbackSubmit = async () => {
    if (!generalFeedback.trim()) {
      setFeedbackError('Please enter your feedback remarks before submitting.');
      return;
    }
    setFeedbackError('');
    try {
      setIsSubmittingFeedback(true);
      await createComplaint({
        title: 'Resident Feedback & Suggestions',
        description: generalFeedback,
        category: 'Feedback',
        priority: 'Medium',
        department: 'Management',
        isEmergency: false,
      });
      showAlert('Feedback Submitted', 'Thank you! Your feedback has been sent to community management.');
      setGeneralFeedback('');
      setShowFeedbackSheet(false);
      loadData();
    } catch (err: any) {
      console.error('Failed to submit feedback:', err);
      showAlert('Error', err?.message || 'Failed to submit feedback.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Dynamic KPI Calculations
  const openCount = useMemo(() => {
    return complaints.filter((c: any) =>
      ['Submitted', 'Open', 'Waiting For Assignment', 'Waiting For Acceptance'].includes(c.status)
    ).length;
  }, [complaints]);

  const inProgressCount = useMemo(() => {
    return complaints.filter((c: any) =>
      ['Assigned', 'In Progress', 'Accepted'].includes(c.status)
    ).length;
  }, [complaints]);

  const resolvedCount = useMemo(() => {
    return complaints.filter((c: any) =>
      ['Closed', 'Completed', 'Resolved', 'Work Completed'].includes(c.status)
    ).length;
  }, [complaints]);

  // Universal KPI Dashboard Strip Cards
  const complaintKpis: KPICardProps[] = [
    {
      title: t('open_tickets', 'Open Tickets'),
      value: String(openCount),
      iconName: 'AlertCircle',
      variant: openCount > 0 ? 'warning' : 'accent',
      trend: {
        direction: openCount > 0 ? 'up' : 'down',
        value: openCount > 0 ? t('needs_action', 'Needs Action') : t('all_clear', 'All Clear'),
      },
    },
    {
      title: t('in_progress', 'In Progress'),
      value: String(inProgressCount),
      iconName: 'Wrench',
      variant: inProgressCount > 0 ? 'info' : 'default',
      trend: {
        direction: 'up',
        value: inProgressCount > 0 ? t('active_work', 'Active Work') : t('none', 'None'),
      },
    },
    {
      title: t('resolved_tickets', 'Resolved'),
      value: String(resolvedCount),
      iconName: 'CheckCircle2',
      variant: 'success',
      trend: {
        direction: 'up',
        value: t('completed', 'Completed'),
      },
    },
  ];

  // Universal Quick Action Grid Items
  const complaintActions: ActionGridItem[] = [
    {
      id: 'raise_ticket',
      name: t('raise_ticket', 'Raise Ticket'),
      iconName: 'PlusCircle',
      colorBg: 'bg-blue-500/10',
      colorIcon: '#3b82f6',
      onPress: () => setTypeSheetOpen(true),
    },
    {
      id: 'my_tickets',
      name: t('my_tickets', 'My Tickets'),
      iconName: 'ClipboardList',
      colorBg: 'bg-amber-500/10',
      colorIcon: '#f59e0b',
      route: '/(resident)/complaints/my-tickets',
      badge: openCount > 0 ? openCount : undefined,
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'management',
      name: t('management', 'Management'),
      iconName: 'Kanban',
      colorBg: 'bg-indigo-500/10',
      colorIcon: '#6366f1',
      route: '/(resident)/complaints/manage',
    },
    {
      id: 'staff_vendors',
      name: t('staff_vendors', 'Staff Directory'),
      iconName: 'Users',
      colorBg: 'bg-emerald-500/10',
      colorIcon: '#10b981',
      route: '/(resident)/complaints/staff',
    },
    {
      id: 'assignee_queue',
      name: t('work_orders', 'Work Orders'),
      iconName: 'Briefcase',
      colorBg: 'bg-purple-500/10',
      colorIcon: '#a855f7',
      route: '/(resident)/complaints/assignee',
    },
    {
      id: 'community_issue_reports',
      name: t('issue_reports', 'Issue Reports'),
      iconName: 'AlertCircle',
      colorBg: 'bg-rose-500/10',
      colorIcon: '#f43f5e',
      route: '/(resident)/complaints/issue-reports',
    },
    {
      id: 'feedback',
      name: t('feedback', 'Feedback'),
      iconName: 'MessageSquare',
      colorBg: 'bg-emerald-500/10',
      colorIcon: '#10b981',
      onPress: () => setShowFeedbackSheet(true),
    },
  ];

  // Filter complaints by Search Query
  const filteredComplaints = useMemo(() => {
    if (!searchQuery.trim()) return complaints;
    const q = searchQuery.toLowerCase().trim();
    return complaints.filter((item: Complaint) => {
      return (
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.complaintNumber && item.complaintNumber.toLowerCase().includes(q)) ||
        (item.status && item.status.toLowerCase().includes(q))
      );
    });
  }, [complaints, searchQuery]);

  const isInitialLoading =
    isLoading && !refreshing && !dashboardAnalytics && complaints.length === 0;

  return (
    <ScreenShell
      title={t('complaints_helpdesk', 'Complaints & Maintenance')}
      subtitle={t('complaints_subtext', 'Resident issue tickets, maintenance requests & work orders')}
      iconName="Wrench"
      scrollable={false}
      loading={isInitialLoading}
      error={error}
      onRetry={loadData}
      headerRight={
        <Button
          variant="default"
          size="sm"
          onPress={() => setTypeSheetOpen(true)}
          className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-600 active:bg-emerald-700 border-0 shadow-2xs"
          accessibilityRole="button"
          accessibilityLabel="Raise Complaint"
        >
          <Plus size={14} color="#ffffff" strokeWidth={2.4} />
          <Text className="text-xs font-bold text-white">
            {t('raise_complaint', 'Raise Complaint')}
          </Text>
        </Button>
      }
    >
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="p-4 pb-36 gap-4"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {error ? <ErrorBanner message={error} onDismiss={clearErrors} /> : null}

        {/* Master Search Bar */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t(
            'search_complaints_placeholder',
            'Search tickets, staff, features, or upkeep...'
          )}
        />

        {/* Universal KPI Statistics Strip */}
        <KPIDashboardStrip cards={complaintKpis} />

        {/* Universal 3-Column ActionGrid */}
        <ActionGrid
          title={t('quick_actions', 'Quick Actions')}
          items={complaintActions}
          searchQuery={searchQuery}
        />

        {/* Facility Maintenance Outages & Notices Banner */}
        {maintenanceNotices.length > 0 ? (
          <View className="gap-2.5">
            <View className="flex-row items-center px-1">
              <View className="w-2 h-2 rounded-full bg-amber-500 me-2 animate-pulse" />
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t('facility_notices', 'Facility Upkeep Notices')}
              </Text>
            </View>

            {maintenanceNotices.slice(0, 2).map((notice) => (
              <View
                key={notice.id}
                className={`p-3.5 rounded-2xl border flex-row items-start ${
                  notice.variant === 'danger'
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : notice.variant === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <View className="p-2 rounded-xl bg-background me-3 mt-0.5 shadow-xs">
                  <AlertTriangle
                    size={18}
                    color={
                      notice.variant === 'danger'
                        ? '#f43f5e'
                        : notice.variant === 'warning'
                        ? '#f59e0b'
                        : '#3b82f6'
                    }
                  />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-start justify-between mb-1 gap-2">
                    <Text className="text-xs font-extrabold text-foreground flex-1 leading-snug">
                      {notice.title}
                    </Text>
                    <Text className="text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                      {notice.date}
                    </Text>
                  </View>
                  <Text className="text-[11px] text-muted-foreground leading-normal">
                    {notice.message}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Canonical Section Header */}
        <SectionHeader
          title={t('recent_activity', 'Recent Activity')}
          actionLabel={t('view_all', 'View All')}
          onAction={() => router.push('/(resident)/complaints/my-tickets' as any)}
          className="px-0 bg-transparent dark:bg-transparent"
        />

        {/* Strict 3-Item Limit for Dashboard Activity Previews */}
        {filteredComplaints.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={t('no_recent_tickets', 'No Active Tickets')}
            description={t(
              'no_recent_tickets_desc',
              'Report a maintenance issue or breakdown to get quick assistance.'
            )}
            actionLabel={t('raise_ticket', 'Raise Ticket')}
            onAction={() => setTypeSheetOpen(true)}
          />
        ) : (
          <View className="gap-2.5">
            {filteredComplaints.slice(0, 3).map((item: Complaint) => (
              <ComplaintCard
                key={item._id}
                complaint={item}
                onPress={() => {
                  setSelectedComplaint(item);
                  setDetailsSheetOpen(true);
                }}
                onConfirmPress={() => {
                  setSelectedComplaint(item);
                  setDetailsSheetOpen(true);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Type-Selection-First Category Sheet */}
      <ComplaintTypeSheet
        visible={typeSheetOpen}
        onClose={() => setTypeSheetOpen(false)}
        onSelectCategory={handleSelectCategory}
      />

      {/* Complaint Detail Sheet */}
      <ComplaintDetailSheet
        visible={detailsSheetOpen}
        complaint={selectedComplaint}
        onClose={() => {
          setDetailsSheetOpen(false);
          setSelectedComplaint(null);
        }}
        onAddComment={async (id, text) => {
          await addComment(id, text);
          loadData();
        }}
        onConfirmCompletion={async (id, feedback) => {
          await confirmCompletion(id, feedback);
          loadData();
        }}
        onCancelTicket={async (id) => {
          await updateStatus(id, { status: 'Cancelled' });
          loadData();
        }}
        onUpdateStatus={async (id, data) => {
          await updateStatus(id, data);
          loadData();
        }}
        isResident={true}
      />

      {/* General Feedback & Suggestion Sheet */}
      <BottomSheet
        visible={showFeedbackSheet}
        onClose={() => setShowFeedbackSheet(false)}
        title={t('community_feedback', 'Community Feedback & Suggestions')}
      >
        <View className="px-4 py-2 gap-4">
          <View className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl flex-row items-center">
            <View className="p-2 bg-rose-500/20 rounded-xl me-3">
              <MessageSquare size={20} color="#f43f5e" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-foreground">
                {t('share_your_thoughts', 'Share Your Thoughts')}
              </Text>
              <Text className="text-[11px] text-muted-foreground">
                {t(
                  'feedback_subtext',
                  'Send feedback or suggestions directly to facility management.'
                )}
              </Text>
            </View>
          </View>

          <TextInput
            label={t('your_message_feedback', 'Your Message / Feedback *')}
            placeholder={t(
              'feedback_placeholder',
              'Tell us what we can improve or suggest a new feature...'
            )}
            multiline
            numberOfLines={4}
            value={generalFeedback}
            onChangeText={(text) => {
              setGeneralFeedback(text);
              if (feedbackError) setFeedbackError('');
            }}
            error={feedbackError}
          />

          <Button
            variant="default"
            onPress={handleFeedbackSubmit}
            disabled={isSubmittingFeedback}
            className="bg-primary py-3.5 rounded-2xl items-center mb-6"
          >
            {isSubmittingFeedback
              ? t('submitting', 'Submitting...')
              : t('submit_feedback', 'Submit Feedback')}
          </Button>
        </View>
      </BottomSheet>
    </ScreenShell>
  );
}

export default ComplaintDashboardScreen;
