/**
 * NAHOM / Connect Harmony - Mobile Phase 3: Unified Resident Financial History Types
 * Strictly read-only, presentation-oriented domain models.
 * Authoritative financial source of truth remains in backend domains.
 */

export type FinancialHistoryType =
  | 'INVOICE'
  | 'WALLET_TRANSACTION'
  | 'AMENITY'
  | 'PAYMENT'
  | 'REFUND';

export type FinancialHistoryFilterTab =
  | 'ALL'
  | 'PAYMENTS'
  | 'INVOICES'
  | 'AMENITIES'
  | 'WALLET'
  | 'REFUNDS';

export interface FinancialHistoryBase {
  id: string; // Authoritative backend identifier (_id or transactionId)
  type: FinancialHistoryType;
  title: string;
  subtitle?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  isCredit: boolean;
}

export interface InvoiceHistoryItem extends FinancialHistoryBase {
  type: 'INVOICE';
  invoiceId: string;
  invoiceNumber: string;
  unitNumber?: string;
  totalDue: number;
  paidAmount: number;
  outstandingAmount: number;
  paymentMethod?: string;
  billingPeriod?: string;
  rawInvoice: any;
}

export interface WalletHistoryItem extends FinancialHistoryBase {
  type: 'WALLET_TRANSACTION';
  transactionId: string;
  direction: 'Credit' | 'Debit';
  referenceType: string;
  referenceId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  rawWalletTxn: any;
}

export interface AmenityHistoryItem extends FinancialHistoryBase {
  type: 'AMENITY';
  bookingId: string;
  facilityName: string;
  bookingDate: string;
  timeSlot: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentMethod?: string;
  rawBooking: any;
}

export interface PaymentHistoryItem extends FinancialHistoryBase {
  type: 'PAYMENT';
  paymentId: string;
  gateway?: string;
  gatewayTransactionId?: string;
  referenceType?: string;
  referenceId?: string;
  paymentMethod?: string;
  rawPayment: any;
}

export interface RefundHistoryItem extends FinancialHistoryBase {
  type: 'REFUND';
  refundId: string;
  originalAmount?: number;
  refundAmount: number;
  refundStatus: string;
  sourceDomain: 'WALLET' | 'AMENITY' | 'INVOICE' | 'PAYMENT';
  referenceId?: string;
  rawRecord: any;
}

export type FinancialHistoryItem =
  | InvoiceHistoryItem
  | WalletHistoryItem
  | AmenityHistoryItem
  | PaymentHistoryItem
  | RefundHistoryItem;

export type DomainLoadingStatus = 'idle' | 'loading' | 'success' | 'error';

export interface DomainLoadingState<T> {
  data: T[];
  status: DomainLoadingStatus;
  error?: string;
}

export interface FinancialHistoryDomainState {
  invoices: DomainLoadingState<any>;
  wallet: DomainLoadingState<any>;
  amenities: DomainLoadingState<any>;
}
