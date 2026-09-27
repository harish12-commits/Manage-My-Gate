/**
 * NAHOM / Connect Harmony - Unified Payment Service (Mobile Client)
 *
 * Authoritative API client interfacing with backend Unified Payment Core (/payments).
 * Handles payment order creation, signature verification, gateway tenant status,
 * and generic active payment session persistence for recovery.
 *
 * Boundaries:
 * - Domain-neutral Payment Core API operations only.
 * - Does NOT contain invoice-specific business logic or endpoints.
 * - Does NOT perform client-side financial balance mutations or local settlement decisions.
 */

import apiClient from '../../../services/apiClient';
import storage from '../../../utils/storage';
import { getIdempotencyHeaders } from '../../../utils/idempotency';

export interface CreatePaymentOrderParams {
  referenceId: string;
  referenceType: 'Invoice' | 'AmenityBooking' | 'WalletRecharge' | string;
  amount: number;
  currency?: string;
  gateway?: 'razorpay' | string;
}

export interface PaymentOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  razorpayKeyId?: string;
  paymentId?: string;
  status?: string;
  [key: string]: any;
}

export interface VerifyPaymentSignaturePayload {
  paymentId?: string;
  orderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  // Casing fallbacks
  payment_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  razorpayOrderId?: string;
}

export interface PaymentGatewayStatus {
  isConfigured: boolean;
  provider?: string;
  keyId?: string;
}

/**
 * Reusable Active Payment Session representation for in-flight or reconciling financial operations.
 */
export type ActivePaymentSessionStatus =
  | 'CREATING_ORDER'
  | 'CHECKOUT'
  | 'VERIFYING'
  | 'CHECKING'
  | 'SUBMITTING'
  | 'PENDING_VERIFICATION'
  | 'SUCCESS'
  | 'REJECTED'
  | 'FAILED';

export interface ActivePaymentSession {
  operationId: string;
  referenceType: string;
  referenceId: string;
  amount: number;
  currency: string;

  paymentId?: string;
  orderId?: string;
  paymentMethod?: string;
  offlineReference?: string;
  proofUrl?: string;
  notes?: string;

  status: ActivePaymentSessionStatus;
  createdAt: string;
}

export type OfflinePaymentSession = ActivePaymentSession;

const buildSessionStorageKey = (referenceType: string, referenceId: string): string => {
  return `@mmg_active_payment_${referenceType}_${referenceId}`;
};

const ACTIVE_SESSIONS_INDEX_KEY = '@mmg_active_payment_sessions_index';

interface SessionIndexEntry {
  referenceType: string;
  referenceId: string;
  operationId?: string;
  updatedAt: string;
}

const updateActiveSessionsIndex = async (
  referenceType: string,
  referenceId: string,
  action: 'ADD' | 'REMOVE',
  operationId?: string
): Promise<void> => {
  try {
    const raw = await storage.getItem(ACTIVE_SESSIONS_INDEX_KEY);
    let index: SessionIndexEntry[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(index)) index = [];

    if (action === 'ADD') {
      const existingIdx = index.findIndex(
        (e) => e.referenceType === referenceType && e.referenceId === referenceId
      );
      const entry: SessionIndexEntry = {
        referenceType,
        referenceId,
        operationId,
        updatedAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        index[existingIdx] = entry;
      } else {
        index.push(entry);
      }
    } else {
      index = index.filter(
        (e) => !(e.referenceType === referenceType && e.referenceId === referenceId)
      );
    }
    await storage.setItem(ACTIVE_SESSIONS_INDEX_KEY, JSON.stringify(index));
  } catch (err) {
    // Non-blocking index management
  }
};

