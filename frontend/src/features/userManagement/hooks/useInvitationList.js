import { useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchInvitationsAsync,
  resendInvitationAsync,
  revokeInvitationAsync,
  setInvitationSearchQuery,
  setInvitationStatusFilter,
  setInvitationCurrentPage,
  setInvitationRowsPerPage,
} from '../store/userSlice'

export const INVITATION_STATUS_OPTIONS = [
  'ALL',
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'REVOKED',
  'EXPIRED',
]

/**
 * useInvitationList Custom Hook
 *
 * Encapsulates Redux state and operations for the Invitation Management view.
 * Follows the "Thin View" architectural pattern.
 */
export const useInvitationList = () => {
  const dispatch = useDispatch()

  const {
    items: invitations,
    currentPage,
    rowsPerPage,
    totalRecords,
    totalPages,
    statusFilter,
    searchQuery,
    loading,
    actionLoadingId,
    error,
  } = useSelector(
    (state) =>
      state.userManagement?.invitations || {
        items: [],
        currentPage: 1,
        rowsPerPage: 10,
        totalRecords: 0,
        totalPages: 1,
        statusFilter: 'ALL',
        searchQuery: '',
        loading: false,
        actionLoadingId: null,
        error: null,
      },
  )

  const activeOrgId = useSelector((state) => state.workspace?.activeOrganizationId)

  // Trigger fetch with current state
  const loadInvitations = useCallback(
    (overrides = {}) => {
      dispatch(
        fetchInvitationsAsync({
          page: overrides.page !== undefined ? overrides.page : currentPage,
          limit: overrides.limit !== undefined ? overrides.limit : rowsPerPage,
          status: overrides.status !== undefined ? overrides.status : statusFilter,
          search: overrides.search !== undefined ? overrides.search : searchQuery,
        }),
      )
    },
    [dispatch, currentPage, rowsPerPage, statusFilter, searchQuery],
  )

  // Initial load and reload on workspace change
  useEffect(() => {
    loadInvitations()
  }, [dispatch, activeOrgId, currentPage, rowsPerPage, statusFilter, searchQuery, loadInvitations])

  const handleSearchChange = (query) => {
    dispatch(setInvitationSearchQuery(query))
  }

  const handleStatusChange = (status) => {
    dispatch(setInvitationStatusFilter(status))
  }

  const handlePageChange = (page) => {
    dispatch(setInvitationCurrentPage(page))
  }

  const handleRowsPerPageChange = (limit) => {
    dispatch(setInvitationRowsPerPage(limit))
  }

  const handleResend = async (invitationId) => {
    const result = await dispatch(resendInvitationAsync(invitationId))
    if (!result.error) {
      loadInvitations()
    }
    return result
  }

  const handleRevoke = async (invitationId) => {
    const result = await dispatch(revokeInvitationAsync(invitationId))
    if (!result.error) {
      loadInvitations()
    }
    return result
  }

  return {
    invitations,
    currentPage,
    rowsPerPage,
    totalRecords,
    totalPages,
    statusFilter,
    searchQuery,
    loading,
    actionLoadingId,
    error,
    refreshInvitations: loadInvitations,
    handleSearchChange,
    handleStatusChange,
    handlePageChange,
    handleRowsPerPageChange,
    handleResend,
    handleRevoke,
    STATUS_OPTIONS: INVITATION_STATUS_OPTIONS,
  }
}
