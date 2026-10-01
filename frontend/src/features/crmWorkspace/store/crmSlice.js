import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import crmApi from '../services/crmApi.js'

// --- Async Thunks ---

export const fetchInquiries = createAsyncThunk(
  'crmWorkspace/fetchInquiries',
  async (params, { rejectWithValue }) => {
    try {
      const response = await crmApi.getInquiries(params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch inquiries')
    }
  },
)

export const fetchInquiryById = createAsyncThunk(
  'crmWorkspace/fetchInquiryById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await crmApi.getInquiryById(id)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch inquiry details')
    }
  },
)

export const createInquiry = createAsyncThunk(
  'crmWorkspace/createInquiry',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await crmApi.createInquiry(payload)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create inquiry')
    }
  },
)

export const updateInquiry = createAsyncThunk(
  'crmWorkspace/updateInquiry',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await crmApi.updateInquiry(id, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update inquiry')
    }
  },
)

export const transitionInquiryStatus = createAsyncThunk(
  'crmWorkspace/transitionInquiryStatus',
  async ({ id, nextStatus, metadata }, { rejectWithValue }) => {
    try {
      const response = await crmApi.transitionInquiryStatus(id, nextStatus, metadata)
      return response.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Status transition failed',
      )
    }
  },
)

export const fetchInquiryTimeline = createAsyncThunk(
  'crmWorkspace/fetchInquiryTimeline',
  async (id, { rejectWithValue }) => {
    try {
      const response = await crmApi.getInquiryTimeline(id)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch timeline')
    }
  },
)

export const fetchInquirySummary = createAsyncThunk(
  'crmWorkspace/fetchInquirySummary',
  async (id, { rejectWithValue }) => {
    try {
      const response = await crmApi.getInquirySummary(id)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch inquiry summary')
    }
  },
)

export const assignInquiry = createAsyncThunk(
  'crmWorkspace/assignInquiry',
  async ({ inquiryId, userId }, { rejectWithValue }) => {
    try {
      const response = await crmApi.assignInquiry(inquiryId, userId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to assign inquiry')
    }
  },
)

export const checkAvailability = createAsyncThunk(
  'crmWorkspace/checkAvailability',
  async ({ userIds, startTime, endTime, excludeMeetingId }, { rejectWithValue }) => {
    try {
      const response = await crmApi.checkPlatformUserAvailability(
        userIds,
        startTime,
        endTime,
        excludeMeetingId,
      )
      return response.data
    } catch (error) {
      return rejectWithValue(
        error.message || 'Platform users are not available for this time window',
      )
    }
  },
)

export const fetchTasks = createAsyncThunk(
  'crmWorkspace/fetchTasks',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await crmApi.getTasks(params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch tasks')
    }
  },
)

export const createTask = createAsyncThunk(
  'crmWorkspace/createTask',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await crmApi.createTask(payload)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create task')
    }
  },
)

export const updateTask = createAsyncThunk(
  'crmWorkspace/updateTask',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await crmApi.updateTask(id, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update task')
    }
  },
)

export const fetchMeetings = createAsyncThunk(
  'crmWorkspace/fetchMeetings',
  async (params, { rejectWithValue }) => {
    try {
      const response = await crmApi.getMeetings(params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch meetings')
    }
  },
)

export const scheduleMeeting = createAsyncThunk(
  'crmWorkspace/scheduleMeeting',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await crmApi.scheduleMeeting(payload)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to schedule meeting')
    }
  },
)

