import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as platformCrmApi from './services/platformCrm.js'

export const getEnquiries = createAsyncThunk(
  'platformCrm/getEnquiries',
  async (params, { rejectWithValue }) => {
    try {
      const response = await platformCrmApi.fetchEnquiries(params)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch enquiries')
    }
  },
)

export const getEnquiryDetail = createAsyncThunk(
  'platformCrm/getEnquiryDetail',
  async (id, { rejectWithValue }) => {
    try {
      const response = await platformCrmApi.fetchEnquiryById(id)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch enquiry detail')
    }
  },
)

export const updateStatus = createAsyncThunk(
  'platformCrm/updateStatus',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await platformCrmApi.updateEnquiryStatus(id, data)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update status')
    }
  },
)

export const assignExecutive = createAsyncThunk(
  'platformCrm/assignExecutive',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await platformCrmApi.assignEnquiry(id, data)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to assign executive')
    }
  },
)

export const convertToCustomer = createAsyncThunk(
  'platformCrm/convertToCustomer',
  async (id, { rejectWithValue }) => {
    try {
      const response = await platformCrmApi.convertEnquiry(id)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to convert enquiry')
    }
  },
)

export const getActivities = createAsyncThunk(
  'platformCrm/getActivities',
  async (id, { rejectWithValue }) => {
    try {
      const response = await platformCrmApi.fetchActivities(id)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch activities')
    }
  },
)

export const addActivity = createAsyncThunk(
  'platformCrm/addActivity',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await platformCrmApi.createActivity(id, data)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add activity')
    }
  },
)

export const getStageHistory = createAsyncThunk(
  'platformCrm/getStageHistory',
  async (id, { rejectWithValue }) => {
    try {
      const response = await platformCrmApi.fetchStageHistory(id)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch stage history')
    }
  },
)

export const getInsights = createAsyncThunk(
  'platformCrm/getInsights',
  async (id, { rejectWithValue }) => {
    try {
      const response = await platformCrmApi.fetchInsights(id)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch insights')
    }
  },
)

export const updateEnquiryStage = createAsyncThunk(
  'platformCrm/updateEnquiryStage',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await platformCrmApi.updateEnquiryStage(id, data)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update stage')
    }
  },
)

const platformCrmSlice = createSlice({
  name: 'platformCrm',
  initialState: {
    enquiries: [],
    pagination: {
      currentPage: 1,
      limit: 10,
      totalRecords: 0,
      totalPages: 0,
    },
    activeEnquiry: null,
    activities: [],
    stageHistory: [],
    insights: null,
    loading: false,
    error: null,
    actionLoading: false,
    actionSuccess: false,
  },
  reducers: {
    clearActiveEnquiry: (state) => {
      state.activeEnquiry = null
      state.activities = []
      state.stageHistory = []
      state.insights = null
    },
    clearActionState: (state) => {
      state.actionLoading = false
      state.actionSuccess = false
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // getEnquiries
      .addCase(getEnquiries.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getEnquiries.fulfilled, (state, action) => {
        state.loading = false
        state.enquiries = action.payload?.data || []
        state.pagination = action.payload?.pagination || state.pagination
      })
      .addCase(getEnquiries.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // getEnquiryDetail
      .addCase(getEnquiryDetail.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getEnquiryDetail.fulfilled, (state, action) => {
        state.loading = false
        state.activeEnquiry = action.payload?.data || action.payload
      })
      .addCase(getEnquiryDetail.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // updateStatus
      .addCase(updateStatus.pending, (state) => {
        state.actionLoading = true
        state.actionSuccess = false
      })
      .addCase(updateStatus.fulfilled, (state, action) => {
        state.actionLoading = false
        state.actionSuccess = true
        state.activeEnquiry = action.payload?.data || action.payload
      })
      .addCase(updateStatus.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload
      })

      // assignExecutive
      .addCase(assignExecutive.pending, (state) => {
        state.actionLoading = true
        state.actionSuccess = false
      })
      .addCase(assignExecutive.fulfilled, (state, action) => {
        state.actionLoading = false
        state.actionSuccess = true
        state.activeEnquiry = action.payload?.data || action.payload
      })
      .addCase(assignExecutive.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload
      })

      // convertToCustomer
      .addCase(convertToCustomer.pending, (state) => {
        state.actionLoading = true
        state.actionSuccess = false
      })
      .addCase(convertToCustomer.fulfilled, (state, action) => {
        state.actionLoading = false
        state.actionSuccess = true
        state.activeEnquiry = action.payload?.data || action.payload
      })
      .addCase(convertToCustomer.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload
      })

      // 360 View Fetchers
      .addCase(getActivities.fulfilled, (state, action) => {
        state.activities = action.payload?.data || action.payload
      })
      .addCase(addActivity.fulfilled, (state, action) => {
        const newAct = action.payload?.data || action.payload
        state.activities = [newAct, ...state.activities]
      })
      .addCase(getStageHistory.fulfilled, (state, action) => {
        state.stageHistory = action.payload?.data || action.payload
      })
      .addCase(getInsights.fulfilled, (state, action) => {
        state.insights = action.payload?.data || action.payload
      })
      .addCase(updateEnquiryStage.pending, (state) => {
        state.actionLoading = true
      })
      .addCase(updateEnquiryStage.fulfilled, (state, action) => {
        state.actionLoading = false
        state.actionSuccess = true
        state.activeEnquiry = action.payload?.data || action.payload
      })
      .addCase(updateEnquiryStage.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload
      })
  },
})

export const { clearActiveEnquiry, clearActionState } = platformCrmSlice.actions

export default platformCrmSlice.reducer
