import apiClient from '../../../services/apiClient.js'

const platformQuoteApi = {
  createQuote: async (payload) => {
    const response = await apiClient.post('/api/platform-quotes', payload)
    return response.data || response
  },
  generateOrder: async (quoteId, payload) => {
    const response = await apiClient.post(`/api/platform-quotes/${quoteId}/generate-order`, payload)
    return response.data || response
  },
}

export default platformQuoteApi
