import mongoose from 'mongoose';
import { hasAmenityAdminScope, GATE_STAFF_PERMISSIONS } from '../domain/access/amenityAdminScope.js';
import HttpError from '../../../utils/httpError.utils.js';
import amenityReservationRepository from './amenityReservation.repository.js';
import amenityReservationHoldRepository from '../holds/amenityReservationHold.repository.js';
import amenityFacilityRepository from '../facilities/amenityFacility.repository.js';
import amenitySlotAllocationRepository from '../allocations/amenitySlotAllocation.repository.js';
import amenityAllocationLedgerRepository from '../allocations/amenityAllocationLedger.repository.js';
import amenityOutboxEventRepository from '../outbox/amenityOutboxEvent.repository.js';
import amenityCounterService from '../counters/amenityCounter.service.js';
import amenityQuotaAllocationService from '../quotas/amenityQuotaAllocation.service.js';
import amenityAccessPassService from '../passes/amenityAccessPass.service.js';
import pricingService from '../domain/pricing/pricing.service.js';
import { withTransactionRetry } from '../domain/concurrency/transaction.utils.js';
import amenityManagementEvents, { AMENITY_EVENTS } from '../amenityManagement.events.js';
import walletService from '../../wallet/wallet.service.js';
import Payment from '../../payment/payment.model.js';

import {
  snapshotCancellationPolicy,
  cancellationBlockReason,
  computeCancellationRefund,
} from '../domain/policy/cancellationPolicy.js';
import amenitySettingsService from '../settings/amenitySettings.service.js';

/** Id of a possibly-populated reference. */
const idOf = (ref) => (ref && typeof ref === 'object' && ref._id ? ref._id : ref);

export class AmenityReservationService {
  /**
   * Promotes an active hold into a confirmed or pending-approval reservation.
   * Generates sequential reservation number, allocates pass, consumes quota,
   * transitions ledger, and publishes outbox events atomically.
   *
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.holdId
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {string|mongoose.Types.ObjectId} params.residentId
   * @param {string|mongoose.Types.ObjectId} params.unitId
   * @param {'WALLET'|'RAZORPAY'} [params.paymentMethod]
   * @param {string|mongoose.Types.ObjectId} [params.paymentId]
   * @param {string} [params.notes]
   * @param {mongoose.ClientSession} [session]
   * @returns {Promise<{ reservation: any, pass?: any, rawToken?: string }>}
   */
  async confirmReservationFromHold(params, session) {
    if (session) {
      return this._executeConfirmReservation(params, session);
    }
    return withTransactionRetry(async (trxSession) => {
      return this._executeConfirmReservation(params, trxSession);
    });
  }

  /**
   * Finds active reservations overlapping a given time range.
   * @param {Object} criteria
   * @param {mongoose.ClientSession} [session]
   */
  async findOverlappingActiveReservations(criteria, session) {
    return amenityReservationRepository.findOverlappingActiveReservations(criteria, session);
  }

  /**
   * Finds reservations for admin calendar view within a date range.
   * @param {Object} criteria
   * @param {mongoose.ClientSession} [session]
   */
  async findEventsForCalendar(criteria, session) {
    return amenityReservationRepository.findEventsForCalendar(criteria, session);
  }

