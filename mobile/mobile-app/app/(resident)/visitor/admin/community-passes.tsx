import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { HeaderActionButton } from '@/components/ui/HeaderActionButton';
import { Text } from '@/components/ui/text';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { FAB } from '@/components/ui/FAB';
import { VisitorPassCard } from '@/src/features/visitor/components/VisitorPassCard';
import { VisitorPassDetailsModal } from '@/src/features/visitor/components/VisitorPassDetailsModal';
import { AdminVillaFilterSheet } from '@/src/features/visitor/components/admin/AdminVillaFilterSheet';
import { VisitorInvitationTypeSheet } from '@/src/features/visitor/components/shared/VisitorInvitationTypeSheet';
import { useAdminVisitor } from '@/src/features/visitor/hooks/useAdminVisitor';
import { useVisitorPass } from '@/src/features/visitor/hooks/useVisitorPass';
import { VisitorPass } from '@/src/features/visitor/store/visitorPassSlice';
import { PassTypeKey } from '@/src/features/visitor/mocks/visitorMocks';
import { Button } from '@/components/ui/button';
import { Building2, Home, UserPlus, Filter, ShieldAlert, ChevronDown, Plus } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

export default function AdminCommunityPassesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    communityPasses,
    pagination,
    status,
    loadCommunityPasses,
  } = useAdminVisitor();

  const {
    activeVisitors,
    walkIns,
    fetchActiveVisitors,
    loadPendingWalkIns,
  } = useVisitorPass();

  const [adminViewScope, setAdminViewScope] = useState<'ALL' | 'COMMUNITY'>('ALL');
  const [search, setSearch] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('ALL');
  const [selectedVillaId, setSelectedVillaId] = useState<string | undefined>(undefined);
  const [selectedVillaName, setSelectedVillaName] = useState<string>('All Villas');
  const [villaSheetOpen, setVillaSheetOpen] = useState(false);
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState<VisitorPass | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const fetchPassesList = useCallback(
    (page = 1, append = false) => {
      loadCommunityPasses({
        page,
        append,
        search,
        status: activeStatusFilter === 'ALL' ? undefined : activeStatusFilter,
        villaId: selectedVillaId,
        scope: adminViewScope === 'COMMUNITY' ? 'COMMUNITY' : 'ALL',
      });
      fetchActiveVisitors();
    },
    [loadCommunityPasses, fetchActiveVisitors, search, activeStatusFilter, selectedVillaId, adminViewScope]
  );

  useEffect(() => {
    fetchPassesList(1);
    loadPendingWalkIns();
  }, [fetchPassesList, loadPendingWalkIns]);

  const handleRefresh = useCallback(() => {
    fetchPassesList(1);
    loadPendingWalkIns();
  }, [fetchPassesList, loadPendingWalkIns]);

  const handleLoadMore = useCallback(() => {
    if (pagination.currentPage < pagination.totalPages) {
      fetchPassesList(pagination.currentPage + 1, true);
    }
  }, [pagination, fetchPassesList]);

  const pendingWalkInCount = walkIns?.pendingList?.length || 0;

  const renderHeader = () => (
    <View className="gap-3 mb-3">
      {/* Admin Scope Switcher (All Passes vs Community Only) */}
      <View className="p-1 bg-muted/60 rounded-2xl flex-row gap-1">
        <TouchableOpacity
          onPress={() => {
            setAdminViewScope('ALL');
            setSelectedVillaId(undefined);
            setSelectedVillaName('All Villas');
          }}
          activeOpacity={0.8}
          className={`flex-1 flex-row items-center justify-center py-2.5 px-3 rounded-xl gap-1.5 ${
            adminViewScope === 'ALL' ? 'bg-card shadow-xs' : 'bg-transparent'
          }`}
        >
          <Home
            size={15}
            className={adminViewScope === 'ALL' ? 'text-primary' : 'text-muted-foreground'}
          />
          <Text
            className={`text-xs font-bold ${
              adminViewScope === 'ALL' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            All Passes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setAdminViewScope('COMMUNITY');
            setSelectedVillaId(undefined);
            setSelectedVillaName('Community Areas');
          }}
          activeOpacity={0.8}
          className={`flex-1 flex-row items-center justify-center py-2.5 px-3 rounded-xl gap-1.5 ${
            adminViewScope === 'COMMUNITY' ? 'bg-card shadow-xs' : 'bg-transparent'
          }`}
        >
          <Building2
            size={15}
            className={adminViewScope === 'COMMUNITY' ? 'text-primary' : 'text-muted-foreground'}
          />
          <Text
            className={`text-xs font-bold ${
              adminViewScope === 'COMMUNITY' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            Community Only
          </Text>
        </TouchableOpacity>
      </View>

      {/* Villa Filter Trigger Pill in All Estate Mode */}
      {adminViewScope === 'ALL' && (
        <Button
          variant="outline"
          size="sm"
          onPress={() => setVillaSheetOpen(true)}
          className="flex-row items-center justify-between border-primary/30 bg-primary/5 h-9 px-3.5 rounded-xl"
        >
          <View className="flex-row items-center gap-2">
            <Home size={14} className="text-primary" />
            <Text className="text-xs font-semibold text-foreground">
              Filter: {selectedVillaName}
            </Text>
          </View>
          <ChevronDown size={14} className="text-primary" />
        </Button>
      )}

      {/* Pending Walk-In Approval Alert Banner */}
      {pendingWalkInCount > 0 && (
        <TouchableOpacity
          onPress={() => router.navigate('/(resident)/visitor/admin/walk-in-console' as any)}
          activeOpacity={0.8}
          className="bg-status-warning/15 border border-status-warning/30 p-3 rounded-2xl flex-row items-center justify-between"
          accessibilityRole="button"
          accessibilityLabel="Review pending walk-in approvals"
        >
          <View className="flex-row items-center gap-2 flex-1 me-2">
            <ShieldAlert size={18} className="text-status-warning shrink-0" />
            <Text className="text-xs font-bold text-status-warning flex-1">
              {pendingWalkInCount} Walk-In Approval{pendingWalkInCount > 1 ? 's' : ''} Waiting at Gate
            </Text>
          </View>
          <Text className="text-xs font-extrabold text-status-warning underline">
            Review →
          </Text>
        </TouchableOpacity>
      )}

      {/* Search & Filter Bar */}
      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search visitor name, phone or pass code..."
        sortOptions={[
          { label: 'All', value: 'ALL' },
          { label: 'Active', value: 'ACTIVE' },
          { label: 'Pending', value: 'PENDING' },
          { label: 'Revoked', value: 'REVOKED' },
          { label: 'Expired', value: 'EXPIRED' },
        ]}
        currentSort={activeStatusFilter}
        onSortChange={setActiveStatusFilter}
        variant="default"
        className="px-0 py-0 border-0"
      />
    </View>
  );

  return (
    <ScreenShell
      title={t('all_community_passes', 'All Community Passes')}
      subtitle={t('master_pass_registry_villa_level_securit', 'Master pass registry & villa-level security filters')}
      headerRight={
        <HeaderActionButton
          onPress={() => setTypeSheetOpen(true)}
          icon={Plus}
          label={t('new_pass', 'New Pass')}
          accessibilityRole="button"
          accessibilityLabel={t('new_pass', 'New Pass')}
        />
      }
    >
      <View className="flex-1 bg-background">
        {/* Paginated List using Reusable VisitorPassCard */}
        <PaginatedList<VisitorPass>
          data={communityPasses}
          pagination={pagination}
          loading={status === 'loading'}
          onRefresh={handleRefresh}
          onLoadMore={handleLoadMore}
          paginationSummary
          ListHeaderComponent={renderHeader()}
          emptyIcon="QrCode"
          emptyTitle="No Community Passes Found"
          emptySubtitle="No passes matched your search or villa filter parameters."
          contentContainerClassName="px-4 pt-3 pb-28"
          renderItem={(pass) => {
            const isInside = activeVisitors?.some((l: any) => {
              const lPassId = (l.passId?._id || l.passId)?.toString();
              return lPassId && (lPassId === pass._id || lPassId === (pass as any).id);
            });

            const villaRaw = (pass as any).villaId;
            const villaBadge = typeof villaRaw === 'object' && villaRaw !== null
              ? (villaRaw?.unitNumber ? `Villa ${villaRaw.unitNumber}${villaRaw.blockOrBuilding ? ` - ${villaRaw.blockOrBuilding}` : ''}` : (villaRaw?.name || 'Community'))
              : ((pass as any).villaName || (pass as any).villaNumber || 'Community');

            return (
              <VisitorPassCard
                key={pass._id}
                pass={pass}
                isInside={isInside}
                villaBadge={villaBadge}
                onPress={(p) => {
                  setSelectedPass(p);
                  setDetailsModalOpen(true);
                }}
                onShowQR={(p) => {
                  setSelectedPass(p);
                  setDetailsModalOpen(true);
                }}
              />
            );
          }}
        />

        {/* Invitation Type Selector Bottom Sheet */}
        <VisitorInvitationTypeSheet
          visible={typeSheetOpen}
          onClose={() => setTypeSheetOpen(false)}
          onSelectType={(type: PassTypeKey) => {
            setTypeSheetOpen(false);
            router.navigate({
              pathname: '/(resident)/visitor/admin/create-pass' as any,
              params: { type },
            });
          }}
        />

        {/* Admin Villa Filter Bottom Sheet */}
        <AdminVillaFilterSheet
          visible={villaSheetOpen}
          selectedVillaId={selectedVillaId}
          onClose={() => setVillaSheetOpen(false)}
          onSelectVilla={(vId, vName) => {
            setSelectedVillaId(vId);
            setSelectedVillaName(vName || 'All Villas');
            setVillaSheetOpen(false);
          }}
        />

        {/* Pass Details Modal */}
        <VisitorPassDetailsModal
          visible={detailsModalOpen}
          pass={selectedPass}
          onClose={() => setDetailsModalOpen(false)}
          revokeReason="Revoked by community admin"
          onRevokePress={() => fetchPassesList(1)}
        />
      </View>
    </ScreenShell>
  );
}
