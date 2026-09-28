import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import amenityService, { CreateBookingPayload, CheckInPayload } from '../services/amenityService';
import amenityManagementService from '../services/amenityManagementService';
import { PaginationMeta } from './amenitySlice';
import {
  AmenityHoldState,
  AmenityReservation,
  AmenityAccessPass,
  AmenityPricingSnapshot,
  AmenityAvailabilityResult,
  AmenityErrorDetails,
  AmenityCancellationPreview,
  AmenityCheckOutResult,
  AmenityFacility,
} from '../types/amenityDomain.types';
import {
  CreateHoldApiPayload,
  ConfirmReservationApiPayload,
  CalculatePricingApiPayload,
  CancelReservationApiPayload,
  CheckInPassApiPayload,
  CheckOutPassApiPayload,
  RevokePassApiPayload,
} from '../types/amenityApi.types';
import {
  normalizeHoldFromApi,
  normalizeReservationFromApi,
  normalizeAccessPassFromApi,
  normalizePricingSnapshot,
  normalizeAvailabilityFromApi,
  normalizeFacilityFromApi,
} from '../utils/amenityPayloadMappers';
import { mapAmenityApiError } from '../utils/amenityErrorMapper';

export interface AmenityBooking {
  _id: string;
  bookingId?: string;
  reservationNumber?: string;
  userId?: any;
  amenityId: string | { _id: string; name: string; category?: string; location?: string; images?: string[] };
  amenityName?: string;
  amenityLocation?: string;
  resourceId?: string | null;
  resourceName?: string | null;
  type?: 'booking' | 'maintenance' | string;
  residentId?: string | null;
  residentName?: string;
  userName?: string;
  villaNumber?: string;
  date: string;
  bookingDate?: string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
  qrCode?: string;
  passCode?: string;
  paymentMethod?: 'WALLET' | 'PAY_AT_GATE' | 'ONLINE' | string;
  paymentStatus?: 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'NOT_REQUIRED' | 'REFUNDED' | 'FAILED' | string;
  totalFee?: number;
  totalPrice?: number;
  pricingDetails?: { totalAmount?: number; [key: string]: unknown };
  bookingAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  depositAmount?: number;
  guestsCount?: number;
  numberOfPersons?: number;
  qrStatus?: 'active' | 'expired' | 'revoked' | string;
  checkInStatus?: string;
  checkInTime?: string;
  checkOutTime?: string;
  cancellationReason?: string;
  paymentId?: string;
  razorpayTransactionId?: string;
  createdAt?: string;
  subtitle?: string;
}

export const normalizeAmenityBooking = (raw: any): AmenityBooking => {
  if (!raw) return raw;

  const date = raw.bookingDate || raw.date || '';
  const guestsCount = raw.numberOfPersons ?? raw.guestsCount ?? 1;
  const totalFee = Number(
    raw.pricingDetails?.totalAmount ??
    raw.totalFee ??
    raw.totalPrice ??
    raw.totalAmount ??
    raw.amount ??
    raw.price ??
    0
  );

  const rawStatus = String(raw.status || 'CONFIRMED').toUpperCase().replace('-', '_');
  const status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' =
    rawStatus === 'CHECKED_IN' ? 'CHECKED_IN' :
    rawStatus === 'COMPLETED' ? 'COMPLETED' :
    rawStatus === 'CANCELLED' || rawStatus === 'REJECTED' ? 'CANCELLED' :
    rawStatus === 'PENDING' || rawStatus === 'PENDING_APPROVAL' ? 'PENDING' : 'CONFIRMED';

  const userObj = typeof raw.userId === 'object' && raw.userId ? raw.userId : null;
  const residentName = raw.residentName || userObj?.name || userObj?.username || raw.userName || 'Community Resident';
  const villaNumber = raw.villaNumber || raw.flatNumber || userObj?.villaNumber || userObj?.flatNumber || userObj?.unit || '';

  const amenityObj = typeof raw.amenityId === 'object' && raw.amenityId ? raw.amenityId : null;
  const amenityName = amenityObj?.name || raw.amenityName || raw.amenity?.name || 'Amenity Pass';
  const amenityLocation = amenityObj?.location || raw.location || raw.amenity?.location || 'Community Facility';

  const rawPaymentStatus = String(raw.paymentStatus || 'SUCCESS').toUpperCase();
  const paymentStatus =
    rawPaymentStatus === 'REFUNDED' ? 'REFUNDED' :
    rawPaymentStatus === 'FAILED' ? 'FAILED' :
    rawPaymentStatus === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' :
    rawPaymentStatus === 'PENDING' ? 'PENDING' :
    rawPaymentStatus === 'NOT_REQUIRED' || rawPaymentStatus === 'NOT_APPLICABLE' ? 'NOT_REQUIRED' :
    'PAID';

  const startTime = raw.start || raw.startTime || '00:00';
  const endTime = raw.end || raw.endTime || '00:00';

  return {
    ...raw,
    _id: String(raw._id || raw.id || raw.bookingId || ''),
    bookingId: String(raw.bookingId || raw._id || ''),
    reservationNumber: raw.reservationNumber,
    date,
    bookingDate: date,
    startTime,
    endTime,
    status,
    guestsCount,
    numberOfPersons: guestsCount,
    totalFee,
    residentName,
    villaNumber,
    flatNumber: villaNumber,
    amenityName,
    amenityLocation,
    resourceId: raw.resourceId ? String(raw.resourceId?._id || raw.resourceId) : undefined,
    resourceName: raw.resourceName || undefined,
    type: raw.type || 'booking',
    paymentMethod: raw.paymentMethod || 'ONLINE',
    paymentStatus,
    bookingAmount: raw.bookingAmount ?? totalFee,
    paidAmount: raw.paidAmount ?? (paymentStatus === 'PAID' ? totalFee : 0),
    remainingAmount: raw.remainingAmount ?? 0,
    depositAmount: raw.depositAmount ?? 0,
    qrCode: raw.qrCode || raw.passCode || raw.bookingId || raw._id,
    qrStatus: raw.qrStatus || 'active',
    checkInTime: raw.checkInTime,
    checkOutTime: raw.checkOutTime,
  };
};

