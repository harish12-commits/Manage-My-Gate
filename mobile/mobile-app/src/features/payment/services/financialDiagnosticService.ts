/**
 * NAHOM / Connect Harmony - Mobile Phase 6: Financial Diagnostic Service
 *
 * Operational diagnostic and reconciliation service.
 * Handles active session discovery, stale session reconciliation, and domain health monitoring.
 *
 * Invariants:
 * - Strictly presentation & recovery layer.
 * - Never invents financial truth, balances, or synthetic transaction IDs.
 * - Clears local active sessions ONLY when backend definitively resolves state.
 */

import paymentService, { ActivePaymentSession } from './paymentService';
import { billingService } from '../../billing/services/billingService';
import { walletService } from '../../wallet/services/walletService';
import * as amenityService from '../../amenities/services/amenityService';
import {
  FinancialOperationDiagnostic,
  DomainHealthReport,
  FinancialReferenceType,
  ClientOperationState,
} from '../types/financialDiagnostics.types';
import {
  classifyFinancialError,
  resolveDiagnosticState,
  logFinancialDiagnosticEvent,
} from '../utils/financialDiagnostics';

export class FinancialDiagnosticService {
  /**
   * Convert an ActivePaymentSession into a FinancialOperationDiagnostic structure.
   */
  mapSessionToDiagnostic(
    session: ActivePaymentSession,
    lastKnownServerState?: string,
    rejectionReason?: string
  ): FinancialOperationDiagnostic {
    const clientState = (session?.status || 'CHECKING') as ClientOperationState;
    const diagState = resolveDiagnosticState(clientState, lastKnownServerState);

    return {
      operationId: session?.operationId || (session?.referenceId ? `op_rec_${session.referenceId}` : 'op_recovered'),
      referenceType: (session?.referenceType || 'Invoice') as FinancialReferenceType,
      referenceId: session?.referenceId || '',
      clientState,
      lastAttemptAt: session?.createdAt || new Date().toISOString(),
      lastRecoveryAt: new Date().toISOString(),
      hasActiveSession: true,
      lastKnownServerState,
      diagnosticState: diagState,
      metadata: {
        amount: session?.amount,
        currency: session?.currency || 'INR',
        paymentMethod: session?.paymentMethod,
        offlineReference: session?.offlineReference,
        paymentReference: session?.offlineReference || session?.paymentId,
        orderId: session?.orderId,
        rejectionReason: rejectionReason || (session as any)?.rejectionReason,
        proofUrl: session?.proofUrl,
        payerNotes: session?.notes,
      },
    };
  }

