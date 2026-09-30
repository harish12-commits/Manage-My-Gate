import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { SearchBar } from '@/components/forms/SearchBar';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { CheckCircle2, Star, AlertCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useComplaints } from '../hooks/useComplaints';
import { ComplaintCard } from '../components/ComplaintCard';
import { ComplaintFilterDrawer } from '../components/ComplaintFilterDrawer';
import { AssignTechnicianSheet } from '../components/AssignTechnicianSheet';
import { ComplaintDetailSheet } from '../components/ComplaintDetailSheet';
import { ResidentFeedbackSheet } from '../components/ResidentFeedbackSheet';
import { Complaint } from '../types';
import { getStatusTabStyle } from '@/components/ui/statusTabColors';

export function AdminComplaintManagementScreen() {
  const router = useRouter();
  const {
    complaints,
    isLoading,
    error,
    fetchComplaints,
    fetchDashboardAnalytics,
    assignTechnician,
    updateStatus,
    addComment,
    clearErrors,
  } = useComplaints();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [assigningComplaint, setAssigningComplaint] = useState<Complaint | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [showRatingsSheet, setShowRatingsSheet] = useState(false);

  const loadData = useCallback(() => {
    fetchComplaints();
    fetchDashboardAnalytics();
  }, [fetchComplaints, fetchDashboardAnalytics]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Analytics Metrics for Filter Tab Counts
  const kpiMetrics = useMemo(() => {
    const total = complaints.length;
    const open = complaints.filter((c: Complaint) => ['Submitted', 'Open'].includes(c.status)).length;
    const inProgress = complaints.filter((c: Complaint) => ['Assigned', 'In Progress', 'Accepted'].includes(c.status)).length;
    const slaBreached = complaints.filter((c: Complaint) => c.slaStatus === 'SLA Breached' || c.status === 'Escalated').length;

    return { total, open, inProgress, slaBreached };
  }, [complaints]);

  // Multi-tier Filtered Complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((item: Complaint) => {
      // 1. Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesNumber = item.complaintNumber?.toLowerCase().includes(query);
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesCat = item.category?.toLowerCase().includes(query);
        const matchesResident = item.residentName?.toLowerCase().includes(query);
        if (!matchesNumber && !matchesTitle && !matchesCat && !matchesResident) return false;
      }

      // 2. Status Tab Filter
      if (selectedStatusTab === 'UNASSIGNED') {
        if (!['Submitted', 'Open', 'Waiting For Assignment'].includes(item.status)) return false;
      } else if (selectedStatusTab === 'ASSIGNED') {
        if (!['Assigned', 'Accepted'].includes(item.status)) return false;
      } else if (selectedStatusTab === 'IN_PROGRESS') {
        if (item.status !== 'In Progress') return false;
      } else if (selectedStatusTab === 'ESCALATED') {
        if (item.status !== 'Escalated') return false;
      } else if (selectedStatusTab === 'COMPLETED') {
        if (!['Closed', 'Completed', 'Work Completed'].includes(item.status)) return false;
      }

      // 3. Priority Filter
      if (selectedPriority && item.priority !== selectedPriority) {
        return false;
      }

      // 4. Category Filter
      if (selectedCategory && item.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [complaints, searchQuery, selectedStatusTab, selectedPriority, selectedCategory]);

  const filterTabs = [
    { label: 'All Queue', value: 'ALL', count: kpiMetrics.total },
    { label: 'Unassigned', value: 'UNASSIGNED', count: kpiMetrics.open },
    { label: 'Assigned', value: 'ASSIGNED' },
    { label: 'In Progress', value: 'IN_PROGRESS', count: kpiMetrics.inProgress },
    { label: 'Escalated', value: 'ESCALATED', count: kpiMetrics.slaBreached },
    { label: 'Completed', value: 'COMPLETED' },
  ];

  return (
    <ScreenShell
      title="Complaint Management Board"
      subtitle="Facility Manager ticket queue & staff dispatch"
      iconName="Kanban"
      loading={isLoading && complaints.length === 0}
    >
      <View className="flex-1 bg-background">
        {error ? (
          <View className="px-4 pt-3">
            <ErrorBanner message={error} onDismiss={clearErrors} />
          </View>
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} tintColor="#6366f1" />}
        >
          {/* CANONICAL SEARCH FILTER BAR WITH FILTER DRAWER TRIGGER */}
          <View className="px-4 pt-3 pb-1">
            <SearchFilterBar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search by ticket #, flat, or title..."
              sortOptions={filterTabs.map((t) => ({
                label: t.count !== undefined && t.count > 0 ? `${t.label} (${t.count})` : t.label,
                value: t.value,
              }))}
              currentSort={selectedStatusTab}
              onSortChange={(val) => setSelectedStatusTab(val as any)}
              onFilterPress={() => setShowAdvancedFilters(true)}
              activeFilterCount={
                (selectedStatusTab !== 'ALL' ? 1 : 0) +
                (selectedPriority && selectedPriority !== 'ALL' ? 1 : 0) +
                (selectedCategory && selectedCategory !== 'ALL' ? 1 : 0)
              }
              variant="default"
              className="px-0 py-0 border-0"
            />
          </View>

          {/* VIEW FEEDBACK & APP ISSUES BUTTON BAR */}
          <View className="px-4 py-2 flex-row items-stretch gap-2">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.navigate('/(resident)/complaints/issue-reports' as any)}
              className="flex-1 min-w-0 min-h-11 bg-rose-500/10 border border-rose-500/30 px-2 py-2 rounded-xl flex-row items-center justify-center gap-1.5"
            >
              <Icon as={AlertCircle} size={16} className="text-rose-500 shrink-0" />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className="text-xs font-bold text-rose-600 dark:text-rose-400 font-sans text-center">
                App Issues
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowRatingsSheet(true)}
              className="flex-1 min-w-0 min-h-11 bg-amber-500/10 border border-amber-500/30 px-2 py-2 rounded-xl flex-row items-center justify-center gap-1.5"
            >
              <Icon as={Star} size={16} className="text-amber-500 shrink-0" />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} className="text-xs font-bold text-amber-600 dark:text-amber-400 font-sans text-center">
                Ratings & Feedback
              </Text>
            </TouchableOpacity>
          </View>

          {/* TICKETS QUEUE FEED */}
          <View className="px-4 pt-2">
            {filteredComplaints.length === 0 ? (
              <View className="pt-6">
                <EmptyState
                  icon={CheckCircle2}
                  title="Ticket Queue Clear"
                  description="No active complaints match your selected filter criteria."
                />
              </View>
            ) : (
              filteredComplaints.map((ticket: Complaint) => (
                <ComplaintCard
                  key={ticket._id}
                  complaint={ticket}
                  showAssignButton={true}
                  onPress={() => setSelectedComplaint(ticket)}
                  onAssignPress={() => setAssigningComplaint(ticket)}
                />
              ))
            )}
          </View>
        </ScrollView>

        {/* ASSIGN / VENDOR PASS SHEET */}
        <AssignTechnicianSheet
          visible={!!assigningComplaint}
          complaint={assigningComplaint}
          onClose={() => setAssigningComplaint(null)}
          onAssign={async (id, payload) => {
            await assignTechnician(id, payload);
            loadData();
          }}
        />

        {/* ADMIN RICH DETAIL SHEET WITH ACTION CONTROLS */}
        <ComplaintDetailSheet
          visible={!!selectedComplaint}
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          onAssignPress={(c) => setAssigningComplaint(c)}
          onUpdateStatus={async (id, data) => {
            await updateStatus(id, data);
            loadData();
          }}
          onAddComment={async (id, text) => {
            await addComment(id, text);
            loadData();
          }}
          viewMode="manager"
        />

        {/* ALL RESIDENT FEEDBACK BOTTOM SHEET */}
        <ResidentFeedbackSheet
          visible={showRatingsSheet}
          complaints={complaints}
          onClose={() => setShowRatingsSheet(false)}
        />

        {/* TWO-PANE GLOBAL COMPLAINT FILTER DRAWER */}
        <ComplaintFilterDrawer
          visible={showAdvancedFilters}
          onClose={() => setShowAdvancedFilters(false)}
          filters={{
            status: selectedStatusTab,
            priority: selectedPriority,
            category: selectedCategory,
          }}
          onApply={(newFilters) => {
            setSelectedStatusTab(newFilters.status);
            setSelectedPriority(newFilters.priority);
            setSelectedCategory(newFilters.category);
          }}
          onReset={() => {
            setSelectedStatusTab('ALL');
            setSelectedPriority('');
            setSelectedCategory('');
          }}
          statusCounts={{
            ALL: kpiMetrics.total,
            UNASSIGNED: kpiMetrics.open,
            IN_PROGRESS: kpiMetrics.inProgress,
            ESCALATED: kpiMetrics.slaBreached,
          }}
        />
      </View>
    </ScreenShell>
  );
}

export default AdminComplaintManagementScreen;
