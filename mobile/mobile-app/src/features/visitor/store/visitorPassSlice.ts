import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import visitorService from '../services/visitorService';
import { WalkInApprovalItem } from '../mocks/visitorMocks';
import { mapBackendWalkInToApprovalItem } from '../utils/mapBackendWalkInToApprovalItem';

import {
  fetchCommunityPasses,
  fetchAdminAnalytics,
  fetchBlacklist,
  addBlacklistEntry,
  removeBlacklistEntry,
  forceRevokeAdminPass,
  forceCheckoutAdminVisitor,
  BlacklistVisitorItem,
  VisitorAnalyticsData,
} from './adminVisitorThunks';

export interface VisitorPass {
  _id: string;
  visitorName: string;
  phone: string;
  purpose?: string;
  validFrom?: string;
  validUntil?: string;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  code?: string;
}

export interface ActiveVisitorLog {
  _id: string;
  id?: string;
  passId?: any;
  visitorName?: string;
  entryType?: string;
  checkInTime?: string;
  logStatus?: string;
  residentId?: any;
  guardId?: any;
  snapshot?: {
    visitorName?: string;
    vehicleNumber?: string;
    idProofNumber?: string;
  };
}

export interface DashboardSummary {
  recentPasses: VisitorPass[];
  activePassesCount: number;
  pendingWalkIns: any[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

export interface WalkInState {
  pendingList: WalkInApprovalItem[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  actionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

export interface AdminVisitorState {
  communityPasses: VisitorPass[];
  blacklist: BlacklistVisitorItem[];
  analytics: VisitorAnalyticsData | null;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    limit: number;
  };
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  actionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

interface VisitorPassState {
  passes: VisitorPass[];
  activePass: VisitorPass | null;
  activeVisitors: ActiveVisitorLog[];
  activeVisitorsStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  dashboard: DashboardSummary;
  walkIns: WalkInState;
  admin: AdminVisitorState;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    limit: number;
  };
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  actionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: VisitorPassState = {
  passes: [],
  activePass: null,
  activeVisitors: [],
  activeVisitorsStatus: 'idle',
  dashboard: {
    recentPasses: [],
    activePassesCount: 0,
    pendingWalkIns: [],
    status: 'idle',
    error: null,
  },
  walkIns: {
    pendingList: [],
    status: 'idle',
    actionStatus: 'idle',
    error: null,
  },
  admin: {
    communityPasses: [],
    blacklist: [],
    analytics: null,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalRecords: 0,
      limit: 10,
    },
    status: 'idle',
    actionStatus: 'idle',
    error: null,
  },
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10,
  },
  status: 'idle',
  actionStatus: 'idle',
  error: null,
};

export const createPass = createAsyncThunk(
  'visitorPass/createPass',
  async (payload: any, { rejectWithValue }) => {
    try {
      const response = await visitorService.createPass(payload);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      return (body?.data || body) as any;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to create visitor pass');
    }
  }
);

export const getPassDetails = createAsyncThunk(
  'visitorPass/getPassDetails',
  async (idOrCode: string, { rejectWithValue }) => {
    try {
      const clean = idOrCode?.trim();
      let response: any;
      if (clean && clean.length < 24) {
        try {
          response = await visitorService.getPassByCode(clean);
        } catch {
          response = await visitorService.getPassDetails(clean);
        }
      } else {
        response = await visitorService.getPassDetails(clean);
      }
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      return (body?.data || body) as any;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to fetch pass details');
    }
  }
);

export const fetchPassByCode = createAsyncThunk(
  'visitorPass/fetchPassByCode',
  async (code: string, { rejectWithValue }) => {
    try {
      const response = await visitorService.getPassByCode(code);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      return (body?.data || body) as any;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to fetch pass details by key code');
    }
  }
);

export const updatePassStatus = createAsyncThunk(
  'visitorPass/updatePassStatus',
  async ({ id, status }: { id: string; status: string }, { rejectWithValue }) => {
    try {
      const response = await visitorService.updatePassStatus(id, status);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      if (body?.data || body?._id) {
        return (body?.data || body) as any;
      }
      return rejectWithValue('Visitor pass update returned no pass data');
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to update visitor pass');
    }
  }
);

export const getPasses = createAsyncThunk(
  'visitorPass/getPasses',
  async ({ orgId, params }: { orgId: string; params?: any }, { rejectWithValue }) => {
    try {
      const page = params?.page || 1;
      const limit = params?.limit || 10;
      const skip = (page - 1) * limit;

      const queryParams: any = { skip, limit };
      if (params?.statuses) {
        queryParams.statuses = params.statuses;
      }
      if (params?.search) {
        queryParams.search = params.search;
      }

      const response = await visitorService.getPasses(orgId, queryParams);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      const innerData = body?.data || body;
      const dataArray = (Array.isArray(innerData) ? innerData : (innerData?.data || [])) as VisitorPass[];
      const totalRecords = typeof innerData?.totalRecords === 'number' ? innerData.totalRecords : dataArray.length;

      return {
        data: dataArray,
        totalRecords,
        page,
        limit,
        append: Boolean(params?.append),
      };
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to fetch passes');
    }
  }
);

export const fetchDashboardSummary = createAsyncThunk(
  'visitorPass/fetchDashboardSummary',
  async (orgId: string, { rejectWithValue }) => {
    try {
      const [passesRes, pendingLogsRes] = await Promise.all([
        visitorService.getPasses(orgId, { skip: 0, limit: 5, statuses: 'ACTIVE,PENDING' }),
        visitorService.getPendingApprovals(orgId),
      ]);

      const passesBody = passesRes && (passesRes as any).success !== undefined ? passesRes : (passesRes as any)?.data;
      const passesInner = passesBody?.data || passesBody;
      const recentPasses = (Array.isArray(passesInner) ? passesInner : (passesInner?.data || [])) as VisitorPass[];
      const activePassesCount = typeof passesInner?.totalRecords === 'number' ? passesInner.totalRecords : recentPasses.length;

      const logsBody = pendingLogsRes && (pendingLogsRes as any).success !== undefined ? pendingLogsRes : (pendingLogsRes as any)?.data;
      const pendingWalkIns = Array.isArray(logsBody?.data || logsBody) ? (logsBody?.data || logsBody) : Array.isArray(logsBody) ? logsBody : [];

      return {
        recentPasses,
        activePassesCount,
        pendingWalkIns,
      };
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to fetch dashboard summary');
    }
  }
);

export const fetchPendingWalkIns = createAsyncThunk(
  'visitorPass/fetchPendingWalkIns',
  async (orgId: string, { rejectWithValue }) => {
    try {
      const response = await visitorService.getPendingApprovals(orgId);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      const logs = Array.isArray(body?.data || body) ? (body?.data || body) : Array.isArray(body) ? body : [];
      const mapped = logs.map((log: any) => mapBackendWalkInToApprovalItem(log));
      return {
        mapped,
        rawLogs: logs,
      };
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to fetch pending walk-ins');
    }
  }
);

export const resolveWalkInRequest = createAsyncThunk(
  'visitorPass/resolveWalkInRequest',
  async ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }, { rejectWithValue }) => {
    try {
      const response = await visitorService.resolveWalkIn(id, action);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      const data = body?.data || body;
      return { id, action, data };
    } catch (error: any) {
      return rejectWithValue(error.message || `Failed to resolve walk-in request as ${action}`);
    }
  }
);

