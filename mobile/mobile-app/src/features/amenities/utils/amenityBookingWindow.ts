/**
 * Booking-window helpers for the resident wizard. The server offers the start of each
 * bookable window (slot, session, full day, overnight check-in or loan pickup); these
 * helpers extend it for multi-night stays and multi-day loans.
 */
import { AmenityFacility } from '../types/amenityDomain.types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const isOvernightFacility = (facility: Pick<AmenityFacility, 'archetype' | 'stayMode'>) =>
  facility.archetype === 'ROOM_RESOURCE' && facility.stayMode === 'OVERNIGHT';

export const isLoanFacility = (facility: Pick<AmenityFacility, 'archetype'>) => facility.archetype === 'INVENTORY_TOOLS';

/** Whole extra days a loan may run (0 = return the same day). */
export const maxLoanDays = (facility: Pick<AmenityFacility, 'maxLoanHours'>) =>
  Math.max(0, Math.floor((Number(facility.maxLoanHours) || 24) / 24));

export const maxStayNights = (facility: Pick<AmenityFacility, 'maxNights'>) => Math.max(1, Number(facility.maxNights) || 1);

/**
 * End of the requested window (UTC ISO).
 *  - overnight stay: the offered window is one night; each extra night adds a day
 *  - loan: `loanDays` 0 keeps the offered same-day return; otherwise return at the
 *    pickup time `loanDays` later (within the loan limit)
 *  - everything else: the offered window as-is
 */
export const bookingWindowEnd = (
  facility: Pick<AmenityFacility, 'archetype' | 'stayMode' | 'maxLoanHours' | 'maxNights'>,
  slot: { startUtc: string; endUtc: string },
  { nights = 1, loanDays = 0 }: { nights?: number; loanDays?: number } = {}
): string => {
  if (isOvernightFacility(facility)) {
    const extra = Math.min(maxStayNights(facility), Math.max(1, nights)) - 1;
    return new Date(new Date(slot.endUtc).getTime() + extra * DAY_MS).toISOString();
  }
  if (isLoanFacility(facility) && loanDays > 0) {
    const days = Math.min(maxLoanDays(facility), loanDays);
    return new Date(new Date(slot.startUtc).getTime() + days * DAY_MS).toISOString();
  }
  return slot.endUtc;
};
