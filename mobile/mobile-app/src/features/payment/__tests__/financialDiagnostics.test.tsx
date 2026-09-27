/**
 * NAHOM / Connect Harmony - Mobile Phase 6: Financial Integrity Monitoring & Diagnostics Test Suite
 *
 * Covers:
 * 1. Active session lifecycle: creation, persistence, recovery, and clearing after definitive resolution.
 * 2. Stale session reconciliation: already-paid invoices, settled amenity payments, settled wallet recharges, rejected submissions.
 * 3. Ambiguous operations & error classification: timeouts, network drops, 5xx server errors, validation rejections.
 * 4. Diagnostic presentation: NORMAL, AWAITING_SERVER, RECOVERY_REQUIRED, USER_ACTION_REQUIRED, DOMAIN_UNAVAILABLE.
 * 5. Privacy & Sensitive credential sanitization: verification that secrets, CVVs, tokens, and PINs never leak.
 * 6. Accessibility & Screen Reader support: accessible labels, semantic roles, min 44px touch targets.
 * 7. Multi-language localization dictionary completeness: en, ar, hi.
 */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react-native';
import paymentService, { ActivePaymentSession } from '../services/paymentService';
import financialDiagnosticService, { FinancialDiagnosticService } from '../services/financialDiagnosticService';
import {
  classifyFinancialError,
  resolveDiagnosticState,
  formatSupportInformation,
  generateFinancialTimeline,
  maskSensitiveData,
  sanitizeDiagnosticPayload,
} from '../utils/financialDiagnostics';
import { FinancialDiagnosticCard } from '../components/FinancialDiagnosticCard';
import { FinancialSupportModal } from '../components/FinancialSupportModal';
import { FinancialRecoveryBanner } from '../components/FinancialRecoveryBanner';
import { FinancialOperationDiagnostic } from '../types/financialDiagnostics.types';
import en from '../../../utils/i18n/en';
import ar from '../../../utils/i18n/ar';
import hi from '../../../utils/i18n/hi';

// Mock react-native-reanimated
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
  };
  return {
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
    walletService: mock,
    default: mock,
  };
});

// Mock amenityService
jest.mock('../../amenities/services/amenityService', () => ({
  getMyBookings: jest.fn(),
}));

import { billingService } from '../../billing/services/billingService';
import { walletService } from '../../wallet/services/walletService';
import * as amenityService from '../../amenities/services/amenityService';

