/**
 * P5 — Visitors inside and checkout: the guard's Inside list, checkout from the list and
 * from the console scan, pass expiry on the last use, and what residents see.
 */
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import GateConsoleScreen from '@/app/(resident)/visitor/gate-console';
import VisitorDashboardScreen from '@/app/(resident)/visitor/index';
import { InsideVisitorsView } from '@/src/features/visitor/components/guard/InsideVisitorsView';
import { encodeAppBarcode } from '@/src/utils/appBarcodeProtocol';
import { renderScreen } from '../helpers/render';
import { signInAs, actor } from '../helpers/session';
import { lastCall, resetApiLog } from '../helpers/api';
import { tap } from '../helpers/ui';
import { simulateScan } from '../helpers/camera';
import { apiAs, createGuestPassAs } from '../helpers/backend';
import { collection, oid, closeDb } from '../helpers/db';

afterAll(closeDb);

// Each test starts with nobody inside, so lists and counts show only what the test admitted.
beforeEach(async () => {
  await (await collection('visitorlogs')).updateMany({ logStatus: { $in: ['INSIDE', 'PENDING'] } }, { $set: { logStatus: 'COMPLETED' } });
});

/** Arranges a visitor who has entered on a fresh pass (setup, via the API). */
const admitted = async (name: string, overrides: Record<string, any> = {}) => {
  const pass = await createGuestPassAs('residentA', { visitorDetails: { name }, ...overrides });
  const entry = await apiAs('guardA', 'POST', '/visitor-log/pre-approved', { passId: pass._id });
  expect(entry.status).toBe(201);
  return { pass, logId: entry.body.data!._id as string };
};

const logById = async (id: string) => (await collection('visitorlogs')).findOne({ _id: oid(id) });
const passById = async (id: string) => (await collection('visitorpasses')).findOne({ _id: oid(id) });

describe('P5 inside & checkout', () => {
  it('lists who is inside with their host and checks a visitor out from the Inside list', async () => {
    const { pass, logId } = await admitted('Inside Ira');
    await signInAs('guardA');
    const view = await renderScreen(<InsideVisitorsView />);

    expect(await view.findByText('Inside Ira')).toBeOnTheScreen();
    expect(view.getByText(/Villa A-101.*Host: Ravi Resident/s)).toBeOnTheScreen();

    await fireEvent.press(view.getByLabelText('Check Out Visitor'));
    await tap(view, 'Confirm Check-Out');

    await waitFor(() => expect(lastCall('PATCH', `/visitor-log/${logId}/checkout`)?.status).toBe(200));
    const log = await logById(logId);
    expect(log.logStatus).toBe('COMPLETED');
    expect(log.checkOutTime).toBeTruthy();
    expect(log.actionHistory.at(-1)).toMatchObject({ action: 'CHECKED_OUT', actorId: oid(actor('guardA').id) });
    await waitFor(() => expect(view.queryByText('Inside Ira')).toBeNull());

    // Single-use pass: leaving uses it up, so it expires and its code stops working.
    expect((await passById(pass._id)).status).toBe('EXPIRED');
    expect(await (await collection('visitorpasstokens')).countDocuments({ passId: oid(pass._id) })).toBe(0);
    const note = await (await collection('notifications')).findOne({
      recipientId: oid(actor('residentA').id),
      title: 'Visitor Checked Out',
      body: /Inside Ira/,
    });
    expect(note).toBeTruthy();
  });

  it('keeps a multi-entry pass usable after the visitor leaves', async () => {
    const { pass, logId } = await admitted('Repeat Ruma', { usageLimit: { maxUses: 3 } });
    await signInAs('guardA');
    const view = await renderScreen(<InsideVisitorsView />);
    await view.findByText('Repeat Ruma');

    await fireEvent.press(view.getByLabelText('Check Out Visitor'));
    await tap(view, 'Confirm Check-Out');

    await waitFor(() => expect(lastCall('PATCH', `/visitor-log/${logId}/checkout`)?.status).toBe(200));
    expect(await passById(pass._id)).toMatchObject({ status: 'ACTIVE', usageLimit: expect.objectContaining({ currentUses: 1 }) });
    expect(await (await collection('visitorpasstokens')).countDocuments({ passId: oid(pass._id) })).toBe(1);
  });

  it('scanning the pass of a visitor who is inside offers a gate check-out', async () => {
    const { pass, logId } = await admitted('Exit Esha');
    await signInAs('guardA');
    const view = await renderScreen(<GateConsoleScreen />);

    await simulateScan(encodeAppBarcode('GUEST', pass.shortKey, pass._id, 'Exit Esha'));

    expect(await view.findByText('Visitor Currently On-Premises')).toBeOnTheScreen();
    // The console has its own 'Gate Check-Out' shortcut; the scan sheet's action is the last one.
    const checkOutButtons = view.getAllByLabelText('Gate Check-Out');
    await fireEvent.press(checkOutButtons[checkOutButtons.length - 1]);

    await waitFor(() => expect(lastCall('PATCH', `/visitor-log/${logId}/checkout`)?.status).toBe(200));
    expect(await view.findByText(/Exit Esha checked out successfully/)).toBeOnTheScreen();
    expect((await logById(logId)).logStatus).toBe('COMPLETED');
  });

  it('tells the guard when a checkout fails because the visitor already left', async () => {
    const { logId } = await admitted('Gone Gita');
    await signInAs('guardA');
    const view = await renderScreen(<InsideVisitorsView />);
    await view.findByText('Gone Gita');
    // Checked out at another gate after this list loaded.
    expect((await apiAs('guardA', 'PATCH', `/visitor-log/${logId}/checkout`, {})).status).toBe(200);

    await fireEvent.press(view.getByLabelText('Check Out Visitor'));
    await tap(view, 'Confirm Check-Out');

    await waitFor(() => expect(lastCall('PATCH', `/visitor-log/${logId}/checkout`)?.status).toBe(400));
    expect(await view.findByText(/not INSIDE/i)).toBeOnTheScreen();
  });

  it('a walk-in approved by the host appears inside and can be checked out', async () => {
    const req = await apiAs('guardA', 'POST', '/visitor-log/walk-in', {
      residentId: actor('residentA').id,
      snapshot: { visitorName: 'Walked Wasi' },
    });
    await apiAs('residentA', 'PATCH', `/visitor-log/walk-in/${req.body.data._id}/resolve`, { action: 'APPROVE' });
    await signInAs('guardA');
    const view = await renderScreen(<InsideVisitorsView />);

    expect(await view.findByText('Walked Wasi')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Check Out Visitor'));
    await tap(view, 'Confirm Check-Out');
    await waitFor(() => expect(lastCall('PATCH', `/visitor-log/${req.body.data._id}/checkout`)?.status).toBe(200));
  });

  it('residents’ “Inside Now” count covers only their own visitors', async () => {
    await admitted('Count Chitra');

    await signInAs('residentA');
    const aView = await renderScreen(<VisitorDashboardScreen />);
    await waitFor(() => expect(lastCall('GET', '/inside')?.status).toBe(200));
    const aInside = lastCall('GET', '/inside')!.responseBody.data;
    expect(aInside.map((l: any) => l.snapshot?.visitorName)).toEqual(['Count Chitra']);
    expect(aView.getByText('On Premises')).toBeOnTheScreen();
    await aView.unmount();
    resetApiLog();

    await signInAs('residentB');
    await renderScreen(<VisitorDashboardScreen />);
    await waitFor(() => expect(lastCall('GET', '/inside')?.status).toBe(200));
    expect(lastCall('GET', '/inside')!.responseBody.data).toEqual([]);
  });
});