  /**
   * Internal implementation of reservation confirmation inside a transaction session.
   * @private
   */
  async _executeConfirmReservation(
    { holdId, orgId, residentId, unitId, paymentMethod, paymentId, notes },
    session
  ) {
    // 1. Verify Active Hold
    const hold = await amenityReservationHoldRepository.findActiveById(holdId, session);
    if (!hold) {
      throw new HttpError(410, 'Reservation hold has expired or is no longer active');
    }

    if (
      hold.orgId.toString() !== orgId.toString() ||
      hold.residentId.toString() !== residentId.toString()
    ) {
      throw new HttpError(403, 'Reservation hold does not match user or organization');
    }

    // 2. Facility Lookup for Pricing & Workflow Rules
    const facility = await amenityFacilityRepository.findById(hold.facilityId, orgId, session);
    if (!facility) {
      throw new HttpError(404, 'Amenity facility not found');
    }

    // 3. The price is the one quoted and held for the resident; a facility price
    //    change between hold and confirm must not change what they pay.
    const pricingSnapshot =
      hold.pricingSnapshot && hold.pricingSnapshot.totalAmount !== undefined && hold.pricingSnapshot.totalAmount !== null
        ? (hold.pricingSnapshot.toObject ? hold.pricingSnapshot.toObject() : hold.pricingSnapshot)
        : pricingService.calculateForFacility(facility, {
            startDateTime: hold.requestedStartDateTime,
            endDateTime: hold.requestedEndDateTime,
            headcount: hold.headcount,
            quantity: hold.quantity,
          });

    // 4. Resolve payment exclusively from server-side state. The old flow
    // trusted a client-provided paymentReference, which meant a booking could
    // be marked PAID without a wallet debit or verified gateway capture.
    const totalAmount = Number(pricingSnapshot.totalAmount || 0);
    const normalizedPaymentMethod = String(paymentMethod || '').toUpperCase();
    let paymentStatus = 'NOT_REQUIRED';
    let paidAmount = 0;
    let persistedPaymentMethod = 'NONE';
    let persistedPaymentReference = null;
    let persistedPaymentId = null;

    if (totalAmount > 0) {
      if (normalizedPaymentMethod === 'WALLET') {
        paymentStatus = 'PAID';
        paidAmount = totalAmount;
        persistedPaymentMethod = 'WALLET';
      } else if (normalizedPaymentMethod === 'RAZORPAY') {
        if (!paymentId || !mongoose.isValidObjectId(paymentId)) {
          throw new HttpError(400, 'A verified Razorpay payment is required to confirm this reservation');
        }

        const payment = await Payment.findById(paymentId).session(session || null);
        const matchesHold =
          payment &&
          payment.referenceType === 'AmenityReservationHold' &&
          String(payment.referenceId) === String(hold._id);
        const amountMatches = payment && Math.abs(Number(payment.amount) - totalAmount) < 0.01;

        if (
          !matchesHold ||
          !amountMatches ||
          String(payment.orgId) !== String(orgId) ||
          String(payment.userId) !== String(residentId) ||
          payment.gateway !== 'razorpay' ||
          payment.status !== 'success'
        ) {
          throw new HttpError(400, 'The Razorpay payment is not valid for this reservation');
        }

        paymentStatus = 'PAID';
        paidAmount = totalAmount;
        persistedPaymentMethod = 'RAZORPAY';
        persistedPaymentReference = payment.gatewayTransactionId || null;
        persistedPaymentId = payment._id;
      } else {
        throw new HttpError(400, 'Select Digital Wallet or Razorpay to complete this paid reservation');
      }
    }

    // 5. State-Guarded Hold Transition (ACTIVE -> PROMOTED)
    const promotedHold = await amenityReservationHoldRepository.transitionStatus(
      { holdId, fromStatus: 'ACTIVE', toStatus: 'PROMOTED' },
      session
    );

    if (!promotedHold) {
      throw new HttpError(409, 'Reservation hold has already been promoted or expired');
    }

    // 6. Determine the 5 Orthogonal Dimensions
    const requiresApproval =
      facility.requiresApproval || facility.approvalWorkflow?.requireAdminApproval || false;
    const bookingStatus = requiresApproval ? 'PENDING_APPROVAL' : 'CONFIRMED';
    const approvalStatus = requiresApproval ? 'PENDING_REVIEW' : 'NOT_REQUIRED';
    const settings = await amenitySettingsService.getSettings(orgId, session);
    const approvalDeadline = requiresApproval
      ? new Date(Date.now() + (Number(settings.approvalTimeoutHours) || 24) * 3600000)
      : null;

    const shouldIssuePass =
      !requiresApproval && (paymentStatus === 'NOT_REQUIRED' || paymentStatus === 'PAID');
    const accessStatus = shouldIssuePass ? 'PASS_GENERATED' : 'NOT_APPLICABLE';
    const completionStatus = 'PENDING';

    // 7. Generate Tenant-Scoped Sequential Reservation Number
    const reservationNumber = await amenityCounterService.generateReservationNumber(
      { orgId },
      session
    );

    // A reservation ID is allocated before the wallet debit so the immutable
    // ledger entry can reference the reservation in the same transaction.
    const reservationId = new mongoose.Types.ObjectId();
    if (persistedPaymentMethod === 'WALLET') {
      const { walletTxn } = await walletService.chargeAmenityReservationWithWallet(
        {
          userId: residentId,
          orgId,
          amount: totalAmount,
          reservationId,
          amenityName: facility.name,
        },
        session
      );
      persistedPaymentReference = walletTxn.transactionId;
    }

    // 8. Create AmenityReservation Document
    const reservation = await amenityReservationRepository.create(
      {
        _id: reservationId,
        orgId,
        facilityId: hold.facilityId,
        resourceId: hold.resourceId,
        residentId: hold.residentId,
        unitId: hold.unitId,
        reservationNumber,
        requestedStartDateTime: hold.requestedStartDateTime,
        requestedEndDateTime: hold.requestedEndDateTime,
        effectiveStartDateTime: hold.effectiveStartDateTime,
        effectiveEndDateTime: hold.effectiveEndDateTime,
        headcount: hold.headcount,
        quantity: hold.quantity,
        bookingStatus,
        paymentStatus,
        approvalStatus,
        accessStatus,
        completionStatus,
        pricingSnapshot,
        totalAmount,
        paidAmount,
        paymentMethod: persistedPaymentMethod,
        paymentReference: persistedPaymentReference,
        paymentId: persistedPaymentId,
        depositAmount: pricingSnapshot.depositAmount,
        policySnapshot: {
          cancellation: snapshotCancellationPolicy(facility),
          archetype: facility.archetype,
          timezone: facility.timezone || null,
        },
        approvalDeadline,
        approvalHistory: requiresApproval
          ? [
              {
                action: 'REQUESTED',
                performedBy: residentId,
                timestamp: new Date(),
                notes: notes || 'Reservation submitted for review',
              },
            ]
          : [],
      },
      session
    );

    // Sync legacy amenity_bookings document for backwards compatibility
    try {
      const moment = (await import('moment-timezone')).default;
      const TIMEZONE = 'Asia/Kolkata';
      const startM = hold.requestedStartDateTime ? moment.tz(hold.requestedStartDateTime, TIMEZONE) : null;
      const endM = hold.requestedEndDateTime ? moment.tz(hold.requestedEndDateTime, TIMEZONE) : null;

      const legacyBookingDoc = {
        _id: reservation._id,
        bookingNumber: reservationNumber,
        orgId,
        userId: residentId,
        amenityId: hold.facilityId,
        resourceId: hold.resourceId || null,
        bookingDate: startM ? startM.format('YYYY-MM-DD') : '',
        startTime: startM ? startM.format('HH:mm') : '',
        endTime: endM ? endM.format('HH:mm') : '',
        status: bookingStatus.toLowerCase(),
        paymentStatus: paymentStatus.toLowerCase(),
        numberOfPersons: hold.headcount || hold.quantity || 1,
        totalPrice: totalAmount,
        createdAt: reservation.createdAt || new Date(),
        updatedAt: reservation.updatedAt || new Date(),
      };
      await mongoose.connection.db.collection('amenity_bookings').updateOne(
        { _id: reservation._id },
        { $set: legacyBookingDoc },
        { upsert: true }
      );
    } catch (syncErr) {
      // Gracefully log sync error without interrupting transaction
    }

    // 9. Promote Ledger Entries & Discrete Slot
    await amenityAllocationLedgerRepository.transitionStatus(
      {
        holdId: hold._id,
        fromStatus: 'HELD',
        toStatus: 'CONFIRMED',
        assignReservationId: reservation._id,
      },
      session
    );

    // 10. Consume Household Quota (Promote from reserved to consumed)
    const requestedUnits = Math.ceil(
      (hold.requestedEndDateTime.getTime() - hold.requestedStartDateTime.getTime()) / 60000
    );
    await amenityQuotaAllocationService.promoteQuota(
      {
        orgId,
        unitId: hold.unitId,
        facilityId: hold.facilityId,
        requestedUnits,
        date: hold.requestedStartDateTime,
      },
      session
    );

    // 11. Generate Access Pass if Confirmed
    let pass = null;
    let rawToken = null;
    if (shouldIssuePass) {
      const passResult = await amenityAccessPassService.issueAccessPass(
        {
          orgId,
          reservationId: reservation._id,
          passType: 'QR_DYNAMIC',
          validFrom: hold.effectiveStartDateTime,
          validUntil: hold.effectiveEndDateTime,
        },
        session
      );
      pass = passResult.pass;
      rawToken = passResult.rawToken;
    }

    // 12. Record Transactional Outbox Events
    const outboxEventType = requiresApproval ? 'APPROVAL_REQUESTED' : 'RESERVATION_CONFIRMED';
    await amenityOutboxEventRepository.createEvent(
      {
        orgId,
        eventType: outboxEventType,
        aggregateId: reservation._id,
        aggregateType: 'AmenityReservation',
        payload: {
          reservationId: reservation._id,
          reservationNumber: reservation.reservationNumber,
          residentId: reservation.residentId,
          facilityId: reservation.facilityId,
          bookingStatus,
          approvalStatus,
          paymentStatus,
          paymentMethod: persistedPaymentMethod,
        },
      },
      session
    );

    if (pass) {
      await amenityOutboxEventRepository.createEvent(
        {
          orgId,
          eventType: 'GATE_PASS_ISSUED',
          aggregateId: pass._id,
          aggregateType: 'AmenityAccessPass',
          payload: {
            passId: pass._id,
            reservationId: reservation._id,
            residentId: reservation.residentId,
          },
        },
        session
      );
    }

    // 13. Emit Domain Events
    amenityManagementEvents.emit(
      requiresApproval ? AMENITY_EVENTS.APPROVAL_REQUESTED : AMENITY_EVENTS.RESERVATION_CONFIRMED,
      reservation
    );

    if (pass) {
      amenityManagementEvents.emit(AMENITY_EVENTS.GATE_PASS_ISSUED, {
        pass,
        reservationId: reservation._id,
        residentId: reservation.residentId,
      });
    }

    return { reservation, pass, rawToken };
  }

