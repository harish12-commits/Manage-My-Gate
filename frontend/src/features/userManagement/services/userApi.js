import apiClient from '../../../services/apiClient'

/**
 * User API Service
 *
 * Invokes real backend endpoints for User Management operations.
 */

/**
 * Fetches all users from the backend.
 * @returns {Promise<Array>}
 */
export const fetchUsers = async ({
  page = 1,
  limit = 10,
  search = '',
  roles = [],
  status = [],
} = {}) => {
  const params = new URLSearchParams()
  params.append('page', page)
  params.append('limit', limit)
  if (search) params.append('search', search)
  if (roles && roles.length > 0) params.append('roles', roles.join(','))
  if (status && status.length > 0) params.append('status', status.join(','))

  const response = await apiClient.get(`/users?${params.toString()}`)
  return response.data
}

/**
 * Invites a new user.
 * @param {string} email
 * @returns {Promise<Object>} The newly created user object.
 */
export const inviteUser = async (inviteData) => {
  const base = typeof inviteData === 'string' ? { email: inviteData } : inviteData
  const payload = { ...base, invitationSource: 'WEB' }
  const response = await apiClient.post('/users/invite', payload, {
    headers: { 'X-Client-Type': 'WEB' },
  })
  return response.data
}

/**
 * Deletes a user by ID.
 * @param {number} userId
 * @returns {Promise<number>} Resolves with the deleted user's ID.
 */
export const deleteUser = async (userId, villaId = null) => {
  if (villaId) {
    // Remove user from a specific unit instead of entire org
    await apiClient.delete(`/villas/${villaId}/residents/${userId}`)
    return { userId, villaId }
  }
  await apiClient.delete(`/users/${userId}`)
  return { userId, villaId: null }
}

/**
 * Updates roles for a user.
 * @param {number} userId
 * @param {Array<string>} roles
 * @returns {Promise<Object>} Resolves with the updated userId and new roles array.
 */
export const updateUserRoles = async (userId, roles, villaId = null) => {
  const payload = { roles }
  if (villaId) payload.villaId = villaId

  await apiClient.put(`/users/${userId}/roles`, payload)
  return { userId, roles, villaId }
}

/**
 * Bulk invites multiple users.
 * @param {Array<Object>} invitations
 * @returns {Promise<Object>}
 */
export const bulkInviteUsers = async (invitations) => {
  const payload = invitations.map((inv) => ({
    ...inv,
    invitationSource: 'WEB',
  }))
  const response = await apiClient.post(
    '/users/bulk-invite',
    { invitations: payload, invitationSource: 'WEB' },
    { headers: { 'X-Client-Type': 'WEB' } },
  )
  return response.data
}

/**
 * Fetches organization invitations with pagination, status filtering, and search.
 * @param {Object} params
 * @returns {Promise<Object>}
 */
export const fetchInvitations = async ({
  page = 1,
  limit = 10,
  status = 'ALL',
  search = '',
  sortBy = 'createdAt',
  sortOrder = 'desc',
} = {}) => {
  const params = new URLSearchParams()
  params.append('page', page)
  params.append('limit', limit)
  if (status && status !== 'ALL') params.append('status', status)
  if (search) params.append('search', search)
  if (sortBy) params.append('sortBy', sortBy)
  if (sortOrder) params.append('sortOrder', sortOrder)

  const response = await apiClient.get(`/users/invitations?${params.toString()}`)
  return response.data
}

/**
 * Resends an eligible invitation with a newly minted secure token.
 * @param {string} invitationId
 * @returns {Promise<Object>}
 */
export const resendInvitation = async (invitationId) => {
  const response = await apiClient.post(`/users/invitations/${invitationId}/resend`)
  return response.data
}

/**
 * Revokes a pending invitation.
 * @param {string} invitationId
 * @returns {Promise<Object>}
 */
export const revokeInvitation = async (invitationId) => {
  const response = await apiClient.post(`/users/invitations/${invitationId}/revoke`)
  return response.data
}
