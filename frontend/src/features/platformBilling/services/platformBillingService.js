import axiosInstance from '../../../api/axiosInstance'

/**
 * Fetches all CRM inquiries from the backend.
 */
export const fetchInquiries = async () => {
  const response = await axiosInstance.get('/api/crm/inquiries')
  return response.data
}

export const createInquiry = async (data) => {
  const response = await axiosInstance.post('/api/crm/inquiries', data)
  return response.data
}

/**
 * Master Pricing APIs
 */
export const fetchMasterPricing = async () => {
  const response = await axiosInstance.get('/api/master-pricing')
  return response.data
}

export const createMasterPricing = async (data) => {
  const response = await axiosInstance.post('/api/master-pricing', data)
  return response.data
}

export const updateMasterPricing = async (id, data) => {
  const response = await axiosInstance.put(`/api/master-pricing/${id}`, data)
  return response.data
}

/**
 * Platform Quotes APIs
 */
export const fetchQuotes = async () => {
  const response = await axiosInstance.get('/api/platform-quotes')
  return response.data
}

export const generateQuoteAndProvision = async (quoteData) => {
  // Using the quote API to create a new quote
  const response = await axiosInstance.post('/api/platform-quotes', quoteData)
  return response.data
}

/**
 * Platform Orders APIs
 */
export const fetchOrders = async () => {
  const response = await axiosInstance.get('/api/platform-orders')
  return response.data
}

/**
 * Platform Invoices APIs
 */
export const fetchInvoices = async () => {
  const response = await axiosInstance.get('/api/platform-invoices')
  return response.data
}

export const downloadInvoicePdf = async (invoiceId) => {
  const response = await axiosInstance.get(
    `/api/platform-invoices/${invoiceId}/download-pdf?lang=en`,
    {
      responseType: 'blob',
    },
  )
  return response.data || response
}

/**
 * Platform Subscriptions APIs
 */
export const fetchSubscriptions = async () => {
  const response = await axiosInstance.get('/api/platform-subscriptions')
  return response.data
}

export const renewSubscription = async (id, data) => {
  const response = await axiosInstance.post(`/api/platform-subscriptions/${id}/renew`, data)
  return response.data
}

/**
 * Platform Provisioning Jobs APIs
 */
export const fetchProvisioningJobs = async () => {
  const response = await axiosInstance.get('/api/platform-provisioning-jobs')
  return response.data
}
