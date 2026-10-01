import { useMemo, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { io } from 'socket.io-client'
import config from '../../../config/config.js'
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
} from '../store/userSlice'
import { fetchRolesAsync } from '../../roleBuilder/store/roleSlice'
import { switchWorkspaceContext } from '../../auth/store/authSlice'

/**
 * useUserList Custom Hook
 *
 * Reusable controller hook encapsulating all Redux selectors and actions
 * for the user management feature. Follows the "Thin View" architectural pattern.
 */
export const useUserList = () => {
  const dispatch = useDispatch()

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
  } = useSelector((state) => state.userManagement)

  const { roles } = useSelector((state) => state.roleBuilder)
  const currentUserId = useSelector((state) => state.auth.user?.id)
  const activeOrgId = useSelector((state) => state.workspace?.activeOrganizationId)
  const activeVillaId = useSelector((state) => state.auth.currentUser?.villaId) || null

  // Real-time real-time sync via Socket.io
  useEffect(() => {
    if (!activeOrgId) return

    const socketUrl = config.socketUrl
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      socket.emit('join_room', `org:${activeOrgId}`)
    })

    socket.on('RECORD_UPDATED', (payload) => {
      if (payload.type === 'USER') {
        // Silently refresh the list in the background
        dispatch(fetchUsersAsync({ page: currentPage, limit: rowsPerPage }))
      }
    })

    return () => {
      socket.off('RECORD_UPDATED')
      socket.disconnect()
    }
  }, [activeOrgId, dispatch, currentPage, rowsPerPage])

  // Fetch users when pagination or context states change
  useEffect(() => {
    dispatch(clearUsers())
    dispatch(fetchUsersAsync({ page: currentPage, limit: rowsPerPage }))
  }, [
    dispatch,
    activeOrgId,
    activeVillaId,
    currentPage,
    rowsPerPage,
    searchQuery,
    selectedRoles,
    statusFilter,
  ])

  // Load roles on mount if not loaded
  useEffect(() => {
    if (!roles || roles.length === 0) {
      dispatch(fetchRolesAsync({ page: 1, limit: 100 }))
    }
  }, [dispatch, roles])

  // Memoized Dynamic Roles List from Database
  const ROLES = useMemo(() => {
    return roles ? roles.map((r) => r.name) : []
  }, [roles])

  // Under server-side pagination, filtered users is the raw users array returned from backend
  const filteredUsers = users

  // Action Dispatchers
  const changeSearchQuery = (query) => {
    dispatch(setSearchQuery(query))
    dispatch(setCurrentPage(1))
  }
  const changeRoleToggle = (role) => {
    dispatch(toggleRole(role))
    dispatch(setCurrentPage(1))
  }
  const changeStatusToggle = (status) => {
    dispatch(toggleStatus(status))
    dispatch(setCurrentPage(1))
  }
  const handleClearRoleFilter = () => {
    dispatch(clearRoleFilter())
    dispatch(setCurrentPage(1))
  }

  // Handlers for page and limit changes
  const handlePageChange = (newPage) => {
    dispatch(setCurrentPage(newPage))
  }

  const handleRowsPerPageChange = (newLimit) => {
    dispatch(setRowsPerPage(newLimit))
    dispatch(setCurrentPage(1))
  }

  const removeUser = async (payload) => {
    await dispatch(deleteUserAsync(payload)).unwrap()
    dispatch(fetchUsersAsync({ page: currentPage, limit: rowsPerPage }))
  }

  const inviteUser = async (inviteData) => {
    const resultAction = await dispatch(inviteUserAsync(inviteData))
    if (inviteUserAsync.fulfilled.match(resultAction)) {
      return resultAction.payload
    } else {
      throw resultAction.payload || resultAction.error?.message || 'Failed to invite user'
    }
  }

  const bulkInviteUsers = async (invitations) => {
    const resultAction = await dispatch(bulkInviteUsersAsync(invitations))
    if (bulkInviteUsersAsync.fulfilled.match(resultAction)) {
      return resultAction.payload
    } else {
      throw resultAction.payload || resultAction.error?.message || 'Failed to bulk invite users'
    }
  }

  // Modal State & Handlers
  const [selectedUserForRoles, setSelectedUserForRoles] = useState(null)
  const [selectedUnitForRoles, setSelectedUnitForRoles] = useState(null)

  const openManageRolesModal = (user, unit = null) => {
    setSelectedUserForRoles(user)
    setSelectedUnitForRoles(unit)
  }

  const closeManageRolesModal = () => {
    setSelectedUserForRoles(null)
    setSelectedUnitForRoles(null)
  }

  const handleSaveRoles = async (userId, newRoles) => {
    try {
      const payload = { userId, roles: newRoles }
      if (selectedUnitForRoles && selectedUnitForRoles.villaId) {
        payload.villaId = selectedUnitForRoles.villaId
      }
      await dispatch(updateUserRolesAsync(payload)).unwrap()
      closeManageRolesModal()
      dispatch(fetchUsersAsync({ page: currentPage, limit: rowsPerPage }))

      // If the admin is modifying their own roles, refresh the auth context to update availableWorkspaces
      if (userId === currentUserId) {
        dispatch(switchWorkspaceContext({ targetOrgId: activeOrgId, targetVillaId: activeVillaId }))
      }
    } catch (err) {
      console.error('Failed to update user roles:', err)
    }
  }

  return {
    // State
    currentUserId,
    searchQuery,
    selectedRoles,
    statusFilter,
    currentPage,
    rowsPerPage,
    totalPages,
    totalRecords,
    users,
    filteredUsers,
    ROLES,
    STATUS_OPTIONS,
    selectedUserForRoles,
    selectedUnitForRoles,
    isLoading: loading,
    error,

    // Callbacks/Actions
    setSearchQuery: changeSearchQuery,
    toggleRole: changeRoleToggle,
    toggleStatus: changeStatusToggle,
    clearRoleFilter: handleClearRoleFilter,
    setCurrentPage: handlePageChange,
    setRowsPerPage: handleRowsPerPageChange,
    deleteUser: removeUser,
    inviteUser,
    bulkInviteUsers,
    openManageRolesModal,
    closeManageRolesModal,
    handleSaveRoles,
  }
}

export default useUserList
