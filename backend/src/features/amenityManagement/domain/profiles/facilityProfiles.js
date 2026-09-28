import moment from 'moment-timezone';

/**
 * Archetype profiles: the single place that defines how each facility type is booked.
 *
 * Every archetype answers the same questions:
 *   - which windows are bookable (booking rules, evaluated in the facility timezone)
 *   - how many "units" a booking consumes and how many units the facility/resource has
 *   - how the base price is computed
 *   - which candidate windows a day offers (daily slot listing)
 *
 * Availability is uniform on top of this: the units consumed by overlapping active
 * holds and reservations plus the request must fit the capacity. Concurrency is
 * guarded by the facility mutex inside the hold transaction.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const EVENT_BOOKING_MODES = Object.freeze(['FULL_DAY', 'SESSION', 'HOURLY']);
export const ROOM_STAY_MODES = Object.freeze(['HOURLY', 'OVERNIGHT']);

const PAST_GRACE_MS = 2 * 60 * 1000;
const HOUR_MS = 3600000;

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const tzOf = (facility) => facility.timezone || DEFAULT_TIMEZONE;
const local = (facility, date) => moment(date).tz(tzOf(facility));
const minutesOfDay = (m) => m.hour() * 60 + m.minute();
const atLocal = (facility, dateStr, minutes) =>
  moment.tz(dateStr, 'YYYY-MM-DD', tzOf(facility)).startOf('day').add(minutes, 'minutes').toDate();

/** Opening window of the facility on the local day of `m`, or null when closed. */
const openWindow = (facility, m) => {
  const rule = (facility.operatingHours || []).find((h) => h.dayOfWeek === m.day());
  if (!rule || rule.isOpen === false) return null;
  return { open: toMinutes(rule.openTime || rule.opensAt), close: toMinutes(rule.closeTime || rule.closesAt) };
};

export const eventBookingMode = (facility) =>
  EVENT_BOOKING_MODES.includes(facility.bookingMode) ? facility.bookingMode : 'FULL_DAY';

export const roomStayMode = (facility) =>
  ROOM_STAY_MODES.includes(facility.stayMode) ? facility.stayMode : 'HOURLY';

const slotMinutes = (facility) => Math.max(15, Number(facility.slotDurationMinutes) || 60);

/** Turnaround buffer between exclusive bookings (courts, venues, rooms). */
const turnaroundMinutes = (facility) =>
  ['EXCLUSIVE_HOURLY', 'EVENT_SPACE', 'ROOM_RESOURCE'].includes(facility.archetype)
    ? Math.max(0, Number(facility.setupBufferMinutes) || 0)
    : 0;

/** Slot starts are spaced by the slot length plus the turnaround buffer. */
const gridStep = (facility) => slotMinutes(facility) + turnaroundMinutes(facility);

// ─── Window rules ────────────────────────────────────────────────────────────

const sameOpenDay = (facility, start, end) => {
  const ms = local(facility, start);
  const me = local(facility, end);
  const win = openWindow(facility, ms);
  if (!win) return { error: 'Facility is closed on this day' };
  const endsNextDayAtMidnight = me.format('YYYY-MM-DD') !== ms.format('YYYY-MM-DD') && minutesOfDay(me) === 0;
  if (me.format('YYYY-MM-DD') !== ms.format('YYYY-MM-DD') && !endsNextDayAtMidnight) {
    return { error: 'Booking must start and end on the same day' };
  }
  const s = minutesOfDay(ms);
  const e = endsNextDayAtMidnight ? 24 * 60 : minutesOfDay(me);
  if (s < win.open || e > win.close) {
    return { error: 'Requested time is outside facility operating hours' };
  }
  return { win, s, e, dateStr: ms.format('YYYY-MM-DD') };
};

const onGrid = (facility, start, end) => {
  const day = sameOpenDay(facility, start, end);
  if (day.error) return day.error;
  const slot = slotMinutes(facility);
  const step = gridStep(facility);
  if ((day.s - day.win.open) % step !== 0) {
    return 'Bookings must start at one of the published slot times';
  }
  if ((day.e - day.s) % slot !== 0) return `Booking length must be a multiple of ${slot} minutes`;
  return null;
};

