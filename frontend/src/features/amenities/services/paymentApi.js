import apiClient from '../../../services/apiClient'

export const simulatePayment = async (
  paymentId,
  isSuccess,
  errorReason = null,
  paymentMethod = 'wallet',
) => {
  return await apiClient.post('/payments/simulate', {
    paymentId,
    isSuccess,
    errorReason,
    paymentMethod,
  })
}

export const verifyRazorpaySignature = async (payload) => {
  return await apiClient.post('/payments/verify-signature', payload)
}

export const getGatewayStatus = async () => {
  return await apiClient.get('/payments/status')
}
