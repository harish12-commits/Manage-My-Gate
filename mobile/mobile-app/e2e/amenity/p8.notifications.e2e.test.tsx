/**
 * P8 — Amenity notifications: the backend (V2 outbox) notifies the right people about
 * booking events, and tapping each notification opens the right screen in the app —
 * the resident's booking detail, or the staff Booking Queue.
 */
import { resolveNotificationRoute } from '@/src/features/notification/utils/notificationNavigation';
import { actor, Actor } from '../helpers/session';
import { apiAs } from '../helpers/backend';
import { closeDb, oid } from '../helpers/db';
import { amenityApiAs, bookAs, amenityCollection, HoldInput } from '../helpers/amenity';

afterAll(closeDb);

/** Newest notification for `who` with this title that mentions `text`, as the app's list receives it. */
const latestNotification = async (who: Actor, title: string, text: string, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await apiAs(who, 'GET', '/notifications?limit=100');
    const rows: any[] = res.body.data?.data || res.body.data?.notifications || res.body.data || [];
    const hit = rows.find((n) => n.title === title && JSON.stringify(n).includes(text));
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${who} has no "${title}" notification about ${text}`);
};

const detailRoute = (id: string) => `/(resident)/amenities/reservations/${id}`;
const QUEUE = '/(resident)/amenities/admin-bookings';
const hallDay = (daysAhead: number): HoldInput => ({ facilityKey: 'hall', daysAhead, start: '06:00', end: '22:00', headcount: 30 });

describe('P8 approval flow notifications', () => {
  it('asks staff to review, tells the resident, then confirms the approval', async () => {
    const { reservation } = await bookAs('residentA', hallDay(11), { paymentMethod: 'WALLET' });
    const n = reservation.reservationNumber;

    const staff = await latestNotification('adminA', 'Amenity Booking Awaiting Approval', n);
    expect(resolveNotificationRoute(staff)).toBe(QUEUE);
    const resident = await latestNotification('residentA', 'Amenity Approval Requested', n);
    expect(resolveNotificationRoute(resident)).toBe(detailRoute(reservation._id));
    await expect(latestNotification('residentB', 'Amenity Approval Requested', n, 1500)).rejects.toThrow();

    expect((await amenityApiAs('adminA', 'POST', `/reservations/${reservation._id}/review`, { action: 'APPROVE' })).status).toBe(200);
    const confirmed = await latestNotification('residentA', 'Amenity Reservation Confirmed', n);
    expect(resolveNotificationRoute(confirmed)).toBe(detailRoute(reservation._id));
  });
});

describe('P8 rejection', () => {
  it('tells the resident their request was rejected, with the reason', async () => {
    const { reservation } = await bookAs('residentB', hallDay(13), { paymentMethod: 'WALLET' });
    const res = await amenityApiAs('adminA', 'POST', `/reservations/${reservation._id}/review`, {
      action: 'REJECT',
      rejectionReason: 'Reserved for the society AGM',
    });
    expect(res.status).toBe(200);
    const note = await latestNotification('residentB', 'Amenity Reservation Cancelled', reservation.reservationNumber);
    expect(JSON.stringify(note)).toContain('Reserved for the society AGM');
    expect(resolveNotificationRoute(note)).toBe(detailRoute(reservation._id));
  });
});

describe('P8 booking notifications', () => {
  it('confirms a booking and its gate pass, both opening the booking', async () => {
    const { reservation } = await bookAs('residentB', { facilityKey: 'pool', daysAhead: 6, start: '14:00', end: '15:00' }, { paymentMethod: 'WALLET' });
    const confirmed = await latestNotification('residentB', 'Amenity Reservation Confirmed', reservation.reservationNumber);
    expect(resolveNotificationRoute(confirmed)).toBe(detailRoute(reservation._id));
    const pass = await latestNotification('residentB', 'Amenity Access Pass Issued', String(reservation._id));
    expect(resolveNotificationRoute(pass)).toBe(detailRoute(reservation._id));
  });

  it('tells the resident when staff cancel their booking', async () => {
    const { reservation } = await bookAs('residentB', { facilityKey: 'pool', daysAhead: 6, start: '15:00', end: '16:00' }, { paymentMethod: 'WALLET' });
    await amenityApiAs('adminA', 'POST', `/reservations/${reservation._id}/cancel`, { reason: 'Pool cleaning' });
    const cancelled = await latestNotification('residentB', 'Amenity Reservation Cancelled', reservation.reservationNumber);
    expect(resolveNotificationRoute(cancelled)).toBe(detailRoute(reservation._id));
  });

  it('sends a no-show to the staff queue and tells the resident', async () => {
    const { reservation } = await bookAs('residentA', { facilityKey: 'pool', daysAhead: 6, start: '17:00', end: '18:00' }, { paymentMethod: 'WALLET' });
    // The booking started 2 hours ago without a check-in: the lifecycle worker flags it.
    const start = new Date(Date.now() - 120 * 60000);
    const end = new Date(Date.now() + 60 * 60000);
    await (await amenityCollection('reservations')).updateOne(
      { _id: oid(reservation._id) },
      { $set: { requestedStartDateTime: start, effectiveStartDateTime: start, requestedEndDateTime: end, effectiveEndDateTime: end } }
    );

    const staff = await latestNotification('adminA', 'Amenity Booking Needs Review', reservation.reservationNumber, 20000);
    expect(resolveNotificationRoute(staff)).toBe(QUEUE);
    const resident = await latestNotification('residentA', 'Amenity Booking Update', reservation.reservationNumber, 20000);
    expect(resolveNotificationRoute(resident)).toBe(detailRoute(reservation._id));
    expect(actor('adminA').id).toBeTruthy();
  });
});

describe('P8 routing of stored amenity notifications', () => {
  it('opens the booking detail, never the booking wizard, for a booking id', () => {
    expect(resolveNotificationRoute({ type: 'AMENITY_BOOKING', entityId: 'abc123' } as any)).toBe(detailRoute('abc123'));
    expect(resolveNotificationRoute({ actionUrl: '/resident/amenities/reservations/abc123' } as any)).toBe(detailRoute('abc123'));
    expect(resolveNotificationRoute({ actionUrl: '/resident/amenities/admin-bookings' } as any)).toBe(QUEUE);
  });
});
