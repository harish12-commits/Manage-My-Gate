import mongoose from 'mongoose';
import HttpError from '../../../utils/httpError.utils.js';
import logger from '../../../utils/logger.utils.js';
import Payment from '../../payment/payment.model.js';
import walletService from '../../wallet/wallet.service.js';
import amenityReservationRepository from '../reservations/amenityReservation.repository.js';
import amenityReservationHoldRepository from '../holds/amenityReservationHold.repository.js';
import { paymentStatusFor } from '../domain/payments/amountSchedule.js';

/** Time a resident has to finish online checkout once the order is created. */
const CHECKOUT_WINDOW_MS = 15 * 60 * 1000;

const idOf = (ref) => (ref && typeof ref === 'object' && ref._id ? ref._id : ref);
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Amenity side of the unified payment flow.
 *
 * Every amenity payment (wallet, Razorpay, gate cash) is a Payment record in the
 * AMENITY domain, settled through paymentSettlementService.settlePayment so the
 * double-entry ledger is written in the same transaction. The settlement handler
 * calls back into this service to apply the payment to the booking.
 */
export class AmenityPaymentService {
  /** Total the resident owes for a reservation (price + deposit). */
  totalDueOf(reservation) {
    const s = reservation.amountSchedule;
    if (s && (s.priceAmount || s.depositAmount)) return round2(Number(s.priceAmount) + Number(s.depositAmount));
    return round2(reservation.totalAmount);
  }

  /**
   * Authoritative payable amount for an amenity payment order (used by the unified
   * payment core before creating a gateway order). Returns null for references that
   * are not V2 amenity holds/reservations.
   */
  async resolvePayable(referenceId, { orgId, userId, amount } = {}, session = null) {
    const hold = await amenityReservationHoldRepository.findById(referenceId, null, session);
    if (hold) {
      if (orgId && String(hold.orgId) !== String(orgId)) {
        throw new HttpError(403, 'Cross-tenant payment forbidden: reservation hold belongs to a different community.');
      }
      if (userId && String(hold.residentId) !== String(userId) && String(hold.bookedBy || '') !== String(userId)) {
        throw new HttpError(403, 'Forbidden. This reservation hold belongs to another resident.');
      }
      if (hold.status !== 'ACTIVE' || new Date(hold.expiresAt) <= new Date()) {
        throw new HttpError(400, 'Reservation hold has expired.');
      }
      const due = round2(hold.amountSchedule?.dueNowAmount ?? hold.pricingSnapshot?.totalAmount ?? 0);
      if (amount !== undefined && Math.abs(Number(amount) - due) > 0.01) {
        throw new HttpError(400, `Requested payment amount (₹${amount}) does not match the amount due now of ₹${due}.`);
      }
      return { isValid: true, payableAmount: due, entity: hold };
    }

    const reservation = await amenityReservationRepository.findById(referenceId, null, session);
    if (reservation) {
      if (orgId && String(reservation.orgId) !== String(orgId)) {
        throw new HttpError(403, 'Cross-tenant payment forbidden: reservation belongs to a different community.');
      }
      if (!['CONFIRMED', 'PENDING_APPROVAL'].includes(reservation.bookingStatus)) {
        throw new HttpError(400, 'This booking is no longer active.');
      }
      const due = round2(reservation.balanceAmount);
      if (due <= 0) throw new HttpError(400, 'Nothing is left to pay on this booking.');
      if (amount !== undefined && Math.abs(Number(amount) - due) > 0.01) {
        throw new HttpError(400, `Requested payment amount (₹${amount}) does not match the balance of ₹${due}.`);
      }
      return { isValid: true, payableAmount: due, entity: reservation };
    }
    return null;
  }

