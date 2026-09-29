/**
 * P1 — Pass creation for group, cab, delivery and service passes, each driven through
 * its resident wizard screen against the real backend.
 */
import React from 'react';
import { waitFor } from '@testing-library/react-native';
import InviteVisitorScreen from '@/app/(resident)/visitor/invite';
import CabPassScreen from '@/app/(resident)/visitor/cab-pass';
import DeliveryPassScreen from '@/app/(resident)/visitor/delivery-pass';
import StaffPassScreen from '@/app/(resident)/visitor/staff-pass';
import { renderScreen, nav } from '../helpers/render';
import { signInAs, ActorInfo } from '../helpers/session';
import { findCalls, lastCall } from '../helpers/api';
import { tap, typeInto, typePhone } from '../helpers/ui';
import { collection, oid, closeDb } from '../helpers/db';

afterAll(closeDb);

const MINUTE = 60 * 1000;

type View = Awaited<ReturnType<typeof renderScreen>>;

/** Submits the wizard's last step and returns the persisted pass, asserting the UI shows its code. */
const generateAndLoadPass = async (view: View, resident: ActorInfo) => {
  await tap(view, 'Generate Pass');
  await waitFor(() => expect(findCalls('POST', '/visitor-pass').length).toBe(1));
  const create = lastCall('POST', '/visitor-pass')!;
  expect({ status: create.status, body: create.status === 201 ? 'ok' : create.responseBody }).toEqual({ status: 201, body: 'ok' });

  const { _id, shortKey } = create.responseBody.data;
  expect(await view.findByText(`${shortKey.slice(0, 3)} ${shortKey.slice(3)}`)).toBeOnTheScreen();

  const pass = await (await collection('visitorpasses')).findOne({ _id: oid(_id) });
  expect(pass).toMatchObject({
    orgId: oid(resident.orgId),
    createdById: oid(resident.id),
    villaId: oid(resident.villaId!),
    status: 'PENDING',
  });
  return { pass, create };
};

describe('P1 other pass types — resident wizards → backend', () => {
  it('group pass: stores the guest list and the requested number of entries', async () => {
    const residentA = await signInAs('residentA');
    nav().params = { type: 'GROUP' };
    const view = await renderScreen(<InviteVisitorScreen />);

    await typeInto(view, 'e.g. Housewarming Party, Team Lunch', 'Housewarming');
    await typeInto(view, 'e.g. 20', '5');
    await tap(view, 'Continue'); // → schedule (full day)
    await tap(view, 'Continue'); // → guests
    await typeInto(view, 'e.g. Ananya Roy', 'Ananya Roy');
    await typePhone(view, 'group-guest-phone', '9876500001');
    await tap(view, 'Add Guest to List');
    await tap(view, 'Continue'); // → review

    const { pass } = await generateAndLoadPass(view, residentA);
    expect(pass).toMatchObject({
      passType: 'GUEST',
      isGroupPass: true,
      groupGuests: [expect.objectContaining({ name: 'Ananya Roy', phone: '+919876500001' })],
      usageLimit: expect.objectContaining({ maxUses: 5 }),
    });
  });

  it('group pass: cannot continue without at least one guest', async () => {
    await signInAs('residentA');
    nav().params = { type: 'GROUP' };
    const view = await renderScreen(<InviteVisitorScreen />);

    await typeInto(view, 'e.g. Housewarming Party, Team Lunch', 'Empty Party');
    await tap(view, 'Continue');
    await tap(view, 'Continue');
    await tap(view, 'Continue');

    expect(await view.findByText('Please add at least one guest to the group list.')).toBeOnTheScreen();
    expect(findCalls('POST', '/visitor-pass')).toHaveLength(0);
  });

  it('cab pass: stores the vehicle plate and a short arrival window', async () => {
    const residentA = await signInAs('residentA');
    const view = await renderScreen(<CabPassScreen />);

    await tap(view, 'Continue'); // provider (default) → vehicle
    await typeInto(view, 'e.g. KA-01-MJ-4920', 'ka-01-mj-4920');
    await tap(view, 'Continue'); // → schedule (arriving now)
    await tap(view, 'Continue'); // → review

    const startedAt = Date.now();
    const { pass } = await generateAndLoadPass(view, residentA);
    expect(pass).toMatchObject({ passType: 'CAB', vehicleDetails: expect.objectContaining({ number: 'KA-01-MJ-4920' }) });
    const validFor = new Date(pass.validity.endDate).getTime() - startedAt;
    expect(validFor).toBeGreaterThan(10 * MINUTE);
    expect(validFor).toBeLessThanOrEqual(60 * MINUTE);
  });

  it('delivery pass: stores the partner and order and expires after the chosen hour', async () => {
    const residentA = await signInAs('residentA');
    const view = await renderScreen(<DeliveryPassScreen />);

    await tap(view, 'Continue'); // partner (default) → details
    await typeInto(view, 'e.g. #ORD-992014', 'ORD-1001');
    await tap(view, 'Continue'); // → validity (1 hour)
    await tap(view, 'Continue'); // → review

    const startedAt = Date.now();
    const { pass } = await generateAndLoadPass(view, residentA);
    expect(pass).toMatchObject({
      passType: 'DELIVERY',
      deliveryDetails: expect.objectContaining({ orderId: 'ORD-1001' }),
    });
    expect(pass.deliveryDetails.partner).toBeTruthy();
    const validFor = new Date(pass.validity.endDate).getTime() - startedAt;
    expect(validFor).toBeGreaterThan(55 * MINUTE);
    expect(validFor).toBeLessThanOrEqual(65 * MINUTE);
  });

  it('service pass: stores the recurring weekdays, daily slot and date range', async () => {
    const residentA = await signInAs('residentA');
    const view = await renderScreen(<StaffPassScreen />);

    await typeInto(view, 'e.g. Sunita Devi, Ramesh Plumber', 'Sunita Devi');
    await typePhone(view, 'staff-phone', '9876500002');
    await tap(view, 'Continue'); // → category
    await tap(view, 'Continue'); // → date range (30 days)
    await tap(view, 'Continue'); // → weekdays (Mon–Sat)
    await tap(view, 'Continue'); // → daily slot (full day)
    await tap(view, 'Continue'); // → review

    const { pass } = await generateAndLoadPass(view, residentA);
    expect(pass).toMatchObject({
      passType: 'SERVICE',
      visitorDetails: expect.objectContaining({ name: 'Sunita Devi', phone: '+919876500002' }),
      validity: expect.objectContaining({ timeWindowStart: '07:00', timeWindowEnd: '20:00' }),
    });
    expect([...pass.validity.allowedDays].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pass.usageLimit.maxUses).toBeGreaterThan(1);
    const days = (new Date(pass.validity.endDate).getTime() - Date.now()) / (24 * 60 * MINUTE);
    expect(days).toBeGreaterThan(28);
    expect(days).toBeLessThan(32);
  });
});
