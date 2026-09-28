/**
 * Amenity Management v2 - State & Business Logic Helpers
 * Pure calculation functions and predicates matching frozen Phase 5 backend contracts.
 */

import { AmenityReservation } from '../types/amenityDomain.types';

/**
 * Predicate determining whether an access pass QR code / pass card should be displayed.
 * Strictly checks the four orthogonal status gates established by backend Phase 5.
 * NOTE: 'EXEMPTED' does NOT exist in backend schemas. 'NOT_REQUIRED' is used for zero-cost bookings.
 */
export const canDisplayAmenityAccessPass = (
  reservation: AmenityReservation | null | undefined
): boolean => {
  if (!reservation) return false;

  const isBookingValid = reservation.bookingStatus === 'CONFIRMED';

  const isApprovalValid =
    reservation.approvalStatus === 'APPROVED' ||
    reservation.approvalStatus === 'NOT_REQUIRED';

  const isPaymentValid =
    reservation.paymentStatus === 'PAID' ||
    reservation.paymentStatus === 'NOT_REQUIRED';

  const isAccessValid =
    reservation.accessStatus === 'PASS_GENERATED' ||
    reservation.accessStatus === 'CHECKED_IN';

  return isBookingValid && isApprovalValid && isPaymentValid && isAccessValid;
};

/**
 * Calculates remaining seconds for an active reservation hold from the authoritative backend expiresAt timestamp.
 * Pure function: Redux and domain state store expiresAt, while UI derives countdown display dynamically.
 *
 * @param expiresAt Backend ISO date string or Date object
 * @param currentMs Optional current timestamp in milliseconds (defaults to Date.now())
 * @returns Non-negative remaining seconds integer
 */
export const calculateHoldRemainingSeconds = (
  expiresAt: string | Date | null | undefined,
  currentMs: number = Date.now()
): number => {
  if (!expiresAt) return 0;
  const expiryTime = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt.getTime();
  if (isNaN(expiryTime)) return 0;

  const diffMs = expiryTime - currentMs;
  return Math.max(0, Math.floor(diffMs / 1000));
};

/**
 * Checks whether a hold is actively unexpired.
 */
export const isHoldActive = (
  expiresAt: string | Date | null | undefined,
  currentMs: number = Date.now()
): boolean => {
  return calculateHoldRemainingSeconds(expiresAt, currentMs) > 0;
};

/**
 * Converts a facility-local date ("YYYY-MM-DD") and time ("HH:mm") into a UTC ISO string,
 * correctly accounting for the facility's IANA timezone (e.g. "Asia/Kolkata", "Asia/Dubai").
 *
 * Strategy: build a "naive" local datetime string, then use Intl.DateTimeFormat to measure
 * the UTC offset the timezone applies at that moment, and subtract it.
 *
 * @param dateStr  "YYYY-MM-DD" in the facility's local calendar
 * @param timeStr  "HH:mm"      in the facility's local clock
 * @param timezone IANA timezone identifier, e.g. "Asia/Kolkata". Defaults to device local zone.
 */
export const convertLocalToUtcIso = (
  dateStr: string,
  timeStr: string,
  timezone?: string
): string => {
  if (!dateStr || !timeStr || typeof dateStr !== 'string' || typeof timeStr !== 'string') return '';

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  if (!year || !month || !day || isNaN(hours) || isNaN(minutes)) return '';

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (!timezone) {
    // No timezone provided: treat as UTC (legacy behaviour, safe for tests)
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0)).toISOString();
  }

  try {
    // Build an ISO-like string that represents the wall-clock time in the given timezone.
    // "YYYY-MM-DDTHH:mm:00" with no Z suffix = local interpretation.
    const localIsoString = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;

    // Parse it naively as UTC first to get a Date object to interrogate.
    const naiveUtcMs = Date.UTC(year, month - 1, day, hours, minutes, 0);
    const naiveDate = new Date(naiveUtcMs);

    // Use Intl to find what UTC offset the timezone has at this approximate moment.
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Format the naiveDate (which is in UTC) into the target timezone to find the offset.
    const parts = formatter.formatToParts(naiveDate);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const tzYear = get('year');
    const tzMonth = get('month');
    const tzDay = get('day');
    const tzHour = get('hour') % 24; // handle 24:xx edge case
    const tzMinute = get('minute');

    // Difference between the target timezone's interpretation of naiveDate vs the intended wall time
    const tzAsUtcMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0);
    const offsetMs = naiveUtcMs - tzAsUtcMs;

    // The true UTC time = naiveUtcMs + offsetMs
    return new Date(naiveUtcMs + offsetMs).toISOString();
  } catch {
    // Intl not available or invalid timezone — fall back to treating input as UTC
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0)).toISOString();
  }
};

/**
 * Formats a UTC ISO datetime string into human-friendly local date and time display components.
 */
