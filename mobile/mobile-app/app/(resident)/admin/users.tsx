import React, { useState, useRef, Suspense, lazy } from 'react';
import { View, FlatList, RefreshControl, ScrollView, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, Animated, TouchableWithoutFeedback } from 'react-native';
import { useRouter } from 'expo-router';
import { Filter, Users, Mail, Users2, Plus, UserPlus, X } from 'lucide-react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { HeaderActionButton } from '@/components/ui/HeaderActionButton';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SkeletonLoader } from '@/components/feedback/SkeletonLoader';
import { TextInput } from '@/components/forms/TextInput';
import { Button } from '@/components/common/Button';
import { useTranslation } from '@/src/utils/i18n';
import {
  useUserList,
  UserCard,
  UserFilterSheet,
  UserData,
  AssignedUnit,
} from '@/src/features/userManagement';
import { AppLoader } from '@/components/ui/AppLoader';
import { Text } from '@/components/ui/text';

// Lazy Load Heavy Modals for Performance Optimization
const InviteUserModal = lazy(() => import('@/src/features/userManagement').then(m => ({ default: m.InviteUserModal })));
const BulkInviteModal = lazy(() => import('@/src/features/userManagement').then(m => ({ default: m.BulkInviteModal })));
const ConfigureInviteTemplateModal = lazy(() => import('@/src/features/userManagement').then(m => ({ default: m.ConfigureInviteTemplateModal })));
const ManageRolesModal = lazy(() => import('@/src/features/userManagement').then(m => ({ default: m.ManageRolesModal })));
const EditUserModal = lazy(() => import('@/src/features/userManagement').then(m => ({ default: m.EditUserModal })));

