import { useState, useCallback, useRef } from 'react';
import { useBilling } from './useBilling';
import defaultBillingService, { billingService as namedBillingService } from '../services/billingService';
import paymentService, { ActivePaymentSession } from '../../payment/services/paymentService';
import { createOperationId } from '@/src/utils/idempotency';


export type PaymentMethod = 'WALLET' | 'RAZORPAY' | 'OFFLINE';

export type MobilePaymentStatus =
  | 'IDLE'
  | 'CREATING_ORDER'
  | 'CHECKOUT'
  | 'VERIFYING'
  | 'SETTLING'
  | 'CHECKING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export interface MobilePaymentState {
  status: MobilePaymentStatus;
  isProcessing: boolean;
  paymentMethod: PaymentMethod | null;
  activeOrder: any | null;
  error: string | null;
  successMsg: string | null;
}

/**
 * Classify payment verification errors into definitive rejections vs. ambiguous network interruptions.
 */
export const isAmbiguousPaymentError = (err: any): boolean => {
  if (!err) return false;
  const msg = String(err?.message || err?.description || err || '').toLowerCase();
  const code = String(err?.code || '').toUpperCase();
  const status = err?.response?.status || err?.status;

  // Network drops, timeouts, connection resets
  if (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('network error') ||
    msg.includes('connection reset') ||
    msg.includes('request interrupted') ||
    msg.includes('unable to connect') ||
    msg.includes('offline')
  ) {
    return true;
  }

  // 5xx during verification where backend payment settlement status is unknown
  if (status && status >= 500 && status < 600) {
    return true;
  }

  return false;
};

/**
 * Custom Hook: useMobilePayment
 *
 * Implements the canonical Mobile Payment State Machine and double-submission protection.
 * States: IDLE -> CREATING_ORDER -> CHECKOUT -> VERIFYING -> SETTLING -> SUCCESS / CHECKING / FAILED / CANCELLED.
 */