export const formatUtcToLocalDisplay = (
  utcIso: string | Date | null | undefined,
  timezone?: string
): { dateStr: string; timeStr: string; formatted: string; humanDate: string } => {
  if (!utcIso) return { dateStr: '', timeStr: '', formatted: '', humanDate: '' };

  try {
    const d = typeof utcIso === 'string' ? new Date(utcIso) : utcIso;
    if (!d || isNaN(d.getTime())) {
      return { dateStr: '', timeStr: '', formatted: '', humanDate: '' };
    }

    const tz = timezone || 'UTC';

    // Format YYYY-MM-DD in the target timezone (en-CA produces standard ISO-like date)
    const datePart = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

    // Format 24-hour HH:mm in the target timezone
    const timePart = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);

    // Human-friendly date e.g. "17 Sep 2026"
    const humanDate = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);

    return {
      dateStr: datePart,
      timeStr: timePart,
      formatted: `${datePart} ${timePart}`,
      humanDate,
    };
  } catch (err) {
    return { dateStr: '', timeStr: '', formatted: '', humanDate: '' };
  }
};

/**
 * Formats a reservation's start datetime into clean Indian date display (e.g. "17 Sep 2026").
 */
export const formatReservationDate = (
  utcIso?: string | Date | null,
  timezone: string = 'Asia/Kolkata'
): string => {
  if (!utcIso) return '';
  const res = formatUtcToLocalDisplay(utcIso, timezone);
  return res.humanDate || res.dateStr || '';
};

/**
 * Formats a reservation's start and end datetimes into Indian 12-hour time range (e.g. "3:00 PM - 4:00 PM").
 */
export const formatReservationTimeRange = (
  startIso?: string | Date | null,
  endIso?: string | Date | null,
  timezone: string = 'Asia/Kolkata'
): string => {
  if (!startIso && !endIso) return '';
  const startRes = formatUtcToLocalDisplay(startIso, timezone);
  const endRes = formatUtcToLocalDisplay(endIso, timezone);
  return formatTimeRange12Hour(startRes.timeStr, endRes.timeStr);
};

/**
 * Formats a booking window in the facility timezone. Same-day windows read
 * "17 Sep 2026 · 6:00 AM - 7:00 AM"; stays and loans spanning days read
 * "17 Sep 2026 2:00 PM → 19 Sep 2026 11:00 AM".
 */
export const formatBookingWindow = (
  startIso?: string | Date | null,
  endIso?: string | Date | null,
  timezone: string = 'Asia/Kolkata'
): string => {
  if (!startIso || !endIso) return '';
  const s = formatUtcToLocalDisplay(startIso, timezone);
  const e = formatUtcToLocalDisplay(endIso, timezone);
  if (s.dateStr === e.dateStr) {
    return `${s.humanDate} · ${formatTimeRange12Hour(s.timeStr, e.timeStr)}`;
  }
  return `${s.humanDate} ${formatTo12Hour(s.timeStr)} → ${e.humanDate} ${formatTo12Hour(e.timeStr)}`;
};

/**
 * Formats a 24-hour time string ("HH:mm") into 12-hour Indian format (e.g., "12:00 PM", "1:00 PM", "2:00 PM").
 */
export const formatTo12Hour = (timeStr: string): string => {
  if (!timeStr || typeof timeStr !== 'string') return '';
  // If already in 12-hour format, return trimmed
  if (/am|pm/i.test(timeStr)) return timeStr.trim();

  const [hStr, mStr = '00'] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h)) return timeStr;

  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minutePad = isNaN(m) ? '00' : String(m).padStart(2, '0');

  return `${hour12}:${minutePad} ${period}`;
};

/**
 * Formats a start and end time string pair into 12-hour Indian timing range (e.g., "12:00 PM - 1:00 PM").
 */
export const formatTimeRange12Hour = (startStr?: string, endStr?: string): string => {
  if (!startStr && !endStr) return '';
  if (!startStr) return formatTo12Hour(endStr || '');
  if (!endStr) return formatTo12Hour(startStr);
  return `${formatTo12Hour(startStr)} - ${formatTo12Hour(endStr)}`;
};

/**
 * Maps raw backend approval status enums to friendly resident UI display labels.
 * Converts 'NOT_REQUIRED' to 'Auto-Approved'.
 */
export const formatApprovalStatusLabel = (status?: string): string => {
  switch (status) {
    case 'NOT_REQUIRED':
      return 'Auto-Approved';
    case 'APPROVED':
      return 'Approved';
    case 'PENDING_REVIEW':
      return 'Awaiting Approval';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status ? status.replace(/_/g, ' ') : '';
  }
};

/**
 * Maps raw backend access status enums to friendly resident UI display labels.
 */
export const formatAccessStatusLabel = (status?: string): string => {
  switch (status) {
    case 'PASS_GENERATED':
      return 'Pass Ready';
    case 'CHECKED_IN':
      return 'Checked In';
    case 'CHECKED_OUT':
      return 'Checked Out';
    case 'NOT_APPLICABLE':
      return 'Not Required';
    case 'ACCESS_REVOKED':
      return 'Revoked';
    default:
      return status ? status.replace(/_/g, ' ') : '';
  }
};

/**
 * Maps raw backend completion status enums to friendly resident UI display labels.
 */
