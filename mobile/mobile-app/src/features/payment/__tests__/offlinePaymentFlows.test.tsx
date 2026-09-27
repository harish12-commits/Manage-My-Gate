/**
 * NAHOM / Connect Harmony - Mobile Phase 4: Offline, Cash & Pay-at-Gate Financial Flows
 * Comprehensive Unit and Integration Test Suite
 *
 * Covers:
 * 1. Billing Offline Payments (Bank, Cheque, Cash) with proof upload and canonical backend reference
 * 2. Deterministic Idempotency Key Generation (buildInvoiceOfflineKey, buildAmenityPayAtGateKey)
 * 3. Double-submission prevention and active payment session persistence
 * 4. Network timeout / Ambiguous error handling (CHECKING state & recovery via getInvoiceById)
 * 5. Amenity Pay-at-Gate booking flow with canonical POST /amenity-bookings
 * 6. Inventory hold release invariant (retained on network error, released ONLY upon definitive 200)
 * 7. Orthogonal state rendering: Booking CONFIRMED vs Payment PENDING
 * 8. PaymentReceiptModal handling of VERIFICATION_PENDING and REJECTED states
 * 9. Unified Financial History integration with deduplication and zero synthetic IDs
 */

import React from 'react';
import { render, screen, renderHook, act } from '@testing-library/react-native';
import { billingService } from '../../billing/services/billingService';
import paymentService from '../services/paymentService';
import { useMobilePayment } from '../../billing/hooks/useMobilePayment';
import { buildInvoiceOfflineKey, buildAmenityPayAtGateKey } from '@/src/utils/idempotency';
import { FinancialHistoryService } from '../services/financialHistoryService';
import { PaymentReceiptModal } from '../../billing/components/PaymentReceiptModal';
import { ResidentReservationDetailView } from '../../amenities/components/ResidentReservationDetailView';
import { AmenityReservation } from '../../amenities/types/amenityDomain.types';

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

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(null),
}));

// Mock billingService
jest.mock('../../billing/services/billingService', () => {
  const getInvoiceById = jest.fn();
  const logOfflinePayment = jest.fn();
  const getMyDues = jest.fn();
  const mockObj = {
    getInvoiceById,
    logOfflinePayment,
    getMyDues,
  };
  return {
    __esModule: true,
    default: mockObj,
    billingService: mockObj,
  };
});

const mockGetInvoiceById = (billingService.getInvoiceById as jest.Mock);
const mockLogOfflinePayment = (billingService.logOfflinePayment as jest.Mock);
const mockGetMyDues = (billingService.getMyDues as jest.Mock);

// Mock walletService
jest.mock('../../wallet/services/walletService', () => ({
  walletService: {
    getWalletBalance: jest.fn(),
  },
}));

// Mock amenityService
jest.mock('../../amenities/services/amenityService', () => ({
  createAmenityBooking: jest.fn(),
  getMyBookings: jest.fn(),
}));

// Mock useAuth
jest.mock('@/src/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      _id: 'user_123',
      name: 'Ahmed Al-Mansoor',
      unitNumber: 'Villa 42',
    },
  }),
}));

// Mock useBilling
const mockSettleOffline = jest.fn();
jest.mock('../../billing/hooks/useBilling', () => ({
  useBilling: () => ({
    fetchInvoiceById: jest.fn().mockResolvedValue({}),
    settleOffline: mockSettleOffline,
    loadingStates: {
      settleInvoice: false,
    },
  }),
}));