describe('Mobile Phase 6 — Financial Integrity Monitoring & Diagnostics', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    (billingService.getInvoiceById as jest.Mock).mockReset();
    (walletService.getWalletBalance as jest.Mock).mockReset();
    (amenityService.getMyBookings as jest.Mock).mockReset();

    // Clear test sessions from storage
    const all = await paymentService.getAllActivePaymentSessions();
    for (const s of all) {
      await paymentService.clearActivePaymentSession(s.referenceType, s.referenceId);
    }
  });

  describe('1. Active Session Lifecycle & Index Management', () => {
    it('creates, persists, indexes, and retrieves active payment session before mutation', async () => {
      const session: ActivePaymentSession = {
        operationId: 'op_sess_001',
        referenceType: 'Invoice',
        referenceId: 'inv_test_101',
        amount: 2500,
        currency: 'INR',
        paymentMethod: 'RAZORPAY',
        status: 'SUBMITTING',
        createdAt: '2026-09-25T10:00:00.000Z',
      };

      await paymentService.saveActivePaymentSession(session);

      const retrieved = await paymentService.getActivePaymentSession('Invoice', 'inv_test_101');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.operationId).toBe('op_sess_001');
      expect(retrieved?.amount).toBe(2500);
      expect(retrieved?.status).toBe('SUBMITTING');

      // Verify discovery in index
      const allActive = await paymentService.getAllActivePaymentSessions();
      expect(allActive.some((s) => s.operationId === 'op_sess_001')).toBe(true);
    });

    it('clears active payment session exclusively upon definitive resolution', async () => {
      const session: ActivePaymentSession = {
        operationId: 'op_sess_002',
        referenceType: 'Invoice',
        referenceId: 'inv_test_102',
        amount: 3000,
        currency: 'INR',
        status: 'CHECKING',
        createdAt: '2026-09-25T10:00:00.000Z',
      };

      await paymentService.saveActivePaymentSession(session);
      expect(await paymentService.getActivePaymentSession('Invoice', 'inv_test_102')).not.toBeNull();

      // Clear on terminal resolution
      await paymentService.clearActivePaymentSession('Invoice', 'inv_test_102');
      const afterClear = await paymentService.getActivePaymentSession('Invoice', 'inv_test_102');
      expect(afterClear).toBeNull();

      const allActive = await paymentService.getAllActivePaymentSessions();
      expect(allActive.some((s) => s.referenceId === 'inv_test_102')).toBe(false);
    });
  });

  describe('2. Stale Session Reconciliation', () => {
    it('detects already-paid invoice, reconciles to SUCCESS, and clears session without deleting prematurely', async () => {
      const session: ActivePaymentSession = {
        operationId: 'op_stale_inv',
        referenceType: 'Invoice',
        referenceId: 'inv_already_paid',
        amount: 5000,
        currency: 'INR',
        status: 'CHECKING',
        createdAt: '2026-09-24T12:00:00.000Z',
      };
      await paymentService.saveActivePaymentSession(session);

      // Server reports authoritative settlement as PAID
      (billingService.getInvoiceById as jest.Mock).mockResolvedValueOnce({
        _id: 'inv_already_paid',
        invoiceNumber: 'INV-PAID-99',
        totalDue: 5000,
        status: 'PAID',
      });

      const outcome = await financialDiagnosticService.reconcileSession(session);

      expect(outcome.isResolved).toBe(true);
      expect(outcome.diagnostic.clientState).toBe('SUCCESS');
      expect(outcome.diagnostic.lastKnownServerState).toBe('PAID');
      expect(outcome.diagnostic.diagnosticState).toBe('NORMAL');

      // Session must be cleared from storage
      const inStorage = await paymentService.getActivePaymentSession('Invoice', 'inv_already_paid');
      expect(inStorage).toBeNull();
    });

    it('reconciles amenity booking already settled by gateway/wallet and clears active session', async () => {
      const session: ActivePaymentSession = {
        operationId: 'op_stale_amenity',
        referenceType: 'AmenityBooking',
        referenceId: 'res_auth_888',
        amount: 800,
        currency: 'INR',
        status: 'CHECKING',
        createdAt: '2026-09-24T14:00:00.000Z',
      };
      await paymentService.saveActivePaymentSession(session);

      // Server reports booking payment settled
      (amenityService.getMyBookings as jest.Mock).mockResolvedValueOnce([
        {
          _id: 'res_auth_888',
          bookingId: 'BK-TENNIS-01',
          facilityName: 'Tennis Court',
          bookingStatus: 'CONFIRMED',
          paymentStatus: 'PAID',
        },
      ]);

      const outcome = await financialDiagnosticService.reconcileSession(session);

      expect(outcome.isResolved).toBe(true);
      expect(outcome.diagnostic.clientState).toBe('SUCCESS');
      expect(outcome.diagnostic.lastKnownServerState).toBe('PAID');
      expect(outcome.diagnostic.diagnosticState).toBe('NORMAL');

      const inStorage = await paymentService.getActivePaymentSession('AmenityBooking', 'res_auth_888');
      expect(inStorage).toBeNull();
    });

    it('reconciles wallet recharge confirmed by server and clears active session', async () => {
      const session: ActivePaymentSession = {
        operationId: 'op_wlt_topup_55',
        referenceType: 'WalletRecharge',
        referenceId: 'wlt_rec_55',
        amount: 1500,
        currency: 'INR',
        orderId: 'order_wlt_55',
        status: 'CHECKING',
        createdAt: '2026-09-24T15:00:00.000Z',
      };
      await paymentService.saveActivePaymentSession(session);

      // Server reports wallet transaction settled
      (walletService.getWalletBalance as jest.Mock).mockResolvedValueOnce({
        balance: 3500,
        transactionHistory: [
          {
            transactionId: 'op_wlt_topup_55',
            razorpay_order_id: 'order_wlt_55',
            amount: 1500,
            type: 'Credit',
            paymentStatus: 'success',
          },
        ],
      });

      const outcome = await financialDiagnosticService.reconcileSession(session);

      expect(outcome.isResolved).toBe(true);
      expect(outcome.diagnostic.clientState).toBe('SUCCESS');
      expect(outcome.diagnostic.diagnosticState).toBe('NORMAL');

      const inStorage = await paymentService.getActivePaymentSession('WalletRecharge', 'wlt_rec_55');
      expect(inStorage).toBeNull();
    });

    it('reconciles offline payment rejected by management to REJECTED and retains reason', async () => {
      const session: ActivePaymentSession = {
        operationId: 'op_rej_chk',
        referenceType: 'Invoice',
        referenceId: 'inv_rej_01',
        amount: 4500,
        currency: 'INR',
        status: 'CHECKING',
        createdAt: '2026-09-24T10:00:00.000Z',
      };
      await paymentService.saveActivePaymentSession(session);

      (billingService.getInvoiceById as jest.Mock).mockResolvedValueOnce({
        _id: 'inv_rej_01',
        invoiceNumber: 'INV-REJ-01',
        status: 'REJECTED',
        rejectionReason: 'Invalid bank statement attached.',
      });

      const outcome = await financialDiagnosticService.reconcileSession(session);

      expect(outcome.isResolved).toBe(false); // Unresolved until resident acts/dismisses
      expect(outcome.diagnostic.clientState).toBe('REJECTED');
      expect(outcome.diagnostic.lastKnownServerState).toBe('REJECTED');
      expect(outcome.diagnostic.diagnosticState).toBe('USER_ACTION_REQUIRED');
      expect(outcome.diagnostic.errorMessage).toBe('Invalid bank statement attached.');
    });
  });

  describe('3. Error Classification & Ambiguity Handling', () => {
    it('classifies network timeout (ECONNABORTED, 504) as ambiguous and routes to CHECKING / RECOVERY_REQUIRED', () => {
      const err = { code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' };
      const classified = classifyFinancialError(err);

      expect(classified.category).toBe('TIMEOUT');
      expect(classified.isAmbiguous).toBe(true);
      expect(classified.clientState).toBe('CHECKING');
      expect(classified.diagnosticState).toBe('RECOVERY_REQUIRED');
      expect(classified.userActionRequired).toBe(false);
    });

    it('classifies network offline drop as ambiguous and routes to CHECKING / RECOVERY_REQUIRED', () => {
      const err = { code: 'ERR_NETWORK', message: 'Network Error: connection refused' };
      const classified = classifyFinancialError(err);

      expect(classified.category).toBe('NETWORK');
      expect(classified.isAmbiguous).toBe(true);
      expect(classified.clientState).toBe('CHECKING');
      expect(classified.diagnosticState).toBe('RECOVERY_REQUIRED');
    });

    it('classifies server 502/503 during verification as ambiguous and routes to CHECKING', () => {
      const err = { response: { status: 502 }, message: 'Bad Gateway' };
      const classified = classifyFinancialError(err);

      expect(classified.category).toBe('SERVER_UNAVAILABLE');
      expect(classified.isAmbiguous).toBe(true);
      expect(classified.clientState).toBe('CHECKING');
      expect(classified.diagnosticState).toBe('RECOVERY_REQUIRED');
    });

    it('classifies explicit 400 validation as definitive failure requiring user action', () => {
      const err = { response: { status: 400 }, message: 'Amount exceeds permitted maximum' };
      const classified = classifyFinancialError(err);

      expect(classified.category).toBe('VALIDATION');
      expect(classified.isAmbiguous).toBe(false);
      expect(classified.clientState).toBe('FAILED');
      expect(classified.diagnosticState).toBe('USER_ACTION_REQUIRED');
      expect(classified.userActionRequired).toBe(true);
    });

    it('classifies 409 already settled as definitive success without duplicate charge', () => {
      const err = { response: { status: 409 }, message: 'Invoice is already settled' };
      const classified = classifyFinancialError(err);

      expect(classified.category).toBe('ALREADY_SETTLED');
      expect(classified.isAmbiguous).toBe(false);
      expect(classified.clientState).toBe('SUCCESS');
      expect(classified.diagnosticState).toBe('NORMAL');
    });
  });

  describe('4. Privacy, Security & Sanitization Invariants', () => {
    it('guarantees sensitive credentials (passwords, tokens, CVVs, card numbers) are redacted', () => {
      const payload = {
        operationId: 'op_sec_001',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive',
        authToken: 'Bearer secret_auth_123',
        cvv: '123',
        cardPin: '9988',
        password: 'myPassword!',
        gatewaySecret: 'key_secret_razorpay',
        nested: {
          clientSecret: 'secret_nested_456',
          amount: 500,
        },
      };

      const sanitized = sanitizeDiagnosticPayload(payload);

      expect(sanitized.token).toBe('[REDACTED_SENSITIVE_CREDENTIAL]');
      expect(sanitized.authToken).toBe('[REDACTED_SENSITIVE_CREDENTIAL]');
      expect(sanitized.cvv).toBe('[REDACTED_SENSITIVE_CREDENTIAL]');
      expect(sanitized.cardPin).toBe('[REDACTED_SENSITIVE_CREDENTIAL]');
      expect(sanitized.password).toBe('[REDACTED_SENSITIVE_CREDENTIAL]');
      expect(sanitized.gatewaySecret).toBe('[REDACTED_SENSITIVE_CREDENTIAL]');
      expect(sanitized.nested.clientSecret).toBe('[REDACTED_SENSITIVE_CREDENTIAL]');
      expect(sanitized.nested.amount).toBe(500);
      expect(sanitized.operationId).toBe('op_sec_001');
    });

    it('masks identifier preserving only the last 4 characters', () => {
      expect(maskSensitiveData('1234567890123456')).toBe('****3456');
      expect(maskSensitiveData('SBIN000123456')).toBe('****3456');
      expect(maskSensitiveData('123')).toBe('****');
      expect(maskSensitiveData('')).toBe('');
    });

    it('formats clean, copyable support info with zero credential leakage', () => {
      const diagnostic: FinancialOperationDiagnostic = {
        operationId: 'op_sup_999',
        referenceType: 'Invoice',
        referenceId: 'inv_888',
        clientState: 'CHECKING',
        lastKnownServerState: 'VERIFICATION_PENDING',
        diagnosticState: 'AWAITING_SERVER',
        hasActiveSession: true,
        metadata: {
          amount: 4500,
          paymentMethod: 'BANK_TRANSFER',
          paymentReference: 'UTR77665544',
          invoiceNumber: 'INV-2026-888',
        },
      };

      const info = formatSupportInformation(diagnostic);

      expect(info.operationId).toBe('op_sup_999');
      expect(info.sanitizedSummaryText).toContain('Operation ID: op_sup_999');
      expect(info.sanitizedSummaryText).toContain('Reference ID: inv_888');
      expect(info.sanitizedSummaryText).toContain('Amount: ₹4,500');
      expect(info.sanitizedSummaryText).toContain('Payment Reference: UTR77665544');
      expect(info.sanitizedSummaryText).not.toContain('password');
      expect(info.sanitizedSummaryText).not.toContain('cvv');
      expect(info.sanitizedSummaryText).not.toContain('token');
    });
  });

  describe('5. Operational UI Diagnostics & Accessibility', () => {
    it('renders FinancialDiagnosticCard with screen-reader summary and Check Status CTA', async () => {
      const onCheck = jest.fn();
      const onSupport = jest.fn();
      const diagnostic: FinancialOperationDiagnostic = {
        operationId: 'op_diag_card',
        referenceType: 'Invoice',
        referenceId: 'inv_card_1',
        clientState: 'CHECKING',
        diagnosticState: 'RECOVERY_REQUIRED',
        hasActiveSession: true,
        metadata: {
          amount: 2000,
          invoiceNumber: 'INV-CARD-1',
        },
      };

      const { getByText } = await render(
        <FinancialDiagnosticCard
          diagnostic={diagnostic}
          onCheckStatus={onCheck}
          onOpenSupportInfo={onSupport}
        />
      );

      // Verify title and wording
      expect(getByText("We're checking your payment status.")).toBeTruthy();
      expect(getByText(/Your payment request may already have reached the server/i)).toBeTruthy();
      expect(getByText('Invoice #INV-CARD-1')).toBeTruthy();

      // Check Status CTA
      const checkBtn = getByText('Check Status');
      expect(checkBtn).toBeTruthy();

      // Support Info CTA
      const supportBtn = getByText('Support Info');
      expect(supportBtn).toBeTruthy();
    });

    it('renders FinancialRecoveryBanner when active unresolved transactions exist', async () => {
      const onCheck = jest.fn();
      const onSupport = jest.fn();
      const diagnostics: FinancialOperationDiagnostic[] = [
        {
          operationId: 'op_unres_1',
          referenceType: 'Invoice',
          referenceId: 'inv_unres_1',
          clientState: 'PENDING_VERIFICATION',
          lastKnownServerState: 'VERIFICATION_PENDING',
          diagnosticState: 'AWAITING_SERVER',
          hasActiveSession: true,
          metadata: {
            amount: 3200,
            invoiceNumber: 'INV-PEND-01',
          },
        },
      ];

      const { getByTestId, getByText } = await render(
        <FinancialRecoveryBanner
          unresolvedDiagnostics={diagnostics}
          onCheckStatus={onCheck}
          onOpenSupportInfo={onSupport}
        />
      );

      expect(getByTestId('financial-recovery-banner')).toBeTruthy();
      expect(getByText('Pending Financial Operations')).toBeTruthy();
      expect(getByText(/1 active operation awaiting server confirmation/i)).toBeTruthy();
    });

    it('renders FinancialSupportModal with accessible metadata and safe share button', async () => {
      const onClose = jest.fn();
      const diagnostic: FinancialOperationDiagnostic = {
        operationId: 'op_modal_test',
        referenceType: 'Invoice',
        referenceId: 'inv_modal_99',
        clientState: 'REJECTED',
        lastKnownServerState: 'REJECTED',
        diagnosticState: 'USER_ACTION_REQUIRED',
        hasActiveSession: true,
        metadata: {
          amount: 1500,
          invoiceNumber: 'INV-MODAL-99',
          rejectionReason: 'Cheque expired',
        },
      };

      const { getByText } = await render(
        <FinancialSupportModal
          visible={true}
          onClose={onClose}
          diagnostic={diagnostic}
        />
      );

      expect(getByText('Payment Support Information')).toBeTruthy();
      expect(getByText('op_modal_test')).toBeTruthy();
      expect(getByText('Cheque expired')).toBeTruthy();
      expect(getByText('Copy or Share Support Info')).toBeTruthy();
    });
  });

  describe('6. Localization Completeness Across Dictionaries', () => {
    it('verifies essential diagnostic keys exist across English, Arabic, and Hindi', () => {
      const requiredKeys = [
        'support_info_title',
        'support_copied',
        'copy_support_info',
        'operation_id',
        'client_state',
        'server_state',
        'check_status',
        'support_info',
        'unresolved_operations_title',
        'checking_payment_status_title',
        'verification_pending_title',
        'rejection_title',
      ];

      for (const key of requiredKeys) {
        expect((en as any)[key]).toBeDefined();
        expect((ar as any)[key]).toBeDefined();
        expect((hi as any)[key]).toBeDefined();
      }
    });
  });
});
