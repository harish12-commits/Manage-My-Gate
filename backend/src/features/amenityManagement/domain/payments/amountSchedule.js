/**
 * What a resident pays, and when, for an amenity booking.
 *
 * Amenities never take free-form partial payments (unlike invoices): the facility's
 * payment policy fixes the amounts.
 *   FULL        — the whole price is paid when booking.
 *   ADVANCE     — a fixed ₹ or % advance is paid when booking; the balance is paid
 *                 online before the slot or collected at the gate.
 *   PAY_AT_GATE — nothing is paid online for the price; it is collected at the gate.
 * A refundable security deposit is always collected with the booking payment.
 */

export const PAYMENT_MODES = Object.freeze(['FULL', 'ADVANCE', 'PAY_AT_GATE']);
export const ADVANCE_TYPES = Object.freeze(['FIXED', 'PERCENT']);

const toPaise = (rupees) => Math.round(Number(rupees || 0) * 100);
const toRupees = (paise) => Math.round(paise) / 100;

/** Normalized payment policy of a facility (defaults to FULL). */
export const paymentPolicyOf = (facility) => {
  const p = facility?.paymentPolicy || {};
  const mode = PAYMENT_MODES.includes(p.mode) ? p.mode : 'FULL';
  return {
    mode,
    advanceType: ADVANCE_TYPES.includes(p.advanceType) ? p.advanceType : 'PERCENT',
    advanceValue: Math.max(0, Number(p.advanceValue) || 0),
  };
};

/**
 * @param {Object} facility
 * @param {{ baseAmount: number, taxAmount: number, depositAmount: number, totalAmount: number }} pricing
 * @returns {{ mode: string, priceAmount: number, depositAmount: number, advanceAmount: number,
 *            dueNowAmount: number, balanceAmount: number }}
 */
export const computeAmountSchedule = (facility, pricing) => {
  const policy = paymentPolicyOf(facility);
  const pricePaise = toPaise(pricing?.baseAmount) + toPaise(pricing?.taxAmount);
  const depositPaise = toPaise(pricing?.depositAmount);

  let advancePaise;
  if (policy.mode === 'FULL') advancePaise = pricePaise;
  else if (policy.mode === 'PAY_AT_GATE') advancePaise = 0;
  else if (policy.advanceType === 'FIXED') advancePaise = Math.min(pricePaise, toPaise(policy.advanceValue));
  else advancePaise = Math.min(pricePaise, Math.round((pricePaise * Math.min(100, policy.advanceValue)) / 100));

  return {
    mode: policy.mode,
    priceAmount: toRupees(pricePaise),
    depositAmount: toRupees(depositPaise),
    advanceAmount: toRupees(advancePaise),
    dueNowAmount: toRupees(advancePaise + depositPaise),
    balanceAmount: toRupees(pricePaise - advancePaise),
  };
};

/** Payment status of a reservation from what has been paid against its schedule. */
export const paymentStatusFor = ({ totalDue, paid }) => {
  const duePaise = toPaise(totalDue);
  const paidPaise = toPaise(paid);
  if (duePaise <= 0) return 'NOT_REQUIRED';
  if (paidPaise <= 0) return 'PENDING';
  if (paidPaise < duePaise) return 'ADVANCE_PAID';
  return 'PAID';
};
