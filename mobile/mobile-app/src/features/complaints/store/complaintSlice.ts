import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import complaintService from '../services/complaintService';
import { Complaint, ComplaintDashboardData, AssignTechnicianPayload } from '../types';

interface ComplaintState {
  list: Complaint[];
  pagination: {
    totalRecords: number;
    currentPage: number;
    totalPages: number;
    limit: number;
  };
  currentComplaint: Complaint | null;
  dashboardAnalytics: ComplaintDashboardData | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

export const DEFAULT_MOCK_COMPLAINTS: Complaint[] = [];

const initialState: ComplaintState = {
  list: [],
  pagination: {
    totalRecords: 0,
    currentPage: 1,
    totalPages: 1,
    limit: 10,
  },
  currentComplaint: null,
  dashboardAnalytics: {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    slaBreached: 0,
    byCategory: [],
  } as any,
  status: 'idle',
  error: null,
};

// Helper for extracting API response data cleanly
const extractData = (response: any) => {
  if (!response) return null;
  if (response.success !== undefined) {
    return response.data !== undefined ? response.data : response;
  }
  return response.data || response;
};

// Thunks
export const fetchComplaints = createAsyncThunk(
  'complaints/fetchComplaints',
  async (params: any, { rejectWithValue }) => {
    try {
      const response = await complaintService.getAll(params);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch complaints');
    }
  }
);

export const fetchComplaintDetails = createAsyncThunk(
  'complaints/fetchDetails',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await complaintService.getById(id);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch complaint details');
    }
  }
);

export const createComplaint = createAsyncThunk(
  'complaints/create',
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await complaintService.create(data);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue({
        ...(error.response?.data || {}),
        status: error.response?.status,
        message: error.response?.data?.message || error.message || 'Failed to create complaint',
      });
    }
  }
);

export const assignTechnician = createAsyncThunk(
  'complaints/assignTechnician',
  async ({ id, data }: { id: string; data: AssignTechnicianPayload }, { rejectWithValue }) => {
    try {
      const response = await complaintService.assignTechnician(id, data);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to assign technician');
    }
  }
);

export const acceptAssignment = createAsyncThunk(
  'complaints/acceptAssignment',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await complaintService.acceptAssignment(id);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to accept assignment');
    }
  }
);

export const rejectAssignment = createAsyncThunk(
  'complaints/rejectAssignment',
  async ({ id, reason }: { id: string; reason: string }, { rejectWithValue }) => {
    try {
      const response = await complaintService.rejectAssignment(id, reason);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reject assignment');
    }
  }
);

export const startWork = createAsyncThunk(
  'complaints/startWork',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await complaintService.startWork(id);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to start work');
    }
  }
);

export const pauseWork = createAsyncThunk(
  'complaints/pauseWork',
  async ({ id, reason }: { id: string; reason: string }, { rejectWithValue }) => {
    try {
      const response = await complaintService.pauseWork(id, reason);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to pause work');
    }
  }
);

export const resumeWork = createAsyncThunk(
  'complaints/resumeWork',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await complaintService.resumeWork(id);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to resume work');
    }
  }
);

export const markWorkCompleted = createAsyncThunk(
  'complaints/markWorkCompleted',
  async ({ id, data }: { id: string; data: { notes?: string; attachments?: string[] } }, { rejectWithValue }) => {
    try {
      const response = await complaintService.markWorkCompleted(id, data);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark work as completed');
    }
  }
);

export const confirmCompletion = createAsyncThunk(
  'complaints/confirmCompletion',
  async ({ id, payload }: { id: string; payload?: any }, { rejectWithValue }) => {
    try {
      const response = await complaintService.confirmCompletion(id, payload);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to confirm completion');
    }
  }
);

export const addComplaintComment = createAsyncThunk(
  'complaints/addComment',
  async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
    try {
      const response = await complaintService.addComment(id, data);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add comment');
    }
  }
);

export const addFeedback = createAsyncThunk(
  'complaints/addFeedback',
  async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
    try {
      const response = await complaintService.addFeedback(id, data);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit feedback');
    }
  }
);

export const updateComplaintStatus = createAsyncThunk(
  'complaints/updateStatus',
  async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
    try {
      const response = await complaintService.updateStatus(id, data);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update complaint status');
    }
  }
);

export const fetchDashboardAnalytics = createAsyncThunk(
  'complaints/fetchDashboardAnalytics',
  async (params: any, { rejectWithValue }) => {
    try {
      const response = await complaintService.getDashboardAnalytics(params);
      return extractData(response);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard analytics');
    }
  }
);

export const deleteComplaint = createAsyncThunk(
  'complaints/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await complaintService.delete(id);
      return { id, response: extractData(response) };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete complaint');
    }
  }
);