export interface CheckInResult {
  success: boolean;
  status: 'SUCCESS' | 'INVALID' | 'EXPIRED';
  message: string;
  booking?: AmenityBooking;
}

export interface AmenityBookingState {
  // Legacy Booking State
  myBookings: AmenityBooking[];
  adminBookings: AmenityBooking[];
  recentScans: any[];
  dashboardStats: any;
  activePass: AmenityBooking | null;
  checkInResult: CheckInResult | null;
  pagination: PaginationMeta;
  loading: boolean;
  creatingBooking: boolean;
  checkingIn: boolean;
  error: string | null;
  isOCCError: boolean;
  occErrorMessage: string | null;
  successMsg: string | null;

  // v2 Frozen Backend State
  activeHold: AmenityHoldState | null;
  v2Reservations: AmenityReservation[];
  v2CurrentReservation: AmenityReservation | null;
  v2AccessPasses: AmenityAccessPass[];
  v2PricingCalculation: AmenityPricingSnapshot | null;
  v2Availability: AmenityAvailabilityResult | null;
  v2Loading: boolean;
  v2Holding: boolean;
  v2Confirming: boolean;
  v2Error: AmenityErrorDetails | null;

  // v2 Guard Pass State
  v2CheckInResult: AmenityAccessPass | null;
  v2CheckOutResult: AmenityCheckOutResult | null;
  v2PassActionLoading: boolean;
  v2PassError: AmenityErrorDetails | null;

  // Master Ledger Summary Stats
  ledgerSummary: any;
  amenitySummary: any[];

  // Staff booking queue (V2)
  adminQueue: {
    items: AmenityReservation[];
    pagination: PaginationMeta;
    tab: AdminQueueTab;
    search: string;
    counts: { approvals: number; review: number };
    loading: boolean;
    error: string | null;
  };

  // Amenity ledger (V2 bookings with their money)
  ledger: {
    items: AmenityBooking[];
    pagination: PaginationMeta;
    summary: AmenityLedgerSummary | null;
    view: AmenityLedgerView;
    search: string;
    loading: boolean;
    error: string | null;
  };

  // Published facilities staff can book for a resident
  bookableFacilities: AmenityFacility[];
  bookableFacilitiesLoading: boolean;
}

export type AdminQueueTab = 'APPROVALS' | 'REVIEW' | 'UPCOMING' | 'ALL';

/** Ledger pills: which bookings' money to show. */
export type AmenityLedgerView = 'ALL' | 'PAID' | 'DUE' | 'REFUNDED' | 'CANCELLED';

export interface AmenityLedgerSummary {
  totalRevenue: number;
  todayRevenue: number;
  totalBookings: number;
  paidBookings: number;
  pendingPayments: number;
  refundedAmount: number;
  cancelledBookings: number;
}

/** Server filters for each ledger pill. */
export const LEDGER_VIEW_FILTERS: Record<AmenityLedgerView, Record<string, any>> = {
  ALL: {},
  PAID: { paymentStatus: 'PAID' },
  DUE: { balanceDue: true },
  REFUNDED: { paymentStatus: 'REFUNDED' },
  CANCELLED: { status: 'CANCELLED' },
};

/** Server filters for each staff queue tab. */
export const ADMIN_QUEUE_FILTERS: Record<AdminQueueTab, Record<string, string>> = {
  APPROVALS: { bookingStatus: 'PENDING_APPROVAL' },
  REVIEW: { adminReviewStatus: 'PENDING' },
  UPCOMING: { bookingStatus: 'CONFIRMED' },
  ALL: {},
};

/** The API returns total/page/limit/totalPages at the top level of the list payload. */
const paginationFromPayload = (payload: any, fallbackCount: number): PaginationMeta => {
  const p = payload?.pagination || payload || {};
  const limit = Number(p.limit) || 10;
  const total = Number(p.total ?? p.totalRecords ?? fallbackCount) || 0;
  return {
    currentPage: Number(p.page ?? p.currentPage) || 1,
    totalPages: Number(p.totalPages ?? p.pages) || Math.max(1, Math.ceil(total / limit)),
    totalRecords: total,
    limit,
  };
};

const initialState: AmenityBookingState = {
  // Legacy
  myBookings: [],
  adminBookings: [],
  recentScans: [],
  dashboardStats: null,
  activePass: null,
  checkInResult: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10,
  },
  loading: false,
  creatingBooking: false,
  checkingIn: false,
  error: null,
  isOCCError: false,
  occErrorMessage: null,
  successMsg: null,

  // v2
  activeHold: null,
  v2Reservations: [],
  v2CurrentReservation: null,
  v2AccessPasses: [],
  v2PricingCalculation: null,
  v2Availability: null,
  v2Loading: false,
  v2Holding: false,
  v2Confirming: false,
  v2Error: null,

  // v2 Guard Pass State
  v2CheckInResult: null,
  v2CheckOutResult: null,
  v2PassActionLoading: false,
  v2PassError: null,

  // Master Ledger Summary Stats
  ledgerSummary: null,
  amenitySummary: [],

  adminQueue: {
    items: [],
    pagination: { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 },
    tab: 'APPROVALS',
    search: '',
    counts: { approvals: 0, review: 0 },
    loading: false,
    error: null,
  },

  bookableFacilities: [],
  bookableFacilitiesLoading: false,

  ledger: {
    items: [],
    pagination: { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 },
    summary: null,
    view: 'ALL',
    search: '',
    loading: false,
    error: null,
  },
};

// ==========================================
// Legacy Async Thunks
// ==========================================

