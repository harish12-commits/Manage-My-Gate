import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useVisitorPass } from '@/src/features/visitor/hooks/useVisitorPass';
import { useAdminVisitor } from '@/src/features/visitor/hooks/useAdminVisitor';
import { selectAuthUser } from '@/src/features/auth/store/authSelectors';
import { VisitorPass } from '@/src/features/visitor/store/visitorPassSlice';
import { VisitorPassCard } from '@/src/features/visitor/components/VisitorPassCard';
import { VisitorPassDetailsModal } from '@/src/features/visitor/components/VisitorPassDetailsModal';
import { VisitorInvitationTypeSheet } from '@/src/features/visitor/components/shared/VisitorInvitationTypeSheet';
import { AdminVillaFilterSheet } from '@/src/features/visitor/components/admin/AdminVillaFilterSheet';
import { PassTypeKey } from '@/src/features/visitor/mocks/visitorMocks';
import { ShieldAlert, Home, Building2, ChevronDown } from 'lucide-react-native';

export default function ResidentPassesScreen() {
  const router = useRouter();
  const authUser = useSelector(selectAuthUser);

  const rawRole = (
    authUser?.role?.name ||
    authUser?.role ||
    authUser?.user?.role ||
    authUser?.userRole ||
    'RESIDENT'
  ).toString().toUpperCase();

  const isAdmin =
    rawRole.includes('ADMIN') ||
    rawRole.includes('MANAGER') ||
    rawRole.includes('SUPER');

  const {
    passes,
    activePass,
    activeVisitors,
    walkIns,
    pagination,
    status,
    actionStatus,
    fetchPasses,
    fetchActiveVisitors,
    loadPendingWalkIns,
    revokePass,
    selectPass,
  } = useVisitorPass();

  const {
    communityPasses,
    pagination: adminPagination,
    status: adminStatus,
    loadCommunityPasses,
    forceRevoke,
  } = useAdminVisitor();

  const [adminViewScope, setAdminViewScope] = useState<'ALL' | 'COMMUNITY'>('ALL');
  const [selectedVillaId, setSelectedVillaId] = useState<string | undefined>(undefined);
  const [selectedVillaName, setSelectedVillaName] = useState<string>('All Villas');
  const [villaSheetOpen, setVillaSheetOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('ALL');
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const fetchFilteredPasses = useCallback((page: number = 1, append: boolean = false) => {
    const status = activeStatusFilter === 'ALL' ? undefined : activeStatusFilter;
    if (isAdmin) {
      loadCommunityPasses({
        page,
        append,
        search,
        villaId: selectedVillaId,
        status,
        scope: adminViewScope === 'COMMUNITY' ? 'COMMUNITY' : 'ALL',
      });
    } else {
      fetchPasses({
        page,
        append,
        statuses: activeStatusFilter === 'ALL' ? 'PENDING,ACTIVE,REVOKED,EXPIRED' : activeStatusFilter,
      });
    }
    fetchActiveVisitors();
  }, [isAdmin, adminViewScope, loadCommunityPasses, fetchPasses, fetchActiveVisitors, activeStatusFilter, search, selectedVillaId]);

  // Initial fetch on screen load
  useEffect(() => {
    fetchFilteredPasses(1, false);
    loadPendingWalkIns();
  }, [fetchFilteredPasses, loadPendingWalkIns]);

  const handleRefresh = useCallback(() => {
    fetchFilteredPasses(1, false);
    loadPendingWalkIns();
  }, [fetchFilteredPasses, loadPendingWalkIns]);

  const handleLoadMore = useCallback(() => {
    const currentPagination = isAdmin ? adminPagination : pagination;
    if (currentPagination.currentPage < currentPagination.totalPages) {
      fetchFilteredPasses(currentPagination.currentPage + 1, true);
    }
  }, [isAdmin, adminPagination, pagination, fetchFilteredPasses]);

  // Active pass dataset
  const currentPassesList = useMemo(() => {
    if (isAdmin) {
      return communityPasses;
    }
    return passes.filter((pass: VisitorPass) => {
      const matchesSearch =
        search.trim() === '' ||
        (pass.visitorName && pass.visitorName.toLowerCase().includes(search.toLowerCase())) ||
        (pass.phone && pass.phone.includes(search)) ||
        (pass.code && pass.code.toLowerCase().includes(search.toLowerCase())) ||
        (Boolean((pass as any).shortKey) && (pass as any).shortKey.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = activeStatusFilter === 'ALL' || pass.status === activeStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [isAdmin, communityPasses, passes, search, activeStatusFilter]);

  const handleSelectType = (type: PassTypeKey) => {
    setInviteSheetOpen(false);
    router.navigate({ pathname: '/(resident)/visitor/invite' as any, params: { type } });
  };



  const pendingWalkInCount = walkIns?.pendingList?.length || 0;

  const renderHeader = () => (
    <View className="gap-3 mb-3">
      {/* Admin Scope Switcher */}
      {isAdmin && (
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
      )}

      {/* Admin Villa Filter Trigger in All Estate Mode */}
      {isAdmin && adminViewScope === 'ALL' && (
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
      {pendingWalkInCount > 0 ? (
        <TouchableOpacity
          onPress={() => router.navigate('/(resident)/visitor/walk-ins' as any)}
          activeOpacity={0.8}
          className="bg-status-warning/15 border border-status-warning/30 p-3 rounded-2xl flex-row items-center justify-between"
          accessibilityRole="button"
          accessibilityLabel="Review pending walk-in approvals"
        >
          <View className="flex-row items-center gap-2 flex-1 me-2">
            <Icon as={ShieldAlert} size={18} className="text-status-warning shrink-0" />
            <Text className="text-xs font-bold text-status-warning flex-1">
              {pendingWalkInCount} Walk-In Approval{pendingWalkInCount > 1 ? 's' : ''} Waiting at Gate
            </Text>
          </View>
          <Text className="text-xs font-extrabold text-status-warning underline">
            Review →
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Search & Filter Bar */}
      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search visitor name, phone or code..."
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

  // Admin scopes are both backed by the community-pass endpoint. Keeping the
  // data, loading state, and pagination source together prevents skipped or
  // duplicated pages when switching between All Passes and Community Only.
  const activeLoading = (isAdmin ? adminStatus : status) === 'loading';
  const activePaginationData = isAdmin ? adminPagination : pagination;

  return (
    <ScreenShell
      title="Visitor Passes"
      subtitle={
        isAdmin && adminViewScope === 'COMMUNITY'
          ? 'All-estate pass registry & security oversight'
          : 'Manage guest invitations & QR passes'
      }
      iconName="TicketCheck"
    >
      {/* Paginated List of Passes with ListHeaderComponent */}
      <PaginatedList<VisitorPass>
        data={currentPassesList}
        pagination={activePaginationData}
        loading={activeLoading}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        paginationSummary
        ListHeaderComponent={renderHeader()}
        emptyIcon="QrCode"
        emptyTitle="No Visitor Passes Found"
        emptySubtitle="Create a visitor pass to pre-approve guests and send QR invites."
        contentContainerClassName="px-4 pt-3 pb-28"
        renderItem={(pass) => {
          const isInside = activeVisitors?.some((l: any) => {
            const lPassId = (l.passId?._id || l.passId)?.toString();
            return lPassId && (lPassId === pass._id || lPassId === (pass as any).id);
          });

          return (
            <VisitorPassCard
              key={pass._id}
              pass={pass}
              isInside={isInside}
              onPress={(p) => {
                selectPass(p);
                setDetailsModalOpen(true);
              }}
              onShowQR={(p) => {
                selectPass(p);
                setDetailsModalOpen(true);
              }}
            />
          );
        }}
      />

      {/* Invitation Type Selector Bottom Sheet */}
      <VisitorInvitationTypeSheet
        visible={inviteSheetOpen}
        onClose={() => setInviteSheetOpen(false)}
        onSelectType={handleSelectType}
      />

      {/* Pass Details Modal */}
      <VisitorPassDetailsModal
        visible={detailsModalOpen}
        pass={activePass}
        onClose={() => setDetailsModalOpen(false)}
        onRevokePress={() => {
          fetchFilteredPasses(1, false);
        }}
      />
      {/* Admin Villa Filter Sheet */}
      {isAdmin && (
        <AdminVillaFilterSheet
          visible={villaSheetOpen}
          onClose={() => setVillaSheetOpen(false)}
          selectedVillaId={selectedVillaId}
          onSelectVilla={(villaId, villaName) => {
            setSelectedVillaId(villaId);
            setSelectedVillaName(villaName || 'All Villas');
            setVillaSheetOpen(false);
          }}
        />
      )}
    </ScreenShell>
  );
}