// Helper function to update complaint in state list & current complaint
const updateItemInState = (state: ComplaintState, item: any) => {
  if (!item || !item._id) return;
  const index = state.list.findIndex((c) => c._id === item._id);
  if (index !== -1) {
    state.list[index] = { ...state.list[index], ...item };
  } else {
    state.list.unshift(item);
  }
  if (state.currentComplaint && state.currentComplaint._id === item._id) {
    state.currentComplaint = { ...state.currentComplaint, ...item };
  }
};

export const complaintSlice = createSlice({
  name: 'complaints',
  initialState,
  reducers: {
    clearComplaintErrors: (state) => {
      state.error = null;
    },
    updateComplaintInList: (state, action) => {
      updateItemInState(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchComplaints
      .addCase(fetchComplaints.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchComplaints.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const incoming = action.payload?.complaints || action.payload || [];
        const requestedPage = Number((action.meta.arg as any)?.page || 1);

        // Keep earlier pages when a list asks for more results, while protecting
        // against overlapping API pages or socket updates creating duplicate cards.
        if (requestedPage > 1) {
          const knownIds = new Set(state.list.map((item: any) => String(item?._id || item?.id || '')));
          state.list.push(
            ...incoming.filter((item: any) => {
              const id = String(item?._id || item?.id || '');
              if (!id || knownIds.has(id)) return false;
              knownIds.add(id);
              return true;
            })
          );
        } else {
          state.list = incoming;
        }
        state.pagination = action.payload?.pagination || {
          ...state.pagination,
          currentPage: requestedPage,
        };
        state.pagination.limit = Number((action.meta.arg as any)?.limit || state.pagination.limit);
      })
      .addCase(fetchComplaints.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as string) || 'Failed to fetch complaints';
      })

      // fetchComplaintDetails
      .addCase(fetchComplaintDetails.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchComplaintDetails.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.currentComplaint = action.payload;
      })
      .addCase(fetchComplaintDetails.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as string) || 'Failed to fetch complaint details';
      })

      // createComplaint
      .addCase(createComplaint.fulfilled, (state, action) => {
        if (action.payload) {
          state.list.unshift(action.payload);
          state.pagination.totalRecords += 1;
        }
      })

      // Update & Action Thunks
      .addCase(assignTechnician.fulfilled, (state, action) => {
        const item = action.payload?.complaint || action.payload;
        updateItemInState(state, item);
      })
      .addCase(acceptAssignment.fulfilled, (state, action) => {
        const item = action.payload?.complaint || action.payload;
        updateItemInState(state, item);
      })
      .addCase(rejectAssignment.fulfilled, (state, action) => {
        const item = action.payload?.complaint || action.payload;
        updateItemInState(state, item);
      })
      .addCase(startWork.fulfilled, (state, action) => {
        const item = action.payload?.complaint || action.payload;
        updateItemInState(state, item);
      })
      .addCase(pauseWork.fulfilled, (state, action) => {
        const item = action.payload?.complaint || action.payload;
        updateItemInState(state, item);
      })
      .addCase(resumeWork.fulfilled, (state, action) => {
        const item = action.payload?.complaint || action.payload;
        updateItemInState(state, item);
      })
      .addCase(markWorkCompleted.fulfilled, (state, action) => {
        const item = action.payload?.complaint || action.payload;
        updateItemInState(state, item);
      })
      .addCase(confirmCompletion.fulfilled, (state, action) => {
        const item = action.payload?.complaint || action.payload;
        updateItemInState(state, item);
      })
      .addCase(updateComplaintStatus.fulfilled, (state, action) => {
        const item = action.payload?.complaint || action.payload;
        updateItemInState(state, item);
      })

      // addComplaintComment
      .addCase(addComplaintComment.fulfilled, (state, action) => {
        const item = action.payload?.complaint || action.payload;
        updateItemInState(state, item);
      })

      // addFeedback
      .addCase(addFeedback.fulfilled, (state, action) => {
        const item = action.payload?.complaint || action.payload;
        updateItemInState(state, item);
      })

      // fetchDashboardAnalytics
      .addCase(fetchDashboardAnalytics.fulfilled, (state, action) => {
        state.dashboardAnalytics = action.payload;
      })
      
      // deleteComplaint
      .addCase(deleteComplaint.fulfilled, (state, action) => {
        const id = action.payload.id;
        state.list = state.list.filter((c) => c._id !== id);
        if (state.currentComplaint && state.currentComplaint._id === id) {
          state.currentComplaint = null;
        }
        state.pagination.totalRecords = Math.max(0, state.pagination.totalRecords - 1);
      });
  },
});

export const { clearComplaintErrors, updateComplaintInList } = complaintSlice.actions;
export default complaintSlice.reducer;
