import apiClient from '../../../services/apiClient.js'

export const fetchEnquiries = async (params) => {
  const response = await apiClient.get('/platform-crm/enquiries', { params })
  return response.data || response
}

export const fetchEnquiryById = async (id) => {
  const response = await apiClient.get(`/platform-crm/enquiries/${id}`)
  return response.data || response
}

export const updateEnquiryStatus = async (id, data) => {
  const response = await apiClient.patch(`/platform-crm/enquiries/${id}/status`, data)
  return response.data || response
}

export const assignEnquiry = async (id, data) => {
  const response = await apiClient.patch(`/platform-crm/enquiries/${id}/assign`, data)
  return response.data || response
}

export const convertEnquiry = async (id) => {
  const response = await apiClient.post(`/platform-crm/enquiries/${id}/convert`)
  return response.data || response
}

// 360 View APIs
export const fetchActivities = async (id) => {
  const response = await apiClient.get(`/platform-crm/enquiries/${id}/activities`)
  return response.data || response
}

export const fetchStageHistory = async (id) => {
  const response = await apiClient.get(`/platform-crm/enquiries/${id}/stage-history`)
  return response.data || response
}

export const fetchInsights = async (id) => {
  const response = await apiClient.get(`/platform-crm/enquiries/${id}/insights`)
  return response.data || response
}

export const createActivity = async (id, data) => {
  const response = await apiClient.post(`/platform-crm/enquiries/${id}/activities`, data)
  return response.data || response
}

export const updateEnquiryStage = async (id, data) => {
  const response = await apiClient.patch(`/platform-crm/enquiries/${id}/stage`, data)
  return response.data || response
}