export const fetchActiveVisitorsThunk = createAsyncThunk(
  'visitorPass/fetchActiveVisitors',
  async (orgId: string, { rejectWithValue }) => {
    try {
      const response = await visitorService.getActiveVisitors(orgId);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      const list = Array.isArray(body?.data || body) ? body?.data || body : [];
      return list as ActiveVisitorLog[];
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to fetch active visitors');
    }
  }
);

export const processPreApprovedThunk = createAsyncThunk(
  'visitorPass/processPreApproved',
  async (payload: any, { rejectWithValue }) => {
    try {
      const response = await visitorService.processPreApproved(payload);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      const data = body?.data || body;
      return data as ActiveVisitorLog;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to check in visitor');
    }
  }
);

export const checkoutVisitorThunk = createAsyncThunk(
  'visitorPass/checkoutVisitor',
  async (logId: string, { rejectWithValue }) => {
    try {
      const response = await visitorService.checkoutVisitor(logId);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      const data = body?.data || body;
      return { logId, data };
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to checkout visitor');
    }
  }
);

export const visitorPassSlice = createSlice({
  name: 'visitorPass',
  initialState,
  reducers: {
    clearPassStatus: (state) => {
      state.status = 'idle';
      state.actionStatus = 'idle';
      state.error = null;
      state.walkIns.actionStatus = 'idle';
      state.walkIns.error = null;
    },
    setActivePass: (state, action: PayloadAction<VisitorPass | null>) => {
      state.activePass = action.payload;
    },
    walkInPendingReceived: (
      state,
      action: PayloadAction<{ mappedItem: WalkInApprovalItem; rawLog: any }>
    ) => {
      const { mappedItem, rawLog } = action.payload;
      const targetId = mappedItem.id || rawLog?._id;

      // 1. Update walkIns.pendingList idempotently
      const existingIdx = state.walkIns.pendingList.findIndex(
        (item) => item.id === targetId || (item.rawLog && item.rawLog._id === targetId)
      );
      if (existingIdx !== -1) {
        state.walkIns.pendingList[existingIdx] = mappedItem;
      } else {
        state.walkIns.pendingList.unshift(mappedItem);
      }

      // 2. Update dashboard.pendingWalkIns idempotently
      if (rawLog && rawLog._id) {
        const dashIdx = state.dashboard.pendingWalkIns.findIndex(
          (p) => p._id === rawLog._id || p.id === rawLog._id
        );
        if (dashIdx !== -1) {
          state.dashboard.pendingWalkIns[dashIdx] = rawLog;
        } else {
          state.dashboard.pendingWalkIns.unshift(rawLog);
        }
      }
    },
    walkInResolvedReceived: (state, action: PayloadAction<{ id: string; rawLog?: any }>) => {
      const targetId = action.payload.id;

      // Idempotent removal from pendingList and pendingWalkIns
      state.walkIns.pendingList = state.walkIns.pendingList.filter(
        (item) => item.id !== targetId && item.rawLog?._id !== targetId
      );

      state.dashboard.pendingWalkIns = state.dashboard.pendingWalkIns.filter(
        (p) => p._id !== targetId && p.id !== targetId
      );

      // Add to activeVisitors if the action was APPROVE and we have the log
      const updatedLog = action.payload.rawLog;
      if (updatedLog && updatedLog.logStatus === 'INSIDE') {
        const logId = updatedLog._id || updatedLog.id;
        const exists = state.activeVisitors.some(l => (l._id || l.id) === logId);
        if (!exists) {
          state.activeVisitors.unshift(updatedLog);
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // getPasses
      .addCase(getPasses.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(getPasses.fulfilled, (state, action) => {
        state.status = 'succeeded';
        if (action.payload.append) {
          const existingIds = new Set(state.passes.map((p) => p._id));
          const newPasses = (action.payload.data || []).filter((p) => !existingIds.has(p._id));
          state.passes = [...state.passes, ...newPasses];
        } else {
          state.passes = action.payload.data || [];
        }
        state.pagination.totalRecords = action.payload.totalRecords || 0;
        state.pagination.limit = action.payload.limit;
        state.pagination.currentPage = action.payload.page;
        state.pagination.totalPages = Math.max(
          1,
          Math.ceil((action.payload.totalRecords || 0) / action.payload.limit)
        );
      })
      .addCase(getPasses.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as string) || 'Failed to fetch passes';
      })

      // fetchDashboardSummary
      .addCase(fetchDashboardSummary.pending, (state) => {
        state.dashboard.status = 'loading';
        state.dashboard.error = null;
      })
      .addCase(fetchDashboardSummary.fulfilled, (state, action) => {
        state.dashboard.status = 'succeeded';
        state.dashboard.recentPasses = action.payload.recentPasses;
        state.dashboard.activePassesCount = action.payload.activePassesCount;
        state.dashboard.pendingWalkIns = action.payload.pendingWalkIns;
      })
      .addCase(fetchDashboardSummary.rejected, (state, action) => {
        state.dashboard.status = 'failed';
        state.dashboard.error = (action.payload as string) || 'Failed to fetch dashboard summary';
      })

      // fetchPendingWalkIns
      .addCase(fetchPendingWalkIns.pending, (state) => {
        state.walkIns.status = 'loading';
        state.walkIns.error = null;
      })
      .addCase(fetchPendingWalkIns.fulfilled, (state, action) => {
        state.walkIns.status = 'succeeded';
        state.walkIns.pendingList = action.payload.mapped;
        state.dashboard.pendingWalkIns = action.payload.rawLogs;
      })
      .addCase(fetchPendingWalkIns.rejected, (state, action) => {
        state.walkIns.status = 'failed';
        state.walkIns.error = (action.payload as string) || 'Failed to fetch pending walk-ins';
      })

      // resolveWalkInRequest
      .addCase(resolveWalkInRequest.pending, (state) => {
        state.walkIns.actionStatus = 'loading';
        state.walkIns.error = null;
      })
      .addCase(resolveWalkInRequest.fulfilled, (state, action) => {
        state.walkIns.actionStatus = 'succeeded';
        const targetId = action.payload.id;

        state.walkIns.pendingList = state.walkIns.pendingList.filter(
          (item) => item.id !== targetId && item.rawLog?._id !== targetId
        );

        state.dashboard.pendingWalkIns = state.dashboard.pendingWalkIns.filter(
          (p) => p._id !== targetId && p.id !== targetId
        );

        // Add to activeVisitors if approved
        const updatedLog = action.payload.data;
        if (updatedLog && updatedLog.logStatus === 'INSIDE') {
          const logId = updatedLog._id || updatedLog.id;
          const exists = state.activeVisitors.some(l => (l._id || l.id) === logId);
          if (!exists) {
            state.activeVisitors.unshift(updatedLog);
          }
        }
      })
      .addCase(resolveWalkInRequest.rejected, (state, action) => {
        state.walkIns.actionStatus = 'failed';
        state.walkIns.error = (action.payload as string) || 'Failed to resolve walk-in request';
      })

      // getPassDetails
      .addCase(getPassDetails.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(getPassDetails.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.activePass = action.payload;
        const index = state.passes.findIndex((pass) => pass._id === action.payload._id);
        if (index !== -1) {
          state.passes[index] = action.payload;
        } else {
          state.passes.unshift(action.payload);
        }
      })
      .addCase(getPassDetails.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as string) || 'Failed to fetch pass details';
      })

      // fetchPassByCode
      .addCase(fetchPassByCode.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPassByCode.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.activePass = action.payload;
        const index = state.passes.findIndex((pass) => pass._id === action.payload._id);
        if (index !== -1) {
          state.passes[index] = action.payload;
        } else {
          state.passes.unshift(action.payload);
        }
      })
      .addCase(fetchPassByCode.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as string) || 'Failed to fetch pass details by key code';
      })

      // createPass
      .addCase(createPass.pending, (state) => {
        state.actionStatus = 'loading';
        state.error = null;
      })
      .addCase(createPass.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.passes.unshift(action.payload);
        state.activePass = action.payload;
        state.dashboard.recentPasses.unshift(action.payload);
        state.dashboard.activePassesCount += 1;
      })
      .addCase(createPass.rejected, (state, action) => {
        state.actionStatus = 'failed';
        state.error = (action.payload as string) || 'Failed to create visitor pass';
      })

      // updatePassStatus
      .addCase(updatePassStatus.pending, (state) => {
        state.actionStatus = 'loading';
        state.error = null;
      })
      .addCase(updatePassStatus.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        const updatedPass = action.payload;
        const targetId = updatedPass._id || (updatedPass as any).id;

        let previousStatus: string | undefined = undefined;

        // 1. Update state.passes
        const index = state.passes.findIndex(
          (pass) => pass._id === targetId || (pass as any).id === targetId
        );
        if (index !== -1) {
          previousStatus = state.passes[index].status;
          state.passes[index] = { ...state.passes[index], ...updatedPass };
        }

        // 2. Update state.activePass
        if (
          state.activePass &&
          (state.activePass._id === targetId || (state.activePass as any).id === targetId)
        ) {
          state.activePass = { ...state.activePass, ...updatedPass };
        }

        // 3. Synchronize state.dashboard
        const dashIdx = state.dashboard.recentPasses.findIndex(
          (pass) => pass._id === targetId || (pass as any).id === targetId
        );
        if (dashIdx !== -1) {
          previousStatus = previousStatus || state.dashboard.recentPasses[dashIdx].status;
          if (updatedPass.status !== 'ACTIVE') {
            state.dashboard.recentPasses.splice(dashIdx, 1);
          } else {
            state.dashboard.recentPasses[dashIdx] = {
              ...state.dashboard.recentPasses[dashIdx],
              ...updatedPass,
            };
          }
        }

        // Decrement dashboard activePassesCount ONLY IF the pass was previously ACTIVE
        if (previousStatus === 'ACTIVE' && updatedPass.status !== 'ACTIVE') {
          state.dashboard.activePassesCount = Math.max(0, state.dashboard.activePassesCount - 1);
        }
      })
      .addCase(updatePassStatus.rejected, (state, action) => {
        state.actionStatus = 'failed';
        state.error = (action.payload as string) || 'Failed to update pass status';
      })

      // Admin fetchCommunityPasses
      .addCase(fetchCommunityPasses.pending, (state) => {
        state.admin.status = 'loading';
        state.admin.error = null;
      })
      .addCase(fetchCommunityPasses.fulfilled, (state, action) => {
        state.admin.status = 'succeeded';
        if (action.payload.append) {
          const existingIds = new Set(state.admin.communityPasses.map((p: VisitorPass) => p._id));
          const newPasses = (action.payload.data || []).filter((p: VisitorPass) => !existingIds.has(p._id));
          state.admin.communityPasses = [...state.admin.communityPasses, ...newPasses];
        } else {
          state.admin.communityPasses = action.payload.data || [];
        }
        state.admin.pagination.totalRecords = action.payload.totalRecords || 0;
        state.admin.pagination.limit = action.payload.limit;
        state.admin.pagination.currentPage = action.payload.page;
        state.admin.pagination.totalPages = Math.max(
          1,
          Math.ceil((action.payload.totalRecords || 0) / action.payload.limit)
        );
      })
      .addCase(fetchCommunityPasses.rejected, (state, action) => {
        state.admin.status = 'failed';
        state.admin.error = (action.payload as string) || 'Failed to fetch community passes';
      })

      // Admin fetchAdminAnalytics
      .addCase(fetchAdminAnalytics.fulfilled, (state, action) => {
        state.admin.analytics = action.payload;
      })

      // Admin fetchBlacklist
      .addCase(fetchBlacklist.fulfilled, (state, action) => {
        state.admin.blacklist = action.payload;
      })

      // Admin addBlacklistEntry
      .addCase(addBlacklistEntry.fulfilled, (state, action) => {
        state.admin.blacklist.unshift(action.payload);
      })

      // Admin removeBlacklistEntry
      .addCase(removeBlacklistEntry.fulfilled, (state, action) => {
        state.admin.blacklist = state.admin.blacklist.filter((b: BlacklistVisitorItem) => b._id !== action.payload);
      })

      // Admin forceRevokeAdminPass
      .addCase(forceRevokeAdminPass.fulfilled, (state, action) => {
        const targetId = action.payload._id || action.payload.id;
        const idx = state.admin.communityPasses.findIndex((p: VisitorPass) => p._id === targetId);
        if (idx !== -1) {
          state.admin.communityPasses[idx].status = 'REVOKED';
        }
      })

      // fetchActiveVisitorsThunk
      .addCase(fetchActiveVisitorsThunk.pending, (state) => {
        state.activeVisitorsStatus = 'loading';
      })
      .addCase(fetchActiveVisitorsThunk.fulfilled, (state, action) => {
        state.activeVisitorsStatus = 'succeeded';
        state.activeVisitors = action.payload || [];
      })
      .addCase(fetchActiveVisitorsThunk.rejected, (state) => {
        state.activeVisitorsStatus = 'failed';
      })

      // processPreApprovedThunk
      .addCase(processPreApprovedThunk.fulfilled, (state, action) => {
        const newLog = action.payload;
        if (newLog) {
          const logId = newLog._id || newLog.id;
          const exists = state.activeVisitors.some((l) => (l._id || l.id) === logId);
          if (!exists) {
            state.activeVisitors.unshift(newLog);
          }
        }
      })

      // checkoutVisitorThunk
      .addCase(checkoutVisitorThunk.fulfilled, (state, action) => {
        const logId = action.payload.logId;
        state.activeVisitors = state.activeVisitors.filter((l) => (l._id || l.id) !== logId);
      });
  },
});

export const {
  clearPassStatus,
  setActivePass,
  walkInPendingReceived,
  walkInResolvedReceived,
} = visitorPassSlice.actions;

export default visitorPassSlice.reducer;
