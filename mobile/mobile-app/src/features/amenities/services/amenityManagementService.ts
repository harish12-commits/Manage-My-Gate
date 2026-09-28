/**
 * Amenity Management v2 - API Service
 * Encapsulates all HTTP operations for the frozen Phase 5 backend (/api/v2/amenity-management/*).
 * Routes to /api/v2 cleanly without /api/v1 duplication and preserves all global apiClient interceptors.
 */

import apiClient, { getApiBaseUrl } from '../../../services/apiClient';
import {
  ApiResponse,
  ApiPaginatedResponse,
  ApiAmenityFacility,
  ApiAmenityResource,
  ApiAvailabilityResponse,
  ApiPricingSnapshot,
  ApiCreateHoldResponse,
  ApiAmenityHold,
  ApiAmenityReservation,
  ApiAmenityAccessPass,
  ApiAmenityPaymentOrder,
  ApiAmenityMaintenanceBlock,
  CreateHoldApiPayload,
  ConfirmReservationApiPayload,
  CalculatePricingApiPayload,
  CancelReservationApiPayload,
  ReviewReservationApiPayload,
  ScheduleMaintenanceApiPayload,
  PreviewRecurringMaintenanceApiPayload,
  ScheduleRecurringMaintenanceApiPayload,
  DeclareEmergencyMaintenanceApiPayload,
  MaintenanceImpactPreviewApiPayload,
  FindAlternativesApiPayload,
  ResolveMaintenanceImpactApiPayload,
  ExtendMaintenanceBlockApiPayload,
  CheckInPassApiPayload,
  CheckOutPassApiPayload,
  RevokePassApiPayload,
} from '../types/amenityApi.types';
import * as Crypto from 'expo-crypto';

/**
 * RFC 4122 v4 UUID generator for client idempotency keys.
 * Leverages native Expo Crypto / Web Crypto randomUUID() when available.
 */
