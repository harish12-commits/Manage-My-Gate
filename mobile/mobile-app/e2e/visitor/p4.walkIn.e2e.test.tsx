/**
 * P4 — Walk-in: guard registers an unannounced visitor, the host resident approves or
 * denies in real time, and the guard learns the outcome.
 */
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import GateConsoleScreen from '@/app/(resident)/visitor/gate-console';
import WalkInApprovalsScreen from '@/app/(resident)/visitor/walk-ins';
import { GuardWalkInStatusView } from '@/src/features/visitor/components/guard/GuardWalkInStatusView';
import { renderScreen } from '../helpers/render';
import { signInAs, actor } from '../helpers/session';
import { findCalls, lastCall } from '../helpers/api';
import { tap, typeInto } from '../helpers/ui';
import { apiAs } from '../helpers/backend';
import { connectAs, ActorSocket } from '../helpers/socket';
import { collection, oid, closeDb } from '../helpers/db';

type View = Awaited<ReturnType<typeof renderScreen>>;

const sockets: ActorSocket[] = [];
afterEach(() => sockets.splice(0).forEach((s) => s.close()));
afterAll(closeDb);

// Each test starts with no open walk-in requests, so lists show only what the test created.
beforeEach(async () => {
  await (await collection('visitorlogs')).updateMany({ logStatus: 'PENDING' }, { $set: { logStatus: 'REJECTED' } });
});

const logs = async () => collection('visitorlogs');

/** Guard fills the walk-in form on the console for a visitor to villa `unit`. */
const guardRegistersWalkIn = async (view: View, name: string, phone: string, unit = 'A-101') => {
  await fireEvent.press(await view.findByLabelText('Initiate Walk-In'));
  await tap(view, 'Choose Host');
  const rows = await view.findAllByText(new RegExp(`^Villa ${unit}\\b`));
  await fireEvent.press(rows[rows.length - 1]);
  await typeInto(view, 'e.g. Rahul Sharma', name);
  await typeInto(view, 'e.g. 9876543210', phone);
  await tap(view, 'Send Resident Request');
  await waitFor(() => expect(findCalls('POST', '/visitor-log/walk-in').length).toBe(1));
  return lastCall('POST', '/visitor-log/walk-in')!;
};

/** Arranges a pending walk-in for residentA via the API (for tests whose subject is the resident side). */
const pendingWalkIn = async (name: string) => {
  const res = await apiAs('guardA', 'POST', '/visitor-log/walk-in', {
    residentId: actor('residentA').id,
    snapshot: { visitorName: name, phone: '9866666666' },
  });
  expect(res.status).toBe(201);
  return res.body.data as { _id: string };
};