  /**
   * Cancels an active or pending-approval reservation.
   * State-guarded, releases allocation ledger & slots, refunds quota,
   * revokes passes, and dispatches refund outbox event if paid.
   *
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.reservationId
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {string|mongoose.Types.ObjectId} params.residentId
   * @param {string} [params.cancellationReason]
   * @param {string|mongoose.Types.ObjectId} [params.cancelledBy]
   * @param {boolean} [params.isManagementCancellation]
   * @param {mongoose.ClientSession} [session]
   */
  async cancelReservation(params, session) {
    if (session) {
      return this._executeCancelReservation(params, session);
    }
    return withTransactionRetry(async (trxSession) => {
      return this._executeCancelReservation(params, trxSession);
    });
  }

  /**
   * Reschedules an active reservation to a new time window and/or sibling resource.
   * Revalidates availability at execution time in transaction to prevent overbooking/race conditions.
   *
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.reservationId
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {Date|string} params.newStartDateTime
   * @param {Date|string} params.newEndDateTime
   * @param {string|mongoose.Types.ObjectId} [params.newResourceId]
   * @param {string|mongoose.Types.ObjectId} [params.rescheduledBy]
   * @param {string} [params.reason]
   * @param {mongoose.ClientSession} [session]
   */
  async rescheduleReservation(params, session) {
    if (session) {
      return this._executeRescheduleReservation(params, session);
    }
    return withTransactionRetry(async (trxSession) => {
      return this._executeRescheduleReservation(params, trxSession);
    });
  }

  /**
   * Internal implementation of reservation rescheduling inside transaction.
   * @private
   */
  async _executeRescheduleReservation(
    { reservationId, orgId, newStartDateTime, newEndDateTime, newResourceId, rescheduledBy, reason = '' },
    session
  ) {
    const reservation = await amenityReservationRepository.findById(reservationId, session);
    if (!reservation || reservation.orgId.toString() !== orgId.toString()) {
      throw new HttpError(404, 'Reservation not found');
    }

    if (['CANCELLED', 'REJECTED', 'COMPLETED'].includes(reservation.bookingStatus)) {
      throw new HttpError(400, `Cannot reschedule a ${reservation.bookingStatus.toLowerCase()} reservation`);
    }

    const start = new Date(newStartDateTime);
    const end = new Date(newEndDateTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw new HttpError(400, 'Invalid date range: newStartDateTime must be earlier than newEndDateTime');
    }

    const facility = await amenityFacilityRepository.findById(reservation.facilityId, orgId, session);
    if (!facility) {
      throw new HttpError(404, 'Amenity facility not found');
    }

    let targetResourceId = reservation.resourceId;
    if (newResourceId && String(newResourceId) !== String(reservation.resourceId)) {
      const amenityResourceService = (await import('../resources/amenityResource.service.js')).default;
      const resource = await amenityResourceService.getResourceById(newResourceId, orgId, session);
      if (!resource || !resource.isActive || resource.isDeleted) {
        throw new HttpError(400, 'Replacement resource is not active or does not exist');
      }
      if (String(resource.facilityId) !== String(reservation.facilityId)) {
        throw new HttpError(400, 'Replacement resource does not belong to the same facility');
      }
      if (resource.assetState === 'MAINTENANCE') {
        throw new HttpError(400, 'Replacement resource is currently under maintenance');
      }
      targetResourceId = resource._id;
    }

    // Availability revalidation at execution time
    const { availabilityService } = await import('../domain/availability/availability.service.js');
    const availCheck = await availabilityService.checkAvailability(
      {
        orgId,
        facilityId: reservation.facilityId,
        resourceId: targetResourceId,
        startDateTime: start,
        endDateTime: end,
        headcount: reservation.headcount || 1,
        quantity: reservation.quantity || 1,
        excludeReservationId: reservation._id,
      },
      session
    );

    if (!availCheck.isAvailable) {
      throw new HttpError(409, `Target slot is unavailable: ${availCheck.reason || 'Slot already booked or under maintenance'}`);
    }

    // Release old allocations & allocate new
    if (facility.archetype === 'EXCLUSIVE_HOURLY') {
      const oldSlotStartUTC = reservation.requestedStartDateTime.toISOString();
      const oldSlotId = `SLOT:${reservation.orgId}:${reservation.facilityId}:${reservation.resourceId || 'ALL'}:${oldSlotStartUTC}`;
      await amenitySlotAllocationRepository.releaseDiscreteSlot(oldSlotId, session);

      const newSlotStartUTC = start.toISOString();
      const newSlotId = `SLOT:${reservation.orgId}:${reservation.facilityId}:${targetResourceId || 'ALL'}:${newSlotStartUTC}`;
      await amenitySlotAllocationRepository.promoteDiscreteSlot(newSlotId, reservation._id, session);
    }

    const historyEntry = {
      action: 'RESCHEDULED',
      performedBy: rescheduledBy || reservation.residentId,
      timestamp: new Date(),
      notes: reason || 'Reservation rescheduled due to maintenance',
    };

    const updatedReservation = await amenityReservationRepository.updateStateDimensions(
      reservationId,
      {
        requestedStartDateTime: start,
        requestedEndDateTime: end,
        effectiveStartDateTime: availCheck.effectiveStartDateTime || start,
        effectiveEndDateTime: availCheck.effectiveEndDateTime || end,
        resourceId: targetResourceId,
        $push: { approvalHistory: historyEntry },
      },
      session
    );

    // Revoke old passes and issue new access pass if confirmed
    await amenityAccessPassService.revokeAllByReservationId(
      reservationId,
      orgId,
      'Pass revoked due to reservation reschedule',
      session
    );

    if (reservation.bookingStatus === 'CONFIRMED') {
      await amenityAccessPassService.issueAccessPass(
        {
          orgId,
          reservationId: reservation._id,
          passType: 'QR_DYNAMIC',
          validFrom: availCheck.effectiveStartDateTime || start,
          validUntil: availCheck.effectiveEndDateTime || end,
        },
        session
      );
    }

    // Transactional Outbox & Domain Event
    await amenityOutboxEventRepository.createEvent(
      {
        orgId,
        eventType: 'RESERVATION_RESCHEDULED',
        aggregateId: reservation._id,
        aggregateType: 'AmenityReservation',
        payload: {
          reservationId: reservation._id,
          reservationNumber: reservation.reservationNumber,
          residentId: reservation.residentId,
          facilityId: reservation.facilityId,
          resourceId: targetResourceId,
          previousStartDateTime: reservation.requestedStartDateTime,
          previousEndDateTime: reservation.requestedEndDateTime,
          newStartDateTime: start,
          newEndDateTime: end,
          reason,
        },
      },
      session
    );

    amenityManagementEvents.emit('amenity:reservation:rescheduled', updatedReservation);

    return updatedReservation;
  }


