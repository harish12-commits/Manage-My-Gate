/**
 * NAHOM / Connect Harmony - Mobile Phase 5: Global Financial Status System
 *
 * Presentation-level financial status normalization, resident-facing messaging,
 * accessibility attributes, and visual severity mapping.
 *
 * Invariant: Does NOT modify backend enums or financial domain states.
 * Operates purely as a presentation mapping and recovery guidance layer.
 */

export type FinancialPresentationCategory =
  | 'SUCCESS'
  | 'CHECKING'
  | 'VERIFICATION_PENDING'
  | 'PARTIALLY_PAID'
  | 'PENDING'
  | 'REJECTED'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type FinancialRecommendedAction =
  | 'NONE'
  | 'CHECK_STATUS'
  | 'PAY_NOW'
  | 'SUBMIT_FRESH'
  | 'VIEW_RECEIPT'
  | 'WAIT_FOR_CLEARANCE';

export interface FinancialStatusPresentation {
  category: FinancialPresentationCategory;
  rawStatus: string;
  label: string;
  headline: string;
  description: string;
  badgeVariant: StatusVariant;
  accessibilityLabel: string;
  isTerminal: boolean;
  isSettled: boolean;
  isActionable: boolean;
  canPayAgain: boolean;
  recommendedAction: FinancialRecommendedAction;
}

export interface FinancialStatusOptions {
  amount?: number;
  paidAmount?: number;
  remainingDue?: number;
  reference?: string;
  rejectionReason?: string;
  paymentMethod?: string;
  invoiceNumber?: string;
  facilityName?: string;
}

/**
 * Normalizes any backend domain status string into a presentation category.
 */
export function mapToFinancialCategory(status: string | undefined | null): FinancialPresentationCategory {
  if (!status) return 'PENDING';
  const s = String(status).trim().toUpperCase();

  switch (s) {
    case 'PAID':
    case 'SUCCESS':
    case 'COMPLETED':
    case 'SETTLED':
      return 'SUCCESS';

    case 'CHECKING':
    case 'PAYMENT_CHECKING':
    case 'VERIFYING':
    case 'IN_PROGRESS':
    case 'PROCESSING':
      return 'CHECKING';

    case 'VERIFICATION_PENDING':
    case 'OFFLINE_VERIFICATION_PENDING':
    case 'CLEARING_PENDING':
      return 'VERIFICATION_PENDING';

    case 'PARTIALLY_PAID':
    case 'PARTIAL':
      return 'PARTIALLY_PAID';

    case 'REJECTED':
    case 'OFFLINE_REJECTED':
      return 'REJECTED';

    case 'FAILED':
    case 'DECLINED':
    case 'ERROR':
      return 'FAILED';

    case 'REFUNDED':
    case 'REFUND_SETTLED':
      return 'REFUNDED';

    case 'CANCELLED':
    case 'VOID':
      return 'CANCELLED';

    case 'UNPAID':
    case 'PENDING':
    case 'PENDING_PAYMENT':
    case 'CASH_PENDING':
    case 'PAY_AT_GATE':
    default:
      return 'PENDING';
  }
}

/**
 * Resolves authoritative resident-facing presentation metadata for any financial status.
 */
