/**
 * P4 — Reservation lifecycle: check-in/out recorded on the booking, return inspection
 * and deposit settlement, approval expiry, no-show / unpaid-balance / overdue-return
 * review by amenity staff, and automatic completion (driven by the lifecycle worker).
 */
import { actor } from '../helpers/session';
import type { Actor } from '../helpers/session';
import { closeDb, collection, oid } from '../helpers/db';
import {
  amenityApiAs,
  createHoldAs,
  confirmHoldAs,
  bookAs,
  amenityCollection,
  eventually,
  walletBalance,
  HoldInput,
} from '../helpers/amenity';

afterAll(closeDb);

const expectStatus = (res: any, status: number) =>
  expect({ status: res.status, message: res.body.message }).toEqual({ status, message: res.status === status ? expect.anything() : 'show' });
const reservation = async (id: string) => (await amenityCollection('reservations')).findOne({ _id: oid(id) });

/** Moves a booking (and its passes) to start `startMin` and end `endMin` minutes from now. */
const shiftTo = async (id: string, startMin: number, endMin: number) => {
  const start = new Date(Date.now() + startMin * 60000);
  const end = new Date(Date.now() + endMin * 60000);
  await (await amenityCollection('reservations')).updateOne(
    { _id: oid(id) },
    { $set: { requestedStartDateTime: start, effectiveStartDateTime: start, requestedEndDateTime: end, effectiveEndDateTime: end } }
  );
  await (await amenityCollection('access_passes')).updateMany({ reservationId: oid(id) }, { $set: { validFrom: start, validUntil: end } });
};

const checkIn = (who: Actor, token: string) => amenityApiAs(who, 'POST', '/passes/check-in', { rawToken: token });
const checkOut = (who: Actor, token: string, inspectionDetails?: any) =>
  amenityApiAs(who, 'POST', '/passes/check-out', { rawToken: token, ...(inspectionDetails ? { inspectionDetails } : {}) });
const resolve = (who: Actor, id: string, body: any) => amenityApiAs(who, 'POST', `/reservations/${id}/resolve-review`, body);

const court = (start: string, end: string, daysAhead = 6): HoldInput => ({ facilityKey: 'court', daysAhead, start, end });

/** Confirms a booking and returns its id, number and raw pass token. */
const bookWithPass = async (who: Actor, input: HoldInput, body: any = {}) => {
  const hold = await createHoldAs(who, input);
  const confirm = await confirmHoldAs(who, hold.body.data.hold._id, body);
  if (confirm.status !== 201) throw new Error(`Setup confirm failed: ${confirm.status} ${JSON.stringify(confirm.body)}`);
  return {
    id: String(confirm.body.data.reservation._id),
    number: confirm.body.data.reservation.reservationNumber as string,
    token: confirm.body.data.rawToken as string,
  };
};

describe('P4 check-in and check-out are recorded on the booking', () => {
  it('marks the booking checked in, and refuses a second entry on the same pass', async () => {
    const b = await bookWithPass('residentA', court('06:00', '07:00'), { paymentMethod: 'WALLET' });
    await shiftTo(b.id, 5, 65);
    expectStatus(await checkIn('guardA', `MMG:AMENITY:${b.token}`), 200);
    const r = await reservation(b.id);
    expect({ access: r!.accessStatus, by: String(r!.checkedInBy) }).toEqual({ access: 'CHECKED_IN', by: actor('guardA').id });
    expectStatus(await checkIn('guardA', b.number), 409);
  });

  it('checks out a scanned QR, closing the booking as completed', async () => {
    const b = await bookWithPass('residentA', court('07:10', '08:10'), { paymentMethod: 'WALLET' });
    await shiftTo(b.id, 5, 65);
    expectStatus(await checkOut('guardA', `MMG:AMENITY:${b.token}`), 400);
    expectStatus(await checkIn('guardA', b.number), 200);
    const out = await checkOut('guardA', `MMG:AMENITY:${b.token}`);
    expectStatus(out, 200);
    const r = await reservation(b.id);
    expect({ access: r!.accessStatus, completion: r!.completionStatus, by: String(r!.checkedOutBy) }).toEqual({
      access: 'CHECKED_OUT',
      completion: 'COMPLETED',
      by: actor('guardA').id,
    });
    expectStatus(await checkOut('guardA', b.number), 409);
  });
});

