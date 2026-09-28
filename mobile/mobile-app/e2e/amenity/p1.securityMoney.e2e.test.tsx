/**
 * P1 — Critical security and money guards for the amenity module.
 * Probes the API the way a hostile or mistaken client would; every expectation is the
 * secure behaviour, so a failure here is a live vulnerability.
 */
import { actor, fixture } from '../helpers/session';
import { apiAs } from '../helpers/backend';
import { collection, oid, closeDb } from '../helpers/db';
import { amenityApiAs, bookAs, facility, amenityCollection, eventually, walletBalance, istDate } from '../helpers/amenity';

afterAll(closeDb);

describe('P1 roles: residents never get amenity admin powers', () => {
  it('seeds the default Resident Owner / Tenant roles without the admin "amenities:amenities" permission', async () => {
    // The E2E seed builds tenant roles from the same defaults new communities get.
    const roles = await collection('roles');
    const perms = await collection('permissions');
    const rolePerms = await collection('rolepermissions');
    const adminPerm = await perms.findOne({ name: 'amenities:amenities' });
    // 'Resident Tenant' is seeded the legacy way (with the grant); the boot self-heal must strip it.
    for (const name of ['Resident Owner', 'Family Member', 'Resident Tenant']) {
      const role = await roles.findOne({ name, orgId: oid(fixture().orgs.A) });
      expect({ name, hasAdmin: !!(await rolePerms.findOne({ roleId: role!._id, permissionId: adminPerm!._id })) })
        .toEqual({ name, hasAdmin: false });
    }
  });

  it.each([
    ['create a facility', 'POST', '/facilities', { name: 'Hack', code: 'HACK', archetype: 'SHARED_CAPACITY', isDraft: true }],
    ['delete a resource', 'DELETE', () => `/resources/${facility('rooms').resourceIds[0]}`, undefined],
    ['read maintenance internals', 'GET', '/maintenance', undefined],
  ])('forbids a resident to %s', async (_label, method, path, body) => {
    const res = await amenityApiAs('residentA', method as string, typeof path === 'function' ? path() : (path as string), body);
    expect(res.status).toBe(403);
  });
});

describe('P1 tenancy: admin rights in one community never leak into another', () => {
  let bReservationId: string;

  beforeAll(async () => {
    const booked = await bookAs('residentB', { facilityKey: 'gym', start: '09:00', end: '10:00' });
    bReservationId = String(booked.reservation._id);
  });

  it('lists only my own reservations when I am an admin elsewhere but a resident here', async () => {
    const res = await amenityApiAs('crossAdmin', 'GET', '/reservations?limit=100');
    expect(res.status).toBe(200);
    const ids = (res.body.data?.data || res.body.data?.items || []).map((r: any) => String(r._id));
    expect(ids).not.toContain(bReservationId);
  });

  it('refuses to open or cancel another resident\'s reservation for a cross-community admin', async () => {
    expect((await amenityApiAs('crossAdmin', 'GET', `/reservations/${bReservationId}`)).status).toBe(403);
    expect((await amenityApiAs('crossAdmin', 'POST', `/reservations/${bReservationId}/cancel`, { reason: 'x' })).status).toBe(403);
    const r = await (await amenityCollection('reservations')).findOne({ _id: oid(bReservationId) });
    expect(r!.bookingStatus).toBe('CONFIRMED');
  });

  it('hides another community\'s reservation completely', async () => {
    expect((await amenityApiAs('residentOther', 'GET', `/reservations/${bReservationId}`)).status).toBe(404);
  });
});

describe('P1 money: reading a reservation never moves money', () => {
  it('does not credit the wallet when a REFUND_PENDING reservation is read, even concurrently', async () => {
    const booked = await bookAs('residentB', { facilityKey: 'gym', start: '11:00', end: '12:00' });
    const id = String(booked.reservation._id);
    const reservations = await amenityCollection('reservations');
    await reservations.updateOne(
      { _id: oid(id) },
      { $set: { bookingStatus: 'CANCELLED', paymentStatus: 'REFUND_PENDING', paymentMethod: 'RAZORPAY', totalAmount: 700, paidAmount: 700 } }
    );
    const before = await walletBalance('residentB');

    await Promise.all([1, 2, 3].map(() => amenityApiAs('residentB', 'GET', `/reservations/${id}`)));
    await amenityApiAs('residentOther', 'GET', `/reservations/${id}`);

    expect(await walletBalance('residentB')).toBe(before);
    expect((await reservations.findOne({ _id: oid(id) }))!.paymentStatus).toBe('REFUND_PENDING');
  });

  it('does not rewrite the price or paid amount of a reservation when it is read', async () => {
    const booked = await bookAs('residentB', { facilityKey: 'gym', start: '13:00', end: '14:00' });
    const id = String(booked.reservation._id);
    const reservations = await amenityCollection('reservations');
    // A free booking on a facility whose price later changes must keep its original amounts.
    await (await amenityCollection('facilities')).updateOne(
      { _id: oid(facility('gym').id) },
      { $set: { 'pricingConfig.pricingType': 'HOURLY', 'pricingConfig.baseRate': 250 } }
    );
    try {
      await amenityApiAs('residentB', 'GET', `/reservations/${id}`);
      await amenityApiAs('residentB', 'GET', '/reservations?limit=50');
      await new Promise((r) => setTimeout(r, 500));
      const r = await reservations.findOne({ _id: oid(id) });
      expect({ total: r!.totalAmount, paid: r!.paidAmount || 0 }).toEqual({ total: 0, paid: 0 });
    } finally {
      await (await amenityCollection('facilities')).updateOne(
        { _id: oid(facility('gym').id) },
        { $set: { 'pricingConfig.pricingType': 'FREE', 'pricingConfig.baseRate': 0 } }
      );
    }
  });

  it('does not accept an unsigned "payment" callback that marks a reservation paid', async () => {
    const booked = await bookAs('residentB', { facilityKey: 'gym', start: '15:00', end: '16:00' });
    const id = String(booked.reservation._id);
    const res = await amenityApiAs(null, 'POST', '/payments/webhook', {
      orgId: actor('residentB').orgId,
      reservationId: id,
      paymentReference: 'pay_forged_1',
      status: 'PAID',
      paymentAmount: 99999,
    });
    // The route no longer exists outside authentication (401 unauthenticated / 404 otherwise).
    expect([401, 404]).toContain(res.status);
    const authed = await amenityApiAs('residentB', 'POST', '/payments/webhook', { reservationId: id, status: 'PAID' });
    expect(authed.body.success).not.toBe(true);
    const r = await (await amenityCollection('reservations')).findOne({ _id: oid(id) });
    expect(r!.paymentStatus).not.toBe('PAID');
  });

  it('charges the server price on the legacy booking endpoint, ignoring a client-supplied price', async () => {
    const before = await walletBalance('residentA');
    const res = await apiAs('residentA', 'POST', '/amenity-bookings', {
      amenityId: facility('court').id,
      bookingDate: istDate(2),
      startTime: '07:00',
      endTime: '08:00',
      numberOfPersons: 1,
      paymentMethod: 'WALLET',
      pricingDetails: { baseAmount: 1, taxAmount: 0, securityDeposit: 0, totalAmount: 1 },
    });
    if (res.status === 201) {
      expect(before! - (await walletBalance('residentA'))!).toBe(300);
    } else {
      // Rejecting the legacy path outright is also acceptable; it must never charge ₹1.
      expect(await walletBalance('residentA')).toBe(before);
    }
  });
});

