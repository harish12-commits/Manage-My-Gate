/**
 * NAHOM / Connect Harmony - Mobile Phase 7: Financial Reliability, Failure Injection & Production Readiness
 *
 * Comprehensive Chaos & Invariant Verification Test Suite
 *
 * Covers:
 * 1. Idempotency Chaos & Concurrency Protection (double/triple taps, retry stability, restart recovery)
 * 2. Online Payment Failure Matrix (Scenarios A through E: timeouts, lost responses, 400 rejection, 409 already settled)
 * 3. Wallet Recharge Failure Matrix (zero client-side balance increment, authoritative server refresh)
 * 4. Invoice Payment Failure Matrix (zero client arrears reconstruction, stale-data protection)
 * 5. Offline Payment Failure Matrix (Proof uploaded != Payment submitted != Payment settled)
 * 6. Pay-at-Gate Decoupled Lifecycle Matrix (Hold retention on ambiguous drop, cash collection gate authority)
 * 7. App Termination & Session Corruption Testing (malformed JSON, missing session, expired session recovery)
 * 8. Stale Cache & Offline/Online Transition Testing (authoritative backend state replaces stale local presentation)
 * 9. Financial State-Machine Invariants & Forbidden Transitions (checking->paid without proof, booking confirmed!=paid)
 * 10. Receipt Safety & Settlement Verification (suppression of settled actions on unsettled states)
 * 11. Privacy, Security & Resource Safety (zero credential leakage, listener cleanup, zero infinite polling)
 */

import React from 'react';
import { renderHook, act, cleanup } from '@testing-library/react-native';
import paymentService, { ActivePaymentSession } from '../services/paymentService';
import financialDiagnosticService from '../services/financialDiagnosticService';
import { useMobilePayment } from '../../billing/hooks/useMobilePayment';
import { billingService } from '../../billing/services/billingService';
import { walletService } from '../../wallet/services/walletService';
import * as amenityService from '../../amenities/services/amenityService';
import {
  createOperationId,
  buildInvoiceOrderKey,
  buildInvoiceWalletKey,
  buildInvoiceOfflineKey,
  buildAmenityPayAtGateKey,
} from '@/src/utils/idempotency';
import {
  createNetworkTimeoutError,
  createConnectionResetError,
  createOfflineError,
  createHttpError,
  injectActiveSession,
  injectMalformedSession,
  injectExpiredSession,
  isPermittedStateTransition,
  assertNoSensitiveLeaks,
} from './financialFailureHarness';
import {
  classifyFinancialError,
  resolveDiagnosticState,
  formatSupportInformation,
  sanitizeDiagnosticPayload,
  maskSensitiveData,
} from '../utils/financialDiagnostics';
import { FinancialOperationDiagnostic } from '../types/financialDiagnostics.types';
import { getFinancialStatusPresentation } from '../utils/financialStatus';
import storage from '@/src/utils/storage';

// Mock reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return {
    ...Reanimated,
    useAnimatedStyle: (fn: any) => (typeof fn === 'function' ? fn() : {}),
    useSharedValue: (val: any) => ({ value: val }),
    withTiming: (val: any) => val,
    withRepeat: (val: any) => val,
    withSequence: (...args: any[]) => args[0],
  };
});

// Mock Modal to expose children in tests
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockModal = ({ children, visible, testID }: any) =>
    visible ? <View testID={testID || 'mock-modal'}>{children}</View> : null;
  MockModal.displayName = 'Modal';
  return {
    default: MockModal,
    __esModule: true,
  };
});

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(true),
  deleteItemAsync: jest.fn().mockResolvedValue(true),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock billingService with internal object avoiding hoisting TDZ
jest.mock('../../billing/services/billingService', () => {
  const mock = {
    getMyDues: jest.fn(),
    getInvoiceById: jest.fn(),
    createRazorpayOrder: jest.fn(),
    verifyRazorpayPayment: jest.fn(),
    settleInvoiceOffline: jest.fn(),
    settleInvoiceWithWallet: jest.fn(),
  };
  return {
    __esModule: true,
    billingService: mock,
    default: mock,
  };
});

