import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import reducer, {
  setFilters,
  resetFilters,
  setSelectedReport,
  clearSelectedReport,
  clearError,
  loadPlatformReports,
  loadPlatformReportDetails,
} from '../store/issueReportSlice.js'

describe('issueReportSlice Reducer', () => {
  const getInitialState = () => reducer(undefined, { type: '@@INIT' })

  it('should return the initial state on unknown action', () => {
    const state = getInitialState()
    assert.deepEqual(state.list, [])
    assert.equal(state.pagination.currentPage, 1)
    assert.equal(state.pagination.totalRecords, 0)
    assert.equal(state.selectedReport, null)
    assert.equal(state.loading, false)
    assert.equal(state.detailsLoading, false)
    assert.equal(state.error, null)
    assert.equal(state.filters.search, '')
  })

  it('should handle setFilters correctly', () => {
    const initialState = getInitialState()
    const nextState = reducer(initialState, setFilters({ search: 'NAH-0001', reportType: 'bug' }))

    assert.equal(nextState.filters.search, 'NAH-0001')
    assert.equal(nextState.filters.reportType, 'bug')
    assert.equal(nextState.filters.feature, '')
  })

  it('should handle resetFilters correctly', () => {
    const customState = {
      ...getInitialState(),
      filters: {
        search: 'crash',
        reportType: 'bug',
        feature: 'visitor_management',
        organisationId: 'org123',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      },
    }

    const nextState = reducer(customState, resetFilters())
    assert.equal(nextState.filters.search, '')
    assert.equal(nextState.filters.reportType, '')
    assert.equal(nextState.filters.feature, '')
    assert.equal(nextState.filters.organisationId, '')
    assert.equal(nextState.filters.startDate, '')
    assert.equal(nextState.filters.endDate, '')
  })

  it('should handle clearSelectedReport and clearError', () => {
    const populatedState = {
      ...getInitialState(),
      selectedReport: { id: 'rep1', reportNumber: 'NAH-000001' },
      detailsError: 'Failed',
      error: 'List error',
    }

    const clearedReportState = reducer(populatedState, clearSelectedReport())
    assert.equal(clearedReportState.selectedReport, null)
    assert.equal(clearedReportState.detailsError, null)
    assert.equal(clearedReportState.error, 'List error')

    const clearedAllErrorsState = reducer(clearedReportState, clearError())
    assert.equal(clearedAllErrorsState.error, null)
    assert.equal(clearedAllErrorsState.detailsError, null)
  })

  it('should handle loadPlatformReports.pending', () => {
    const initialState = getInitialState()
    const nextState = reducer(initialState, {
      type: loadPlatformReports.pending.type,
    })

    assert.equal(nextState.loading, true)
    assert.equal(nextState.error, null)
  })

  it('should handle loadPlatformReports.fulfilled with pagination', () => {
    const initialState = {
      ...getInitialState(),
      loading: true,
    }

    const payload = {
      success: true,
      data: {
        reports: [
          {
            _id: 'rep_1',
            reportNumber: 'NAH-000001',
            title: 'Gate camera blur',
            reportType: 'bug',
            feature: 'visitor_management',
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 3,
          totalRecords: 28,
          limit: 10,
          hasNextPage: true,
          hasPrevPage: false,
        },
      },
    }

    const nextState = reducer(initialState, {
      type: loadPlatformReports.fulfilled.type,
      payload,
    })

    assert.equal(nextState.loading, false)
    assert.equal(nextState.list.length, 1)
    assert.equal(nextState.list[0].reportNumber, 'NAH-000001')
    assert.equal(nextState.pagination.currentPage, 1)
    assert.equal(nextState.pagination.totalPages, 3)
    assert.equal(nextState.pagination.totalRecords, 28)
    assert.equal(nextState.pagination.hasNextPage, true)
    assert.equal(nextState.pagination.hasPrevPage, false)
  })

  it('should handle loadPlatformReports.fulfilled with direct backend response format', () => {
    const initialState = {
      ...getInitialState(),
      loading: true,
    }

    const payload = {
      success: true,
      data: {
        reports: [
          {
            _id: 'rep_2',
            reportNumber: 'NAH-000002',
            title: 'Elevator maintenance request',
            reportType: 'inquiry',
            feature: 'facilities',
          },
        ],
        total: 45,
        page: 2,
        limit: 10,
        totalPages: 5,
      },
    }

    const nextState = reducer(initialState, {
      type: loadPlatformReports.fulfilled.type,
      payload,
    })

    assert.equal(nextState.loading, false)
    assert.equal(nextState.list.length, 1)
    assert.equal(nextState.list[0].reportNumber, 'NAH-000002')
    assert.equal(nextState.pagination.currentPage, 2)
    assert.equal(nextState.pagination.totalPages, 5)
    assert.equal(nextState.pagination.totalRecords, 45)
    assert.equal(nextState.pagination.limit, 10)
    assert.equal(nextState.pagination.hasNextPage, true)
    assert.equal(nextState.pagination.hasPrevPage, true)
  })

  it('should handle loadPlatformReports.rejected', () => {
    const initialState = {
      ...getInitialState(),
      loading: true,
    }

    const nextState = reducer(initialState, {
      type: loadPlatformReports.rejected.type,
      payload: 'Access denied: platform admin only',
    })

    assert.equal(nextState.loading, false)
    assert.equal(nextState.error, 'Access denied: platform admin only')
  })

  it('should handle loadPlatformReportDetails.fulfilled', () => {
    const initialState = {
      ...getInitialState(),
      detailsLoading: true,
    }

    const reportDetail = {
      _id: 'rep_detail_1',
      reportNumber: 'NAH-000042',
      title: 'Facility booking error',
      description: 'Unable to select date slot on mobile.',
      reportType: 'bug',
      feature: 'amenity_booking',
      reporter: {
        id: 'user_1',
        name: 'Ahmad Al-Mansoor',
        email: 'ahmad@example.com',
      },
      technicalContext: {
        platform: 'ios',
        appVersion: '1.2.0',
        deviceModel: 'iPhone 15 Pro',
      },
    }

    const nextState = reducer(initialState, {
      type: loadPlatformReportDetails.fulfilled.type,
      payload: { success: true, data: reportDetail },
    })

    assert.equal(nextState.detailsLoading, false)
    assert.equal(nextState.selectedReport?.reportNumber, 'NAH-000042')
    assert.equal(nextState.selectedReport?.reporter?.name, 'Ahmad Al-Mansoor')
    assert.equal(nextState.selectedReport?.technicalContext?.platform, 'ios')
  })

  it('should handle setSelectedReport correctly', () => {
    const initialState = getInitialState()
    const reportData = { _id: 'rep_1', reportNumber: 'NAH-000001', title: 'Test Issue' }
    const nextState = reducer(initialState, setSelectedReport(reportData))

    assert.deepEqual(nextState.selectedReport, reportData)
    assert.equal(nextState.detailsError, null)
  })

  it('should handle loadPlatformReportDetails.fulfilled with direct unwrapped report payload', () => {
    const initialState = {
      ...getInitialState(),
      detailsLoading: true,
    }

    const reportDetail = {
      _id: 'rep_detail_direct',
      reportNumber: 'NAH-000099',
      title: 'Direct unwrap report',
      description: 'Detail verification.',
      reportType: 'bug',
      feature: 'amenity_booking',
    }

    const nextState = reducer(initialState, {
      type: loadPlatformReportDetails.fulfilled.type,
      payload: reportDetail,
    })

    assert.equal(nextState.detailsLoading, false)
    assert.equal(nextState.selectedReport?.reportNumber, 'NAH-000099')
    assert.equal(nextState.selectedReport?.title, 'Direct unwrap report')
  })

  it('should handle loadIssueReportConfig.fulfilled', () => {
    const initialState = getInitialState()
    const nextState = reducer(initialState, {
      type: 'issueReport/loadIssueReportConfig/fulfilled',
      payload: { data: { email: 'admin@company.com' } },
    })

    assert.equal(nextState.emailConfig.email, 'admin@company.com')
    assert.equal(nextState.emailConfig.loading, false)
  })

  it('should handle saveIssueReportConfig.fulfilled', () => {
    const initialState = getInitialState()
    const nextState = reducer(initialState, {
      type: 'issueReport/saveIssueReportConfig/fulfilled',
      payload: { data: { email: 'newadmin@company.com' } },
    })

    assert.equal(nextState.emailConfig.email, 'newadmin@company.com')
    assert.equal(nextState.emailConfig.saving, false)
    assert.equal(nextState.emailConfig.successMessage, 'Email configuration saved successfully')
  })
})
