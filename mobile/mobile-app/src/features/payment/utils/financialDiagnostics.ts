/**
 * NAHOM / Connect Harmony - Mobile Phase 6: Financial Integrity Diagnostics Utilities
 *
 * Safe operational visibility and classification layer.
 * Strictly presentation & recovery: Never creates financial truth or alters backend balances.
 */

import {
  FinancialOperationDiagnostic,
  ClassifiedFinancialError,
  FinancialErrorCategory,
  ClientOperationState,
  DiagnosticState,
  FinancialTimelineStep,
  FinancialSupportInformation,
} from '../types/financialDiagnostics.types';

// Sensitive keys forbidden from appearing in logs, diagnostics, or support information
const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /auth/i,
  /secret/i,
  /password/i,
  /cvv/i,
  /pin/i,
  /cookie/i,
  /cardnumber/i,
  /accountnumber/i,
  /credential/i,
  /private/i,
];

/**
 * Mask sensitive string identifiers (e.g. account numbers, cards) preserving only the last 4 characters.
 */
export function maskSensitiveData(val?: string): string {
  if (!val || typeof val !== 'string') return '';
  const clean = val.trim();
  if (clean.length <= 4) return '****';
  return `****${clean.slice(-4)}`;
}

/**
 * Deeply sanitize an object to strip credentials, secrets, and auth tokens before logging or rendering.
 */