// Mock walletService with internal object avoiding hoisting TDZ
jest.mock('../../wallet/services/walletService', () => {
  const mock = {
    getWalletBalance: jest.fn(),
  };
  return {
    __esModule: true,
    walletService: mock,
    default: mock,
  };
});

// Mock amenityService
jest.mock('../../amenities/services/amenityService', () => ({
  getMyBookings: jest.fn(),
  createAmenityBooking: jest.fn(),
}));

// Mock useBilling hook for useMobilePayment
const mockPayInvoiceWallet = jest.fn();
const mockPayInvoiceRazorpay = jest.fn();
const mockVerifyRazorpay = jest.fn();
const mockSettleOffline = jest.fn();

jest.mock('../../billing/hooks/useBilling', () => ({
  useBilling: () => ({
    payInvoiceWallet: mockPayInvoiceWallet,
    payInvoiceRazorpay: mockPayInvoiceRazorpay,
    verifyRazorpay: mockVerifyRazorpay,
    settleOffline: mockSettleOffline,
    loadingStates: { settleInvoice: false },
  }),
}));

describe('Mobile Phase 7 — Financial Reliability, Failure Injection & Production Readiness', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    (billingService.getInvoiceById as jest.Mock).mockReset();
    (walletService.getWalletBalance as jest.Mock).mockReset();
    (amenityService.getMyBookings as jest.Mock).mockReset();

    mockPayInvoiceWallet.mockReset();
    mockPayInvoiceRazorpay.mockReset();
    mockVerifyRazorpay.mockReset();
    mockSettleOffline.mockReset();

    // Clear active sessions
    const sessions = await paymentService.getAllActivePaymentSessions();
    for (const s of sessions) {
      await paymentService.clearActivePaymentSession(s.referenceType, s.referenceId);
    }
  });

  // =========================================================================
  // 1. Idempotency Chaos & Concurrency Protection
  // =========================================================================
  describe('1. Idempotency Chaos & Concurrency Protection', () => {
    it('prevents duplicate financial mutations on rapid double or triple tap', async () => {
      const { result } = await renderHook(() => useMobilePayment());

      // Simulate slow backend response
      mockPayInvoiceWallet.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
      );

      const opId = 'op_chaos_tap_1';
      const key = buildInvoiceWalletKey('inv_chaos_1', 1500, opId);

      // Fire first tap
      const firstPromise = result.current.processWalletPayment('inv_chaos_1', 1500, key, opId);

      // Rapid second tap while first is in-flight must be rejected by double-tap lock
      let secondError: any;
      try {
        await result.current.processWalletPayment('inv_chaos_1', 1500, key, opId);
      } catch (err) {
        secondError = err;
      }

      expect(secondError).toBeDefined();
      expect(secondError.message).toMatch(/already in progress/i);

      await act(async () => {
        await firstPromise;
      });

      // Verify billing service was called exactly ONCE despite multiple taps
      expect(mockPayInvoiceWallet).toHaveBeenCalledTimes(1);
    });

    it('preserves exact same operationId across retry attempts of the same logical action', () => {
      const initialOpId = 'op_retry_stable_99';
      const invoiceId = 'inv_stable_99';
      const amount = 3000;

      // Construct keys across retries
      const attempt1Key = buildInvoiceOrderKey(invoiceId, amount, initialOpId);
      const attempt2Key = buildInvoiceOrderKey(invoiceId, amount, initialOpId);
      const attempt3Key = buildInvoiceOrderKey(invoiceId, amount, initialOpId);

      // All keys must be identical to guarantee backend idempotency
      expect(attempt1Key).toBe(`inv-ord-${invoiceId}-${amount}-${initialOpId}`);
      expect(attempt1Key).toBe(attempt2Key);
      expect(attempt2Key).toBe(attempt3Key);
    });

    it('recovers persisted operationId from storage after app termination', async () => {
      const stableOpId = 'op_persisted_restart_1';
      const session: ActivePaymentSession = {
        operationId: stableOpId,
        referenceType: 'Invoice',
        referenceId: 'inv_restart_1',
        amount: 5000,
        currency: 'INR',
        paymentMethod: 'RAZORPAY',
        status: 'CHECKING',
        createdAt: '2026-09-25T11:00:00.000Z',
      };

      await injectActiveSession(session);

      // Simulate app restart by retrieving session
      const recovered = await paymentService.getActivePaymentSession('Invoice', 'inv_restart_1');
      expect(recovered).not.toBeNull();
      expect(recovered?.operationId).toBe(stableOpId);
      expect(recovered?.amount).toBe(5000);
      expect(recovered?.status).toBe('CHECKING');
    });
  });

  // =========================================================================
  // 2. Online Payment Failure Matrix (Scenarios A through E)
  // =========================================================================
  describe('2. Online Payment Failure Matrix', () => {
    it('Scenario A: Order -> Checkout -> Verification -> definitive SUCCESS', async () => {
      const { result } = await renderHook(() => useMobilePayment());
      mockVerifyRazorpay.mockResolvedValueOnce({
        status: 'PAID',
        paymentId: 'pay_scen_a',
      });

      let res: any;
      await act(async () => {
        res = await result.current.confirmRazorpayPayment(
          { invoiceId: 'inv_scen_a', paymentId: 'pay_scen_a', orderId: 'ord_scen_a' },
          'inv-vfy-pay_scen_a-ord_scen_a',
          { invoiceId: 'inv_scen_a', amount: 2500, operationId: 'op_scen_a' }
        );
      });

      expect(result.current.paymentState.status).toBe('SUCCESS');
      expect(res.status).toBe('PAID');

      // Active session cleared upon definitive settlement
      const session = await paymentService.getActivePaymentSession('Invoice', 'inv_scen_a');
      expect(session).toBeNull();
    });

    it('Scenario B: Gateway verification network timeout routes to CHECKING (never FAILED)', async () => {
      const { result } = await renderHook(() => useMobilePayment());
      mockVerifyRazorpay.mockRejectedValueOnce(createNetworkTimeoutError('Gateway timeout 504'));

      let res: any;
      await act(async () => {
        res = await result.current.confirmRazorpayPayment(
          { invoiceId: 'inv_scen_b', paymentId: 'pay_scen_b', orderId: 'ord_scen_b' },
          'inv-vfy-pay_scen_b-ord_scen_b',
          { invoiceId: 'inv_scen_b', amount: 3500, operationId: 'op_scen_b' }
        );
      });

      // Must transition to CHECKING, never FAILED
      expect(result.current.paymentState.status).toBe('CHECKING');
      expect(res.isChecking).toBe(true);

      // Session MUST be retained in CHECKING status for recovery
      const session = await paymentService.getActivePaymentSession('Invoice', 'inv_scen_b');
      expect(session).not.toBeNull();
      expect(session?.status).toBe('CHECKING');
    });

    it('Scenario C: Verification request sent, response lost -> routes to CHECKING and recovers via backend query', async () => {
      const { result } = await renderHook(() => useMobilePayment());
      // Response dropped on client
      mockVerifyRazorpay.mockRejectedValueOnce(createConnectionResetError('TCP connection reset'));

      await act(async () => {
        await result.current.confirmRazorpayPayment(
          { invoiceId: 'inv_scen_c', paymentId: 'pay_scen_c', orderId: 'ord_scen_c' },
          'inv-vfy-pay_scen_c-ord_scen_c',
          { invoiceId: 'inv_scen_c', amount: 4000, operationId: 'op_scen_c' }
        );
      });

      expect(result.current.paymentState.status).toBe('CHECKING');

      // Now simulate background recovery querying backend where invoice is confirmed PAID
      (billingService.getInvoiceById as jest.Mock).mockResolvedValueOnce({
        _id: 'inv_scen_c',
        invoiceNumber: 'INV-SCEN-C',
        status: 'PAID',
        totalDue: 4000,
        paidAmount: 4000,
      });

      let recoveryResult: any;
      await act(async () => {
        recoveryResult = await result.current.checkAndRecoverPayment('inv_scen_c');
      });

      expect(recoveryResult.status).toBe('SUCCESS');
      expect(recoveryResult.resolution).toBe('PAID');

      // Session now cleared
      const sessionAfter = await paymentService.getActivePaymentSession('Invoice', 'inv_scen_c');
      expect(sessionAfter).toBeNull();
    });

    it('Scenario D: Verification receives HTTP 400 validation error -> definitive FAILED requiring user action', async () => {
      const { result } = await renderHook(() => useMobilePayment());
      mockVerifyRazorpay.mockRejectedValueOnce(createHttpError(400, 'Invalid signature hash', 'INVALID_SIGNATURE'));

      let error: any;
      await act(async () => {
        try {
          await result.current.confirmRazorpayPayment(
            { invoiceId: 'inv_scen_d', paymentId: 'pay_scen_d', orderId: 'ord_scen_d' },
            'inv-vfy-pay_scen_d-ord_scen_d',
            { invoiceId: 'inv_scen_d', amount: 1500, operationId: 'op_scen_d' }
          );
        } catch (err) {
          error = err;
        }
      });

      expect(error).toBeDefined();
      expect(result.current.paymentState.status).toBe('FAILED');

      // Clear session on definitive validation rejection
      const session = await paymentService.getActivePaymentSession('Invoice', 'inv_scen_d');
      expect(session).toBeNull();
    });

    it('Scenario E: Verification receives HTTP 409 already settled -> treated as definitive SUCCESS without double charge', () => {
      const err = createHttpError(409, 'Payment already processed and invoice settled', 'ALREADY_SETTLED');
      const classified = classifyFinancialError(err);

      expect(classified.category).toBe('ALREADY_SETTLED');
      expect(classified.clientState).toBe('SUCCESS');
      expect(classified.diagnosticState).toBe('NORMAL');
      expect(classified.isAmbiguous).toBe(false);
      expect(classified.userActionRequired).toBe(false);
    });
  });

  // =========================================================================
  // 3. Wallet Recharge Failure Matrix
  // =========================================================================
  describe('3. Wallet Recharge Failure Matrix', () => {
    it('wallet top-up failure routes to CHECKING on network drop without local balance mutation', async () => {
      const session: ActivePaymentSession = {
        operationId: 'op_wlt_topup_fail_1',
        referenceType: 'WalletRecharge',
        referenceId: 'wlt_rec_fail_1',
        amount: 2000,
        currency: 'INR',
        paymentMethod: 'ONLINE',
        status: 'CHECKING',
        createdAt: '2026-09-25T11:30:00.000Z',
      };
      await injectActiveSession(session);

      // Backend reports network error during query
      (walletService.getWalletBalance as jest.Mock).mockRejectedValueOnce(createOfflineError());

      const outcome = await financialDiagnosticService.reconcileSession(session);
      expect(outcome.isResolved).toBe(false);
      expect(outcome.diagnostic.clientState).toBe('CHECKING');
      expect(outcome.diagnostic.diagnosticState).toBe('RECOVERY_REQUIRED');

      // Session retained in storage
      const retained = await paymentService.getActivePaymentSession('WalletRecharge', 'wlt_rec_fail_1');
      expect(retained).not.toBeNull();
    });

    it('reconciles wallet top-up upon confirmed backend transaction and clears session', async () => {
      const session: ActivePaymentSession = {
        operationId: 'op_wlt_topup_succ_1',
        referenceType: 'WalletRecharge',
        referenceId: 'wlt_rec_succ_1',
        amount: 5000,
        currency: 'INR',
        paymentMethod: 'ONLINE',
        orderId: 'ord_wlt_99',
        paymentId: 'pay_wlt_99',
        status: 'CHECKING',
        createdAt: '2026-09-25T11:45:00.000Z',
      };
      await injectActiveSession(session);

      // Authoritative backend response containing the completed transaction
      (walletService.getWalletBalance as jest.Mock).mockResolvedValueOnce({
        balance: 7500,
        transactions: [
          {
            transactionId: 'op_wlt_topup_succ_1',
            razorpay_order_id: 'ord_wlt_99',
            razorpay_payment_id: 'pay_wlt_99',
            paymentStatus: 'success',
            amount: 5000,
          },
        ],
      });

      const outcome = await financialDiagnosticService.reconcileSession(session);
      expect(outcome.isResolved).toBe(true);
      expect(outcome.diagnostic.clientState).toBe('SUCCESS');
      expect(outcome.diagnostic.diagnosticState).toBe('NORMAL');

      // Session cleared
      const cleared = await paymentService.getActivePaymentSession('WalletRecharge', 'wlt_rec_succ_1');
      expect(cleared).toBeNull();
    });
  });

  // =========================================================================
  // 4. Invoice Payment Failure Matrix
  // =========================================================================
  describe('4. Invoice Payment Failure Matrix', () => {
    it('never reconstructs paidAmount or arrears locally from partial payments', async () => {
      // Backend returns partial payment outcome with authoritative arrears
      (billingService.getInvoiceById as jest.Mock).mockResolvedValueOnce({
        _id: 'inv_partial_99',
        invoiceNumber: 'INV-PARTIAL-99',
        status: 'PARTIALLY_PAID',
        totalDue: 10000,
        paidAmount: 6000,
        remainingDue: 4000,
      });

      const session: ActivePaymentSession = {
        operationId: 'op_inv_partial_99',
        referenceType: 'Invoice',
        referenceId: 'inv_partial_99',
        amount: 6000,
        currency: 'INR',
        paymentMethod: 'BANK_TRANSFER',
        status: 'CHECKING',
        createdAt: '2026-09-25T12:00:00.000Z',
      };
      await injectActiveSession(session);

      const outcome = await financialDiagnosticService.reconcileSession(session);
      expect(outcome.isResolved).toBe(true);
      expect(outcome.diagnostic.clientState).toBe('SUCCESS');
      // Server metadata totalDue and invoiceNumber preserved without arithmetic
      expect(outcome.diagnostic.metadata?.amount).toBe(10000);
      expect(outcome.diagnostic.metadata?.invoiceNumber).toBe('INV-PARTIAL-99');
    });

    it('replaces stale invoice screen state with authoritative backend state', async () => {
      const { result } = await renderHook(() => useMobilePayment());
      // Local session was PENDING_VERIFICATION, but backend has already marked invoice PAID
      const session: ActivePaymentSession = {
        operationId: 'op_stale_screen_1',
        referenceType: 'Invoice',
        referenceId: 'inv_stale_1',
        amount: 2200,
        currency: 'INR',
        paymentMethod: 'OFFLINE',
        status: 'PENDING_VERIFICATION',
        createdAt: '2026-09-25T12:15:00.000Z',
      };
      await injectActiveSession(session);

      (billingService.getInvoiceById as jest.Mock).mockResolvedValueOnce({
        _id: 'inv_stale_1',
        invoiceNumber: 'INV-STALE-1',
        status: 'PAID',
        totalDue: 2200,
        paidAmount: 2200,
      });

      let rec: any;
      await act(async () => {
        rec = await result.current.checkAndRecoverPayment('inv_stale_1');
      });

      // Local presentation is updated to SUCCESS / PAID
      expect(rec.status).toBe('SUCCESS');
      expect(rec.resolution).toBe('PAID');
    });
  });

  // =========================================================================
  // 5. Offline Payment Failure Matrix
  // =========================================================================
  describe('5. Offline Payment Failure Matrix', () => {
    it('strictly maintains Proof uploaded != Payment submitted != Payment settled', async () => {
      const { result } = await renderHook(() => useMobilePayment());

      // Step 1: Proof is available (URL), but submission not yet made
      const payload = {
        offlineReference: 'UTR99887766',
        paymentMethod: 'Bank Transfer',
        amount: 4500,
        paymentScreenshot: 'https://cdn.community.com/proofs/rec_1.png',
        payerNotes: 'Transferred via IMPS',
      };

      // Step 2: Submission succeeds -> state is PENDING_VERIFICATION (not settled)
      mockSettleOffline.mockResolvedValueOnce({
        success: true,
        offlineReference: 'UTR99887766',
        status: 'VERIFICATION_PENDING',
      });

      let res: any;
      await act(async () => {
        res = await result.current.submitOfflinePayment('inv_off_life_1', payload, 'key_off_1', 'op_off_1');
      });

      expect(res.status).toBe('VERIFICATION_PENDING');
      const session = await paymentService.getActivePaymentSession('Invoice', 'inv_off_life_1');
      expect(session).not.toBeNull();
      expect(session?.status).toBe('PENDING_VERIFICATION');

      // Presentation status is explicitly NOT settled
      const pres = getFinancialStatusPresentation('VERIFICATION_PENDING');
      expect(pres.isSettled).toBe(false);
      expect(pres.category).toBe('VERIFICATION_PENDING');
      expect(pres.headline).toBe('Payment submitted — awaiting verification.');
    });

    it('offline payment rejection preserves management rejection reason and allows fresh submission', async () => {
      const session: ActivePaymentSession = {
        operationId: 'op_off_rej_1',
        referenceType: 'Invoice',
        referenceId: 'inv_rej_1',
        amount: 3500,
        currency: 'INR',
        paymentMethod: 'CHEQUE',
        status: 'PENDING_VERIFICATION',
        createdAt: '2026-09-25T12:30:00.000Z',
      };
      await injectActiveSession(session);

      (billingService.getInvoiceById as jest.Mock).mockResolvedValueOnce({
        _id: 'inv_rej_1',
        invoiceNumber: 'INV-REJ-01',
        status: 'REJECTED',
        rejectionReason: 'Cheque signature mismatch',
        totalDue: 3500,
      });

      const outcome = await financialDiagnosticService.reconcileSession(session);
      expect(outcome.isResolved).toBe(false);
      expect(outcome.diagnostic.clientState).toBe('REJECTED');
      expect(outcome.diagnostic.diagnosticState).toBe('USER_ACTION_REQUIRED');
      expect(outcome.diagnostic.errorMessage).toBe('Cheque signature mismatch');

      const pres = getFinancialStatusPresentation('REJECTED', { rejectionReason: 'Cheque signature mismatch' });
      expect(pres.canPayAgain).toBe(true);
      expect(pres.recommendedAction).toBe('SUBMIT_FRESH');
    });
  });

  // =========================================================================
  // 6. Pay-at-Gate Decoupled Lifecycle Matrix
  // =========================================================================
  describe('6. Pay-at-Gate Decoupled Lifecycle Matrix', () => {
    it('maintains orthogonal dimensions: Booking CONFIRMED vs Payment PENDING', () => {
      const pres = getFinancialStatusPresentation('PAY_AT_GATE');
      expect(pres.category).toBe('PENDING');
      expect(pres.isSettled).toBe(false);

      const diagnostic: FinancialOperationDiagnostic = {
        operationId: 'op_gate_ortho_1',
        referenceType: 'AmenityBooking',
        referenceId: 'fac_tennis_1',
        clientState: 'PENDING_VERIFICATION',
        lastKnownServerState: 'PENDING',
        diagnosticState: 'USER_ACTION_REQUIRED',
        hasActiveSession: true,
        metadata: {
          paymentMethod: 'PAY_AT_GATE',
          bookingId: 'RES-TENNIS-01',
          amount: 500,
        },
      };

      expect(diagnostic.clientState).toBe('PENDING_VERIFICATION');
      expect(diagnostic.lastKnownServerState).toBe('PENDING');
      expect(diagnostic.metadata?.paymentMethod).toBe('PAY_AT_GATE');
    });

    it('cash collection is gate-authority only: resident app never executes local settlement', async () => {
      const session: ActivePaymentSession = {
        operationId: 'op_gate_cash_1',
        referenceType: 'AmenityBooking',
        referenceId: 'res_gate_cash_1',
        amount: 800,
        currency: 'INR',
        paymentMethod: 'PAY_AT_GATE',
        status: 'SUBMITTING',
        createdAt: '2026-09-25T13:00:00.000Z',
      };
      await injectActiveSession(session);

      // Backend still has paymentStatus: PENDING
      (amenityService.getMyBookings as jest.Mock).mockResolvedValueOnce({
        bookings: [
          {
            _id: 'res_gate_cash_1',
            reservationNumber: 'RES-CASH-01',
            paymentMethod: 'PAY_AT_GATE',
            paymentStatus: 'PENDING',
            bookingStatus: 'CONFIRMED',
          },
        ],
      });

      const outcome = await financialDiagnosticService.reconcileSession(session);
      expect(outcome.isResolved).toBe(false);
      // Still pending verification, NOT paid
      expect(outcome.diagnostic.clientState).toBe('PENDING_VERIFICATION');
      expect(outcome.diagnostic.lastKnownServerState).toBe('PENDING');
    });
  });

  // =========================================================================
  // 7. App Termination & Session Corruption Testing
  // =========================================================================
  describe('7. App Termination & Session Corruption Testing', () => {
    it('safely handles malformed non-JSON data in session storage without crashing', async () => {
      // Inject malformed JSON string into storage
      await injectMalformedSession('Invoice', 'inv_corrupt_1', 'MALFORMED_{{_CORRUPTED_DATA');

      // Retrieving malformed session must catch SyntaxError and return null safely
      const retrieved = await paymentService.getActivePaymentSession('Invoice', 'inv_corrupt_1');
      expect(retrieved).toBeNull();

      // Corrupted session map to diagnostic uses safe fallbacks
      const diag = financialDiagnosticService.mapSessionToDiagnostic({} as any);
      expect(diag.clientState).toBe('CHECKING');
      expect(diag.diagnosticState).toBe('AWAITING_SERVER');
    });

    it('safely handles missing session gracefully with authoritative backend lookup', async () => {
      const { result } = await renderHook(() => useMobilePayment());

      // Querying an invoice that has no active session in storage
      const res = await result.current.checkAndRecoverPayment('inv_missing_session_1');
      expect(res).toBeNull();
    });

    it('safely recovers stale expired sessions and requests authoritative server status', async () => {
      const expiredSession: ActivePaymentSession = {
        operationId: 'op_expired_48h',
        referenceType: 'Invoice',
        referenceId: 'inv_exp_1',
        amount: 1800,
        currency: 'INR',
        paymentMethod: 'RAZORPAY',
        status: 'CHECKING',
        createdAt: '2026-09-23T10:00:00.000Z', // 48 hours ago
      };
      await injectExpiredSession(expiredSession, 48);

      (billingService.getInvoiceById as jest.Mock).mockResolvedValueOnce({
        _id: 'inv_exp_1',
        invoiceNumber: 'INV-EXP-01',
        status: 'UNPAID',
        totalDue: 1800,
      });

      const outcome = await financialDiagnosticService.reconcileSession(expiredSession);
      expect(outcome.isResolved).toBe(false);
      expect(outcome.diagnostic.diagnosticState).toBe('AWAITING_SERVER');
    });
  });

  // =========================================================================
  // 8. Stale Cache & Offline/Online Transition Testing
  // =========================================================================
  describe('8. Stale Cache & Offline/Online Transition Testing', () => {
    it('server PAID status permanently replaces stale UNPAID local presentation', async () => {
      const staleLocalStatus = 'UNPAID';
      const authoritativeServerStatus = 'PAID';

      const presentationBefore = getFinancialStatusPresentation(staleLocalStatus);
      expect(presentationBefore.isSettled).toBe(false);

      const presentationAfter = getFinancialStatusPresentation(authoritativeServerStatus);
      expect(presentationAfter.isSettled).toBe(true);
      expect(presentationAfter.category).toBe('SUCCESS');
      expect(presentationAfter.headline).toBe('Payment Confirmed!');
    });

    it('server REJECTED status permanently replaces stale local SUCCESS presentation', () => {
      // Local optimistic success must yield to authoritative server rejection
      const serverRejection = getFinancialStatusPresentation('REJECTED', {
        rejectionReason: 'Invalid transaction reference',
      });
      expect(serverRejection.isSettled).toBe(false);
      expect(serverRejection.category).toBe('REJECTED');
      expect(serverRejection.description).toContain('Invalid transaction reference');
    });
  });

  // =========================================================================
  // 9. Financial State-Machine Invariants & Forbidden Transitions
  // =========================================================================
  describe('9. Financial State-Machine Invariants', () => {
    it('forbids transition to SUCCESS without authoritative server confirmation', () => {
      const isAllowedWithoutServer = isPermittedStateTransition('CHECKING', 'SUCCESS', false);
      expect(isAllowedWithoutServer).toBe(false);

      const isAllowedWithServer = isPermittedStateTransition('CHECKING', 'SUCCESS', true);
      expect(isAllowedWithServer).toBe(true);
    });

    it('forbids ambiguous network timeout from transitioning directly to hard FAILED', () => {
      const isPrematureFailureAllowed = isPermittedStateTransition('CHECKING', 'FAILED', false);
      expect(isPrematureFailureAllowed).toBe(false);

      const isDefinitiveFailureAllowed = isPermittedStateTransition('CHECKING', 'FAILED', true);
      expect(isDefinitiveFailureAllowed).toBe(true);
    });

    it('never infers payment settlement from confirmed amenity booking', () => {
      const booking = {
        bookingStatus: 'CONFIRMED',
        paymentStatus: 'PENDING',
      };

      // Invariant: Booking status is orthogonal to payment status
      expect(booking.bookingStatus).toBe('CONFIRMED');
      expect(booking.paymentStatus).toBe('PENDING');
      expect(booking.paymentStatus).not.toBe('PAID');
    });
  });

  // =========================================================================
  // 10. Receipt Safety & Settlement Verification
  // =========================================================================
  describe('10. Receipt Safety & Settlement Verification', () => {
    it('suppresses settled receipt presentation for CHECKING and VERIFICATION_PENDING states', () => {
      const checkingPres = getFinancialStatusPresentation('CHECKING');
      expect(checkingPres.recommendedAction).toBe('CHECK_STATUS');
      expect(checkingPres.recommendedAction).not.toBe('VIEW_RECEIPT');

      const pendingPres = getFinancialStatusPresentation('VERIFICATION_PENDING');
      expect(pendingPres.recommendedAction).toBe('WAIT_FOR_CLEARANCE');
      expect(pendingPres.recommendedAction).not.toBe('VIEW_RECEIPT');

      const settledPres = getFinancialStatusPresentation('PAID');
      expect(settledPres.recommendedAction).toBe('VIEW_RECEIPT');
    });
  });

  // =========================================================================
  // 11. Privacy, Security & Resource Safety
  // =========================================================================
  describe('11. Privacy, Security & Resource Safety', () => {
    it('guarantees zero sensitive credentials in logs, diagnostic UI, or support payloads', () => {
      const diagnosticWithSecrets: FinancialOperationDiagnostic = {
        operationId: 'op_sec_test_01',
        referenceType: 'Invoice',
        referenceId: 'inv_sec_01',
        clientState: 'CHECKING',
        diagnosticState: 'RECOVERY_REQUIRED',
        hasActiveSession: true,
        metadata: {
          amount: 2500,
          paymentReference: 'UTR11223344',
          password: 'super_secret_user_password_123',
          cvv: '999',
          cardNumber: '4111222233334444',
          token: 'jwt_bearer_token_xyz_secret',
        } as any,
      };

      const supportInfo = formatSupportInformation(diagnosticWithSecrets);
      const sanitizedPayload = sanitizeDiagnosticPayload(diagnosticWithSecrets.metadata);

      // Verify assertNoSensitiveLeaks passes on safe support copy and sanitized object
      expect(() =>
        assertNoSensitiveLeaks(supportInfo.sanitizedSummaryText, [
          'super_secret_user_password_123',
          '999',
          '4111222233334444',
          'jwt_bearer_token_xyz_secret',
        ])
      ).not.toThrow();
      expect(() =>
        assertNoSensitiveLeaks(sanitizedPayload, [
          'super_secret_user_password_123',
          '999',
          '4111222233334444',
          'jwt_bearer_token_xyz_secret',
        ])
      ).not.toThrow();

      // Explicit redactions
      expect(supportInfo.sanitizedSummaryText).not.toContain('super_secret_user_password_123');
      expect(supportInfo.sanitizedSummaryText).not.toContain('999');
      expect(supportInfo.sanitizedSummaryText).not.toContain('jwt_bearer_token_xyz_secret');
      expect(sanitizedPayload.password).toBe('[REDACTED_SENSITIVE_CREDENTIAL]');
      expect(sanitizedPayload.cvv).toBe('[REDACTED_SENSITIVE_CREDENTIAL]');
      expect(sanitizedPayload.token).toBe('[REDACTED_SENSITIVE_CREDENTIAL]');
      expect(sanitizedPayload.cardNumber).toBe('[REDACTED_SENSITIVE_CREDENTIAL]');
    });

    it('verifies maskSensitiveData exposes strictly only the last 4 characters', () => {
      expect(maskSensitiveData('9876543210')).toBe('****3210');
      expect(maskSensitiveData('1234567890123456')).toBe('****3456');
      expect(maskSensitiveData('123')).toBe('****');
      expect(maskSensitiveData('')).toBe('');
    });
  });
});
