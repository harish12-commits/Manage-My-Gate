/**
 * P2b — Community amenity settings, the cancellation policy frozen on each booking,
 * and refunds computed from it (V2 enforcement of the facility's cancellation rules).
 */
import { actor } from '../helpers/session';
import { closeDb, oid } from '../helpers/db';
import { amenityApiAs, bookAs, confirmHoldAs, createHoldAs, facility, amenityCollection, walletBalance, HoldInput } from '../helpers/amenity';
import type { Actor } from '../helpers/session';

afterAll(closeDb);

const expectStatus = (res: any, status: number) =>
  expect({ status: res.status, message: res.body.message }).toEqual({ status, message: expect.anything() });
const cancelAs = (who: Actor, id: string) => amenityApiAs(who, 'POST', `/reservations/${id}/cancel`, { reason: 'e2e cancel' });
const reservation = async (id: string) => (await amenityCollection('reservations')).findOne({ _id: oid(id) });

/** Moves a booking so it starts `hours` from now (keeps its length). */
const startIn = async (id: string, hours: number) => {
  const r = await reservation(id);
  const len = r!.requestedEndDateTime.getTime() - r!.requestedStartDateTime.getTime();
  const start = new Date(Date.now() + hours * 3600000);
  const end = new Date(start.getTime() + len);
  await (await amenityCollection('reservations')).updateOne(
    { _id: oid(id) },
    { $set: { requestedStartDateTime: start, effectiveStartDateTime: start, requestedEndDateTime: end, effectiveEndDateTime: end } }
  );
};

const courtAt = (start: string, end: string, daysAhead = 3): HoldInput => ({ facilityKey: 'court', daysAhead, start, end });

describe('P2b amenity settings', () => {
  it('returns community defaults to anyone who books', async () => {
    const res = await amenityApiAs('residentA', 'GET', '/settings');
    expectStatus(res, 200);
    expect(res.body.data).toMatchObject({
      approvalTimeoutHours: 24,
      checkInEarlyMinutes: 15,
      noShowGraceMinutes: 30,
      quota: { enabled: true, limitMinutes: 2400, longDurationLimitMinutes: 43200 },
    });
  });

  it('lets amenity admins change settings and forbids residents', async () => {
    expectStatus(await amenityApiAs('residentA', 'PUT', '/settings', { approvalTimeoutHours: 1 }), 403);
    const res = await amenityApiAs('managerA', 'PUT', '/settings', { approvalTimeoutHours: 48 });
    expectStatus(res, 200);
    expect(res.body.data.approvalTimeoutHours).toBe(48);
    expectStatus(await amenityApiAs('adminA', 'PUT', '/settings', { approvalTimeoutHours: 0 }), 400);
  });

  it('gives approval requests the configured review window', async () => {
    const hold = await createHoldAs('residentB', { facilityKey: 'hall', daysAhead: 12, start: '06:00', end: '22:00', headcount: 20 });
    expect({ status: hold.status, message: hold.body.message }).toEqual({ status: 201, message: expect.anything() });
    const confirm = await confirmHoldAs('residentB', hold.body.data.hold._id, { paymentMethod: 'WALLET' });
    expectStatus(confirm, 201);
    const r = await reservation(String(confirm.body.data.reservation._id));
    const hours = (r!.approvalDeadline.getTime() - Date.now()) / 3600000;
    expect(hours).toBeGreaterThan(47);
    expect(hours).toBeLessThanOrEqual(48);
  });

  it('enforces the household quota from settings, using the current allowance', async () => {
    expectStatus(await amenityApiAs('adminA', 'PUT', '/settings', { quota: { limitMinutes: 60 } }), 200);
    try {
      await bookAs('crossAdmin', { facilityKey: 'gym', daysAhead: 4, start: '09:00', end: '10:00' });
      const second = await createHoldAs('crossAdmin', { facilityKey: 'gym', daysAhead: 4, start: '11:00', end: '12:00' });
      expectStatus(second, 403);
    } finally {
      await amenityApiAs('adminA', 'PUT', '/settings', { quota: { limitMinutes: 2400 } });
    }
    expectStatus(await createHoldAs('crossAdmin', { facilityKey: 'gym', daysAhead: 4, start: '11:00', end: '12:00' }), 201);
  });
});

