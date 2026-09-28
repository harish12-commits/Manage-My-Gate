/**
 * P3 — Amenity payments on the unified payment core: digital wallet, Razorpay, advance +
 * balance, pay at gate (cash collected by the guard), wallet refunds, and staff bookings
 * without payment. Every payment is a Payment record with a double-entry ledger line.
 */
import { actor } from '../helpers/session';
import type { Actor } from '../helpers/session';
import { closeDb, collection, oid } from '../helpers/db';
import {
  amenityApiAs,
  createHoldAs,
  confirmHoldAs,
  bookAs,
  facility,
  amenityCollection,
  eventually,
  walletBalance,
  HoldInput,
} from '../helpers/amenity';

afterAll(closeDb);

const expectStatus = (res: any, status: number) =>
  expect({ status: res.status, message: res.body.message }).toEqual({ status, message: expect.anything() });
const reservation = async (id: string) => (await amenityCollection('reservations')).findOne({ _id: oid(id) });
const ledgerFor = async (paymentId: any) => (await collection('financial_ledger_entries')).findOne({ paymentId: oid(String(paymentId)) });
const payments = () => collection('payments');

/** Moves a booking and its passes so it starts `minutes` from now (keeps its length). */
const startInMinutes = async (id: string, minutes: number) => {
  const r = await reservation(id);
  const len = r!.requestedEndDateTime.getTime() - r!.requestedStartDateTime.getTime();
  const start = new Date(Date.now() + minutes * 60000);
  const end = new Date(start.getTime() + len);
  await (await amenityCollection('reservations')).updateOne(
    { _id: oid(id) },
    { $set: { requestedStartDateTime: start, effectiveStartDateTime: start, requestedEndDateTime: end, effectiveEndDateTime: end } }
  );
  await (await amenityCollection('access_passes')).updateMany({ reservationId: oid(id) }, { $set: { validFrom: start, validUntil: end } });
};

const court = (start: string, end: string, daysAhead = 5): HoldInput => ({ facilityKey: 'court', daysAhead, start, end });
const hallDay = (daysAhead: number): HoldInput => ({ facilityKey: 'hall', daysAhead, start: '06:00', end: '22:00', headcount: 30 });
const lawn = (daysAhead: number, session: 'Morning' | 'Evening'): HoldInput =>
  session === 'Morning'
    ? { facilityKey: 'hallSessions', daysAhead, start: '08:00', end: '13:00', headcount: 20 }
    : { facilityKey: 'hallSessions', daysAhead, start: '16:00', end: '22:00', headcount: 20 };

const orderFor = (who: Actor, body: Record<string, string>) => amenityApiAs(who, 'POST', '/payments/orders', body);
const verify = (who: Actor, order: any) =>
  amenityApiAs(who, 'POST', '/payments/verify', {
    paymentId: order.paymentId,
    orderId: order.orderId,
    razorpayPaymentId: `pay_mock_${Date.now()}`,
    razorpaySignature: `sig_mock_${Date.now()}`,
  });

describe('P3 digital wallet', () => {
  it('pays the full price from the wallet as a settled Payment with a ledger entry', async () => {
    const before = await walletBalance('residentB');
    const booked = await bookAs('residentB', court('06:00', '07:00'), { paymentMethod: 'WALLET' });
    const id = String(booked.reservation._id);
    expect(before! - (await walletBalance('residentB'))!).toBe(300);

    const r = await reservation(id);
    expect({ status: r!.paymentStatus, paid: r!.paidAmount, balance: r!.balanceAmount, method: r!.paymentMethod }).toEqual({
      status: 'PAID',
      paid: 300,
      balance: 0,
      method: 'WALLET',
    });
    expect(r!.payments.map((p: any) => [p.purpose, p.method, p.amount])).toEqual([['BOOKING', 'WALLET', 300]]);

    const payment = await (await payments()).findOne({ _id: r!.payments[0].paymentId });
    expect(payment).toMatchObject({ domain: 'AMENITY', referenceType: 'AmenityReservation', paymentMethod: 'WALLET', status: 'success', amount: 300 });
    expect(await ledgerFor(payment!._id)).toMatchObject({ debitAccount: 'RESIDENT_WALLET', creditAccount: 'AMENITY_REVENUE', amount: 300 });
  });

  it('never charges twice when the same confirmation is replayed', async () => {
    const hold = await createHoldAs('residentB', court('07:10', '08:10'));
    const key = `e2e-replay-${Date.now()}`;
    const before = await walletBalance('residentB');
    const send = () =>
      amenityApiAs('residentB', 'POST', '/reservations/confirm', { holdId: hold.body.data.hold._id, paymentMethod: 'WALLET' }, { 'x-idempotency-key': key });
    expectStatus(await send(), 201);
    await send();
    expect(before! - (await walletBalance('residentB'))!).toBe(300);
  });

  it('rolls the whole booking back when the wallet cannot cover the amount due now', async () => {
    const hold = await createHoldAs('crossAdmin', hallDay(16));
    const before = await walletBalance('crossAdmin');
    const res = await confirmHoldAs('crossAdmin', hold.body.data.hold._id, { paymentMethod: 'WALLET' });
    expectStatus(res, 400);
    expect(await walletBalance('crossAdmin')).toBe(before);
    expect(await (await amenityCollection('reservations')).countDocuments({ residentId: oid(actor('crossAdmin').id), facilityId: oid(facility('hall').id) })).toBe(0);
    expect((await (await amenityCollection('reservation_holds')).findOne({ _id: oid(hold.body.data.hold._id) }))!.status).toBe('ACTIVE');
  });
});

