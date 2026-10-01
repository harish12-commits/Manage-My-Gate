import apiClient from '../../../services/apiClient.js'

export const billingService = {
  /**
   * Fetch community billing dashboard statistics/KPIs.
   * @param {string} communityId
   */
  async getKPIs(communityId) {
    return await apiClient.get('/invoices/kpis', { params: { communityId } })
  },

  /**
   * Fetch personal outstanding dues for a resident.
   */
  async getMyDues() {
    return await apiClient.get('/invoices/my-dues')
  },

  /**
   * Fetch paginated and filtered invoices for the admin table grid.
   * @param {number} page
   * @param {number} limit
   * @param {Object} [filters]
   */
  async getInvoicesTable(page, limit, filters = {}) {
    return await apiClient.get('/invoices', { params: { page, limit, ...filters } })
  },

  /**
   * Manually trigger billing run.
   * @param {string} assessmentId
   * @param {string} billingPeriodString
   */
  async triggerManualBilling(assessmentId, billingPeriodString) {
    return await apiClient.post('/invoices/trigger-manual', {
      assessmentId,
      billingPeriodString,
    })
  },

  /**
   * Trigger the invoice generation / WhatsApp resend.
   */
  async triggerInvoiceGeneration(payload) {
    return await apiClient.post('/invoices/trigger-whatsapp', payload)
  },

  /**
   * Record an offline payment for verification (Bank Transfer).
   * @param {string} invoiceId
   * @param {Object} payload - { paymentReference, offlineReference, amountPaid, paymentMethod, paymentDate, paymentScreenshot }
   */
  async settleInvoiceOffline(invoiceId, payload) {
    return await apiClient.patch(`/invoices/${invoiceId}/settle-offline`, payload)
  },

  /**
   * Clear/approve offline Bank Transfer payment (Admin only).
   * @param {string} invoiceId
   */
  async approveInvoiceOffline(invoiceId) {
    return await apiClient.patch(`/invoices/${invoiceId}/approve`)
  },

  /**
   * Reject offline Bank Transfer payment (Admin only).
   * @param {string} invoiceId
   * @param {string} rejectionReason
   */
  async rejectInvoiceOffline(invoiceId, rejectionReason) {
    return await apiClient.patch(`/invoices/${invoiceId}/reject`, { rejectionReason })
  },

  /**
   * Record direct Cash payment (Facility In-Charge / Admin).
   * @param {string} invoiceId
   * @param {number} amount
   */
  async recordCashPayment(invoiceId, amount) {
    return await apiClient.post(`/invoices/${invoiceId}/record-cash`, { amount })
  },

  /**
   * Universal search box for eligible unpaid invoices for Cash collection.
   * @param {string} searchQuery
   */
  async searchCashEligible(searchQuery) {
    return await apiClient.get('/invoices/search-cash-eligible', { params: { q: searchQuery } })
  },

  /**
   * Fetch cash collections history for facility staff.
   */
  async getCashCollections() {
    return await apiClient.get('/invoices/cash-collections')
  },

  /**
   * Settle invoice payment using resident digital wallet balance.
   * @param {string} invoiceId
   * @param {number} amount
   */
  async payInvoiceWithWallet(invoiceId, amount) {
    const response = await apiClient.post('/wallet/pay-invoice', { invoiceId, amount })
    return response.data
  },

  /**
   * Create Razorpay payment order for an invoice.
   * @param {string} invoiceId
   * @param {number} amount
   */
  async createRazorpayOrder(invoiceId, amount) {
    return await apiClient.post('/payments/create-order', {
      referenceId: invoiceId,
      referenceType: 'Invoice',
      amount,
      currency: 'INR',
      gateway: 'razorpay',
    })
  },

  /**
   * Verify Razorpay cryptographic signature.
   * @param {Object} payload - { paymentId, razorpayPaymentId, razorpayOrderId, razorpaySignature }
   */
  async verifyRazorpayPayment(payload) {
    const formattedPayload = {
      paymentId: payload.paymentId || payload.payment_id,
      orderId: payload.razorpayOrderId || payload.orderId || payload.razorpay_order_id,
      razorpayPaymentId: payload.razorpayPaymentId || payload.razorpay_payment_id,
      razorpaySignature: payload.razorpaySignature || payload.razorpay_signature,
      payment_id: payload.paymentId || payload.payment_id,
      razorpay_payment_id: payload.razorpayPaymentId || payload.razorpay_payment_id,
      razorpay_order_id: payload.razorpayOrderId || payload.orderId || payload.razorpay_order_id,
      razorpay_signature: payload.razorpaySignature || payload.razorpay_signature,
    }
    return await apiClient.post('/payments/verify-signature', formattedPayload)
  },

  /**
   * Send reminder notification to all configured residents of the invoice.
   * @param {string} invoiceId
   */
  async sendInvoiceReminder(invoiceId) {
    return await apiClient.post(`/invoices/${invoiceId}/send-reminder`)
  },
}

export default billingService
