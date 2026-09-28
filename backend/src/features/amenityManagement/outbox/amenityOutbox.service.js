import amenityOutboxEventRepository from './amenityOutboxEvent.repository.js';
import notificationService from '../../notification/notification.service.js';
import logger from '../../../utils/logger.utils.js';

/**
 * Amenity staff to notify in a community: members whose role grants
 * amenities:admin_calander, plus Community Admins.
 */
const amenityStaffRecipients = async (orgId) => {
  const mongoose = (await import('mongoose')).default;
  const { Permission } = await import('../../permission/permission.model.js');
  const { RolePermission } = await import('../../rolePermission/rolePermission.model.js');
  const Role = mongoose.models.Role || (await import('../../role/role.model.js')).default;
  const OrgMembership = mongoose.models.OrgMembership || (await import('../../orgMembership/orgMembership.model.js')).default;

  const perm = await Permission.findOne({ name: 'amenities:admin_calander' }).select('_id').lean();
  const grantedRoleIds = perm
    ? (await RolePermission.find({ permissionId: perm._id }).select('roleId').lean()).map((rp) => rp.roleId)
    : [];
  const roles = await Role.find({
    orgId,
    $or: [{ _id: { $in: grantedRoleIds } }, { name: 'Community Admin' }],
  })
    .select('_id')
    .lean();
  const roleIds = roles.map((r) => r._id);
  if (!roleIds.length) return [];
  const memberships = await OrgMembership.find({
    orgId,
    status: 'Active',
    $or: [{ roleId: { $in: roleIds } }, { roleIds: { $in: roleIds } }],
  })
    .select('userId')
    .lean();
  return [...new Set(memberships.map((m) => String(m.userId)))];
};

const REVIEW_COPY = {
  NO_SHOW: {
    resident: (n) => `You did not check in for booking #${n}. Amenity staff will review it.`,
    staff: (n) => `Booking #${n} was not used (no check-in). Decide on a refund or forfeit.`,
  },
  UNPAID_BALANCE: {
    resident: (n) => `Booking #${n} still has an unpaid balance and was not used. Amenity staff will review it.`,
    staff: (n) => `Booking #${n} was not used and its balance was never paid. Review it.`,
  },
  OVERDUE_RETURN: {
    resident: (n) => `Please return the items borrowed on booking #${n}; the loan period has ended.`,
    staff: (n) => `Items on booking #${n} are overdue for return.`,
  },
};

export class AmenityOutboxService {
  constructor(options = {}) {
    this.baseRetryDelayMs = options.baseRetryDelayMs || parseInt(process.env.AMENITY_OUTBOX_BASE_RETRY_DELAY_MS || '2000', 10);
    this.maxRetryDelayMs = options.maxRetryDelayMs || parseInt(process.env.AMENITY_OUTBOX_MAX_RETRY_DELAY_MS || '300000', 10); // 5 minutes max
    this.maxRetries = options.maxRetries || parseInt(process.env.AMENITY_OUTBOX_MAX_RETRIES || '5', 10);
  }

  /**
   * Calculates exponential backoff delay capped by maxRetryDelayMs.
   * @param {number} retryCount
   * @returns {number} Delay in milliseconds
   */
  calculateBackoffDelay(retryCount) {
    const delay = this.baseRetryDelayMs * Math.pow(2, Math.max(0, retryCount - 1));
    return Math.min(delay, this.maxRetryDelayMs);
  }

