import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { CheckCircle2, FileQuestion } from 'lucide-react-native';

import { useCommunityIssueReports } from '../hooks/useCommunityIssueReports';
import { CommunityIssueReportCard } from '../components/CommunityIssueReportCard';
import { CommunityIssueReportDetailSheet } from '../components/CommunityIssueReportDetailSheet';
import { IssueReportItem } from '../types/issueReport.types';

export function CommunityIssueReportsScreen() {
  const router = useRouter();
  const { reportId } = useLocalSearchParams<{ reportId?: string }>();

  const {
    reports,
    pagination,
    filters,
    selectedReport,
    loading,
    detailsLoading,
    error,
    detailsError,
    fetchReports,
    updateFilters,
    resetAllFilters,
    openReportDetails,
    closeReportDetails,
    clearErrors,
  } = useCommunityIssueReports();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeTab, setSelectedTypeTab] = useState<string>('ALL');
  const [showDetailSheet, setShowDetailSheet] = useState(false);

  // Initial load
  const loadData = useCallback(() => {
    fetchReports({ page: 1 });
  }, [fetchReports]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle notification deep link (?reportId=<id>)
  useEffect(() => {
    if (reportId) {
      setShowDetailSheet(true);
      openReportDetails(reportId);
    }
  }, [reportId, openReportDetails]);

  // Handle Card Press
  const handleReportPress = (reportItem: IssueReportItem) => {
    setShowDetailSheet(true);
    openReportDetails(reportItem._id || reportItem.id || '', reportItem);
  };

  const handleCloseSheet = () => {
    setShowDetailSheet(false);
    closeReportDetails();
  };

  // Filtered reports list
  const filteredReports = useMemo(() => {
    return reports.filter((item: IssueReportItem) => {
      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = item.reportNumber?.toLowerCase().includes(q);
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesReporter = item.reporter?.name?.toLowerCase().includes(q) || item.reporter?.email?.toLowerCase().includes(q);
        const matchesFeature = item.feature?.toLowerCase().includes(q);
        if (!matchesNum && !matchesTitle && !matchesReporter && !matchesFeature) return false;
      }

      // Type Tab Filter
      if (selectedTypeTab !== 'ALL' && item.reportType !== selectedTypeTab) {
        return false;
      }

      return true;
    });
  }, [reports, searchQuery, selectedTypeTab]);

  const filterTabs = [
    { label: 'All Reports', value: 'ALL' },
    { label: 'Bugs', value: 'BUG' },
    { label: 'Feature Requests', value: 'FEATURE_REQUEST' },
    { label: 'Other Inquiries', value: 'OTHER' },
  ];

  return (
    <ScreenShell
      title="Issue Reports"
      subtitle="Resident reports submitted via Contact Support"
      iconName="AlertCircle"
      showBackButton={true}
      onBackPress={() => router.back()}
      loading={loading && reports.length === 0}
    >
      <View className="flex-1 bg-background">
        {/* Global Error Banner */}
        {error ? (
          <View className="px-4 pt-3">
            <ErrorBanner message={error} onDismiss={clearErrors} />
          </View>
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadData} tintColor="#6366f1" />
          }
        >
          {/* SEARCH & FILTER BAR */}
          <View className="px-4 pt-3 pb-1">
            <SearchFilterBar
              searchValue={searchQuery}
              onSearchChange={(val) => {
                setSearchQuery(val);
                updateFilters({ search: val });
              }}
              searchPlaceholder="Search by report #, title, or resident..."
              sortOptions={filterTabs}
              currentSort={selectedTypeTab}
              onSortChange={(val) => {
                setSelectedTypeTab(val);
                updateFilters({ reportType: val === 'ALL' ? '' : val });
              }}
              variant="default"
              className="px-0 py-0 border-0"
            />
          </View>

          {/* REPORTS LIST FEED */}
          <View className="px-4 pt-2">
            {filteredReports.length === 0 ? (
              <View className="pt-6">
                <EmptyState
                  icon={reports.length === 0 ? CheckCircle2 : FileQuestion}
                  title={reports.length === 0 ? 'No Issue Reports Yet' : 'No Matching Reports'}
                  description={
                    reports.length === 0
                      ? 'Resident reports submitted through "Contact Support" will appear here.'
                      : 'Try adjusting your search criteria or filter selections.'
                  }
                />
              </View>
            ) : (
              filteredReports.map((reportItem: IssueReportItem) => (
                <CommunityIssueReportCard
                  key={reportItem._id || reportItem.id || reportItem.reportNumber}
                  report={reportItem}
                  onPress={() => handleReportPress(reportItem)}
                />
              ))
            )}
          </View>
        </ScrollView>

        {/* READ-ONLY DETAIL SHEET */}
        <CommunityIssueReportDetailSheet
          visible={showDetailSheet}
          report={selectedReport}
          loading={detailsLoading}
          error={detailsError}
          onClose={handleCloseSheet}
        />
      </View>
    </ScreenShell>
  );
}

export default CommunityIssueReportsScreen;