export function sanitizeDiagnosticPayload<T = any>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeDiagnosticPayload(item)) as any;
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED_SENSITIVE_CREDENTIAL]';
    } else if (val && typeof val === 'object') {
      sanitized[key] = sanitizeDiagnosticPayload(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized as T;
}

/**
 * Structured Operational Logger: Emits safe operational telemetry without exposing payment credentials.
 */
export function logFinancialDiagnosticEvent(
  eventName:
    | 'financial_operation_started'
    | 'financial_operation_checking'
    | 'financial_operation_recovered'
    | 'financial_operation_failed'
    | 'financial_operation_settled'
    | 'financial_stale_session_reconciled'
    | 'financial_domain_health_checked',
  data: Record<string, any>
): void {
  const sanitized = sanitizeDiagnosticPayload(data);
  if (__DEV__) {
    console.log(`[FinancialDiagnostics] ${eventName}:`, sanitized);
  }
}

/**
 * Classify financial errors into canonical categories for UX presentation and recovery routing.
 * Ensures network timeouts & 5xx route to CHECKING rather than falsely claiming payment failure.
 */
export function classifyFinancialError(err: any): ClassifiedFinancialError {
  if (!err) {
    return {
      category: 'UNKNOWN',
      isAmbiguous: false,
      userActionRequired: false,
      clientState: 'IDLE',
      diagnosticState: 'NORMAL',
      residentMessage: 'No active error reported.',
    };
  }

  const msg = String(err?.message || err?.description || err || '').toLowerCase();
  const code = String(err?.code || '').toUpperCase();
  const status = Number(err?.response?.status || err?.status || 0);

  // 1. Timeout Errors (Ambiguous -> CHECKING)
  if (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    status === 408 ||
    status === 504
  ) {
    return {
      category: 'TIMEOUT',
      isAmbiguous: true,
      userActionRequired: false,
      clientState: 'CHECKING',
      diagnosticState: 'RECOVERY_REQUIRED',
      residentMessage: "The connection timed out. We're checking the payment status with the server.",
      technicalCode: code || 'TIMEOUT',
      statusCode: status || 408,
    };
  }

  // 2. Network Errors (Ambiguous -> CHECKING)
  if (
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'ERR_NETWORK' ||
    msg.includes('network error') ||
    msg.includes('connection reset') ||
    msg.includes('request interrupted') ||
    msg.includes('unable to connect') ||
    msg.includes('offline')
  ) {
    return {
      category: 'NETWORK',
      isAmbiguous: true,
      userActionRequired: false,
      clientState: 'CHECKING',
      diagnosticState: 'RECOVERY_REQUIRED',
      residentMessage: "Network connection was interrupted. We're checking your payment status.",
      technicalCode: code || 'NETWORK_ERROR',
    };
  }

  // 3. Server 5xx Unavailable (Ambiguous during settlement -> CHECKING)
  if (code === 'ECONNRESET' || (status >= 500 && status < 600)) {
    return {
      category: 'SERVER_UNAVAILABLE',
      isAmbiguous: true,
      userActionRequired: false,
      clientState: 'CHECKING',
      diagnosticState: 'RECOVERY_REQUIRED',
      residentMessage: "The server is temporarily unavailable. We're verifying transaction settlement.",
      technicalCode: code || 'SERVER_5XX',
      statusCode: status || 500,
    };
  }

  // 4. Already Settled (Definitive Success)
  if (
    status === 409 ||
    msg.includes('already settled') ||
    msg.includes('already paid') ||
    msg.includes('duplicate payment')
  ) {
    return {
      category: 'ALREADY_SETTLED',
      isAmbiguous: false,
      userActionRequired: false,
      clientState: 'SUCCESS',
      diagnosticState: 'NORMAL',
      residentMessage: 'This transaction has already been settled on the server.',
      technicalCode: 'ALREADY_SETTLED',
      statusCode: status || 409,
    };
  }

  // 5. Authorization Failures (Definitive Rejection)
  if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('forbidden')) {
    return {
      category: 'AUTHORIZATION',
      isAmbiguous: false,
      userActionRequired: true,
      clientState: 'FAILED',
      diagnosticState: 'USER_ACTION_REQUIRED',
      residentMessage: 'Authorization failed. Please check your credentials and permissions.',
      technicalCode: 'AUTH_FAILED',
      statusCode: status || 403,
    };
  }

  // 6. Validation Failures (Definitive Rejection)
  if (status === 400 || status === 422 || msg.includes('invalid') || msg.includes('validation')) {
    return {
      category: 'VALIDATION',
      isAmbiguous: false,
      userActionRequired: true,
      clientState: 'FAILED',
      diagnosticState: 'USER_ACTION_REQUIRED',
      residentMessage: err?.message || 'Payment request validation failed. Please check your inputs.',
      technicalCode: 'VALIDATION_ERROR',
      statusCode: status || 400,
    };
  }

  // 7. Business Rule Failures (Definitive Rejection)
  if (
    msg.includes('insufficient') ||
    msg.includes('balance') ||
    msg.includes('limit') ||
    msg.includes('quota') ||
    msg.includes('closed') ||
    msg.includes('conflict')
  ) {
    return {
      category: 'BUSINESS_RULE',
      isAmbiguous: false,
      userActionRequired: true,
      clientState: 'FAILED',
      diagnosticState: 'USER_ACTION_REQUIRED',
      residentMessage: err?.message || 'Transaction cannot proceed due to community or account policy.',
      technicalCode: 'BUSINESS_RULE_VIOLATION',
      statusCode: status || 422,
    };
  }

  // 8. Fallback Unknown
  return {
    category: 'UNKNOWN',
    isAmbiguous: false,
    userActionRequired: true,
    clientState: 'FAILED',
    diagnosticState: 'USER_ACTION_REQUIRED',
    residentMessage: err?.message || 'An unexpected payment error occurred.',
    technicalCode: 'UNKNOWN_ERROR',
    statusCode: status || undefined,
  };
}

/**
 * Resolves the presentation DiagnosticState given client state, authoritative server state, and errors.
 */