describe('P2b cancellation policy (court: 50% refund when cancelled 24h+ before start)', () => {
  it('freezes the facility policy onto the booking at confirmation', async () => {
    const booked = await bookAs('residentA', courtAt('06:00', '07:00'), { paymentMethod: 'WALLET' });
    const r = await reservation(String(booked.reservation._id));
    expect(r!.policySnapshot.cancellation).toEqual({ isAllowed: true, refundCutoffHours: 24, refundPercentage: 50 });
  });

  it('refunds the policy percentage when cancelled before the cutoff', async () => {
    const booked = await bookAs('residentA', courtAt('07:10', '08:10'), { paymentMethod: 'WALLET' });
    const before = await walletBalance('residentA');
    expectStatus(await cancelAs('residentA', String(booked.reservation._id)), 200);
    expect((await walletBalance('residentA'))! - before!).toBe(150);
    const r = await reservation(String(booked.reservation._id));
    expect({ status: r!.paymentStatus, amount: r!.refundAmount, pct: r!.refundPercentage }).toEqual({
      status: 'PARTIALLY_REFUNDED',
      amount: 150,
      pct: 50,
    });
  });

  it('refunds nothing when cancelled inside the cutoff window', async () => {
    const booked = await bookAs('residentA', courtAt('08:20', '09:20'), { paymentMethod: 'WALLET' });
    const id = String(booked.reservation._id);
    await startIn(id, 5);
    const before = await walletBalance('residentA');
    expectStatus(await cancelAs('residentA', id), 200);
    expect(await walletBalance('residentA')).toBe(before);
    expect((await reservation(id))!.paymentStatus).toBe('PAID');
  });

  it('keeps the terms the booking was made under when the facility policy changes later', async () => {
    const booked = await bookAs('residentA', courtAt('09:30', '10:30'), { paymentMethod: 'WALLET' });
    const facilities = await amenityCollection('facilities');
    await facilities.updateOne({ _id: oid(facility('court').id) }, { $set: { 'cancellationPolicy.refundPercentage': 100 } });
    try {
      const before = await walletBalance('residentA');
      await cancelAs('residentA', String(booked.reservation._id));
      expect((await walletBalance('residentA'))! - before!).toBe(150);
    } finally {
      await facilities.updateOne({ _id: oid(facility('court').id) }, { $set: { 'cancellationPolicy.refundPercentage': 50 } });
    }
  });

  it('refunds in full when amenity staff cancel a resident booking', async () => {
    const booked = await bookAs('residentA', courtAt('10:40', '11:40'), { paymentMethod: 'WALLET' });
    const before = await walletBalance('residentA');
    expectStatus(await cancelAs('managerA', String(booked.reservation._id)), 200);
    expect((await walletBalance('residentA'))! - before!).toBe(300);
    expect((await reservation(String(booked.reservation._id)))!.paymentStatus).toBe('REFUNDED');
  });

  it('does not allow cancelling a booking that has already started', async () => {
    const booked = await bookAs('residentA', courtAt('11:50', '12:50'), { paymentMethod: 'WALLET' });
    const id = String(booked.reservation._id);
    await startIn(id, -0.25);
    expectStatus(await cancelAs('residentA', id), 400);
    expect((await reservation(id))!.bookingStatus).toBe('CONFIRMED');
  });
});

describe('P2b deposits and cancellation rules on other facilities', () => {
  it('always returns the refundable deposit, even when the booking itself is not refundable', async () => {
    const facilities = await amenityCollection('facilities');
    await facilities.updateOne({ _id: oid(facility('tools').id) }, { $set: { cancellationPolicy: { isAllowed: true, refundCutoffHours: 24, refundPercentage: 0 } } });
    try {
      const booked = await bookAs(
        'residentB',
        { facilityKey: 'tools', daysAhead: 6, endDaysAhead: 7, start: '10:00', end: '10:00', quantity: 1 },
        { paymentMethod: 'WALLET' }
      );
      const before = await walletBalance('residentB');
      expectStatus(await cancelAs('residentB', String(booked.reservation._id)), 200);
      expect((await walletBalance('residentB'))! - before!).toBe(500);
    } finally {
      await facilities.updateOne({ _id: oid(facility('tools').id) }, { $set: { cancellationPolicy: { isAllowed: true, refundCutoffHours: 24, refundPercentage: 100 } } });
    }
  });

  it('forbids residents to cancel where the facility disallows it, but staff still can', async () => {
    const facilities = await amenityCollection('facilities');
    await facilities.updateOne({ _id: oid(facility('pool').id) }, { $set: { 'cancellationPolicy.isAllowed': false } });
    try {
      const booked = await bookAs('residentB', { facilityKey: 'pool', daysAhead: 6, start: '10:00', end: '11:00', headcount: 1 }, { paymentMethod: 'WALLET' });
      const id = String(booked.reservation._id);
      expectStatus(await cancelAs('residentB', id), 403);
      expectStatus(await cancelAs('adminA', id), 200);
    } finally {
      await facilities.updateOne({ _id: oid(facility('pool').id) }, { $set: { 'cancellationPolicy.isAllowed': true } });
    }
  });

  it('refunds fully when a booking still awaiting approval is withdrawn', async () => {
    const hold = await createHoldAs('residentA', { facilityKey: 'hall', daysAhead: 14, start: '06:00', end: '22:00', headcount: 20 });
    const confirm = await confirmHoldAs('residentA', hold.body.data.hold._id, { paymentMethod: 'WALLET' });
    const id = String(confirm.body.data.reservation._id);
    expect((await reservation(id))!.bookingStatus).toBe('PENDING_APPROVAL');
    const before = await walletBalance('residentA');
    expectStatus(await cancelAs('residentA', id), 200);
    expect((await walletBalance('residentA'))! - before!).toBe(7000);
  });

  it('records who cancelled and the refund breakdown for the ledger', async () => {
    const booked = await bookAs('residentA', courtAt('13:00', '14:00'), { paymentMethod: 'WALLET' });
    await cancelAs('residentA', String(booked.reservation._id));
    const r = await reservation(String(booked.reservation._id));
    expect(String(r!.cancelledBy)).toBe(actor('residentA').id);
    expect(r!.refundBreakdown).toMatchObject({ bookingRefund: 150, depositRefund: 0 });
  });
});