export const paymentService = {
  /**
   * Create Razorpay payment order via Unified Payment Core.
   * @param params Order specifications (referenceId, referenceType, amount, currency)
   * @param idempotencyKey Optional deterministic mutation key
   */
  async createPaymentOrder(
    params: CreatePaymentOrderParams,
    idempotencyKey?: string
  ): Promise<PaymentOrderResponse> {
    const payload = {
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      amount: params.amount,
      currency: params.currency || 'INR',
      gateway: params.gateway || 'razorpay',
    };

    const headers = getIdempotencyHeaders(idempotencyKey);
    const response: any = await apiClient.post('/payments/create-order', payload, {
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Verify Razorpay cryptographic signature and settle payment via backend Unified Payment Core.
   * @param payload Gateway verification tokens
   * @param idempotencyKey Optional deterministic verification key
   */
  async verifyPaymentSignature(
    payload: VerifyPaymentSignaturePayload,
    idempotencyKey?: string
  ): Promise<any> {
    const paymentId = payload.paymentId || payload.payment_id;
    const orderId = payload.orderId || payload.razorpayOrderId || payload.razorpay_order_id;
    const razorpayPaymentId = payload.razorpayPaymentId || payload.razorpay_payment_id;
    const razorpaySignature = payload.razorpaySignature || payload.razorpay_signature;

    const normalizedPayload = {
      paymentId,
      orderId,
      razorpayPaymentId,
      razorpaySignature,
      // Retain dual keys for backend middleware tolerance
      payment_id: paymentId,
      razorpay_order_id: orderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    };

    const headers = getIdempotencyHeaders(idempotencyKey);
    const response: any = await apiClient.post('/payments/verify-signature', normalizedPayload, {
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Retrieve tenant payment gateway configuration status.
   */
  async getGatewayStatus(): Promise<PaymentGatewayStatus> {
    const response: any = await apiClient.get('/payments/status');
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Generic Session Persistence: Persist active payment session before financial execution.
   * @param session The active payment session metadata
   */
  async saveActivePaymentSession(session: ActivePaymentSession): Promise<void> {
    if (!session.referenceType || !session.referenceId) return;
    const key = buildSessionStorageKey(session.referenceType, session.referenceId);
    try {
      await storage.setItem(key, JSON.stringify(session));
      await updateActiveSessionsIndex(
        session.referenceType,
        session.referenceId,
        'ADD',
        session.operationId
      );
    } catch (err) {
      console.warn('[paymentService] Failed to persist active payment session:', err);
    }
  },

  /**
   * Generic Session Persistence: Retrieve active payment session for a reference if pending.
   * @param referenceType e.g., 'Invoice', 'AmenityBooking'
   * @param referenceId e.g., invoice ID
   */
  async getActivePaymentSession(
    referenceType: string,
    referenceId: string
  ): Promise<ActivePaymentSession | null> {
    if (!referenceType || !referenceId) return null;
    const key = buildSessionStorageKey(referenceType, referenceId);
    try {
      const data = await storage.getItem(key);
      if (!data) return null;
      return JSON.parse(data) as ActivePaymentSession;
    } catch (err) {
      console.warn('[paymentService] Failed to read active payment session:', err);
      return null;
    }
  },

  /**
   * Generic Session Persistence: Clear active payment session upon terminal resolution or user dismissal.
   * @param referenceType e.g., 'Invoice', 'AmenityBooking'
   * @param referenceId e.g., invoice ID
   */
  async clearActivePaymentSession(
    referenceType: string,
    referenceId: string
  ): Promise<void> {
    if (!referenceType || !referenceId) return;
    const key = buildSessionStorageKey(referenceType, referenceId);
    try {
      await storage.removeItem(key);
      await updateActiveSessionsIndex(referenceType, referenceId, 'REMOVE');
    } catch (err) {
      console.warn('[paymentService] Failed to clear active payment session:', err);
    }
  },

  /**
   * Diagnostic Operation Discovery: Retrieve all persisted active payment sessions across all domains.
   */
  async getAllActivePaymentSessions(): Promise<ActivePaymentSession[]> {
    try {
      const raw = await storage.getItem(ACTIVE_SESSIONS_INDEX_KEY);
      if (!raw) return [];
      const index: SessionIndexEntry[] = JSON.parse(raw);
      if (!Array.isArray(index)) return [];

      const sessions: ActivePaymentSession[] = [];
      const validEntries: SessionIndexEntry[] = [];

      for (const entry of index) {
        const session = await this.getActivePaymentSession(entry.referenceType, entry.referenceId);
        if (session) {
          sessions.push(session);
          validEntries.push(entry);
        }
      }

      if (validEntries.length !== index.length) {
        await storage.setItem(ACTIVE_SESSIONS_INDEX_KEY, JSON.stringify(validEntries));
      }

      return sessions;
    } catch (err) {
      console.warn('[paymentService] Failed to read all active payment sessions:', err);
      return [];
    }
  },
};

export default paymentService;
