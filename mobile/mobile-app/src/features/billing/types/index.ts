export type InvoiceStatus =
  | 'UNPAID'
  | 'PAID'
  | 'VERIFICATION_PENDING'
  | 'PARTIAL'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'FAILED'
  | 'CHECKING'
  | 'PAYMENT_CHECKING'
  | 'UNKNOWN';

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  communityId?: string;
  unitId?: any;
  unitNumber?: string;
  targetUserId?: any;
  targetUser?: string;
  assessmentName?: string;
  billingPeriodString?: string;
  dueDate?: string;
  totalDue?: number;
  totalAmount?: number;
  paidAmount?: number;
  outstandingAmount?: number;
  amount?: number;
  currency?: string;
  status: InvoiceStatus;
  paymentMethod?: string;
  offlineReference?: string | null;
  offlineAmount?: number | null;
  paymentDate?: string | null;
  paymentScreenshot?: string | null;
  payerNotes?: string | null;
  items?: InvoiceItem[];
  createdAt?: string;
  updatedAt?: string;
  date?: string;
}

export interface BillingKPIs {
  grossDemand: number;
  grossDemandCount: number;
  totalCollected: number;
  inTransitGateway: number;
  totalUnpaidArrears: number;
  pendingOffline?: number;
  pendingOfflineAmount?: number;
  pendingOfflineCount?: number;
}

export interface UnitDueBreakdown {
  _id?: string;
  invoiceId: string;
  invoiceNumber: string;
  unitId?: string;
  unitNumber?: string;
  assessmentName?: string;
  totalDue: number;
  outstandingAmount?: number;
  paidAmount?: number;
  billingPeriodString?: string;
  status: InvoiceStatus;
  dueDate?: string;
}

export interface ActiveDues {
  totalPortfolioDue: number;
  unitBreakdown: UnitDueBreakdown[];
  secondaryCompliance?: any[];
  recentInvoices?: Invoice[];
}

export interface InvoicesGridPagination {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
}

export interface InvoicesGridResponse {
  data: any[];
  statusCounts?: Record<string, number>;
  currentPage?: number;
  totalPages?: number;
  totalRecords?: number;
  limit?: number;
  pagination?: InvoicesGridPagination;
}

export interface OfflineSettlementPayload {
  invoiceId: string;
  offlineReference: string;
  paymentMethod: string;
  offlineAmount?: number;
  amount?: number;
  paymentDate?: string;
  paymentScreenshot?: string;
  payerNotes?: string;
}

export interface RazorpayOrderPayload {
  invoiceId: string;
  amount: number;
}

export interface RazorpayVerificationPayload {
  paymentId?: string;
  payment_id?: string;
  orderId?: string;
  razorpayOrderId?: string;
  razorpay_order_id?: string;
  razorpayPaymentId?: string;
  razorpay_payment_id?: string;
  razorpaySignature?: string;
  razorpay_signature?: string;
}

export type { WalletState } from '../../wallet/types';

export interface BillingState {
  kpis: BillingKPIs | null;
  activeDues: ActiveDues;
  invoicesList: any[];
  statusCounts: Record<string, number>;
  pagination: InvoicesGridPagination;
  loadingStates: {
    fetchKPIs: boolean;
    fetchDues: boolean;
    fetchGrid: boolean;
    triggerRun: boolean;
    settleInvoice: boolean;
  };
  error: string | null;
}
