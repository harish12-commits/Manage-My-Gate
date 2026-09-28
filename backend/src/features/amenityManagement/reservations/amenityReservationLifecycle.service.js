import mongoose from 'mongoose';
import HttpError from '../../../utils/httpError.utils.js';
import logger from '../../../utils/logger.utils.js';
import AmenityReservation from './amenityReservation.model.js';
import amenityFacilityRepository from '../facilities/amenityFacility.repository.js';
import amenityOutboxEventRepository from '../outbox/amenityOutboxEvent.repository.js';
import amenityQuotaAllocationService from '../quotas/amenityQuotaAllocation.service.js';
import amenityAccessPassService from '../passes/amenityAccessPass.service.js';
import amenityPaymentService from '../payments/amenityPayment.service.js';
import amenitySettingsService from '../settings/amenitySettings.service.js';
import { withTransactionRetry } from '../domain/concurrency/transaction.utils.js';
import amenityManagementEvents, { AMENITY_EVENTS } from '../amenityManagement.events.js';

const idOf = (ref) => (ref && typeof ref === 'object' && ref._id ? ref._id : ref);
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const MIN = 60000;

/** Deposit actually collected for a reservation (never more than what was paid). */
export const depositPaidOf = (reservation) =>
  round2(Math.min(Number(reservation.depositAmount || 0), Number(reservation.paidAmount || 0)));

/** Only borrowed items need a return inspection before a booking can close. */
export const requiresReturnInspection = (facility) =>
  facility?.archetype === 'INVENTORY_TOOLS' && facility?.requiresInspection !== false;

const paymentStatusAfterRefund = (reservation, refund) => {
  if (refund <= 0) return reservation.paymentStatus;
  return refund >= Number(reservation.paidAmount || 0) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
};

/**
 * Time-driven reservation lifecycle (run by the lifecycle worker) and the staff
 * decisions it hands over: approval expiry, no-show / unpaid-balance / overdue-return
 * review, completion and deposit settlement.
 */
export class AmenityReservationLifecycleService {
  // ─── Approval expiry ──────────────────────────────────────────────────────

  /** Rejects approval requests nobody reviewed in time, refunding everything paid. */
  async expireStaleApprovals(limit = 50, now = new Date()) {
    const due = await AmenityReservation.find({
      bookingStatus: 'PENDING_APPROVAL',
      approvalStatus: 'PENDING_REVIEW',
      approvalDeadline: { $ne: null, $lt: now },
    })
      .select('_id')
      .limit(limit)
      .lean();
    let expired = 0;
    for (const { _id } of due) {
      try {
        if (await withTransactionRetry((trx) => this._expireApproval(_id, now, trx))) expired += 1;
      } catch (err) {
        logger.error(`[AmenityLifecycle] approval expiry failed for ${_id}: ${err.message}`);
      }
    }
    return expired;
  }

  async _expireApproval(reservationId, now, session) {
    const reservation = await AmenityReservation.findOneAndUpdate(
      { _id: reservationId, bookingStatus: 'PENDING_APPROVAL', approvalStatus: 'PENDING_REVIEW', approvalDeadline: { $lt: now } },
      {
        $set: { bookingStatus: 'REJECTED', approvalStatus: 'EXPIRED', accessStatus: 'NOT_APPLICABLE', balanceAmount: 0 },
        $push: { approvalHistory: { action: 'EXPIRED', timestamp: now, notes: 'Not reviewed before the approval deadline' } },
        $inc: { version: 1 },
      },
      { session, returnDocument: 'after' }
    );
    if (!reservation) return null;

    const refund = round2(reservation.paidAmount);
    if (refund > 0) {
      await amenityPaymentService.refundToWallet(
        { reservation, amount: refund, reason: `Refund: booking #${reservation.reservationNumber} was not approved in time`, key: 'APPROVAL_EXPIRED' },
        session
      );
    }
    await AmenityReservation.updateOne(
      { _id: reservation._id },
      {
        $set: {
          paymentStatus: refund > 0 ? 'REFUNDED' : 'NOT_REQUIRED',
          refundAmount: refund,
          refundMethod: refund > 0 ? 'WALLET' : null,
          refundPercentage: refund > 0 ? 100 : null,
        },
      },
      { session }
    );
    await this._refundQuota(reservation, session);
    await amenityOutboxEventRepository.createEvent(
      {
        orgId: reservation.orgId,
        eventType: 'APPROVAL_EXPIRED',
        aggregateId: reservation._id,
        aggregateType: 'AmenityReservation',
        payload: {
          reservationId: reservation._id,
          reservationNumber: reservation.reservationNumber,
          residentId: idOf(reservation.residentId),
          refundAmount: refund,
        },
      },
      session
    );
    return reservation;
  }

