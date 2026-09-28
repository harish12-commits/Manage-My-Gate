/**
 * P7 — History and audit logs: the resident's pass history tabs and the admin gate audit
 * log, which must reflect real gate events (who entered, when, through which guard).
 */
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import VisitorHistoryScreen from '@/app/(resident)/visitor/history';
import AdminGateLogsScreen from '@/app/(resident)/visitor/admin-logs';
import { downloadCSVFile } from '@/src/utils/downloadHelper';
import { renderScreen } from '../helpers/render';
import { signInAs, actor } from '../helpers/session';
import { lastCall } from '../helpers/api';
import { tap, chooseFilter, typeInto } from '../helpers/ui';
import { apiAs, createGuestPassAs } from '../helpers/backend';
import { collection, oid, closeDb } from '../helpers/db';

// The CSV is handed to the platform's file/share layer; capture it instead.
jest.mock('@/src/utils/downloadHelper', () => ({ downloadCSVFile: jest.fn(async () => undefined) }));

afterAll(closeDb);

const logs = () => collection('visitorlogs');

describe('P7 history & audit logs', () => {
  it('moves an unused pass whose validity has ended from Upcoming to Completed', async () => {
    const stale = await createGuestPassAs('residentA', { visitorDetails: { name: 'Stale Sam' } });
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await (await collection('visitorpasses')).updateOne(
      { _id: oid(stale._id) },
      { $set: { 'validity.startDate': yesterday, 'validity.endDate': new Date(yesterday.getTime() + 60 * 60 * 1000) } }
    );
    await signInAs('residentA');
    const view = await renderScreen(<VisitorHistoryScreen />);

    await tap(view, 'Upcoming');
    await waitFor(() => expect(lastCall('GET', '/visitor-pass/org/')!.status).toBe(200));
    expect(view.queryByText('Stale Sam')).toBeNull();

    await tap(view, 'Expired');
    expect(await view.findByText('Stale Sam')).toBeOnTheScreen();
    const pass = await (await collection('visitorpasses')).findOne({ _id: oid(stale._id) });
    expect(pass.status).toBe('EXPIRED');
  });

  describe('admin gate audit log', () => {
    let visitLogId: string;
    let insideLogId: string;

    beforeAll(async () => {
      await (await logs()).updateMany({ logStatus: { $in: ['INSIDE', 'PENDING'] } }, { $set: { logStatus: 'COMPLETED' } });
      const visited = await createGuestPassAs('residentA', { visitorDetails: { name: 'Audit Visited' } });
      visitLogId = (await apiAs('guardA', 'POST', '/visitor-log/pre-approved', { passId: visited._id, gateName: 'North Gate' })).body.data._id;
      await apiAs('guardA', 'PATCH', `/visitor-log/${visitLogId}/checkout`, { gateName: 'North Gate' });

      const inside = await createGuestPassAs('residentB', { visitorDetails: { name: 'Audit Inside' } });
      insideLogId = (await apiAs('guardA', 'POST', '/visitor-log/pre-approved', { passId: inside._id })).body.data._id;

      const walkIn = await apiAs('guardA', 'POST', '/visitor-log/walk-in', {
        residentId: actor('residentA').id,
        snapshot: { visitorName: 'Audit Walkin' },
      });
      await apiAs('residentA', 'PATCH', `/visitor-log/walk-in/${walkIn.body.data._id}/resolve`, { action: 'REJECT' });
    });

    it('lists real gate events — visitors, walk-ins, guard, gate and unit', async () => {
      await signInAs('adminA');
      const view = await renderScreen(<AdminGateLogsScreen />);

      expect(await view.findByText('Audit Visited')).toBeOnTheScreen();
      expect(view.getByText('Audit Inside')).toBeOnTheScreen();
      expect(view.getByText('Audit Walkin')).toBeOnTheScreen();
      expect(lastCall('GET', `/visitor-log/org/${actor('adminA').orgId}`)!.status).toBe(200);
      expect(view.getAllByText(/Gopal Guard/).length).toBeGreaterThan(0);
      expect(view.getAllByText(/North Gate/).length).toBeGreaterThan(0);
      expect(view.getAllByText(/A-101/).length).toBeGreaterThan(0);
    });

    it('filters to visitors inside now and searches by guard', async () => {
      await signInAs('adminA');
      const view = await renderScreen(<AdminGateLogsScreen />);
      await view.findByText('Audit Visited');

      await chooseFilter(view, 'Inside Now');
      await waitFor(() => expect(view.queryByText('Audit Visited')).toBeNull());
      expect(view.getByText('Audit Inside')).toBeOnTheScreen();

      await chooseFilter(view, 'All Logs');
      await view.findByText('Audit Visited');
      await typeInto(view, /Search visitor/, 'gopal');
      expect(view.getByText('Audit Visited')).toBeOnTheScreen();
      await typeInto(view, /Search visitor/, 'nobody-by-that-name');
      await waitFor(() => expect(view.queryByText('Audit Visited')).toBeNull());
    });

    it('force-checks-out a visitor with a reason recorded in the audit trail', async () => {
      const adminA = await signInAs('adminA');
      const view = await renderScreen(<AdminGateLogsScreen />);
      await view.findByText('Audit Inside');

      await tap(view, 'Force Check-Out');
      const confirm = await view.findAllByText('Force Check-Out');
      await fireEvent.press(confirm[confirm.length - 1]);

      await waitFor(() => expect(lastCall('PATCH', `/visitor-log/${insideLogId}/checkout`)?.status).toBe(200));
      const log = await (await logs()).findOne({ _id: oid(insideLogId) });
      expect(log.logStatus).toBe('COMPLETED');
      expect(log.actionHistory.at(-1)).toMatchObject({
        action: 'CHECKED_OUT',
        actorId: oid(adminA.id),
        reason: 'Admin Emergency Force Checkout',
      });
    });

    it('exports a CSV with real check-in/out times and the guard', async () => {
      await signInAs('adminA');
      const view = await renderScreen(<AdminGateLogsScreen />);
      await view.findByText('Audit Visited');

      await tap(view, 'Export CSV');
      await waitFor(() => expect(downloadCSVFile).toHaveBeenCalled());
      const csv = String((downloadCSVFile as jest.Mock).mock.calls.at(-1)[0]);
      const visit = await (await logs()).findOne({ _id: oid(visitLogId) });
      const row = csv.split('\n').find((line) => line.includes('Audit Visited'))!;
      expect(row).toContain(new Date(visit.checkInTime).toLocaleString());
      expect(row).toContain(new Date(visit.checkOutTime).toLocaleString());
      expect(row).toContain('Gopal Guard');
      expect(row).toContain('North Gate');
    });
  });
});