export default function UserManagementScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  // Controller Hook
  const {
    currentUserId,
    searchQuery,
    selectedRoles,
    statusFilter,
    users,
    currentPage,
    rowsPerPage,
    totalRecords,
    totalPages,
    ROLES,
    STATUS_OPTIONS,
    setSearchQuery,
    toggleRole,
    toggleStatus,
    clearRoleFilter,
    setCurrentPage,
    setRowsPerPage,
    deleteUser,
    inviteUser,
    bulkInviteUsers,
    editUser,
    selectedUserForRoles,
    selectedUnitForRoles,
    openManageRolesModal,
    closeManageRolesModal,
    handleSaveRoles,
    isLoading,
    error,
    refreshUsers,
    loadMoreUsers,
  } = useUserList();

  // Local UI State
  // Speed Dial UI State & Animation
  const [isDialOpen, setIsDialOpen] = useState(false);
  const dialAnimation = useRef(new Animated.Value(0)).current;

  const toggleDial = () => {
    const toValue = isDialOpen ? 0 : 1;
    Animated.spring(dialAnimation, {
      toValue,
      friction: 5,
      useNativeDriver: true,
    }).start();
    setIsDialOpen(!isDialOpen);
  };

  const closeDialAndOpen = (setter: (v: boolean) => void) => {
    toggleDial();
    setTimeout(() => setter(true), 300);
  };

  const rotation = dialAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg']
  });

  // Elliptical entering pop-out animation to prevent left-aligned text collisions
  const transX1 = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
  const transY1 = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -145] });

  const transX2 = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -75] });
  const transY2 = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -85] });

  const transX3 = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -115] });
  const transY3 = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -15] });
  
  // Staggered entering pop-out scale animation
  const scale1 = dialAnimation.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1.1, 1], extrapolate: 'clamp' });
  const scale2 = dialAnimation.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 1.1, 1], extrapolate: 'clamp' });
  const scale3 = dialAnimation.interpolate({ inputRange: [0, 0.9, 1], outputRange: [0.5, 1.1, 1], extrapolate: 'clamp' });

  const dialOpacity = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBulkInviteModal, setShowBulkInviteModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [userToEdit, setUserToEdit] = useState<UserData | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast / Alert helper
  const handleSendInvite = async (inviteData: any) => {
    try {
      const result = await inviteUser(inviteData);
      Alert.alert(
        'Invitation Sent',
        result?.invitationToken
          ? `Invitation issued successfully.\nToken: ${result.invitationToken}`
          : 'User invited successfully!'
      );
    } catch (err: any) {
      Alert.alert('Invite Error', err?.message || 'Failed to invite user');
      throw err;
    }
  };

  const handleResendInvite = (user: UserData) => {
    handleSendInvite({
      email: user.email,
      villaId: (user as any).villaId || null,
      residentType: (user as any).residentType || 'None',
      roleName: user.role || null,
    });
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      const userId = userToDelete.id || userToDelete._id || '';
      await deleteUser({ userId });
      Alert.alert('Success', `User ${userToDelete.name} has been deleted.`);
      setUserToDelete(null);
    } catch (err: any) {
      Alert.alert('Delete Error', err?.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const activeFilterCount = (selectedRoles?.length || 0) + (statusFilter?.length < 3 ? 1 : 0);

  // Infinite Scroll Footer Component
  const renderPaginationFooter = () => {
    if (!isLoading || users.length === 0) return null;
    return (
      <View className="mt-3 py-4 items-center justify-center">
        <AppLoader variant="inline" />
      </View>
    );
  };

  return (
    <ScreenShell
      title={t('feature_admin_users_name', 'User Management')}
      subtitle={t('residents_and_staff', 'Residents & Staff')}
      iconName="Users"
      domainName="Administration & Security"
      sharedSlice="userSlice.ts"
      loading={false}
      error={error}
      onRetry={refreshUsers}
      headerRight={
        <HeaderActionButton
          onPress={() => setShowInviteModal(true)}
          icon={UserPlus}
          label={t('invite_user', 'Invite')}
          accessibilityRole="button"
          accessibilityLabel={t('invite_user', 'Invite User')}
        />
      }
    >
      <View className="flex-1 bg-background">
        <SearchFilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t('search_users_placeholder', 'Search users, email, unit...')}
          onFilterPress={() => setShowFilterSheet(true)}
          activeFilterCount={activeFilterCount}
        />

        {/* Premium Pill Tabs */}
        <View className="pb-3 border-b border-border/30">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerClassName="px-4 gap-2.5"
          >
            {['All', 'Resident', 'Guard', 'Staff'].map((tabRole) => {
              const isActive = tabRole === 'All' 
                ? selectedRoles.length === 0 
                : selectedRoles.includes(tabRole);
              
              return (
                <TouchableOpacity
                  key={tabRole}
                  onPress={() => {
                    clearRoleFilter();
                    if (tabRole !== 'All') {
                      toggleRole(tabRole);
                    }
                  }}
                  className={`py-2 px-5 rounded-full border transition-all flex-row items-center justify-center ${
                    isActive 
                      ? 'bg-primary border-primary shadow-sm' 
                      : 'bg-card border-border/60'
                  }`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text className={`text-[13px] font-bold tracking-wide ${
                    isActive ? 'text-white' : 'text-muted-foreground'
                  }`}>
                    {tabRole === 'All' ? t('all_users', 'All Users') : tabRole}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* List Content */}
        {isLoading && users.length === 0 ? (
          <View className="p-3">
            <SkeletonLoader count={4} variant="card" />
          </View>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('no_users_found', 'No Users Found')}
            description={
              searchQuery || selectedRoles.length > 0
                ? t('no_users_match', 'No users match your active search or filter criteria.')
                : t('no_users_registered', 'No community users registered yet. Tap the button below to invite users.')
            }
            actionLabel={t('invite_user', 'Invite User')}
            onAction={() => setShowInviteModal(true)}
          />
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={users}
            keyExtractor={(item) => item.id || item._id || item.email}
            renderItem={({ item }) => (
              <UserCard
                user={item}
                currentUserId={currentUserId}
                onManageRoles={(u: UserData, unit?: AssignedUnit | null) => openManageRolesModal(u, unit)}
                onResendInvite={(u: UserData) => handleResendInvite(u)}
                onDeleteUser={(u: UserData) => setUserToDelete(u)}
                onViewDetails={(u: UserData) => setUserToEdit(u)}
              />
            )}
            contentContainerClassName="p-3 pb-40"
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 160 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEventThrottle={16}
            alwaysBounceVertical={true}
            bounces={true}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMoreUsers}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderPaginationFooter}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={refreshUsers}
                colors={['#6366f1']}
                tintColor="#6366f1"
              />
            }
          />
        )}
      </View>

      {/* Animated Speed Dial Overlay */}
      {isDialOpen && (
        <TouchableWithoutFeedback onPress={toggleDial}>
          <Animated.View 
            style={{ opacity: dialOpacity }}
            className="absolute inset-0 bg-black/60 z-[9990] elevation-5" 
          />
        </TouchableWithoutFeedback>
      )}

      {/* Speed Dial Action 3: Email Template (Left) */}
      <Animated.View 
        className="z-[9998]"
        style={{ 
          position: 'absolute', bottom: 135, right: 25,
          width: 50, height: 50,
          alignItems: 'center', justifyContent: 'center',
          transform: [{ translateX: transX3 }, { translateY: transY3 }, { scale: scale3 }], 
          opacity: dialOpacity,
          overflow: 'visible'
        }}
        pointerEvents={isDialOpen ? 'auto' : 'none'}
      >
        <View style={{ position: 'absolute', right: 55, width: 125, alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
          <View className="bg-card px-3 py-1.5 rounded-lg border border-border/60 shadow-sm" style={{ elevation: 2 }}>
            <Text className="text-foreground text-[11px] font-bold tracking-tight text-right" numberOfLines={1}>
              {t('email_template', 'Email Template')}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => closeDialAndOpen(setShowTemplateModal)}
          className="w-[50px] h-[50px] rounded-full bg-secondary border border-border/50 items-center justify-center shadow-lg"
        >
          <Mail size={22} className="text-primary" />
        </TouchableOpacity>
      </Animated.View>

      {/* Speed Dial Action 2: Bulk Invite (Top-Left) */}
      <Animated.View 
        className="z-[9998]"
        style={{ 
          position: 'absolute', bottom: 135, right: 25,
          width: 50, height: 50,
          alignItems: 'center', justifyContent: 'center',
          transform: [{ translateX: transX2 }, { translateY: transY2 }, { scale: scale2 }], 
          opacity: dialOpacity,
          overflow: 'visible'
        }}
        pointerEvents={isDialOpen ? 'auto' : 'none'}
      >
        <View style={{ position: 'absolute', right: 55, width: 125, alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
          <View className="bg-card px-3 py-1.5 rounded-lg border border-border/60 shadow-sm" style={{ elevation: 2 }}>
            <Text className="text-foreground text-[11px] font-bold tracking-tight text-right" numberOfLines={1}>
              {t('bulk_invite', 'Bulk Invite')}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => closeDialAndOpen(setShowBulkInviteModal)}
          className="w-[50px] h-[50px] rounded-full bg-secondary border border-border/50 items-center justify-center shadow-lg"
        >
          <Users size={22} className="text-primary" />
        </TouchableOpacity>
      </Animated.View>

      {/* Speed Dial Action 1: Invite User (Top) */}
      <Animated.View 
        className="z-[9998]"
        style={{ 
          position: 'absolute', bottom: 135, right: 25,
          width: 50, height: 50,
          alignItems: 'center', justifyContent: 'center',
          transform: [{ translateX: transX1 }, { translateY: transY1 }, { scale: scale1 }], 
          opacity: dialOpacity,
          overflow: 'visible'
        }}
        pointerEvents={isDialOpen ? 'auto' : 'none'}
      >
        <View style={{ position: 'absolute', right: 55, width: 125, alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
          <View className="bg-card px-3 py-1.5 rounded-lg border border-border/60 shadow-sm" style={{ elevation: 2 }}>
            <Text className="text-foreground text-[11px] font-bold tracking-tight text-right" numberOfLines={1}>
              {t('invite_user', 'Invite User')}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => closeDialAndOpen(setShowInviteModal)}
          className="w-[50px] h-[50px] rounded-full bg-secondary border border-border/50 items-center justify-center shadow-lg"
        >
          <UserPlus size={22} className="text-primary" />
        </TouchableOpacity>
      </Animated.View>

      {/* Main Animated FAB */}
      <TouchableOpacity
        className="rounded-full bg-primary/90 items-center justify-center shadow-xl border border-primary/50"
        style={{ position: 'absolute', bottom: 130, right: 20, width: 60, height: 60, elevation: 8, zIndex: 9999 }}
        activeOpacity={0.7}
        onPress={toggleDial}
      >
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Plus size={28} className="text-white" />
        </Animated.View>
      </TouchableOpacity>

      {/* Modals & Bottom Sheets */}
      {/* Lazy Loaded Heavy Modals & Bottom Sheets */}
      <Suspense fallback={null}>
        {userToEdit && (
          <EditUserModal
            visible={!!userToEdit}
            user={userToEdit}
            onClose={() => setUserToEdit(null)}
            onSave={async (id, data) => {
              await editUser(id, data);
              Alert.alert('Success', 'Profile updated successfully.');
            }}
          />
        )}

        {showInviteModal && (
          <InviteUserModal
            visible={showInviteModal}
            onClose={() => setShowInviteModal(false)}
            onSendInvite={handleSendInvite}
          />
        )}

        {showBulkInviteModal && (
          <BulkInviteModal
            visible={showBulkInviteModal}
            onClose={() => setShowBulkInviteModal(false)}
            onBulkInvite={bulkInviteUsers}
          />
        )}

        {showTemplateModal && (
          <ConfigureInviteTemplateModal
            visible={showTemplateModal}
            onClose={() => setShowTemplateModal(false)}
          />
        )}

        {selectedUserForRoles && (
          <ManageRolesModal
            visible={!!selectedUserForRoles}
            user={selectedUserForRoles}
            unit={selectedUnitForRoles}
            onClose={closeManageRolesModal}
            onSave={handleSaveRoles}
            availableRoles={ROLES}
          />
        )}
      </Suspense>

      <UserFilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        availableRoles={ROLES}
        selectedRoles={selectedRoles}
        onToggleRole={toggleRole}
        onClearRoles={clearRoleFilter}
        statusOptions={STATUS_OPTIONS}
        selectedStatuses={statusFilter}
        onToggleStatus={toggleStatus}
      />

      {/* Delete User Confirmation Modal */}
      <ConfirmationModal
        visible={!!userToDelete}
        title={t('delete_user_title', 'Delete User')}
        message={`${t('delete_user_confirm', 'Are you sure you want to delete user')} "${userToDelete?.name}"? ${t('action_cannot_be_undone', 'This action cannot be undone.')}`}
        confirmLabel={t('role_delete', 'Delete')}
        cancelLabel={t('cancel', 'Cancel')}
        variant="danger"
        onConfirm={confirmDeleteUser}
        onCancel={() => setUserToDelete(null)}
        loading={deleting}
      />
    </ScreenShell>
  );
}
