/**
 * NAHOM / Connect Harmony - Mobile Phase 3: Financial History Service
 *
 * Presentation-only service aggregating authoritative domain records:
 * - Billing Invoices (`GET /invoices/my-dues`)
 * - Digital Wallet Transactions (`GET /wallet`)
 * - Amenity Bookings (`GET /amenity-bookings/my-bookings`)
 *
 * Strictly read-only: Never mutates or persists local financial records.
 * Follows deterministic reference-based deduplication (Section 11 & 12).
 */

import { billingService } from '../../billing/services/billingService';
import { walletService } from '../../wallet/services/walletService';
import * as amenityService from '../../amenities/services/amenityService';
import {
  FinancialHistoryItem,
  FinancialHistoryDomainState,
  FinancialHistoryFilterTab,
  InvoiceHistoryItem,
  WalletHistoryItem,
  AmenityHistoryItem,
  RefundHistoryItem,
} from '../types/financialHistory.types';

export class FinancialHistoryService {
  /**
   * Fetch all domain records concurrently while tracking independent partial failure states.
   */
  async fetchDomainRecords(communityId?: string): Promise<{
    invoices: { data: any[]; status: 'success' | 'error'; error?: string };
    wallet: { data: any[]; status: 'success' | 'error'; error?: string };
    amenities: { data: any[]; status: 'success' | 'error'; error?: string };
  }> {
    const [invoicesResult, walletResult, amenitiesResult] = await Promise.allSettled([
      billingService.getMyDues(communityId),
      walletService.getWalletBalance({ limit: 50 }),
      amenityService.getMyBookings({ limit: 50 }),
    ]);

    // 1. Process Invoices
    let invoices: { data: any[]; status: 'success' | 'error'; error?: string };
    if (invoicesResult.status === 'fulfilled') {
      const val = invoicesResult.value;
      const recent = Array.isArray(val?.recentInvoices)
        ? val.recentInvoices
        : Array.isArray(val)
        ? val
        : [];
      invoices = { data: recent, status: 'success' };
    } else {
      invoices = {
        data: [],
        status: 'error',
        error: invoicesResult.reason?.message || 'Failed to load invoices',
      };
    }

    // 2. Process Wallet
    let wallet: { data: any[]; status: 'success' | 'error'; error?: string };
    if (walletResult.status === 'fulfilled') {
      const val = walletResult.value;
      const txns = Array.isArray(val?.transactionHistory)
        ? val.transactionHistory
        : Array.isArray(val?.transactions)
        ? val.transactions
        : [];
      wallet = { data: txns, status: 'success' };
    } else {
      wallet = {
        data: [],
        status: 'error',
        error: walletResult.reason?.message || 'Failed to load wallet transactions',
      };
    }

    // 3. Process Amenities
    let amenities: { data: any[]; status: 'success' | 'error'; error?: string };
    if (amenitiesResult.status === 'fulfilled') {
      const val = amenitiesResult.value;
      const rawData = val?.data || val;
      const bookings = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.bookings)
        ? rawData.bookings
        : [];
      amenities = { data: bookings, status: 'success' };
    } else {
      amenities = {
        data: [],
        status: 'error',
        error: amenitiesResult.reason?.message || 'Failed to load amenity bookings',
      };
    }