const withinOpenHours = (facility, date) => {
  const m = local(facility, date);
  const win = openWindow(facility, m);
  if (!win) return false;
  const t = minutesOfDay(m);
  return t >= win.open && t <= win.close;
};

const eventWindowError = (facility, start, end) => {
  const mode = eventBookingMode(facility);
  const day = sameOpenDay(facility, start, end);
  if (day.error) return day.error;
  if (mode === 'FULL_DAY') {
    return day.s === day.win.open && day.e === day.win.close
      ? null
      : 'This venue is booked for the full day only';
  }
  if (mode === 'SESSION') {
    const match = (facility.sessions || []).some(
      (s) => toMinutes(s.startTime) === day.s && toMinutes(s.endTime) === day.e
    );
    return match ? null : 'Please choose one of the published sessions';
  }
  return onGrid(facility, start, end);
};

const overnightNights = (facility, start, end) => {
  const ms = local(facility, start);
  const me = local(facility, end);
  return me.clone().startOf('day').diff(ms.clone().startOf('day'), 'days');
};

const roomWindowError = (facility, start, end) => {
  if (roomStayMode(facility) === 'HOURLY') return onGrid(facility, start, end);
  const ms = local(facility, start);
  const me = local(facility, end);
  if (!openWindow(facility, ms)) return 'Check-in is not available on this day';
  if (minutesOfDay(ms) !== toMinutes(facility.checkInTime || '14:00')) {
    return `Check-in time is ${facility.checkInTime || '14:00'}`;
  }
  if (minutesOfDay(me) !== toMinutes(facility.checkOutTime || '11:00')) {
    return `Check-out time is ${facility.checkOutTime || '11:00'}`;
  }
  const nights = overnightNights(facility, start, end);
  const maxNights = Math.max(1, Number(facility.maxNights) || 7);
  if (nights < 1) return 'A stay must be at least one night';
  if (nights > maxNights) return `A stay can be at most ${maxNights} night(s)`;
  return null;
};

const loanWindowError = (facility, start, end) => {
  if (!withinOpenHours(facility, start)) return 'Pickup must be during opening hours on an open day';
  if (!withinOpenHours(facility, end)) return 'Return must be during opening hours on an open day';
  const maxLoanHours = Math.max(1, Number(facility.maxLoanHours) || 24);
  if (end.getTime() - start.getTime() > maxLoanHours * HOUR_MS) {
    return `Items can be borrowed for at most ${maxLoanHours} hour(s)`;
  }
  return null;
};

// ─── Profiles ────────────────────────────────────────────────────────────────

const hours = (start, end) => (end.getTime() - start.getTime()) / HOUR_MS;
const days = (start, end) => Math.max(1, Math.ceil(hours(start, end) / 24));

const baseByType = ({ pricingType, rate, start, end, multiplier = 1, fixedUnits = 1 }) => {
  switch (pricingType) {
    case 'FREE':
      return 0;
    case 'DAILY':
      return days(start, end) * rate * multiplier;
    case 'FIXED_EVENT':
      return rate * multiplier * fixedUnits;
    case 'HOURLY':
    case 'TIERED':
    default:
      return hours(start, end) * rate * multiplier;
  }
};