export const useMobilePayment = () => {
  const { payInvoiceWallet, payInvoiceRazorpay, verifyRazorpay, settleOffline, loadingStates } = useBilling();

  const [paymentState, setPaymentState] = useState<MobilePaymentState>({
    status: 'IDLE',
    isProcessing: false,
    paymentMethod: null,
    activeOrder: null,
    error: null,
    successMsg: null,
  });

  // Guard reference to prevent simultaneous microtask re-entrancy / rapid double-taps
  const isLockedRef = useRef<boolean>(false);

  const resetPaymentState = useCallback(() => {
    isLockedRef.current = false;
    setPaymentState({
      status: 'IDLE',
      isProcessing: false,
      paymentMethod: null,
      activeOrder: null,
      error: null,
      successMsg: null,
    });
  }, []);

  const cancelPayment = useCallback((reason?: string) => {
    isLockedRef.current = false;
    setPaymentState((prev) => ({
      ...prev,
      status: 'CANCELLED',
      isProcessing: false,
      error: reason || 'Payment cancelled by user',
    }));
  }, []);

  /**
   * Settle invoice via Digital Wallet
   */
  const processWalletPayment = useCallback(
    async (invoiceId: string, amount: number, idempotencyKey?: string, operationId?: string) => {
      if (isLockedRef.current || paymentState.isProcessing) {
        console.warn('[useMobilePayment] Prevented duplicate wallet payment submission');
        throw new Error('Payment already in progress. Please wait.');
      }

      isLockedRef.current = true;
      setPaymentState({
        status: 'SETTLING',
        isProcessing: true,
        paymentMethod: 'WALLET',
        activeOrder: null,
        error: null,
        successMsg: null,
      });

      // Persist active session before financial network mutation
      const sessionOpId = operationId || idempotencyKey || `wallet_${invoiceId}_${Date.now()}`;
      await paymentService.saveActivePaymentSession({
        operationId: sessionOpId,
        referenceType: 'Invoice',
        referenceId: invoiceId,
        amount,
        currency: 'INR',
        status: 'CHECKING',
        createdAt: new Date().toISOString(),
      });

      try {
        const result = await payInvoiceWallet(invoiceId, amount, idempotencyKey);
        // Clean up persisted session upon confirmed terminal resolution
        await paymentService.clearActivePaymentSession('Invoice', invoiceId);

        isLockedRef.current = false;
        setPaymentState({
          status: 'SUCCESS',
          isProcessing: false,
          paymentMethod: 'WALLET',
          activeOrder: null,
          error: null,
          successMsg: 'Invoice payment settled via Digital Wallet successfully!',
        });
        return result;
      } catch (err: any) {
        isLockedRef.current = false;
        const errorMsg = err?.message || err || 'Wallet payment failed';
        // Clear session on definitive validation/rejection failure
        await paymentService.clearActivePaymentSession('Invoice', invoiceId);

        setPaymentState({
          status: 'FAILED',
          isProcessing: false,
          paymentMethod: 'WALLET',
          activeOrder: null,
          error: errorMsg,
          successMsg: null,
        });
        throw err;
      }
    },
    [payInvoiceWallet, paymentState.isProcessing]
  );

  /**
   * Create Razorpay payment order
   */
  const initiateRazorpayPayment = useCallback(
    async (invoiceId: string, amount: number, idempotencyKey?: string, operationId?: string) => {
      if (isLockedRef.current || paymentState.isProcessing) {
        console.warn('[useMobilePayment] Prevented duplicate Razorpay order initiation');
        throw new Error('Payment order already being created. Please wait.');
      }

      isLockedRef.current = true;
      setPaymentState({
        status: 'CREATING_ORDER',
        isProcessing: true,
        paymentMethod: 'RAZORPAY',
        activeOrder: null,
        error: null,
        successMsg: null,
      });

      const sessionOpId = operationId || idempotencyKey || `inv_ord_${invoiceId}_${Date.now()}`;
      // Persist before network execution
      await paymentService.saveActivePaymentSession({
        operationId: sessionOpId,
        referenceType: 'Invoice',
        referenceId: invoiceId,
        amount,
        currency: 'INR',
        status: 'CREATING_ORDER',
        createdAt: new Date().toISOString(),
      });

      try {
        const orderData = await payInvoiceRazorpay(invoiceId, amount, idempotencyKey);

        // Update session with backend-authoritative orderId and paymentId
        await paymentService.saveActivePaymentSession({
          operationId: sessionOpId,
          referenceType: 'Invoice',
          referenceId: invoiceId,
          amount,
          currency: orderData?.currency || 'INR',
          orderId: orderData?.orderId || orderData?.id,
          paymentId: orderData?.paymentId,
          status: 'CHECKOUT',
          createdAt: new Date().toISOString(),
        });

        isLockedRef.current = false;
        setPaymentState({
          status: 'CHECKOUT',
          isProcessing: false,
          paymentMethod: 'RAZORPAY',
          activeOrder: orderData,
          error: null,
          successMsg: null,
        });
        return orderData;
      } catch (err: any) {
        isLockedRef.current = false;
        await paymentService.clearActivePaymentSession('Invoice', invoiceId);
        const errorMsg = err?.message || err || 'Failed to create payment order';
        setPaymentState({
          status: 'FAILED',
          isProcessing: false,
          paymentMethod: 'RAZORPAY',
          activeOrder: null,
          error: errorMsg,
          successMsg: null,
        });
        throw err;
      }
    },
    [payInvoiceRazorpay, paymentState.isProcessing]
  );

  /**
   * Verify Razorpay payment signature
   */
  const confirmRazorpayPayment = useCallback(
    async (
      verificationPayload: any,
      idempotencyKey?: string,
      sessionDetails?: { invoiceId: string; amount: number; operationId: string }
    ) => {
      isLockedRef.current = true;
      setPaymentState((prev) => ({
        ...prev,
        status: 'VERIFYING',
        isProcessing: true,
        error: null,
      }));

      const invoiceId = sessionDetails?.invoiceId || verificationPayload?.invoiceId;
      const orderId = verificationPayload?.orderId || verificationPayload?.razorpay_order_id;
      const paymentId = verificationPayload?.paymentId || verificationPayload?.payment_id;

      if (invoiceId) {
        await paymentService.saveActivePaymentSession({
          operationId: sessionDetails?.operationId || idempotencyKey || `inv_vfy_${invoiceId}`,
          referenceType: 'Invoice',
          referenceId: invoiceId,
          amount: sessionDetails?.amount || 0,
          currency: 'INR',
          orderId,
          paymentId,
          status: 'VERIFYING',
          createdAt: new Date().toISOString(),
        });
      }

      try {
        const verifyResult = await verifyRazorpay(verificationPayload, idempotencyKey);

        if (invoiceId) {
          // Terminal resolution: clear active payment session
          await paymentService.clearActivePaymentSession('Invoice', invoiceId);
        }

        isLockedRef.current = false;
        setPaymentState({
          status: 'SUCCESS',
          isProcessing: false,
          paymentMethod: 'RAZORPAY',
          activeOrder: null,
          error: null,
          successMsg: 'Payment verified and settled successfully!',
        });
        return verifyResult;
      } catch (err: any) {
        isLockedRef.current = false;
        const isAmbiguous = isAmbiguousPaymentError(err);

        if (isAmbiguous) {
          // Keep active payment session in CHECKING status for recovery
          if (invoiceId) {
            await paymentService.saveActivePaymentSession({
              operationId: sessionDetails?.operationId || idempotencyKey || `inv_vfy_${invoiceId}`,
              referenceType: 'Invoice',
              referenceId: invoiceId,
              amount: sessionDetails?.amount || 0,
              currency: 'INR',
              orderId,
              paymentId,
              status: 'CHECKING',
              createdAt: new Date().toISOString(),
            });
          }

          setPaymentState((prev) => ({
            ...prev,
            status: 'CHECKING',
            isProcessing: false,
            error: 'Verification response unavailable. Please check payment status.',
          }));

          // Return recoverable unknown state object rather than treating as hard failure
          return {
            isChecking: true,
            status: 'CHECKING',
            invoiceId,
            paymentId,
            orderId,
            message: 'Payment verification in progress. Please check status.',
          };
        } else {
          // Definitive failure reported by backend
          if (invoiceId) {
            await paymentService.clearActivePaymentSession('Invoice', invoiceId);
          }

          const errorMsg = err?.message || err || 'Payment verification failed';
          setPaymentState((prev) => ({
            ...prev,
            status: 'FAILED',
            isProcessing: false,
            error: errorMsg,
          }));
          throw err;
        }
      }
    },
    [verifyRazorpay]
  );

  /**
   * Phase 4: Submit Offline Payment for Verification (Cash, Bank Transfer, Cheque, UPI, NEFT, DD).
   */
  const submitOfflinePayment = useCallback(
    async (
      invoiceId: string,
      payload: {
        offlineReference?: string;
        paymentMethod: string;
        amount: number;
        paymentDate?: string;
        paymentScreenshot?: string;
        payerNotes?: string;
      },
      idempotencyKey?: string,
      operationId?: string
    ) => {
      if (isLockedRef.current) {
        throw new Error('Another payment operation is currently in progress.');
      }
      isLockedRef.current = true;

      const opId = operationId || idempotencyKey || createOperationId();

      // Persist active session before initiating financial mutation
      await paymentService.saveActivePaymentSession({
        operationId: opId,
        referenceType: 'Invoice',
        referenceId: invoiceId,
        amount: payload.amount,
        currency: 'INR',
        paymentMethod: payload.paymentMethod,
        offlineReference: payload.offlineReference,
        proofUrl: payload.paymentScreenshot,
        notes: payload.payerNotes,
        status: 'SUBMITTING',
        createdAt: new Date().toISOString(),
      });

      setPaymentState({
        status: 'SETTLING',
        isProcessing: true,
        paymentMethod: 'OFFLINE',
        activeOrder: null,
        error: null,
        successMsg: null,
      });

      try {
        const result = await settleOffline(invoiceId, {
          offlineReference: payload.offlineReference || '',
          amount: payload.amount,
          paymentMethod: payload.paymentMethod,
          paymentDate: payload.paymentDate,
          paymentScreenshot: payload.paymentScreenshot,
          payerNotes: payload.payerNotes,
        });

        // Persist/update session to PENDING_VERIFICATION (submission accepted, awaiting verification)
        await paymentService.saveActivePaymentSession({
          operationId: opId,
          referenceType: 'Invoice',
          referenceId: invoiceId,
          amount: payload.amount,
          currency: 'INR',
          paymentMethod: payload.paymentMethod,
          offlineReference: payload.offlineReference || result?.offlineReference,
          proofUrl: payload.paymentScreenshot,
          status: 'PENDING_VERIFICATION',
          createdAt: new Date().toISOString(),
        });

        isLockedRef.current = false;
        setPaymentState({
          status: 'SUCCESS',
          isProcessing: false,
          paymentMethod: 'OFFLINE',
          activeOrder: null,
          error: null,
          successMsg: 'Offline payment details submitted successfully and pending verification.',
        });

        return result;
      } catch (err: any) {
        isLockedRef.current = false;
        const isAmbiguous = isAmbiguousPaymentError(err);

        if (isAmbiguous) {
          // Ambiguous network interruption -> retain session in CHECKING for recovery
          await paymentService.saveActivePaymentSession({
            operationId: opId,
            referenceType: 'Invoice',
            referenceId: invoiceId,
            amount: payload.amount,
            currency: 'INR',
            paymentMethod: payload.paymentMethod,
            offlineReference: payload.offlineReference,
            proofUrl: payload.paymentScreenshot,
            status: 'CHECKING',
            createdAt: new Date().toISOString(),
          });

          setPaymentState((prev) => ({
            ...prev,
            status: 'CHECKING',
            isProcessing: false,
            error: 'Submission response unavailable. Please check payment status.',
          }));

          return {
            isChecking: true,
            status: 'CHECKING',
            invoiceId,
            message: 'Submission confirmation pending. Please check invoice status.',
          };
        } else {
          // Definitive failure reported by backend
          await paymentService.clearActivePaymentSession('Invoice', invoiceId);
          const errorMsg = err?.message || err || 'Offline payment submission failed';
          setPaymentState((prev) => ({
            ...prev,
            status: 'FAILED',
            isProcessing: false,
            error: errorMsg,
          }));
          throw err;
        }
      }
    },
    [settleOffline]
  );

  /**
   * Phase 4: Recover Active Payment / Offline Submission by querying backend invoice.
   */
  const checkAndRecoverPayment = useCallback(
    async (invoiceId: string) => {
      const session = await paymentService.getActivePaymentSession('Invoice', invoiceId);
      if (!session) {
        return null;
      }

      try {
        const activeBillingService = defaultBillingService || namedBillingService;
        const inv = await activeBillingService.getInvoiceById(invoiceId);
        if (!inv) return session;

        if (inv.status === 'VERIFICATION_PENDING') {
          // Backend confirms offline submission was accepted
          await paymentService.saveActivePaymentSession({
            ...session,
            status: 'PENDING_VERIFICATION',
          });
          return {
            ...session,
            status: 'PENDING_VERIFICATION',
            resolution: 'SUBMISSION_ACCEPTED',
            invoice: inv,
          };
        } else if (inv.status === 'PAID' || inv.status === 'PARTIALLY_PAID') {
          // Backend confirms payment is financially settled (full or partial)
          await paymentService.clearActivePaymentSession('Invoice', invoiceId);
          return {
            ...session,
            status: 'SUCCESS',
            resolution: inv.status === 'PAID' ? 'PAID' : 'PARTIALLY_PAID',
            invoice: inv,
          };
        } else if (inv.status === 'REJECTED' || (inv.status === 'UNPAID' && inv.rejectionReason)) {
          // Backend rejected offline payment
          await paymentService.saveActivePaymentSession({
            ...session,
            status: 'REJECTED',
          });
          return {
            ...session,
            status: 'REJECTED',
            resolution: 'REJECTED',
            rejectionReason: inv.rejectionReason,
            invoice: inv,
          };
        }

        return session;
      } catch (err) {
        // If query fails, remain in CHECKING without creating another submission
        return session;
      }
    },
    []
  );

  return {
    paymentState,
    isGlobalSettling: loadingStates.settleInvoice || paymentState.isProcessing,
    processWalletPayment,
    initiateRazorpayPayment,
    confirmRazorpayPayment,
    submitOfflinePayment,
    checkAndRecoverPayment,
    cancelPayment,
    resetPaymentState,
  };
};

export default useMobilePayment;