    return { invoices, wallet, amenities };
  }

  /**
   * Fetch and normalize domain records into a unified chronological feed with partial failure detection.
   */
  static async fetchUnifiedFeed(options?: {
    communityId?: string;
    fetchInvoices?: () => Promise<any[]>;
    fetchWalletTransactions?: () => Promise<any[]>;
    fetchAmenityBookings?: () => Promise<any[]>;
  }): Promise<{
    items: FinancialHistoryItem[];
    hasPartialFailure: boolean;
    failedDomains: string[];
    partialErrorMessage?: string;
  }> {
    const serviceInstance = new FinancialHistoryService();
    let invoicesData: any[] = [];
    let walletData: any[] = [];
    let amenitiesData: any[] = [];
    const failedDomains: string[] = [];

    if (options?.fetchInvoices || options?.fetchWalletTransactions || options?.fetchAmenityBookings) {
      const [invRes, walRes, amRes] = await Promise.allSettled([
        options.fetchInvoices ? options.fetchInvoices() : billingService.getMyDues(options?.communityId),
        options.fetchWalletTransactions ? options.fetchWalletTransactions() : walletService.getWalletBalance({ limit: 50 }),
        options.fetchAmenityBookings ? options.fetchAmenityBookings() : amenityService.getMyBookings({ limit: 50 }),
      ]);

      if (invRes.status === 'fulfilled') {
        const val = invRes.value;
        invoicesData = Array.isArray(val?.recentInvoices) ? val.recentInvoices : Array.isArray(val) ? val : [];
      } else {
        failedDomains.push('invoices');
      }

      if (walRes.status === 'fulfilled') {
        const val = walRes.value;
        walletData = Array.isArray(val?.transactionHistory)
          ? val.transactionHistory
          : Array.isArray(val?.transactions)
          ? val.transactions
          : Array.isArray(val)
          ? val
          : [];
      } else {
        failedDomains.push('wallet');
      }

      if (amRes.status === 'fulfilled') {
        const val = amRes.value;
        const raw = (val as any)?.data || val;
        amenitiesData = Array.isArray(raw?.bookings) ? raw.bookings : Array.isArray(raw) ? raw : [];
      } else {
        failedDomains.push('amenities');
      }
    } else {
      const { invoices, wallet, amenities } = await serviceInstance.fetchDomainRecords(options?.communityId);
      invoicesData = invoices.data;
      walletData = wallet.data;
      amenitiesData = amenities.data;
      if (invoices.status === 'error') failedDomains.push('invoices');
      if (wallet.status === 'error') failedDomains.push('wallet');
      if (amenities.status === 'error') failedDomains.push('amenities');
    }

    const items = serviceInstance.normalizeAndMergeHistory(invoicesData, walletData, amenitiesData);
    const hasPartialFailure = failedDomains.length > 0 && failedDomains.length < 3;
    let partialErrorMessage: string | undefined;
    if (hasPartialFailure) {
      if (failedDomains.includes('wallet')) {
        partialErrorMessage = 'Wallet history is temporarily unavailable. Other records are up to date.';
      } else {
        partialErrorMessage = `Some records could not be loaded: ${failedDomains.join(', ')}.`;
      }
    }

    return {
      items,
      hasPartialFailure,
      failedDomains,
      partialErrorMessage,
    };
  }

  /**
   * Normalize and merge authoritative domain records into a unified chronological feed.
   * Applies presentation-level deduplication without modifying raw backend records.
   */
  normalizeAndMergeHistory(
    invoices: any[],
    walletTxns: any[],
    amenityBookings: any[]
  ): FinancialHistoryItem[] {
    const items: FinancialHistoryItem[] = [];

    // Track correlated invoice IDs and booking IDs for reference-based deduplication
    const correlatedInvoiceIds = new Set<string>();
    const correlatedBookingIds = new Set<string>();

    // Step 1: Map Invoices
    for (const inv of invoices) {
      const rawId = inv._id || inv.id || inv.invoiceId;
      if (!rawId) continue; // Identifier integrity: Never create items without backend ID

      correlatedInvoiceIds.add(String(rawId));
      const totalDue = Number(inv.totalDue ?? inv.amount ?? 0);
      const paidAmount = Number(inv.paidAmount ?? (inv.status === 'PAID' ? totalDue : 0));
      const outstanding = Number(
        inv.outstandingAmount !== undefined
          ? inv.outstandingAmount
          : Math.max(0, totalDue - paidAmount)
      );

      const statusUpper = String(inv.status || 'UNPAID').toUpperCase();
      const isVerificationPending = statusUpper === 'VERIFICATION_PENDING';
      const baseContext = inv.unitNumber ? `Villa ${inv.unitNumber}` : 'Maintenance Assessment';
      const subtitle = isVerificationPending
        ? `${baseContext} • Verification Pending`
        : inv.unitNumber
        ? `Villa ${inv.unitNumber} • Maintenance Fee`
        : 'Maintenance Assessment';

      const invItem: InvoiceHistoryItem = {
        id: String(rawId),
        type: 'INVOICE',
        title: `Invoice #${inv.invoiceNumber || inv.invoiceId || String(rawId).slice(-6)}`,
        subtitle,
        amount: totalDue,
        currency: inv.currency || 'INR',
        status: statusUpper,
        createdAt: inv.createdAt || inv.date || new Date().toISOString(),
        isCredit: false,
        invoiceId: String(rawId),
        invoiceNumber: inv.invoiceNumber || String(rawId).slice(-6),
        unitNumber: inv.unitNumber,
        totalDue,
        paidAmount,
        outstandingAmount: outstanding,
        paymentMethod: inv.paymentMethod,
        billingPeriod: inv.billingPeriodString,
        rawInvoice: inv,
      };

      items.push(invItem);
    }

    // Step 2: Map Amenity Bookings
    for (const b of amenityBookings) {
      const rawId = b._id || b.id || b.bookingId;
      if (!rawId) continue; // Identifier integrity

      correlatedBookingIds.add(String(rawId));
      if (b.bookingId) correlatedBookingIds.add(String(b.bookingId));

      const totalAmount = Number(b.totalAmount ?? b.pricingDetails?.totalAmount ?? 0);
      const facilityName = b.amenityId?.name || b.amenityName || 'Community Amenity';
      const bookingDate = b.bookingDate || b.date || '';
      const timeSlot = b.startTime && b.endTime ? `${b.startTime} - ${b.endTime}` : (b.startTime || '');

      const bookingStatus = String(b.status || 'PENDING').toUpperCase();
      const paymentStatus = String(b.paymentStatus || 'PENDING').toUpperCase();

      // Check if this booking is explicitly refunded
      if (paymentStatus === 'REFUNDED') {
        const refundItem: RefundHistoryItem = {
          id: `ref-amenity-${rawId}`,
          type: 'REFUND',
          title: `Refund: ${facilityName}`,
          subtitle: `Booking #${b.bookingId || String(rawId).slice(-6)} • Refunded`,
          amount: b.pricingDetails?.refundAmount || totalAmount,
          currency: 'INR',
          status: 'REFUNDED',
          createdAt: b.updatedAt || b.createdAt || new Date().toISOString(),
          isCredit: true,
          refundId: `ref-amenity-${rawId}`,
          originalAmount: totalAmount,
          refundAmount: b.pricingDetails?.refundAmount || totalAmount,
          refundStatus: 'REFUNDED',
          sourceDomain: 'AMENITY',
          referenceId: String(rawId),
          rawRecord: b,
        };
        items.push(refundItem);
      } else {
        const isPayAtGate =
          b.paymentMethod === 'PAY_AT_GATE' ||
          b.paymentDetails?.method === 'PAY_AT_GATE' ||
          b.paymentDetails?.paymentMethod === 'PAY_AT_GATE';

        const displayStatus =
          isPayAtGate && paymentStatus === 'PENDING'
            ? 'PAY_AT_GATE'
            : paymentStatus !== 'PENDING'
            ? paymentStatus
            : bookingStatus;

        const subtitleSuffix =
          isPayAtGate && paymentStatus === 'PENDING'
            ? ' • Pay at Gate'
            : bookingDate
            ? ` • ${bookingDate}`
            : '';

        const amenityItem: AmenityHistoryItem = {
          id: String(rawId),
          type: 'AMENITY',
          title: `Amenity: ${facilityName}`,
          subtitle: `Booking #${b.bookingId || String(rawId).slice(-6)}${subtitleSuffix}`,
          amount: totalAmount,
          currency: 'INR',
          status: displayStatus,
          createdAt: b.createdAt || (bookingDate ? `${bookingDate}T00:00:00.000Z` : new Date().toISOString()),
          isCredit: false,
          bookingId: b.bookingId || String(rawId),
          facilityName,
          bookingDate,
          timeSlot,
          bookingStatus,
          paymentStatus,
          paymentMethod: isPayAtGate ? 'PAY_AT_GATE' : b.paymentMethod,
          rawBooking: b,
        };
        items.push(amenityItem);
      }
    }

    // Step 3: Map Wallet Transactions with Reference-Based Deduplication (Section 11 & 12)
    for (const txn of walletTxns) {
      const rawId = txn.transactionId || txn._id || txn.id;
      if (!rawId) continue; // Identifier integrity

      const refType = String(txn.referenceType || 'Other');
      const refId = txn.referenceId ? String(txn.referenceId) : null;
      const bookingRefId = txn.bookingId ? String(txn.bookingId) : null;

      // Deduplication Rule 1: Wallet debit paying for an invoice present in feed
      if (
        (refType === 'Invoice' || refType === 'Payment') &&
        refId &&
        correlatedInvoiceIds.has(refId)
      ) {
        // Suppress standalone debit to avoid resident seeing double charges
        continue;
      }

      // Deduplication Rule 2: Wallet debit paying for an amenity booking present in feed
      if (
        (refType === 'AmenityBooking' || bookingRefId) &&
        ((refId && correlatedBookingIds.has(refId)) || (bookingRefId && correlatedBookingIds.has(bookingRefId)))
      ) {
        // Suppress standalone debit
        continue;
      }

      const amount = Math.abs(Number(txn.amount || 0));
      const direction = String(txn.type).toLowerCase() === 'credit' ? 'Credit' : 'Debit';
      const isCredit = direction === 'Credit';
      const paymentStatus = String(txn.paymentStatus || 'success').toUpperCase();

      // Refund classification: Authoritative refund reference or refunded payment status
      if (refType === 'Refund' || paymentStatus === 'REFUNDED') {
        const refundItem: RefundHistoryItem = {
          id: String(rawId),
          type: 'REFUND',
          title: txn.description || 'Wallet Refund Credit',
          subtitle: `Ref #${String(rawId).slice(-6)} • Digital Wallet`,
          amount,
          currency: 'INR',
          status: 'REFUNDED',
          createdAt: txn.createdAt || new Date().toISOString(),
          isCredit: true,
          refundId: String(rawId),
          originalAmount: amount,
          refundAmount: amount,
          refundStatus: 'REFUNDED',
          sourceDomain: 'WALLET',
          referenceId: refId || undefined,
          rawRecord: txn,
        };
        items.push(refundItem);
      } else {
        const title =
          txn.description ||
          (isCredit
            ? refType === 'Recharge'
              ? 'Wallet Recharge / Top-Up'
              : 'Wallet Credit'
            : 'Wallet Payment');

        const walletItem: WalletHistoryItem = {
          id: String(rawId),
          type: 'WALLET_TRANSACTION',
          title,
          subtitle: `Txn #${String(rawId).slice(-6)} • ${txn.paymentMethod || 'Wallet'}`,
          amount,
          currency: 'INR',
          status: paymentStatus,
          createdAt: txn.createdAt || new Date().toISOString(),
          isCredit,
          transactionId: String(rawId),
          direction,
          referenceType: refType,
          referenceId: refId || undefined,
          paymentMethod: txn.paymentMethod,
          paymentStatus,
          rawWalletTxn: txn,
        };
        items.push(walletItem);
      }
    }

    // Step 4: Sort Chronologically Descending by backend event timestamp
    items.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return isNaN(timeB) || isNaN(timeA) ? 0 : timeB - timeA;
    });

    return items;
  }

  /**
   * Filter financial history items by presentation category and optional search keyword.
   * Pure, in-memory, read-only transformation.
   */
  filterHistory(
    items: FinancialHistoryItem[],
    filterTab: FinancialHistoryFilterTab,
    searchQuery: string = ''
  ): FinancialHistoryItem[] {
    let result = items;

    // Filter by presentation category
    if (filterTab !== 'ALL') {
      result = result.filter((item) => {
        switch (filterTab) {
          case 'PAYMENTS':
            // Items representing payments or charges
            return (
              item.type === 'INVOICE' ||
              item.type === 'AMENITY' ||
              item.type === 'PAYMENT' ||
              (item.type === 'WALLET_TRANSACTION' && !item.isCredit)
            );
          case 'INVOICES':
            return item.type === 'INVOICE';
          case 'AMENITIES':
            return item.type === 'AMENITY';
          case 'WALLET':
            return item.type === 'WALLET_TRANSACTION';
          case 'REFUNDS':
            return item.type === 'REFUND';
          default:
            return true;
        }
      });
    }

    // Filter by search query across safe identifiers and titles
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((item) => {
        if (item.title.toLowerCase().includes(query)) return true;
        if (item.subtitle && item.subtitle.toLowerCase().includes(query)) return true;
        if (item.id.toLowerCase().includes(query)) return true;

        if (item.type === 'INVOICE' && item.invoiceNumber.toLowerCase().includes(query)) return true;
        if (item.type === 'AMENITY') {
          if (item.bookingId.toLowerCase().includes(query)) return true;
          if (item.facilityName.toLowerCase().includes(query)) return true;
        }
        if (item.type === 'WALLET_TRANSACTION' && item.transactionId.toLowerCase().includes(query)) return true;
        if (item.type === 'REFUND' && item.refundId.toLowerCase().includes(query)) return true;

        return false;
      });
    }

    return result;
  }
}

export const financialHistoryService = new FinancialHistoryService();
export default financialHistoryService;
