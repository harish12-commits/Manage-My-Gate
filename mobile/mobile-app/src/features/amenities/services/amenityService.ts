import apiClient from '../../../services/apiClient';

export interface FetchAmenitiesParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
}

export interface CreateBookingPayload {
  amenityId: string;
  date?: string; // YYYY-MM-DD
  bookingDate?: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  slotId?: string;
  paymentMethod?: 'WALLET' | 'PAY_AT_GATE' | 'ONLINE';
  guestsCount?: number;
  numberOfPersons?: number;
  notes?: string;
}

export interface CheckInPayload {
  qrPayload?: string;
}

export const getAmenities = async (params: FetchAmenitiesParams = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));
  if (params.search) query.append('search', params.search);
  if (params.category && params.category !== 'All') query.append('category', params.category);
  if (params.status) query.append('status', params.status);

  const queryString = query.toString();
  return await apiClient.get(`/amenities${queryString ? `?${queryString}` : ''}`);
};

export const getAmenityById = async (id: string) => {
  return await apiClient.get(`/amenities/${id}`);
};

export const getAmenitySlots = async (id: string, date: string) => {
  return await apiClient.get(`/amenities/${id}/slots?date=${date}`);
};

export const createAmenityBooking = async (payload: CreateBookingPayload, idempotencyKey?: string) => {
  const bookingDate = payload.bookingDate || payload.date;
  const numberOfPersons = payload.numberOfPersons ?? payload.guestsCount ?? 1;

  const normalizedPayload = {
    ...payload,
    bookingDate,
    date: bookingDate,
    numberOfPersons,
    guestsCount: numberOfPersons,
  };
  const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined;
  return await apiClient.post('/amenity-bookings', normalizedPayload, { headers });
};

export const getMyBookings = async (params: { page?: number; limit?: number; status?: string } = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));
  if (params.status) query.append('status', params.status);

  const queryString = query.toString();
  return await apiClient.get(`/amenity-bookings/my-bookings${queryString ? `?${queryString}` : ''}`);
};

export const checkInBooking = async (id: string, payload: CheckInPayload = {}) => {
  return await apiClient.post(`/amenity-bookings/${id}/checkin`, payload);
};

export const cancelBooking = async (id: string, reason?: string) => {
  return await apiClient.put(`/amenity-bookings/${id}/cancel`, { reason });
};

export const getWalletBalance = async () => {
  return await apiClient.get('/wallet');
};

/**
 * @deprecated Direct balance injection is decommissioned. Use walletService.createWalletOrder and verifyWalletPayment.
 */
export const topUpWallet = async (amount: number) => {
  return await apiClient.post('/wallet/create-order', { amount });
};

export const createAmenity = async (payload: any) => {
  return await apiClient.post('/amenities', payload);
};

export const updateAmenity = async (id: string, payload: any) => {
  return await apiClient.put(`/amenities/${id}`, payload);
};

export const deleteAmenity = async (id: string, force?: boolean) => {
  return await apiClient.delete(`/amenities/${id}${force ? '?force=true' : ''}`);
};

export const updateAmenityStatus = async (id: string, status: string, force?: boolean) => {
  return await apiClient.patch(`/amenities/${id}/status`, { status: status.toLowerCase(), force });
};

export const getMaintenanceList = async () => {
  return await apiClient.get('/amenities/maintenance');
};

export const scheduleMaintenance = async (id: string, payload: any) => {
  return await apiClient.post(`/amenities/${id}/maintenance`, payload);
};

export const updateMaintenanceTask = async (amenityId: string, maintenanceId: string, payload: any) => {
  return await apiClient.put(`/amenities/${amenityId}/maintenance/${maintenanceId}`, payload);
};

export const deleteMaintenanceTask = async (amenityId: string, maintenanceId: string) => {
  return await apiClient.delete(`/amenities/${amenityId}/maintenance/${maintenanceId}`);
};

export const removeMaintenance = async (id: string) => {
  return await apiClient.delete(`/amenities/${id}/maintenance`);
};

export const getAdminCalendar = async (params: {
  date?: string;
  startDate?: string;
  endDate?: string;
  amenityId?: string;
  status?: string;
  search?: string;
  paymentStatus?: string;
} = {}) => {
  const query = new URLSearchParams();
  if (params.date) query.append('date', params.date);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.amenityId && params.amenityId !== 'All') query.append('amenityId', params.amenityId);
  if (params.status && params.status !== 'All') query.append('status', params.status);
  if (params.search) query.append('search', params.search);
  if (params.paymentStatus && params.paymentStatus !== 'All') query.append('paymentStatus', params.paymentStatus);
  const queryString = query.toString();
  return await apiClient.get(`/amenity-bookings/admin-calendar${queryString ? `?${queryString}` : ''}`);
};

export const createManualBooking = async (payload: {
  amenityId: string;
  residentId?: string;
  villaNumber?: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}) => {
  return await apiClient.post('/amenity-bookings/manual', payload);
};

export const adminCancelBooking = async (id: string, reason?: string) => {
  return await apiClient.put(`/amenity-bookings/${id}/admin-cancel`, { reason });
};

export const getRecentScans = async (params: { page?: number; limit?: number } = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));
  const queryString = query.toString();
  return await apiClient.get(`/amenity-bookings/scans/recent${queryString ? `?${queryString}` : ''}`);
};

export const getDashboardStats = async () => {
  return await apiClient.get('/amenity-bookings/stats/dashboard');
};

export const getRevenueStats = async () => {
  return await apiClient.get('/amenity-bookings/stats/revenue');
};

export const getBookingQueue = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  amenityId?: string;
  datePreset?: string;
  startDate?: string;
  endDate?: string;
} = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));
  if (params.search) query.append('search', params.search);
  if (params.status && params.status !== 'All') query.append('status', params.status);
  if (params.paymentStatus && params.paymentStatus !== 'All') query.append('paymentStatus', params.paymentStatus);
  if (params.amenityId && params.amenityId !== 'All') query.append('amenityId', params.amenityId);
  if (params.datePreset && params.datePreset !== 'all') query.append('datePreset', params.datePreset);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);

  const queryString = query.toString();
  return await apiClient.get(`/amenity-bookings/queue${queryString ? `?${queryString}` : ''}`);
};

export default {
  getAmenities,
  getAmenityById,
  getAmenitySlots,
  createAmenityBooking,
  getMyBookings,
  checkInBooking,
  cancelBooking,
  getWalletBalance,
  topUpWallet,
  createAmenity,
  updateAmenity,
  deleteAmenity,
  updateAmenityStatus,
  scheduleMaintenance,
  removeMaintenance,
  getAdminCalendar,
  createManualBooking,
  adminCancelBooking,
  getRecentScans,
  getDashboardStats,
  getRevenueStats,
  getBookingQueue,
  getMaintenanceList,
  updateMaintenanceTask,
  deleteMaintenanceTask,
};