  /**
   * Reconcile a single active payment session against the authoritative backend state.
   * If the backend confirms settlement (e.g. invoice is PAID, booking is PAID), the session is cleared.
   */
  async reconcileSession(session: ActivePaymentSession): Promise<{
    diagnostic: FinancialOperationDiagnostic;
    isResolved: boolean;
    updatedSession: ActivePaymentSession | null;
  }> {
    if (!session || !session.referenceId) {
      return {
        diagnostic: this.mapSessionToDiagnostic(session || ({} as any)),
        isResolved: false,
        updatedSession: session,
      };
    }

    const refType = session.referenceType || 'Invoice';
    const refId = session.referenceId;

    try {
      if (refType === 'Invoice') {
        const inv = await billingService.getInvoiceById(refId);
        if (!inv) {
          // If invoice does not exist or returned empty, keep session in CHECKING
          return {
            diagnostic: this.mapSessionToDiagnostic(session),
            isResolved: false,
            updatedSession: session,
          };
        }

        const serverStatus = String(inv.status || 'UNPAID').toUpperCase();

        // 1. Settled: Full or Partial
        if (serverStatus === 'PAID' || serverStatus === 'PARTIALLY_PAID') {
          await paymentService.clearActivePaymentSession('Invoice', refId);
          logFinancialDiagnosticEvent('financial_stale_session_reconciled', {
            referenceType: 'Invoice',
            referenceId: refId,
            operationId: session.operationId,
            serverStatus,
            resolution: 'CLEARED_SETTLED',
          });

          const diagnostic: FinancialOperationDiagnostic = {
            ...this.mapSessionToDiagnostic(session, serverStatus),
            clientState: 'SUCCESS',
            diagnosticState: 'NORMAL',
            hasActiveSession: false,
            metadata: {
              ...session,
              amount: inv.totalDue ?? session.amount,
              invoiceNumber: inv.invoiceNumber,
              paymentMethod: session.paymentMethod || inv.paymentMethod,
            },
          };

          return { diagnostic, isResolved: true, updatedSession: null };
        }

        // 2. Pending Verification (Offline submission awaiting admin clearance)
        if (serverStatus === 'VERIFICATION_PENDING') {
          const updated: ActivePaymentSession = {
            ...session,
            status: 'PENDING_VERIFICATION',
            offlineReference: inv.offlinePayment?.offlineReference || session.offlineReference,
          };
          await paymentService.saveActivePaymentSession(updated);

          const diagnostic: FinancialOperationDiagnostic = {
            ...this.mapSessionToDiagnostic(updated, 'VERIFICATION_PENDING'),
            clientState: 'PENDING_VERIFICATION',
            diagnosticState: 'AWAITING_SERVER',
            metadata: {
              ...session,
              invoiceNumber: inv.invoiceNumber,
            },
          };

          return { diagnostic, isResolved: false, updatedSession: updated };
        }

        // 3. Rejected by Admin
        if (serverStatus === 'REJECTED' || (serverStatus === 'UNPAID' && inv.rejectionReason)) {
          const reason = inv.rejectionReason || inv.offlinePayment?.rejectionReason || 'Submission rejected by management.';
          const updated: ActivePaymentSession = {
            ...session,
            status: 'REJECTED',
            notes: reason,
          };
          await paymentService.saveActivePaymentSession(updated);

          const diagnostic: FinancialOperationDiagnostic = {
            ...this.mapSessionToDiagnostic(updated, 'REJECTED', reason),
            clientState: 'REJECTED',
            diagnosticState: 'USER_ACTION_REQUIRED',
            errorMessage: reason,
            metadata: {
              ...session,
              invoiceNumber: inv.invoiceNumber,
              rejectionReason: reason,
            },
          };

          return { diagnostic, isResolved: false, updatedSession: updated };
        }

        // 4. Still UNPAID but session was CHECKING
        return {
          diagnostic: this.mapSessionToDiagnostic(session, serverStatus),
          isResolved: false,
          updatedSession: session,
        };
      }

      if (refType === 'AmenityBooking') {
        const bookingsRes = await amenityService.getMyBookings({ limit: 50 });
        const raw = (bookingsRes as any)?.data || bookingsRes;
        const bookings: any[] = Array.isArray(raw?.bookings) ? raw.bookings : Array.isArray(raw) ? raw : [];
        const booking = bookings.find((b) => String(b._id || b.id) === String(refId) || b.reservationNumber === refId);

        if (booking) {
          const payStatus = String(booking.paymentStatus || 'PENDING').toUpperCase();

          if (payStatus === 'PAID') {
            await paymentService.clearActivePaymentSession('AmenityBooking', refId);
            logFinancialDiagnosticEvent('financial_stale_session_reconciled', {
              referenceType: 'AmenityBooking',
              referenceId: refId,
              operationId: session.operationId,
              serverStatus: payStatus,
              resolution: 'CLEARED_SETTLED',
            });

            const diagnostic: FinancialOperationDiagnostic = {
              ...this.mapSessionToDiagnostic(session, payStatus),
              clientState: 'SUCCESS',
              diagnosticState: 'NORMAL',
              hasActiveSession: false,
              metadata: {
                ...session,
                bookingId: booking.bookingId || booking.reservationNumber,
                facilityName: booking.facilityName || booking.amenityId?.name,
              },
            };

            return { diagnostic, isResolved: true, updatedSession: null };
          }

          if (booking.paymentMethod === 'PAY_AT_GATE' && payStatus === 'PENDING') {
            const diagnostic: FinancialOperationDiagnostic = {
              ...this.mapSessionToDiagnostic(session, 'PENDING'),
              clientState: 'PENDING_VERIFICATION',
              diagnosticState: 'USER_ACTION_REQUIRED',
              metadata: {
                ...session,
                paymentMethod: 'PAY_AT_GATE',
                bookingId: booking.bookingId || booking.reservationNumber,
                facilityName: booking.facilityName || booking.amenityId?.name,
              },
            };
            return { diagnostic, isResolved: false, updatedSession: session };
          }
        }

        return {
          diagnostic: this.mapSessionToDiagnostic(session, 'UNKNOWN'),
          isResolved: false,
          updatedSession: session,
        };
      }

      if (refType === 'WalletRecharge') {
        const walletRes = await walletService.getWalletBalance({ limit: 50 });
        const txns = Array.isArray(walletRes?.transactionHistory)
          ? walletRes.transactionHistory
          : Array.isArray(walletRes?.transactions)
          ? walletRes.transactions
          : [];

        const matchedTxn = txns.find(
          (t: any) =>
            t.transactionId === session.operationId ||
            t.razorpay_order_id === session.orderId ||
            t.razorpay_payment_id === session.paymentId
        );

        if (matchedTxn && String(matchedTxn.paymentStatus).toLowerCase() === 'success') {
          await paymentService.clearActivePaymentSession('WalletRecharge', refId);
          logFinancialDiagnosticEvent('financial_stale_session_reconciled', {
            referenceType: 'WalletRecharge',
            referenceId: refId,
            operationId: session.operationId,
            serverStatus: 'SETTLED',
            resolution: 'CLEARED_SETTLED',
          });

          const diagnostic: FinancialOperationDiagnostic = {
            ...this.mapSessionToDiagnostic(session, 'SUCCESS'),
            clientState: 'SUCCESS',
            diagnosticState: 'NORMAL',
            hasActiveSession: false,
            metadata: {
              ...session,
              transactionId: matchedTxn.transactionId,
            },
          };

          return { diagnostic, isResolved: true, updatedSession: null };
        }

        return {
          diagnostic: this.mapSessionToDiagnostic(session, 'CHECKING'),
          isResolved: false,
          updatedSession: session,
        };
      }

      // Generic fallback
      return {
        diagnostic: this.mapSessionToDiagnostic(session),
        isResolved: false,
        updatedSession: session,
      };
    } catch (err: any) {
      // Ambiguous error during reconciliation query -> retain session in CHECKING without deleting
      const classified = classifyFinancialError(err);
      logFinancialDiagnosticEvent('financial_operation_checking', {
        operationId: session.operationId,
        referenceType: refType,
        referenceId: refId,
        error: classified.category,
      });

      const diagnostic: FinancialOperationDiagnostic = {
        ...this.mapSessionToDiagnostic(session),
        clientState: 'CHECKING',
        diagnosticState: 'RECOVERY_REQUIRED',
        errorCategory: classified.category,
        errorMessage: classified.residentMessage,
      };

      return {
        diagnostic,
        isResolved: false,
        updatedSession: session,
      };
    }
  }

