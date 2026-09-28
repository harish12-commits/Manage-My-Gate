/**
 * P6 — Amenity gate scanner (mobile UI → V2 backend): a balance due at the gate is
 * collected in cash and the resident admitted in one step, a second scan of a pass that
 * is inside records the exit (with a return inspection for borrowed items), every scan
 * lands in the security log, and "not yet valid" times are the facility's local time.
 */
import React from 'react';
import { waitFor, fireEvent } from '@testing-library/react-native';
import ScannerScreen from '@/app/(resident)/amenities/scanner';
import { store } from '@/src/store/store';
import { clearV2PassResults } from '@/src/features/amenities/store/amenityBookingSlice';
import { renderScreen } from '../helpers/render';
import { signInAs, actor, Actor } from '../helpers/session';
import { lastCall, resetApiLog } from '../helpers/api';
import { tap, typeInto, expectVisible } from '../helpers/ui';
import { closeDb, collection, oid } from '../helpers/db';
import { amenityApiAs, createHoldAs, confirmHoldAs, amenityCollection, walletBalance, HoldInput } from '../helpers/amenity';

afterAll(closeDb);

/** Confirms a booking and returns its id, number and raw pass token. */
const bookWithPass = async (who: Actor, input: HoldInput, body: any = {}) => {
  const hold = await createHoldAs(who, input);
  if (!hold.body?.data?.hold) throw new Error(`Setup hold failed: ${hold.status} ${JSON.stringify(hold.body)}`);
  const confirm = await confirmHoldAs(who, hold.body.data.hold._id, body);
  if (confirm.status !== 201) throw new Error(`Setup confirm failed: ${confirm.status} ${JSON.stringify(confirm.body)}`);
  return {
    id: String(confirm.body.data.reservation._id),
    number: confirm.body.data.reservation.reservationNumber as string,
    token: `MMG:AMENITY:${confirm.body.data.rawToken}`,
  };
};

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

const reservationDoc = async (id: string) => (await amenityCollection('reservations')).findOne({ _id: oid(id) });
const logsFor = async (id: string) => (await collection('securitylogs')).find({ bookingId: oid(id) }).sort({ scanTime: 1 }).toArray();

const openScanner = async () => {
  store.dispatch(clearV2PassResults());
  resetApiLog();
  await signInAs('guardA');
  return renderScreen(<ScannerScreen />);
};

const scan = async (view: any, token: string) => {
  await typeInto(view, 'Enter Pass Token or QR Code...', token);
  fireEvent.press(view.getByLabelText('Search Pass Code'));
  await waitFor(() => expect(lastCall('POST', '/passes/check-in')).toBeTruthy(), { timeout: 15000 });
};

describe('P6 balance due at the gate', () => {
  it('collects the balance in cash and admits the resident in one step', async () => {
    const b = await bookWithPass('residentB', { facilityKey: 'hallSessions', daysAhead: 16, start: '08:00', end: '13:00', headcount: 20 });
    await shiftTo(b.id, 5, 300);

    const view = await openScanner();
    await scan(view, b.token);
    expect(lastCall('POST', '/passes/check-in')!.status).toBe(402);
    await expectVisible(view, 'Collect ₹3,000 before entry');

    await tap(view, 'Collect ₹3,000 cash & admit');
    await waitFor(() => expect(lastCall('POST', `/reservations/${b.id}/collect-payment`)?.status).toBe(200), { timeout: 15000 });
    expect(lastCall('POST', `/reservations/${b.id}/collect-payment`)!.requestBody).toEqual({ amount: 3000 });
    await waitFor(() => expect(lastCall('POST', '/passes/check-in')?.status).toBe(200), { timeout: 15000 });

    await expectVisible(view, 'Facility Entry Verified');
    expect(view.getByText(/^₹3,000 · AMN-/)).toBeOnTheScreen();
    const r = await reservationDoc(b.id);
    expect({ pay: r!.paymentStatus, balance: r!.balanceAmount, access: r!.accessStatus, method: r!.payments.at(-1).method }).toEqual({
      pay: 'PAID',
      balance: 0,
      access: 'CHECKED_IN',
      method: 'CASH',
    });

    // Both the refusal and the admission are in the security log, against this booking.
    const logs = await logsFor(b.id);
    expect(logs.map((l: any) => [l.scanType, l.status])).toEqual([
      ['Denied', 'Denied'],
      ['Entry', 'Success'],
    ]);
    expect(logs[1].guardName).toBeTruthy();
  });
});