  /**
   * Dispatches an individual outbox event to its appropriate integration boundary.
   * Leverages existing notification service for genuine downstream delivery.
   * Preserves honest audit boundaries without fabricating simulated financial transactions.
   * Avoids duplicate Socket emissions already handled by domain events.
   *
   * @param {Object} event
   */
  async dispatchEvent(event) {
    const { eventType, payload, orgId, aggregateId } = event;

    switch (eventType) {
      case 'RESERVATION_CONFIRMED':
        if (payload?.residentId) {
          await notificationService.createNotification({
            recipientId: payload.residentId,
            orgId,
            title: 'Amenity Reservation Confirmed',
            body: `Your reservation #${payload.reservationNumber || 'amenity booking'} has been confirmed.`,
            type: 'SUCCESS',
            actionUrl: `/resident/amenities/reservations/${payload.reservationId || aggregateId}`,
            metadata: { reservationId: payload.reservationId || aggregateId, eventType },
          });
        }
        logger.info(`[AmenityOutbox] RESERVATION_CONFIRMED downstream notification dispatched for reservation ${payload?.reservationNumber || aggregateId}`, {
          orgId,
          reservationId: payload?.reservationId || aggregateId,
          reservationNumber: payload?.reservationNumber,
        });
        break;

      case 'RESERVATION_CANCELLED':
        if (payload?.residentId) {
          await notificationService.createNotification({
            recipientId: payload.residentId,
            orgId,
            title: 'Amenity Reservation Cancelled',
            body: `Your reservation #${payload.reservationNumber || ''} was cancelled.${
              payload.refundMethod === 'WALLET' && payload.refundAmount > 0
                ? ` ₹${payload.refundAmount} has been returned to your Digital Wallet.`
                : ''
            } ${payload.cancellationReason || payload.reason || ''}`.trim(),
            type: 'WARNING',
            actionUrl: `/resident/amenities/reservations/${payload.reservationId || aggregateId}`,
            metadata: { reservationId: payload.reservationId || aggregateId, eventType },
          });
        }
        logger.info(`[AmenityOutbox] RESERVATION_CANCELLED downstream notification dispatched for reservation ${payload?.reservationNumber || aggregateId}`, {
          orgId,
          reservationId: payload?.reservationId || aggregateId,
          cancellationReason: payload?.cancellationReason,
        });
        break;

      case 'GATE_PASS_ISSUED':
        if (payload?.residentId) {
          await notificationService.createNotification({
            recipientId: payload.residentId,
            orgId,
            title: 'Amenity Access Pass Issued',
            body: 'Your digital QR access pass is now active for facility entry.',
            type: 'INFO',
            actionUrl: `/resident/amenities/passes/${payload.passId || aggregateId}`,
            metadata: { passId: payload.passId || aggregateId, reservationId: payload.reservationId, eventType },
          });
        }
        logger.info(`[AmenityOutbox] GATE_PASS_ISSUED downstream notification dispatched for pass ${payload?.passId || aggregateId}`, {
          orgId,
          passId: payload?.passId || aggregateId,
          reservationId: payload?.reservationId,
        });
        break;

      case 'HOLD_EXPIRED':
        if (payload?.residentId) {
          await notificationService.createNotification({
            recipientId: payload.residentId,
            orgId,
            title: 'Amenity Hold Expired',
            body: 'Your temporary reservation hold has expired and reserved capacity has been released.',
            type: 'INFO',
            actionUrl: '/resident/amenities',
            metadata: { holdId: payload.holdId || aggregateId, eventType },
          });
        }
        logger.info(`[AmenityOutbox] HOLD_EXPIRED downstream notification dispatched for hold ${payload?.holdId || aggregateId}`, {
          orgId,
          holdId: payload?.holdId || aggregateId,
        });
        break;

      case 'APPROVAL_REQUESTED':
        for (const staffId of await amenityStaffRecipients(orgId)) {
          await notificationService.createNotification({
            recipientId: staffId,
            orgId,
            title: 'Amenity Booking Awaiting Approval',
            body: `Booking #${payload?.reservationNumber || ''} is waiting for your review.`,
            type: 'INFO',
            actionUrl: `/resident/amenities/reservations/${payload?.reservationId || aggregateId}`,
            metadata: { reservationId: payload?.reservationId || aggregateId, eventType, audience: 'STAFF' },
          });
        }
        if (payload?.residentId) {
          await notificationService.createNotification({
            recipientId: payload.residentId,
            orgId,
            title: 'Amenity Approval Requested',
            body: `Your reservation #${payload.reservationNumber || ''} has been submitted for community administrator review.`,
            type: 'INFO',
            actionUrl: `/resident/amenities/reservations/${payload.reservationId || aggregateId}`,
            metadata: { reservationId: payload.reservationId || aggregateId, eventType },
          });
        }
        logger.info(`[AmenityOutbox] APPROVAL_REQUESTED downstream notification dispatched for reservation ${payload?.reservationNumber || aggregateId}`, {
          orgId,
          reservationId: payload?.reservationId || aggregateId,
        });
        break;

      case 'MAINTENANCE_SCHEDULED':
      case 'EMERGENCY_MAINTENANCE_DECLARED':
      case 'RECURRING_MAINTENANCE_SCHEDULED':
      case 'MAINTENANCE_EXTENDED':
      case 'MAINTENANCE_COMPLETED':
      case 'MAINTENANCE_CANCELLED':
        // Facility-level maintenance window recording
        logger.info(`[AmenityOutbox] ${eventType} announcement recorded for block ${aggregateId}`, {
          orgId,
          maintenanceBlockId: aggregateId,
          facilityId: payload?.facilityId,
        });
        break;

      case 'WAITLIST_RELEASED':
        // Deferred integration boundary (future waitlist engine scope)
        logger.info(`[AmenityOutbox] WAITLIST_RELEASED notification recorded for facility ${payload?.facilityId || aggregateId}`, {
          orgId,
          facilityId: payload?.facilityId || aggregateId,
        });
        break;

      case 'REFUND_DISPATCH_REQUIRED':
        // Crucial Honest Boundary: No fake financial refund execution or mock gateway API call.
        // Records external refund reconciliation requirement for financial audit.
        if (payload?.residentId) {
          await notificationService.createNotification({
            recipientId: payload.residentId,
            orgId,
            title: 'Refund Pending Reconciliation',
            body: `A refund of ₹${payload.amount || 0} for reservation #${payload.reservationNumber || ''} is pending external processing.`,
            type: 'INFO',
            actionUrl: `/resident/amenities/reservations/${payload.reservationId || aggregateId}`,
            metadata: { reservationId: payload.reservationId || aggregateId, eventType },
          });
        }
        logger.info(
          `[AmenityOutbox] REFUND_DISPATCH_REQUIRED: External refund reconciliation record created. Gateway refund dispatch remains pending manual/external settlement: reservation=${payload?.reservationNumber || aggregateId}, amount=${payload?.amount}, ref=${payload?.paymentReference}`,
          {
            orgId,
            reservationId: payload?.reservationId || aggregateId,
            reservationNumber: payload?.reservationNumber,
            paymentReference: payload?.paymentReference,
            amount: payload?.amount,
            reason: payload?.reason,
            settlementStatus: 'EXTERNAL_REFUND_PENDING',
          }
        );
        break;

      case 'APPROVAL_EXPIRED':
        if (payload?.residentId) {
          await notificationService.createNotification({
            recipientId: payload.residentId,
            orgId,
            title: 'Amenity Booking Not Approved in Time',
            body: `Booking #${payload.reservationNumber || ''} was not reviewed before its deadline and has been closed.${
              payload.refundAmount > 0 ? ` ₹${payload.refundAmount} has been returned to your Digital Wallet.` : ''
            }`,
            type: 'WARNING',
            actionUrl: `/resident/amenities/reservations/${payload.reservationId || aggregateId}`,
            metadata: { reservationId: payload.reservationId || aggregateId, eventType },
          });
        }
        break;

      case 'RESERVATION_REVIEW_REQUIRED': {
        const copy = REVIEW_COPY[payload?.reason] || REVIEW_COPY.NO_SHOW;
        const n = payload?.reservationNumber || '';
        for (const staffId of await amenityStaffRecipients(orgId)) {
          await notificationService.createNotification({
            recipientId: staffId,
            orgId,
            title: 'Amenity Booking Needs Review',
            body: copy.staff(n),
            type: 'WARNING',
            actionUrl: `/resident/amenities/reservations/${payload?.reservationId || aggregateId}`,
            metadata: { reservationId: payload?.reservationId || aggregateId, eventType, reason: payload?.reason, audience: 'STAFF' },
          });
        }
        if (payload?.residentId) {
          await notificationService.createNotification({
            recipientId: payload.residentId,
            orgId,
            title: 'Amenity Booking Update',
            body: copy.resident(n),
            type: 'WARNING',
            actionUrl: `/resident/amenities/reservations/${payload.reservationId || aggregateId}`,
            metadata: { reservationId: payload.reservationId || aggregateId, eventType, reason: payload.reason },
          });
        }
        break;
      }

      case 'RESERVATION_REVIEW_RESOLVED':
        if (payload?.residentId) {
          await notificationService.createNotification({
            recipientId: payload.residentId,
            orgId,
            title: 'Amenity Booking Reviewed',
            body: `Booking #${payload.reservationNumber || ''} has been reviewed by amenity staff.${
              payload.refundAmount > 0 ? ` ₹${payload.refundAmount} has been returned to your Digital Wallet.` : ''
            }`,
            type: 'INFO',
            actionUrl: `/resident/amenities/reservations/${payload.reservationId || aggregateId}`,
            metadata: { reservationId: payload.reservationId || aggregateId, eventType, resolution: payload.resolution },
          });
        }
        break;

      case 'RESERVATION_COMPLETED':
        if (payload?.residentId && (payload.depositRefunded > 0 || payload.depositRetained > 0)) {
          await notificationService.createNotification({
            recipientId: payload.residentId,
            orgId,
            title: 'Amenity Deposit Settled',
            body: `Booking #${payload.reservationNumber || ''} is complete. ₹${payload.depositRefunded || 0} of your deposit has been returned to your Digital Wallet${
              payload.depositRetained > 0 ? ` (₹${payload.depositRetained} kept for damage)` : ''
            }.`,
            type: 'INFO',
            actionUrl: `/resident/amenities/reservations/${payload.reservationId || aggregateId}`,
            metadata: { reservationId: payload.reservationId || aggregateId, eventType },
          });
        }
        break;

      case 'RESERVATION_RESCHEDULED':
        logger.info(`[AmenityOutbox] RESERVATION_RESCHEDULED acknowledged for ${payload?.reservationNumber || aggregateId}`);
        break;

      // Facility lifecycle events carry no resident-facing notification: live UI updates
      // are already emitted in-process, and affected residents are notified through
      // their own RESERVATION_CANCELLED events. Acknowledge so they never dead-letter.
      case 'FACILITY_CREATED':
      case 'FACILITY_PUBLISHED':
      case 'FACILITY_DEACTIVATED':
        logger.info(`[AmenityOutbox] ${eventType} acknowledged for facility ${payload?.code || aggregateId}`, {
          orgId,
          facilityId: payload?.facilityId || aggregateId,
        });
        break;

      default:
        throw new Error(`Unsupported outbox event type: ${eventType}`);
    }
  }

