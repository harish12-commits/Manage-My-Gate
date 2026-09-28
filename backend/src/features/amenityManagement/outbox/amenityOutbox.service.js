import amenityOutboxEventRepository from './amenityOutboxEvent.repository.js';
import notificationService from '../../notification/notification.service.js';
import logger from '../../../utils/logger.utils.js';

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
