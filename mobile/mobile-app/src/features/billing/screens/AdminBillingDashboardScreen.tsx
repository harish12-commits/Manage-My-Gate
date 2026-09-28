import React, { useEffect, useCallback } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { KPIDashboardStrip } from '@/components/ui/KPIDashboardStrip';
import { type KPICardProps } from '@/components/ui/KPICard';
import { ActionGrid, type ActionGridItem } from '@/components/ui/ActionGrid';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/common/ProgressBar';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ListItem } from '@/components/common/ListItem';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { FAB } from '@/components/ui/FAB';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import {
  Clock,
  ShieldAlert,
  Target,
  FileText,
  CreditCard,
} from 'lucide-react-native';
import { useBilling } from '../hooks/useBilling';
import { useBillingSocket } from '../hooks/useBillingSocket';

export function AdminBillingDashboardScreen() {
  const router = useRouter();
  const {
    kpis,
    invoicesList,
    loadingStates,
    error,
    activeOrgId,
    loadAdminDashboard,
    resetBillingError,
  } = useBilling();

  // Socket sync for real-time KPI & ledger updates
  useBillingSocket();

  // Permission check from auth state accommodating admin roles and permissions
  const hasDashboardPermission = useSelector((state: any) => {
    const role = state.auth?.user?.role || '';
    const adminRoles = [
      'Super Admin',
      'Platform Super Admin',
      'Community Admin',
      'Admin',
      'SuperAdmin',
      'Finance Manager',
      'Finance Admin',
    ];
    if (adminRoles.includes(role)) return true;
    const permissions = state.auth?.user?.permissions;
    if (Array.isArray(permissions)) {
      return permissions.some((p: any) => {
        const name = typeof p === 'string' ? p : p?.name;
        return name === 'billing:dashboard' || name === 'billing' || name === '*';
      });
    }
    return false;
  });

  const fetchDashboardData = useCallback(() => {
    if (activeOrgId) {
      loadAdminDashboard(activeOrgId);
    }
  }, [activeOrgId, loadAdminDashboard]);

  useEffect(() => {
    if (hasDashboardPermission) {
      fetchDashboardData();
    }
  }, [hasDashboardPermission, fetchDashboardData]);

  // Authoritative metrics from backend
  const grossDemand = kpis?.grossDemand || 0;
  const grossDemandCount = kpis?.grossDemandCount || 0;
  const totalCollected = kpis?.totalCollected || 0;
  const totalUnpaidArrears = kpis?.totalUnpaidArrears || 0;
  const inTransitGateway = kpis?.inTransitGateway || 0;
  const pendingOfflineAmount = kpis?.pendingOfflineAmount ?? kpis?.pendingOffline ?? 0;
  const pendingOfflineCount = kpis?.pendingOfflineCount ?? (pendingOfflineAmount > 0 ? 1 : 0);

  // Calculate collection progress percentage
  const collectionRate = grossDemand > 0 ? Math.min(100, Math.round((totalCollected / grossDemand) * 100)) : 0;

  // Universal KPI metrics configured for KPIDashboardStrip
  const kpiCards: KPICardProps[] = [
    {
      title: 'Gross Billed',
      value: `₹${grossDemand.toLocaleString('en-IN')}`,
      subtitle: `${grossDemandCount} total invoices`,
      iconName: 'Receipt',
      variant: 'default',
    },
    {
      title: 'Total Collected',
      value: `₹${totalCollected.toLocaleString('en-IN')}`,
      trend: { direction: 'up', value: `${collectionRate}% rate` },
      iconName: 'TrendingUp',
      variant: 'success',
    },
    {
      title: 'Unpaid Arrears',
      value: `₹${totalUnpaidArrears.toLocaleString('en-IN')}`,
      subtitle: 'Pending collection',
      iconName: 'AlertCircle',
      variant: 'destructive',
      onPress: () =>
        router.push({
          pathname: '/(resident)/admin/billing/ledger',
          params: { status: 'UNPAID' },
        } as any),
    },
    {
      title: 'Pending Clearance',
      value: `₹${pendingOfflineAmount.toLocaleString('en-IN')}`,
      subtitle: `${pendingOfflineCount} offline submission${pendingOfflineCount === 1 ? '' : 's'}`,
      iconName: 'Clock',
      variant: 'warning',
      onPress: () =>
        router.push({
          pathname: '/(resident)/admin/billing/ledger',
          params: { status: 'VERIFICATION_PENDING' },
        } as any),
    },
  ];

  // Quick Navigation Hub ActionGrid Items
  const navItems: ActionGridItem[] = [
    {
      id: 'ledger',
      name: 'Billing Ledger',
      route: '/(resident)/admin/billing/ledger',
      iconName: 'Receipt',
      colorBg: 'bg-emerald-500/10',
      colorIcon: '#10b981',
      badge: pendingOfflineCount > 0 ? String(pendingOfflineCount) : undefined,
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'assessments',
      name: 'Assessments',
      route: '/(resident)/admin/billing/assessments',
      iconName: 'Landmark',
      colorBg: 'bg-teal-500/10',
      colorIcon: '#14b8a6',
    },
    {
      id: 'my-dues',
      name: 'Personal Dues',
      route: '/(resident)/billing/my-dues',
      iconName: 'Layers',
      colorBg: 'bg-indigo-500/10',
      colorIcon: '#6366f1',
    },
    {
      id: 'wallet',
      name: 'Digital Wallet',
      route: '/(resident)/billing/wallet',
      iconName: 'Wallet',
      colorBg: 'bg-cyan-500/10',
      colorIcon: '#06b6d4',
    },
    {
      id: 'history',
      name: 'Payment History',
      route: '/(resident)/billing/history',
      iconName: 'Clock',
      colorBg: 'bg-purple-500/10',
      colorIcon: '#a855f7',
    },
  ];

  // Strict 3-Item Limit for Dashboard Activity Previews per Mobile Rule V.1
  const recentTransactions = Array.isArray(invoicesList) ? invoicesList.slice(0, 3) : [];

  return (
    <ScreenShell
      title="Billing Overview"
      subtitle={!hasDashboardPermission ? 'Access Restricted' : 'Community Collection & Dues Snapshot'}
      iconName="BarChart3"
      loading={hasDashboardPermission && loadingStates.fetchKPIs && !kpis}
    >
      {!hasDashboardPermission ? (
        <View className="flex-1 bg-background p-6 items-center justify-center">
          <View className="w-16 h-16 rounded-full bg-destructive/10 items-center justify-center mb-4">
            <Icon as={ShieldAlert} size={32} className="text-destructive" />
          </View>
          <Text className="text-xl font-bold text-foreground text-center mb-2">Access Denied</Text>
          <Text className="text-sm text-muted-foreground text-center mb-6 px-4">
            You do not have administrative permission to view community financial KPIs.
          </Text>
          <Button
            variant="default"
            size="lg"
            onPress={() => router.push('/(resident)/billing/my-dues' as any)}
            accessibilityRole="button"
            accessibilityLabel="Return to My Dues"
          >
            Return to My Dues
          </Button>
        </View>
      ) : (
        <ScrollView
          className="flex-1 bg-background"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-4 pb-28 gap-5"
          refreshControl={
            <RefreshControl
              refreshing={loadingStates.fetchKPIs}
              onRefresh={fetchDashboardData}
              colors={['#6366f1']}
            />
          }
        >
          {/* Error Banner */}
          {error ? (
            <ErrorBanner message={error} onDismiss={resetBillingError} />
          ) : null}

          {/* 1. Universal Top KPI Metrics Strip */}
          <KPIDashboardStrip cards={kpiCards} loading={loadingStates.fetchKPIs && !kpis} layout="grid2x2" />

          {/* 2. Collection Target Progress Widget */}
          <Card className="bg-card border border-border rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Icon as={Target} size={18} className="text-primary me-2" />
                <Text className="text-sm font-bold text-foreground">Current Month Collection Progress</Text>
              </View>
              <Text className="text-sm font-extrabold text-primary">{collectionRate}%</Text>
            </View>
            <ProgressBar progress={collectionRate} className="h-2 rounded-full mb-3" />
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-muted-foreground">
                Collected: <Text className="font-semibold text-foreground">₹{totalCollected.toLocaleString('en-IN')}</Text>
              </Text>
              <Text className="text-xs text-muted-foreground">
                Billed: <Text className="font-semibold text-foreground">₹{grossDemand.toLocaleString('en-IN')}</Text>
              </Text>
            </View>
          </Card>

          {/* 3. Attention Required Box */}
          {pendingOfflineAmount > 0 ? (
            <View className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex-row items-start justify-between">
              <View className="flex-row items-start flex-1 me-3">
                <Icon as={Clock} size={22} className="text-amber-600 dark:text-amber-400 me-3 mt-0.5" />
                <View className="flex-1">
                  <Text className="font-extrabold text-sm text-amber-900 dark:text-amber-200">
                    Pending Offline Payment Verification
                  </Text>
                  <Text className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    ₹{pendingOfflineAmount.toLocaleString('en-IN')} across {pendingOfflineCount} submission{pendingOfflineCount === 1 ? '' : 's'} awaiting admin clearance.
                  </Text>
                </View>
              </View>
              <Button
                variant="outline"
                size="sm"
                className="bg-amber-500/20 border-amber-500/40"
                onPress={() =>
                  router.push({
                    pathname: '/(resident)/admin/billing/ledger',
                    params: { status: 'VERIFICATION_PENDING' },
                  } as any)
                }
                accessibilityRole="button"
                accessibilityLabel="Review pending offline payments"
              >
                <Text className="text-xs font-bold text-amber-900 dark:text-amber-200">Review</Text>
              </Button>
            </View>
          ) : null}

          {/* 4. Quick Navigation Hub using ActionGrid */}
          <ActionGrid title="Quick Navigation" items={navItems} />

          {/* 5. Recent Invoices Feed Snippet (Strict 3-Item Limit) */}
          <View>
            <SectionHeader
              title="Recent Invoices"
              actionLabel="View All"
              onAction={() => router.push('/(resident)/admin/billing/ledger' as any)}
            />
            {recentTransactions.length === 0 ? (
              <Card className="bg-card border border-border rounded-xl p-4 items-center justify-center mt-2">
                <Text className="text-xs text-muted-foreground text-center">
                  No invoices found for this community.
                </Text>
              </Card>
            ) : (
              <View className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border mt-2">
                {recentTransactions.map((tx: any) => (
                  <ListItem
                    key={tx._id || tx.invoiceNumber}
                    title={`${tx.unitNumber || 'Unit'} • ${tx.targetUser || 'Resident'}`}
                    subtitle={`Inv #${tx.invoiceNumber || '—'} • ${tx.status || 'UNPAID'} • ₹${(tx.totalDue || tx.totalAmount || tx.amount || 0).toLocaleString('en-IN')}`}
                    leftIcon={FileText}
                    onPress={() => router.push('/(resident)/admin/billing/ledger' as any)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Primary Action: New Assessment Wizard FAB */}
      {hasDashboardPermission && (
        <FAB
          iconName="Plus"
          label="New Assessment"
          onPress={() =>
            router.push({
              pathname: '/(resident)/admin/billing/assessments',
              params: { create: 'true' },
            } as any)
          }
        />
      )}
    </ScreenShell>
  );
}

export default AdminBillingDashboardScreen;