  // ─── Staff review: no-show, unpaid balance, overdue return ────────────────

  /**
   * Flags confirmed bookings that need a staff decision:
   *  - nobody checked in by start + no-show grace → NO_SHOW (or UNPAID_BALANCE when a
   *    balance was still due at the gate);
   *  - a borrowed item not returned by end + grace → OVERDUE_RETURN.
   */
  async flagForReview(limit = 50, now = new Date()) {
    const settingsByOrg = new Map();
    const graceFor = async (orgId) => {
      const key = String(orgId);
      if (!settingsByOrg.has(key)) settingsByOrg.set(key, await amenitySettingsService.getSettings(orgId));
      return Number(settingsByOrg.get(key)?.noShowGraceMinutes ?? 30);
    };

    const notReviewed = { $or: [{ 'adminReview.status': 'NONE' }, { 'adminReview.status': { $exists: false } }] };
    const noShows = await AmenityReservation.find({
      bookingStatus: 'CONFIRMED',
      accessStatus: 'PASS_GENERATED',
      completionStatus: 'PENDING',
      effectiveStartDateTime: { $lt: now },
      ...notReviewed,
    })
      .select('_id orgId effectiveStartDateTime balanceAmount')
      .limit(limit)
      .lean();

    let flagged = 0;
    for (const r of noShows) {
      if (r.effectiveStartDateTime.getTime() + (await graceFor(r.orgId)) * MIN > now.getTime()) continue;
      const reason = Number(r.balanceAmount) > 0 ? 'UNPAID_BALANCE' : 'NO_SHOW';
      if (await this._flag(r._id, reason, { accessStatus: 'PASS_GENERATED' }, now)) flagged += 1;
    }

    const outOnLoan = await AmenityReservation.find({
      bookingStatus: 'CONFIRMED',
      accessStatus: 'CHECKED_IN',
      completionStatus: 'PENDING',
      effectiveEndDateTime: { $lt: now },
      ...notReviewed,
    })
      .select('_id orgId facilityId effectiveEndDateTime')
      .limit(limit)
      .lean();
    for (const r of outOnLoan) {
      const facility = await amenityFacilityRepository.findById(r.facilityId, r.orgId);
      if (!requiresReturnInspection(facility)) continue;
      if (r.effectiveEndDateTime.getTime() + (await graceFor(r.orgId)) * MIN > now.getTime()) continue;
      if (await this._flag(r._id, 'OVERDUE_RETURN', { accessStatus: 'CHECKED_IN' }, now)) flagged += 1;
    }
    return flagged;
  }

  async _flag(reservationId, reason, guard, now) {
    return withTransactionRetry(async (session) => {
      const reservation = await AmenityReservation.findOneAndUpdate(
        {
          _id: reservationId,
          bookingStatus: 'CONFIRMED',
          completionStatus: 'PENDING',
          ...guard,
          $or: [{ 'adminReview.status': 'NONE' }, { 'adminReview.status': { $exists: false } }],
        },
        { $set: { adminReview: { status: 'PENDING', reason, flaggedAt: now } }, $inc: { version: 1 } },
        { session, returnDocument: 'after' }
      );
      if (!reservation) return null;
      await amenityOutboxEventRepository.createEvent(
        {
          orgId: reservation.orgId,
          eventType: 'RESERVATION_REVIEW_REQUIRED',
          aggregateId: reservation._id,
          aggregateType: 'AmenityReservation',
          payload: {
            reservationId: reservation._id,
            reservationNumber: reservation.reservationNumber,
            residentId: idOf(reservation.residentId),
            reason,
            balanceAmount: reservation.balanceAmount,
          },
        },
        session
      );
      return reservation;
    });
  }