const PROFILES = {
  SHARED_CAPACITY: {
    requiresResource: false,
    unitsOf: (b) => Math.max(1, Number(b.headcount) || 1),
    capacity: ({ facility }) => Math.max(0, Number(facility.maxCapacity) || 1),
    windowError: onGrid,
    headcountError: (facility, { headcount }) => {
      const perBooking = Number(facility.maxHeadcountPerReservation) || 0;
      if (perBooking && headcount > perBooking) return `At most ${perBooking} person(s) per booking`;
      return null;
    },
    // Pooled access is priced per person.
    base: (ctx) => baseByType({ ...ctx, multiplier: ctx.headcount }),
    bufferMinutes: () => 0,
  },

  EXCLUSIVE_HOURLY: {
    requiresResource: false,
    unitsOf: () => 1,
    capacity: () => 1,
    windowError: onGrid,
    headcountError: (facility, { headcount }) => {
      const players = Number(facility.maxHeadcountPerReservation) || 0;
      if (players && headcount > players) return `At most ${players} player(s) per booking`;
      return null;
    },
    // The whole court is booked: players never multiply the price.
    base: (ctx) => baseByType(ctx),
    bufferMinutes: turnaroundMinutes,
  },

  EVENT_SPACE: {
    requiresResource: false,
    unitsOf: () => 1,
    capacity: () => 1,
    windowError: eventWindowError,
    headcountError: (facility, { headcount }) => {
      const cap = Number(facility.maxCapacity) || 0;
      if (cap && headcount > cap) return `This venue holds at most ${cap} guest(s)`;
      return null;
    },
    // Flat per venue booking: a published session price wins, guests never multiply it.
    base: (ctx) => {
      if (eventBookingMode(ctx.facility) === 'SESSION') {
        const m = local(ctx.facility, ctx.start);
        const session = (ctx.facility.sessions || []).find((s) => toMinutes(s.startTime) === minutesOfDay(m));
        if (session && Number(session.price) >= 0 && session.price !== undefined && session.price !== null) {
          return ctx.pricingType === 'FREE' ? 0 : Number(session.price);
        }
      }
      return baseByType(ctx);
    },
    bufferMinutes: turnaroundMinutes,
  },

  ROOM_RESOURCE: {
    requiresResource: true,
    unitsOf: () => 1,
    capacity: () => 1,
    windowError: roomWindowError,
    headcountError: (facility, { headcount, resource }) => {
      const seats = Number(resource?.totalBulkStock) || 0;
      if (seats && headcount > seats) return `This room seats at most ${seats} person(s)`;
      return null;
    },
    // Per room: hourly rooms by the hour, overnight rooms by the night.
    base: (ctx) => {
      if (roomStayMode(ctx.facility) === 'OVERNIGHT' && ctx.pricingType !== 'FREE') {
        const nights = Math.max(1, overnightNights(ctx.facility, ctx.start, ctx.end));
        return ctx.pricingType === 'FIXED_EVENT' ? ctx.rate : nights * ctx.rate;
      }
      return baseByType(ctx);
    },
    bufferMinutes: turnaroundMinutes,
  },

  INVENTORY_TOOLS: {
    requiresResource: true,
    unitsOf: (b, resource) => (resource?.isSerializedAsset ? 1 : Math.max(1, Number(b.quantity) || 1)),
    capacity: ({ resource }) => (resource?.isSerializedAsset ? 1 : Math.max(0, Number(resource?.totalBulkStock) || 0)),
    windowError: loanWindowError,
    headcountError: (facility, { quantity, resource }) => {
      const stock = resource?.isSerializedAsset ? 1 : Number(resource?.totalBulkStock) || 0;
      if (quantity > stock) return `Only ${stock} item(s) exist in stock`;
      return null;
    },
    // Items are priced (and deposit-backed) per unit borrowed.
    base: (ctx) => baseByType({ ...ctx, multiplier: ctx.quantity }),
    bufferMinutes: () => 0,
    depositMultiplier: (quantity) => quantity,
  },
};

export const getProfile = (facility) => PROFILES[facility?.archetype] || PROFILES.EXCLUSIVE_HOURLY;

/**
 * Validates a requested window and party size against the facility's booking rules.
 * @returns {string|null} a user-facing reason when the request is not bookable
 */
export const bookingRuleError = (facility, { start, end, headcount = 1, quantity = 1, resource = null, now = new Date() }) => {
  if (!(start instanceof Date) || !(end instanceof Date) || isNaN(start) || isNaN(end) || start >= end) {
    return 'Invalid date range: start must be earlier than end';
  }
  if (start.getTime() + PAST_GRACE_MS < now.getTime()) return 'Reservation start time cannot be in the past';

  const noticeHours = Number(facility.minNoticeHours) || 0;
  if (noticeHours > 0 && start.getTime() + PAST_GRACE_MS < now.getTime() + noticeHours * HOUR_MS) {
    return `This facility must be booked at least ${noticeHours} hour(s) in advance`;
  }

  const advanceDays = Number(facility.advanceBookingDays) || 0;
  if (advanceDays > 0) {
    const lastDay = local(facility, now).startOf('day').add(advanceDays, 'days');
    if (local(facility, start).startOf('day').isAfter(lastDay)) {
      return `Bookings open at most ${advanceDays} day(s) ahead`;
    }
  }

  const profile = getProfile(facility);
  if (profile.requiresResource && !resource) return 'Please choose a specific room or item to book';

  return (
    profile.windowError(facility, start, end) ||
    profile.headcountError(facility, {
      headcount: Math.max(1, Number(headcount) || 1),
      quantity: Math.max(1, Number(quantity) || 1),
      resource,
    })
  );
};

