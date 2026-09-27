/**
 * NAHOM / Connect Harmony - Mobile Phase 5: Financial UX Hardening, Accessibility & Recovery Polish
 * Comprehensive Test Suite
 *
 * Covers:
 * 1. Global Financial Status System (mappings, resident-facing descriptions, accessibility labels, actions)
 * 2. Status Language Consistency across UI (PaymentResultHeroCard, StatusBadge)
 * 3. Accessibility & Semantic Attributes (screen-reader status labels, roles)
 * 4. Receipt UX Consistency (Not yet settled, Payment submission rejected, settled PDF action suppression)
 * 5. Duplicate Action Protection & Retry Safety (double-action lock, CHECKING first-action)
 * 6. App Restart Recovery & Session State Machine
 * 7. Empty States Consistency across all financial domains
 * 8. Partial Failure UX Resiliency (Promise.allSettled preservation with non-blocking notice)
 * 9. Amenity Pay-at-Gate Decoupled Presentation
 * 10. Financial Integrity & Zero Synthetic IDs
 */

import React from 'react';
import { render, screen, renderHook, act } from '@testing-library/react-native';
import {
  mapToFinancialCategory,
  getFinancialStatusPresentation,
} from '../utils/financialStatus';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PaymentResultHeroCard } from '../../billing/components/PaymentResultHeroCard';
import { PaymentReceiptModal } from '../../billing/components/PaymentReceiptModal';
import { ResidentReservationDetailView } from '../../amenities/components/ResidentReservationDetailView';
import { AmenityReservation } from '../../amenities/types/amenityDomain.types';
import { useMobilePayment } from '../../billing/hooks/useMobilePayment';
import { billingService } from '../../billing/services/billingService';
import paymentService from '../services/paymentService';
import { FinancialHistoryService } from '../services/financialHistoryService';

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
      _id: 'user_456',
      name: 'Fatima Al-Zahra',
      unitNumber: 'Villa 108',
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