describe('P6 exit on a second scan', () => {
  it('records the return of a borrowed item with an inspection and settles the deposit', async () => {
    const b = await bookWithPass(
      'residentB',
      { facilityKey: 'tools', daysAhead: 2, endDaysAhead: 3, start: '10:00', end: '10:00', quantity: 1 },
      { paymentMethod: 'WALLET' }
    );
    await shiftTo(b.id, -60, 60);
    expect((await amenityApiAs('guardA', 'POST', '/passes/check-in', { rawToken: b.token })).status).toBe(200);
    const before = await walletBalance('residentB');

    const view = await openScanner();
    await scan(view, b.token);
    await expectVisible(view, 'Already checked in');
    await tap(view, 'Inspect & record return');

    await expectVisible(view, 'Return inspection');
    await tap(view, 'Damaged or incomplete');
    await typeInto(view, 'e.g. Drill bit set missing', 'Drill bit set missing');
    await typeInto(view, '0', '200');
    fireEvent.press(view.getByTestId('return-inspection-confirm'));

    await waitFor(() => expect(lastCall('POST', '/passes/check-out')).toBeTruthy(), { timeout: 15000 });
    await waitFor(() => expect(lastCall('POST', '/passes/check-out')?.status).toBe(200), { timeout: 15000 });
    expect(lastCall('POST', '/passes/check-out')!.requestBody.inspectionDetails).toMatchObject({
      isDamaged: true,
      damageNotes: 'Drill bit set missing',
      assessedPenaltyAmount: 200,
    });
    await expectVisible(view, 'The booking is complete.');
    expect(view.getByText(actor('residentB').name)).toBeOnTheScreen(); // who returned it
    expect(view.getByText('₹300')).toBeOnTheScreen(); // deposit refunded
    expect(view.getByText('₹200')).toBeOnTheScreen(); // deposit kept

    const r = await reservationDoc(b.id);
    expect({ access: r!.accessStatus, done: r!.completionStatus, kept: r!.depositSettlement.retained }).toEqual({
      access: 'CHECKED_OUT',
      done: 'COMPLETED',
      kept: 200,
    });
    expect((await walletBalance('residentB'))! - before!).toBe(300);
    expect((await logsFor(b.id)).map((l: any) => l.scanType)).toEqual(['Entry', 'Exit']);
  });

  it('records a court exit straight away (no inspection needed)', async () => {
    const b = await bookWithPass('residentA', { facilityKey: 'court', daysAhead: 4, start: '16:30', end: '17:30' }, { paymentMethod: 'WALLET' });
    await shiftTo(b.id, -30, 30);
    expect((await amenityApiAs('guardA', 'POST', '/passes/check-in', { rawToken: b.token })).status).toBe(200);

    const view = await openScanner();
    await scan(view, b.token);
    await tap(view, 'Record exit');
    await waitFor(() => expect(lastCall('POST', '/passes/check-out')?.status).toBe(200), { timeout: 15000 });
    expect(lastCall('POST', '/passes/check-out')!.requestBody.inspectionDetails).toBeUndefined();
    await expectVisible(view, 'The booking is complete.');
    expect((await reservationDoc(b.id))!.accessStatus).toBe('CHECKED_OUT');
  });
});

describe('P6 gate rules', () => {
  it('states the earliest entry in the facility time zone', async () => {
    const b = await bookWithPass('residentA', { facilityKey: 'court', daysAhead: 6, start: '20:00', end: '21:00' }, { paymentMethod: 'WALLET' });
    const res = await amenityApiAs('guardA', 'POST', '/passes/check-in', { rawToken: b.token });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_YET_VALID');
    const allowedFrom = new Date(res.body.details.allowedFrom);
    const ist = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(allowedFrom);
    expect(res.body.message).toContain(ist);
    expect(ist.replace(/\s/g, '').toLowerCase()).toMatch(/^07:45pm$/);
  });

  it('shows the security log read-only at the gate', async () => {
    const view = await openScanner();
    await waitFor(() => expect(lastCall('GET', '/security-logs')?.status).toBe(200), { timeout: 15000 });
    fireEvent.press((await view.findAllByText(/Lawn|Tools|Tennis|Hall|Pool/, undefined, { timeout: 15000 }))[0]);
    await expectVisible(view, 'Close Audit Log');
    expect(view.queryByText('Delete Log')).toBeNull();
  });
});