export const generateUUID = (): string => {
  try {
    if (typeof Crypto !== 'undefined' && typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {
    // Fall through if native module is not ready in test environments
  }
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Feature-local URL resolver for Amenity Management v2.
 * Derives the host dynamically from the active runtime configuration and guarantees
 * an absolute URL starting with http(s):// to prevent Axios from prepending /api/v1.
 */
/** A bookable window offered by the server (slot, session, full day, check-in or pickup). */
export interface ApiDailySlot {
  start: string;
  end: string;
  label: string;
  startUtc: string;
  endUtc: string;
  availableUnits?: number;
  maxCapacity?: number;
}

export const getAmenityV2Url = (endpointPath: string): string => {
  const rawBase = (typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : '') || apiClient.defaults.baseURL || '';
  const cleanHost = rawBase.replace(/\/api(\/v1)?\/?$/, '').replace(/\/+$/, '');
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  return `${cleanHost}/api/v2/amenity-management${cleanPath}`;
};

/**
 * Safely normalizes the apiClient response into a standard ApiResponse envelope ({ success, message, data }).
 * Because apiClient's response interceptor returns response.data (the backend JSON payload),
 * extracting .data again strips the envelope, causing callers accessing `res.data` to throw TypeErrors.
 * This helper ensures the { success, data } envelope is preserved across all runtime environments.
 */
export const extractEnvelope = <T>(res: any): ApiResponse<T> => {
  if (res && typeof res === 'object') {
    // If it's already an ApiResponse envelope ({ success, data })
    if ('data' in res && 'success' in res) {
      return res as ApiResponse<T>;
    }
    // If it's a raw AxiosResponse ({ status, data: { success, data } })
    if (res.data && typeof res.data === 'object' && 'success' in res.data) {
      return res.data as ApiResponse<T>;
    }
  }
  return {
    success: true,
    data: res as T,
  };
};

/**
 * Generates an uppercase alphanumeric facility code compliant with backend validation rules.
 */
export const generateFacilityCode = (name: string): string => {
  const clean = (name || 'FAC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 16)
    .replace(/^-|-$/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${clean || 'FAC'}-${randomSuffix}`;
};

export const amenityManagementService = {
  // ==========================================
  // 1. Facilities (/facilities)
  // ==========================================
  async getFacilities(params: {
    page?: number;
    limit?: number;
    archetype?: string;
    search?: string;
    status?: string;
  } = {}): Promise<ApiResponse<ApiPaginatedResponse<ApiAmenityFacility>>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.archetype) query.append('archetype', params.archetype);
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);

    const queryString = query.toString();
    const url = getAmenityV2Url(`/facilities${queryString ? `?${queryString}` : ''}`);
    const response = await apiClient.get<ApiResponse<ApiPaginatedResponse<ApiAmenityFacility>>>(url);
    return extractEnvelope(response);
  },

  async getFacilityById(id: string): Promise<ApiResponse<ApiAmenityFacility>> {
    const url = getAmenityV2Url(`/facilities/${id}`);
    const response = await apiClient.get<ApiResponse<ApiAmenityFacility>>(url);
    return extractEnvelope(response);
  },

  async createFacility(payload: Partial<ApiAmenityFacility>): Promise<ApiResponse<ApiAmenityFacility>> {
    const url = getAmenityV2Url('/facilities');
    const enrichedPayload = {
      ...payload,
      code: payload.code || generateFacilityCode(payload.name || 'FACILITY'),
    };
    const response = await apiClient.post<ApiResponse<ApiAmenityFacility>>(url, enrichedPayload);
    return extractEnvelope(response);
  },

  async updateFacility(id: string, payload: Partial<ApiAmenityFacility>): Promise<ApiResponse<ApiAmenityFacility>> {
    const url = getAmenityV2Url(`/facilities/${id}`);
    const response = await apiClient.patch<ApiResponse<ApiAmenityFacility>>(url, payload);
    return extractEnvelope(response);
  },

  async updateFacilityStatus(
    id: string,
    isActive: boolean,
    bookingAction?: 'HONOR_EXISTING' | 'CANCEL_AND_REFUND'
  ): Promise<ApiResponse<ApiAmenityFacility>> {
    const url = getAmenityV2Url(`/facilities/${id}`);
    const body: Record<string, any> = { isActive };
    if (bookingAction) {
      body.bookingAction = bookingAction;
    }
    const response = await apiClient.patch<ApiResponse<ApiAmenityFacility>>(url, body);
    return extractEnvelope(response);
  },

  async deleteFacility(id: string): Promise<ApiResponse<ApiAmenityFacility>> {
    const url = getAmenityV2Url(`/facilities/${id}`);
    const response = await apiClient.delete<ApiResponse<ApiAmenityFacility>>(url);
    return extractEnvelope(response);
  },

  // ==========================================
  // 2. Resources (/resources)
  // ==========================================
  async getResources(params: {
    facilityId: string;
    page?: number;
    limit?: number;
    assetState?: string;
  }): Promise<ApiResponse<ApiPaginatedResponse<ApiAmenityResource>>> {
    const query = new URLSearchParams();
    query.append('facilityId', params.facilityId);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.assetState) query.append('assetState', params.assetState);

    const queryString = query.toString();
    const url = getAmenityV2Url(`/resources?${queryString}`);
    const response = await apiClient.get<ApiResponse<ApiPaginatedResponse<ApiAmenityResource>>>(url);
    return extractEnvelope(response);
  },

  async getResourceById(id: string): Promise<ApiResponse<ApiAmenityResource>> {
    const url = getAmenityV2Url(`/resources/${id}`);
    const response = await apiClient.get<ApiResponse<ApiAmenityResource>>(url);
    return extractEnvelope(response);
  },

  async createResource(payload: Partial<ApiAmenityResource>): Promise<ApiResponse<ApiAmenityResource>> {
    const url = getAmenityV2Url('/resources');
    const response = await apiClient.post<ApiResponse<ApiAmenityResource>>(url, payload);
    return extractEnvelope(response);
  },

  async updateResourceState(id: string, assetState: string): Promise<ApiResponse<ApiAmenityResource>> {
    const url = getAmenityV2Url(`/resources/${id}/state`);
    const response = await apiClient.patch<ApiResponse<ApiAmenityResource>>(url, { assetState });
    return extractEnvelope(response);
  },

  // ==========================================
  // 3. Availability Evaluation (/availability)
  // ==========================================
  async checkAvailability(params: {
    facilityId: string;
    resourceId?: string;
    startDateTime: string;
    endDateTime: string;
    requestedQuantity?: number;
    headcount?: number;
    quantity?: number;
  }): Promise<ApiResponse<ApiAvailabilityResponse>> {
    const query = new URLSearchParams();
    query.append('facilityId', params.facilityId);
    query.append('startDateTime', params.startDateTime);
    query.append('endDateTime', params.endDateTime);
    if (params.resourceId) query.append('resourceId', params.resourceId);
    if (params.requestedQuantity) query.append('requestedQuantity', String(params.requestedQuantity));
    if (params.headcount) query.append('headcount', String(params.headcount));
    if (params.quantity) query.append('quantity', String(params.quantity));

    const url = getAmenityV2Url(`/availability?${query.toString()}`);
    const response = await apiClient.get<ApiResponse<ApiAvailabilityResponse>>(url);
    return extractEnvelope(response);
  },

  async getDailySlots(params: {
    facilityId: string;
    date: string;
    resourceId?: string;
    requestedQuantity?: number;
    headcount?: number;
    quantity?: number;
  }): Promise<ApiResponse<{ slots: ApiDailySlot[] }>> {
    const query = new URLSearchParams();
    query.append('facilityId', params.facilityId);
    query.append('date', params.date);
    if (params.resourceId) query.append('resourceId', params.resourceId);
    if (params.requestedQuantity) query.append('requestedQuantity', String(params.requestedQuantity));
    if (params.headcount) query.append('headcount', String(params.headcount));
    if (params.quantity) query.append('quantity', String(params.quantity));

    const url = getAmenityV2Url(`/availability/daily-slots?${query.toString()}`);
    const response = await apiClient.get<ApiResponse<{ slots: ApiDailySlot[] }>>(url);
    return extractEnvelope(response);
  },

  // ==========================================
  // 4. Pricing Calculation (/pricing)
  // ==========================================
  async calculatePricing(payload: CalculatePricingApiPayload): Promise<ApiResponse<ApiPricingSnapshot>> {
    const url = getAmenityV2Url('/pricing/calculate');
    const response = await apiClient.post<ApiResponse<ApiPricingSnapshot>>(url, payload);
    return extractEnvelope(response);
  },

  // ==========================================
  // 5. Reservation Holds (/holds)
  // ==========================================
  async createHold(
    payload: CreateHoldApiPayload,
    idempotencyKey?: string
  ): Promise<ApiResponse<ApiCreateHoldResponse>> {
    const key = idempotencyKey || generateUUID();
    const url = getAmenityV2Url('/holds');
    const response = await apiClient.post<ApiResponse<ApiCreateHoldResponse>>(url, payload, {
      headers: {
        'x-idempotency-key': key,
      },
    });
    return extractEnvelope(response);
  },

  async getHoldById(id: string): Promise<ApiResponse<ApiAmenityHold>> {
    const url = getAmenityV2Url(`/holds/${id}`);
    const response = await apiClient.get<ApiResponse<ApiAmenityHold>>(url);
    return extractEnvelope(response);
  },

  /** Releases a hold early (the resident abandoned the booking). */
  async releaseHold(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const url = getAmenityV2Url(`/holds/${id}/expire`);
    const response = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(url);
    return extractEnvelope(response);
  },

  // ==========================================
  // 6. Reservations (/reservations)
  // ==========================================
  async confirmReservation(
    payload: ConfirmReservationApiPayload,
    idempotencyKey?: string
  ): Promise<ApiResponse<any>> {
    // Deterministic idempotency key derived from hold ID unless explicitly provided
    const key = idempotencyKey || `confirm_hold_${payload.holdId}`;
    const url = getAmenityV2Url('/reservations/confirm');
    const response = await apiClient.post<ApiResponse<ApiAmenityReservation>>(url, payload, {
      headers: {
        'x-idempotency-key': key,
      },
    });
    return extractEnvelope(response);
  },

  // ==========================================
  // 6A. Amenity Payment (/payments)
  // ==========================================
  /**
   * Online payment order for the amount due now on a hold (`holdId`) or for the
   * outstanding balance of a booking (`reservationId`). Amounts come from the server.
   */
  async createReservationPaymentOrder(
    target: string | { holdId?: string; reservationId?: string }
  ): Promise<ApiResponse<ApiAmenityPaymentOrder>> {
    const body = typeof target === 'string' ? { holdId: target } : target;
    const url = getAmenityV2Url('/payments/orders');
    const response = await apiClient.post<ApiResponse<ApiAmenityPaymentOrder>>(url, body);
    return extractEnvelope(response);
  },

  /** Verifies the gateway response; the server settles it and returns the booking it created or completed. */
  async verifyReservationPayment(payload: {
    paymentId: string;
    orderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<ApiResponse<{ payment: { _id: string }; paymentId: string; reservation: any; fulfilled: boolean }>> {
    const url = getAmenityV2Url('/payments/verify');
    const response = await apiClient.post<
      ApiResponse<{ payment: { _id: string }; paymentId: string; reservation: any; fulfilled: boolean }>
    >(url, payload);
    return extractEnvelope(response);
  },

  /** Pays a booking's outstanding balance from the digital wallet. */
  async payReservationBalance(reservationId: string): Promise<ApiResponse<any>> {
    const url = getAmenityV2Url(`/reservations/${reservationId}/pay-balance`);
    const response = await apiClient.post<ApiResponse<any>>(url, { paymentMethod: 'WALLET' });
    return extractEnvelope(response);
  },

  async getReservations(params: {
    page?: number;
    limit?: number;
    facilityId?: string;
    resourceId?: string;
    residentId?: string;
    bookingStatus?: string;
    paymentStatus?: string;
    approvalStatus?: string;
    adminReviewStatus?: string;
    search?: string;
    unitId?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<ApiResponse<ApiPaginatedResponse<ApiAmenityReservation>>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.facilityId) query.append('facilityId', params.facilityId);
    if (params.resourceId) query.append('resourceId', params.resourceId);
    if (params.residentId) query.append('residentId', params.residentId);
    if (params.bookingStatus) query.append('bookingStatus', params.bookingStatus);
    if (params.paymentStatus) query.append('paymentStatus', params.paymentStatus);
    if (params.approvalStatus) query.append('approvalStatus', params.approvalStatus);
    if (params.adminReviewStatus) query.append('adminReviewStatus', params.adminReviewStatus);
    if (params.search) query.append('search', params.search);
    if (params.unitId) query.append('unitId', params.unitId);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);

    const queryString = query.toString();
    const url = getAmenityV2Url(`/reservations${queryString ? `?${queryString}` : ''}`);
    const response = await apiClient.get<ApiResponse<ApiPaginatedResponse<ApiAmenityReservation>>>(url);
    return extractEnvelope(response);
  },

  async getReservationById(id: string): Promise<ApiResponse<ApiAmenityReservation>> {
    const url = getAmenityV2Url(`/reservations/${id}`);
    const response = await apiClient.get<ApiResponse<ApiAmenityReservation>>(url);
    return extractEnvelope(response);
  },

  /** Refund the resident would get by cancelling now; changes nothing. */
  async getCancellationPreview(id: string): Promise<ApiResponse<any>> {
    const url = getAmenityV2Url(`/reservations/${id}/cancellation-preview`);
    const response = await apiClient.get<ApiResponse<any>>(url);
    return extractEnvelope(response);
  },

  async cancelReservation(
    id: string,
    payload?: CancelReservationApiPayload
  ): Promise<ApiResponse<ApiAmenityReservation>> {
    const url = getAmenityV2Url(`/reservations/${id}/cancel`);
    const response = await apiClient.post<ApiResponse<ApiAmenityReservation>>(url, payload || {});
    return extractEnvelope(response);
  },

  /** Staff decision on a booking flagged for review (no-show, unpaid balance, overdue return). */
  async resolveReservationReview(
    id: string,
    payload: { action: 'FORFEIT' | 'REFUND_POLICY' | 'REFUND_CUSTOM' | 'EXTEND'; refundPercentage?: number; notes?: string }
  ): Promise<ApiResponse<ApiAmenityReservation>> {
    const url = getAmenityV2Url(`/reservations/${id}/resolve-review`);
    const response = await apiClient.post<ApiResponse<ApiAmenityReservation>>(url, payload);
    return extractEnvelope(response);
  },

  async reviewReservation(
    id: string,
    payload: ReviewReservationApiPayload
  ): Promise<ApiResponse<ApiAmenityReservation>> {
    const url = getAmenityV2Url(`/reservations/${id}/review`);
    const response = await apiClient.post<ApiResponse<ApiAmenityReservation>>(url, payload);
    return extractEnvelope(response);
  },

  // ==========================================
  // 7. Access Passes (/passes)
  // ==========================================
  async getPassesByReservation(reservationId: string): Promise<ApiResponse<ApiAmenityAccessPass[]>> {
    const url = getAmenityV2Url(`/passes/reservation/${reservationId}`);
    const response = await apiClient.get<ApiResponse<ApiAmenityAccessPass[]>>(url);
    return extractEnvelope(response);
  },

  async getPasses(reservationId: string): Promise<ApiResponse<ApiAmenityAccessPass[]>> {
    return this.getPassesByReservation(reservationId);
  },

  async checkInPass(payload: CheckInPassApiPayload): Promise<ApiResponse<ApiAmenityAccessPass>> {
    const url = getAmenityV2Url('/passes/check-in');
    const response = await apiClient.post<ApiResponse<ApiAmenityAccessPass>>(url, payload);
    return extractEnvelope(response);
  },

  async checkOutPass(payload: CheckOutPassApiPayload): Promise<ApiResponse<any>> {
    const url = getAmenityV2Url('/passes/check-out');
    const response = await apiClient.post<ApiResponse<any>>(url, payload);
    return extractEnvelope(response);
  },

  /** Gate staff record the booking balance collected in cash (the exact amount due). */
  async collectReservationPayment(reservationId: string, amount: number): Promise<ApiResponse<any>> {
    const url = getAmenityV2Url(`/reservations/${reservationId}/collect-payment`);
    const response = await apiClient.post<ApiResponse<any>>(url, { amount });
    return extractEnvelope(response);
  },

  async revokePass(passId: string, reason: string): Promise<ApiResponse<ApiAmenityAccessPass>> {
    const url = getAmenityV2Url(`/passes/${passId}/revoke`);
    const response = await apiClient.post<ApiResponse<ApiAmenityAccessPass>>(url, { reason });
    return extractEnvelope(response);
  },

  // ==========================================
  // 8. Maintenance Blocks (/maintenance)
  // ==========================================
  async getOverlappingMaintenance(params: {
    facilityId: string;
    startDateTime: string;
    endDateTime: string;
  }): Promise<ApiResponse<ApiAmenityMaintenanceBlock[]>> {
    const query = new URLSearchParams();
    query.append('facilityId', params.facilityId);
    query.append('startDateTime', params.startDateTime);
    query.append('endDateTime', params.endDateTime);

    const url = getAmenityV2Url(`/maintenance/overlapping?${query.toString()}`);
    const response = await apiClient.get<ApiResponse<ApiAmenityMaintenanceBlock[]>>(url);
    return extractEnvelope(response);
  },

  async getMaintenanceById(blockId: string): Promise<ApiResponse<ApiAmenityMaintenanceBlock>> {
    const url = getAmenityV2Url(`/maintenance/${blockId}`);
    const response = await apiClient.get<ApiResponse<ApiAmenityMaintenanceBlock>>(url);
    return extractEnvelope(response);
  },

  async scheduleMaintenance(
    payload: ScheduleMaintenanceApiPayload
  ): Promise<ApiResponse<ApiAmenityMaintenanceBlock>> {
    const url = getAmenityV2Url('/maintenance');
    const response = await apiClient.post<ApiResponse<ApiAmenityMaintenanceBlock>>(url, payload);
    return extractEnvelope(response);
  },

  async listMaintenanceBlocks(params: {
    facilityId?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<ApiPaginatedResponse<ApiAmenityMaintenanceBlock>>> {
    const query = new URLSearchParams();
    if (params.facilityId) query.append('facilityId', params.facilityId);
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const queryString = query.toString();
    const url = getAmenityV2Url(`/maintenance${queryString ? `?${queryString}` : ''}`);
    const response = await apiClient.get<ApiResponse<ApiPaginatedResponse<ApiAmenityMaintenanceBlock>>>(url);
    return extractEnvelope(response);
  },

  async updateMaintenanceStatus(
    blockId: string,
    status: string
  ): Promise<ApiResponse<ApiAmenityMaintenanceBlock>> {
    const url = getAmenityV2Url(`/maintenance/${blockId}/status`);
    const response = await apiClient.patch<ApiResponse<ApiAmenityMaintenanceBlock>>(url, { status });
    return extractEnvelope(response);
  },

  async previewRecurringMaintenance(
    payload: PreviewRecurringMaintenanceApiPayload
  ): Promise<ApiResponse<any>> {
    const url = getAmenityV2Url('/maintenance/recurring/preview');
    const response = await apiClient.post<ApiResponse<any>>(url, payload);
    return extractEnvelope(response);
  },

  async scheduleRecurringMaintenance(
    payload: ScheduleRecurringMaintenanceApiPayload
  ): Promise<ApiResponse<any>> {
    const url = getAmenityV2Url('/maintenance/recurring');
    const response = await apiClient.post<ApiResponse<any>>(url, payload);
    return extractEnvelope(response);
  },

  async getRecurringSeries(seriesId: string): Promise<ApiResponse<any>> {
    const url = getAmenityV2Url(`/maintenance/recurring/${seriesId}`);
    const response = await apiClient.get<ApiResponse<any>>(url);
    return extractEnvelope(response);
  },

  async getRecurringSeriesOccurrences(
    seriesId: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<ApiResponse<ApiPaginatedResponse<ApiAmenityMaintenanceBlock>>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const queryString = query.toString();
    const url = getAmenityV2Url(`/maintenance/recurring/${seriesId}/occurrences${queryString ? `?${queryString}` : ''}`);
    const response = await apiClient.get<ApiResponse<ApiPaginatedResponse<ApiAmenityMaintenanceBlock>>>(url);
    return extractEnvelope(response);
  },

  async declareEmergencyMaintenance(
    payload: DeclareEmergencyMaintenanceApiPayload
  ): Promise<ApiResponse<ApiAmenityMaintenanceBlock>> {
    const url = getAmenityV2Url('/maintenance/emergency');
    const response = await apiClient.post<ApiResponse<ApiAmenityMaintenanceBlock>>(url, payload);
    return extractEnvelope(response);
  },

  async getImpactPreview(
    payload: MaintenanceImpactPreviewApiPayload
  ): Promise<ApiResponse<any>> {
    const url = getAmenityV2Url('/maintenance/impact-preview');
    const response = await apiClient.post<ApiResponse<any>>(url, payload);
    return extractEnvelope(response);
  },

  async getAlternatives(
    payload: FindAlternativesApiPayload
  ): Promise<ApiResponse<any>> {
    const url = getAmenityV2Url('/maintenance/alternatives');
    const response = await apiClient.post<ApiResponse<any>>(url, payload);
    return extractEnvelope(response);
  },

  async resolveMaintenanceImpact(
    blockId: string,
    payload: ResolveMaintenanceImpactApiPayload
  ): Promise<ApiResponse<any>> {
    const url = getAmenityV2Url(`/maintenance/${blockId}/resolve-impact`);
    const response = await apiClient.post<ApiResponse<any>>(url, payload);
    return extractEnvelope(response);
  },

  async extendMaintenanceBlock(
    blockId: string,
    payload: ExtendMaintenanceBlockApiPayload
  ): Promise<ApiResponse<ApiAmenityMaintenanceBlock>> {
    const url = getAmenityV2Url(`/maintenance/${blockId}/extend`);
    const response = await apiClient.patch<ApiResponse<ApiAmenityMaintenanceBlock>>(url, payload);
    return extractEnvelope(response);
  },

  async deleteMaintenanceBlock(blockId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const url = getAmenityV2Url(`/maintenance/${blockId}`);
    const response = await apiClient.delete<ApiResponse<{ success: boolean; message: string }>>(url);
    return extractEnvelope(response);
  },
};

export default amenityManagementService;
