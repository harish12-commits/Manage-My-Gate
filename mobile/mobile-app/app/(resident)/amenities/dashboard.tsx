import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { KPIDashboardStrip } from '@/components/ui/KPIDashboardStrip';
import { type KPICardProps } from '@/components/ui/KPICard';
import { Button } from '@/components/ui/button';
import { FAB } from '@/components/ui/FAB';
import { CalendarCheck, Plus, Compass } from 'lucide-react-native';
import { useAmenityDashboard } from '@/src/features/amenities/hooks/useAmenityDashboard';
import { MobileQuickNavHub } from '@/src/features/amenities/components/MobileQuickNavHub';
import { MobileLiveActivityWidget } from '@/src/features/amenities/components/MobileLiveActivityWidget';
import { useTranslation } from '@/src/utils/i18n';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';

const parseRevenue = (val: any, fallback: number): number => {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/[^0-9.]/g, ''));
    return isNaN(parsed) ? fallback : parsed;
  }
  if (typeof val === 'object') {
    if (typeof val.revenue === 'number') return val.revenue;
    if (typeof val.todayRevenue === 'number') return val.todayRevenue;
    if (typeof val.total === 'number') return val.total;
    if (typeof val.amount === 'number') return val.amount;
  }
  return fallback;
};

export default function AmenityExecutiveDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { dashboardStats, loading, error, loadData } = useAmenityDashboard();
  const { t } = useTranslation();

  // Guard: Normal residents or non-admins must never land on the legacy executive analytics dashboard
  if (user && !isFeatureAllowedForUser({ id: 'amenities_dashboard', permission: 'amenities:dashboard' }, user)) {
    if (isFeatureAllowedForUser({ id: 'amenities_discover', permission: 'amenities:discover' }, user)) {
      return <Redirect href="/(resident)/amenities/discover" />;
    }
    if (isFeatureAllowedForUser({ id: 'amenities_scanner', permission: 'amenities:scanner' }, user)) {
      return <Redirect href="/(resident)/amenities/scanner" />;
    }
    return <Redirect href="/(resident)/dashboard" />;
  }

  // Amenity Management V2 headline numbers (/amenity-dashboard/kpi)
  const totalRevenue = parseRevenue(
    dashboardStats?.revenue?.monthlyRevenue ?? dashboardStats?.revenue?.dailyRevenue ?? dashboardStats?.kpis?.revenue ?? dashboardStats?.revenue,
    0
  );

  const todayRevenue = parseRevenue(
    dashboardStats?.revenue?.dailyRevenue ?? dashboardStats?.kpis?.todayRevenue ?? dashboardStats?.todayRevenue,
    0
  );

  const activeMaintenance =
    dashboardStats?.amenityKpis?.underMaintenance ??
    dashboardStats?.kpis?.activeMaintenance ??
    dashboardStats?.underMaintenance ??
    0;

  const totalFacilities =
    dashboardStats?.amenityKpis?.activeAmenities ??
    dashboardStats?.amenityKpis?.totalAmenities ??
    dashboardStats?.kpis?.totalAmenities ??
    dashboardStats?.totalAmenities ??
    0;

  const pendingApprovals = Number(dashboardStats?.bookingKpis?.pendingApprovals ?? 0);
  const needsDecision = Number(dashboardStats?.bookingKpis?.needsDecision ?? 0);

  const kpiCards: KPICardProps[] = [
    {
      title: t('amenity_dash_month', 'Collected this month'),
      value: `₹${totalRevenue.toLocaleString('en-IN')}`,
      subtitle: t('amenity_dash_month_sub', 'Wallet, online & cash'),
      iconName: 'IndianRupee',
      variant: 'default',
      onPress: () => router.navigate('/(resident)/amenities/ledgers' as any),
    },
    {
      title: t('amenity_dash_today', 'Collected today'),
      value: `₹${todayRevenue.toLocaleString('en-IN')}`,
      iconName: 'TrendingUp',
      variant: 'success',
    },
    {
      title: t('amenity_admin_kpi_approvals', 'Awaiting approval'),
      value: String(pendingApprovals),
      subtitle: t('amenity_admin_kpi_approvals_sub', 'Approve or reject'),
      iconName: 'Hourglass',
      variant: 'warning',
      onPress: () => router.navigate('/(resident)/amenities/admin-bookings' as any),
    },
    {
      title: t('amenity_admin_kpi_review', 'Needs decision'),
      value: String(needsDecision),
      subtitle: t('amenity_admin_kpi_review_sub', 'No-shows, unpaid, returns'),
      iconName: 'ShieldAlert',
      variant: 'destructive',
      onPress: () => router.navigate('/(resident)/amenities/admin-bookings' as any),
    },
    {
      title: t('under_maintenance', 'Maintenance'),
      value: `${activeMaintenance} ${t('active', 'Active')}`,
      subtitle: t('upkeep_tasks', 'Upkeep & Tasks'),
      iconName: 'Wrench',
      variant: 'warning',
      onPress: () => router.navigate('/(resident)/amenities/maintenance' as any),
    },
    {
      title: t('amenities_facilities', 'Facilities'),
      value: `${totalFacilities} ${t('active', 'Active')}`,
      subtitle: t('open_for_booking', 'Open for booking'),
      iconName: 'Building2',
      variant: 'info',
      onPress: () => router.navigate('/(resident)/amenities/admin-master' as any),
    },
  ];

  return (
    <ScreenShell
      title={t('amenities_facilities', 'Amenities & Facilities')}
      subtitle={t('feature_amenities_discover_sub', 'Facility bookings, ledger revenue & maintenance')}
      iconName="BarChart3"
      scrollable={false}
      loading={loading && !dashboardStats}
      error={error}
      onRetry={loadData}
      headerRight={
        <Button
          variant="default"
          size="sm"
          onPress={() => router.navigate('/(resident)/amenities/discover' as any)}
          className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-2xs"
          accessibilityRole="button"
          accessibilityLabel="Discover Amenities"
        >
          <Compass size={14} color="#ffffff" strokeWidth={2.4} />
          <Text className="text-xs font-bold text-primary-foreground">{t('discover', 'Discover')}</Text>
        </Button>
      }
    >
      <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false} contentContainerClassName="p-4 pb-28 gap-4">
        {/* Universal Top KPI Metrics Strip */}
        <KPIDashboardStrip cards={kpiCards} loading={loading && !dashboardStats} />

        {/* 2. All Features Module Grid */}
        <MobileQuickNavHub />

        {/* 3. Live Gate Access Log Feed */}
        <MobileLiveActivityWidget />
      </ScrollView>
    </ScreenShell>
  );
}