export function resolveDiagnosticState(
  clientState: ClientOperationState,
  serverState?: string,
  errorCategory?: FinancialErrorCategory
): DiagnosticState {
  const normServer = String(serverState || '').toUpperCase();

  // If server reports definitive settlement
  if (normServer === 'PAID' || normServer === 'PARTIALLY_PAID' || normServer === 'SETTLED' || normServer === 'SUCCESS') {
    return 'NORMAL';
  }

  // If server reports rejection or client is rejected
  if (normServer === 'REJECTED' || clientState === 'REJECTED') {
    return 'USER_ACTION_REQUIRED';
  }

  // If ambiguous error is active, recovery is required
  if (errorCategory === 'TIMEOUT' || errorCategory === 'NETWORK' || errorCategory === 'SERVER_UNAVAILABLE') {
    return 'RECOVERY_REQUIRED';
  }

  // If awaiting server or checking
  if (clientState === 'CHECKING' || clientState === 'SUBMITTING' || normServer === 'VERIFICATION_PENDING') {
    return 'AWAITING_SERVER';
  }

  // If user action is required (e.g. Pay at gate pending, validation failure)
  if (clientState === 'FAILED' || normServer === 'PENDING') {
    return 'USER_ACTION_REQUIRED';
  }

  return 'NORMAL';
}

/**
 * Formats a clean, sanitized, copyable support information block for resident inquiries.
 * Guaranteed to NEVER include gateway secrets, auth headers, card numbers, or CVVs.
 */
export function formatSupportInformation(
  diagnostic: FinancialOperationDiagnostic,
  localizedLabels?: Record<string, string>
): FinancialSupportInformation {
  const meta = diagnostic.metadata || {};
  const amountStr = meta.amount !== undefined ? `₹${meta.amount.toLocaleString('en-IN')}` : undefined;
  const opId = diagnostic.operationId || '—';
  const refType = diagnostic.referenceType || 'Payment';
  const refId = diagnostic.referenceId || meta.invoiceNumber || meta.bookingId || '—';
  const clientState = diagnostic.clientState;
  const serverState = diagnostic.lastKnownServerState || 'UNKNOWN';
  const diagState = diagnostic.diagnosticState;
  const lastAttempt = diagnostic.lastAttemptAt ? new Date(diagnostic.lastAttemptAt).toISOString() : '—';
  const lastChecked = diagnostic.lastRecoveryAt ? new Date(diagnostic.lastRecoveryAt).toISOString() : new Date().toISOString();

  const lines = [
    '=== FINANCIAL OPERATION SUPPORT INFO ===',
    `Operation ID: ${opId}`,
    `Reference Type: ${refType}`,
    `Reference ID: ${refId}`,
    `Client State: ${clientState}`,
    `Server State: ${serverState}`,
    `Diagnostic State: ${diagState}`,
  ];

  if (amountStr) lines.push(`Amount: ${amountStr}`);
  if (meta.paymentMethod) lines.push(`Payment Method: ${meta.paymentMethod}`);
  if (meta.paymentReference || meta.offlineReference) {
    lines.push(`Payment Reference: ${meta.paymentReference || meta.offlineReference}`);
  }
  if (meta.rejectionReason) lines.push(`Rejection Reason: ${meta.rejectionReason}`);
  if (diagnostic.errorMessage) lines.push(`Diagnostic Notice: ${diagnostic.errorMessage}`);
  lines.push(`Last Attempt: ${lastAttempt}`);
  lines.push(`Last Checked: ${lastChecked}`);
  lines.push('=========================================');

  return {
    operationId: opId,
    referenceType: refType,
    referenceId: refId,
    clientState,
    serverState,
    diagnosticState: diagState,
    amountFormatted: amountStr,
    paymentMethod: meta.paymentMethod,
    paymentReference: meta.paymentReference || meta.offlineReference,
    gatewayOrderId: meta.orderId,
    rejectionReason: meta.rejectionReason,
    lastAttemptAt: lastAttempt,
    lastCheckedAt: lastChecked,
    sanitizedSummaryText: lines.join('\n'),
  };
}

/**
 * Generates an accessible, resident-facing lifecycle timeline for the operation.
 * Every transition is anchored strictly in client state or authoritative server state.
 */
