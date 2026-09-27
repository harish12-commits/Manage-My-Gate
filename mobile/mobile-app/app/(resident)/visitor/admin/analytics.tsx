import React, { useEffect, useCallback } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { VisitorAnalyticsCard } from '@/src/features/visitor/components/admin/VisitorAnalyticsCard';
import { CategoryDistributionCard } from '@/src/features/visitor/components/admin/CategoryDistributionCard';
import { RealtimeMetricChart } from '@/components/analytics/RealtimeMetricChart';
import { ActivityHeatmap } from '@/components/analytics/ActivityHeatmap';
import { useAdminVisitor } from '@/src/features/visitor/hooks/useAdminVisitor';

export default function AdminVisitorAnalyticsScreen() {
  const { analytics, status, error, loadAnalytics } = useAdminVisitor();

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleRefresh = useCallback(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Computed from real gate logs in fetchAdminAnalytics (today's arrivals, last 7 days' density).
  const hourlyTelemetry = analytics?.hourlyArrivals || [];
  const heatmapData = analytics?.weeklyDensity || [];

  return (
    <ScreenShell
      title="Gate Visitor Analytics"
      subtitle="Check-in trends, traffic hours & gate metrics"
      iconName="BarChart3"
      scrollable={false}
      loading={status === 'loading' && !analytics}
      error={error}
      onRetry={handleRefresh}
    >
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="p-4 gap-4 pb-28"
        refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={handleRefresh} />}
      >
        {/* Error notification banner */}
        {status === 'failed' && error && (
          <ErrorBanner message={error} onRetry={handleRefresh} />
        )}

        {/* 1. Primary Gate Traffic KPI Summary Card */}
        <VisitorAnalyticsCard
          analytics={analytics}
          loading={status === 'loading'}
        />

        {/* 2. Real-Time Hourly Arrival Telemetry Chart */}
        <RealtimeMetricChart
          title="Gate Traffic Volume (Hourly Arrivals)"
          data={hourlyTelemetry}
          currentValOverride={analytics?.totalEntriesToday ?? 0}
          subtitle={`Peak: ${analytics?.peakHour || '—'}`}
        />

        {/* 3. Pass Category Distribution Breakdown Card */}
        <CategoryDistributionCard
          categories={analytics?.categoryDistribution || []}
        />

        {/* 4. Weekly Gate Traffic Density Heatmap */}
        <ActivityHeatmap
          title="Weekly Traffic Density Heatmap"
          data={heatmapData}
        />
      </ScrollView>
    </ScreenShell>
  );
}
