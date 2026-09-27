import { createAsyncThunk } from '@reduxjs/toolkit';
import visitorAdminService from '../services/visitorAdminService';
import apiClient from '../../../services/apiClient';
import { mapBackendWalkInToApprovalItem } from '../utils/mapBackendWalkInToApprovalItem';
import { toListPass } from '../utils/mapBackendPassToHistoryItem';
import { computeGateAnalytics, HourlyArrivalPoint, WeeklyDensityCell } from '../utils/computeGateAnalytics';

export interface BlacklistVisitorItem {
  _id: string;
  visitorName: string;
  phone?: string;
  idProofNumber?: string;
  reason: string;
  blacklistedByName?: string;
  createdAt: string;
}

export interface VisitorAnalyticsData {
  totalEntriesToday: number;
  activeInsideCount: number;
  pendingApprovalsCount: number;
  totalBlacklistedCount: number;
  peakHour: string;
  categoryDistribution: Array<{ category: string; count: number }>;
  hourlyArrivals: HourlyArrivalPoint[];
  weeklyDensity: WeeklyDensityCell[];
}

export const fetchCommunityPasses = createAsyncThunk(
  'visitorPass/fetchCommunityPasses',
  async ({ orgId, params }: { orgId: string; params?: any }, { rejectWithValue }) => {
    try {
      const page = params?.page || 1;
      const limit = params?.limit || 10;
      const skip = (page - 1) * limit;

      const queryParams = { ...params, skip, limit };
      const response = await visitorAdminService.getCommunityPasses(orgId, queryParams);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      const innerData = body?.data || body;
      const dataArray = Array.isArray(innerData) ? innerData : innerData?.data || [];
      const totalRecords = typeof innerData?.totalRecords === 'number' ? innerData.totalRecords : dataArray.length;

      return {
        data: dataArray.map(toListPass),
        totalRecords,
        page,
        limit,
        append: Boolean(params?.append),
      };
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to fetch community passes');
    }
  }
);

export const fetchAdminAnalytics = createAsyncThunk(
  'visitorPass/fetchAdminAnalytics',
  async (orgId: string, { rejectWithValue }) => {
    try {
      const [insideRes, pendingRes, blacklistRes, historyRes] = await Promise.allSettled([
        visitorAdminService.getGateAnalytics(orgId),
        visitorAdminService.getAllPendingWalkIns(orgId),
        visitorAdminService.getBlacklist(orgId),
        // Recent logs (newest first) are the source for today's entries, hourly traffic and the weekly heatmap.
        apiClient.get(`/visitor-log/org/${orgId}`, { params: { skip: 0, limit: 500 } }),
      ]);

      const unwrap = (res: PromiseSettledResult<any>, fallback: any) =>
        res.status === 'fulfilled' ? (res.value?.data?.data ?? res.value?.data ?? fallback) : fallback;
      const insideData = unwrap(insideRes, []);
      const pendingData = unwrap(pendingRes, []);
      const blacklistData = unwrap(blacklistRes, {});
      const historyData = unwrap(historyRes, {});

      const blacklistRows = Array.isArray(blacklistData) ? blacklistData : blacklistData?.data || [];
      const historyRows = Array.isArray(historyData) ? historyData : historyData?.data || [];

      const analyticsData: VisitorAnalyticsData = {
        activeInsideCount: Array.isArray(insideData) ? insideData.length : 0,
        pendingApprovalsCount: Array.isArray(pendingData) ? pendingData.length : 0,
        totalBlacklistedCount:
          typeof blacklistData?.totalRecords === 'number' ? blacklistData.totalRecords : blacklistRows.length,
        ...computeGateAnalytics(historyRows),
      };
      return analyticsData;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to fetch gate analytics');
    }
  }
);

export const fetchBlacklist = createAsyncThunk(
  'visitorPass/fetchBlacklist',
  async (orgId: string, { rejectWithValue }) => {
    try {
      const response = await visitorAdminService.getBlacklist(orgId);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      const rawData = body?.data?.data || body?.data || body;
      const dataArray = Array.isArray(rawData) ? rawData : [];
      return dataArray.map((item: any) => ({
        ...item,
        visitorName: item.name || item.visitorName,
        plate: item.plate || item.vehicleNumber,
      })) as BlacklistVisitorItem[];
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to fetch blacklist');
    }
  }
);

export const addBlacklistEntry = createAsyncThunk(
  'visitorPass/addBlacklistEntry',
  async (
    payload: { orgId: string; visitorName?: string; name?: string; phone?: string; idProofNumber?: string; plate?: string; vehicleNumber?: string; reason: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await visitorAdminService.addToBlacklist(payload);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      const rawItem = body?.data?.data || body?.data || body;
      return {
        ...rawItem,
        visitorName: rawItem?.name || rawItem?.visitorName || payload.visitorName || payload.name,
        plate: rawItem?.plate || rawItem?.vehicleNumber || payload.plate || payload.vehicleNumber,
      };
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to add to blacklist');
    }
  }
);

export const removeBlacklistEntry = createAsyncThunk(
  'visitorPass/removeBlacklistEntry',
  async (id: string, { rejectWithValue }) => {
    try {
      await visitorAdminService.removeFromBlacklist(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to remove from blacklist');
    }
  }
);

export const forceRevokeAdminPass = createAsyncThunk(
  'visitorPass/forceRevokeAdminPass',
  async ({ id, reason }: { id: string; reason: string }, { rejectWithValue }) => {
    try {
      const response = await visitorAdminService.forceRevokePass(id, reason);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      return body?.data || body || { id, status: 'REVOKED' };
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to force revoke pass');
    }
  }
);

export const forceCheckoutAdminVisitor = createAsyncThunk(
  'visitorPass/forceCheckoutAdminVisitor',
  async ({ logId, reason }: { logId: string; reason?: string }, { rejectWithValue }) => {
    try {
      const response = await visitorAdminService.forceCheckoutVisitor(logId, reason);
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      return body?.data || body || { logId };
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to force checkout visitor');
    }
  }
);