export const fetchMyBookingsThunk = createAsyncThunk(
  'amenityBookings/fetchMyBookings',
  async (params: { page?: number; limit?: number; status?: string } = {}, { rejectWithValue }) => {
    try {
      const response = await amenityService.getMyBookings(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch personal bookings');
    }
  }
);

export const fetchAdminCalendarThunk = createAsyncThunk(
  'amenityBookings/fetchAdminCalendar',
  async (
    params: {
      date?: string;
      startDate?: string;
      endDate?: string;
      amenityId?: string;
      status?: string;
      search?: string;
      paymentStatus?: string;
    } = {},
    { rejectWithValue }
  ) => {
    try {
      const response = await amenityService.getAdminCalendar(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch admin calendar bookings');
    }
  }
);

export const fetchBookingQueueThunk = createAsyncThunk(
  'amenityBookings/fetchBookingQueue',
  async (
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      amenityId?: string;
    } = {},
    { rejectWithValue }
  ) => {
    try {
      const response = await amenityService.getBookingQueue(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch master booking ledger');
    }
  }
);

export const createManualBookingThunk = createAsyncThunk(
  'amenityBookings/createManualBooking',
  async (
    payload: {
      amenityId: string;
      residentId?: string;
      residentName?: string;
      villaNumber?: string;
      date: string;
      startTime: string;
      endTime: string;
      notes?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await amenityService.createManualBooking(payload);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create manual admin reservation');
    }
  }
);

export const adminCancelBookingThunk = createAsyncThunk(
  'amenityBookings/adminCancelBooking',
  async ({ bookingId, reason }: { bookingId: string; reason?: string }, { rejectWithValue }) => {
    try {
      const response = await amenityService.adminCancelBooking(bookingId, reason);
      return { bookingId, response };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to cancel reservation');
    }
  }
);

export const fetchRecentScansThunk = createAsyncThunk(
  'amenityBookings/fetchRecentScans',
  async (params: { page?: number; limit?: number } = {}, { rejectWithValue }) => {
    try {
      const response = await amenityService.getRecentScans(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch gate audit scans');
    }
  }
);

export const fetchDashboardStatsThunk = createAsyncThunk(
  'amenityBookings/fetchDashboardStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await amenityService.getDashboardStats();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch dashboard metrics');
    }
  }
);

export const createBookingThunk = createAsyncThunk(
  'amenityBookings/createBooking',
  async (payload: CreateBookingPayload, { rejectWithValue }) => {
    try {
      const response = await amenityService.createAmenityBooking(payload);
      return response;
    } catch (error: any) {
      const isOCC = error.status === 409 || error.statusCode === 409 || (error.message && error.message.toLowerCase().includes('version'));
      return rejectWithValue({
        message: error.response?.data?.message || error.message || 'Failed to complete amenity booking reservation',
        isOCC,
      });
    }
  }
);

export const checkInBookingThunk = createAsyncThunk(
  'amenityBookings/checkInBooking',
  async ({ bookingId, payload }: { bookingId: string; payload?: CheckInPayload }, { rejectWithValue }) => {
    try {
      const response = await amenityService.checkInBooking(bookingId, payload || {});
      return response;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Check-in validation failed'
      );
    }
  }
);

export const cancelBookingThunk = createAsyncThunk(
  'amenityBookings/cancelBooking',
  async ({ bookingId, reason }: { bookingId: string; reason?: string }, { rejectWithValue }) => {
    try {
      const response = await amenityService.cancelBooking(bookingId, reason);
      return response;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to cancel amenity booking'
      );
    }
  }
);

// ==========================================
// v2 Frozen Backend Async Thunks
// ==========================================