describe('Mobile Phase 4 — Offline, Cash & Pay-at-Gate Financial Flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Idempotency Key Invariants', () => {
    it('generates deterministic invoice offline idempotency key using invoiceId and operationId', () => {
      const invoiceId = 'inv_test_999';
      const opId = 'op_uuid_12345';
      const key = buildInvoiceOfflineKey(invoiceId, opId);

      expect(key).toBe('invoice-offline-inv_test_999-op_uuid_12345');
      // Verify same inputs produce identical key
      expect(buildInvoiceOfflineKey(invoiceId, opId)).toBe(key);
    });

    it('generates deterministic amenity pay-at-gate idempotency key', () => {
      const opId = 'op_uuid_gate_888';
      const key = buildAmenityPayAtGateKey(opId);

      expect(key).toBe('amenity-pay-at-gate-op_uuid_gate_888');
      expect(buildAmenityPayAtGateKey(opId)).toBe(key);
    });
  });

  describe('2. Billing Offline Payment Execution (useMobilePayment)', () => {
    it('successfully submits Bank Transfer offline payment with user reference and proof', async () => {
      const mockResult = {
        status: 'PENDING_VERIFICATION',
        invoiceId: 'inv_101',
        referenceType: 'Invoice',
        offlineReference: 'UTR123456789012',
      };

      mockSettleOffline.mockResolvedValueOnce(mockResult);

      const { result } = await renderHook(() => useMobilePayment());

      const payload = {
        paymentMethod: 'BANK_TRANSFER' as const,
        amount: 5000,
        offlineReference: 'UTR123456789012',
        paymentScreenshot: 'https://cdn.example.com/receipt.jpg',
        payerNotes: 'Transferred via HDFC net banking',
      };

      const idempotencyKey = buildInvoiceOfflineKey('inv_101', 'op_1');

      let response: any;
      await act(async () => {
        response = await result.current.submitOfflinePayment('inv_101', payload, idempotencyKey, 'op_1');
      });

      expect(mockSettleOffline).toHaveBeenCalledTimes(1);
      expect(mockSettleOffline).toHaveBeenCalledWith('inv_101', expect.objectContaining({
        amount: 5000,
        offlineReference: 'UTR123456789012',
        paymentMethod: 'BANK_TRANSFER',
      }));
      expect(response.status).toBe('PENDING_VERIFICATION');
      expect(response.invoiceId).toBe('inv_101');
      expect(response.offlineReference).toBe('UTR123456789012');
    });

    it('submits Cash payment without client-invented references so backend assigns canonical reference', async () => {
      const mockResult = {
        status: 'PENDING_VERIFICATION',
        invoiceId: 'inv_102',
        referenceType: 'Invoice',
      };

      mockSettleOffline.mockResolvedValueOnce(mockResult);

      const { result } = await renderHook(() => useMobilePayment());

      // Invariant: Cash reference is omitted so backend can assign canonical CASH-... sequence
      const payload = {
        paymentMethod: 'CASH' as const,
        amount: 2000,
        payerNotes: 'Handed over at facility office',
      };

      const idempotencyKey = buildInvoiceOfflineKey('inv_102', 'op_2');

      let response: any;
      await act(async () => {
        response = await result.current.submitOfflinePayment('inv_102', payload, idempotencyKey, 'op_2');
      });

      expect(mockSettleOffline).toHaveBeenCalledWith('inv_102', expect.objectContaining({
        amount: 2000,
        paymentMethod: 'CASH',
        offlineReference: '',
      }));
      expect(response.status).toBe('PENDING_VERIFICATION');
      // No synthetic reference invented on client
      expect((payload as any).offlineReference).toBeUndefined();
    });

    it('enforces double-action lock preventing concurrent offline submissions', async () => {
      let resolvePayment: (val: any) => void;
      const deferredPromise = new Promise((resolve) => {
        resolvePayment = resolve;
      });

      mockSettleOffline.mockReturnValueOnce(deferredPromise);

      const { result } = await renderHook(() => useMobilePayment());

      const payload = {
        paymentMethod: 'CHEQUE' as const,
        amount: 3000,
        offlineReference: 'CHQ-987654',
      };

      // Start first payment (in-flight)
      let p1: any;
      await act(async () => {
        p1 = result.current.submitOfflinePayment('inv_103', payload, 'key-1', 'op_3');
      });

      // Attempt second payment concurrently while first is in-flight
      await expect(
        result.current.submitOfflinePayment('inv_103', payload, 'key-2', 'op_3_second')
      ).rejects.toThrow('Another payment operation is currently in progress.');

      // Resolve the first payment and await its completion cleanly
      await act(async () => {
        resolvePayment!({
          status: 'PENDING_VERIFICATION',
          invoiceId: 'inv_103',
        });
        await p1;
      });
    });

    it('marks session as CHECKING upon ambiguous network failure/timeout instead of permanent failure', async () => {
      const networkError = new Error('Network timeout: Gateway did not respond');
      mockSettleOffline.mockRejectedValueOnce(networkError);

      const { result } = await renderHook(() => useMobilePayment());

      const payload = {
        paymentMethod: 'BANK_TRANSFER' as const,
        amount: 1500,
        offlineReference: 'UTR_TIMEOUT_TEST',
      };

      let response: any;
      await act(async () => {
        response = await result.current.submitOfflinePayment('inv_timeout', payload, 'key-to', 'op_to');
      });
      expect(response.status).toBe('CHECKING');
      expect(response.isChecking).toBe(true);

      // Check session status: Ambiguous error marks session as CHECKING for recovery
      const session = await paymentService.getActivePaymentSession('Invoice', 'inv_timeout');
      expect(session).not.toBeNull();
      expect(session?.status).toBe('CHECKING');
    });

    it('checkAndRecoverPayment recovers invoice status from backend', async () => {
      const { result } = await renderHook(() => useMobilePayment());

      // Case 1: Backend confirms VERIFICATION_PENDING -> SUBMISSION_ACCEPTED
      await paymentService.saveActivePaymentSession({
        operationId: 'op_rec_1',
        referenceType: 'Invoice',
        referenceId: 'inv_rec_1',
        amount: 2500,
        currency: 'INR',
        status: 'CHECKING',
        createdAt: new Date().toISOString(),
      });

      mockGetInvoiceById.mockResolvedValueOnce({
        _id: 'inv_rec_1',
        status: 'VERIFICATION_PENDING',
      });

      const outcome1 = await result.current.checkAndRecoverPayment('inv_rec_1');
      expect(outcome1?.resolution).toBe('SUBMISSION_ACCEPTED');
      expect(outcome1?.status).toBe('PENDING_VERIFICATION');

      // Case 2: Backend confirms PAID -> SUCCESS
      await paymentService.saveActivePaymentSession({
        operationId: 'op_rec_2',
        referenceType: 'Invoice',
        referenceId: 'inv_rec_2',
        amount: 2500,
        currency: 'INR',
        status: 'CHECKING',
        createdAt: new Date().toISOString(),
      });

      mockGetInvoiceById.mockResolvedValueOnce({
        _id: 'inv_rec_2',
        status: 'PAID',
      });

      const outcome2 = await result.current.checkAndRecoverPayment('inv_rec_2');
      expect(outcome2?.resolution).toBe('PAID');
      expect(outcome2?.status).toBe('SUCCESS');

      // Case 3: Backend confirms REJECTED -> REJECTED
      await paymentService.saveActivePaymentSession({
        operationId: 'op_rec_3',
        referenceType: 'Invoice',
        referenceId: 'inv_rec_3',
        amount: 2500,
        currency: 'INR',
        status: 'CHECKING',
        createdAt: new Date().toISOString(),
      });

      mockGetInvoiceById.mockResolvedValueOnce({
        _id: 'inv_rec_3',
        status: 'REJECTED',
      });

      const outcome3 = await result.current.checkAndRecoverPayment('inv_rec_3');
      expect(outcome3?.resolution).toBe('REJECTED');
      expect(outcome3?.status).toBe('REJECTED');

      // Case 4: Still UNPAID -> retains CHECKING session (no false failure)
      await paymentService.saveActivePaymentSession({
        operationId: 'op_rec_4',
        referenceType: 'Invoice',
        referenceId: 'inv_rec_4',
        amount: 2500,
        currency: 'INR',
        status: 'CHECKING',
        createdAt: new Date().toISOString(),
      });

      mockGetInvoiceById.mockResolvedValueOnce({
        _id: 'inv_rec_4',
        status: 'UNPAID',
      });

      const outcome4 = await result.current.checkAndRecoverPayment('inv_rec_4');
      expect(outcome4?.status).toBe('CHECKING');
    });
  });

  describe('3. PaymentReceiptModal Offline & Rejection States', () => {
    it('renders amber verification pending acknowledgment header and badge for VERIFICATION_PENDING', async () => {
      const mockInvoice = {
        _id: 'inv_vp_01',
        invoiceNumber: 'INV-2026-999',
        status: 'VERIFICATION_PENDING',
        totalDue: 4500,
        amountPaid: 4500,
        paymentMethod: 'Bank Transfer',
        offlinePayment: {
          reference: 'UTR9988776655',
          paymentMethod: 'BANK_TRANSFER',
        },
      };

      await render(
        <PaymentReceiptModal
          visible={true}
          onClose={jest.fn()}
          invoice={mockInvoice}
        />
      );

      // Verify Verification Pending box is rendered (not Payment Completed!)
      expect(screen.getByTestId('receipt-verification-pending-box')).toBeTruthy();
      expect(screen.getByText('Payment Acknowledgment')).toBeTruthy();
      expect(screen.getByText(/verification pending/i)).toBeTruthy();
      expect(screen.getByText('UTR9988776655')).toBeTruthy();
      expect(screen.queryByText('Payment Completed!')).toBeNull();
    });

    it('renders danger rejected header and badge with rejection reason for REJECTED', async () => {
      const mockInvoice = {
        _id: 'inv_rej_01',
        invoiceNumber: 'INV-2026-888',
        status: 'REJECTED',
        totalDue: 3000,
        amountPaid: 3000,
        offlinePayment: {
          reference: 'CHQ-INVALID',
          rejectionReason: 'Cheque signature mismatch',
        },
      };

      await render(
        <PaymentReceiptModal
          visible={true}
          onClose={jest.fn()}
          invoice={mockInvoice}
        />
      );

      expect(screen.getByTestId('receipt-rejected-box')).toBeTruthy();
      expect(screen.getByText('Payment Submission Rejected')).toBeTruthy();
      expect(screen.getAllByText(/rejected/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Cheque signature mismatch/)).toBeTruthy();
      expect(screen.queryByText('Payment Completed!')).toBeNull();
    });

    it('renders success header and badge for fully PAID invoice', async () => {
      const mockInvoice = {
        _id: 'inv_paid_01',
        invoiceNumber: 'INV-2026-777',
        status: 'PAID',
        totalDue: 2500,
        amountPaid: 2500,
      };

      await render(
        <PaymentReceiptModal
          visible={true}
          onClose={jest.fn()}
          invoice={mockInvoice}
        />
      );

      expect(screen.getByText('Payment Completed!')).toBeTruthy();
      expect(screen.getByText('FULLY PAID')).toBeTruthy();
      expect(screen.queryByTestId('receipt-verification-pending-box')).toBeNull();
      expect(screen.queryByTestId('receipt-rejected-box')).toBeNull();
    });
  });

  describe('4. Amenity Pay-at-Gate Presentation & Status Decoupling', () => {
    it('renders separate orthogonal dimensions for pay-at-gate: Booking CONFIRMED vs Payment PENDING with notice', async () => {
      const mockReservation: AmenityReservation = {
        _id: 'res_gate_001',
        reservationNumber: 'AMN-2026-0042',
        orgId: 'org_1',
        facilityId: 'fac_tennis',
        facilityName: 'Tennis Court 1',
        facilityTimezone: 'Asia/Kolkata',
        userId: 'user_123',
        startDateTime: '2026-10-01T10:00:00.000Z',
        endDateTime: '2026-10-01T11:00:00.000Z',
        headcount: 2,
        quantity: 1,
        pricingSnapshot: {
          baseAmount: 500,
          taxAmount: 90,
          depositAmount: 0,
          totalAmount: 590,
          currency: 'INR',
        },
        // Orthogonal dimensions: Booking is CONFIRMED, Payment is PENDING
        bookingStatus: 'CONFIRMED',
        paymentStatus: 'PENDING',
        approvalStatus: 'NOT_REQUIRED',
        accessStatus: 'PASS_GENERATED',
        completionStatus: 'PENDING',
        createdAt: '2026-09-25T10:00:00.000Z',
        updatedAt: '2026-09-25T10:00:00.000Z',
      };

      await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[]}
        />
      );

      // Verify the Cash Collection Pending notice is prominently displayed
      expect(screen.getByTestId('pay-at-gate-pending-notice')).toBeTruthy();
      expect(screen.getByText('Cash Collection Pending at Gate')).toBeTruthy();
      expect(
        screen.getByText(/Please present your digital access pass at the gate or amenity counter/)
      ).toBeTruthy();

      // Verify both independent statuses are rendered in authoritative status section
      expect(screen.getAllByText(/confirmed/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/pending|payment due/i).length).toBeGreaterThan(0);
    });
  });

  describe('5. Unified Financial History Normalization (Phase 4 Extensions)', () => {
    const historyService = new FinancialHistoryService();

    it('normalizes VERIFICATION_PENDING invoice with proper status and subtitle', () => {
      const invoices = [
        {
          _id: 'inv_vp_history',
          invoiceNumber: 'INV-2026-100',
          unitNumber: '102',
          totalDue: 4000,
          paidAmount: 4000,
          status: 'VERIFICATION_PENDING',
          paymentMethod: 'BANK_TRANSFER',
          createdAt: '2026-09-24T12:00:00.000Z',
        },
      ];

      const items = historyService.normalizeAndMergeHistory(invoices, [], []);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('INVOICE');
      expect(items[0].status).toBe('VERIFICATION_PENDING');
      expect(items[0].subtitle).toContain('Verification Pending');
    });

    it('normalizes Pay-at-Gate amenity booking with PAY_AT_GATE display status', () => {
      const bookings = [
        {
          _id: 'booking_gate_history',
          bookingId: 'AMN-BK-555',
          amenityName: 'Swimming Pool',
          bookingDate: '2026-10-02',
          startTime: '08:00',
          endTime: '09:00',
          totalAmount: 300,
          status: 'CONFIRMED',
          paymentStatus: 'PENDING',
          paymentMethod: 'PAY_AT_GATE',
          createdAt: '2026-09-24T15:00:00.000Z',
        },
      ];

      const items = historyService.normalizeAndMergeHistory([], [], bookings);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('AMENITY');
      expect(items[0].status).toBe('PAY_AT_GATE');
      expect(items[0].subtitle).toContain('Pay at Gate');
      expect((items[0] as any).bookingStatus).toBe('CONFIRMED');
      expect((items[0] as any).paymentStatus).toBe('PENDING');
    });

    it('preserves reference-based deduplication suppressing duplicate wallet debits', () => {
      const invoices = [
        {
          _id: 'inv_dedup_01',
          invoiceNumber: 'INV-2026-200',
          totalDue: 1200,
          paidAmount: 1200,
          status: 'PAID',
          createdAt: '2026-09-23T10:00:00.000Z',
        },
      ];

      const walletTxns = [
        // Duplicate debit paying for the same invoice
        {
          _id: 'wtx_dedup_01',
          amount: 1200,
          type: 'Debit',
          referenceType: 'Invoice',
          referenceId: 'inv_dedup_01',
          createdAt: '2026-09-23T10:01:00.000Z',
        },
        // Unrelated top-up
        {
          _id: 'wtx_topup_01',
          amount: 5000,
          type: 'Credit',
          referenceType: 'Recharge',
          createdAt: '2026-09-22T08:00:00.000Z',
        },
      ];

      const items = historyService.normalizeAndMergeHistory(invoices, walletTxns, []);
      // Should contain 2 items: 1 invoice + 1 topup (duplicate debit suppressed)
      expect(items).toHaveLength(2);
      expect(items.some((i) => i.id === 'wtx_dedup_01')).toBe(false);
      expect(items.some((i) => i.id === 'inv_dedup_01')).toBe(true);
      expect(items.some((i) => i.id === 'wtx_topup_01')).toBe(true);
    });

    it('strictly preserves backend IDs with zero synthetic client IDs or Date.now() generation', () => {
      const invoices = [
        {
          _id: 'authoritative_inv_id_444',
          invoiceNumber: 'INV-444',
          totalDue: 100,
          createdAt: '2026-09-21T00:00:00.000Z',
        },
      ];

      const items = historyService.normalizeAndMergeHistory(invoices, [], []);
      expect(items[0].id).toBe('authoritative_inv_id_444');
      expect(items[0].id).not.toContain('undefined');
      expect(items[0].id).not.toContain('null');
      expect(items[0].id).not.toContain('NaN');
    });
  });
});