export const fetchThread = createAsyncThunk(
  'crmWorkspace/fetchThread',
  async (inquiryId, { rejectWithValue }) => {
    try {
      const response = await crmApi.getThreadByInquiryId(inquiryId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch thread')
    }
  },
)

export const sendThreadMessage = createAsyncThunk(
  'crmWorkspace/sendThreadMessage',
  async ({ inquiryId, messageData }, { rejectWithValue }) => {
    try {
      const response = await crmApi.sendThreadMessage(inquiryId, messageData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to send message')
    }
  },
)

// --- Slice Definition ---

const initialState = {
  activeInquiry: null,
  inquiries: [],
  tasks: [],
  meetings: [],
  timeline: [],
  summary: null,
  activeThread: null,
  pagination: { currentPage: 1, totalPages: 1, totalRecords: 0 },
  taskPagination: { currentPage: 1, totalPages: 1, totalRecords: 0 },
  activeTab: 'Overview',
  loading: false,
  statusTransitionLoading: false,
  taskLoading: false,
  error: null,
}

const crmSlice = createSlice({
  name: 'crmWorkspace',
  initialState,
  reducers: {
    setActiveTab(state, action) {
      state.activeTab = action.payload
    },
    setActiveInquiry(state, action) {
      state.activeInquiry = action.payload
    },
    clearCrmError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchInquiries
      .addCase(fetchInquiries.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchInquiries.fulfilled, (state, action) => {
        state.loading = false
        state.inquiries = action.payload.data || []
        state.pagination = {
          currentPage: action.payload.currentPage || 1,
          totalPages: action.payload.totalPages || 1,
          totalRecords: action.payload.totalRecords || 0,
        }
      })
      .addCase(fetchInquiries.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // fetchInquiryById
      .addCase(fetchInquiryById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchInquiryById.fulfilled, (state, action) => {
        state.loading = false
        state.activeInquiry = action.payload
      })
      .addCase(fetchInquiryById.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // transitionInquiryStatus
      .addCase(transitionInquiryStatus.pending, (state) => {
        state.statusTransitionLoading = true
        state.error = null
      })
      .addCase(transitionInquiryStatus.fulfilled, (state, action) => {
        state.statusTransitionLoading = false
        state.activeInquiry = action.payload
        const index = state.inquiries.findIndex(
          (i) => i._id === action.payload._id || i.inquiryId === action.payload.inquiryId,
        )
        if (index !== -1) {
          state.inquiries[index] = action.payload
        }
      })
      .addCase(transitionInquiryStatus.rejected, (state, action) => {
        state.statusTransitionLoading = false
        state.error = action.payload
      })

      // fetchInquiryTimeline
      .addCase(fetchInquiryTimeline.fulfilled, (state, action) => {
        state.timeline = action.payload.data || action.payload || []
      })

      // fetchInquirySummary
      .addCase(fetchInquirySummary.fulfilled, (state, action) => {
        state.summary = action.payload
      })

      // createInquiry
      .addCase(createInquiry.fulfilled, (state, action) => {
        state.inquiries.unshift(action.payload)
        state.activeInquiry = action.payload
      })

      // updateInquiry
      .addCase(updateInquiry.fulfilled, (state, action) => {
        const index = state.inquiries.findIndex((i) => i._id === action.payload._id)
        if (index !== -1) {
          state.inquiries[index] = action.payload
        }
        if (state.activeInquiry?._id === action.payload._id) {
          state.activeInquiry = action.payload
        }
      })

      // fetchTasks
      .addCase(fetchTasks.pending, (state) => {
        state.taskLoading = true
        state.error = null
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.taskLoading = false
        state.tasks = action.payload.data || []
        state.taskPagination = {
          currentPage: action.payload.currentPage || 1,
          totalPages: action.payload.totalPages || 1,
          totalRecords: action.payload.totalRecords || 0,
        }
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.taskLoading = false
        state.error = action.payload
      })

      // createTask
      .addCase(createTask.fulfilled, (state, action) => {
        state.tasks.unshift(action.payload)
      })

      // updateTask
      .addCase(updateTask.fulfilled, (state, action) => {
        const index = state.tasks.findIndex((t) => t._id === action.payload._id)
        if (index !== -1) {
          state.tasks[index] = action.payload
        }
      })

      // fetchMeetings
      .addCase(fetchMeetings.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchMeetings.fulfilled, (state, action) => {
        state.loading = false
        state.meetings = action.payload.data || []
      })
      .addCase(fetchMeetings.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // scheduleMeeting
      .addCase(scheduleMeeting.fulfilled, (state, action) => {
        state.meetings.push(action.payload)
      })

      // fetchThread
      .addCase(fetchThread.fulfilled, (state, action) => {
        state.activeThread = action.payload
      })

      // sendThreadMessage
      .addCase(sendThreadMessage.fulfilled, (state, action) => {
        state.activeThread = action.payload
      })
  },
})

export const { setActiveTab, setActiveInquiry, clearCrmError } = crmSlice.actions

export default crmSlice.reducer
