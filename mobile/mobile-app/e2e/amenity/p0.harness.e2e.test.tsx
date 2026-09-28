/**
 * P0 — Amenity harness smoke: the mobile app talks to the real backend, the seeded
 * facilities cover all five archetypes, transactions are available, and the
 * in-process amenity workers (hold expiry, outbox) run.
 */
import React from 'react';
import { waitFor } from '@testing-library/react-native';
import DiscoverAmenitiesScreen from '@/app/(resident)/amenities/discover';
import { renderScreen } from '../helpers/render';
import { signInAs, fixture, actor } from '../helpers/session';
import { lastCall } from '../helpers/api';
import { db, collection, oid, closeDb } from '../helpers/db';
import { createHoldAs, facility, amenityCollection, eventually, walletBalance } from '../helpers/amenity';

afterAll(closeDb);

describe('P0 amenity harness: mobile app ↔ real backend', () => {
  it('seeds one facility per archetype with its archetype resources', () => {
    const f = fixture().facilities!;
    expect([...new Set(Object.values(f).filter((x) => x.orgKey === 'A').map((x) => x.archetype))].sort()).toEqual(
      ['EVENT_SPACE', 'EXCLUSIVE_HOURLY', 'INVENTORY_TOOLS', 'ROOM_RESOURCE', 'SHARED_CAPACITY']
    );
    expect(facility('rooms').resourceIds).toHaveLength(2);
    expect(facility('tools').resourceIds).toHaveLength(1);
  });

  it('runs against a replica set so V2 transactions are real', async () => {
    const hello = await (await db()).admin().command({ hello: 1 });
    expect(hello.setName).toBeTruthy();
  });

  it('loads the resident Discover screen from the V2 facilities API with auth and org headers', async () => {
    const residentA = await signInAs('residentA');
    const view = await renderScreen(<DiscoverAmenitiesScreen />);

    await waitFor(() => expect(lastCall('GET', '/amenity-management/facilities')?.status).toBe(200));
    const call = lastCall('GET', '/amenity-management/facilities')!;
    expect(call.requestHeaders.Authorization).toBe(`Bearer ${fixture().sessions.residentA.token}`);
    expect(call.requestHeaders['x-organization-id']).toBe(residentA.orgId);

    expect(await view.findByText('Swimming Pool')).toBeOnTheScreen();
    expect(await view.findByText('Tennis Court')).toBeOnTheScreen();
    expect(view.queryByText('Draft Lounge')).toBeNull();
    expect(view.queryByText('Other Pool')).toBeNull();
  });

  it('seeds a wallet for every resident in both communities', async () => {
    // Balances change as later suites book; the seed itself is asserted by existence.
    for (const who of ['residentA', 'familyA', 'residentB', 'crossAdmin', 'residentOther'] as const) {
      expect({ who, hasWallet: typeof (await walletBalance(who)) === 'number' }).toEqual({ who, hasWallet: true });
    }
  });

  it('expires a stale hold and publishes its outbox event through the in-process workers', async () => {
    const res = await createHoldAs('residentB', { facilityKey: 'gym', start: '07:00', end: '08:00' });
    expect(res.status).toBe(201);
    const holdId = res.body.data?.hold?._id;
    expect(holdId).toBeTruthy();

    const holds = await amenityCollection('reservation_holds');
    await holds.updateOne({ _id: oid(holdId) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    await eventually(async () => (await holds.findOne({ _id: oid(holdId) }))?.status === 'EXPIRED', 15000, 'hold EXPIRED');

    const outbox = await amenityCollection('outbox_events');
    const event = await eventually(
      () => outbox.findOne({ eventType: 'HOLD_EXPIRED', aggregateId: oid(holdId), status: 'PUBLISHED' }),
      15000,
      'HOLD_EXPIRED published'
    );
    expect(event).toBeTruthy();

    const notifications = await collection('notifications');
    const note = await eventually(
      () => notifications.findOne({ recipientId: oid(actor('residentB').id), 'metadata.eventType': 'HOLD_EXPIRED' }),
      10000,
      'hold-expired notification'
    );
    expect(note).toBeTruthy();
  });
});