describe('P4 return inspection and deposit (tool kit: ₹500 deposit per item)', () => {
  const tools: HoldInput = { facilityKey: 'tools', daysAhead: 4, endDaysAhead: 5, start: '10:00', end: '10:00', quantity: 1 };

  it('requires an inspection to check a borrowed item back in', async () => {
    const b = await bookWithPass('residentB', tools, { paymentMethod: 'WALLET' });
    await shiftTo(b.id, 5, 600);
    expectStatus(await checkIn('guardA', b.number), 200);
    expectStatus(await checkOut('guardA', b.number), 400);
    expectStatus(await checkOut('guardA', b.number, { isDamaged: true, damageCharge: 100 }), 400);
  });

  it('returns the deposit minus the damage charge to the wallet', async () => {
    const b = await bookWithPass('residentB', { ...tools, daysAhead: 5, endDaysAhead: 6 }, { paymentMethod: 'WALLET' });
    await shiftTo(b.id, 5, 600);
    expectStatus(await checkIn('guardA', b.number), 200);
    const before = await walletBalance('residentB');
    const out = await checkOut('guardA', b.number, { isDamaged: true, damageNotes: 'Cracked handle', damageCharge: 200 });
    expectStatus(out, 200);
    expect(out.body.data.deposit).toMatchObject({ paid: 500, retained: 200, refunded: 300 });
    expect((await walletBalance('residentB'))! - before!).toBe(300);
    const r = await reservation(b.id);
    expect(r!.depositSettlement).toMatchObject({ refunded: 300, retained: 200, notes: 'Cracked handle' });
    const pass = await (await amenityCollection('access_passes')).findOne({ reservationId: oid(b.id) });
    expect(pass!.inspectionDetails).toMatchObject({ damageNotes: 'Cracked handle', damageCharges: 200 });
    expect(String(pass!.inspectionDetails.returnInspectedByStaff)).toBe(actor('guardA').id);
  });

  it('returns the whole deposit when the item comes back undamaged', async () => {
    const b = await bookWithPass('residentB', { ...tools, daysAhead: 6, endDaysAhead: 7 }, { paymentMethod: 'WALLET' });
    await shiftTo(b.id, 5, 600);
    await checkIn('guardA', b.number);
    const before = await walletBalance('residentB');
    expectStatus(await checkOut('guardA', b.number, { isDamaged: false }), 200);
    expect((await walletBalance('residentB'))! - before!).toBe(500);
  });
});

describe('P4 approval requests expire', () => {
  it('closes an unreviewed request after its deadline and refunds everything paid', async () => {
    const hold = await createHoldAs('residentA', { facilityKey: 'hall', daysAhead: 22, start: '06:00', end: '22:00', headcount: 20 });
    const confirm = await confirmHoldAs('residentA', hold.body.data.hold._id, { paymentMethod: 'WALLET' });
    const id = String(confirm.body.data.reservation._id);
    const before = await walletBalance('residentA');
    await (await amenityCollection('reservations')).updateOne({ _id: oid(id) }, { $set: { approvalDeadline: new Date(Date.now() - 1000) } });

    const r = await eventually(async () => {
      const x = await reservation(id);
      return x?.approvalStatus === 'EXPIRED' ? x : null;
    }, 15000, 'approval expired');
    expect({ booking: r.bookingStatus, payment: r.paymentStatus }).toEqual({ booking: 'REJECTED', payment: 'REFUNDED' });
    expect((await walletBalance('residentA'))! - before!).toBe(3250);
    await eventually(
      () => collection('notifications').then((c) => c.findOne({ recipientId: oid(actor('residentA').id), 'metadata.eventType': 'APPROVAL_EXPIRED' })),
      15000,
      'resident told'
    );
  });

  it('notifies amenity staff when a booking needs approval', async () => {
    const hold = await createHoldAs('residentB', { facilityKey: 'hall', daysAhead: 23, start: '06:00', end: '22:00', headcount: 20 });
    const confirm = await confirmHoldAs('residentB', hold.body.data.hold._id, { paymentMethod: 'WALLET' });
    const id = String(confirm.body.data.reservation._id);
    const notes = await collection('notifications');
    for (const staff of ['adminA', 'managerA'] as const) {
      await eventually(
        () => notes.findOne({ recipientId: oid(actor(staff).id), 'metadata.eventType': 'APPROVAL_REQUESTED', 'metadata.reservationId': oid(id) }),
        15000,
        `${staff} told`
      );
    }
    expect(await notes.findOne({ recipientId: oid(actor('guardA').id), 'metadata.eventType': 'APPROVAL_REQUESTED' })).toBeNull();
  });
});

