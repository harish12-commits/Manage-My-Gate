import apiClient from '../../../services/apiClient';
import { getIdempotencyHeaders } from '../../../utils/idempotency';
import {
  BillingKPIs,
  OfflineSettlementPayload,
  RazorpayVerificationPayload,
} from '../types';
import paymentService from '../../payment/services/paymentService';

export const billingService = {
  /**
   * Fetch community billing dashboard statistics/KPIs.
   * @param communityId
   */
  async getKPIs(communityId: string): Promise<BillingKPIs> {
    const response: any = await apiClient.get('/invoices/kpis', { params: { communityId } });
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Fetch personal outstanding dues for a resident.
   * @param communityId - Optional active community ID
   */
  async getMyDues(communityId?: string): Promise<any> {
    const response: any = await apiClient.get('/invoices/my-dues', {
      params: communityId ? { communityId } : undefined,
    });
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Fetch single invoice details by ID.
   * @param id
   */
  async getInvoiceById(id: string): Promise<any> {
    const response: any = await apiClient.get(`/invoices/${id}`);
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Fetch paginated and filtered invoices for the grid/list.
   * @param page
   * @param limit
   * @param filters
   */
  async getInvoicesTable(page: number, limit: number, filters: Record<string, any> = {}): Promise<any> {
    const response: any = await apiClient.get('/invoices', { params: { page, limit, ...filters } });
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Manually trigger billing run.
   * @param assessmentId
   * @param billingPeriodString
   */
  async triggerManualBilling(assessmentId: string, billingPeriodString: string): Promise<any> {
    const response: any = await apiClient.post('/invoices/trigger-manual', {
      assessmentId,
      billingPeriodString,
    });
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Trigger invoice generation / notification delivery.
   * @param payload
   */
  async triggerInvoiceGeneration(payload: Record<string, any> = {}): Promise<any> {
    const response: any = await apiClient.post('/invoices/trigger-whatsapp', payload);
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Upload payment proof document / image.
   * @param formData
   */
  async uploadProof(formData: any): Promise<{ url: string }> {
    const response: any = await apiClient.post('/invoices/upload-proof', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Record an offline payment for verification.
   * @param invoiceId
   * @param payload
   */
  async settleInvoiceOffline(invoiceId: string, payload: OfflineSettlementPayload): Promise<any> {
    const response: any = await apiClient.patch(`/invoices/${invoiceId}/settle-offline`, payload);
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Clear/approve offline payment (Admin only).
   * @param invoiceId
   * @param payload (optional settlement details: full or custom amount)
   */
  async approveInvoiceOffline(
    invoiceId: string,
    payload?: {
      amount?: number;
      settlementType?: 'FULL' | 'CUSTOM';
      paymentMethod?: string;
      paymentReference?: string;
      reference?: string;
      notes?: string;
      paymentScreenshot?: string;
    }
  ): Promise<any> {
    const response: any = await apiClient.patch(`/invoices/${invoiceId}/approve`, payload || {});
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Reject offline payment submission (Admin only).
   * @param invoiceId
   * @param reason
   */
  async rejectInvoiceOffline(invoiceId: string, reason?: string): Promise<any> {
    const response: any = await apiClient.patch(`/invoices/${invoiceId}/reject`, { reason });
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Settle invoice payment using resident digital wallet balance.
   * @param invoiceId
   * @param amount
   * @param idempotencyKey
   */
  async payInvoiceWithWallet(invoiceId: string, amount: number, idempotencyKey?: string): Promise<any> {
    const headers = getIdempotencyHeaders(idempotencyKey);
    const response: any = await apiClient.post(
      '/wallet/pay-invoice',
      { invoiceId, amount },
      { headers: Object.keys(headers).length > 0 ? headers : undefined }
    );
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Create Razorpay payment order for an invoice.
   * Delegates directly to canonical Payment Core boundary.
   * @param invoiceId
   * @param amount
   * @param idempotencyKey
   */
  async createRazorpayOrder(invoiceId: string, amount: number, idempotencyKey?: string): Promise<any> {
    return await paymentService.createPaymentOrder(
      {
        referenceId: invoiceId,
        referenceType: 'Invoice',
        amount,
        currency: 'INR',
        gateway: 'razorpay',
      },
      idempotencyKey
    );
  },

  /**
   * Verify Razorpay cryptographic signature.
   * Delegates directly to canonical Payment Core boundary.
   * @param payload
   * @param idempotencyKey
   */
  async verifyRazorpayPayment(payload: RazorpayVerificationPayload, idempotencyKey?: string): Promise<any> {
    return await paymentService.verifyPaymentSignature(payload, idempotencyKey);
  },


  /**
   * Send available wallet credit back through Razorpay. The backend validates
   * the selected top-up and returns funds to its original UPI/card account.
   */
  async refundWalletToOriginalPayment(paymentId: string, amount: number): Promise<any> {
    const response: any = await apiClient.post('/wallet/refund', { paymentId, amount });
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Create a new community assessment rule (Admin/Finance).
   * @param payload
   */
  async createAssessment(payload: Record<string, any>): Promise<any> {
    const response: any = await apiClient.post('/assessments', payload);
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Update an existing assessment rule template (Admin/Finance).
   * @param assessmentId
   * @param payload
   */
  async updateAssessment(assessmentId: string, payload: Record<string, any>): Promise<any> {
    const response: any = await apiClient.patch(`/assessments/${assessmentId}`, payload);
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Fetch community assessment rules list (Admin/Finance).
   */
  async getAssessments(): Promise<any> {
    const response: any = await apiClient.get('/assessments');
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Delete an assessment rule (Admin/Finance).
   * Performs physical delete if untriggered, or soft-delete (archived) if invoices exist.
   * @param assessmentId
   */
  async deleteAssessment(assessmentId: string): Promise<any> {
    const response: any = await apiClient.delete(`/assessments/${assessmentId}`);
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Send an in-app reminder notification to the resident for an individual invoice.
   * @param invoiceId
   */
  async sendInvoiceReminder(invoiceId: string): Promise<any> {
    const response: any = await apiClient.post(`/invoices/${invoiceId}/send-reminder`);
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Send an in-app reminder notification to a resident for their overall dues portfolio.
   * @param payload
   */
  async notifyResidentPortfolio(payload: {
    residentUserId: string;
    residentName?: string;
    totalDue: number;
    units?: string[];
  }): Promise<any> {
    const response: any = await apiClient.post('/invoices/notify-resident', payload);
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },
};

export default billingService;
