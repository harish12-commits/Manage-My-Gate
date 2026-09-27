/**
 * NAHOM / Connect Harmony - Mobile Phase 7: Financial Failure Injection Test Harness
 *
 * Provides a controlled, deterministic test harness for injecting network anomalies,
 * gateway timeouts, server degradation, session corruptions, and lifecycle drops
 * into mobile financial flows without altering production behavior.
 */

import paymentService, { ActivePaymentSession } from '../services/paymentService';
import storage from '@/src/utils/storage';
import { ClientOperationState, DiagnosticState } from '../types/financialDiagnostics.types';

// =========================================================================
// 1. Network & Gateway Error Simulators
// =========================================================================

/**
 * Creates an ECONNABORTED timeout error simulating gateway or client timeout.
 */
export const createNetworkTimeoutError = (message = 'timeout of 10000ms exceeded') => {
  const error: any = new Error(message);
  error.code = 'ECONNABORTED';
  error.isAxiosError = true;
  return error;
};

/**
 * Creates an ECONNRESET connection reset error simulating broken TCP socket.
 */
export const createConnectionResetError = (message = 'read ECONNRESET') => {
  const error: any = new Error(message);
  error.code = 'ECONNRESET';
  error.isAxiosError = true;
  return error;
};

/**
 * Creates an offline network error simulating device airplane mode / socket drop.
 */
export const createOfflineError = (message = 'Network Error') => {
  const error: any = new Error(message);
  error.code = 'ENOTFOUND';
  error.isAxiosError = true;
  return error;
};

/**
 * Creates an HTTP status error with optional response payload.
 */
export const createHttpError = (
  status: number,
  message: string,
  technicalCode?: string,
  responseData?: any
) => {
  const error: any = new Error(message);
  error.status = status;
  error.code = technicalCode;
  error.isAxiosError = true;
  error.response = {
    status,
    data: responseData || {
      success: false,
      message,
      errorCode: technicalCode,
    },
  };
  return error;
};

/**
 * Simulates a delayed server response (e.g. 504 Gateway Timeout or slow network).
 */
export const createDelayedResponse = <T>(delayMs: number, data: T): Promise<T> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delayMs);
  });
};

/**
 * Simulates a lost response: Mutation executes on server, but socket terminates before response reaches client.
 */
export const simulateLostResponseAfterSubmission = async <T>(
  serverEffect: () => Promise<void> | void,
  errorMessage = 'Connection interrupted while awaiting verification response'
): Promise<T> => {
  // Execute server-side effect (e.g., invoice marked paid on backend)
  await serverEffect();
  // Throw ambiguous network drop on client
  throw createNetworkTimeoutError(errorMessage);
};

// =========================================================================
// 2. Local Session & Storage Injection Simulators
// =========================================================================

/**
 * Injects an active payment session directly into storage and index.
 */
export const injectActiveSession = async (session: ActivePaymentSession): Promise<void> => {
  await paymentService.saveActivePaymentSession(session);
};

/**
 * Injects malformed/corrupted non-JSON string into an active session key.
 */
export const injectMalformedSession = async (
  referenceType: string,
  referenceId: string,
  rawContent = 'CORRUPTED_NON_JSON_DATA_{{['
): Promise<void> => {
  const key = `@mmg_active_payment_${referenceType}_${referenceId}`;
  await storage.setItem(key, rawContent);
};

/**
 * Injects a corrupted active session index key.
 */
export const injectCorruptedSessionIndex = async (
  rawContent = '{corrupted_index_not_an_array'
): Promise<void> => {
  await storage.setItem('@mmg_active_payment_sessions_index', rawContent);
};

/**
 * Injects an expired/stale active payment session (e.g., created 48 hours ago).
 */
export const injectExpiredSession = async (
  session: ActivePaymentSession,
  ageHours = 48
): Promise<void> => {
  const staleTime = new Date(Date.now() - ageHours * 60 * 60 * 1000).toISOString();
  const staleSession: ActivePaymentSession = {
    ...session,
    createdAt: staleTime,
  };
  await paymentService.saveActivePaymentSession(staleSession);
};

// =========================================================================
// 3. Financial State-Machine Invariant Verifiers
// =========================================================================

/**
 * Strictly verifies whether a financial state transition is permitted.
 * Invariant: Client can NEVER transition to PAID or SETTLED without authoritative server verification.
 */
export const isPermittedStateTransition = (
  from: ClientOperationState,
  to: ClientOperationState,
  isServerAuthoritativeConfirmed: boolean
): boolean => {
  // Terminal success requires backend proof
  if (to === 'SUCCESS') {
    return isServerAuthoritativeConfirmed;
  }

  // Ambiguous errors must transition to CHECKING, never to hard FAILED without definitive server rejection
  if (from === 'SUBMITTING' || from === 'CHECKING') {
    if (to === 'FAILED' && !isServerAuthoritativeConfirmed) {
      return false; // Forbidden: ambiguous network error cannot falsely fail payment
    }
  }

  return true;
};

/**
 * Asserts that a string, object, or error serialization contains zero raw sensitive credentials.
 */
export const assertNoSensitiveLeaks = (payload: any, forbiddenValues: string[] = []): void => {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  
  for (const val of forbiddenValues) {
    if (val && serialized.includes(val)) {
      throw new Error(`[SECURITY VIOLATION] Raw sensitive credential detected in payload: ${val}`);
    }
  }

  // Raw pattern leaks
  const RAW_LEAK_PATTERNS = [
    /bearer\s+ey[A-Za-z0-9_-]+/i,
    /authorization:\s*bearer/i,
  ];

  for (const pattern of RAW_LEAK_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new Error(`[SECURITY VIOLATION] Sensitive pattern "${pattern}" detected in payload: ${serialized}`);
    }
  }
};

describe('financialFailureHarness module', () => {
  it('exports failure simulation utilities', () => {
    expect(typeof createNetworkTimeoutError).toBe('function');
    expect(typeof createConnectionResetError).toBe('function');
    expect(typeof createOfflineError).toBe('function');
    expect(typeof createHttpError).toBe('function');
    expect(typeof assertNoSensitiveLeaks).toBe('function');
  });
});