  /**
   * Records a settled payment on the reservation: appends it to the payment list and
   * recomputes paid amount, balance and payment status. Idempotent per Payment.
   */
  async applySettledPayment(reservationId, payment, session) {
    const reservation = await amenityReservationRepository.findById(reservationId, null, session);
    if (!reservation) throw new HttpError(404, 'Reservation not found for settled payment');
    if ((reservation.payments || []).some((p) => String(p.paymentId) === String(payment._id))) {
      return reservation;
    }

    const method = String(payment.paymentMethod || '').toUpperCase() === 'CASH'
      ? 'CASH'
      : String(payment.paymentMethod || '').toUpperCase() === 'WALLET'
        ? 'WALLET'
        : 'RAZORPAY';
    const purpose =
      payment.metadata?.purpose === 'BALANCE' ||
      (!payment.metadata?.purpose && payment.referenceType === 'AmenityReservation')
        ? 'BALANCE'
        : 'BOOKING';
    const paid = round2(Number(reservation.paidAmount || 0) + Number(payment.amount));
    const totalDue = this.totalDueOf(reservation);

    const Reservation = mongoose.model('AmenityReservation');
    const updated = await Reservation.findOneAndUpdate(
      { _id: reservation._id },
      {
        $set: {
          paidAmount: paid,
          balanceAmount: Math.max(0, round2(totalDue - paid)),
          paymentStatus: paymentStatusFor({ totalDue, paid }),
          ...(reservation.paymentMethod === 'NONE' || !reservation.paymentMethod ? { paymentMethod: method } : {}),
          ...(purpose === 'BOOKING' && payment._id ? { paymentId: payment._id } : {}),
        },
        $push: {
          payments: {
            paymentId: payment._id,
            purpose,
            method,
            amount: round2(payment.amount),
            receiptNumber: payment.receiptNumber || null,
            receivedBy: payment.receivedBy || null,
            paidAt: new Date(),
          },
        },
      },
      { returnDocument: 'after', session: session || undefined }
    );
    return updated;
  }

  /**
   * Pays `amount` for `reservation` from the resident's digital wallet, through the
   * unified settlement (Payment record + wallet debit + ledger, one transaction).
   */
  async payFromWallet({ reservation, amount, purpose = 'BOOKING', userId, idempotencyKey }, session) {
    const value = round2(amount);
    if (value <= 0) return reservation;
    const payerId = idOf(userId || reservation.residentId);
    const key = idempotencyKey || `AMR-WLT-${purpose}-${reservation._id}`;

    const existing = await Payment.findOne({ idempotencyKey: key }).session(session || null);
    if (existing?.status === 'success') return this.applySettledPayment(reservation._id, existing, session);

    const [payment] = existing
      ? [existing]
      : await Payment.create(
          [
            {
              orgId: reservation.orgId,
              userId: payerId,
              referenceId: reservation._id,
              referenceType: 'AmenityReservation',
              amount: value,
              currency: 'INR',
              status: 'pending',
              paymentCategory: 'OFFLINE',
              paymentMethod: 'WALLET',
              gateway: 'offline',
              domain: 'AMENITY',
              idempotencyKey: key,
              metadata: { purpose, reservationNumber: reservation.reservationNumber },
            },
          ],
          { session: session || undefined }
        );

    await walletService.debitWallet({
      userId: payerId,
      orgId: reservation.orgId,
      amount: value,
      referenceType: 'AmenityBooking',
      referenceId: reservation._id,
      paymentId: payment._id,
      idempotencyKey: `${key}:DEBIT`,
      description: `Amenity booking #${reservation.reservationNumber}${purpose === 'BALANCE' ? ' (balance)' : ''}`,
      skipLedger: true,
      session,
    });

    const settlement = (await import('../../payment/paymentSettlement.service.js')).default;
    await settlement.settlePayment({ paymentId: payment._id, paymentMethod: 'WALLET', session });
    return amenityReservationRepository.findById(reservation._id, null, session);
  }