  /**
   * Reconcile all active sessions across all financial domains.
   */
  async reconcileAllActiveSessions(): Promise<{
    active: FinancialOperationDiagnostic[];
    resolved: FinancialOperationDiagnostic[];
  }> {
    const sessions = await paymentService.getAllActivePaymentSessions();
    const active: FinancialOperationDiagnostic[] = [];
    const resolved: FinancialOperationDiagnostic[] = [];

    for (const session of sessions) {
      const outcome = await this.reconcileSession(session);
      if (outcome.isResolved) {
        resolved.push(outcome.diagnostic);
      } else {
        active.push(outcome.diagnostic);
      }
    }

    return { active, resolved };
  }

  /**
   * Check independent health across all financial backend domains.
   */
  async checkDomainHealth(communityId?: string): Promise<DomainHealthReport> {
    const [invRes, walRes, amRes] = await Promise.allSettled([
      billingService.getMyDues(communityId),
      walletService.getWalletBalance({ limit: 1 }),
      amenityService.getMyBookings({ limit: 1 }),
    ]);

    const now = new Date().toISOString();
    const report: DomainHealthReport = {
      invoices: {
        isHealthy: invRes.status === 'fulfilled',
        lastCheckedAt: now,
        error: invRes.status === 'rejected' ? invRes.reason?.message : undefined,
      },
      wallet: {
        isHealthy: walRes.status === 'fulfilled',
        lastCheckedAt: now,
        error: walRes.status === 'rejected' ? walRes.reason?.message : undefined,
      },
      amenities: {
        isHealthy: amRes.status === 'fulfilled',
        lastCheckedAt: now,
        error: amRes.status === 'rejected' ? amRes.reason?.message : undefined,
      },
      hasDegradedDomain: false,
      degradedDomainNames: [],
    };

    if (!report.invoices.isHealthy) report.degradedDomainNames.push('Invoices');
    if (!report.wallet.isHealthy) report.degradedDomainNames.push('Wallet');
    if (!report.amenities.isHealthy) report.degradedDomainNames.push('Amenities');

    report.hasDegradedDomain = report.degradedDomainNames.length > 0;

    logFinancialDiagnosticEvent('financial_domain_health_checked', {
      degradedCount: report.degradedDomainNames.length,
      degradedDomains: report.degradedDomainNames,
    });

    return report;
  }
}

export const financialDiagnosticService = new FinancialDiagnosticService();
export default financialDiagnosticService;