export function generateFinancialTimeline(
  diagnostic: FinancialOperationDiagnostic
): FinancialTimelineStep[] {
  const steps: FinancialTimelineStep[] = [];
  const clientState = diagnostic.clientState;
  const serverState = String(diagnostic.lastKnownServerState || '').toUpperCase();
  const meta = diagnostic.metadata || {};
  const isOffline = meta.paymentMethod === 'CASH' || meta.paymentMethod === 'BANK_TRANSFER' || meta.paymentMethod === 'CHEQUE';
  const isPayAtGate = meta.paymentMethod === 'PAY_AT_GATE';

  if (isPayAtGate) {
    // Pay-at-Gate timeline
    steps.push({
      id: 'step-1',
      title: 'Booking Confirmed',
      subtitle: 'Facility reservation confirmed on server.',
      state: 'completed',
    });
    const isPaid = serverState === 'PAID';
    steps.push({
      id: 'step-2',
      title: 'Cash Payment Pending',
      subtitle: isPaid ? 'Cash collected and settled.' : 'Present pass at security gate or counter to pay.',
      state: isPaid ? 'completed' : 'current',
    });
    steps.push({
      id: 'step-3',
      title: 'Settlement Completed',
      subtitle: isPaid ? 'Payment fully settled by gate staff.' : 'Awaiting counter cash collection.',
      state: isPaid ? 'completed' : 'pending',
    });
  } else if (isOffline) {
    // Offline submission timeline
    steps.push({
      id: 'step-1',
      title: 'Payment Submitted',
      subtitle: `Submitted with ref #${meta.paymentReference || meta.offlineReference || 'OFFLINE'}`,
      state: 'completed',
    });

    const isRejected = clientState === 'REJECTED' || serverState === 'REJECTED';
    const isPaid = serverState === 'PAID' || serverState === 'PARTIALLY_PAID';

    steps.push({
      id: 'step-2',
      title: 'Awaiting Administrative Verification',
      subtitle: isRejected
        ? 'Submission rejected by management.'
        : isPaid
        ? 'Verification approved.'
        : 'Submitted for management review.',
      state: isPaid ? 'completed' : isRejected ? 'failed' : 'current',
    });

    steps.push({
      id: 'step-3',
      title: isRejected ? 'Submission Rejected' : 'Administrative Clearance',
      subtitle: isRejected
        ? (meta.rejectionReason ? `Reason: ${meta.rejectionReason}` : 'Payment was rejected.')
        : isPaid
        ? 'Funds verified and invoice marked paid.'
        : 'Pending admin clearance.',
      state: isPaid ? 'completed' : isRejected ? 'failed' : 'pending',
    });
  } else {
    // Online gateway or wallet payment timeline
    steps.push({
      id: 'step-1',
      title: 'Payment Initiated',
      subtitle: 'Payment request initiated on device.',
      state: 'completed',
    });

    const isChecking = clientState === 'CHECKING' || clientState === 'SUBMITTING';
    const isPaid = clientState === 'SUCCESS' || serverState === 'PAID' || serverState === 'PARTIALLY_PAID';
    const isFailed = clientState === 'FAILED';

    steps.push({
      id: 'step-2',
      title: 'Request Submitted to Server',
      subtitle: 'Transaction dispatch reached backend.',
      state: isPaid || isChecking || isFailed ? 'completed' : 'current',
    });

    steps.push({
      id: 'step-3',
      title: 'Verifying Settlement',
      subtitle: isPaid
        ? 'Server confirmed settlement.'
        : isChecking
        ? "We're verifying payment status with server."
        : isFailed
        ? 'Settlement failed.'
        : 'Awaiting gateway callback.',
      state: isPaid ? 'completed' : isChecking ? 'current' : isFailed ? 'failed' : 'pending',
    });

    steps.push({
      id: 'step-4',
      title: isPaid ? 'Payment Settled' : isFailed ? 'Payment Failed' : 'Authoritative Settlement',
      subtitle: isPaid
        ? 'Authoritative server settlement confirmed.'
        : isFailed
        ? (diagnostic.errorMessage || 'Transaction could not be completed.')
        : 'Awaiting confirmation.',
      state: isPaid ? 'completed' : isFailed ? 'failed' : 'pending',
    });
  }

  return steps;
}
