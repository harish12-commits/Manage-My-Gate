/**
 * NAHOM / Connect Harmony - Mobile Phase 6: Financial Integrity Monitoring & Diagnostics Types
 *
 * Safe operational visibility layer representing WHAT THE MOBILE APP KNOWS,
 * without creating or inferring backend financial truth.
 */

export type FinancialReferenceType =
  | 'Invoice'
  | 'AmenityBooking'
  | 'WalletRecharge'
  | 'Payment';

export type ClientOperationState =
  | 'IDLE'
  | 'SUBMITTING'
  | 'CHECKING'
  | 'PENDING_VERIFICATION'
  | 'SUCCESS'
  | 'REJECTED'
  | 'FAILED';

export type DiagnosticState =
  | 'NORMAL'
  | 'AWAITING_SERVER'
  | 'RECOVERY_REQUIRED'
  | 'DOMAIN_UNAVAILABLE'
  | 'USER_ACTION_REQUIRED';

export type FinancialErrorCategory =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER_UNAVAILABLE'
  | 'AUTHORIZATION'
  | 'VALIDATION'
  | 'BUSINESS_RULE'
  | 'ALREADY_SETTLED'
  | 'UNKNOWN';

export interface FinancialOperationMetadata {
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  offlineReference?: string;
  paymentReference?: string;
  invoiceNumber?: string;
  bookingId?: string;
  facilityName?: string;
  transactionId?: string;
  orderId?: string;
  rejectionReason?: string;
  proofUrl?: string;
  unitName?: string;
  payerNotes?: string;
}

export interface FinancialOperationDiagnostic {
  operationId: string;
  referenceType: FinancialReferenceType;
  referenceId?: string;

  clientState: ClientOperationState;
  lastAttemptAt?: string;
  lastRecoveryAt?: string;

  hasActiveSession: boolean;
  lastKnownServerState?: string;

  diagnosticState: DiagnosticState;
  errorCategory?: FinancialErrorCategory;
  errorMessage?: string;

  metadata?: FinancialOperationMetadata;
}

export interface ClassifiedFinancialError {
  category: FinancialErrorCategory;
  isAmbiguous: boolean;
  userActionRequired: boolean;
  clientState: ClientOperationState;
  diagnosticState: DiagnosticState;
  residentMessage: string;
  technicalCode?: string;
  statusCode?: number;
}

export interface FinancialTimelineStep {
  id: string;
  title: string;
  subtitle: string;
  timestamp?: string;
  state: 'completed' | 'current' | 'pending' | 'failed';
}

export interface FinancialSupportInformation {
  operationId: string;
  referenceType: string;
  referenceId: string;
  clientState: string;
  serverState: string;
  diagnosticState: string;
  amountFormatted?: string;
  paymentMethod?: string;
  paymentReference?: string;
  gatewayOrderId?: string;
  rejectionReason?: string;
  lastAttemptAt?: string;
  lastCheckedAt?: string;
  sanitizedSummaryText: string;
}

export interface DomainHealthReport {
  invoices: { isHealthy: boolean; lastCheckedAt?: string; error?: string };
  wallet: { isHealthy: boolean; lastCheckedAt?: string; error?: string };
  amenities: { isHealthy: boolean; lastCheckedAt?: string; error?: string };
  hasDegradedDomain: boolean;
  degradedDomainNames: string[];
}
