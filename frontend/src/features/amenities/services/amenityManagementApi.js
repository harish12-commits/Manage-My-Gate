import apiClient from '../../../services/apiClient.js'

const BASE_PATH = '/api/v2/amenity-management'

export const amenityManagementApi = {
  // ==========================================
  // 1. Facilities
  // ==========================================
  listFacilities: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await apiClient.get(`${BASE_PATH}/facilities${queryString ? `?${queryString}` : ''}`)
  },

  getFacility: async (facilityId) => {
    return await apiClient.get(`${BASE_PATH}/facilities/${facilityId}`)
  },

  getFacilityByCode: async (code) => {
    return await apiClient.get(`${BASE_PATH}/facilities/code/${code}`)
  },

  createFacility: async (data) => {
    return await apiClient.post(`${BASE_PATH}/facilities`, data)
  },

  updateFacility: async (facilityId, data) => {
    return await apiClient.patch(`${BASE_PATH}/facilities/${facilityId}`, data)
  },

  deleteFacility: async (facilityId) => {
    return await apiClient.delete(`${BASE_PATH}/facilities/${facilityId}`)
  },

  // ==========================================
  // 2. Resources
  // ==========================================
  listResources: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await apiClient.get(`${BASE_PATH}/resources${queryString ? `?${queryString}` : ''}`)
  },

  getResourcesByFacility: async (facilityId) => {
    return await apiClient.get(`${BASE_PATH}/resources/facility/${facilityId}`)
  },

  getResource: async (resourceId) => {
    return await apiClient.get(`${BASE_PATH}/resources/${resourceId}`)
  },

  createResource: async (data) => {
    return await apiClient.post(`${BASE_PATH}/resources`, data)
  },

  updateResource: async (resourceId, data) => {
    return await apiClient.patch(`${BASE_PATH}/resources/${resourceId}`, data)
  },

  deleteResource: async (resourceId) => {
    return await apiClient.delete(`${BASE_PATH}/resources/${resourceId}`)
  },

  // ==========================================
  // 3. Availability & Pricing
  // ==========================================
  checkAvailability: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await apiClient.get(`${BASE_PATH}/availability${queryString ? `?${queryString}` : ''}`)
  },

  calculatePricing: async (data) => {
    return await apiClient.post(`${BASE_PATH}/pricing/calculate`, data)
  },

  // ==========================================
  // 4. Holds
  // ==========================================
  createHold: async (data, headers = {}) => {
    return await apiClient.post(`${BASE_PATH}/holds`, data, { headers })
  },

  getHold: async (holdId) => {
    return await apiClient.get(`${BASE_PATH}/holds/${holdId}`)
  },

  expireHold: async (holdId) => {
    return await apiClient.post(`${BASE_PATH}/holds/${holdId}/expire`)
  },

  // ==========================================
  // 5. Reservations
  // ==========================================
  confirmReservation: async (data, headers = {}) => {
    return await apiClient.post(`${BASE_PATH}/reservations/confirm`, data, { headers })
  },

  listReservations: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await apiClient.get(`${BASE_PATH}/reservations${queryString ? `?${queryString}` : ''}`)
  },

  getReservation: async (reservationId) => {
    return await apiClient.get(`${BASE_PATH}/reservations/${reservationId}`)
  },

  cancelReservation: async (reservationId, data = {}) => {
    return await apiClient.post(`${BASE_PATH}/reservations/${reservationId}/cancel`, data)
  },

  reviewReservation: async (reservationId, data) => {
    return await apiClient.post(`${BASE_PATH}/reservations/${reservationId}/review`, data)
  },

  // ==========================================
  // 6. Access Passes
  // ==========================================
  checkInPass: async (data) => {
    return await apiClient.post(`${BASE_PATH}/passes/check-in`, data)
  },

  checkOutPass: async (data) => {
    return await apiClient.post(`${BASE_PATH}/passes/check-out`, data)
  },

  getReservationPasses: async (reservationId) => {
    return await apiClient.get(`${BASE_PATH}/passes/reservation/${reservationId}`)
  },

  revokePass: async (passId, data = {}) => {
    return await apiClient.post(`${BASE_PATH}/passes/${passId}/revoke`, data)
  },

  // ==========================================
  // 7. Maintenance Blocks
  // ==========================================
  listMaintenance: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await apiClient.get(`${BASE_PATH}/maintenance${queryString ? `?${queryString}` : ''}`)
  },

  getMaintenanceBlock: async (blockId) => {
    return await apiClient.get(`${BASE_PATH}/maintenance/${blockId}`)
  },

  scheduleMaintenance: async (data, headers = {}) => {
    return await apiClient.post(`${BASE_PATH}/maintenance`, data, { headers })
  },

  getImpactPreview: async (data) => {
    return await apiClient.post(`${BASE_PATH}/maintenance/impact-preview`, data)
  },

  getImpacts: async (blockId) => {
    return await apiClient.get(`${BASE_PATH}/maintenance/${blockId}/impacts`)
  },

  resolveMaintenanceImpact: async (blockId, data) => {
    return await apiClient.post(`${BASE_PATH}/maintenance/${blockId}/resolve-impact`, data)
  },

  getAlternatives: async (data) => {
    return await apiClient.post(`${BASE_PATH}/maintenance/alternatives`, data)
  },

  getOverlappingMaintenance: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await apiClient.get(
      `${BASE_PATH}/maintenance/overlapping${queryString ? `?${queryString}` : ''}`,
    )
  },

  updateMaintenanceStatus: async (blockId, data) => {
    return await apiClient.patch(`${BASE_PATH}/maintenance/${blockId}/status`, data)
  },

  extendMaintenanceBlock: async (blockId, data) => {
    return await apiClient.patch(`${BASE_PATH}/maintenance/${blockId}/extend`, data)
  },

  declareEmergencyMaintenance: async (data, headers = {}) => {
    return await apiClient.post(`${BASE_PATH}/maintenance/emergency`, data, { headers })
  },

  previewRecurringMaintenance: async (data) => {
    return await apiClient.post(`${BASE_PATH}/maintenance/recurring/preview`, data)
  },

  scheduleRecurringMaintenance: async (data, headers = {}) => {
    return await apiClient.post(`${BASE_PATH}/maintenance/recurring`, data, { headers })
  },

  getRecurringSeries: async (seriesId) => {
    return await apiClient.get(`${BASE_PATH}/maintenance/recurring/${seriesId}`)
  },

  getRecurringSeriesOccurrences: async (seriesId, params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await apiClient.get(
      `${BASE_PATH}/maintenance/recurring/${seriesId}/occurrences${queryString ? `?${queryString}` : ''}`,
    )
  },
}

export default amenityManagementApi