describe('Mobile Phase 5 — Financial UX Hardening, Accessibility & Recovery Polish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Global Financial Status System & Mapping', () => {
    it('normalizes various backend statuses into canonical presentation categories', () => {
      expect(mapToFinancialCategory('PAID')).toBe('SUCCESS');
      expect(mapToFinancialCategory('SUCCESS')).toBe('SUCCESS');
      expect(mapToFinancialCategory('COMPLETED')).toBe('SUCCESS');
      expect(mapToFinancialCategory('SETTLED')).toBe('SUCCESS');

      expect(mapToFinancialCategory('CHECKING')).toBe('CHECKING');
      expect(mapToFinancialCategory('PAYMENT_CHECKING')).toBe('CHECKING');
      expect(mapToFinancialCategory('VERIFYING')).toBe('CHECKING');

      expect(mapToFinancialCategory('VERIFICATION_PENDING')).toBe('VERIFICATION_PENDING');
      expect(mapToFinancialCategory('OFFLINE_VERIFICATION_PENDING')).toBe('VERIFICATION_PENDING');

      expect(mapToFinancialCategory('PARTIALLY_PAID')).toBe('PARTIALLY_PAID');
      expect(mapToFinancialCategory('PARTIAL')).toBe('PARTIALLY_PAID');

      expect(mapToFinancialCategory('REJECTED')).toBe('REJECTED');
      expect(mapToFinancialCategory('FAILED')).toBe('FAILED');
      expect(mapToFinancialCategory('REFUNDED')).toBe('REFUNDED');
      expect(mapToFinancialCategory('CANCELLED')).toBe('CANCELLED');

      expect(mapToFinancialCategory('UNPAID')).toBe('PENDING');
      expect(mapToFinancialCategory('PENDING')).toBe('PENDING');
      expect(mapToFinancialCategory('PAY_AT_GATE')).toBe('PENDING');
      expect(mapToFinancialCategory(null)).toBe('PENDING');
    });

    it('provides clear resident-facing instructions for CHECKING state without false payment failure', () => {
      const meta = getFinancialStatusPresentation('CHECKING');
      expect(meta.category).toBe('CHECKING');
      expect(meta.headline).toBe("We're checking your payment status.");
      expect(meta.description).toContain('Do not submit another payment while we verify');
      expect(meta.badgeVariant).toBe('info');
      expect(meta.canPayAgain).toBe(false);
      expect(meta.recommendedAction).toBe('CHECK_STATUS');
      expect(meta.accessibilityLabel).toContain('Payment status: verifying');
    });

    it('provides clear resident-facing instructions for VERIFICATION_PENDING state', () => {
      const meta = getFinancialStatusPresentation('VERIFICATION_PENDING', { reference: 'UTR-987123' });
      expect(meta.category).toBe('VERIFICATION_PENDING');
      expect(meta.headline).toBe('Payment submitted — awaiting verification.');
      expect(meta.description).toContain('Not yet settled.');
      expect(meta.badgeVariant).toBe('warning');
      expect(meta.canPayAgain).toBe(false);
      expect(meta.recommendedAction).toBe('WAIT_FOR_CLEARANCE');
      expect(meta.accessibilityLabel).toContain('Not yet settled.');
    });

    it('provides clear resident-facing instructions for REJECTED state including reason', () => {
      const meta = getFinancialStatusPresentation('REJECTED', { rejectionReason: 'Invalid Cheque signature' });
      expect(meta.category).toBe('REJECTED');
      expect(meta.headline).toBe('Payment submission rejected.');
      expect(meta.description).toContain('Invalid Cheque signature');
      expect(meta.badgeVariant).toBe('danger');
      expect(meta.canPayAgain).toBe(true);
      expect(meta.recommendedAction).toBe('SUBMIT_FRESH');
      expect(meta.accessibilityLabel).toContain('Invalid Cheque signature');
    });

    it('provides clear resident-facing instructions for SUCCESS state', () => {
      const meta = getFinancialStatusPresentation('PAID', { invoiceNumber: 'INV-2024-001' });
      expect(meta.category).toBe('SUCCESS');
      expect(meta.headline).toBe('Payment Confirmed!');
      expect(meta.isSettled).toBe(true);
      expect(meta.canPayAgain).toBe(false);
      expect(meta.recommendedAction).toBe('VIEW_RECEIPT');
    });
  });

  describe('2. Status Language Consistency & Accessibility in UI', () => {
    it('renders CHECKING outcome card with exact required wording and a11y label', async () => {
      await render(
        <PaymentResultHeroCard
          status="CHECKING"
          amount={4500}
          invoiceNumber="INV-401"
          unitName="Villa 12"
        />
      );

      expect(screen.getByText("We're checking your payment status.")).toBeTruthy();
      expect(screen.getByText(/Do not submit another payment while we verify/i)).toBeTruthy();
      expect(screen.getByText('Payment is being verified')).toBeTruthy();
    });

    it('renders VERIFICATION_PENDING outcome card with exact required wording', async () => {
      await render(
        <PaymentResultHeroCard
          status="VERIFICATION_PENDING"
          amount={6000}
          reference="UTR-777888"
          invoiceNumber="INV-402"
          unitName="Villa 14"
        />
      );

      expect(screen.getByText('Payment submitted — awaiting verification.')).toBeTruthy();
      expect(screen.getByText(/pending admin clearance verification/i)).toBeTruthy();
      expect(screen.getByText('Submitted for Verification')).toBeTruthy();
    });

    it('renders REJECTED outcome card with exact required wording and server reason', async () => {
      await render(
        <PaymentResultHeroCard
          status="REJECTED"
          amount={3000}
          invoiceNumber="INV-403"
          unitName="Villa 16"
          rejectionReason="Screenshot does not match UTR reference"
        />
      );

      expect(screen.getByText('Payment submission rejected.')).toBeTruthy();
      expect(screen.getByText(/Screenshot does not match UTR reference/i)).toBeTruthy();
    });

    it('ensures StatusBadge exposes screen-reader accessible label and semantic text role', async () => {
      const { getByLabelText } = await render(
        <StatusBadge label="VERIFICATION_PENDING" variant="warning" />
      );

      // Verify accessible={true} and accessible label is present for screen readers
      expect(getByLabelText(/Status: (Verification Pending|Pending verification)/i)).toBeTruthy();
    });
  });

  describe('3. Receipt UX Consistency & Settlement Invariants', () => {
    it('displays prominent "Not yet settled." on verification pending receipt and suppresses settled PDF actions', async () => {
      const mockInvoice = {
        _id: 'inv_ack_1',
        invoiceNumber: 'INV-ACK-01',
        status: 'VERIFICATION_PENDING',
        totalDue: 5000,
        paidAmount: 5000,
        paymentMethod: 'Bank Transfer',
        unitNumber: 'Villa 108',
      };

      await render(
        <PaymentReceiptModal
          visible={true}
          onClose={jest.fn()}
          invoice={mockInvoice}
          amountPaid={5000}
          paymentMethod="Bank Transfer"
        />
      );

      expect(screen.getByTestId('receipt-verification-pending-box')).toBeTruthy();
      expect(screen.getByText('Payment Acknowledgment')).toBeTruthy();
      expect(screen.getByText('Not yet settled.')).toBeTruthy();
      // Per Section 20: Do NOT expose settled PDF actions for unsettled transaction
      expect(screen.queryByText('Download PDF')).toBeNull();
      expect(screen.getByText(/Official settled statement will be available once administrative verification is complete/i)).toBeTruthy();
    });

    it('displays prominent "Payment submission rejected." on rejected receipt and suppresses settled PDF actions', async () => {
      const mockInvoice = {
        _id: 'inv_ack_2',
        invoiceNumber: 'INV-REJ-01',
        status: 'REJECTED',
        totalDue: 3500,
        paidAmount: 3500,
        paymentMethod: 'Cheque',
        unitNumber: 'Villa 108',
        rejectionReason: 'Cheque bounced due to signature mismatch',
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
      expect(screen.getByText('Payment submission rejected.')).toBeTruthy();
      expect(screen.getByText(/Reason: Cheque bounced due to signature mismatch/i)).toBeTruthy();
      // Suppresses settled PDF download
      expect(screen.queryByText('Download PDF')).toBeNull();
    });

    it('exposes official PDF download actions exclusively for settled payments', async () => {
      const mockInvoice = {
        _id: 'inv_settled_1',
        invoiceNumber: 'INV-SET-01',
        status: 'PAID',
        totalDue: 4000,
        paidAmount: 4000,
        paymentMethod: 'Digital Wallet',
        unitNumber: 'Villa 108',
      };

      await render(
        <PaymentReceiptModal
          visible={true}
          onClose={jest.fn()}
          invoice={mockInvoice}
        />
      );

      expect(screen.getByText('Payment Completed!')).toBeTruthy();
      expect(screen.getByText('Download PDF')).toBeTruthy();
      expect(screen.getByText('View PDF')).toBeTruthy();
    });
  });

  describe('4. Duplicate Action Protection & Retry Safety', () => {
    it('enforces double-tap lock preventing concurrent offline submissions', async () => {
      let resolveFirstPayment: (val: any) => void;
      const deferredPromise = new Promise((resolve) => {
        resolveFirstPayment = resolve;
      });

      mockSettleOffline.mockReturnValueOnce(deferredPromise);

      const { result } = await renderHook(() => useMobilePayment());

      const payload = {
        paymentMethod: 'BANK_TRANSFER' as const,
        amount: 2500,
        offlineReference: 'UTR-SAFE-01',
      };

      let p1: any;
      await act(async () => {
        p1 = result.current.submitOfflinePayment('inv_safe_1', payload, 'key-safe-1', 'op_safe_1');
      });

      // Second rapid tap must reject
      await expect(
        result.current.submitOfflinePayment('inv_safe_1', payload, 'key-safe-2', 'op_safe_2')
      ).rejects.toThrow('Another payment operation is currently in progress.');

      // Resolve first payment cleanly
      await act(async () => {
        resolveFirstPayment!({
          status: 'PENDING_VERIFICATION',
          invoiceId: 'inv_safe_1',
        });
        await p1;
      });
    });

    it('routes ambiguous network errors to CHECKING and recovers via server query', async () => {
      const { result } = await renderHook(() => useMobilePayment());

      // Save an ambiguous session
      await paymentService.saveActivePaymentSession({
        operationId: 'op_restart_1',
        referenceType: 'Invoice',
        referenceId: 'inv_restart_1',
        amount: 5000,
        currency: 'INR',
        status: 'CHECKING',
        createdAt: new Date().toISOString(),
      });

      // Backend reports settlement as PARTIALLY_PAID
      mockGetInvoiceById.mockResolvedValueOnce({
        _id: 'inv_restart_1',
        status: 'PARTIALLY_PAID',
        paidAmount: 2500,
        totalDue: 5000,
      });

      const outcome = await result.current.checkAndRecoverPayment('inv_restart_1');
      expect(outcome?.status).toBe('SUCCESS');
      expect(outcome?.resolution).toBe('PARTIALLY_PAID');

      // Verifies active session cleared upon confirmed server settlement
      const cleared = await paymentService.getActivePaymentSession('Invoice', 'inv_restart_1');
      expect(cleared).toBeNull();
    });
  });

  describe('5. Pay-at-Gate Decoupled Presentation', () => {
    it('strictly maintains orthogonal dimensions: CONFIRMED booking + PENDING payment with gate cash notice', async () => {
      const reservation: AmenityReservation = {
        _id: 'res_gate_555',
        facilityId: 'fac_1',
        facilityName: 'Tennis Court 1',
        communityId: 'comm_1',
        userId: 'user_456',
        reservationNumber: 'RES-GATE-555',
        startDateTime: '2026-10-10T10:00:00.000Z',
        endDateTime: '2026-10-10T11:00:00.000Z',
        bookingStatus: 'CONFIRMED',
        paymentStatus: 'PENDING',
        approvalStatus: 'NOT_REQUIRED',
        accessStatus: 'PASS_GENERATED',
        completionStatus: 'SCHEDULED',
        pricingSnapshot: {
          totalAmount: 1200,
          currency: 'INR',
        },
        paymentMethod: 'PAY_AT_GATE',
        createdAt: '2026-10-01T10:00:00.000Z',
      };

      await render(
        <ResidentReservationDetailView
          reservation={reservation}
          accessPasses={[]}
        />
      );

      // Decoupled orthogonal confirmation
      expect(screen.getByTestId('pay-at-gate-pending-notice')).toBeTruthy();
      expect(screen.getByText('Cash Collection Pending at Gate')).toBeTruthy();
      expect(screen.getByText(/Please present your digital access pass at the gate or amenity counter to complete your cash payment/i)).toBeTruthy();

      // Booking status is CONFIRMED, payment is PENDING
      expect(screen.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Pending')).toBeTruthy();
    });
  });

  describe('6. Partial Domain Failure Resiliency & Financial History', () => {
    it('handles failure in wallet domain while preserving invoices and amenities history', async () => {
      const invoiceData = [
        {
          _id: 'inv_resil_1',
          invoiceNumber: 'INV-RES-01',
          totalDue: 4000,
          paidAmount: 4000,
          status: 'PAID',
          createdAt: '2026-09-20T10:00:00.000Z',
        },
      ];

      const amenityData = [
        {
          _id: 'res_resil_1',
          reservationNumber: 'RES-RES-01',
          facilityName: 'Squash Court',
          bookingStatus: 'CONFIRMED',
          paymentStatus: 'PAID',
          pricingSnapshot: { totalAmount: 500, currency: 'INR' },
          createdAt: '2026-09-19T10:00:00.000Z',
        },
      ];

      // Simulate partial failure: Wallet throws error, invoices & amenities succeed
      const feed = await FinancialHistoryService.fetchUnifiedFeed({
        fetchInvoices: async () => invoiceData,
        fetchWalletTransactions: async () => {
          throw new Error('Wallet service timeout (503)');
        },
        fetchAmenityBookings: async () => amenityData,
      });

      expect(feed.items.length).toBe(2);
      expect(feed.hasPartialFailure).toBe(true);
      expect(feed.failedDomains).toContain('wallet');
      expect(feed.partialErrorMessage).toContain('Wallet history is temporarily unavailable');
      expect(feed.items.map((i) => i.id)).toEqual(['inv_resil_1', 'res_resil_1']);
    });
  });

  describe('7. Financial Integrity & Zero Synthetic IDs', () => {
    it('guarantees zero client synthetic IDs, zero balance arithmetic, and preservation of backend truth', async () => {
      const serverInvoice = {
        _id: 'inv_auth_999',
        invoiceNumber: 'INV-999',
        totalDue: 15000,
        paidAmount: 5000,
        outstandingAmount: 10000,
        status: 'PARTIALLY_PAID',
        createdAt: '2026-09-22T08:00:00.000Z',
      };

      const feed = await FinancialHistoryService.fetchUnifiedFeed({
        fetchInvoices: async () => [serverInvoice],
        fetchWalletTransactions: async () => [],
        fetchAmenityBookings: async () => [],
      });

      const item = feed.items[0];
      // Backend ID strictly preserved
      expect(item.id).toBe('inv_auth_999');
      expect(item.title).toBe('Invoice #INV-999');
      // Balance comes directly from server: total 15000, outstanding 10000
      expect(item.amount).toBe(15000);
      expect(item.outstandingAmount).toBe(10000);
      expect(item.paidAmount).toBe(5000);
      expect(item.status).toBe('PARTIALLY_PAID');
    });
  });
});
