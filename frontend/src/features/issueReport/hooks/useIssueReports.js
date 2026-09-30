import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  loadPlatformReports,
  loadPlatformReportDetails,
  loadCommunityReports,
  loadCommunityReportDetails,
  loadIssueReportConfig,
  saveIssueReportConfig,
  testIssueReportConfig,
  setFilters,
  resetFilters,
  setSelectedReport,
  clearSelectedReport,
  clearError,
  clearEmailConfigStatus,
} from '../store/issueReportSlice.js'

/**
 * Custom controller hook serving as the bridge between UI components and the Redux engine.
 */
export const useIssueReports = () => {
  const dispatch = useDispatch()

  const reports = useSelector((state) => state.issueReport.list)
  const pagination = useSelector((state) => state.issueReport.pagination)
  const filters = useSelector((state) => state.issueReport.filters)
  const selectedReport = useSelector((state) => state.issueReport.selectedReport)
  const emailConfig = useSelector((state) => state.issueReport.emailConfig)
  const loading = useSelector((state) => state.issueReport.loading)
  const detailsLoading = useSelector((state) => state.issueReport.detailsLoading)
  const error = useSelector((state) => state.issueReport.error)
  const detailsError = useSelector((state) => state.issueReport.detailsError)

  const fetchEmailConfig = useCallback(() => {
    dispatch(loadIssueReportConfig())
  }, [dispatch])

  const updateEmailConfig = useCallback(
    (email) => {
      return dispatch(saveIssueReportConfig(email))
    },
    [dispatch],
  )

  const testEmailConfig = useCallback(
    (email) => {
      return dispatch(testIssueReportConfig(email))
    },
    [dispatch],
  )

  const clearEmailStatus = useCallback(() => {
    dispatch(clearEmailConfigStatus())
  }, [dispatch])

  const fetchReports = useCallback(
    (params = {}) => {
      dispatch(loadPlatformReports(params))
    },
    [dispatch],
  )

  const updateFilters = useCallback(
    (newFilters = {}) => {
      dispatch(setFilters(newFilters))
      dispatch(loadPlatformReports({ page: 1, ...newFilters }))
    },
    [dispatch],
  )

  const changePage = useCallback(
    (newPage) => {
      if (newPage >= 1 && newPage <= pagination.totalPages) {
        dispatch(loadPlatformReports({ page: newPage }))
      }
    },
    [dispatch, pagination.totalPages],
  )

  const changeLimit = useCallback(
    (newLimit) => {
      dispatch(loadPlatformReports({ page: 1, limit: newLimit }))
    },
    [dispatch],
  )

  const resetAllFilters = useCallback(() => {
    dispatch(resetFilters())
    dispatch(
      loadPlatformReports({
        page: 1,
        search: '',
        reportType: '',
        feature: '',
        organisationId: '',
        startDate: '',
        endDate: '',
      }),
    )
  }, [dispatch])

  const openReportDetails = useCallback(
    (id, initialData = null) => {
      if (initialData) {
        dispatch(setSelectedReport(initialData))
      }
      if (id) {
        dispatch(loadPlatformReportDetails(id))
      }
    },
    [dispatch],
  )

  const fetchCommunityReports = useCallback(
    (params = {}) => {
      dispatch(loadCommunityReports(params))
    },
    [dispatch],
  )

  const updateCommunityFilters = useCallback(
    (newFilters = {}) => {
      dispatch(setFilters(newFilters))
      dispatch(loadCommunityReports({ page: 1, ...newFilters }))
    },
    [dispatch],
  )

  const changeCommunityPage = useCallback(
    (newPage) => {
      if (newPage >= 1 && newPage <= pagination.totalPages) {
        dispatch(loadCommunityReports({ page: newPage }))
      }
    },
    [dispatch, pagination.totalPages],
  )

  const changeCommunityLimit = useCallback(
    (newLimit) => {
      dispatch(loadCommunityReports({ page: 1, limit: newLimit }))
    },
    [dispatch],
  )

  const resetCommunityFilters = useCallback(() => {
    dispatch(resetFilters())
    dispatch(
      loadCommunityReports({
        page: 1,
        search: '',
        reportType: '',
        feature: '',
        startDate: '',
        endDate: '',
      }),
    )
  }, [dispatch])

  const openCommunityReportDetails = useCallback(
    (id, initialData = null) => {
      if (initialData) {
        dispatch(setSelectedReport(initialData))
      }
      if (id) {
        dispatch(loadCommunityReportDetails(id))
      }
    },
    [dispatch],
  )

  const closeReportDetails = useCallback(() => {
    dispatch(clearSelectedReport())
  }, [dispatch])

  const clearErrors = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  return {
    reports,
    pagination,
    filters,
    selectedReport,
    emailConfig,
    loading,
    detailsLoading,
    error,
    detailsError,
    fetchEmailConfig,
    updateEmailConfig,
    testEmailConfig,
    clearEmailStatus,
    fetchReports,
    updateFilters,
    changePage,
    changeLimit,
    resetAllFilters,
    openReportDetails,
    fetchCommunityReports,
    updateCommunityFilters,
    changeCommunityPage,
    changeCommunityLimit,
    resetCommunityFilters,
    openCommunityReportDetails,
    closeReportDetails,
    clearErrors,
  }
}

export default useIssueReports