  /**
   * Staff decision on a flagged booking.
   *  FORFEIT        — no refund of the booking amount (the deposit is still returned)
   *  REFUND_POLICY  — refund the facility's policy percentage
   *  REFUND_CUSTOM  — refund a stated percentage (a note is required)
   *  EXTEND         — unpaid balance / overdue return only: keep the booking going
   */
  async resolveReview({ reservationId, orgId, action, refundPercentage, notes, adminId }) {
    const updated = await withTransactionRetry(async (session) => {
      const reservation = await AmenityReservation.findOne({ _id: reservationId, orgId }).session(session);
      if (!reservation) throw new HttpError(404, 'Reservation not found');
      if (reservation.adminReview?.status !== 'PENDING') {
        throw new HttpError(409, 'This booking is not waiting for a review decision');
      }
      const reason = reservation.adminReview.reason;
      const now = new Date();

      if (action === 'EXTEND') {
        if (reason === 'NO_SHOW') throw new HttpError(400, 'A no-show cannot be extended; forfeit or refund it');
        const updated = await this._closeReview(reservation, { resolution: 'EXTEND', notes, adminId, now }, {}, session);
        return updated;
      }
      if (reason === 'OVERDUE_RETURN') {
        throw new HttpError(400, 'An unreturned item is closed by checking it out with an inspection');
      }

      let pct;
      if (action === 'FORFEIT') pct = 0;
      else if (action === 'REFUND_POLICY') {
        const policy = reservation.policySnapshot?.cancellation;
        pct = policy && policy.isAllowed !== false ? Number(policy.refundPercentage ?? 100) : 0;
      } else if (action === 'REFUND_CUSTOM') {
        pct = Number(refundPercentage);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new HttpError(400, 'refundPercentage must be between 0 and 100');
        if (!notes || !String(notes).trim()) throw new HttpError(400, 'A reason is required for a custom refund');
      } else throw new HttpError(400, 'Unknown review action');

      const deposit = depositPaidOf(reservation);
      const bookingPaid = round2(Number(reservation.paidAmount || 0) - deposit);
      const bookingRefund = Math.floor(bookingPaid * pct) / 100;
      const refund = round2(bookingRefund + deposit);
      if (refund > 0) {
        await amenityPaymentService.refundToWallet(
          { reservation, amount: refund, reason: `Refund for booking #${reservation.reservationNumber} (${action.toLowerCase()})`, key: 'REVIEW' },
          session
        );
      }
      await amenityAccessPassService.revokeAllByReservationId(reservation._id, orgId, 'Closed after staff review', session);

      const nothingPaid = Number(reservation.paidAmount || 0) <= 0;
      return this._closeReview(
        reservation,
        { resolution: action, notes, adminId, now, refundPercentage: pct, refundAmount: refund },
        {
          completionStatus: 'NO_SHOW',
          accessStatus: 'ACCESS_REVOKED',
          balanceAmount: 0,
          paymentStatus: nothingPaid ? 'NOT_REQUIRED' : paymentStatusAfterRefund(reservation, refund),
          refundAmount: refund,
          refundMethod: refund > 0 ? 'WALLET' : null,
          refundPercentage: nothingPaid ? null : pct,
          'depositSettlement.refunded': deposit,
          'depositSettlement.retained': 0,
          'depositSettlement.settledAt': now,
        },
        session
      );
    });
    if (updated) amenityManagementEvents.emit(AMENITY_EVENTS.RESERVATION_UPDATED, updated);
    return updated;
  }

  async _closeReview(reservation, { resolution, notes, adminId, now, refundPercentage = null, refundAmount = null }, extraSet, session) {
    const updated = await AmenityReservation.findOneAndUpdate(
      { _id: reservation._id, 'adminReview.status': 'PENDING' },
      {
        $set: {
          ...extraSet,
          'adminReview.status': 'RESOLVED',
          'adminReview.resolution': resolution,
          'adminReview.notes': notes || null,
          'adminReview.resolvedBy': adminId || null,
          'adminReview.resolvedAt': now,
          'adminReview.refundPercentage': refundPercentage,
          'adminReview.refundAmount': refundAmount,
        },
        $inc: { version: 1 },
      },
      { session, returnDocument: 'after' }
    );
    if (!updated) throw new HttpError(409, 'This booking was already reviewed');
    await amenityOutboxEventRepository.createEvent(
      {
        orgId: updated.orgId,
        eventType: 'RESERVATION_REVIEW_RESOLVED',
        aggregateId: updated._id,
        aggregateType: 'AmenityReservation',
        payload: {
          reservationId: updated._id,
          reservationNumber: updated.reservationNumber,
          residentId: idOf(updated.residentId),
          resolution,
          refundAmount,
        },
      },
      session
    );
    return updated;
  }

