/**
 * Cancellation refunds for amenity reservations.
 *
 * A reservation carries a snapshot of its facility's cancellation policy taken when it
 * was confirmed, so later facility edits never change an existing booking's terms.
 * Refunds are computed in paise and never exceed what was actually paid.
 */

const HOUR_MS = 3600000;

/** Policy terms frozen onto a reservation at confirmation. */
export const snapshotCancellationPolicy = (facility) => {
  const p = facility?.cancellationPolicy || {};
  return {
    isAllowed: p.isAllowed !== false,
    refundCutoffHours: Number.isFinite(Number(p.refundCutoffHours)) ? Number(p.refundCutoffHours) : 24,
    refundPercentage: Number.isFinite(Number(p.refundPercentage))
      ? Math.min(100, Math.max(0, Number(p.refundPercentage)))
      : 100,
  };
};

/**
 * Why a resident may not cancel this reservation right now, or null when they may.
 * Management cancellations (admin, maintenance, facility deactivation) skip the policy
 * gate but still cannot cancel something already used.
 */
export const cancellationBlockReason = (reservation, { isManagement = false, now = new Date() } = {}) => {
  if (['CHECKED_IN', 'CHECKED_OUT'].includes(reservation.accessStatus)) {
    return 'This booking has already been used and can no longer be cancelled';
  }
  if (reservation.completionStatus && reservation.completionStatus !== 'PENDING') {
    return 'This booking is already closed';
  }
  if (!isManagement && new Date(reservation.requestedStartDateTime).getTime() <= now.getTime()) {
    return 'This booking has already started and can no longer be cancelled';
  }
  const policy = reservation.policySnapshot?.cancellation;
  if (!isManagement && reservation.bookingStatus === 'CONFIRMED' && policy && policy.isAllowed === false) {
    return 'This facility does not allow residents to cancel bookings';
  }
  return null;
};

const toPaise = (rupees) => Math.round(Number(rupees || 0) * 100);
const toRupees = (paise) => Math.round(paise) / 100;

/**
 * Refund for cancelling `reservation` now.
 *
 * - Management cancellations and bookings still awaiting approval: 100%.
 * - Otherwise the snapshot policy: cancelling at least `refundCutoffHours` before the
 *   start refunds `refundPercentage` of the booking amount; later refunds nothing.
 * - A refundable security deposit is always returned in full (the facility was not used).
 *
 * @returns {{ percentage: number, bookingRefund: number, depositRefund: number, total: number, reason: string }}
 */
export const computeCancellationRefund = (reservation, { isManagement = false, now = new Date() } = {}) => {
  const paidPaise = toPaise(reservation.paidAmount);
  const depositPaise = Math.min(paidPaise, toPaise(reservation.depositAmount || reservation.pricingSnapshot?.depositAmount));
  const bookingPaise = paidPaise - depositPaise;

  let percentage;
  let reason;
  if (isManagement) {
    percentage = 100;
    reason = 'Cancelled by management';
  } else if (reservation.bookingStatus === 'PENDING_APPROVAL') {
    percentage = 100;
    reason = 'Cancelled before approval';
  } else {
    const policy = reservation.policySnapshot?.cancellation || { refundCutoffHours: 24, refundPercentage: 100 };
    const hoursToStart = (new Date(reservation.requestedStartDateTime).getTime() - now.getTime()) / HOUR_MS;
    const inWindow = hoursToStart >= Number(policy.refundCutoffHours || 0);
    percentage = inWindow ? Number(policy.refundPercentage) : 0;
    reason = inWindow
      ? `Cancelled at least ${policy.refundCutoffHours}h before start`
      : `Cancelled within ${policy.refundCutoffHours}h of start`;
  }

  const bookingRefundPaise = Math.floor((bookingPaise * percentage) / 100);
  return {
    percentage,
    bookingRefund: toRupees(bookingRefundPaise),
    depositRefund: toRupees(depositPaise),
    total: toRupees(bookingRefundPaise + depositPaise),
    reason,
  };
};
