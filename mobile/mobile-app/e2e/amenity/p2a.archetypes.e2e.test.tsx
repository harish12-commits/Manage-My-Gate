/**
 * P2a — Archetype profiles: each facility type books, prices and allocates by its own
 * rules. Exercised through the real V2 API against the seeded facilities; the mobile
 * booking UI is realigned onto these rules in P5.
 */
import { actor } from '../helpers/session';
import { closeDb, oid } from '../helpers/db';
import {
  amenityApiAs,
  createHoldAs,
  confirmHoldAs,
  bookAs,
  facility,
  amenityCollection,
  eventually,
  walletBalance,
  istDate,
  HoldInput,
} from '../helpers/amenity';
import type { Actor } from '../helpers/session';

afterAll(closeDb);

const holdIdOf = (res: any) => res.body.data?.hold?._id as string;
const priceOf = (res: any) => res.body.data?.pricingSnapshot;
const expectStatus = (res: any, status: number) =>
  expect({ status: res.status, message: res.body.message }).toEqual({ status, message: expect.anything() });

const cancelAs = (who: Actor, reservationId: string) =>
  amenityApiAs(who, 'POST', `/reservations/${reservationId}/cancel`, { reason: 'e2e cancel' });

const expireHoldNow = async (holdId: string) => {
  const holds = await amenityCollection('reservation_holds');
  await holds.updateOne({ _id: oid(holdId) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await eventually(async () => (await holds.findOne({ _id: oid(holdId) }))?.status === 'EXPIRED', 15000, 'hold expired');
};

describe('P2a SHARED_CAPACITY (pool): many residents share a slot up to capacity', () => {
  const slot: Omit<HoldInput, 'headcount'> = { facilityKey: 'pool', daysAhead: 3, start: '06:00', end: '07:00' };

  it('lets several households book the same slot and prices per person', async () => {
    const a = await createHoldAs('residentA', { ...slot, headcount: 3 });
    expectStatus(a, 201);
    expect(priceOf(a)).toMatchObject({ baseAmount: 300, totalAmount: 300 });

    const b = await createHoldAs('residentB', { ...slot, headcount: 4 });
    expectStatus(b, 201);
  });

  it('refuses a party larger than the per-booking guest limit', async () => {
    expectStatus(await createHoldAs('familyA', { ...slot, headcount: 5 }), 400);
  });

  it('refuses when the remaining capacity is too small, and shows what is left', async () => {
    const c = await createHoldAs('crossAdmin', { ...slot, headcount: 4 });
    expectStatus(c, 409);
    expect(c.body.message).toMatch(/3 of 10/);

    const slots = await amenityApiAs('crossAdmin', 'GET', `/availability/daily-slots?facilityId=${facility('pool').id}&date=${istDate(3)}&headcount=1`);
    const six = slots.body.data.slots.find((s: any) => s.start === '06:00');
    expect({ available: six?.availableUnits, max: six?.maxCapacity }).toEqual({ available: 3, max: 10 });
  });

  it('frees the seats again when a hold expires', async () => {
    const b = await createHoldAs('residentB', { ...slot, start: '07:00', end: '08:00', headcount: 4 });
    await expireHoldNow(holdIdOf(b));
    const c = await createHoldAs('crossAdmin', { ...slot, start: '07:00', end: '08:00', headcount: 4 });
    expectStatus(c, 201);
  });
});

describe('P2a EXCLUSIVE_HOURLY (court): whole court, slot grid with turnaround buffer', () => {
  it('prices the court per slot, never per player', async () => {
    const res = await createHoldAs('residentA', { facilityKey: 'court', daysAhead: 2, start: '06:00', end: '07:00', headcount: 2 });
    expectStatus(res, 201);
    expect(priceOf(res)).toMatchObject({ baseAmount: 300, totalAmount: 300 });
  });

  it('spaces slots by the 10-minute turnaround buffer and rejects off-grid starts', async () => {
    expectStatus(await createHoldAs('residentB', { facilityKey: 'court', daysAhead: 2, start: '07:00', end: '08:00' }), 400);
    expectStatus(await createHoldAs('residentB', { facilityKey: 'court', daysAhead: 2, start: '07:10', end: '08:10' }), 201);

    const slots = await amenityApiAs('residentB', 'GET', `/availability/daily-slots?facilityId=${facility('court').id}&date=${istDate(4)}`);
    expect(slots.body.data.slots.slice(0, 3).map((s: any) => s.start)).toEqual(['06:00', '07:10', '08:20']);
  });

  it('can be booked again after a confirmed booking is cancelled, and refunds the household quota', async () => {
    const input: HoldInput = { facilityKey: 'court', daysAhead: 2, start: '08:20', end: '09:20' };
    const quotas = await amenityCollection('quota_allocations');
    const quotaKey = { orgId: oid(actor('residentA').orgId), unitId: oid(actor('residentA').villaId!), facilityId: oid(facility('court').id) };
    const consumedBefore = (await quotas.findOne(quotaKey))?.consumedAmount || 0;

    const first = await bookAs('residentA', input, { paymentMethod: 'WALLET' });
    expect((await quotas.findOne(quotaKey))!.consumedAmount).toBe(consumedBefore + 60);

    expectStatus(await cancelAs('residentA', String(first.reservation._id)), 200);
    expect((await quotas.findOne(quotaKey))!.consumedAmount).toBe(consumedBefore);

    expectStatus(await createHoldAs('residentB', input), 201);
  });

  it('can be held again after an earlier hold expired', async () => {
    const input: HoldInput = { facilityKey: 'court', daysAhead: 2, start: '09:30', end: '10:30' };
    const first = await createHoldAs('residentA', input);
    expectStatus(first, 201);
    expectStatus(await createHoldAs('residentB', input), 409);
    await expireHoldNow(holdIdOf(first));
    expectStatus(await createHoldAs('residentB', input), 201);
  });

  it('only opens bookings up to the advance booking window', async () => {
    expectStatus(await createHoldAs('residentA', { facilityKey: 'court', daysAhead: 9, start: '06:00', end: '07:00' }), 400);
  });

  it('charges the price quoted at hold time even if the facility price changes before confirming', async () => {
    const facilities = await amenityCollection('facilities');
    const hold = await createHoldAs('residentA', { facilityKey: 'court', daysAhead: 2, start: '13:00', end: '14:00' });
    expectStatus(hold, 201);
    await facilities.updateOne({ _id: oid(facility('court').id) }, { $set: { 'pricingConfig.baseRate': 999 } });
    try {
      const before = await walletBalance('residentA');
      const confirm = await confirmHoldAs('residentA', holdIdOf(hold), { paymentMethod: 'WALLET' });
      expectStatus(confirm, 201);
      expect(before! - (await walletBalance('residentA'))!).toBe(300);
    } finally {
      await facilities.updateOne({ _id: oid(facility('court').id) }, { $set: { 'pricingConfig.baseRate': 300 } });
    }
  });
});

describe('P2a EVENT_SPACE (hall): full-day, session and notice rules', () => {
  it('books the hall for the full opening day at a flat price plus deposit, regardless of guests', async () => {
    expectStatus(await createHoldAs('residentA', { facilityKey: 'hall', daysAhead: 5, start: '10:00', end: '14:00', headcount: 50 }), 400);
    const full = await createHoldAs('residentA', { facilityKey: 'hall', daysAhead: 5, start: '06:00', end: '22:00', headcount: 80 });
    expectStatus(full, 201);
    expect(priceOf(full)).toMatchObject({ baseAmount: 5000, depositAmount: 2000, totalAmount: 7000 });
  });

  it('refuses more guests than the venue holds', async () => {
    expectStatus(await createHoldAs('residentB', { facilityKey: 'hall', daysAhead: 7, start: '06:00', end: '22:00', headcount: 180 }), 400);
  });

  it('never double-books the hall when two residents race for the same day', async () => {
    const input: HoldInput = { facilityKey: 'hall', daysAhead: 6, start: '06:00', end: '22:00', headcount: 40 };
    const results = await Promise.all([createHoldAs('residentA', input), createHoldAs('residentB', input), createHoldAs('crossAdmin', input)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  });

  it('enforces the minimum notice period', async () => {
    const facilities = await amenityCollection('facilities');
    await facilities.updateOne({ _id: oid(facility('hall').id) }, { $set: { minNoticeHours: 72 } });
    try {
      const res = await createHoldAs('residentB', { facilityKey: 'hall', daysAhead: 2, start: '06:00', end: '22:00', headcount: 10 });
      expectStatus(res, 400);
      expect(res.body.message).toMatch(/72 hour/);
    } finally {
      await facilities.updateOne({ _id: oid(facility('hall').id) }, { $set: { minNoticeHours: 24 } });
    }
  });

  it('offers only the published sessions of a session venue, each at its own price', async () => {
    const slots = await amenityApiAs('residentA', 'GET', `/availability/daily-slots?facilityId=${facility('hallSessions').id}&date=${istDate(4)}`);
    expect(slots.body.data.slots.map((s: any) => [s.label, s.start, s.end])).toEqual([
      ['Morning', '08:00', '13:00'],
      ['Evening', '16:00', '22:00'],
    ]);
    expectStatus(await createHoldAs('residentA', { facilityKey: 'hallSessions', daysAhead: 4, start: '10:00', end: '12:00' }), 400);
    const evening = await createHoldAs('residentA', { facilityKey: 'hallSessions', daysAhead: 4, start: '16:00', end: '22:00', headcount: 30 });
    expectStatus(evening, 201);
    expect(priceOf(evening)).toMatchObject({ baseAmount: 4500, totalAmount: 4500 });
  });
});

describe('P2a ROOM_RESOURCE: rooms book independently; overnight suites by the night', () => {
  it('requires choosing a room when the facility has several', async () => {
    expectStatus(await createHoldAs('residentA', { facilityKey: 'rooms', daysAhead: 3, start: '09:00', end: '10:00' }), 400);
  });

  it('books different rooms at the same time, but never the same room twice', async () => {
    const input: HoldInput = { facilityKey: 'rooms', daysAhead: 3, start: '09:00', end: '10:00', headcount: 4 };
    expectStatus(await createHoldAs('residentA', { ...input, resourceIndex: 0 }), 201);
    expectStatus(await createHoldAs('residentB', { ...input, resourceIndex: 1 }), 201);
    expectStatus(await createHoldAs('crossAdmin', { ...input, resourceIndex: 0 }), 409);
  });

  it('refuses more people than the room seats', async () => {
    expectStatus(await createHoldAs('residentA', { facilityKey: 'rooms', daysAhead: 3, start: '11:00', end: '12:00', headcount: 8, resourceIndex: 0 }), 400);
  });

  it('books an overnight suite from check-in to check-out, priced per night', async () => {
    const stay = await createHoldAs('residentA', { facilityKey: 'guestRoom', daysAhead: 5, endDaysAhead: 7, start: '14:00', end: '11:00', headcount: 2 });
    expectStatus(stay, 201);
    expect(priceOf(stay)).toMatchObject({ baseAmount: 3000, totalAmount: 3000 });
  });

  it('enforces check-in time and the maximum stay', async () => {
    expectStatus(await createHoldAs('residentB', { facilityKey: 'guestRoom', daysAhead: 9, endDaysAhead: 10, start: '12:00', end: '11:00' }), 400);
    expectStatus(await createHoldAs('residentB', { facilityKey: 'guestRoom', daysAhead: 10, endDaysAhead: 14, start: '14:00', end: '11:00' }), 400);
  });

  it('rejects an overlapping stay but allows the next check-in on the check-out day', async () => {
    expectStatus(await createHoldAs('residentB', { facilityKey: 'guestRoom', daysAhead: 6, endDaysAhead: 7, start: '14:00', end: '11:00' }), 409);
    expectStatus(await createHoldAs('residentB', { facilityKey: 'guestRoom', daysAhead: 7, endDaysAhead: 8, start: '14:00', end: '11:00' }), 201);
  });
});

describe('P2a INVENTORY_TOOLS: multi-day loans against stock, deposit even when free', () => {
  it('lends items across days and charges only the per-item deposit on a free facility', async () => {
    const loan = await createHoldAs('residentA', { facilityKey: 'tools', daysAhead: 2, endDaysAhead: 4, start: '10:00', end: '10:00', quantity: 2 });
    expectStatus(loan, 201);
    expect(priceOf(loan)).toMatchObject({ baseAmount: 0, depositAmount: 1000, totalAmount: 1000 });
  });

  it('counts stock that is out on loan on every day of the loan', async () => {
    const midLoan: HoldInput = { facilityKey: 'tools', daysAhead: 3, start: '10:00', end: '12:00' };
    const two = await createHoldAs('residentB', { ...midLoan, quantity: 2 });
    expectStatus(two, 409);
    expect(two.body.message).toMatch(/1 of 3/);
    expectStatus(await createHoldAs('residentB', { ...midLoan, quantity: 1 }), 201);
  });

  it('enforces the maximum loan period and a return during opening hours', async () => {
    expectStatus(await createHoldAs('crossAdmin', { facilityKey: 'tools', daysAhead: 5, endDaysAhead: 8, start: '10:00', end: '18:00' }), 400);
    expectStatus(await createHoldAs('crossAdmin', { facilityKey: 'tools', daysAhead: 5, endDaysAhead: 6, start: '10:00', end: '21:00' }), 400);
  });
});
