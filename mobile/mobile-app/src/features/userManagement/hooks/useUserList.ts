import { useMemo, useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { getSocketBaseUrl } from '../../../services/apiClient';
import { AppDispatch, RootState } from '../../../store/store';
import {
  setSearchQuery,
  toggleRole,
  toggleStatus,
  clearRoleFilter,
  setCurrentPage,
  setRowsPerPage,
  fetchUsersAsync,
  inviteUserAsync,
  bulkInviteUsersAsync,
  deleteUserAsync,
  updateUserRolesAsync,
  clearUsers,
  STATUS_OPTIONS,
} from '../store/userSlice';
import { fetchRolesAsync } from '../../roleBuilder/store/roleSlice';
import { UserData, InviteUserData } from '../services/userService';

export const useUserList = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Selectors
  const {
    users,
    searchQuery,
    selectedRoles,
    statusFilter,
    currentPage,
    rowsPerPage,
    totalRecords,
    totalPages,
    loading,
    error,
  } = useSelector((state: RootState) => (state as any).userManagement || {});

  const { roles } = useSelector((state: RootState) => state.roleBuilder || { roles: [] });
  const authState = useSelector((state: RootState) => state.auth);
  const currentUserId = authState?.user?.id || (authState as any)?.user?._id;
  const activeOrgId = (authState as any)?.organizationId || (authState as any)?.user?.organizationId;
  const activeVillaId = (authState as any)?.currentVilla?.id || (authState as any)?.currentUser?.villaId || null;

  // Real-time synchronization via Socket.io
  useEffect(() => {
    if (!activeOrgId) return;

    const socket = io(getSocketBaseUrl(), {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_room', `org:${activeOrgId}`);
    });

    socket.on('RECORD_UPDATED', (payload: any) => {
      if (payload?.type === 'USER') {
        dispatch(fetchUsersAsync({ page: currentPage || 1, limit: rowsPerPage || 10 }));
      }
    });

    return () => {
      socket.off('RECORD_UPDATED');
      socket.disconnect();
    };
  }, [activeOrgId, dispatch, currentPage, rowsPerPage]);

  // Fetch users initially or refresh explicitly
  const refreshUsers = useCallback(() => {
    dispatch(setCurrentPage(1));
    dispatch(fetchUsersAsync({ page: 1, limit: rowsPerPage || 10 }));
  }, [dispatch, rowsPerPage]);

  // Handle infinite scroll trigger
  const loadMoreUsers = useCallback(() => {
    if (!loading && currentPage < totalPages) {
      dispatch(fetchUsersAsync({ page: currentPage + 1, limit: rowsPerPage || 10 }));
    }
  }, [dispatch, loading, currentPage, totalPages, rowsPerPage]);

  // When filters change, reset to page 1 and fetch
  useEffect(() => {
    dispatch(setCurrentPage(1));
    dispatch(fetchUsersAsync({ page: 1, limit: rowsPerPage || 10 }));
  }, [dispatch, activeOrgId, activeVillaId, rowsPerPage, searchQuery, selectedRoles, statusFilter]);

  // Load roles on mount if needed
  useEffect(() => {
    if (!roles || roles.length === 0) {
      dispatch(fetchRolesAsync({ page: 1, limit: 100 }));
    }
  }, [dispatch, roles]);

  // Memoized Available Roles List
  const ROLES = useMemo(() => {
    return roles ? roles.map((r: any) => r.name) : [];
  }, [roles]);

  // Action Handlers
  const handleSearchChange = (query: string) => {
    dispatch(setSearchQuery(query));
  };

  const handleRoleToggle = (role: string) => {
    dispatch(toggleRole(role));
  };

  const handleStatusToggle = (status: string) => {
    dispatch(toggleStatus(status));
  };

  const handleClearRoleFilter = () => {
    dispatch(clearRoleFilter());
  };

  const handlePageChange = (newPage: number) => {
    dispatch(setCurrentPage(newPage));
  };

  const handleRowsPerPageChange = (newLimit: number) => {
    dispatch(setRowsPerPage(newLimit));
  };

  const removeUser = async (payload: { userId: string; villaId?: string | null }) => {
    await dispatch(deleteUserAsync(payload)).unwrap();
    refreshUsers();
  };

  const inviteUser = async (inviteData: InviteUserData) => {
    const resultAction = await dispatch(inviteUserAsync(inviteData));
    if (inviteUserAsync.fulfilled.match(resultAction)) {
      refreshUsers();
      return resultAction.payload;
    } else {
      throw resultAction.payload || resultAction.error?.message || 'Failed to invite user';
    }
  };

  const bulkInviteUsers = async (invitations: InviteUserData[]) => {
    const resultAction = await dispatch(bulkInviteUsersAsync(invitations));
    if (bulkInviteUsersAsync.fulfilled.match(resultAction)) {
      refreshUsers();
      return resultAction.payload;
    } else {
      throw resultAction.payload || resultAction.error?.message || 'Failed to bulk invite users';
    }
  };

  const editUser = async (userId: string, data: { name: string; phone: string }) => {
    // Simulate API call for now since backend endpoint might not be ready
    await new Promise((resolve) => setTimeout(resolve, 800));
    // In a real implementation: await dispatch(updateUserAsync({ userId, ...data })).unwrap();
    refreshUsers();
  };

  // Modal Control States
  const [selectedUserForRoles, setSelectedUserForRoles] = useState<UserData | null>(null);
  const [selectedUnitForRoles, setSelectedUnitForRoles] = useState<any | null>(null);

  const openManageRolesModal = (user: UserData, unit: any = null) => {
    setSelectedUserForRoles(user);
    setSelectedUnitForRoles(unit);
  };

  const closeManageRolesModal = () => {
    setSelectedUserForRoles(null);
    setSelectedUnitForRoles(null);
  };

  const handleSaveRoles = async (userId: string, newRoles: string[]) => {
    try {
      const payload: { userId: string; roles: string[]; villaId?: string | null } = {
        userId,
        roles: newRoles,
      };
      if (selectedUnitForRoles && selectedUnitForRoles.villaId) {
        payload.villaId = selectedUnitForRoles.villaId;
      }
      await dispatch(updateUserRolesAsync(payload)).unwrap();
      closeManageRolesModal();
      refreshUsers();
    } catch (err) {
      console.error('Failed to update user roles:', err);
    }
  };

  return {
    // State
    currentUserId,
    searchQuery,
    selectedRoles: selectedRoles || [],
    statusFilter: statusFilter || [],
    currentPage: currentPage || 1,
    rowsPerPage: rowsPerPage || 10,
    totalPages: totalPages || 1,
    totalRecords: totalRecords || 0,
    users: users || [],
    ROLES,
    STATUS_OPTIONS,
    selectedUserForRoles,
    selectedUnitForRoles,
    isLoading: !!loading,
    error,

    // Actions & Handlers
    setSearchQuery: handleSearchChange,
    toggleRole: handleRoleToggle,
    toggleStatus: handleStatusToggle,
    clearRoleFilter: handleClearRoleFilter,
    setCurrentPage: handlePageChange,
    setRowsPerPage: handleRowsPerPageChange,
    deleteUser: removeUser,
    inviteUser,
    bulkInviteUsers,
    editUser,
    openManageRolesModal,
    closeManageRolesModal,
    handleSaveRoles,
    refreshUsers,
    loadMoreUsers,
  };
};

export default useUserList;