describe('P1 gate: pass lookup is scoped to the guard\'s community', () => {
  it('does not resolve another community\'s reservation from a typed number or id', async () => {
    const other = await bookAs('residentOther', { facilityKey: 'poolOther', start: '09:00', end: '10:00' }, { paymentMethod: 'WALLET' });
    const otherNumber = other.reservation.reservationNumber;

    // Reservation numbers restart per community, so the same number may exist here:
    // it must resolve to this community's reservation (or nothing), never the other one.
    const byNumber = await amenityApiAs('guardA', 'POST', '/passes/check-in', { rawToken: otherNumber });
    expect(String(byNumber.body.message)).not.toMatch(/different organization|community/i);
    const passes = await amenityCollection('access_passes');
    const otherPass = await passes.findOne({ reservationId: oid(String(other.reservation._id)) });
    expect(otherPass!.checkInTimestamp ?? null).toBeNull();

    const byId = await amenityApiAs('guardA', 'POST', '/passes/check-in', { rawToken: String(other.reservation._id) });
    expect({ status: byId.status, leaks: /different organization|community/i.test(String(byId.body.message)) })
      .toEqual({ status: 404, leaks: false });
  });

  it('matches a typed reservation number exactly, never by a shared numeric suffix', async () => {
    const mine = await bookAs('residentA', { facilityKey: 'gym', start: '17:00', end: '18:00' });
    const seq = String(mine.reservation.reservationNumber).split('-').pop();
    const res = await amenityApiAs('guardA', 'POST', '/passes/check-in', { rawToken: `9${seq}` });
    expect(res.status).toBe(404);
  });
});

describe('P1 audit: security logs cannot be tampered with by guards', () => {
  it('refuses a guard deleting a security log', async () => {
    const created = await apiAs('guardA', 'POST', '/security-logs/manual', {
      reason: 'Manual Override', remarks: 'e2e manual entry',
    });
    const logs = await collection('securitylogs');
    const log = (created.body as any).log || created.body.data;
    expect({ status: created.status, id: log?._id ? 'ok' : created.body }).toEqual({ status: 200, id: 'ok' });
    const del = await apiAs('guardA', 'DELETE', `/security-logs/${log._id}`);
    expect(del.status).toBe(403);
    expect(await logs.countDocuments({ _id: oid(String(log._id)) })).toBe(1);
  });
});

describe('P1 legacy surface', () => {
  it('no longer exposes the permission-less /bookings API', async () => {
    // Unknown /api paths fall through to the Swagger UI page, so assert on the payload.
    const list = await apiAs('residentA', 'GET', '/bookings');
    expect(list.body.success).not.toBe(true);
    expect(Array.isArray(list.body.data)).toBe(false);
    const create = await apiAs('residentA', 'PUT', `/bookings/${facility('gym').id}/status`, { status: 'cancelled' });
    expect(create.body.success).not.toBe(true);
  });

  it('does not let an admin move a resource into another community\'s facility', async () => {
    const resourceId = facility('rooms').resourceIds[0];
    await amenityApiAs('adminA', 'PATCH', `/resources/${resourceId}`, { facilityId: facility('poolOther').id, name: 'Room A' });
    const r = await (await amenityCollection('resources')).findOne({ _id: oid(resourceId) });
    expect(String(r!.facilityId)).toBe(facility('rooms').id);
    expect(String(r!.orgId)).toBe(fixture().orgs.A);
  });
});

describe('P1 outbox: facility lifecycle events never dead-letter', () => {
  it('publishes FACILITY_CREATED / FACILITY_PUBLISHED events', async () => {
    const outbox = await amenityCollection('outbox_events');
    await eventually(
      async () => (await outbox.countDocuments({ eventType: /^FACILITY_/, status: { $in: ['PENDING', 'PROCESSING'] } })) === 0,
      20000,
      'facility events processed'
    );
    expect(await outbox.countDocuments({ eventType: /^FACILITY_/, status: 'DEAD_LETTER' })).toBe(0);
  });
});