describe('P4 walk-in — guard request → resident decision → guard outcome', () => {
  it('guard sends a walk-in request to the host resident, who is alerted in real time', async () => {
    const resident = await connectAs('residentA');
    sockets.push(resident);
    await signInAs('guardA');
    const view = await renderScreen(<GateConsoleScreen />);

    const req = await guardRegistersWalkIn(view, 'Walkin Wendy', '9861111111');

    expect(req.status).toBe(201);
    // The console switches to its walk-in board, where the request now waits for the host.
    expect(await view.findByText('Walkin Wendy')).toBeOnTheScreen();
    expect(view.getByText('PENDING APPROVAL')).toBeOnTheScreen();
    const alert = await resident.waitForEvent('GATE_APPROVAL_REQUEST', (l) => l._id === req.responseBody.data._id);
    expect(alert.snapshot.visitorName).toBe('Walkin Wendy');

    const log = await (await logs()).findOne({ _id: oid(req.responseBody.data._id) });
    expect(log).toMatchObject({
      entryType: 'WALK_IN',
      logStatus: 'PENDING',
      residentId: oid(actor('residentA').id),
      guardId: oid(actor('guardA').id),
    });
    expect(log.snapshot.phone).toBe('9861111111');
    const note = await (await collection('notifications')).findOne({ recipientId: oid(actor('residentA').id), title: 'Gate Approval Required' });
    expect(note).toBeTruthy();
  });

  it('refuses a walk-in for a blacklisted phone number', async () => {
    const ban = await apiAs('adminA', 'POST', '/blacklist', {
      orgId: actor('adminA').orgId,
      name: 'Some Alias',
      phone: '9862222222',
      reason: 'Repeat trespass',
    });
    expect(ban.status).toBe(201);
    await signInAs('guardA');
    const view = await renderScreen(<GateConsoleScreen />);

    const req = await guardRegistersWalkIn(view, 'Different Name', '9862222222');

    expect(req.status).toBe(403);
    expect(await view.findByText(/blacklisted/i)).toBeOnTheScreen();
    expect(await (await logs()).countDocuments({ 'snapshot.visitorName': 'Different Name' })).toBe(0);
  });

  it('resident approves from their walk-in list; visitor is inside and the guard sees APPROVED live', async () => {
    const walkIn = await pendingWalkIn('Approve Arjun');
    const guard = await connectAs('guardA');
    sockets.push(guard);

    const residentA = await signInAs('residentA');
    const residentView = await renderScreen(<WalkInApprovalsScreen />);
    await residentView.findByText('Approve Arjun');
    await tap(residentView, 'Approve');

    await waitFor(() => expect(lastCall('PATCH', `/visitor-log/walk-in/${walkIn._id}/resolve`)?.status).toBe(200));
    const log = await (await logs()).findOne({ _id: oid(walkIn._id) });
    expect(log.logStatus).toBe('INSIDE');
    expect(log.checkInTime).toBeTruthy();
    expect(log.actionHistory.at(-1)).toMatchObject({ action: 'APPROVED', actorId: oid(residentA.id) });
    await waitFor(() => expect(residentView.queryByText('Approve Arjun')).toBeNull());

    const resolved = await guard.waitForEvent('GATE_APPROVAL_RESOLVED', (l) => l._id === walkIn._id);
    expect(resolved.logStatus).toBe('INSIDE');
  });

  it('guard’s walk-in board flips the request to DENIED BY HOST when the resident denies it', async () => {
    const walkIn = await pendingWalkIn('Deny Dev');
    await signInAs('guardA');
    const guardView = await renderScreen(<GuardWalkInStatusView />);
    await guardView.findByText('Deny Dev');
    // The board also lists today's earlier walk-ins, so count this request's new badge.
    const deniedBefore = guardView.queryAllByText('DENIED BY HOST').length;

    // The resident denies it from their own device.
    const denied = await apiAs('residentA', 'PATCH', `/visitor-log/walk-in/${walkIn._id}/resolve`, { action: 'REJECT' });
    expect(denied.status).toBe(200);

    await waitFor(() => expect(guardView.queryAllByText('DENIED BY HOST')).toHaveLength(deniedBefore + 1), { timeout: 5000 });
    expect(guardView.getByText('Deny Dev')).toBeOnTheScreen();
  });

  it('shows the resident why a decision failed when the request was already resolved', async () => {
    const walkIn = await pendingWalkIn('Stale Sita');
    await signInAs('residentA');
    const view = await renderScreen(<WalkInApprovalsScreen />);
    await view.findByText('Stale Sita');
    // Resolved elsewhere while this phone was offline, so no live update removed the card.
    await (await logs()).updateOne({ _id: oid(walkIn._id) }, { $set: { logStatus: 'REJECTED' } });

    await tap(view, 'Approve');

    await waitFor(() => expect(lastCall('PATCH', `/visitor-log/walk-in/${walkIn._id}/resolve`)?.status).toBe(400));
    expect(await view.findByText(/already resolved/i)).toBeOnTheScreen();
    expect((await (await logs()).findOne({ _id: oid(walkIn._id) })).logStatus).toBe('REJECTED');
  });

  it('keeps one resident’s walk-ins away from their neighbour', async () => {
    const walkIn = await pendingWalkIn('Private Priya');
    await signInAs('residentB');
    const view = await renderScreen(<WalkInApprovalsScreen />);

    await waitFor(() => expect(lastCall('GET', '/pending')?.status).toBe(200));
    expect(view.queryByText('Private Priya')).toBeNull();
    const hijack = await apiAs('residentB', 'PATCH', `/visitor-log/walk-in/${walkIn._id}/resolve`, { action: 'APPROVE' });
    expect(hijack.status).toBe(403);
    expect((await (await logs()).findOne({ _id: oid(walkIn._id) })).logStatus).toBe('PENDING');
  });

  it('guard’s walk-in board shows today’s outcomes even when decided while the app was closed', async () => {
    const approved = await pendingWalkIn('Closed App Anil');
    const denied = await pendingWalkIn('Closed App Dia');
    // Decided while no guard screen is open, so no live update can reach the board.
    expect((await apiAs('residentA', 'PATCH', `/visitor-log/walk-in/${approved._id}/resolve`, { action: 'APPROVE' })).status).toBe(200);
    expect((await apiAs('residentA', 'PATCH', `/visitor-log/walk-in/${denied._id}/resolve`, { action: 'REJECT' })).status).toBe(200);

    await signInAs('guardA');
    const board = await renderScreen(<GuardWalkInStatusView />);

    expect(await board.findByText('Closed App Anil')).toBeOnTheScreen();
    expect(board.getByText('Closed App Dia')).toBeOnTheScreen();
    expect(lastCall('GET', '/walk-ins')!.status).toBe(200);
    expect(board.getAllByText('APPROVED BY HOST').length).toBeGreaterThan(0);
    expect(board.getAllByText('DENIED BY HOST').length).toBeGreaterThan(0);
    expect(board.getAllByText(/^Approved at /).length).toBeGreaterThan(0);
    expect(board.getAllByText(/^Denied at /).length).toBeGreaterThan(0);
  });

  it('requires the guard to choose a host before sending', async () => {
    await signInAs('guardA');
    const view = await renderScreen(<GateConsoleScreen />);

    await fireEvent.press(await view.findByLabelText('Initiate Walk-In'));
    await typeInto(view, 'e.g. Rahul Sharma', 'No Host Nina');
    await typeInto(view, 'e.g. 9876543210', '9863333333');
    await tap(view, 'Send Resident Request');

    expect(await view.findByText('Please select target villa and resident host')).toBeOnTheScreen();
    expect(findCalls('POST', '/visitor-log/walk-in')).toHaveLength(0);
  });
});