describe('P4 no-shows and unpaid balances go to the staff review queue', () => {
  const flagged = (id: string) =>
    eventually(async () => {
      const x = await reservation(id);
      return x?.adminReview?.status === 'PENDING' ? x : null;
    }, 15000, 'flagged for review');

  it('flags a booking nobody checked in for once the grace period passes, and tells staff', async () => {
    const b = await bookWithPass('residentA', court('08:20', '09:20'), { paymentMethod: 'WALLET' });
    await shiftTo(b.id, -40, 20);
    const r = await flagged(b.id);
    expect(r.adminReview.reason).toBe('NO_SHOW');
    await eventually(
      () => collection('notifications').then((c) => c.findOne({ recipientId: oid(actor('managerA').id), 'metadata.eventType': 'RESERVATION_REVIEW_REQUIRED', 'metadata.reservationId': oid(b.id) })),
      15000,
      'staff told'
    );
    const queue = await amenityApiAs('managerA', 'GET', '/reservations?adminReviewStatus=PENDING&limit=100');
    expect((queue.body.data.data || []).map((x: any) => String(x._id))).toContain(b.id);
  });

  it('clears the flag when a late resident still checks in within the pass window', async () => {
    const b = await bookWithPass('residentA', court('09:30', '10:30'), { paymentMethod: 'WALLET' });
    await shiftTo(b.id, -40, 20);
    await flagged(b.id);
    expectStatus(await checkIn('guardA', b.number), 200);
    const r = await reservation(b.id);
    expect({ status: r!.adminReview.status, resolution: r!.adminReview.resolution }).toEqual({ status: 'RESOLVED', resolution: 'ARRIVED' });
  });

  it('forfeits a no-show on the staff decision (no refund of the booking amount)', async () => {
    const b = await bookWithPass('residentA', court('10:40', '11:40'), { paymentMethod: 'WALLET' });
    await shiftTo(b.id, -40, 20);
    await flagged(b.id);
    expectStatus(await resolve('residentA', b.id, { action: 'FORFEIT' }), 403);
    expectStatus(await resolve('managerA', b.id, { action: 'EXTEND' }), 400);
    const before = await walletBalance('residentA');
    expectStatus(await resolve('managerA', b.id, { action: 'FORFEIT', notes: 'Did not show' }), 200);
    expect(await walletBalance('residentA')).toBe(before);
    const r = await reservation(b.id);
    expect({ completion: r!.completionStatus, access: r!.accessStatus, resolution: r!.adminReview.resolution, by: String(r!.adminReview.resolvedBy) }).toEqual({
      completion: 'NO_SHOW',
      access: 'ACCESS_REVOKED',
      resolution: 'FORFEIT',
      by: actor('managerA').id,
    });
    expectStatus(await resolve('managerA', b.id, { action: 'FORFEIT' }), 409);
  });

  it('refunds a custom percentage with a stated reason', async () => {
    const b = await bookWithPass('residentA', court('11:50', '12:50'), { paymentMethod: 'WALLET' });
    await shiftTo(b.id, -40, 20);
    await flagged(b.id);
    expectStatus(await resolve('adminA', b.id, { action: 'REFUND_CUSTOM', refundPercentage: 40 }), 400);
    const before = await walletBalance('residentA');
    expectStatus(await resolve('adminA', b.id, { action: 'REFUND_CUSTOM', refundPercentage: 40, notes: 'Medical emergency' }), 200);
    expect((await walletBalance('residentA'))! - before!).toBe(120);
    expect((await reservation(b.id))!.paymentStatus).toBe('PARTIALLY_REFUNDED');
  });

  it('flags an unused pay-at-gate booking as an unpaid balance and closes it without charge', async () => {
    const b = await bookAs('residentB', { facilityKey: 'hallSessions', daysAhead: 8, start: '08:00', end: '13:00', headcount: 10 });
    const id = String(b.reservation._id);
    await shiftTo(id, -40, 200);
    const r = await flagged(id);
    expect(r.adminReview.reason).toBe('UNPAID_BALANCE');
    expectStatus(await resolve('adminA', id, { action: 'FORFEIT' }), 200);
    const closed = await reservation(id);
    expect({ completion: closed!.completionStatus, payment: closed!.paymentStatus, balance: closed!.balanceAmount }).toEqual({
      completion: 'NO_SHOW',
      payment: 'NOT_REQUIRED',
      balance: 0,
    });
  });

  it('flags a borrowed item that was not returned on time', async () => {
    const b = await bookWithPass(
      'residentB',
      { facilityKey: 'tools', daysAhead: 7, endDaysAhead: 8, start: '10:00', end: '10:00', quantity: 1 },
      { paymentMethod: 'WALLET' }
    );
    await shiftTo(b.id, 5, 600);
    expectStatus(await checkIn('guardA', b.number), 200);
    await shiftTo(b.id, -600, -40);
    const r = await flagged(b.id);
    expect(r.adminReview.reason).toBe('OVERDUE_RETURN');
    expectStatus(await resolve('adminA', b.id, { action: 'FORFEIT' }), 400);
  });
});

describe('P4 bookings complete on their own when they end', () => {
  it('completes a checked-in court booking after its end time', async () => {
    const b = await bookWithPass('residentA', court('13:00', '14:00'), { paymentMethod: 'WALLET' });
    await shiftTo(b.id, 5, 65);
    expectStatus(await checkIn('guardA', b.number), 200);
    await shiftTo(b.id, -65, -1);
    const r = await eventually(async () => {
      const x = await reservation(b.id);
      return x?.completionStatus === 'COMPLETED' ? x : null;
    }, 15000, 'auto-completed');
    expect(r.completedAt).toBeTruthy();
  });
});
