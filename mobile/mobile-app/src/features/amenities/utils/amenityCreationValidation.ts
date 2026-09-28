/**
 * Validation for the facility creation wizard. One pure function per step, used both
 * when moving to the next step and before publishing (so the two can never disagree).
 */

import type { AmenityCreationFormState } from './mapAmenityCreationPayloadStrategy';

const HHMM = /^([01]\d|2[0-3]):?([0-5]\d)$/;
const minutesOf = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const num = (v: unknown) => (String(v ?? '').trim() === '' ? NaN : Number(v));

/** Errors for one wizard step (empty when the step is valid). */
export function stepErrorsFor(stepKey: string, form: AmenityCreationFormState): Record<string, string> {
  const errors: Record<string, string> = {};

  switch (stepKey) {
    case 'info':
      if (!form.name.trim()) errors.name = 'Facility name is required';
      if (!form.code.trim()) errors.code = 'Facility code is required';
      if (!form.location.trim()) errors.location = 'Location / Zone is required to publish';
      break;

    case 'schedule':
      if (!form.openTime.trim()) errors.openTime = 'Open time is required';
      else if (!HHMM.test(form.openTime)) errors.openTime = 'Invalid time format (HH:MM)';
      if (!form.closeTime.trim()) errors.closeTime = 'Close time is required';
      else if (!HHMM.test(form.closeTime)) errors.closeTime = 'Invalid time format (HH:MM)';
      if (!errors.openTime && !errors.closeTime && minutesOf(form.openTime) >= minutesOf(form.closeTime)) {
        errors.closeTime = 'Closing time must be after opening time';
      }
      if (!form.openDays || form.openDays.length === 0) errors.openDays = 'Please select at least 1 active day';
      break;

    case 'capacity-rules':
      if (!(num(form.maxCapacity) >= 1)) errors.maxCapacity = 'Capacity must be at least 1';
      if (num(form.maxHeadcountPerReservation) < 1) errors.maxHeadcountPerReservation = 'Quota must be at least 1';
      else if (num(form.maxHeadcountPerReservation) > num(form.maxCapacity || 50)) {
        errors.maxHeadcountPerReservation = 'Quota cannot exceed total capacity';
      }
      break;

    case 'court-slots':
      if (!(num(form.slotDurationMinutes) >= 15)) errors.slotDurationMinutes = 'Slot duration must be at least 15 minutes';
      if (!(num(form.advanceBookingDays) >= 1)) errors.advanceBookingDays = 'Advance booking window must be at least 1 day';
      break;

    case 'event-rules':
      if (!(num(form.maxCapacity) >= 1)) errors.maxCapacity = 'Hall capacity must be at least 1';
      if (num(form.advanceNoticeHours) < 0) errors.advanceNoticeHours = 'Advance notice cannot be negative';
      if (form.bookingMode === 'SESSION') {
        const sessions = form.sessions || [];
        if (sessions.length === 0) errors.sessions = 'Add at least one session';
        else if (sessions.some((s) => !s.name.trim())) errors.sessions = 'Every session needs a name';
        else if (sessions.some((s) => !HHMM.test(s.startTime) || !HHMM.test(s.endTime))) {
          errors.sessions = 'Session times must be HH:MM';
        } else if (sessions.some((s) => minutesOf(s.startTime) >= minutesOf(s.endTime))) {
          errors.sessions = 'Each session must end after it starts';
        } else if (sessions.some((s) => String(s.price ?? '').trim() !== '' && !(num(s.price) >= 0))) {
          errors.sessions = 'Session prices cannot be negative';
        }
      }
      if (form.bookingMode === 'HOURLY' && !(num(form.slotDurationMinutes) >= 15)) {
        errors.slotDurationMinutes = 'Slot duration must be at least 15 minutes';
      }
      break;

    case 'room-setup':
      if (form.stayMode === 'OVERNIGHT') {
        if (!HHMM.test(form.checkInTime || '')) errors.checkInTime = 'Check-in must be HH:MM';
        if (!HHMM.test(form.checkOutTime || '')) errors.checkOutTime = 'Check-out must be HH:MM';
        if (!(num(form.maxNights) >= 1)) errors.maxNights = 'At least 1 night';
      } else if (!(num(form.slotDurationMinutes) >= 15)) {
        errors.slotDurationMinutes = 'Slot duration must be at least 15 minutes';
      }
      if (form.isMultiResourceFacility && (!form.subRooms || form.subRooms.length === 0)) {
        errors.subRooms = 'At least one sub-room must be configured';
      }
      break;

    case 'inventory-stock':
      if (!(num(form.availableStock) >= 1)) errors.availableStock = 'Stock units must be at least 1';
      if (!(num(form.maxLoanHours) >= 1)) errors.maxLoanHours = 'Loan duration must be at least 1 hour';
      break;

    case 'pricing': {
      // Sessions carry their own prices; the base rate only covers sessions left blank.
      const sessionPriced =
        form.archetype === 'EVENT_SPACE' &&
        form.bookingMode === 'SESSION' &&
        (form.sessions || []).length > 0 &&
        (form.sessions || []).every((s) => String(s.price ?? '').trim() !== '');
      if (form.pricingType !== 'FREE' && !sessionPriced && !(num(form.baseRate) > 0)) {
        errors.baseRate = 'Rate is required and must be greater than 0';
      }
      if (String(form.securityDeposit ?? '').trim() !== '' && !(num(form.securityDeposit) >= 0)) {
        errors.securityDeposit = 'Security deposit cannot be negative';
      }
      if (form.pricingType !== 'FREE' && form.paymentMode === 'ADVANCE') {
        const v = num(form.advanceValue);
        if (!(v > 0)) errors.advanceValue = 'Enter the advance';
        else if (form.advanceType !== 'FIXED' && v >= 100) errors.advanceValue = 'An advance is less than 100%';
      }
      if (num(form.refundPercentage) < 0 || num(form.refundPercentage) > 100) {
        errors.refundPercentage = 'Refund must be 0–100%';
      }
      break;
    }

    default:
      break;
  }

  return errors;
}

/** First step (in wizard order) with errors, for the publish check. */
export function firstInvalidStep(
  stepKeys: string[],
  form: AmenityCreationFormState
): { index: number; errors: Record<string, string> } | null {
  for (let i = 0; i < stepKeys.length; i++) {
    const errors = stepErrorsFor(stepKeys[i], form);
    if (Object.keys(errors).length > 0) return { index: i, errors };
  }
  return null;
}
