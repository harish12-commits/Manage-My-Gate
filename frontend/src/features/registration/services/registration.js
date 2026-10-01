import apiClient from '../../../services/apiClient.js'

export const submitEnquiry = async (data) => {
  const response = await apiClient.post('/api/platform-crm/enquiry', data)
  return response.data || response
}
