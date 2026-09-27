import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, RefreshControl, Platform } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { TabBar } from '@/components/ui/TabBar';
import { KPIRow } from '@/components/ui/KPIRow';
import { WalkInApprovalsView } from '@/src/features/visitor/components/walkin/WalkInApprovalsView';
import { InsideVisitorsView } from '@/src/features/visitor/components/guard/InsideVisitorsView';
import { AdminVillaFilterSheet } from '@/src/features/visitor/components/admin/AdminVillaFilterSheet';
import { AdminWalkInRegistrationCard } from '@/src/features/visitor/components/admin/AdminWalkInRegistrationCard';
import { useVisitorPass } from '@/src/features/visitor/hooks/useVisitorPass';
import { useSelector } from 'react-redux';
import { selectActiveOrgId, selectAuthUser } from '@/src/features/auth/store/authSelectors';
import { useTranslation } from '@/src/utils/i18n';

const ADMIN_WALK_IN_TABS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'REGISTER', label: 'Register' },
  { key: 'INSIDE', label: 'Inside' },
];

export default function AdminWalkInConsoleScreen() {
  const { t } = useTranslation();
  const activeOrgId = useSelector(selectActiveOrgId);
  const authUser = useSelector(selectAuthUser);
  const {
    walkIns,
    loadPendingWalkIns,
    submitWalkIn,
    fetchActiveVisitors,
  } = useVisitorPass();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'REGISTER' | 'INSIDE'>('PENDING');
  const [refreshing, setRefreshing] = useState(false);
  const [insideCount, setInsideCount] = useState<number>(0);

  // Target Villa / Resident selection state
  const [villaId, setVillaId] = useState<string | undefined>(undefined);
  const [villaName, setVillaName] = useState<string>('Select Target Villa & Resident *');
  const [residentId, setResidentId] = useState<string | undefined>(undefined);
  const [residentName, setResidentName] = useState<string | undefined>(undefined);
  const [villaSheetOpen, setVillaSheetOpen] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      const activeList = await fetchActiveVisitors(activeOrgId);
      setInsideCount(activeList.length);
    } catch {
      // Handled silently
    }
  }, [activeOrgId, fetchActiveVisitors]);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPendingWalkIns(), fetchMetrics()]);
    setRefreshing(false);
  }, [loadPendingWalkIns, fetchMetrics]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRegisterWalkIn = async (data: {
    visitorName: string;
    phone: string;
    idProofNumber?: string;
    vehicleNumber?: string;
    villaId?: string;
    villaName?: string;
    residentId?: string;
    residentName?: string;
  }) => {
    setFormError(null);
    setFormSuccess(null);
    setRegisterLoading(true);

    try {
      const targetResidentUser = data.residentId || data.villaId;
      await submitWalkIn({
        orgId: activeOrgId,
        guardId: authUser?.id || authUser?._id,
        residentId: targetResidentUser,
        entryType: 'WALK_IN',
        snapshot: {
          visitorName: data.visitorName,
          idProofNumber: data.idProofNumber,
          vehicleNumber: data.vehicleNumber,
        },
      });

      setFormSuccess(`Walk-in gate notification sent to ${data.residentName || data.villaName}`);
      setVillaId(undefined);
      setVillaName('Select Target Villa & Resident *');
      setResidentId(undefined);
      setResidentName(undefined);

      // Switch to pending approvals queue
      setActiveTab('PENDING');
      loadData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to initiate walk-in request');
    } finally {
      setRegisterLoading(false);
    }
  };

  const pendingCount = walkIns?.pendingList?.length || 0;

  return (
    <ScreenShell
      title={t('master_gate_walk_in_console', 'Master Gate Walk-In Console')}
      subtitle={t('override_monitor_pending_gate_verificati', 'Override & monitor pending gate verification requests')}
      iconName="ShieldAlert"
    >
      <View className="flex-1 bg-background">
        {/* Top KPI Summary Strip */}
        <View className="py-2.5 bg-background border-b border-border/40">
          <KPIRow
            cards={[
              {
                title: 'Pending Approvals',
                value: String(pendingCount),
                subtitle: 'Awaiting Host',
                iconName: 'Clock',
                variant: pendingCount > 0 ? 'warning' : 'default',
                onPress: () => setActiveTab('PENDING'),
              },
              {
                title: 'Inside Community',
                value: String(insideCount),
                subtitle: 'Active Visitors',
                iconName: 'Users',
                variant: 'success',
                onPress: () => setActiveTab('INSIDE'),
              },
              {
                title: 'Security Desk',
                value: 'Online',
                subtitle: 'Supervisor Mode',
                iconName: 'ShieldCheck',
                variant: 'info',
              },
            ]}
          />
        </View>

        {/* TabBar navigation */}
        <TabBar
          tabs={ADMIN_WALK_IN_TABS}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as any)}
          variant="pill"
          className="mx-4 mt-3 mb-2"
        />

        {activeTab === 'PENDING' ? (
          <WalkInApprovalsView />
        ) : activeTab === 'INSIDE' ? (
          <InsideVisitorsView />
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-4 gap-4 pb-28 pt-2"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
          >
            {/* Extracted Reusable Walk-In Registration Card */}
            <AdminWalkInRegistrationCard
              onSubmit={handleRegisterWalkIn}
              loading={registerLoading}
              onOpenVillaPicker={() => setVillaSheetOpen(true)}
              selectedVillaId={villaId}
              selectedVillaName={villaName}
              selectedResidentId={residentId}
              selectedResidentName={residentName}
              formSuccess={formSuccess}
              formError={formError}
            />
          </ScrollView>
        )}
      </View>

      {/* Target Villa Selection Modal */}
      <AdminVillaFilterSheet
        visible={villaSheetOpen}
        selectedVillaId={villaId}
        selectedResidentId={residentId}
        onClose={() => setVillaSheetOpen(false)}
        onSelectVilla={(vId, vName, rId, rName) => {
          setVillaId(vId);
          setVillaName(vName || 'Select Target Villa *');
          setResidentId(rId);
          setResidentName(rName);
        }}
      />
    </ScreenShell>
  );
}