  /**
   * Atomically claims and processes the next pending outbox event.
   * @param {Date} [now=new Date()]
   * @returns {Promise<{ claimed: boolean, success?: boolean, error?: string, event?: any }>}
   */
  async processNextEvent(now = new Date()) {
    const event = await amenityOutboxEventRepository.claimNextPendingEvent(now);
    if (!event) {
      return { claimed: false };
    }

    try {
      await this.dispatchEvent(event);
      const published = await amenityOutboxEventRepository.markPublished(event._id);
      return { claimed: true, success: true, event: published };
    } catch (err) {
      const retryCount = (event.retryCount || 0) + 1;
      const maxRetries = event.maxRetries || this.maxRetries;
      const isDeadLetter = retryCount >= maxRetries;
      const delayMs = this.calculateBackoffDelay(retryCount);
      const nextRetryAt = new Date(Date.now() + delayMs);

      logger.error(`[AmenityOutbox] Dispatch failed for event ${event._id} (attempt ${retryCount}/${maxRetries}): ${err.message}`, {
        eventId: event._id,
        eventType: event.eventType,
        isDeadLetter,
        nextRetryAt,
      });

      const failed = await amenityOutboxEventRepository.markFailed({
        eventId: event._id,
        errorMessage: err.message,
        retryCount,
        nextRetryAt,
        isDeadLetter,
      });

      return { claimed: true, success: false, error: err.message, event: failed };
    }
  }

  /**
   * Sequentially claims and processes a batch of eligible outbox events.
   * Non-blocking: failures on individual events do not prevent processing others.
   * @param {number} [batchSize=50]
   * @param {Date} [now=new Date()]
   * @returns {Promise<{ processedCount: number, successCount: number, failureCount: number }>}
   */
  async processOutboxBatch(batchSize = 50, now = new Date()) {
    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < batchSize; i++) {
      const result = await this.processNextEvent(now);
      if (!result.claimed) {
        break; // No more pending events
      }

      processedCount++;
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    return { processedCount, successCount, failureCount };
  }

  /**
   * Recovers events stuck in PROCESSING past the lease duration.
   * @param {number} [timeoutMs=300000]
   * @param {Date} [now=new Date()]
   */
  async recoverStaleProcessing(timeoutMs = 300000, now = new Date()) {
    return amenityOutboxEventRepository.recoverStaleProcessingEvents(timeoutMs, now);
  }
}

export const amenityOutboxService = new AmenityOutboxService();
export default amenityOutboxService;