export const formatCompletionStatusLabel = (status?: string): string => {
  switch (status) {
    case 'PENDING':
      return 'Upcoming';
    case 'COMPLETED':
      return 'Completed';
    case 'NO_SHOW':
      return 'No Show';
    case 'ABANDONED':
      return 'Expired';
    default:
      return status ? status.replace(/_/g, ' ') : '';
  }
};

/**
 * Maps raw backend booking status enums to friendly resident UI display labels.
 */
export const formatBookingStatusLabel = (status?: string): string => {
  switch (status) {
    case 'CONFIRMED':
      return 'Confirmed';
    case 'PENDING_APPROVAL':
      return 'Pending Review';
    case 'CANCELLED':
      return 'Cancelled';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status ? status.replace(/_/g, ' ') : '';
  }
};

/**
 * Maps raw backend payment status enums to friendly resident UI display labels.
 */
export const formatPaymentStatusLabel = (status?: string): string => {
  switch (status) {
    case 'NOT_REQUIRED':
      return 'Free';
    case 'PAID':
      return 'Paid';
    case 'ADVANCE_PAID':
      return 'Advance Paid';
    case 'PARTIALLY_REFUNDED':
      return 'Partly Refunded';
    case 'PENDING':
      return 'Payment Due';
    case 'HELD_AUTHORIZED':
      return 'Reserved';
    case 'REFUNDED':
      return 'Refunded';
    case 'REFUND_PENDING':
      return 'Refund In Progress';
    case 'FAILED':
      return 'Payment Failed';
    default:
      return status ? status.replace(/_/g, ' ') : '';
  }
};

/**
 * Maps an amenity facility name to a short, recognizable 3-to-4 letter category prefix.
 */
export const getAmenityTypePrefix = (facilityName?: string | null): string => {
  if (!facilityName) return 'RES';
  const name = facilityName.trim().toUpperCase();
  if (name.includes('TENNIS')) return 'TEN';
  if (name.includes('GYM') || name.includes('FITNESS')) return 'GYM';
  if (name.includes('POOL') || name.includes('SWIM')) return 'POOL';
  if (name.includes('BADMINTON')) return 'BAD';
  if (name.includes('CLUB') || name.includes('HALL') || name.includes('COMMUNITY')) return 'CLUB';
  if (name.includes('BASKETBALL')) return 'BBALL';
  if (name.includes('SQUASH')) return 'SQUASH';
  if (name.includes('SPA') || name.includes('SAUNA')) return 'SPA';
  if (name.includes('THEATRE') || name.includes('CINEMA')) return 'CINE';
  return 'RES';
};

/**
 * Formats a raw reservation number or booking reference into an easy-to-identify pass code
 * combining letters and numbers (alphanumeric), replicating the clean identification pattern from Visitor Management.
 * Supports:
 * - 'RES-202609-000004' for 'Tennis Court' -> 'TEN-000004' (letters + numbers, facility-specific)
 * - '202609-000004' for 'Tennis Court' -> 'TEN-000004'
 * - 'RES-849201' for 'Olympic Swimming Pool' -> 'POOL-849201'
 * - Hex MongoDB ObjectId '6ab35b3b1c62dd0466b7f33e' -> 'TEN-B7F33E' (or 'B7F33E')
 * - 6-character alphanumeric keycode '6BBF46' -> '6BBF46'
 */
export const formatAmenityPassCode = (
  rawId?: string | null,
  facilityName?: string | null
): string => {
  if (!rawId) return 'PASS';
  let str = String(rawId).trim();

  const prefix = getAmenityTypePrefix(facilityName);

  // 1. If it's a 24-character MongoDB hex ObjectId, take last 6 chars uppercase (e.g. 6ab35b3b1c62dd0466b7f33e -> B7F33E)
  if (/^[a-f0-9]{24}$/i.test(str)) {
    const shortHex = str.slice(-6).toUpperCase();
    return prefix !== 'RES' ? `${prefix}-${shortHex}` : shortHex;
  }

  // 2. If it's already a 6-character alphanumeric code without hyphen (e.g. 6BBF46 or 849201), return it
  if (/^[0-9a-zA-Z]{6}$/.test(str) && !str.includes('-')) {
    return str.toUpperCase();
  }

  // 3. If it starts with RES- or BKG-, replace with the facility prefix (e.g. RES-202609-000004 -> TEN-202609-000004)
  if (/^(RES|BKG)-/i.test(str)) {
    const cleanSeq = str.replace(/^(RES|BKG)-/i, '');
    return `${prefix}-${cleanSeq.toUpperCase()}`;
  }

  // 4. If it already has an amenity-specific prefix (e.g. TEN-..., POOL-..., GYM-...)
  if (/^[A-Z]{2,6}-[0-9A-Z_-]+$/i.test(str)) {
    return str.toUpperCase();
  }

  // 5. If it starts with digits only (e.g. 202609-000004 or 849201), add facility prefix
  if (/^\d/.test(str)) {
    return `${prefix}-${str.toUpperCase()}`;
  }

  // 6. Fallback: prepend prefix if not already present
  if (prefix !== 'RES' && !str.toUpperCase().startsWith(`${prefix}-`)) {
    return `${prefix}-${str.toUpperCase()}`;
  }

  return str.toUpperCase();
};