  /**
   * Gate staff collect the outstanding balance in cash. Recorded with a receipt and
   * the collector, and settled through the ledger (cash clearing → amenity revenue).
   */
  async collectCash({ reservation, amount, collectedBy }, session) {
    const due = round2(reservation.balanceAmount);
    if (due <= 0) throw new HttpError(400, 'Nothing is left to collect on this booking.');
    if (Math.abs(round2(amount) - due) > 0.01) {
      throw new HttpError(400, `Collect exactly the balance due (₹${due}).`);
    }
    const n = (reservation.payments || []).length + 1;
    const receiptNumber = `AMN-${String(reservation.orgId).slice(-6).toUpperCase()}-${reservation.reservationNumber}-${n}`;

    const [payment] = await Payment.create(
      [
        {
          orgId: reservation.orgId,
          userId: idOf(reservation.residentId),
          referenceId: reservation._id,
          referenceType: 'AmenityReservation',
          amount: due,
          currency: 'INR',
          status: 'pending',
          paymentCategory: 'OFFLINE',
          paymentMethod: 'CASH',
          gateway: 'offline',
          domain: 'AMENITY',
          receivedBy: collectedBy,
          processedBy: collectedBy,
          receiptNumber,
          idempotencyKey: `AMR-CASH-${reservation._id}-${n}`,
          metadata: { purpose: 'BALANCE', reservationNumber: reservation.reservationNumber },
        },
      ],
      { session: session || undefined }
    );

    const settlement = (await import('../../payment/paymentSettlement.service.js')).default;
    await settlement.settlePayment({ paymentId: payment._id, paymentMethod: 'CASH', session });
    return { reservation: await amenityReservationRepository.findById(reservation._id, null, session), receiptNumber };
  }

  /**
   * Settlement for a gateway payment made against a hold (booking payment). Creates
   * the reservation inside the settlement transaction. When the hold can no longer
   * be honoured (expired and its time taken), returns UNFULFILLED so the captured
   * money is sent back to its source after commit.
   */
  async settleHoldPayment(payment, session) {
    const hold = await amenityReservationHoldRepository.findById(payment.referenceId, null, session);
    if (hold?.reservationId) {
      await this.applySettledPayment(hold.reservationId, payment, session);
      return { status: 'CONFIRMED', reservationId: hold.reservationId };
    }
    const reservationService = (await import('../reservations/amenityReservation.service.js')).default;
    if (hold && hold.status === 'ACTIVE') {
      const result = await reservationService.confirmFromGatewayPayment({ hold, payment }, session);
      return { status: 'CONFIRMED', reservationId: result.reservation._id };
    }
    logger.warn('[AmenityPayment] Captured payment for a hold that can no longer be booked', {
      paymentId: payment._id,
      holdId: payment.referenceId,
      holdStatus: hold?.status || 'MISSING',
    });
    return { status: 'UNFULFILLED', reason: 'Booking window expired before payment completed' };
  }