describe('P3 advance + balance (party hall: 25% advance + deposit when booking)', () => {
  let id: string;

  it('quotes the advance, deposit and balance on the hold', async () => {
    const hold = await createHoldAs('residentA', hallDay(18));
    expect(hold.body.data.hold.amountSchedule).toMatchObject({
      mode: 'ADVANCE',
      priceAmount: 5000,
      depositAmount: 2000,
      advanceAmount: 1250,
      dueNowAmount: 3250,
      balanceAmount: 3750,
    });
    const before = await walletBalance('residentA');
    const confirm = await confirmHoldAs('residentA', hold.body.data.hold._id, { paymentMethod: 'WALLET' });
    expectStatus(confirm, 201);
    id = String(confirm.body.data.reservation._id);
    expect(before! - (await walletBalance('residentA'))!).toBe(3250);
    const r = await reservation(id);
    expect({ status: r!.paymentStatus, paid: r!.paidAmount, balance: r!.balanceAmount }).toEqual({ status: 'ADVANCE_PAID', paid: 3250, balance: 3750 });
  });

  it('lets the resident pay the fixed balance from the wallet', async () => {
    const before = await walletBalance('residentA');
    expectStatus(await amenityApiAs('residentA', 'POST', `/reservations/${id}/pay-balance`, { paymentMethod: 'WALLET' }), 200);
    expect(before! - (await walletBalance('residentA'))!).toBe(3750);
    const r = await reservation(id);
    expect({ status: r!.paymentStatus, paid: r!.paidAmount, balance: r!.balanceAmount }).toEqual({ status: 'PAID', paid: 7000, balance: 0 });
    expect(r!.payments.map((p: any) => p.purpose)).toEqual(['BOOKING', 'BALANCE']);
    expectStatus(await amenityApiAs('residentA', 'POST', `/reservations/${id}/pay-balance`, { paymentMethod: 'WALLET' }), 400);
  });

  it('does not let another household pay (or see) the balance', async () => {
    const hold = await createHoldAs('residentA', hallDay(19));
    const confirm = await confirmHoldAs('residentA', hold.body.data.hold._id, { paymentMethod: 'WALLET' });
    const other = String(confirm.body.data.reservation._id);
    expectStatus(await amenityApiAs('residentB', 'POST', `/reservations/${other}/pay-balance`, { paymentMethod: 'WALLET' }), 403);
  });
});

describe('P3 pay at the gate (lawn sessions: nothing paid online)', () => {
  let id: string;

  it('confirms without an online payment and issues the pass with the balance due', async () => {
    const before = await walletBalance('residentB');
    const booked = await bookAs('residentB', lawn(5, 'Morning'));
    id = String(booked.reservation._id);
    expect(await walletBalance('residentB')).toBe(before);
    const r = await reservation(id);
    expect({ status: r!.paymentStatus, balance: r!.balanceAmount, access: r!.accessStatus }).toEqual({
      status: 'PENDING',
      balance: 3000,
      access: 'PASS_GENERATED',
    });
  });

  it('refuses entry at the gate until the balance is collected', async () => {
    await startInMinutes(id, 5);
    const r = await reservation(id);
    const res = await amenityApiAs('guardA', 'POST', '/passes/check-in', { rawToken: r!.reservationNumber });
    expectStatus(res, 402);
    expect(res.body.message).toMatch(/3000/);
  });

  it('only gate staff collect cash, and only the exact balance', async () => {
    expectStatus(await amenityApiAs('residentB', 'POST', `/reservations/${id}/collect-payment`, { amount: 3000 }), 403);
    expectStatus(await amenityApiAs('guardA', 'POST', `/reservations/${id}/collect-payment`, { amount: 2000 }), 400);
  });

  it('records the guard\'s cash collection with a receipt and ledger entry, then lets them in', async () => {
    const res = await amenityApiAs('guardA', 'POST', `/reservations/${id}/collect-payment`, { amount: 3000 });
    expectStatus(res, 200);
    expect(res.body.data.receiptNumber).toMatch(/^AMN-/);

    const r = await reservation(id);
    expect({ status: r!.paymentStatus, balance: r!.balanceAmount }).toEqual({ status: 'PAID', balance: 0 });
    const cash = await (await payments()).findOne({ _id: r!.payments[0].paymentId });
    expect(cash).toMatchObject({ paymentMethod: 'CASH', status: 'success', amount: 3000, receiptNumber: res.body.data.receiptNumber });
    expect(String(cash!.receivedBy)).toBe(actor('guardA').id);
    expect(await ledgerFor(cash!._id)).toMatchObject({ debitAccount: 'CASH_CLEARING', creditAccount: 'AMENITY_REVENUE', amount: 3000 });

    expectStatus(await amenityApiAs('guardA', 'POST', '/passes/check-in', { rawToken: r!.reservationNumber }), 200);
  });
});

