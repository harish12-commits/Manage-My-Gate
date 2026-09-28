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
    rawStatus === 'PENDING' ? 'PENDING' : 'CONFIRMED';

  const userObj = typeof raw.userId === 'object' && raw.userId ? raw.userId : null;
  const residentName = raw.residentName || userObj?.name || userObj?.username || raw.userName || 'Community Resident';
  const villaNumber = raw.villaNumber || raw.flatNumber || userObj?.villaNumber || userObj?.flatNumber || userObj?.unit || 'Villa 101';

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
  v2CheckOutResult: AmenityAccessPass | null;
  v2PassActionLoading: boolean;
  v2PassError: AmenityErrorDetails | null;

  // Master Ledger Summary Stats
  ledgerSummary: any;
  amenitySummary: any[];
}

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
      const pagination = rawPayload?.pagination || { page: 1, limit: 10, total: rawList.length, pages: 1 };
      return {
        items: rawList.map(normalizeReservationFromApi),
        pagination,
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
      return normalizeAccessPassFromApi(res?.data || res);
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
        state.v2Reservations = action.payload.items;
        state.pagination = {
          currentPage: action.payload.pagination.page,
          totalPages: action.payload.pagination.pages,
          totalRecords: action.payload.pagination.total,
          limit: action.payload.pagination.limit,
        };
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
      .addCase(cancelReservationThunk.rejected, (state, action) => {
        state.v2Loading = false;
        state.v2Error = action.payload as AmenityErrorDetails;
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
  clearAmenityBookingErrors,
  resetV2BookingState,
  clearV2PassResults,
} = amenityBookingSlice.actions;

export default amenityBookingSlice.reducer;