  /**
   * Creates (or resumes) the Razorpay order for the amount due now on a hold, or for
   * the outstanding balance of a reservation. The hold is extended to cover checkout so
   * it cannot expire while the resident is paying.
   *
   * @returns {Promise<Object>} checkout details (+ holdExpiresAt for hold orders)
   */
  async createGatewayOrder({ orgId, userId, holdId, reservation }) {
    const paymentService = (await import('../../payment/payment.service.js')).default;
    let referenceId;
    let referenceType;
    let amount;
    let holdExpiresAt = null;

    if (holdId) {
      const hold = await amenityReservationHoldRepository.findActiveById(holdId, null, null);
      if (
        !hold ||
        String(hold.orgId) !== String(orgId) ||
        (String(hold.residentId) !== String(userId) && String(hold.bookedBy || '') !== String(userId))
      ) {
        throw new HttpError(404, 'Active reservation hold not found');
      }
      amount = round2(hold.amountSchedule?.dueNowAmount ?? hold.pricingSnapshot?.totalAmount ?? 0);
      if (amount <= 0) throw new HttpError(400, 'Nothing is due online for this booking');

      holdExpiresAt = new Date(Math.max(new Date(hold.expiresAt).getTime(), Date.now() + CHECKOUT_WINDOW_MS));
      const Hold = mongoose.model('AmenityReservationHold');
      await Hold.updateOne({ _id: hold._id, status: 'ACTIVE' }, { $set: { expiresAt: holdExpiresAt, holdType: 'PAYMENT_PENDING' } });
      referenceId = hold._id;
      referenceType = 'AmenityReservationHold';
    } else {
      amount = round2(reservation.balanceAmount);
      if (amount <= 0) throw new HttpError(400, 'Nothing is left to pay on this booking');
      if (!['CONFIRMED', 'PENDING_APPROVAL'].includes(reservation.bookingStatus)) {
        throw new HttpError(400, 'This booking is no longer active');
      }
      referenceId = reservation._id;
      referenceType = 'AmenityReservation';
    }

    // Resume only this reference's gateway order (a booking may also carry wallet/cash payments).
    const existing = await Payment.findOne({
      orgId,
      userId,
      referenceId,
      referenceType,
      gateway: 'razorpay',
      status: { $in: ['pending', 'success'] },
      ...(referenceType === 'AmenityReservation' ? { amount } : {}),
    }).sort({ createdAt: -1 });

    if (existing?.status === 'success') {
      return { paymentId: existing._id, alreadyVerified: true, holdExpiresAt };
    }
    const order =
      existing && Math.abs(Number(existing.amount) - amount) < 0.01
        ? await paymentService.getCheckoutDetails(existing)
        : await paymentService.createPaymentOrder({
            orgId,
            userId,
            referenceId,
            referenceType,
            amount,
            currency: 'INR',
            gateway: 'razorpay',
          });
    return { ...order, holdExpiresAt };
  }

  /**
   * Verifies the gateway's signed response and settles it (creating the booking for a
   * hold payment). Returns the booking the payment went to, if any.
   */
  async verifyGatewayPayment({ orgId, userId, paymentId, orderId, razorpayPaymentId, razorpaySignature }) {
    const paymentService = (await import('../../payment/payment.service.js')).default;
    const payment = await paymentService.assertPaymentAccess(paymentId, { orgId, userId });
    if (!['AmenityReservationHold', 'AmenityReservation'].includes(payment.referenceType) || payment.gateway !== 'razorpay') {
      throw new HttpError(400, 'Payment is not an amenity Razorpay payment');
    }
    const result = await paymentService.verifyPaymentSignature({
      orgId,
      paymentId,
      orderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    let reservationId = null;
    if (payment.referenceType === 'AmenityReservation') reservationId = payment.referenceId;
    else {
      const hold = await amenityReservationHoldRepository.findById(payment.referenceId, null, null);
      reservationId = hold?.reservationId || null;
    }
    const reservation = reservationId ? await amenityReservationRepository.findById(reservationId, null, null) : null;
    const verified = result.payment?.toObject ? result.payment.toObject() : result.payment;
    return {
      payment: verified,
      paymentId: verified?._id,
      reservation,
      fulfilled: Boolean(reservation),
    };
  }

  /**
   * Returns money to the resident's digital wallet (idempotent per reservation and
   * reason) with a ledger entry (revenue adjustment → resident wallet).
   */
  async refundToWallet({ reservation, amount, reason, key = 'CANCEL' }, session) {
    const value = round2(amount);
    if (value <= 0) return null;
    return walletService.creditWallet({
      userId: idOf(reservation.residentId),
      orgId: reservation.orgId,
      amount: value,
      referenceType: 'Refund',
      referenceId: reservation._id,
      idempotencyKey: `AMR-REFUND-${key}-${reservation._id}`,
      paymentMethod: 'WALLET',
      description: reason || `Refund for amenity booking #${reservation.reservationNumber}`,
      session,
    });
  }
}

export const amenityPaymentService = new AmenityPaymentService();
export default amenityPaymentService;
