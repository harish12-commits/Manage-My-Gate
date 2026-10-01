import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import issueReportApi from '../services/issueReportApi.js'
import { DEFAULT_PAGE_LIMIT } from '../constants/issueReport.constants.js'

export const loadPlatformReports = createAsyncThunk(
  'issueReport/loadPlatformReports',
  async (queryParams = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState().issueReport
      const mergedParams = {
        page: queryParams.page || state.pagination.currentPage || 1,
        limit: queryParams.limit || state.pagination.limit || DEFAULT_PAGE_LIMIT,
        search: queryParams.search !== undefined ? queryParams.search : state.filters.search,
        reportType:
          queryParams.reportType !== undefined ? queryParams.reportType : state.filters.reportType,
        feature: queryParams.feature !== undefined ? queryParams.feature : state.filters.feature,
        organisationId:
          queryParams.organisationId !== undefined
            ? queryParams.organisationId
            : state.filters.organisationId,
        startDate:
          queryParams.startDate !== undefined ? queryParams.startDate : state.filters.startDate,
        endDate: queryParams.endDate !== undefined ? queryParams.endDate : state.filters.endDate,
      }

      const response = await issueReportApi.fetchPlatformReports(mergedParams)
      return response.data
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to fetch issue reports'
      return rejectWithValue(msg)
    }
  },
)

export const loadPlatformReportDetails = createAsyncThunk(
  'issueReport/loadPlatformReportDetails',
  async (id, { rejectWithValue }) => {
    try {
      const response = await issueReportApi.fetchPlatformReportById(id)
      return response?.data !== undefined ? response.data : response
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to fetch report details'
      return rejectWithValue(msg)
    }
  },
)

export const loadCommunityReports = createAsyncThunk(
  'issueReport/loadCommunityReports',
  async (queryParams = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState().issueReport
      const mergedParams = {
        page: queryParams.page || state.pagination.currentPage || 1,
        limit: queryParams.limit || state.pagination.limit || DEFAULT_PAGE_LIMIT,
        search: queryParams.search !== undefined ? queryParams.search : state.filters.search,
        reportType:
          queryParams.reportType !== undefined ? queryParams.reportType : state.filters.reportType,
        feature: queryParams.feature !== undefined ? queryParams.feature : state.filters.feature,
        startDate:
          queryParams.startDate !== undefined ? queryParams.startDate : state.filters.startDate,
        endDate: queryParams.endDate !== undefined ? queryParams.endDate : state.filters.endDate,
      }

      const response = await issueReportApi.fetchCommunityReports(mergedParams)
      return response.data
    } catch (error) {
      const msg =
        error.response?.data?.message || error.message || 'Failed to fetch community issue reports'
      return rejectWithValue(msg)
    }
  },
)

export const loadCommunityReportDetails = createAsyncThunk(
  'issueReport/loadCommunityReportDetails',
  async (id, { rejectWithValue }) => {
    try {
      const response = await issueReportApi.fetchCommunityReportById(id)
      return response?.data !== undefined ? response.data : response
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.message ||
        'This issue report could not be found or is no longer available.'
      return rejectWithValue(msg)
    }
  },
)

export const loadIssueReportConfig = createAsyncThunk(
  'issueReport/loadIssueReportConfig',
  async (_, { rejectWithValue }) => {
    try {
      const response = await issueReportApi.fetchIssueReportConfig()
      const data = response?.data !== undefined ? response.data : response
      return data
    } catch (error) {
      const msg =
        error.response?.data?.message || error.message || 'Failed to fetch email configuration'
      return rejectWithValue(msg)
    }
  },
)

export const saveIssueReportConfig = createAsyncThunk(
  'issueReport/saveIssueReportConfig',
  async (email, { rejectWithValue }) => {
    try {
      const response = await issueReportApi.updateIssueReportConfig(email)
      const data = response?.data !== undefined ? response.data : response
      return data
    } catch (error) {
      const msg =
        error.response?.data?.message || error.message || 'Failed to save email configuration'
      return rejectWithValue(msg)
    }
  },
)

export const testIssueReportConfig = createAsyncThunk(
  'issueReport/testIssueReportConfig',
  async (email, { rejectWithValue }) => {
    try {
      const response = await issueReportApi.testIssueReportConfigEmail(email)
      const data = response?.data !== undefined ? response.data : response
      return data
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to send test email'
      return rejectWithValue(msg)
    }
  },
)

const initialFilters = {
  search: '',
  reportType: '',
  feature: '',
  organisationId: '',
  startDate: '',
  endDate: '',
}

const initialState = {
  list: [],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: DEFAULT_PAGE_LIMIT,
    hasNextPage: false,
    hasPrevPage: false,
  },
  filters: { ...initialFilters },
  selectedReport: null,
  emailConfig: {
    email: '',
    loading: false,
    saving: false,
    error: null,
    successMessage: null,
  },
  loading: false,
  detailsLoading: false,
  error: null,
  detailsError: null,
}