  /**
   * Retrieves all future active/confirmed reservations for a facility without date limit.
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {string|mongoose.Types.ObjectId} params.facilityId
   * @param {mongoose.ClientSession} [session]
   */
  async getFutureActiveReservations({ orgId, facilityId }, session) {
    return amenityReservationRepository.findFutureActiveReservations({ orgId, facilityId }, session);
  }

  /**
   * Internal implementation of reservation cancellation.
   * @private
   */
  async _executeCancelReservation(
    { reservationId, orgId, residentId, cancellationReason, cancelledBy, isManagementCancellation = false },
    session
  ) {
    // 1. Fetch Reservation
    const reservation = await amenityReservationRepository.findById(reservationId, session);
    if (!reservation || reservation.orgId.toString() !== orgId.toString()) {
      throw new HttpError(404, 'Reservation not found');
    }

    // Idempotent: already cancelled
    if (reservation.bookingStatus === 'CANCELLED') {
      return reservation;
    }

    if (reservation.bookingStatus === 'REJECTED') {
      throw new HttpError(400, 'Cannot cancel a rejected reservation');
    }

    // 2. Cancellation gate (already used / started / facility forbids resident cancels)
    const blockReason = cancellationBlockReason(reservation, { isManagement: isManagementCancellation });
    if (blockReason) {
      throw new HttpError(/does not allow/.test(blockReason) ? 403 : 400, blockReason);
    }

    // 3. Refund per the policy frozen on the reservation, based on what was actually paid
    const wasPaid =
      ['PAID', 'REFUND_PENDING'].includes(reservation.paymentStatus) && Number(reservation.paidAmount) > 0;
    const refund = wasPaid
      ? computeCancellationRefund(reservation, { isManagement: isManagementCancellation })
      : { percentage: 0, bookingRefund: 0, depositRefund: 0, total: 0, reason: 'Nothing was paid' };
    const refundAmount = refund.total;
    const isWalletPayment = wasPaid && reservation.paymentMethod === 'WALLET' && refundAmount > 0;
    let newPaymentStatus = reservation.paymentStatus;
    if (wasPaid) {
      if (refundAmount <= 0) newPaymentStatus = 'PAID';
      else if (reservation.paymentMethod === 'WALLET') {
        newPaymentStatus = refundAmount >= Number(reservation.paidAmount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      } else newPaymentStatus = 'REFUND_PENDING';
    } else if (reservation.paymentStatus === 'NOT_APPLICABLE') {
      newPaymentStatus = 'NOT_REQUIRED';
    }

    // 3. Update Reservation Dimensions
    const updatedReservation = await amenityReservationRepository.updateStateDimensions(
      reservationId,
      {
        bookingStatus: 'CANCELLED',
        paymentStatus: newPaymentStatus,
        accessStatus: 'ACCESS_REVOKED',
        cancelledAt: new Date(),
        cancellationReason: cancellationReason || (isManagementCancellation ? 'Cancelled by administration' : 'Cancelled by user'),
        cancelledBy: cancelledBy || residentId,
        refundAmount,
        refundMethod: refundAmount > 0 ? (reservation.paymentMethod === 'WALLET' ? 'WALLET' : 'RAZORPAY') : null,
        refundPercentage: wasPaid ? refund.percentage : null,
        refundBreakdown: { bookingRefund: refund.bookingRefund, depositRefund: refund.depositRefund, reason: refund.reason },
      },
      session
    );

    try {
      await mongoose.connection.db.collection('amenity_bookings').updateOne(
        { _id: reservation._id },
        { $set: { status: 'cancelled', paymentStatus: (newPaymentStatus || 'refunded').toLowerCase(), updatedAt: new Date() } }
      );
    } catch (syncErr) {
      // Gracefully log
    }

    if (isWalletPayment && refundAmount > 0) {
      await walletService.refundAmenityReservationToWallet(
        {
          userId: reservation.residentId,
          orgId,
          amount: refundAmount,
          reservationId: reservation._id,
          amenityName: reservation.facilityId?.name,
          reason: `Refund for cancelled amenity reservation #${reservation.reservationNumber}`,
        },
        session
      );
    }

    // 4. Release Allocations & Capacity via Ledger
    const ledgerEntries = await amenityAllocationLedgerRepository.findByReservationId(
      reservationId,
      session
    );

    for (const entry of ledgerEntries) {
      const released = await amenityAllocationLedgerRepository.transitionStatus(
        {
          reservationId,
          fromStatus: 'CONFIRMED',
          toStatus: 'RELEASED',
        },
        session
      );

      if (released) {
        if (entry.allocationType === 'CAPACITY_HEADCOUNT' && entry.bucketId) {
          await amenitySlotAllocationRepository.decrementCapacityBucket(
            entry.bucketId,
            entry.allocatedQuantity,
            session
          );
        } else if (entry.allocationType === 'BULK_INVENTORY' && entry.bucketId) {
          await amenitySlotAllocationRepository.decrementBulkDayBucket(
            entry.bucketId,
            entry.allocatedQuantity,
            session
          );
        }
      }
    }

    // 5. Refund Consumed Quota (ids may be populated documents on this read)
    const requestedUnits = Math.ceil(
      (reservation.requestedEndDateTime.getTime() - reservation.requestedStartDateTime.getTime()) / 60000
    );

    await amenityQuotaAllocationService.refundQuota(
      {
        orgId,
        unitId: idOf(reservation.unitId),
        facilityId: idOf(reservation.facilityId),
        requestedUnits,
        date: reservation.requestedStartDateTime,
      },
      session
    );

    // 6. Revoke All Access Passes
    await amenityAccessPassService.revokeAllByReservationId(
      reservationId,
      orgId,
      cancellationReason || 'Reservation cancelled',
      session
    );

    // 7. Write Outbox Events
    await amenityOutboxEventRepository.createEvent(
      {
        orgId,
        eventType: 'RESERVATION_CANCELLED',
        aggregateId: reservation._id,
        aggregateType: 'AmenityReservation',
        payload: {
          reservationId: reservation._id,
          reservationNumber: reservation.reservationNumber,
          residentId: reservation.residentId,
          cancellationReason,
          refundMethod: refundAmount > 0 ? (isWalletPayment ? 'WALLET' : 'RAZORPAY') : null,
          refundAmount,
          refundPercentage: wasPaid ? refund.percentage : null,
        },
      },
      session
    );

    if (newPaymentStatus === 'REFUND_PENDING') {
      await amenityOutboxEventRepository.createEvent(
        {
          orgId,
          eventType: 'REFUND_DISPATCH_REQUIRED',
          aggregateId: reservation._id,
          aggregateType: 'AmenityReservation',
          payload: {
            reservationId: reservation._id,
            reservationNumber: reservation.reservationNumber,
            residentId: idOf(reservation.residentId),
            amount: refundAmount,
            reason: cancellationReason || 'Reservation cancelled',
          },
        },
        session
      );
    }

    // 8. Emit Domain Events
    amenityManagementEvents.emit(AMENITY_EVENTS.RESERVATION_CANCELLED, updatedReservation);
    if (isManagementCancellation) {
      amenityManagementEvents.emit(
        AMENITY_EVENTS.RESERVATION_CANCELLED_BY_ADMIN || 'amenity:reservation:cancelled_by_admin',
        updatedReservation
      );
    }
    if (newPaymentStatus === 'REFUND_PENDING') {
      amenityManagementEvents.emit(AMENITY_EVENTS.REFUND_DISPATCH_REQUIRED, {
        reservationId: updatedReservation._id,
        amount: updatedReservation.totalAmount,
      });
    }

    return updatedReservation;
  }

  /**
   * Maker-checker review action for event / approval-pending reservations.
   *
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.reservationId
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {string|mongoose.Types.ObjectId} params.adminUserId
   * @param {'APPROVED'|'REJECTED'} params.action
   * @param {string} [params.notes]
   * @param {mongoose.ClientSession} [session]
   */
  async reviewEventReservation(params, session) {
    if (session) {
      return this._executeReviewEventReservation(params, session);
    }
    return withTransactionRetry(async (trxSession) => {
      return this._executeReviewEventReservation(params, trxSession);
    });
  }

  /**
   * Internal implementation of review workflow.
   * @private
   */
  async _executeReviewEventReservation(
    { reservationId, orgId, adminUserId, action, notes },
    session
  ) {
    const reservation = await amenityReservationRepository.findById(reservationId, session);
    if (!reservation || reservation.orgId.toString() !== orgId.toString()) {
      throw new HttpError(404, 'Reservation not found');
    }

    if (reservation.approvalStatus !== 'PENDING_REVIEW') {
      throw new HttpError(
        409,
        `Reservation is not pending review (current approvalStatus: ${reservation.approvalStatus})`
      );
    }

    // Enforce approval deadline timeout
    if (reservation.approvalDeadline && reservation.approvalDeadline < new Date()) {
      throw new HttpError(408, 'Approval deadline has expired for this reservation');
    }

    if (action === 'APPROVED') {
      const isPaymentPending = reservation.paymentStatus === 'PENDING';
      const shouldConfirm = !isPaymentPending;
      const bookingStatus = shouldConfirm ? 'CONFIRMED' : 'PENDING_APPROVAL';
      const accessStatus = shouldConfirm ? 'PASS_GENERATED' : 'NOT_APPLICABLE';

      await amenityReservationRepository.appendApprovalHistory(
        reservationId,
        {
          action: 'APPROVED',
          performedBy: adminUserId,
          timestamp: new Date(),
          notes: notes || 'Approved by administrator',
        },
        session
      );

      const updatedReservation = await amenityReservationRepository.updateStateDimensions(
        reservationId,
        {
          bookingStatus,
          approvalStatus: 'APPROVED',
          accessStatus,
        },
        session
      );

      let pass = null;
      let rawToken = null;

      // Only generate pass and emit confirmation events when fully confirmed (paid or free)
      if (shouldConfirm) {
        const passResult = await amenityAccessPassService.issueAccessPass(
          {
            orgId,
            reservationId: reservation._id,
            passType: 'QR_DYNAMIC',
            validFrom: reservation.effectiveStartDateTime,
            validUntil: reservation.effectiveEndDateTime,
          },
          session
        );
        pass = passResult.pass;
        rawToken = passResult.rawToken;

        await amenityOutboxEventRepository.createEvent(
          {
            orgId,
            eventType: 'GATE_PASS_ISSUED',
            aggregateId: pass._id,
            aggregateType: 'AmenityAccessPass',
            payload: {
              passId: pass._id,
              reservationId: reservation._id,
              residentId: reservation.residentId,
            },
          },
          session
        );

        await amenityOutboxEventRepository.createEvent(
          {
            orgId,
            eventType: 'RESERVATION_CONFIRMED',
            aggregateId: reservation._id,
            aggregateType: 'AmenityReservation',
            payload: {
              reservationId: reservation._id,
              reservationNumber: reservation.reservationNumber,
              residentId: reservation.residentId,
            },
          },
          session
        );

        amenityManagementEvents.emit(AMENITY_EVENTS.RESERVATION_CONFIRMED, updatedReservation);
      }

      return { reservation: updatedReservation, pass, rawToken };
    }

    if (action === 'REJECTED') {
      const isWalletPayment =
        (reservation.paymentStatus === 'PAID' || reservation.paymentStatus === 'REFUND_PENDING') &&
        reservation.paymentMethod === 'WALLET';
      const refundAmount = Number(reservation.paidAmount || reservation.totalAmount || 0);
      let newPaymentStatus = reservation.paymentStatus;
      if (reservation.paymentStatus === 'PAID' || reservation.paymentStatus === 'REFUND_PENDING') {
        newPaymentStatus = isWalletPayment ? 'REFUNDED' : 'REFUND_PENDING';
      }

      await amenityReservationRepository.appendApprovalHistory(
        reservationId,
        {
          action: 'REJECTED',
          performedBy: adminUserId,
          timestamp: new Date(),
          notes: notes || 'Rejected by administrator',
        },
        session
      );

      const updatedReservation = await amenityReservationRepository.updateStateDimensions(
        reservationId,
        {
          bookingStatus: 'REJECTED',
          approvalStatus: 'REJECTED',
          accessStatus: 'NOT_APPLICABLE',
          paymentStatus: newPaymentStatus,
        },
        session
      );

      if (isWalletPayment && refundAmount > 0) {
        await walletService.refundAmenityReservationToWallet(
          {
            userId: reservation.residentId,
            orgId,
            amount: refundAmount,
            reservationId: reservation._id,
            amenityName: reservation.facilityId?.name,
            reason: `Refund for rejected amenity reservation #${reservation.reservationNumber}`,
          },
          session
        );
      }

      // Release Allocations & Ledger
      const ledgerEntries = await amenityAllocationLedgerRepository.findByReservationId(
        reservationId,
        session
      );

      for (const entry of ledgerEntries) {
        const released = await amenityAllocationLedgerRepository.transitionStatus(
          {
            reservationId,
            fromStatus: 'CONFIRMED',
            toStatus: 'RELEASED',
          },
          session
        );

        if (released) {
          if (entry.allocationType === 'CAPACITY_HEADCOUNT' && entry.bucketId) {
            await amenitySlotAllocationRepository.decrementCapacityBucket(
              entry.bucketId,
              entry.allocatedQuantity,
              session
            );
          } else if (entry.allocationType === 'BULK_INVENTORY' && entry.bucketId) {
            await amenitySlotAllocationRepository.decrementBulkDayBucket(
              entry.bucketId,
              entry.allocatedQuantity,
              session
            );
          }
        }
      }

      // Refund Quota (ids may be populated documents on this read)
      const requestedUnits = Math.ceil(
        (reservation.requestedEndDateTime.getTime() - reservation.requestedStartDateTime.getTime()) / 60000
      );

      await amenityQuotaAllocationService.refundQuota(
        {
          orgId,
          unitId: idOf(reservation.unitId),
          facilityId: idOf(reservation.facilityId),
          requestedUnits,
          date: reservation.requestedStartDateTime,
        },
        session
      );

      await amenityOutboxEventRepository.createEvent(
        {
          orgId,
          eventType: 'RESERVATION_CANCELLED',
          aggregateId: reservation._id,
          aggregateType: 'AmenityReservation',
          payload: {
            reservationId: reservation._id,
            reservationNumber: reservation.reservationNumber,
            residentId: reservation.residentId,
            reason: notes || 'Rejected by administrator',
            refundMethod: isWalletPayment ? 'WALLET' : null,
            refundAmount: isWalletPayment ? refundAmount : null,
          },
        },
        session
      );

      if (newPaymentStatus === 'REFUND_PENDING') {
        await amenityOutboxEventRepository.createEvent(
          {
            orgId,
            eventType: 'REFUND_DISPATCH_REQUIRED',
            aggregateId: reservation._id,
            aggregateType: 'AmenityReservation',
            payload: {
              reservationId: reservation._id,
              reservationNumber: reservation.reservationNumber,
              residentId: reservation.residentId,
              paymentReference: reservation.paymentReference,
              amount: refundAmount,
              reason: notes || 'Rejected by administrator',
            },
          },
          session
        );
      }

      amenityManagementEvents.emit(AMENITY_EVENTS.RESERVATION_CANCELLED, updatedReservation);

      return { reservation: updatedReservation };
    }

    throw new HttpError(400, `Unsupported review action: ${action}`);
  }

  /**
   * Processes payment webhooks idempotently.
   * Handles late payments for expired holds by scheduling an automatic refund.
   *
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {string|mongoose.Types.ObjectId} [params.holdId]
   * @param {string|mongoose.Types.ObjectId} [params.reservationId]
   * @param {string} params.paymentReference
   * @param {'PAID'|'FAILED'} params.status
   * @param {number} [params.paymentAmount]
   * @param {mongoose.ClientSession} [session]
   */
  async handlePaymentWebhook(params, session) {
    if (session) {
      return this._executePaymentWebhook(params, session);
    }
    return withTransactionRetry(async (trxSession) => {
      return this._executePaymentWebhook(params, trxSession);
    });
  }

  /**
   * Internal implementation of payment webhook handling.
   * @private
   */
  async _executePaymentWebhook(
    { orgId, holdId, reservationId, paymentReference, status, paymentAmount },
    session
  ) {
    // Case 1: Payment for an existing reservation document
    if (reservationId) {
      const reservation = await amenityReservationRepository.findById(reservationId, session);
      if (!reservation) {
        throw new HttpError(404, 'Reservation not found for payment webhook');
      }

      // Tenant spoofing guard: reject if caller passed orgId that differs from database
      if (orgId && reservation.orgId.toString() !== orgId.toString()) {
        throw new HttpError(403, 'Forbidden. Tenant spoofing detected for reservation payment webhook.');
      }

      // Underpayment guard: reject if payment amount is less than reservation total
      if (
        status === 'PAID' &&
        paymentAmount !== undefined &&
        paymentAmount !== null &&
        Number(paymentAmount) < Number(reservation.totalAmount || 0)
      ) {
        throw new HttpError(400, `Insufficient payment amount: expected ${reservation.totalAmount}, got ${paymentAmount}`);
      }

      const authoritativeOrgId = reservation.orgId;

      // Idempotency: if already PAID and CONFIRMED, return existing reservation without duplicate pass/event
      if (reservation.paymentStatus === 'PAID') {
        const existingPasses = await amenityAccessPassService.getPassesByReservationId(
          reservation._id,
          session
        );
        return {
          reservation,
          pass: existingPasses[0] || null,
          isDuplicate: true,
        };
      }

      if (status === 'PAID') {
        // Can transition to CONFIRMED and generate access pass if:
        // a) bookingStatus is already CONFIRMED (e.g. non-approval facility created pending payment)
        // b) bookingStatus is PENDING_APPROVAL and approvalStatus is APPROVED (maker-checker approved event)
        const canConfirm =
          reservation.bookingStatus === 'CONFIRMED' ||
          (reservation.bookingStatus === 'PENDING_APPROVAL' &&
            reservation.approvalStatus === 'APPROVED');

        const newBookingStatus = canConfirm ? 'CONFIRMED' : reservation.bookingStatus;
        const newAccessStatus = canConfirm ? 'PASS_GENERATED' : 'NOT_APPLICABLE';

        const updated = await amenityReservationRepository.updateStateDimensions(
          reservationId,
          {
            paymentStatus: 'PAID',
            bookingStatus: newBookingStatus,
            accessStatus: newAccessStatus,
          },
          session
        );

        let pass = null;
        let rawToken = null;

        if (canConfirm && reservation.accessStatus !== 'PASS_GENERATED') {
          // Promote any ledger allocations to CONFIRMED
          await amenityAllocationLedgerRepository.transitionStatus(
            {
              reservationId: reservation._id,
              fromStatus: 'HELD',
              toStatus: 'CONFIRMED',
            },
            session
          );

          const passResult = await amenityAccessPassService.issueAccessPass(
            {
              orgId: authoritativeOrgId,
              reservationId: reservation._id,
              passType: 'QR_DYNAMIC',
              validFrom: reservation.effectiveStartDateTime,
              validUntil: reservation.effectiveEndDateTime,
            },
            session
          );
          pass = passResult.pass;
          rawToken = passResult.rawToken;

          await amenityOutboxEventRepository.createEvent(
            {
              orgId: authoritativeOrgId,
              eventType: 'RESERVATION_CONFIRMED',
              aggregateId: reservation._id,
              aggregateType: 'AmenityReservation',
              payload: {
                reservationId: reservation._id,
                reservationNumber: reservation.reservationNumber,
                residentId: reservation.residentId,
              },
            },
            session
          );

          await amenityOutboxEventRepository.createEvent(
            {
              orgId: authoritativeOrgId,
              eventType: 'GATE_PASS_ISSUED',
              aggregateId: pass._id,
              aggregateType: 'AmenityAccessPass',
              payload: {
                passId: pass._id,
                reservationId: reservation._id,
                residentId: reservation.residentId,
              },
            },
            session
          );

          amenityManagementEvents.emit(AMENITY_EVENTS.RESERVATION_CONFIRMED, updated);
          amenityManagementEvents.emit(AMENITY_EVENTS.GATE_PASS_ISSUED, {
            pass,
            reservationId: reservation._id,
            residentId: reservation.residentId,
          });
        }

        return { reservation: updated, pass, rawToken };
      }

      if (status === 'FAILED') {
        return amenityReservationRepository.updateStateDimensions(
          reservationId,
          { paymentStatus: 'FAILED' },
          session
        );
      }
    }

    // Case 2: Payment triggered from Hold checkout
    if (holdId) {
      const hold = await amenityReservationHoldRepository.findById(holdId, session);
      if (!hold) {
        throw new HttpError(404, 'Hold not found for payment webhook');
      }

      // Tenant spoofing guard: reject if caller passed orgId that differs from database
      if (orgId && hold.orgId.toString() !== orgId.toString()) {
        throw new HttpError(403, 'Forbidden. Tenant spoofing detected for hold payment webhook.');
      }

      const authoritativeOrgId = hold.orgId;
      const activeHold = await amenityReservationHoldRepository.findActiveById(holdId, session);

      if (activeHold && status === 'PAID') {
        // Underpayment guard for active hold
        if (paymentAmount !== undefined && paymentAmount !== null) {
          const facility = await amenityFacilityRepository.findById(activeHold.facilityId, authoritativeOrgId || activeHold.orgId, session);
          if (facility) {
            const pricing = pricingService.calculateReservationPrice({
              pricingConfig: facility.pricingConfig || facility.pricing,
              requestedStartDateTime: activeHold.requestedStartDateTime,
              requestedEndDateTime: activeHold.requestedEndDateTime,
              headcount: activeHold.headcount,
              quantity: activeHold.quantity,
            });
            if (Number(paymentAmount) < Number(pricing.totalAmount || 0)) {
              throw new HttpError(400, `Insufficient payment amount: expected ${pricing.totalAmount}, got ${paymentAmount}`);
            }
          }
        }

        return this.confirmReservationFromHold(
          {
            holdId,
            orgId: authoritativeOrgId,
            residentId: activeHold.residentId,
            unitId: activeHold.unitId,
            paymentReference,
            notes: 'Payment confirmed via webhook',
          },
          session
        );
      }

      // Late payment arrived after hold expired:
      if ((!activeHold || activeHold.status !== 'ACTIVE') && status === 'PAID') {
        // Idempotency: check if a refund was already dispatched for this paymentReference or holdId
        const existingOutboxRefund = await amenityOutboxEventRepository.findExistingRefundEvent(
          { orgId: authoritativeOrgId, paymentReference, holdId },
          session
        );

        if (existingOutboxRefund) {
          const existingReservation = await amenityReservationRepository.findById(
            existingOutboxRefund.aggregateId,
            session
          );
          return {
            reservation: existingReservation,
            status: 'EXPIRED_HOLD_REFUND_DISPATCHED',
            isDuplicate: true,
          };
        }

        const deadHold = hold;
        const reservationNumber = await amenityCounterService.generateReservationNumber(
          { orgId: authoritativeOrgId },
          session
        );

        // Step 1: Record reservation as CANCELLED with initial paymentStatus: 'PAID'
        const fallbackReservation = await amenityReservationRepository.create(
          {
            orgId: authoritativeOrgId,
            facilityId: deadHold?.facilityId || new mongoose.Types.ObjectId(),
            resourceId: deadHold?.resourceId || null,
            residentId: deadHold?.residentId || new mongoose.Types.ObjectId(),
            unitId: deadHold?.unitId || new mongoose.Types.ObjectId(),
            reservationNumber,
            requestedStartDateTime: deadHold?.requestedStartDateTime || new Date(),
            requestedEndDateTime: deadHold?.requestedEndDateTime || new Date(),
            effectiveStartDateTime: deadHold?.effectiveStartDateTime || new Date(),
            effectiveEndDateTime: deadHold?.effectiveEndDateTime || new Date(),
            headcount: deadHold?.headcount || 1,
            quantity: deadHold?.quantity || 1,
            bookingStatus: 'CANCELLED',
            paymentStatus: 'PAID',
            approvalStatus: 'NOT_REQUIRED',
            accessStatus: 'NOT_APPLICABLE',
            completionStatus: 'ABANDONED',
            totalAmount: paymentAmount || 0,
            cancellationReason:
              `Payment received after hold expired (${paymentReference}); automatic refund scheduled`,
          },
          session
        );

        // Step 2: Transition paymentStatus to REFUND_PENDING according to refund workflow
        const updatedRefundReservation = await amenityReservationRepository.updateStateDimensions(
          fallbackReservation._id,
          { paymentStatus: 'REFUND_PENDING' },
          session
        );

        // Step 3: Write REFUND_DISPATCH_REQUIRED to Transactional Outbox
        await amenityOutboxEventRepository.createEvent(
          {
            orgId: authoritativeOrgId,
            eventType: 'REFUND_DISPATCH_REQUIRED',
            aggregateId: updatedRefundReservation._id,
            aggregateType: 'AmenityReservation',
            payload: {
              reservationId: updatedRefundReservation._id,
              reservationNumber: updatedRefundReservation.reservationNumber,
              holdId: holdId.toString(),
              paymentReference,
              amount: paymentAmount || 0,
              reason: 'Payment received after hold expired',
            },
          },
          session
        );

        amenityManagementEvents.emit(AMENITY_EVENTS.REFUND_DISPATCH_REQUIRED, {
          reservationId: updatedRefundReservation._id,
          paymentReference,
          amount: paymentAmount,
        });

        return {
          reservation: updatedRefundReservation,
          status: 'EXPIRED_HOLD_REFUND_DISPATCHED',
        };
      }
    }

    throw new HttpError(400, 'Invalid payment webhook payload: holdId or reservationId required');
  }

  /**
   * Fills pricingSnapshot.baseAmount for display when only a total was recorded.
   * Pure: never reprices from the facility and never writes. A reservation's amounts
   * are fixed when it is confirmed, and reads must not move money or rewrite them.
   */
  _normalizePricingSnapshot(reservation) {
    if (!reservation) return reservation;
    const doc = reservation.toObject ? reservation.toObject() : { ...reservation };
    const snap = doc.pricingSnapshot || {};
    if (!snap.baseAmount && snap.totalAmount !== undefined) {
      doc.pricingSnapshot = {
        baseAmount: snap.totalAmount || 0,
        taxAmount: snap.taxAmount || 0,
        depositAmount: snap.depositAmount || 0,
        totalAmount: snap.totalAmount || 0,
        currency: snap.currency || 'INR',
      };
    }
    return doc;
  }

  /**
   * Retrieves reservation by ID. Read-only: refunds are settled by the cancellation
   * and refund flows, never as a side effect of reading.
   * @param {string|mongoose.Types.ObjectId} reservationId
   * @param {mongoose.ClientSession} [session]
   */
  async getReservationById(reservationId, session) {
    return amenityReservationRepository.findById(reservationId, session);
  }

  /**
   * Retrieves reservation by tenant reservation number. Read-only.
   * @param {string|mongoose.Types.ObjectId} orgId
   * @param {string} reservationNumber
   * @param {mongoose.ClientSession} [session]
   */
  async getReservationByNumber(orgId, reservationNumber, session) {
    return amenityReservationRepository.findByReservationNumber(orgId, reservationNumber, session);
  }

  /**
   * Lists reservations with pagination.
   * @param {Object} queryParams
   */
  async listReservations(queryParams) {
    const result = await amenityReservationRepository.findWithPagination(queryParams);
    if (result && Array.isArray(result.data)) {
      result.data = result.data.map((resv) => this._normalizePricingSnapshot(resv));
      result.items = result.data;
    }
    return result;
  }

  /**
   * Resolves whether a user has administrative scope for amenity operations based on permissions.
   *
   * @param {object} user - The authenticated user object from req.user
   * @param {string[]} requiredPermissions - Required permission strings
   * @returns {Promise<boolean>}
   */
  async checkAmenityAdminScope(user, requiredPermissions = GATE_STAFF_PERMISSIONS) {
    return hasAmenityAdminScope(user, requiredPermissions);
  }

  /**
   * Evaluates whether an authenticated user is authorized to view or access a reservation.
   * Access is granted to:
   * 1. Users with administrative/staff amenity permissions.
   * 2. The primary resident who booked the reservation (reservation.residentId).
   * 3. Household members (family members, co-residents, owners) sharing the same unit (reservation.unitId).
   *
   * @param {Object} user - The authenticated user object (from req.user)
   * @param {Object} reservation - The target reservation document
   * @returns {Promise<boolean>}
   */
  async canUserAccessReservation(user, reservation) {
    if (!user || !reservation) return false;

    const userId = (user.id || user._id)?.toString();
    if (!userId) return false;

    // 1. Direct creator/owner of the reservation
    const resResidentId = (reservation.residentId?._id || reservation.residentId)?.toString();
    if (resResidentId && resResidentId === userId) {
      return true;
    }

    // 2. Admin / Staff scope
    const hasAdminScope = await this.checkAmenityAdminScope(user, [
      'amenities:admin_calander',
      'amenities:manage_bookings',
      'amenities:scanner',
    ]);
    if (hasAdminScope) {
      return true;
    }

    // 3. Family member or co-resident in the same unit
    const resUnitId = (reservation.unitId?._id || reservation.unitId)?.toString();
    if (resUnitId) {
      // Direct JWT/session token check
      const userVillaId = (user.villaId || user.unitId)?.toString();
      if (userVillaId && userVillaId === resUnitId) {
        return true;
      }

      if (Array.isArray(user.accessibleUnits)) {
        const hasUnitAccess = user.accessibleUnits.some(
          (u) => (u.villaId || u._id || u.id)?.toString() === resUnitId
        );
        if (hasUnitAccess) return true;
      }

      // Check database User record via userService
      try {
        const userService = (await import('../../user/user.services.js')).default;
        const userDoc = await userService.getUserById(userId);
        if (userDoc?.villaId && userDoc.villaId.toString() === resUnitId) {
          return true;
        }
      } catch (err) {
        // Non-blocking fallback
      }

      // Check database Villa record residents array via villaService
      try {
        const villaService = (await import('../../villa/villa.services.js')).default;
        const orgId = reservation.orgId || user.orgId;
        const villa = await villaService.getUnitById(reservation.unitId, orgId);
        if (villa) {
          if (
            villa.primaryResidentId?.toString() === userId ||
            villa.ownerId?.toString() === userId
          ) {
            return true;
          }
          if (Array.isArray(villa.residents)) {
            const isResident = villa.residents.some(
              (r) => (r.userId?._id || r.userId)?.toString() === userId
            );
            if (isResident) return true;
          }
        }
      } catch (err) {
        // Non-blocking fallback
      }
    }

    return false;
  }
}

export const amenityReservationService = new AmenityReservationService();
export default amenityReservationService;