  /** Clears a pending no-show/overdue flag when the resident turns up or returns the item. */
  async clearReviewOnArrival(reservationId, resolution, session) {
    await AmenityReservation.updateOne(
      { _id: reservationId, 'adminReview.status': 'PENDING' },
      { $set: { 'adminReview.status': 'RESOLVED', 'adminReview.resolution': resolution, 'adminReview.resolvedAt': new Date() } },
      { session }
    );
  }

  // ─── Completion and deposit ───────────────────────────────────────────────

  /**
   * Closes a used booking: returns the deposit minus any damage charge to the wallet,
   * and records the check-out / completion.
   */
  async completeWithDeposit(reservation, { retained = 0, notes = null, actorId = null, checkedOut = false }, session) {
    const now = new Date();
    const deposit = depositPaidOf(reservation);
    const keep = Math.min(deposit, round2(retained));
    const giveBack = round2(deposit - keep);
    if (giveBack > 0) {
      await amenityPaymentService.refundToWallet(
        { reservation, amount: giveBack, reason: `Deposit returned for booking #${reservation.reservationNumber}`, key: 'DEPOSIT' },
        session
      );
    }
    const updated = await AmenityReservation.findOneAndUpdate(
      { _id: reservation._id, completionStatus: 'PENDING' },
      {
        $set: {
          completionStatus: 'COMPLETED',
          completedAt: now,
          ...(checkedOut ? { accessStatus: 'CHECKED_OUT', checkedOutAt: now, checkedOutBy: actorId } : {}),
          depositSettlement: { refunded: giveBack, retained: keep, notes, settledAt: deposit > 0 ? now : null },
          ...(giveBack > 0 ? { refundAmount: round2(Number(reservation.refundAmount || 0) + giveBack), refundMethod: 'WALLET' } : {}),
        },
        $inc: { version: 1 },
      },
      { session, returnDocument: 'after' }
    );
    if (!updated) throw new HttpError(409, 'This booking is already closed');
    await amenityOutboxEventRepository.createEvent(
      {
        orgId: updated.orgId,
        eventType: 'RESERVATION_COMPLETED',
        aggregateId: updated._id,
        aggregateType: 'AmenityReservation',
        payload: {
          reservationId: updated._id,
          reservationNumber: updated.reservationNumber,
          residentId: idOf(updated.residentId),
          depositRefunded: giveBack,
          depositRetained: keep,
        },
      },
      session
    );
    return updated;
  }

  /** Completes checked-in bookings whose time has ended (items needing inspection wait for check-out). */
  async autoComplete(limit = 50, now = new Date()) {
    const ended = await AmenityReservation.find({
      bookingStatus: 'CONFIRMED',
      accessStatus: 'CHECKED_IN',
      completionStatus: 'PENDING',
      effectiveEndDateTime: { $lt: now },
    })
      .limit(limit)
      .lean();
    let completed = 0;
    for (const r of ended) {
      try {
        const facility = await amenityFacilityRepository.findById(r.facilityId, r.orgId);
        if (requiresReturnInspection(facility)) continue;
        await withTransactionRetry(async (session) => {
          const fresh = await AmenityReservation.findOne({ _id: r._id, completionStatus: 'PENDING' }).session(session);
          if (fresh) await this.completeWithDeposit(fresh, { notes: 'Completed automatically after the booking ended' }, session);
        });
        completed += 1;
      } catch (err) {
        logger.error(`[AmenityLifecycle] auto-complete failed for ${r._id}: ${err.message}`);
      }
    }
    return completed;
  }

  async _refundQuota(reservation, session) {
    const requestedUnits = Math.ceil(
      (reservation.requestedEndDateTime.getTime() - reservation.requestedStartDateTime.getTime()) / MIN
    );
    await amenityQuotaAllocationService.refundQuota(
      {
        orgId: reservation.orgId,
        unitId: idOf(reservation.unitId),
        facilityId: idOf(reservation.facilityId),
        requestedUnits,
        date: reservation.requestedStartDateTime,
      },
      session
    );
  }

  /** One worker pass. */
  async runOnce(now = new Date()) {
    const expired = await this.expireStaleApprovals(50, now);
    const flagged = await this.flagForReview(50, now);
    const completed = await this.autoComplete(50, now);
    return { expired, flagged, completed };
  }
}

export const amenityReservationLifecycleService = new AmenityReservationLifecycleService();
export default amenityReservationLifecycleService;

void mongoose;
