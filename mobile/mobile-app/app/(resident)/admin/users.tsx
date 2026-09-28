import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Filter, Users, ChevronLeft, ChevronRight, Mail, Users2, Hash, X, Plus } from 'lucide-react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { FAB } from '@/components/ui/FAB';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SkeletonLoader } from '@/components/feedback/SkeletonLoader';
import { TextInput } from '@/components/forms/TextInput';
import { Button } from '@/components/common/Button';
import { RowsPerPageDropdown } from '@/components/ui/RowsPerPageDropdown';
import { useTranslation } from '@/src/utils/i18n';
import {
  useUserList,
  UserCard,
  InviteUserModal,
  BulkInviteModal,
  ConfigureInviteTemplateModal,
  ManageRolesModal,
  UserFilterSheet,
  UserData,
  AssignedUnit,
} from '@/src/features/userManagement';

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
    selectedUserForRoles,
    selectedUnitForRoles,
    openManageRolesModal,
    closeManageRolesModal,
    handleSaveRoles,
    isLoading,
    error,
    refreshUsers,
  } = useUserList();

  // Local UI State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBulkInviteModal, setShowBulkInviteModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showPageJumpModal, setShowPageJumpModal] = useState(false);
  const [targetPageInput, setTargetPageInput] = useState('');
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
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

  const handleExecutePageJump = () => {
    const pageNum = parseInt(targetPageInput.trim(), 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setShowPageJumpModal(false);
      setTargetPageInput('');
    } else {
      Alert.alert('Invalid Page', `Please enter a valid page number between 1 and ${totalPages}.`);
    }
  };

  const activeFilterCount = (selectedRoles?.length || 0) + (statusFilter?.length < 3 ? 1 : 0);

  // Record Range Calculations
  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endRecord = Math.min(currentPage * rowsPerPage, totalRecords);

  // Pagination Footer Component
  const renderPaginationFooter = () => {
    if (totalRecords === 0 || totalPages <= 1) return null;

    return (
      <View className="mt-3 pt-2.5 border-t border-border/40">
        <View className="flex-row items-center justify-between bg-card border border-border/60 p-2 rounded-xl shadow-xs">
          {/* Previous Page Button (<) */}
          <TouchableOpacity
            onPress={() => {
              if (currentPage > 1) {
                setCurrentPage(currentPage - 1);
              }
            }}
            disabled={currentPage <= 1 || isLoading}
            className={`flex-row items-center px-3 py-1.5 rounded-lg border ${
              currentPage <= 1 || isLoading
                ? 'bg-muted/40 border-border/40 opacity-40'
                : 'bg-blue-500/10 border-blue-500/20 active:opacity-70'
            }`}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
          >
            <ChevronLeft size={16} color={currentPage <= 1 || isLoading ? '#9ca3af' : '#6366f1'} className="me-1" />
            <Text className={`text-xs font-bold ${currentPage <= 1 || isLoading ? 'text-muted-foreground' : 'text-primary'}`}>
              {t('prev_page', 'Prev')}
            </Text>
          </TouchableOpacity>

          {/* Page Counter & Direct Jump Trigger */}
          <TouchableOpacity
            onPress={() => {
              if (totalPages > 1) {
                setTargetPageInput(String(currentPage));
                setShowPageJumpModal(true);
              }
            }}
            disabled={totalPages <= 1}
            className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border/60 flex-row items-center"
            accessibilityRole="button"
            accessibilityLabel="Current page"
          >
            <Text className="text-xs font-bold text-foreground">
              {t('page_label', 'Page')} {currentPage} {t('of_users', 'of')} {totalPages}
            </Text>
          </TouchableOpacity>

          {/* Next Page Button (>) */}
          <TouchableOpacity
            onPress={() => {
              if (currentPage < totalPages) {
                setCurrentPage(currentPage + 1);
              }
            }}
            disabled={currentPage >= totalPages || isLoading}
            className={`flex-row items-center px-3 py-1.5 rounded-lg border ${
              currentPage >= totalPages || isLoading
                ? 'bg-muted/40 border-border/40 opacity-40'
                : 'bg-blue-500/10 border-blue-500/20 active:opacity-70'
            }`}
            accessibilityRole="button"
            accessibilityLabel="Next page"
          >
            <Text className={`text-xs font-bold me-1 ${currentPage >= totalPages || isLoading ? 'text-muted-foreground' : 'text-primary'}`}>
              {t('next_page', 'Next')}
            </Text>
            <ChevronRight size={16} color={currentPage >= totalPages || isLoading ? '#9ca3af' : '#2563eb'} />
          </TouchableOpacity>
        </View>
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
        <View className="flex-row items-center gap-1.5">
          <TouchableOpacity
            onPress={() => router.push('/(resident)/admin/invitations')}
            className="p-2 rounded-xl bg-secondary border border-border flex-row items-center active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel="View Invitations"
          >
            <Mail size={16} className="text-foreground" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowInviteModal(true)}
            className="flex-row items-center gap-1.5 bg-emerald-600 active:bg-emerald-700 px-3 py-1.5 rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Invite User"
          >
            <Plus size={14} color="#ffffff" />
            <Text className="text-xs font-bold text-white">{t('invite_user', 'Invite User')}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View className="flex-1">
        {/* Search & Filter Bar */}
        <SearchFilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t('search_users_placeholder', 'Search by name, email, or unit...')}
          onFilterPress={() => setShowFilterSheet(true)}
          activeFilterCount={activeFilterCount}
        />

        {/* Action Section (Responsive Mini Cards) */}
        <View className="px-4 py-2.5 border-b border-border/40 bg-card/20 shrink-0">
          <View className="flex-row items-stretch gap-2.5">
            {/* Bulk Invite Mini Card */}
            <TouchableOpacity
              onPress={() => setShowBulkInviteModal(true)}
              activeOpacity={0.7}
              className="flex-1 p-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 active:bg-amber-500/10 flex-row items-center gap-2.5 shadow-2xs"
              accessibilityRole="button"
              accessibilityLabel="Bulk Invite Users"
            >
              <View className="w-9 h-9 rounded-lg bg-amber-500/15 items-center justify-center shrink-0">
                <Users2 size={18} color="#d97706" />
              </View>
              <View className="flex-1 justify-center">
                <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                  {t('bulk_invite', 'Bulk Invite')}
                </Text>
                <Text className="text-[10px] text-muted-foreground mt-0.5" numberOfLines={1}>
                  {t('bulk_invite_sub', 'Import via CSV')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Configure Email Mini Card */}
            <TouchableOpacity
              onPress={() => setShowTemplateModal(true)}
              activeOpacity={0.7}
              className="flex-1 p-2.5 rounded-xl border border-blue-500/25 bg-blue-500/5 active:bg-blue-500/10 flex-row items-center gap-2.5 shadow-2xs"
              accessibilityRole="button"
              accessibilityLabel="Configure Invitation Email"
            >
              <View className="w-9 h-9 rounded-lg bg-blue-500/15 items-center justify-center shrink-0">
                <Mail size={18} color="#2563eb" />
              </View>
              <View className="flex-1 justify-center">
                <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                  {t('configure_invitation_mail_short', 'Email Template')}
                </Text>
                <Text className="text-[10px] text-muted-foreground mt-0.5" numberOfLines={1}>
                  {t('configure_invitation_mail_sub', 'Customize invite')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* User Summary & Compact Rows-Per-Page Dropdown */}
        <View className="px-3 py-2 flex-row flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-muted/20">
          <Text className="text-xs font-semibold text-muted-foreground text-start">
            {t('showing_users', 'Showing')}{' '}
            <Text className="font-bold text-foreground">{startRecord}–{endRecord}</Text>{' '}
            {t('of_users', 'of')}{' '}
            <Text className="font-bold text-foreground">{totalRecords}</Text>{' '}
            {t('users_label', 'Users')}
          </Text>

          <RowsPerPageDropdown
            value={rowsPerPage}
            options={[10, 20, 50, 100]}
            onChange={setRowsPerPage}
          />
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
              />
            )}
            contentContainerClassName="p-2.5 pb-28"
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEventThrottle={16}
            alwaysBounceVertical={true}
            bounces={true}
            showsVerticalScrollIndicator={false}
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

      {/* Modals & Bottom Sheets */}
      <InviteUserModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSendInvite={handleSendInvite}
      />

      <BulkInviteModal
        visible={showBulkInviteModal}
        onClose={() => setShowBulkInviteModal(false)}
        onBulkInvite={bulkInviteUsers}
      />

      <ConfigureInviteTemplateModal
        visible={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
      />

      <ManageRolesModal
        visible={!!selectedUserForRoles}
        user={selectedUserForRoles}
        unit={selectedUnitForRoles}
        onClose={closeManageRolesModal}
        onSave={handleSaveRoles}
        availableRoles={ROLES}
      />

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

      {/* Quick Jump To Page Modal */}
      <Modal visible={showPageJumpModal} transparent statusBarTranslucent={true} animationType="fade" onRequestClose={() => setShowPageJumpModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-center items-center bg-black/50 p-4">
            <View className="bg-card rounded-2xl p-5 border border-border w-full max-w-xs shadow-lg">
              <View className="flex-row items-center justify-between pb-2 border-b border-border mb-3">
                <View className="flex-row items-center">
                  <Hash size={18} color="#6366f1" className="me-2" />
                  <Text className="text-base font-bold text-foreground">{t('jump_to_page', 'Jump to Page')}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowPageJumpModal(false)}>
                  <X size={16} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <Text className="text-xs text-muted-foreground mb-3 text-start">
                {t('enter_page_number', 'Enter page number between')} <Text className="font-bold text-foreground">1</Text> {t('and_label', 'and')} <Text className="font-bold text-foreground">{totalPages}</Text>:
              </Text>

              <TextInput
                value={targetPageInput}
                onChangeText={setTargetPageInput}
                placeholder={`1 - ${totalPages}`}
                keyboardType="number-pad"
                autoFocus
                className="mb-4"
              />

              <View className="flex-row items-center justify-end gap-2">
                <Button variant="outline" size="sm" onPress={() => setShowPageJumpModal(false)}>
                  {t('cancel', 'Cancel')}
                </Button>
                <Button variant="default" size="sm" onPress={handleExecutePageJump}>
                  {t('go_to_page', 'Go to Page')}
                </Button>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
