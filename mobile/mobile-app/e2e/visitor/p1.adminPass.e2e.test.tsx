/**
 * P1 — Admin pass creation: community-wide and villa-targeted passes issued from the
 * admin create-pass screen against the real backend.
 */
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import AdminCreatePassScreen from '@/app/(resident)/visitor/admin/create-pass';
import { renderScreen } from '../helpers/render';
import { signInAs, actor, fixture } from '../helpers/session';
import { findCalls, lastCall } from '../helpers/api';
import { tap, typeInto } from '../helpers/ui';
import { collection, oid, closeDb } from '../helpers/db';

afterAll(closeDb);

type View = Awaited<ReturnType<typeof renderScreen>>;

/** Fills the guest steps that follow the admin scope step and submits. */
const completeGuestSteps = async (view: View, name: string) => {
  await typeInto(view, 'e.g. Ramesh Chandra', name);
  await tap(view, 'Continue'); // → schedule
  await tap(view, 'Continue'); // → options
  await tap(view, 'Continue'); // → review
  await tap(view, 'Generate Pass');
  await waitFor(() => expect(findCalls('POST', '/visitor-pass').length).toBe(1));
  const create = lastCall('POST', '/visitor-pass')!;
  expect({ status: create.status, body: create.status === 201 ? 'ok' : create.responseBody }).toEqual({ status: 201, body: 'ok' });
  return (await collection('visitorpasses')).findOne({ _id: oid(create.responseBody.data._id) });
};

/** Picks a villa row in the currently open villa sheet. */
const pickVilla = async (view: View, unit: string) => {
  const rows = await view.findAllByText(new RegExp(`^Villa ${unit}\\b`));
  await fireEvent.press(rows[rows.length - 1]);
};

describe('P1 admin passes — admin create-pass screen → backend', () => {
  it('issues a community-wide admin guest pass with no villa', async () => {
    const adminA = await signInAs('adminA');
    const view = await renderScreen(<AdminCreatePassScreen />);

    await tap(view, 'Continue'); // scope: community (default)
    const pass = await completeGuestSteps(view, 'Event Caterer');

    expect(pass).toMatchObject({ passType: 'ADMIN_GUEST', orgId: oid(adminA.orgId), createdById: oid(adminA.id) });
    expect(pass.villaId ?? null).toBeNull();
  });

  it('issues a pass for a specific villa chosen in the scope step', async () => {
    await signInAs('adminA');
    const view = await renderScreen(<AdminCreatePassScreen />);

    await tap(view, 'Specific Villa Unit');
    await tap(view, 'Select Destination Unit & Host *');
    await pickVilla(view, 'A-102');
    // The header reflects the scope-step choice instead of still claiming a community pass.
    expect(view.queryByText('Community Common Area')).toBeNull();
    await tap(view, 'Continue');
    const pass = await completeGuestSteps(view, 'Plumber For B');

    expect(pass).toMatchObject({ passType: 'GUEST', villaId: oid(actor('residentB').villaId!) });
  });

  it('requires a villa when the admin picks villa scope', async () => {
    await signInAs('adminA');
    const view = await renderScreen(<AdminCreatePassScreen />);

    await tap(view, 'Specific Villa Unit');
    await tap(view, 'Continue');

    expect(await view.findByText('Please select a target villa unit and host resident.')).toBeOnTheScreen();
    expect(findCalls('POST', '/visitor-pass')).toHaveLength(0);
  });

  it('honours the villa chosen in the "Target Destination" header', async () => {
    await signInAs('adminA');
    const view = await renderScreen(<AdminCreatePassScreen />);

    await fireEvent.press(await view.findByLabelText('Change target destination'));
    await pickVilla(view, 'A-103');
    await waitFor(() => expect(view.queryByText('Community Common Area')).toBeNull());

    await tap(view, 'Continue');
    const pass = await completeGuestSteps(view, 'Header Target Guest');

    expect(pass.villaId).toEqual(oid(fixture().villas['A-103']));
  });
});

