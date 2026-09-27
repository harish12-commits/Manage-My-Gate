/**
 * NAHOM / Connect Harmony - Mobile Phase 3: Unified Resident Financial History Test Suite
 *
 * Covers:
 * 1. Invoice domain: paid, partially paid, unpaid, authoritative figures.
 * 2. Wallet domain: credit (top-up), debit, refund, direction flags.
 * 3. Amenity domain: paid booking, pending booking, refunded booking, separate status dimensions.
 * 4. Deduplication: reference-based suppression of duplicate wallet debits for invoices/amenities.
 * 5. Identifier integrity: strict backend ID preservation, zero synthetic identifiers.
 * 6. Filtering: ALL, PAYMENTS, INVOICES, AMENITIES, WALLET, REFUNDS.
 * 7. Search: keyword lookup across invoiceNumber, bookingId, facilityName, transactionId.
 * 8. Sorting: strict backend createdAt timestamp descending.
 * 9. Partial failure: graceful degradation when one domain fails.
 * 10. UI Card & Modal rendering: authoritative field representation.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import financialHistoryService, { FinancialHistoryService } from '../services/financialHistoryService';
import { FinancialHistoryItemCard } from '../components/FinancialHistoryItemCard';
import { FinancialHistoryDetailModal } from '../components/FinancialHistoryDetailModal';
import {
  InvoiceHistoryItem,
  WalletHistoryItem,
  AmenityHistoryItem,
  RefundHistoryItem,
} from '../types/financialHistory.types';
import { billingService } from '../../billing/services/billingService';
import { walletService } from '../../wallet/services/walletService';
import * as amenityService from '../../amenities/services/amenityService';

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

// Mock services
jest.mock('../../billing/services/billingService', () => ({
  billingService: {
    getMyDues: jest.fn(),
  },
}));

jest.mock('../../wallet/services/walletService', () => ({
  walletService: {
    getWalletBalance: jest.fn(),
  },
}));

jest.mock('../../amenities/services/amenityService', () => ({
  getMyBookings: jest.fn(),
}));

describe('Mobile Phase 3 — Unified Resident Financial History', () => {
  let service: FinancialHistoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FinancialHistoryService();
  });

  describe('1. Invoice Domain Normalization & Mapping', () => {
    it('normalizes fully paid invoice with authoritative total, paid amount, and status', () => {
      const mockInvoices = [
        {
          _id: 'inv_backend_001',
          invoiceNumber: 'INV-2026-001',
          unitNumber: '101',
          totalDue: 3500,
          paidAmount: 3500,
          outstandingAmount: 0,
          status: 'PAID',
          paymentMethod: 'ONLINE',
          createdAt: '2026-09-20T10:00:00.000Z',
        },
      ];

      const items = service.normalizeAndMergeHistory(mockInvoices, [], []);
      expect(items).toHaveLength(1);

      const invItem = items[0] as InvoiceHistoryItem;
      expect(invItem.id).toBe('inv_backend_001');
      expect(invItem.type).toBe('INVOICE');
      expect(invItem.amount).toBe(3500);
      expect(invItem.paidAmount).toBe(3500);
      expect(invItem.outstandingAmount).toBe(0);
      expect(invItem.status).toBe('PAID');
      expect(invItem.isCredit).toBe(false);
      expect(invItem.title).toBe('Invoice #INV-2026-001');
      expect(invItem.subtitle).toContain('Villa 101');
    });

    it('normalizes partially paid invoice preserving server arrears without client arithmetic', () => {
      const mockInvoices = [
        {
          _id: 'inv_backend_002',
          invoiceNumber: 'INV-2026-002',
          unitNumber: '102',
          totalDue: 5000,
          paidAmount: 2000,
          outstandingAmount: 3000,
          status: 'PARTIALLY_PAID',
          paymentMethod: 'Digital Wallet',
          createdAt: '2026-09-21T10:00:00.000Z',
        },
      ];

      const items = service.normalizeAndMergeHistory(mockInvoices, [], []);
      const invItem = items[0] as InvoiceHistoryItem;

      expect(invItem.id).toBe('inv_backend_002');
      expect(invItem.amount).toBe(5000);
      expect(invItem.paidAmount).toBe(2000);
      expect(invItem.outstandingAmount).toBe(3000);
      expect(invItem.status).toBe('PARTIALLY_PAID');
    });

    it('skips invoices lacking backend IDs (identifier integrity)', () => {
      const corruptInvoices = [{ totalDue: 1000, status: 'UNPAID' }];
      const items = service.normalizeAndMergeHistory(corruptInvoices, [], []);
      expect(items).toHaveLength(0);
    });
  });

  describe('2. Wallet Domain Normalization & Mapping', () => {
    it('normalizes standalone wallet recharge / top-up as credit with positive sign', () => {
      const mockWalletTxns = [
        {
          transactionId: 'TXN-WLT-TOPUP-99',
          type: 'Credit',
          amount: 2500,
          referenceType: 'Recharge',
          paymentMethod: 'ONLINE',
          paymentStatus: 'success',
          description: 'Wallet top-up via Razorpay',
          createdAt: '2026-09-22T14:30:00.000Z',
        },
      ];

      const items = service.normalizeAndMergeHistory([], mockWalletTxns, []);
      expect(items).toHaveLength(1);

      const wltItem = items[0] as WalletHistoryItem;
      expect(wltItem.id).toBe('TXN-WLT-TOPUP-99');
      expect(wltItem.type).toBe('WALLET_TRANSACTION');
      expect(wltItem.direction).toBe('Credit');
      expect(wltItem.isCredit).toBe(true);
      expect(wltItem.amount).toBe(2500);
      expect(wltItem.status).toBe('SUCCESS');
    });

    it('normalizes standalone wallet debit with isCredit: false', () => {
      const mockWalletTxns = [
        {
          transactionId: 'TXN-WLT-DEBIT-77',
          type: 'Debit',
          amount: 150,
          referenceType: 'Other',
          paymentMethod: 'Wallet',
          paymentStatus: 'success',
          description: 'Clubhouse guest fee',
          createdAt: '2026-09-23T11:00:00.000Z',
        },
      ];

      const items = service.normalizeAndMergeHistory([], mockWalletTxns, []);
      const wltItem = items[0] as WalletHistoryItem;
      expect(wltItem.direction).toBe('Debit');
      expect(wltItem.isCredit).toBe(false);
      expect(wltItem.amount).toBe(150);
    });

    it('normalizes wallet refund transaction to REFUND type', () => {
      const mockWalletTxns = [
        {
          transactionId: 'TXN-WLT-REF-55',
          type: 'Credit',
          amount: 800,
          referenceType: 'Refund',
          referenceId: 'orig_pay_123',
          paymentStatus: 'REFUNDED',
          description: 'Refund for cancelled booking',
          createdAt: '2026-09-24T09:00:00.000Z',
        },
      ];

      const items = service.normalizeAndMergeHistory([], mockWalletTxns, []);
      expect(items).toHaveLength(1);

      const refItem = items[0] as RefundHistoryItem;
      expect(refItem.type).toBe('REFUND');
      expect(refItem.refundAmount).toBe(800);
      expect(refItem.sourceDomain).toBe('WALLET');
      expect(refItem.isCredit).toBe(true);
      expect(refItem.status).toBe('REFUNDED');
    });
  });

  describe('3. Amenity Domain Normalization & Mapping', () => {
    it('normalizes paid amenity booking maintaining separate booking and payment statuses', () => {
      const mockBookings = [
        {
          _id: 'bk_backend_555',
          bookingId: 'BK-TENNIS-01',
          amenityId: { name: 'Tennis Court A' },
          bookingDate: '2026-09-25',
          startTime: '18:00',
          endTime: '19:00',
          totalAmount: 400,
          status: 'confirmed',
          paymentStatus: 'paid',
          paymentMethod: 'WALLET',
          createdAt: '2026-09-20T12:00:00.000Z',
        },
      ];

      const items = service.normalizeAndMergeHistory([], [], mockBookings);
      expect(items).toHaveLength(1);

      const amItem = items[0] as AmenityHistoryItem;
      expect(amItem.id).toBe('bk_backend_555');
      expect(amItem.type).toBe('AMENITY');
      expect(amItem.facilityName).toBe('Tennis Court A');
      expect(amItem.bookingId).toBe('BK-TENNIS-01');
      expect(amItem.bookingStatus).toBe('CONFIRMED');
      expect(amItem.paymentStatus).toBe('PAID');
      expect(amItem.amount).toBe(400);
      expect(amItem.isCredit).toBe(false);
    });

    it('normalizes refunded amenity booking to REFUND type', () => {
      const mockBookings = [
        {
          _id: 'bk_backend_888',
          bookingId: 'BK-SWIM-02',
          amenityId: { name: 'Olympic Pool' },
          bookingDate: '2026-09-26',
          totalAmount: 600,
          status: 'cancelled',
          paymentStatus: 'refunded',
          pricingDetails: { refundAmount: 600 },
          createdAt: '2026-09-21T08:00:00.000Z',
        },
      ];

      const items = service.normalizeAndMergeHistory([], [], mockBookings);
      expect(items).toHaveLength(1);

      const refItem = items[0] as RefundHistoryItem;
      expect(refItem.type).toBe('REFUND');
      expect(refItem.refundAmount).toBe(600);
      expect(refItem.sourceDomain).toBe('AMENITY');
      expect(refItem.status).toBe('REFUNDED');
    });
  });

  describe('4. Reference-Based Deduplication (Sections 11 & 12)', () => {
    it('suppresses duplicate wallet debit when referenceId links to an invoice in the feed', () => {
      const mockInvoices = [
        {
          _id: 'inv_target_123',
          invoiceNumber: 'INV-123',
          totalDue: 1500,
          paidAmount: 1500,
          status: 'PAID',
          createdAt: '2026-09-20T10:00:00.000Z',
        },
      ];

      const mockWalletTxns = [
        {
          transactionId: 'TXN-WLT-DEBIT-PAY',
          type: 'Debit',
          amount: 1500,
          referenceType: 'Invoice',
          referenceId: 'inv_target_123', // Authoritative link to invoice
          paymentStatus: 'success',
          createdAt: '2026-09-20T10:01:00.000Z',
        },
      ];

      const items = service.normalizeAndMergeHistory(mockInvoices, mockWalletTxns, []);

      // Exactly ONE item must be rendered: the Invoice payment (NOT both)
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('INVOICE');
      expect(items[0].id).toBe('inv_target_123');
    });

    it('suppresses duplicate wallet debit when referenceId links to an amenity booking in the feed', () => {
      const mockBookings = [
        {
          _id: 'bk_target_456',
          bookingId: 'BK-456',
          amenityId: { name: 'Badminton Court 1' },
          totalAmount: 300,
          status: 'confirmed',
          paymentStatus: 'paid',
          createdAt: '2026-09-21T10:00:00.000Z',
        },
      ];

      const mockWalletTxns = [
        {
          transactionId: 'TXN-WLT-DEBIT-AMENITY',
          type: 'Debit',
          amount: 300,
          referenceType: 'AmenityBooking',
          referenceId: 'bk_target_456', // Authoritative link to booking
          paymentStatus: 'success',
          createdAt: '2026-09-21T10:01:00.000Z',
        },
      ];

      const items = service.normalizeAndMergeHistory([], mockWalletTxns, mockBookings);

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('AMENITY');
      expect(items[0].id).toBe('bk_target_456');
    });

    it('preserves distinct items with identical amounts when NO authoritative relationship exists', () => {
      const mockInvoices = [
        {
          _id: 'inv_abc',
          invoiceNumber: 'INV-ABC',
          totalDue: 500,
          status: 'PAID',
          createdAt: '2026-09-22T10:00:00.000Z',
        },
      ];

      const mockWalletTxns = [
        {
          transactionId: 'TXN-WLT-UNRELATED',
          type: 'Debit',
          amount: 500, // Same amount!
          referenceType: 'Other',
          referenceId: 'unrelated_external_ref', // Different ref!
          paymentStatus: 'success',
          createdAt: '2026-09-22T10:00:00.000Z',
        },
      ];

      const items = service.normalizeAndMergeHistory(mockInvoices, mockWalletTxns, []);

      // Both must be preserved because they are unrelated
      expect(items).toHaveLength(2);
      expect(items.some((i) => i.type === 'INVOICE')).toBe(true);
      expect(items.some((i) => i.type === 'WALLET_TRANSACTION')).toBe(true);
    });
  });

  describe('5. Chronological Sorting & Identifier Integrity', () => {
    it('sorts all items chronologically descending by backend createdAt timestamp', () => {
      const mockInvoices = [
        {
          _id: 'inv_early',
          invoiceNumber: 'INV-EARLY',
          totalDue: 1000,
          status: 'PAID',
          createdAt: '2026-09-10T10:00:00.000Z',
        },
      ];

      const mockWalletTxns = [
        {
          transactionId: 'txn_latest',
          type: 'Credit',
          amount: 2000,
          referenceType: 'Recharge',
          createdAt: '2026-09-25T10:00:00.000Z',
        },
      ];

      const mockBookings = [
        {
          _id: 'bk_middle',
          bookingId: 'BK-MID',
          amenityId: { name: 'Pool' },
          totalAmount: 300,
          createdAt: '2026-09-18T10:00:00.000Z',
        },
      ];

      const items = service.normalizeAndMergeHistory(mockInvoices, mockWalletTxns, mockBookings);

      expect(items).toHaveLength(3);
      expect(items[0].id).toBe('txn_latest');
      expect(items[1].id).toBe('bk_middle');
      expect(items[2].id).toBe('inv_early');
    });

    it('guarantees zero synthetic or random IDs: all IDs match backend identifiers', () => {
      const mockInvoices = [{ _id: 'exact_db_id_1', totalDue: 100, status: 'PAID', createdAt: '2026-09-20' }];
      const mockWallet = [{ transactionId: 'exact_txn_id_2', type: 'Credit', amount: 200, createdAt: '2026-09-20' }];

      const items = service.normalizeAndMergeHistory(mockInvoices, mockWallet, []);

      expect(items[0].id).toBe('exact_db_id_1');
      expect(items[1].id).toBe('exact_txn_id_2');
      expect(items[0].id).not.toContain('Date.now');
      expect(items[1].id).not.toContain('Date.now');
    });
  });

  describe('6. Category Filtering & Search Queries', () => {
    const mixedItems: any[] = [
      { id: '1', type: 'INVOICE', invoiceNumber: 'INV-900', title: 'Invoice #INV-900', amount: 1000, isCredit: false },
      { id: '2', type: 'WALLET_TRANSACTION', transactionId: 'TXN-WLT-01', title: 'Wallet Top-Up', amount: 500, isCredit: true },
      { id: '3', type: 'AMENITY', bookingId: 'BK-SQUASH-7', facilityName: 'Squash Court', title: 'Amenity: Squash Court', amount: 300, isCredit: false },
      { id: '4', type: 'REFUND', refundId: 'REF-888', title: 'Refund for Booking', amount: 300, isCredit: true },
    ];

    it('filters by category tab ALL returns all items', () => {
      const res = service.filterHistory(mixedItems, 'ALL');
      expect(res).toHaveLength(4);
    });

    it('filters by category tab INVOICES', () => {
      const res = service.filterHistory(mixedItems, 'INVOICES');
      expect(res).toHaveLength(1);
      expect(res[0].type).toBe('INVOICE');
    });

    it('filters by category tab AMENITIES', () => {
      const res = service.filterHistory(mixedItems, 'AMENITIES');
      expect(res).toHaveLength(1);
      expect(res[0].type).toBe('AMENITY');
    });

    it('filters by category tab WALLET', () => {
      const res = service.filterHistory(mixedItems, 'WALLET');
      expect(res).toHaveLength(1);
      expect(res[0].type).toBe('WALLET_TRANSACTION');
    });

    it('filters by category tab REFUNDS', () => {
      const res = service.filterHistory(mixedItems, 'REFUNDS');
      expect(res).toHaveLength(1);
      expect(res[0].type).toBe('REFUND');
    });

    it('filters by search keyword matching invoice number', () => {
      const res = service.filterHistory(mixedItems, 'ALL', 'INV-900');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('1');
    });

    it('filters by search keyword matching facility name', () => {
      const res = service.filterHistory(mixedItems, 'ALL', 'Squash');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('3');
    });

    it('filters by search keyword matching transaction ID', () => {
      const res = service.filterHistory(mixedItems, 'ALL', 'TXN-WLT-01');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('2');
    });
  });

  describe('7. Partial Domain Failure Resiliency (Section 8 & 9)', () => {
    it('gracefully handles one domain failure without discarding data from other domains', async () => {
      (billingService.getMyDues as jest.Mock).mockResolvedValueOnce({
        recentInvoices: [{ _id: 'inv_ok', invoiceNumber: 'INV-OK', totalDue: 1200, status: 'PAID' }],
      });

      // Wallet rejects with network timeout
      (walletService.getWalletBalance as jest.Mock).mockRejectedValueOnce(
        new Error('Wallet service timeout')
      );

      (amenityService.getMyBookings as jest.Mock).mockResolvedValueOnce({
        data: [{ _id: 'bk_ok', bookingId: 'BK-OK', totalAmount: 400, status: 'confirmed' }],
      });

      const { invoices, wallet, amenities } = await service.fetchDomainRecords('org_123');

      expect(invoices.status).toBe('success');
      expect(invoices.data).toHaveLength(1);

      expect(wallet.status).toBe('error');
      expect(wallet.error).toBe('Wallet service timeout');
      expect(wallet.data).toHaveLength(0);

      expect(amenities.status).toBe('success');
      expect(amenities.data).toHaveLength(1);

      // Merged history still produces items for the successful domains
      const merged = service.normalizeAndMergeHistory(invoices.data, wallet.data, amenities.data);
      expect(merged).toHaveLength(2);
    });
  });

  describe('8. UI Components Rendering', () => {
    it('renders FinancialHistoryItemCard with formatted amount, title, and status', async () => {
      const item: InvoiceHistoryItem = {
        id: 'inv-card-1',
        type: 'INVOICE',
        title: 'Invoice #INV-2026-100',
        subtitle: 'Villa 105 • Maintenance',
        amount: 4500,
        currency: 'INR',
        status: 'PAID',
        createdAt: '2026-09-20T10:00:00.000Z',
        isCredit: false,
        invoiceId: 'inv-card-1',
        invoiceNumber: 'INV-2026-100',
        totalDue: 4500,
        paidAmount: 4500,
        outstandingAmount: 0,
        rawInvoice: {},
      };

      const onPress = jest.fn();

      await render(
        <FinancialHistoryItemCard item={item} onPress={onPress} />
      );

      expect(screen.getByText('Invoice #INV-2026-100')).toBeTruthy();
      expect(screen.getByText('₹4,500')).toBeTruthy();
      expect(screen.getByText(/paid/i)).toBeTruthy();
    });

    it('renders FinancialHistoryDetailModal with authoritative invoice details', async () => {
      const item: InvoiceHistoryItem = {
        id: 'inv-detail-1',
        type: 'INVOICE',
        title: 'Invoice #INV-999',
        amount: 5000,
        currency: 'INR',
        status: 'PARTIALLY_PAID',
        createdAt: '2026-09-21T10:00:00.000Z',
        isCredit: false,
        invoiceId: 'inv-detail-1',
        invoiceNumber: 'INV-999',
        unitNumber: '202',
        totalDue: 5000,
        paidAmount: 2000,
        outstandingAmount: 3000,
        paymentMethod: 'Digital Wallet',
        rawInvoice: { _id: 'inv-detail-1' },
      };

      await render(
        <FinancialHistoryDetailModal
          visible={true}
          item={item}
          onClose={jest.fn()}
        />
      );

      expect(screen.getByText('Invoice #INV-999')).toBeTruthy();
      expect(screen.getByText('₹5,000')).toBeTruthy();
      expect(screen.getByText('PARTIALLY PAID')).toBeTruthy();
      expect(screen.getByText('₹2,000')).toBeTruthy();
      expect(screen.getByText('₹3,000')).toBeTruthy();
      expect(screen.getByText(/Villa\s*202/)).toBeTruthy();
      expect(screen.getByText('Digital Wallet')).toBeTruthy();
    });
  });
});