export function getFinancialStatusPresentation(
  status: string | undefined | null,
  options?: FinancialStatusOptions
): FinancialStatusPresentation {
  const category = mapToFinancialCategory(status);
  const rawStatus = String(status || 'PENDING');
  const remainingDue = options?.remainingDue ?? 0;
  const rejectionReason = options?.rejectionReason;
  const ref = options?.reference || '—';

  switch (category) {
    case 'SUCCESS':
      return {
        category: 'SUCCESS',
        rawStatus,
        label: 'Payment Confirmed',
        headline: 'Payment Confirmed!',
        description: options?.invoiceNumber
          ? `Invoice #${options.invoiceNumber} has been fully settled.`
          : 'Your payment was successfully received and settled.',
        badgeVariant: 'success',
        accessibilityLabel: 'Payment status: confirmed and fully settled.',
        isTerminal: true,
        isSettled: true,
        isActionable: true,
        canPayAgain: false,
        recommendedAction: 'VIEW_RECEIPT',
      };

    case 'CHECKING':
      return {
        category: 'CHECKING',
        rawStatus,
        label: 'Checking Status',
        headline: "We're checking your payment status.",
        description:
          'Your payment request may already have reached the server. Do not submit another payment while we verify the result.',
        badgeVariant: 'info',
        accessibilityLabel: 'Payment status: verifying transaction confirmation with server.',
        isTerminal: false,
        isSettled: false,
        isActionable: true,
        canPayAgain: false,
        recommendedAction: 'CHECK_STATUS',
      };

    case 'VERIFICATION_PENDING':
      return {
        category: 'VERIFICATION_PENDING',
        rawStatus,
        label: 'Pending verification',
        headline: 'Payment submitted — awaiting verification.',
        description: ref !== '—'
          ? `Submission reference #${ref} is awaiting administrative review. Not yet settled.`
          : 'Your payment was submitted and is awaiting administrative verification. Not yet settled.',
        badgeVariant: 'warning',
        accessibilityLabel: 'Payment status: pending administrative verification. Not yet settled.',
        isTerminal: false,
        isSettled: false,
        isActionable: false,
        canPayAgain: false,
        recommendedAction: 'WAIT_FOR_CLEARANCE',
      };

    case 'PARTIALLY_PAID':
      return {
        category: 'PARTIALLY_PAID',
        rawStatus,
        label: 'Partially Paid',
        headline: 'Partial Payment Received',
        description: remainingDue > 0
          ? `Partially settled. Remaining outstanding balance: ₹${remainingDue.toLocaleString('en-IN')}.`
          : 'Partially settled balance recorded by server.',
        badgeVariant: 'warning',
        accessibilityLabel: `Payment status: partially paid. Remaining liability: ₹${remainingDue.toLocaleString('en-IN')}.`,
        isTerminal: false,
        isSettled: false,
        isActionable: true,
        canPayAgain: true,
        recommendedAction: 'PAY_NOW',
      };

    case 'REJECTED':
      return {
        category: 'REJECTED',
        rawStatus,
        label: 'Submission Rejected',
        headline: 'Payment submission rejected.',
        description: rejectionReason
          ? `Reason: ${rejectionReason}. Please review your details and submit a new payment.`
          : 'Your payment submission was reviewed and rejected. Please submit a fresh payment.',
        badgeVariant: 'danger',
        accessibilityLabel: `Payment status: submission rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : ''}`,
        isTerminal: true,
        isSettled: false,
        isActionable: true,
        canPayAgain: true,
        recommendedAction: 'SUBMIT_FRESH',
      };

    case 'FAILED':
      return {
        category: 'FAILED',
        rawStatus,
        label: 'Payment Failed',
        headline: 'Payment Failed',
        description: 'Your payment could not be processed by the payment gateway. No funds were deducted.',
        badgeVariant: 'danger',
        accessibilityLabel: 'Payment status: transaction failed. You may retry payment.',
        isTerminal: true,
        isSettled: false,
        isActionable: true,
        canPayAgain: true,
        recommendedAction: 'PAY_NOW',
      };

    case 'REFUNDED':
      return {
        category: 'REFUNDED',
        rawStatus,
        label: 'Refunded',
        headline: 'Payment Refunded',
        description: 'The payment has been reversed and credited back to your original payment method or wallet.',
        badgeVariant: 'info',
        accessibilityLabel: 'Payment status: payment refunded.',
        isTerminal: true,
        isSettled: true,
        isActionable: false,
        canPayAgain: false,
        recommendedAction: 'NONE',
      };

    case 'CANCELLED':
      return {
        category: 'CANCELLED',
        rawStatus,
        label: 'Cancelled',
        headline: 'Payment Cancelled',
        description: 'The transaction was cancelled. No charges were made to your account.',
        badgeVariant: 'neutral',
        accessibilityLabel: 'Payment status: payment cancelled.',
        isTerminal: true,
        isSettled: false,
        isActionable: true,
        canPayAgain: true,
        recommendedAction: 'PAY_NOW',
      };

    case 'PENDING':
    default:
      return {
        category: 'PENDING',
        rawStatus,
        label: rawStatus === 'PAY_AT_GATE' ? 'Pay at Gate' : 'Pending',
        headline: rawStatus === 'PAY_AT_GATE'
          ? 'Booking confirmed. Cash payment is still pending.'
          : 'Payment Pending',
        description: rawStatus === 'PAY_AT_GATE'
          ? 'Please pay cash at the security gate or facility counter before entry.'
          : 'Payment has not yet been initiated or settled.',
        badgeVariant: 'warning',
        accessibilityLabel: rawStatus === 'PAY_AT_GATE'
          ? 'Payment status: cash collection pending at gate.'
          : 'Payment status: unpaid and pending.',
        isTerminal: false,
        isSettled: false,
        isActionable: true,
        canPayAgain: true,
        recommendedAction: 'PAY_NOW',
      };
  }
}
