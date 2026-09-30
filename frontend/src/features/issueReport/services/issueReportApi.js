import apiClient from '../../../services/apiClient.js'

/**
 * Platform Admin API service to query and view submitted issue reports.
 */
export const fetchPlatformReports = async ({
  page = 1,
  limit = 20,
  search = '',
  reportType = '',
  feature = '',
  organisationId = '',
  startDate = '',
  endDate = '',
} = {}) => {
  const params = { page, limit }

  if (search && search.trim()) params.search = search.trim()
  if (reportType) params.reportType = reportType
  if (feature) params.feature = feature
  if (organisationId) params.organisationId = organisationId
  if (startDate) params.startDate = startDate
  if (endDate) params.endDate = endDate

  return await apiClient.get('/platform/reports', { params })
}

export const fetchPlatformReportById = async (id) => {
  return await apiClient.get(`/platform/reports/${id}`)
}

/**
 * Community Admin API service to query and view tenant-scoped issue reports.
 */
export const fetchCommunityReports = async ({
  page = 1,
  limit = 20,
  search = '',
  reportType = '',
  feature = '',
  startDate = '',
  endDate = '',
} = {}) => {
  const params = { page, limit }

  if (search && search.trim()) params.search = search.trim()
  if (reportType) params.reportType = reportType
  if (feature) params.feature = feature
  if (startDate) params.startDate = startDate
  if (endDate) params.endDate = endDate

  return await apiClient.get('/support/reports/community', { params })
}

export const fetchCommunityReportById = async (id) => {
  return await apiClient.get(`/support/reports/community/${id}`)
}

/**
 * Platform Admin API service to manage issue report notification email settings.
 */
export const fetchIssueReportConfig = async () => {
  return await apiClient.get('/platform/reports/config')
}

export const updateIssueReportConfig = async (email) => {
  return await apiClient.put('/platform/reports/config', { email })
}

export const testIssueReportConfigEmail = async (email) => {
  return await apiClient.post('/platform/reports/config/test-email', { email })
}

export default {
  fetchPlatformReports,
  fetchPlatformReportById,
  fetchCommunityReports,
  fetchCommunityReportById,
  fetchIssueReportConfig,
  updateIssueReportConfig,
  testIssueReportConfigEmail,
}