export const checkAvailabilityThunk = createAsyncThunk(
  'amenityBookings/checkAvailability',
  async (
    params: {
      facilityId: string;
      resourceId?: string;
      startDateTime: string;
      endDateTime: string;
      requestedQuantity?: number;
      headcount?: number;
      quantity?: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await amenityManagementService.checkAvailability(params);
      return normalizeAvailabilityFromApi(res?.data || res);
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

export const calculatePricingThunk = createAsyncThunk(
  'amenityBookings/calculatePricing',
  async (payload: CalculatePricingApiPayload, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.calculatePricing(payload);
      return normalizePricingSnapshot(res?.data || res);
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

export const createHoldThunk = createAsyncThunk(
  'amenityBookings/createHold',
  async (
    { payload, idempotencyKey }: { payload: CreateHoldApiPayload; idempotencyKey?: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await amenityManagementService.createHold(payload, idempotencyKey);
      const rawPayload = res?.data || res;
      const hold = normalizeHoldFromApi(rawPayload.hold || rawPayload, rawPayload.pricingSnapshot);
      return hold;
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

export const releaseHoldThunk = createAsyncThunk(
  'amenityBookings/releaseHold',
  async (holdId: string, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.releaseHold(holdId);
      const rawPayload = res?.data || res;
      return { holdId, success: rawPayload.success ?? true };
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

export const confirmReservationThunk = createAsyncThunk(
  'amenityBookings/confirmReservation',
  async (
    { payload, idempotencyKey }: { payload: ConfirmReservationApiPayload; idempotencyKey?: string },
    { rejectWithValue }
  ) => {
    try {
      const res: any = await amenityManagementService.confirmReservation(payload, idempotencyKey);
      const rawData = res?.data || res;
      const reservation = normalizeReservationFromApi(rawData);
      const passData = rawData?.pass || rawData?.data?.pass;
      const pass = passData ? normalizeAccessPassFromApi(passData) : null;
      return { reservation, pass };
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

export const fetchReservationsThunk = createAsyncThunk(
  'amenityBookings/fetchReservations',
  async (
    params: {
      page?: number;
      limit?: number;
      facilityId?: string;
      resourceId?: string;
      residentId?: string;
      bookingStatus?: string;
      paymentStatus?: string;
      unitId?: string;
      startDate?: string;
      endDate?: string;
    } = {},
    { rejectWithValue }
  ) => {
    try {
      const res = await amenityManagementService.getReservations(params);
      const rawPayload = res?.data || res;
      const rawList = rawPayload?.items || (Array.isArray(rawPayload) ? rawPayload : []);
      return {
        items: rawList.map(normalizeReservationFromApi),
        pagination: paginationFromPayload(rawPayload, rawList.length),
      };
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

export const fetchReservationByIdThunk = createAsyncThunk(
  'amenityBookings/fetchReservationById',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.getReservationById(id);
      return normalizeReservationFromApi(res?.data || res);
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

export const cancelReservationThunk = createAsyncThunk(
  'amenityBookings/cancelReservation',
  async (
    { id, payload }: { id: string; payload?: CancelReservationApiPayload },
    { rejectWithValue }
  ) => {
    try {
      const res = await amenityManagementService.cancelReservation(id, payload);
      return normalizeReservationFromApi(res?.data || res);
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

export const fetchCancellationPreviewThunk = createAsyncThunk(
  'amenityBookings/fetchCancellationPreview',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.getCancellationPreview(id);
      return (res?.data || res) as AmenityCancellationPreview;
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

/** Pays the booking's outstanding balance from the digital wallet. */
export const payReservationBalanceThunk = createAsyncThunk(
  'amenityBookings/payReservationBalance',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.payReservationBalance(id);
      return normalizeReservationFromApi(res?.data || res);
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

/** Opens an online payment order for the booking's outstanding balance. */
export const createBalancePaymentOrderThunk = createAsyncThunk(
  'amenityBookings/createBalancePaymentOrder',
  async (reservationId: string, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.createReservationPaymentOrder({ reservationId });
      return (res?.data || res) as any;
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

/** Verifies an online payment; the server settles it and returns the updated booking. */
export const verifyReservationPaymentThunk = createAsyncThunk(
  'amenityBookings/verifyReservationPayment',
  async (
    payload: { paymentId: string; orderId: string; razorpayPaymentId: string; razorpaySignature: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await amenityManagementService.verifyReservationPayment(payload);
      const data: any = res?.data || res;
      return {
        fulfilled: Boolean(data?.fulfilled),
        reservation: data?.reservation ? normalizeReservationFromApi(data.reservation) : null,
      };
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

export const fetchPassesByReservationThunk = createAsyncThunk(
  'amenityBookings/fetchPassesByReservation',
  async (reservationId: string, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.getPassesByReservation(reservationId);
      const rawPayload: any = res?.data || res;
      const rawList = Array.isArray(rawPayload) ? rawPayload : (rawPayload?.passes || rawPayload?.data || []);
      return rawList.map(normalizeAccessPassFromApi);
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

export const checkInPassThunk = createAsyncThunk(
  'amenityBookings/checkInPass',
  async (payload: CheckInPassApiPayload, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.checkInPass(payload);
      return normalizeAccessPassFromApi(res?.data || res);
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

export const checkOutPassThunk = createAsyncThunk(
  'amenityBookings/checkOutPass',
  async (payload: CheckOutPassApiPayload, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.checkOutPass(payload);
      const data: any = res?.data || res;
      return {
        pass: normalizeAccessPassFromApi(data?.pass || data),
        reservation: data?.reservation ? normalizeReservationFromApi(data.reservation) : null,
        deposit: data?.deposit || null,
      } as AmenityCheckOutResult;
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

/** Staff booking queue: one tab's page (tab, search and page come from the slice unless given). */
export const fetchAdminQueueThunk = createAsyncThunk(
  'amenityBookings/fetchAdminQueue',
  async ({ page = 1 }: { page?: number } = {}, { getState, rejectWithValue }) => {
    try {
      const { tab, search, pagination } = (getState() as any).amenityBookings.adminQueue;
      const res = await amenityManagementService.getReservations({
        page,
        limit: pagination.limit,
        ...ADMIN_QUEUE_FILTERS[tab as AdminQueueTab],
        ...(search?.trim() ? { search: search.trim() } : {}),
      });
      const raw: any = res?.data || res;
      const list = raw?.items || [];
      return { items: list.map(normalizeReservationFromApi), pagination: paginationFromPayload(raw, list.length) };
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

/** Amenity ledger page (view, search and page size come from the slice). */
export const fetchAmenityLedgerThunk = createAsyncThunk(
  'amenityBookings/fetchAmenityLedger',
  async ({ page = 1 }: { page?: number } = {}, { getState, rejectWithValue }) => {
    try {
      const { view, search, pagination } = (getState() as any).amenityBookings.ledger;
      const res: any = await amenityService.getAmenityLedger({
        page,
        limit: pagination.limit,
        ...LEDGER_VIEW_FILTERS[view as AmenityLedgerView],
        ...(search?.trim() ? { search: search.trim() } : {}),
      });
      const payload = res?.data?.data ? res.data : res?.data || res;
      return {
        items: (payload?.data || []).map(normalizeAmenityBooking) as AmenityBooking[],
        pagination: payload?.pagination as PaginationMeta,
        summary: (payload?.summary || null) as AmenityLedgerSummary | null,
      };
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || err?.message || 'Could not load the ledger.');
    }
  }
);

/** Every ledger row matching the current view and search (for CSV export). */
export const exportAmenityLedgerThunk = createAsyncThunk(
  'amenityBookings/exportAmenityLedger',
  async (_: void, { getState, rejectWithValue }) => {
    try {
      const { view, search } = (getState() as any).amenityBookings.ledger;
      const rows: AmenityBooking[] = [];
      for (let page = 1; page <= 50; page++) {
        const res: any = await amenityService.getAmenityLedger({
          page,
          limit: 100,
          ...LEDGER_VIEW_FILTERS[view as AmenityLedgerView],
          ...(search?.trim() ? { search: search.trim() } : {}),
        });
        const payload = res?.data?.data ? res.data : res?.data || res;
        rows.push(...(payload?.data || []).map(normalizeAmenityBooking));
        if (page >= Number(payload?.pagination?.totalPages || 1)) break;
      }
      return rows;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || err?.message || 'Could not export the ledger.');
    }
  }
);

/** Published (active) facilities, for staff booking on a resident's behalf. */
export const fetchBookableFacilitiesThunk = createAsyncThunk(
  'amenityBookings/fetchBookableFacilities',
  async (_: void, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.getFacilities({ page: 1, limit: 100, status: 'ACTIVE' });
      const raw: any = res?.data || res;
      const list = raw?.items || raw?.data || (Array.isArray(raw) ? raw : []);
      return list.map(normalizeFacilityFromApi) as AmenityFacility[];
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

/** Totals shown on the queue's KPI cards. */
export const fetchAdminQueueCountsThunk = createAsyncThunk(
  'amenityBookings/fetchAdminQueueCounts',
  async (_: void, { rejectWithValue }) => {
    try {
      const [approvals, review] = await Promise.all([
        amenityManagementService.getReservations({ page: 1, limit: 1, ...ADMIN_QUEUE_FILTERS.APPROVALS }),
        amenityManagementService.getReservations({ page: 1, limit: 1, ...ADMIN_QUEUE_FILTERS.REVIEW }),
      ]);
      const totalOf = (r: any) => Number((r?.data || r)?.total || 0);
      return { approvals: totalOf(approvals), review: totalOf(review) };
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

/** Staff approve or reject a booking that needs approval (a reason is required to reject). */
export const reviewReservationThunk = createAsyncThunk(
  'amenityBookings/reviewReservation',
  async (
    { id, action, rejectionReason }: { id: string; action: 'APPROVE' | 'REJECT'; rejectionReason?: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await amenityManagementService.reviewReservation(id, { action, rejectionReason } as any);
      return normalizeReservationFromApi((res as any)?.data || res);
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

/** Staff decision on a flagged booking (no-show, unpaid balance, overdue return). */
export const resolveReservationReviewThunk = createAsyncThunk(
  'amenityBookings/resolveReservationReview',
  async (
    { id, ...payload }: { id: string; action: 'FORFEIT' | 'REFUND_POLICY' | 'REFUND_CUSTOM' | 'EXTEND'; refundPercentage?: number; notes?: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await amenityManagementService.resolveReservationReview(id, payload);
      return normalizeReservationFromApi((res as any)?.data || res);
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

/** Gate staff collect a booking's outstanding balance in cash before entry. */
export const collectBalancePaymentThunk = createAsyncThunk(
  'amenityBookings/collectBalancePayment',
  async ({ reservationId, amount }: { reservationId: string; amount: number }, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.collectReservationPayment(reservationId, amount);
      const data: any = res?.data || res;
      return {
        reservation: data?.reservation ? normalizeReservationFromApi(data.reservation) : null,
        receiptNumber: data?.receiptNumber || null,
      };
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

export const revokePassThunk = createAsyncThunk(
  'amenityBookings/revokePass',
  async ({ passId, reason }: { passId: string; reason: string }, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.revokePass(passId, reason);
      return normalizeAccessPassFromApi(res.data);
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

// ==========================================
// Slice Definition
// ==========================================

/**
 * Replaces every cached copy of a booking with a newer server version. Pushed or action
 * payloads may not carry populated names, so the names already shown are kept.
 */
const applyReservationUpdate = (state: AmenityBookingState, incoming: AmenityReservation | null) => {
  if (!incoming?._id) return;
  const merge = (current: AmenityReservation): AmenityReservation => ({
    ...incoming,
    facilityName: incoming.facilityName || current.facilityName,
    facilityTimezone: incoming.facilityTimezone || current.facilityTimezone,
    resourceName: incoming.resourceName || current.resourceName,
    userName: incoming.userName || current.userName,
  });
  if (state.v2CurrentReservation?._id === incoming._id) state.v2CurrentReservation = merge(state.v2CurrentReservation);
  state.v2Reservations = state.v2Reservations.map((r) => (r._id === incoming._id ? merge(r) : r));
  state.adminQueue.items = state.adminQueue.items.map((r) => (r._id === incoming._id ? merge(r) : r));
};

const amenityBookingSlice = createSlice({
  name: 'amenityBookings',
  initialState,
  reducers: {
    // Legacy Reducers
    setActivePass: (state, action: PayloadAction<AmenityBooking | null>) => {
      state.activePass = action.payload;
    },
    clearCheckInResult: (state) => {
      state.checkInResult = null;
    },
    clearBookingStatus: (state) => {
      state.error = null;
      state.successMsg = null;
      state.isOCCError = false;
      state.occErrorMessage = null;
    },
    upsertBooking: (state, action: PayloadAction<any>) => {
      const normalized = normalizeAmenityBooking(action.payload);
      const adminIndex = state.adminBookings.findIndex((b) => b._id === normalized._id);
      if (adminIndex !== -1) {
        state.adminBookings[adminIndex] = normalized;
      } else {
        state.adminBookings.unshift(normalized);
      }
      const myIndex = state.myBookings.findIndex((b) => b._id === normalized._id);
      if (myIndex !== -1) {
        state.myBookings[myIndex] = normalized;
      } else {
        state.myBookings.unshift(normalized);
      }
    },
    removeBooking: (state, action: PayloadAction<string>) => {
      state.adminBookings = state.adminBookings.filter((b) => b._id !== action.payload);
      state.myBookings = state.myBookings.filter((b) => b._id !== action.payload);
    },

    // v2 Reducers
    setActiveHold: (state, action: PayloadAction<AmenityHoldState | null>) => {
      state.activeHold = action.payload;
      if (action.payload?.pricingSnapshot) {
        state.v2PricingCalculation = action.payload.pricingSnapshot;
      }
    },
    clearActiveHold: (state) => {
      state.activeHold = null;
    },
    clearV2Errors: (state) => {
      state.v2Error = null;
    },
    setLedgerView: (state, action: PayloadAction<AmenityLedgerView>) => {
      state.ledger.view = action.payload;
    },
    setLedgerSearch: (state, action: PayloadAction<string>) => {
      state.ledger.search = action.payload;
    },
    clearLedgerError: (state) => {
      state.ledger.error = null;
    },
    setAdminQueueTab: (state, action: PayloadAction<AdminQueueTab>) => {
      state.adminQueue.tab = action.payload;
    },
    setAdminQueueSearch: (state, action: PayloadAction<string>) => {
      state.adminQueue.search = action.payload;
    },
    clearAdminQueueError: (state) => {
      state.adminQueue.error = null;
    },
    /** A booking pushed by the server (socket) or returned by an action: refresh every copy. */
    upsertV2Reservation: (state, action: PayloadAction<any>) => {
      applyReservationUpdate(state, normalizeReservationFromApi(action.payload));
    },
    clearAmenityBookingErrors: (state) => {
      state.error = null;
      state.v2Error = null;
    },
    resetV2BookingState: (state) => {
      state.activeHold = null;
      state.v2PricingCalculation = null;
      state.v2Availability = null;
      state.v2Error = null;
      state.v2Holding = false;
      state.v2Confirming = false;
      state.v2CurrentReservation = null;
      state.v2AccessPasses = [];
    },
    clearV2PassResults: (state) => {
      state.v2CheckInResult = null;
      state.v2CheckOutResult = null;
      state.v2PassError = null;
      state.v2PassActionLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // ==========================================
      // Legacy Extra Reducers
      // ==========================================
      .addCase(fetchMyBookingsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMyBookingsThunk.fulfilled, (state, action: any) => {
        state.loading = false;
        state.error = null;
        const payload = action.payload?.data || action.payload;
        let list: any[] = [];
        if (Array.isArray(payload)) {
          list = payload;
          state.pagination = {
            currentPage: 1,
            totalPages: 1,
            totalRecords: payload.length,
            limit: payload.length || 10,
          };
        } else if (payload && typeof payload === 'object') {
          list = payload.docs || payload.bookings || payload.items || [];
          state.pagination = {
            currentPage: payload.page || payload.currentPage || 1,
            totalPages: payload.totalPages || payload.pages || 1,
            totalRecords: payload.totalDocs || payload.totalRecords || list.length,
            limit: payload.limit || 10,
          };
        }
        const newBookings = list.map(normalizeAmenityBooking);
        const page = action.meta.arg?.page || 1;
        if (page > 1) {
          state.myBookings = [...state.myBookings, ...newBookings];
        } else {
          state.myBookings = newBookings;
        }
      })
      .addCase(fetchMyBookingsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Failed to fetch personal bookings';
      })
      .addCase(fetchBookingQueueThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBookingQueueThunk.fulfilled, (state, action: any) => {
        state.loading = false;
        state.error = null;
        const resObj = action.payload || {};
        const payload = resObj.data || resObj;
        let list: any[] = [];
        if (Array.isArray(payload)) {
          list = payload;
          state.pagination = {
            currentPage: 1,
            totalPages: 1,
            totalRecords: payload.length,
            limit: payload.length || 10,
          };
        } else if (payload && typeof payload === 'object') {
          list = payload.docs || payload.bookings || payload.items || payload.data || [];
          const pag = payload.pagination || resObj.pagination || {};
          state.pagination = {
            currentPage: pag.currentPage || payload.page || payload.currentPage || 1,
            totalPages: pag.totalPages || payload.totalPages || payload.pages || 1,
            totalRecords: pag.totalRecords || payload.totalDocs || payload.totalRecords || list.length,
            limit: pag.limit || payload.limit || 10,
          };
        }
        state.adminBookings = list.map(normalizeAmenityBooking);
        const summary = payload.summary || resObj.summary;
        if (summary) {
          state.ledgerSummary = summary;
        }
        const amenitySummary = payload.amenitySummary || resObj.amenitySummary;
        if (amenitySummary) {
          state.amenitySummary = amenitySummary;
        }
      })
      .addCase(fetchBookingQueueThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Failed to fetch master booking queue';
      })
      .addCase(createBookingThunk.pending, (state) => {
        state.creatingBooking = true;
        state.error = null;
        state.isOCCError = false;
        state.occErrorMessage = null;
        state.successMsg = null;
      })
      .addCase(createBookingThunk.fulfilled, (state, action: any) => {
        state.creatingBooking = false;
        state.successMsg = 'Amenity slot successfully reserved!';
        let createdBooking = action.payload?.data || action.payload;
        if (createdBooking && createdBooking.booking) {
          createdBooking = createdBooking.booking;
        }
        if (createdBooking) {
          const normalized = normalizeAmenityBooking(createdBooking);
          state.myBookings.unshift(normalized);
          state.activePass = normalized;
        }
      })
      .addCase(createBookingThunk.rejected, (state, action: any) => {
        state.creatingBooking = false;
        const payloadErr = action.payload;
        if (payloadErr && typeof payloadErr === 'object') {
          state.error = payloadErr.message;
          if (payloadErr.isOCC) {
            state.isOCCError = true;
            state.occErrorMessage = 'Slot selection conflict detected. Another resident just reserved this slot. Please re-select an available slot.';
          }
        } else {
          state.error = (action.payload as string) || 'Failed to complete booking reservation';
        }
      })
      .addCase(checkInBookingThunk.pending, (state) => {
        state.checkingIn = true;
        state.checkInResult = null;
      })
      .addCase(checkInBookingThunk.fulfilled, (state, action: any) => {
        state.checkingIn = false;
        const data = action.payload?.data || action.payload;
        const normalized = normalizeAmenityBooking(data);
        state.checkInResult = {
          success: true,
          status: 'SUCCESS',
          message: action.payload?.message || 'Resident check-in verified successfully!',
          booking: normalized,
        };
      })
      .addCase(checkInBookingThunk.rejected, (state, action) => {
        state.checkingIn = false;
        state.checkInResult = {
          success: false,
          status: 'INVALID',
          message: (action.payload as string) || 'Check-in verification failed',
        };
      })
      .addCase(fetchAdminCalendarThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminCalendarThunk.fulfilled, (state, action: any) => {
        state.loading = false;
        state.error = null;
        const payload = action.payload?.data || action.payload;
        const list = Array.isArray(payload) ? payload : payload?.bookings || payload?.docs || [];
        state.adminBookings = list.map(normalizeAmenityBooking);
      })
      .addCase(fetchAdminCalendarThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Failed to fetch admin calendar bookings';
      })
      .addCase(fetchRecentScansThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecentScansThunk.fulfilled, (state, action: any) => {
        state.loading = false;
        state.error = null;
        const payload = action.payload?.data || action.payload;
        state.recentScans = Array.isArray(payload) ? payload : payload?.scans || payload?.docs || [];
      })
      .addCase(fetchRecentScansThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Failed to fetch gate audit scans';
      })
      .addCase(fetchDashboardStatsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardStatsThunk.fulfilled, (state, action: any) => {
        state.loading = false;
        state.error = null;
        state.dashboardStats = action.payload?.data || action.payload || null;
      })
      .addCase(fetchDashboardStatsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Failed to fetch dashboard metrics';
      })
      .addCase(cancelBookingThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(cancelBookingThunk.fulfilled, (state, action: any) => {
        state.loading = false;
        state.successMsg = 'Booking cancelled successfully';
        const cancelledId = action.meta.arg.bookingId;
        state.myBookings = state.myBookings.map((b) =>
          b._id === cancelledId || b.bookingId === cancelledId ? { ...b, status: 'CANCELLED' } : b
        );
      })
      .addCase(cancelBookingThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Failed to cancel booking';
      })

      // ==========================================
      // v2 Extra Reducers
      // ==========================================
      // Availability Check
      .addCase(checkAvailabilityThunk.pending, (state) => {
        state.v2Loading = true;
        state.v2Error = null;
      })
      .addCase(checkAvailabilityThunk.fulfilled, (state, action) => {
        state.v2Loading = false;
        state.v2Availability = action.payload;
      })
      .addCase(checkAvailabilityThunk.rejected, (state, action) => {
        state.v2Loading = false;
        state.v2Error = action.payload as AmenityErrorDetails;
      })

      // Pricing Calculation
      .addCase(calculatePricingThunk.pending, (state) => {
        state.v2Loading = true;
        state.v2Error = null;
      })
      .addCase(calculatePricingThunk.fulfilled, (state, action) => {
        state.v2Loading = false;
        state.v2PricingCalculation = action.payload;
      })
      .addCase(calculatePricingThunk.rejected, (state, action) => {
        state.v2Loading = false;
        state.v2Error = action.payload as AmenityErrorDetails;
      })

      // Hold Creation
      .addCase(createHoldThunk.pending, (state) => {
        state.v2Holding = true;
        state.v2Error = null;
      })
      .addCase(createHoldThunk.fulfilled, (state, action) => {
        state.v2Holding = false;
        state.activeHold = action.payload;
        if (action.payload.pricingSnapshot) {
          state.v2PricingCalculation = action.payload.pricingSnapshot;
        }
      })
      .addCase(createHoldThunk.rejected, (state, action) => {
        state.v2Holding = false;
        state.v2Error = action.payload as AmenityErrorDetails;
      })

      // Release Hold
      .addCase(releaseHoldThunk.fulfilled, (state, action) => {
        if (state.activeHold && state.activeHold._id === action.payload.holdId) {
          state.activeHold = null;
        }
      })

      // Confirm Reservation
      .addCase(confirmReservationThunk.pending, (state) => {
        state.v2Confirming = true;
        state.v2Error = null;
      })
      .addCase(confirmReservationThunk.fulfilled, (state, action) => {
        state.v2Confirming = false;
        state.v2CurrentReservation = action.payload.reservation;
        state.activeHold = null; // Clear active hold on successful confirmation
        state.v2Reservations.unshift(action.payload.reservation);
        if (action.payload.pass) {
          state.v2AccessPasses.unshift(action.payload.pass);
        }
      })
      .addCase(confirmReservationThunk.rejected, (state, action) => {
        state.v2Confirming = false;
        state.v2Error = action.payload as AmenityErrorDetails;
      })

      // Fetch Reservations
      .addCase(fetchReservationsThunk.pending, (state) => {
        state.v2Loading = true;
        state.v2Error = null;
      })
      .addCase(fetchReservationsThunk.fulfilled, (state, action) => {
        state.v2Loading = false;
        const { items, pagination } = action.payload;
        // Later pages extend the list; page 1 replaces it.
        state.v2Reservations =
          pagination.currentPage > 1
            ? [...state.v2Reservations, ...items.filter((i) => !state.v2Reservations.some((r) => r._id === i._id))]
            : items;
        state.pagination = pagination;
      })
      .addCase(fetchReservationsThunk.rejected, (state, action) => {
        state.v2Loading = false;
        state.v2Error = action.payload as AmenityErrorDetails;
      })

      // Fetch Reservation By ID
      .addCase(fetchReservationByIdThunk.pending, (state) => {
        state.v2Loading = true;
        state.v2Error = null;
      })
      .addCase(fetchReservationByIdThunk.fulfilled, (state, action) => {
        state.v2Loading = false;
        state.v2CurrentReservation = action.payload;
      })
      .addCase(fetchReservationByIdThunk.rejected, (state, action) => {
        state.v2Loading = false;
        state.v2Error = action.payload as AmenityErrorDetails;
      })

      // Cancel Reservation
      .addCase(cancelReservationThunk.pending, (state) => {
        state.v2Loading = true;
        state.v2Error = null;
      })
      .addCase(cancelReservationThunk.fulfilled, (state, action) => {
        state.v2Loading = false;
        const updated = action.payload;
        if (state.v2CurrentReservation?._id === updated._id) {
          state.v2CurrentReservation = updated;
        }
        state.v2Reservations = state.v2Reservations.map((r) =>
          r._id === updated._id ? updated : r
        );
      })
      // Cancel errors are shown in the cancel sheet, not as a screen error.
      .addCase(cancelReservationThunk.rejected, (state) => {
        state.v2Loading = false;
      })

      // Balance payments (wallet / verified online) return the updated booking
      .addCase(payReservationBalanceThunk.fulfilled, (state, action) => {
        applyReservationUpdate(state, action.payload);
      })
      .addCase(verifyReservationPaymentThunk.fulfilled, (state, action) => {
        applyReservationUpdate(state, action.payload.reservation);
      })

      // Fetch Passes
      .addCase(fetchPassesByReservationThunk.pending, (state) => {
        state.v2Loading = true;
        state.v2Error = null;
      })
      .addCase(fetchPassesByReservationThunk.fulfilled, (state, action) => {
        state.v2Loading = false;
        state.v2AccessPasses = action.payload;
      })
      .addCase(fetchPassesByReservationThunk.rejected, (state, action) => {
        state.v2Loading = false;
        state.v2Error = action.payload as AmenityErrorDetails;
      })

      // V2 Check-In Pass
      .addCase(checkInPassThunk.pending, (state) => {
        state.v2PassActionLoading = true;
        state.v2PassError = null;
      })
      .addCase(checkInPassThunk.fulfilled, (state, action) => {
        state.v2PassActionLoading = false;
        state.v2CheckInResult = action.payload;
        state.v2PassError = null;
      })
      .addCase(checkInPassThunk.rejected, (state, action) => {
        state.v2PassActionLoading = false;
        state.v2PassError = action.payload as AmenityErrorDetails;
      })

      // V2 Check-Out Pass
      .addCase(checkOutPassThunk.pending, (state) => {
        state.v2PassActionLoading = true;
        state.v2PassError = null;
      })
      .addCase(checkOutPassThunk.fulfilled, (state, action) => {
        state.v2PassActionLoading = false;
        state.v2CheckOutResult = action.payload;
        state.v2PassError = null;
      })
      .addCase(checkOutPassThunk.rejected, (state, action) => {
        state.v2PassActionLoading = false;
        state.v2PassError = action.payload as AmenityErrorDetails;
      })

      // Staff booking queue
      .addCase(fetchAdminQueueThunk.pending, (state) => {
        state.adminQueue.loading = true;
        state.adminQueue.error = null;
      })
      .addCase(fetchAdminQueueThunk.fulfilled, (state, action) => {
        const { items, pagination } = action.payload;
        state.adminQueue.loading = false;
        state.adminQueue.items =
          pagination.currentPage > 1
            ? [...state.adminQueue.items, ...items.filter((i: AmenityReservation) => !state.adminQueue.items.some((r) => r._id === i._id))]
            : items;
        state.adminQueue.pagination = pagination;
      })
      .addCase(fetchAdminQueueThunk.rejected, (state, action) => {
        state.adminQueue.loading = false;
        state.adminQueue.error = (action.payload as AmenityErrorDetails)?.message || 'Could not load bookings.';
      })
      // Amenity ledger
      .addCase(fetchAmenityLedgerThunk.pending, (state) => {
        state.ledger.loading = true;
        state.ledger.error = null;
      })
      .addCase(fetchAmenityLedgerThunk.fulfilled, (state, action) => {
        const { items, pagination, summary } = action.payload;
        state.ledger.loading = false;
        const page = pagination?.currentPage || 1;
        // Later pages extend the list; page 1 replaces it.
        state.ledger.items =
          page > 1 ? [...state.ledger.items, ...items.filter((i) => !state.ledger.items.some((r) => r._id === i._id))] : items;
        if (pagination) state.ledger.pagination = pagination;
        state.ledger.summary = summary;
      })
      .addCase(fetchAmenityLedgerThunk.rejected, (state, action) => {
        state.ledger.loading = false;
        state.ledger.error = (action.payload as string) || 'Could not load the ledger.';
      })
      .addCase(fetchBookableFacilitiesThunk.pending, (state) => {
        state.bookableFacilitiesLoading = true;
      })
      .addCase(fetchBookableFacilitiesThunk.fulfilled, (state, action) => {
        state.bookableFacilitiesLoading = false;
        state.bookableFacilities = action.payload;
      })
      .addCase(fetchBookableFacilitiesThunk.rejected, (state) => {
        state.bookableFacilitiesLoading = false;
      })
      .addCase(fetchAdminQueueCountsThunk.fulfilled, (state, action) => {
        state.adminQueue.counts = action.payload;
      })
      .addCase(reviewReservationThunk.fulfilled, (state, action) => {
        applyReservationUpdate(state, action.payload);
      })
      .addCase(resolveReservationReviewThunk.fulfilled, (state, action) => {
        applyReservationUpdate(state, action.payload);
      })

      // Gate cash collection
      .addCase(collectBalancePaymentThunk.pending, (state) => {
        state.v2PassActionLoading = true;
      })
      .addCase(collectBalancePaymentThunk.fulfilled, (state, action) => {
        state.v2PassActionLoading = false;
        applyReservationUpdate(state, action.payload.reservation);
      })
      .addCase(collectBalancePaymentThunk.rejected, (state, action) => {
        state.v2PassActionLoading = false;
        state.v2PassError = action.payload as AmenityErrorDetails;
      })

      // V2 Revoke Pass
      .addCase(revokePassThunk.pending, (state) => {
        state.v2PassActionLoading = true;
        state.v2PassError = null;
      })
      .addCase(revokePassThunk.fulfilled, (state, action) => {
        state.v2PassActionLoading = false;
        state.v2PassError = null;
      })
      .addCase(revokePassThunk.rejected, (state, action) => {
        state.v2PassActionLoading = false;
        state.v2PassError = action.payload as AmenityErrorDetails;
      });
  },
});

export const {
  setActivePass,
  clearCheckInResult,
  clearBookingStatus,
  upsertBooking,
  removeBooking,
  setActiveHold,
  clearActiveHold,
  clearV2Errors,
  upsertV2Reservation,
  setAdminQueueTab,
  setAdminQueueSearch,
  clearAdminQueueError,
  setLedgerView,
  setLedgerSearch,
  clearLedgerError,
  clearAmenityBookingErrors,
  resetV2BookingState,
  clearV2PassResults,
} = amenityBookingSlice.actions;

export default amenityBookingSlice.reducer;