describe('P3 Razorpay (online payment)', () => {
  it('creates the order for the amount due now and keeps the slot held through checkout', async () => {
    const hold = await createHoldAs('residentA', court('08:20', '09:20'));
    const order = await orderFor('residentA', { holdId: hold.body.data.hold._id });
    expectStatus(order, 201);
    expect(order.body.data.amount).toBe(300);
    expect(new Date(order.body.data.holdExpiresAt).getTime()).toBeGreaterThan(Date.now() + 14 * 60000);
    const pending = await (await payments()).findOne({ _id: oid(order.body.data.paymentId) });
    expect(pending).toMatchObject({ referenceType: 'AmenityReservationHold', status: 'pending', gateway: 'razorpay' });
  });

  it('creates the booking server-side when the payment is verified', async () => {
    const hold = await createHoldAs('residentA', court('09:30', '10:30'));
    const holdId = hold.body.data.hold._id;
    const order = (await orderFor('residentA', { holdId })).body.data;
    const verified = await verify('residentA', order);
    expectStatus(verified, 200);
    expect(verified.body.data.fulfilled).toBe(true);

    const id = String(verified.body.data.reservation._id);
    const r = await reservation(id);
    expect({ status: r!.paymentStatus, method: r!.paymentMethod, paid: r!.paidAmount }).toEqual({ status: 'PAID', method: 'RAZORPAY', paid: 300 });
    expect(await ledgerFor(order.paymentId)).toMatchObject({ debitAccount: 'EXTERNAL_CLEARING', creditAccount: 'AMENITY_REVENUE', amount: 300 });

    // The app confirming afterwards gets the same booking back, not a second one.
    const replay = await confirmHoldAs('residentA', holdId, { paymentMethod: 'RAZORPAY' });
    expectStatus(replay, 201);
    expect(String(replay.body.data.reservation._id)).toBe(id);
  });

  it('refuses a card payment claimed at confirm without a verified capture', async () => {
    const hold = await createHoldAs('residentA', court('10:40', '11:40'));
    expectStatus(await confirmHoldAs('residentA', hold.body.data.hold._id, { paymentMethod: 'RAZORPAY', paymentId: '6ab9f953102ae30a5b55a196' }), 400);
  });

  it('collects an outstanding balance online', async () => {
    const booked = await bookAs('residentA', hallDay(20), { paymentMethod: 'WALLET' });
    const id = String(booked.reservation._id);
    const order = await orderFor('residentA', { reservationId: id });
    expectStatus(order, 201);
    expect(order.body.data.amount).toBe(3750);
    expectStatus(await verify('residentA', order.body.data), 200);
    const r = await reservation(id);
    expect({ status: r!.paymentStatus, balance: r!.balanceAmount }).toEqual({ status: 'PAID', balance: 0 });
    expect(r!.payments.map((p: any) => [p.purpose, p.method])).toEqual([['BOOKING', 'WALLET'], ['BALANCE', 'RAZORPAY']]);
  });

  it('sends a late capture back to the card when the booking window has already closed', async () => {
    const hold = await createHoldAs('residentB', court('11:50', '12:50'));
    const holdId = hold.body.data.hold._id;
    const order = (await orderFor('residentB', { holdId })).body.data;
    const holds = await amenityCollection('reservation_holds');
    await holds.updateOne({ _id: oid(holdId) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await eventually(async () => (await holds.findOne({ _id: oid(holdId) }))?.status === 'EXPIRED', 15000, 'hold expired');

    const verified = await verify('residentB', order);
    expectStatus(verified, 200);
    expect(verified.body.data.fulfilled).toBe(false);
    const refund = await eventually(
      () => payments().then((c) => c.findOne({ parentPaymentId: oid(order.paymentId), type: 'Refund' })),
      15000,
      'refund to source'
    );
    expect(Math.abs(refund!.amount)).toBe(300);
  });
});

describe('P3 refunds go to the digital wallet', () => {
  it('refunds a card-paid booking to the wallet under its cancellation policy, with a ledger entry', async () => {
    const hold = await createHoldAs('residentA', court('13:00', '14:00'));
    const order = (await orderFor('residentA', { holdId: hold.body.data.hold._id })).body.data;
    const id = String((await verify('residentA', order)).body.data.reservation._id);
    const before = await walletBalance('residentA');
    expectStatus(await amenityApiAs('residentA', 'POST', `/reservations/${id}/cancel`, { reason: 'plans changed' }), 200);
    expect((await walletBalance('residentA'))! - before!).toBe(150);
    const r = await reservation(id);
    expect({ status: r!.paymentStatus, method: r!.refundMethod, amount: r!.refundAmount }).toEqual({ status: 'PARTIALLY_REFUNDED', method: 'WALLET', amount: 150 });
    const credit = await (await collection('wallettransactions')).findOne({ transactionId: `AMR-REFUND-CANCEL-${id}` });
    expect(credit).toBeTruthy();
    expect(await (await collection('financial_ledger_entries')).findOne({ referenceId: oid(id), creditAccount: 'RESIDENT_WALLET', amount: 150 })).toBeTruthy();
  });

  it('refunds a booking paid in cash at the gate to the wallet', async () => {
    const booked = await bookAs('residentB', lawn(6, 'Evening'));
    const id = String(booked.reservation._id);
    expectStatus(await amenityApiAs('guardA', 'POST', `/reservations/${id}/collect-payment`, { amount: 4500 }), 200);
    const before = await walletBalance('residentB');
    expectStatus(await amenityApiAs('residentB', 'POST', `/reservations/${id}/cancel`, { reason: 'rain' }), 200);
    expect((await walletBalance('residentB'))! - before!).toBe(4500);
  });

  it('closes an unpaid pay-at-gate booking without any refund', async () => {
    const booked = await bookAs('residentB', lawn(7, 'Morning'));
    const id = String(booked.reservation._id);
    const before = await walletBalance('residentB');
    expectStatus(await amenityApiAs('residentB', 'POST', `/reservations/${id}/cancel`, { reason: 'no longer needed' }), 200);
    expect(await walletBalance('residentB')).toBe(before);
    expect((await reservation(id))!.paymentStatus).toBe('NOT_REQUIRED');
  });
});

describe('P3 staff bookings on a resident\'s behalf', () => {
  it('lets amenity staff book for a resident without payment', async () => {
    const before = await walletBalance('residentB');
    const hold = await createHoldAs('adminA', { ...court('14:10', '15:10'), residentId: actor('residentB').id });
    expectStatus(hold, 201);
    const confirm = await confirmHoldAs('adminA', hold.body.data.hold._id, { paymentMethod: 'WAIVED' });
    expectStatus(confirm, 201);
    const r = await reservation(String(confirm.body.data.reservation._id));
    expect({
      resident: String(r!.residentId),
      unit: String(r!.unitId),
      bookedBy: String(r!.bookedBy),
      method: r!.paymentMethod,
      status: r!.paymentStatus,
      waivedBy: String(r!.waivedBy),
    }).toEqual({
      resident: actor('residentB').id,
      unit: actor('residentB').villaId,
      bookedBy: actor('adminA').id,
      method: 'WAIVED',
      status: 'NOT_REQUIRED',
      waivedBy: actor('adminA').id,
    });
    expect(await walletBalance('residentB')).toBe(before);

    const mine = await amenityApiAs('residentB', 'GET', '/reservations?limit=100');
    expect((mine.body.data.data || []).map((x: any) => String(x._id))).toContain(String(r!._id));
  });

  it('never lets a resident waive payment or book in someone else\'s name', async () => {
    const hold = await createHoldAs('residentA', { ...court('15:20', '16:20'), residentId: actor('residentB').id });
    expectStatus(hold, 201);
    expect(String(hold.body.data.hold.residentId)).toBe(actor('residentA').id);
    expectStatus(await confirmHoldAs('residentA', hold.body.data.hold._id, { paymentMethod: 'WAIVED' }), 403);
  });
});