/** Effective (buffered) occupancy window used for conflict detection. */
export const effectiveWindow = (facility, resource, start, end) => {
  const profile = getProfile(facility);
  const before = Number(resource?.setupBufferMinutes) || 0;
  const after = profile.bufferMinutes(facility) + (Number(resource?.teardownBufferMinutes) || 0);
  return {
    effectiveStart: new Date(start.getTime() - before * 60000),
    effectiveEnd: new Date(end.getTime() + after * 60000),
  };
};

/**
 * Base price, tax and deposit for a booking. Amounts are rounded to paise.
 */
export const priceBooking = (facility, { start, end, headcount = 1, quantity = 1 }) => {
  const cfg = facility.pricingConfig || {};
  const pricingType = cfg.pricingType || 'FREE';
  const rate = Number(cfg.baseRate) || 0;
  const taxPercentage = Number(cfg.taxPercentage) || 0;
  const profile = getProfile(facility);
  const qty = Math.max(1, Number(quantity) || 1);
  const hc = Math.max(1, Number(headcount) || 1);

  const round = (n) => Math.round(n * 100) / 100;
  const baseAmount = round(profile.base({ facility, pricingType, rate, start, end, headcount: hc, quantity: qty }));
  const taxAmount = round((baseAmount * taxPercentage) / 100);
  // A refundable deposit may apply even to free facilities (e.g. a borrowed tool).
  const depositUnit = Number(cfg.securityDeposit) || 0;
  const depositAmount = round(depositUnit * (profile.depositMultiplier ? profile.depositMultiplier(qty) : 1));
  return {
    baseAmount,
    taxAmount,
    depositAmount,
    discountAmount: 0,
    totalAmount: round(baseAmount + taxAmount + depositAmount),
    currency: cfg.currency || 'INR',
  };
};

/**
 * Candidate windows a facility offers on a local date, for the daily slot listing.
 * @returns {Array<{ start: Date, end: Date }>}
 */
export const candidateWindows = (facility, dateStr) => {
  const dayStart = moment.tz(dateStr, 'YYYY-MM-DD', tzOf(facility)).startOf('day');
  const win = openWindow(facility, dayStart);
  if (!win) return [];
  const at = (min) => atLocal(facility, dateStr, min);
  const grid = (length) => {
    const out = [];
    for (let t = win.open; t + length <= win.close; t += gridStep(facility)) out.push({ start: at(t), end: at(t + length) });
    return out;
  };

  switch (facility.archetype) {
    case 'EVENT_SPACE': {
      const mode = eventBookingMode(facility);
      if (mode === 'FULL_DAY') return [{ start: at(win.open), end: at(win.close) }];
      if (mode === 'SESSION') {
        return (facility.sessions || [])
          .map((s) => ({ start: at(toMinutes(s.startTime)), end: at(toMinutes(s.endTime)), label: s.name }))
          .filter((s) => s.start < s.end);
      }
      return grid(slotMinutes(facility));
    }
    case 'ROOM_RESOURCE': {
      if (roomStayMode(facility) === 'OVERNIGHT') {
        const checkOut = moment
          .tz(dateStr, 'YYYY-MM-DD', tzOf(facility))
          .add(1, 'day')
          .format('YYYY-MM-DD');
        return [{ start: at(toMinutes(facility.checkInTime || '14:00')), end: atLocal(facility, checkOut, toMinutes(facility.checkOutTime || '11:00')) }];
      }
      return grid(slotMinutes(facility));
    }
    case 'INVENTORY_TOOLS': {
      // Pickup times on the hour; the default window runs to closing or the loan limit.
      const loanMinutes = Math.max(60, (Number(facility.maxLoanHours) || 24) * 60);
      const out = [];
      for (let t = win.open; t + 60 <= win.close; t += 60) {
        out.push({ start: at(t), end: at(Math.min(win.close, t + loanMinutes)) });
      }
      return out;
    }
    default:
      return grid(slotMinutes(facility));
  }
};
