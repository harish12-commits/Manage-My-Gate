import apiClient from '../../../services/apiClient.js'

const platformSubscriptionApi = {
  fetchMySubscription: async () => {
    const response = await apiClient.get('/api/platform-subscriptions/my-subscription')
    return response.data?.subscription || response.data || response
  },
}

export default platformSubscriptionApi
