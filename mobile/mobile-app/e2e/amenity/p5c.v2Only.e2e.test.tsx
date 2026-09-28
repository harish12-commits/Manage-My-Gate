/**
 * P5c — Amenities are V2-only: V2 bookings and cancellations no longer write mirror
 * documents into the legacy amenity_bookings collection, the legacy booking endpoints
 * refuse managed (V2) facilities instead of creating bookings V2 availability cannot
 * see, and the V2 reservation list contains V2 reservations only, paginated by the server.
 */
import { closeDb, collection, oid } from '../helpers/db';
import { apiAs } from '../helpers/backend';
import { actor } from '../helpers/session';
import { amenityApiAs, bookAs, facility, istDate } from '../helpers/amenity';

afterAll(closeDb);

const legacyBookings = () => collection('amenity_bookings');

describe('P5c no legacy mirror', () => {
  it('confirms and cancels a V2 booking without touching amenity_bookings', async () => {
    const { reservation } = await bookAs('residentB', { facilityKey: 'pool', daysAhead: 5, start: '19:00', end: '20:00' }, { paymentMethod: 'WALLET' });
    expect(await (await legacyBookings()).findOne({ _id: oid(reservation._id) })).toBeNull();

    const cancel = await amenityApiAs('residentB', 'POST', `/reservations/${reservation._id}/cancel`, { reason: 'P5c' });
    expect(cancel.status).toBe(200);
    expect(await (await legacyBookings()).findOne({ _id: oid(reservation._id) })).toBeNull();
  });
});

describe('P5c legacy booking endpoints refuse managed facilities', () => {
  it('rejects a resident booking and a manual booking without creating anything', async () => {
    const before = await (await legacyBookings()).countDocuments({});
    const resident = await apiAs('residentA', 'POST', '/amenity-bookings', {
      amenityId: facility('court').id,
      bookingDate: istDate(3),
      startTime: '15:00',
      endTime: '16:00',
      numberOfPersons: 1,
      paymentMethod: 'WALLET',
    });
    expect(resident.status).toBe(410);

    const manual = await apiAs('adminA', 'POST', '/amenity-bookings/manual', {
      amenityId: facility('court').id,
      residentId: actor('residentA').id,
      bookingDate: istDate(3),
      startTime: '16:00',
      endTime: '17:00',
      numberOfPersons: 1,
    });
    expect(manual.status).toBe(410);

    expect(await (await legacyBookings()).countDocuments({})).toBe(before);
    const reservations = await collection('amenity_management_reservations');
    expect(
      await reservations.countDocuments({ facilityId: oid(facility('court').id), requestedStartDateTime: { $gte: new Date(`${istDate(3)}T09:00:00.000Z`), $lt: new Date(`${istDate(3)}T12:00:00.000Z`) } })
    ).toBe(0);
  });
});

describe('P5c V2 reservation list', () => {
  it('lists V2 reservations only and paginates on the server', async () => {
    // A stray legacy document for the same resident must not appear in the V2 list.
    const stray = await (await legacyBookings()).insertOne({
      orgId: oid(actor('residentB').orgId),
      userId: oid(actor('residentB').id),
      amenityId: oid(facility('court').id),
      bookingDate: istDate(4),
      startTime: '10:00',
      endTime: '11:00',
      status: 'confirmed',
      createdAt: new Date(Date.now() + 60000),
    });

    const all = await amenityApiAs('residentB', 'GET', `/reservations?residentId=${actor('residentB').id}&limit=100`);
    expect(all.status).toBe(200);
    const items: any[] = all.body.data.items;
    expect(items.some((r) => String(r._id) === String(stray.insertedId))).toBe(false);
    const total = await (await collection('amenity_management_reservations')).countDocuments({
      orgId: oid(actor('residentB').orgId),
      residentId: oid(actor('residentB').id),
    });
    expect(all.body.data.total ?? all.body.data.pagination?.total).toBe(total);

    const page2 = await amenityApiAs('residentB', 'GET', `/reservations?residentId=${actor('residentB').id}&limit=2&page=2`);
    expect(page2.status).toBe(200);
    expect(page2.body.data.items.map((r: any) => String(r._id))).toEqual(items.slice(2, 4).map((r) => String(r._id)));
  });
});