export const issueReportSlice = createSlice({
  name: 'issueReport',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    resetFilters: (state) => {
      state.filters = { ...initialFilters }
    },
    setSelectedReport: (state, action) => {
      state.selectedReport = action.payload || null
      state.detailsError = null
    },
    clearSelectedReport: (state) => {
      state.selectedReport = null
      state.detailsError = null
    },
    clearError: (state) => {
      state.error = null
      state.detailsError = null
    },
    clearEmailConfigStatus: (state) => {
      state.emailConfig.error = null
      state.emailConfig.successMessage = null
    },
  },
  extraReducers: (builder) => {
    builder
      // List
      .addCase(loadPlatformReports.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loadPlatformReports.fulfilled, (state, action) => {
        state.loading = false
        const payloadData = action.payload?.data || action.payload || {}
        state.list = payloadData.reports || []

        const totalRecords =
          payloadData.total !== undefined
            ? payloadData.total
            : (payloadData.pagination?.totalRecords ?? 0)
        const currentPage =
          payloadData.page !== undefined
            ? payloadData.page
            : (payloadData.pagination?.currentPage ?? 1)
        const limit =
          payloadData.limit !== undefined
            ? payloadData.limit
            : (payloadData.pagination?.limit ?? DEFAULT_PAGE_LIMIT)
        const totalPages =
          payloadData.totalPages !== undefined
            ? payloadData.totalPages
            : (payloadData.pagination?.totalPages ?? (Math.ceil(totalRecords / limit) || 1))

        state.pagination = {
          currentPage,
          totalPages,
          totalRecords,
          limit,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
        }
      })
      .addCase(loadPlatformReports.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to load issue reports'
      })

      // Details
      .addCase(loadPlatformReportDetails.pending, (state) => {
        state.detailsLoading = true
        state.detailsError = null
      })
      .addCase(loadPlatformReportDetails.fulfilled, (state, action) => {
        state.detailsLoading = false
        const payloadData = action.payload?.data || action.payload || null
        if (
          payloadData &&
          (payloadData._id || payloadData.id || payloadData.reportNumber || payloadData.title)
        ) {
          state.selectedReport = payloadData
        }
      })
      .addCase(loadPlatformReportDetails.rejected, (state, action) => {
        state.detailsLoading = false
        state.detailsError = action.payload || 'Failed to load report details'
      })

      // Community Reports List
      .addCase(loadCommunityReports.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loadCommunityReports.fulfilled, (state, action) => {
        state.loading = false
        const payloadData = action.payload?.data || action.payload || {}
        state.list = payloadData.reports || []

        const totalRecords =
          payloadData.total !== undefined
            ? payloadData.total
            : (payloadData.pagination?.totalRecords ?? 0)
        const currentPage =
          payloadData.page !== undefined
            ? payloadData.page
            : (payloadData.pagination?.currentPage ?? 1)
        const limit =
          payloadData.limit !== undefined
            ? payloadData.limit
            : (payloadData.pagination?.limit ?? DEFAULT_PAGE_LIMIT)
        const totalPages =
          payloadData.totalPages !== undefined
            ? payloadData.totalPages
            : (payloadData.pagination?.totalPages ?? (Math.ceil(totalRecords / limit) || 1))

        state.pagination = {
          currentPage,
          totalPages,
          totalRecords,
          limit,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
        }
      })
      .addCase(loadCommunityReports.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to load community issue reports'
      })

      // Community Report Details
      .addCase(loadCommunityReportDetails.pending, (state) => {
        state.detailsLoading = true
        state.detailsError = null
      })
      .addCase(loadCommunityReportDetails.fulfilled, (state, action) => {
        state.detailsLoading = false
        const payloadData = action.payload?.data || action.payload || null
        if (
          payloadData &&
          (payloadData._id || payloadData.id || payloadData.reportNumber || payloadData.title)
        ) {
          state.selectedReport = payloadData
        }
      })
      .addCase(loadCommunityReportDetails.rejected, (state, action) => {
        state.detailsLoading = false
        state.detailsError =
          action.payload || 'This issue report could not be found or is no longer available.'
      })

      // Issue Report Email Config Load
      .addCase(loadIssueReportConfig.pending, (state) => {
        state.emailConfig.loading = true
        state.emailConfig.error = null
      })
      .addCase(loadIssueReportConfig.fulfilled, (state, action) => {
        state.emailConfig.loading = false
        const payloadData = action.payload?.data || action.payload || {}
        state.emailConfig.email = payloadData.email || ''
      })
      .addCase(loadIssueReportConfig.rejected, (state, action) => {
        state.emailConfig.loading = false
        state.emailConfig.error = action.payload || 'Failed to load email configuration'
      })

      // Issue Report Email Config Save
      .addCase(saveIssueReportConfig.pending, (state) => {
        state.emailConfig.saving = true
        state.emailConfig.error = null
        state.emailConfig.successMessage = null
      })
      .addCase(saveIssueReportConfig.fulfilled, (state, action) => {
        state.emailConfig.saving = false
        const payloadData = action.payload?.data || action.payload || {}
        state.emailConfig.email =
          payloadData.email !== undefined ? payloadData.email : state.emailConfig.email
        state.emailConfig.successMessage = 'Email configuration saved successfully'
      })
      .addCase(saveIssueReportConfig.rejected, (state, action) => {
        state.emailConfig.saving = false
        state.emailConfig.error = action.payload || 'Failed to save email configuration'
      })

      // Issue Report Email Config Test
      .addCase(testIssueReportConfig.pending, (state) => {
        state.emailConfig.saving = true
        state.emailConfig.error = null
        state.emailConfig.successMessage = null
      })
      .addCase(testIssueReportConfig.fulfilled, (state) => {
        state.emailConfig.saving = false
        state.emailConfig.successMessage = 'Test email successfully sent via SMTP'
      })
      .addCase(testIssueReportConfig.rejected, (state, action) => {
        state.emailConfig.saving = false
        state.emailConfig.error = action.payload || 'Failed to send test email'
      })
  },
})

export const {
  setFilters,
  resetFilters,
  setSelectedReport,
  clearSelectedReport,
  clearError,
  clearEmailConfigStatus,
} = issueReportSlice.actions

export default issueReportSlice.reducer
