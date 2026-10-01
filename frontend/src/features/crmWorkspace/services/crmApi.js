import apiClient from '../../../services/apiClient.js'

export const crmApi = {
  // --- CRM Inquiries ---
  /**
   * Fetch paginated list of CRM inquiries.
   * @param {Object} [params] - { page, limit, status, search, assignedAgentId }
   */
  async getInquiries(params = {}) {
    return await apiClient.get('/crm/inquiries', { params })
  },

  /**
   * Fetch a single CRM inquiry by ID.
   * @param {string} id
   */
  async getInquiryById(id) {
    return await apiClient.get(`/crm/inquiries/${id}`)
  },

  /**
   * Create a new CRM inquiry.
   * @param {Object} data
   */
  async createInquiry(data) {
    return await apiClient.post('/crm/inquiries', data)
  },

  /**
   * Update an existing CRM inquiry.
   * @param {string} id
   * @param {Object} data
   */
  async updateInquiry(id, data) {
    return await apiClient.put(`/crm/inquiries/${id}`, data)
  },

  /**
   * Transition inquiry status via backend state machine.
   * @param {string} id
   * @param {string} nextStatus
   * @param {Object} [metadata]
   */
  async transitionInquiryStatus(id, nextStatus, metadata = {}) {
    return await apiClient.patch(`/platform/inquiries/${id}/status`, { nextStatus, metadata })
  },

  /**
   * Fetch immutable timeline for an inquiry.
   * @param {string} id
   */
  async getInquiryTimeline(id) {
    return await apiClient.get(`/platform/inquiries/${id}/timeline`)
  },

  /**
   * Fetch inquiry summary metrics.
   * @param {string} id
   */
  async getInquirySummary(id) {
    return await apiClient.get(`/platform/inquiries/${id}/summary`)
  },

  /**
   * Delete a CRM inquiry by ID.
   * @param {string} id
   */
  async deleteInquiry(id) {
    return await apiClient.delete(`/crm/inquiries/${id}`)
  },

  /**
   * Fetch inquiries assigned to a specific user ("Assigned to Me").
   * @param {string} userId
   * @param {Object} [params]
   */
  async getInquiriesAssignedToMe(userId, params = {}) {
    return await apiClient.get('/crm/inquiries', {
      params: { ...params, assignedAgentId: userId },
    })
  },

  /**
   * Fetch unassigned inquiries.
   * @param {Object} [params]
   */
  async getUnassignedInquiries(params = {}) {
    return await apiClient.get('/crm/inquiries', {
      params: { ...params, assignedAgentId: 'null' },
    })
  },

  /**
   * Assign inquiry to a platform user.
   * @param {string} inquiryId
   * @param {string|null} userId
   */
  async assignInquiry(inquiryId, userId) {
    return await apiClient.patch(`/crm/inquiries/${inquiryId}/assign`, { userId })
  },

  // --- CRM Tasks ---
  /**
   * Fetch paginated list of CRM tasks.
   * @param {Object} [params] - { page, limit, status, assignedTo, relatedInquiryId, search }
   */
  async getTasks(params = {}) {
    return await apiClient.get('/crm/tasks', { params })
  },

  /**
   * Fetch a single CRM task by ID.
   * @param {string} id
   */
  async getTaskById(id) {
    return await apiClient.get(`/crm/tasks/${id}`)
  },

  /**
   * Create a new CRM task.
   * @param {Object} data
   */
  async createTask(data) {
    return await apiClient.post('/crm/tasks', data)
  },

  /**
   * Update an existing CRM task.
   * @param {string} id
   * @param {Object} data
   */
  async updateTask(id, data) {
    return await apiClient.put(`/crm/tasks/${id}`, data)
  },

  /**
   * Delete a CRM task by ID.
   * @param {string} id
   */
  async deleteTask(id) {
    return await apiClient.delete(`/crm/tasks/${id}`)
  },

  // --- CRM Meetings ---
  /**
   * Fetch paginated list of CRM meetings.
   * @param {Object} [params] - { page, limit, status, inquiryId, search }
   */
  async getMeetings(params = {}) {
    return await apiClient.get('/crm/meetings', { params })
  },

  /**
   * Fetch a single CRM meeting by ID.
   * @param {string} id
   */
  async getMeetingById(id) {
    return await apiClient.get(`/crm/meetings/${id}`)
  },

  /**
   * Schedule a new CRM meeting.
   * @param {Object} data
   */
  async scheduleMeeting(data) {
    return await apiClient.post('/crm/meetings', data)
  },

  /**
   * Update an existing CRM meeting.
   * @param {string} id
   * @param {Object} data
   */
  async updateMeeting(id, data) {
    return await apiClient.put(`/crm/meetings/${id}`, data)
  },

  /**
   * Delete a CRM meeting by ID.
   * @param {string} id
   */
  async deleteMeeting(id) {
    return await apiClient.delete(`/crm/meetings/${id}`)
  },

  /**
   * Check platform user availability for a given time window.
   * @param {Array<string>} userIds
   * @param {string|Date} startTime
   * @param {string|Date} endTime
   * @param {string} [excludeMeetingId]
   */
  async checkPlatformUserAvailability(userIds, startTime, endTime, excludeMeetingId = null) {
    return await apiClient.post('/crm/meetings/check-availability', {
      userIds,
      startTime,
      endTime,
      excludeMeetingId,
    })
  },

  // --- CRM Threads ---
  /**
   * Fetch thread for a specific inquiry.
   * @param {string} inquiryId
   */
  async getThreadByInquiryId(inquiryId) {
    return await apiClient.get(`/crm/threads/inquiry/${inquiryId}`)
  },

  /**
   * Send a message to an inquiry's thread.
   * @param {string} inquiryId
   * @param {Object} messageData
   */
  async sendThreadMessage(inquiryId, messageData) {
    return await apiClient.post(`/crm/threads/inquiry/${inquiryId}/messages`, messageData)
  },
}

export default crmApi
