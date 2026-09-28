/**
 * P6 — Admin console: community pass registry, admin revoke, blacklist management,
 * walk-in oversight and gate analytics, all against the real backend.
 */
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import CommunityPassesScreen from '@/app/(resident)/visitor/admin/community-passes';
import BlacklistScreen from '@/app/(resident)/visitor/admin/blacklist';
import AdminAnalyticsScreen from '@/app/(resident)/visitor/admin/analytics';
import WalkInApprovalsScreen from '@/app/(resident)/visitor/walk-ins';
import { renderScreen } from '../helpers/render';
import { signInAs, actor, store } from '../helpers/session';
import { findCalls, lastCall } from '../helpers/api';
import { tap, typeInto } from '../helpers/ui';
import { apiAs, createGuestPassAs } from '../helpers/backend';
import { collection, oid, closeDb } from '../helpers/db';

afterAll(closeDb);

const orgA = () => oid(actor('adminA').orgId);

describe('P6 admin console', () => {
  it('community pass registry lists every villa’s passes with real names and codes', async () => {
    const alpha = await createGuestPassAs('residentA', { visitorDetails: { name: 'Comm Alpha' } });
    const beta = await createGuestPassAs('residentB', { visitorDetails: { name: 'Comm Beta' } });
    await signInAs('adminA');
    const view = await renderScreen(<CommunityPassesScreen />);

    expect(await view.findByText('Comm Alpha')).toBeOnTheScreen();
    expect(view.getByText('Comm Beta')).toBeOnTheScreen();
    expect(view.getByText(new RegExp(`Code: ${alpha.shortKey}|${alpha.shortKey}`))).toBeOnTheScreen();
    expect(view.getByText(new RegExp(`Code: ${beta.shortKey}|${beta.shortKey}`))).toBeOnTheScreen();
  });

  it('admin revokes a resident’s pass with one confirmation, recorded with a reason', async () => {
    const target = await createGuestPassAs('residentB', { visitorDetails: { name: 'Admin Revokes Me' } });
    const adminA = await signInAs('adminA');
    const view = await renderScreen(<CommunityPassesScreen />);

    await tap(view, 'Admin Revokes Me');
    await tap(view, /^Revoke Visitor Pass/);
    await tap(view, 'Revoke Pass');

    await waitFor(() => expect(lastCall('PATCH', `/visitor-pass/${target._id}/status`)?.status).toBe(200));
    expect(view.queryByText('Force Revoke Pass?')).toBeNull();
    expect(findCalls('PATCH', `/visitor-pass/${target._id}/status`)).toHaveLength(1);
    const pass = await (await collection('visitorpasses')).findOne({ _id: oid(target._id) });
    expect(pass.status).toBe('REVOKED');
    expect(pass.statusHistory.at(-1)).toMatchObject({ actorId: oid(adminA.id), reason: expect.stringMatching(/admin/i) });
  });

  describe('blacklist', () => {
    it('lists every entry, not just the first page', async () => {
      await (await collection('blacklists')).deleteMany({ orgId: orgA() });
      for (let i = 1; i <= 12; i++) {
        const res = await apiAs('adminA', 'POST', '/blacklist', { orgId: actor('adminA').orgId, name: `Listed ${i}`, reason: 'Test' });
        expect(res.status).toBe(201);
      }
      await signInAs('adminA');
      const view = await renderScreen(<BlacklistScreen />);

      expect(await view.findByText('Listed 12')).toBeOnTheScreen();
      // The list is virtualised (first rows render until scrolled), so check what the screen loaded.
      await waitFor(() => expect((store.getState() as any).visitorPass.admin.blacklist).toHaveLength(12));
      expect(lastCall('GET', '/blacklist/org/')!.responseBody.data.data).toHaveLength(12);
    });

    it('adds a visitor through the form, rejects a duplicate with a reason, and removes an entry', async () => {
      await (await collection('blacklists')).deleteMany({ orgId: orgA() });
      await signInAs('adminA');
      const view = await renderScreen(<BlacklistScreen />);

      await tap(view, 'Add Entry');
      await typeInto(view, 'e.g. Alexander Wright', 'Barred Barry');
      await typeInto(view, 'e.g. 9876543210', '9877777777');
      await typeInto(view, 'Describe reason for restricting entry...', 'Harassed staff');
      await tap(view, 'Add to Blacklist');
      await waitFor(() => expect(lastCall('POST', '/blacklist')?.status).toBe(201));
      expect(await (await collection('blacklists')).findOne({ orgId: orgA(), phone: '9877777777' })).toMatchObject({
        name: 'Barred Barry',
        reason: 'Harassed staff',
        createdById: oid(actor('adminA').id),
      });
      expect(await view.findByText('Barred Barry')).toBeOnTheScreen();

      await tap(view, 'Add Entry');
      await typeInto(view, 'e.g. Alexander Wright', 'Barred Barry');
      await typeInto(view, 'Describe reason for restricting entry...', 'Again');
      await tap(view, 'Add to Blacklist');
      await waitFor(() => expect(lastCall('POST', '/blacklist')?.status).toBe(400));
      expect(await view.findByText(/already exists/i)).toBeOnTheScreen();

      await fireEvent.press(view.getByLabelText('Remove Barred Barry from blacklist'));
      const confirm = await view.findAllByText(/^Remove/);
      await fireEvent.press(confirm[confirm.length - 1]);
      await waitFor(() => expect(lastCall('DELETE', '/blacklist/')?.status).toBe(200));
      expect(await (await collection('blacklists')).countDocuments({ orgId: orgA(), phone: '9877777777' })).toBe(0);
    });
  });

  it('admin sees every resident’s walk-in and can approve on the host’s behalf', async () => {
    await (await collection('visitorlogs')).updateMany({ logStatus: 'PENDING' }, { $set: { logStatus: 'REJECTED' } });
    const forB = await apiAs('guardA', 'POST', '/visitor-log/walk-in', {
      residentId: actor('residentB').id,
      snapshot: { visitorName: 'For Bhavna' },
    });
    const adminA = await signInAs('adminA');
    const view = await renderScreen(<WalkInApprovalsScreen />);

    expect(await view.findByText('For Bhavna')).toBeOnTheScreen();
    await tap(view, 'Approve');

    await waitFor(() => expect(lastCall('PATCH', `/visitor-log/walk-in/${forB.body.data._id}/resolve`)?.status).toBe(200));
    const log = await (await collection('visitorlogs')).findOne({ _id: oid(forB.body.data._id) });
    expect(log.logStatus).toBe('INSIDE');
    expect(log.actionHistory.at(-1)).toMatchObject({ action: 'APPROVED', actorId: oid(adminA.id) });
  });

  it('analytics reflect the real gate state: entries today, inside, pending, blacklist and peak hour', async () => {
    // Arrange a known state: two entries today (one still inside), one pending walk-in.
    const logs = await collection('visitorlogs');
    await logs.updateMany({ logStatus: { $in: ['INSIDE', 'PENDING'] } }, { $set: { logStatus: 'COMPLETED' } });
    for (const name of ['Stat One', 'Stat Two']) {
      const pass = await createGuestPassAs('residentA', { visitorDetails: { name } });
      expect((await apiAs('guardA', 'POST', '/visitor-log/pre-approved', { passId: pass._id })).status).toBe(201);
    }
    const first = await logs.findOne({ 'snapshot.visitorName': 'Stat One' });
    expect((await apiAs('guardA', 'PATCH', `/visitor-log/${first._id}/checkout`, {})).status).toBe(200);
    await apiAs('guardA', 'POST', '/visitor-log/walk-in', { residentId: actor('residentA').id, snapshot: { visitorName: 'Stat Pending' } });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const expected = {
      totalEntriesToday: await logs.countDocuments({ orgId: orgA(), checkInTime: { $gte: startOfDay } }),
      activeInsideCount: await logs.countDocuments({ orgId: orgA(), logStatus: 'INSIDE' }),
      pendingApprovalsCount: await logs.countDocuments({ orgId: orgA(), logStatus: 'PENDING' }),
      totalBlacklistedCount: await (await collection('blacklists')).countDocuments({ orgId: orgA() }),
    };

    await signInAs('adminA');
    const view = await renderScreen(<AdminAnalyticsScreen />);
    await waitFor(() => expect((store.getState() as any).visitorPass.admin.analytics).toBeTruthy());
    const analytics = (store.getState() as any).visitorPass.admin.analytics;

    expect(analytics).toMatchObject(expected);
    const hour = new Date().getHours();
    expect(analytics.peakHour).toContain(`${String(hour).padStart(2, '0')}:00`);
    expect(analytics.hourlyArrivals.reduce((sum: number, b: any) => sum + b.value, 0)).toBe(expected.totalEntriesToday);
    expect(await view.findByText(analytics.peakHour)).toBeOnTheScreen();
  });
});
