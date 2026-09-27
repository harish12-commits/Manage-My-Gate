/**
 * P8 — Roles & tenancy: what each role can reach in the app, and what a hostile client
 * can do against the API and the real-time channel with a valid login.
 */
import React from 'react';
import { waitFor } from '@testing-library/react-native';
import GateConsoleScreen from '@/app/(resident)/visitor/gate-console';
import VisitorAdminLayout from '@/app/(resident)/visitor/admin/_layout';
import AdminGateLogsScreen from '@/app/(resident)/visitor/admin-logs';
import { ALL_AVAILABLE_FEATURES } from '@/src/features/dashboard/dashboardCatalog';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';
import { renderScreen, nav } from '../helpers/render';
import { signInAs, actor, fixture, Actor, store } from '../helpers/session';
import { apiAs, createGuestPassAs } from '../helpers/backend';
import { connectAs } from '../helpers/socket';
import { collection, oid, closeDb } from '../helpers/db';

afterAll(closeDb);

const visibleVisitorTiles = (who: Actor) => {
  const user = (store.getState() as any).auth.user;
  return ALL_AVAILABLE_FEATURES.filter((i: any) => i.categoryKey === 'visitor_management')
    .filter((i: any) => isFeatureAllowedForUser(i, user))
    .map((i: any) => i.id)
    .sort();
};

describe('P8 roles & tenancy', () => {
  describe('what each role sees in the app', () => {
    it('residents are sent away from the gate console', async () => {
      await signInAs('residentA');
      await renderScreen(<GateConsoleScreen />);
      expect(nav().redirects).toContain('/(resident)/dashboard');
    });

    it('residents are sent away from the visitor admin console', async () => {
      await signInAs('residentA');
      await renderScreen(<VisitorAdminLayout />);
      expect(nav().redirects).toContain('/(resident)/dashboard');
    });

    it('residents are sent away from the admin gate log', async () => {
      await signInAs('residentA');
      await renderScreen(<AdminGateLogsScreen />);
      expect(nav().redirects).toContain('/(resident)/dashboard');
    });

    it('admins can open the visitor admin console', async () => {
      await signInAs('adminA');
      await renderScreen(<VisitorAdminLayout />);
      expect(nav().redirects).toEqual([]);
    });

    it('dashboard tiles follow the role', async () => {
      await signInAs('residentA');
      const resident = visibleVisitorTiles('residentA');
      expect(resident).toContain('visitor_resident_passes');
      expect(resident).not.toEqual(expect.arrayContaining(['visitor_gate_console']));
      expect(resident.filter((id: string) => /admin|blacklist|community_passes/.test(id))).toEqual([]);

      await signInAs('guardA');
      const guard = visibleVisitorTiles('guardA');
      expect(guard).toContain('visitor_gate_console');
      expect(guard).not.toEqual(expect.arrayContaining(['visitor_admin_dashboard']));
      expect(guard).not.toEqual(expect.arrayContaining(['visitor_blacklist']));
      expect(guard).not.toEqual(expect.arrayContaining(['visitor_community_passes']));

      await signInAs('adminA');
      expect(visibleVisitorTiles('adminA')).toEqual(expect.arrayContaining(['visitor_admin_dashboard', 'visitor_blacklist']));
    });
  });

  describe('API authorisation with a valid login', () => {
    let residentAPass: { _id: string };
    const blacklistIds: Record<string, string> = {};
    let pendingWalkIn: string;
    let insideLog: string;

    beforeAll(async () => {
      residentAPass = await createGuestPassAs('residentA', { visitorDetails: { name: 'Guarded Pass' } });
      const other = await createGuestPassAs('residentA', { visitorDetails: { name: 'Inside Pass' } });
      insideLog = (await apiAs('guardA', 'POST', '/visitor-log/pre-approved', { passId: other._id })).body.data._id;
      for (const who of ['residentA', 'guardA', 'guardOther']) {
        const res = await apiAs('adminA', 'POST', '/blacklist', { orgId: actor('adminA').orgId, name: `Probe for ${who}`, reason: 'x' });
        blacklistIds[who] = res.body.data._id;
      }
      pendingWalkIn = (await apiAs('guardA', 'POST', '/visitor-log/walk-in', { residentId: actor('residentA').id, snapshot: { visitorName: 'Probe Walkin' } })).body.data._id;
    });

    const orgA = () => actor('adminA').orgId;
    const cases: [string, Actor, string, () => string, any?][] = [
      ['resident reads a neighbour’s pass', 'residentB', 'GET', () => `/visitor-pass/${residentAPass._id}`, undefined],
      ['resident revokes a neighbour’s pass', 'residentB', 'PATCH', () => `/visitor-pass/${residentAPass._id}/status`, { status: 'REVOKED' }],
      ['resident force-sets their own pass to ACTIVE', 'residentA', 'PATCH', () => `/visitor-pass/${residentAPass._id}/status`, { status: 'ACTIVE' }],
      ['resident issues a pass for a neighbour’s villa', 'residentA', 'POST', () => '/visitor-pass', () => ({})],
      ['resident admits a visitor at the gate', 'residentA', 'POST', () => '/visitor-log/pre-approved', { passId: 'set-in-test' }],
      ['resident registers a walk-in', 'residentA', 'POST', () => '/visitor-log/walk-in', { residentId: 'set-in-test' }],
      ['resident checks a visitor out', 'residentA', 'PATCH', () => `/visitor-log/${insideLog}/checkout`, {}],
      ['guard creates a visitor pass', 'guardA', 'POST', () => '/visitor-pass', () => ({})],
      ['guard revokes a resident’s pass', 'guardA', 'PATCH', () => `/visitor-pass/${residentAPass._id}/status`, { status: 'REVOKED' }],
      ['resident adds to the blacklist', 'residentA', 'POST', () => '/blacklist', () => ({ orgId: orgA(), name: 'Resident Ban', reason: 'x' })],
      ['resident removes a blacklist entry', 'residentA', 'DELETE', () => `/blacklist/${blacklistIds.residentA}`, undefined],
      ['guard removes a blacklist entry', 'guardA', 'DELETE', () => `/blacklist/${blacklistIds.guardA}`, undefined],
      ['another community removes a blacklist entry', 'guardOther', 'DELETE', () => `/blacklist/${blacklistIds.guardOther}`, undefined],
      ['another community reads a pass', 'residentOther', 'GET', () => `/visitor-pass/${residentAPass._id}`, undefined],
      ['another community resolves a walk-in', 'residentOther', 'PATCH', () => `/visitor-log/walk-in/${pendingWalkIn}/resolve`, { action: 'APPROVE' }],
      ['another community checks a visitor out', 'guardOther', 'PATCH', () => `/visitor-log/${insideLog}/checkout`, {}],
      ['another community lists passes', 'residentOther', 'GET', () => `/visitor-pass/org/${orgA()}`, undefined],
      ['another community lists who is inside', 'guardOther', 'GET', () => `/visitor-log/org/${orgA()}/inside`, undefined],
    ];

    it.each(cases)('%s → refused', async (_label, who, method, path, body) => {
      let payload = typeof body === 'function' ? body() : body;
      if (payload?.passId === 'set-in-test') payload = { passId: residentAPass._id };
      if (payload?.residentId === 'set-in-test') payload = { residentId: actor('residentB').id, snapshot: { visitorName: 'X' } };
      if (method === 'POST' && path() === '/visitor-pass') {
        payload = {
          passType: 'GUEST',
          villaId: fixture().villas['A-102'],
          visitorDetails: { name: 'Sneaky' },
          validity: { startDate: new Date().toISOString(), endDate: new Date(Date.now() + 3600_000).toISOString() },
        };
      }
      const res = await apiAs(who, method, path(), payload);
      // Refused means the backend said no (401/403) — not that the target happened to be missing.
      expect({ status: [401, 403].includes(res.status) ? 'refused' : res.status, body: res.body?.message }).toMatchObject({ status: 'refused' });
    });

    it('treats visitor-supplied names as text when matching the blacklist', async () => {
      const res = await apiAs('guardA', 'GET', `/blacklist/org/${orgA()}/check-match?name=${encodeURIComponent('Ravi (Jr')}`);
      expect(res.status).toBe(200);
      const pass = await apiAs('residentA', 'POST', '/visitor-pass', {
        passType: 'GUEST',
        villaId: actor('residentA').villaId,
        visitorDetails: { name: 'Ravi (Jr' },
        validity: { startDate: new Date().toISOString(), endDate: new Date(Date.now() + 3600_000).toISOString() },
      });
      expect(pass.status).toBe(201);
      expect((await apiAs('guardA', 'POST', '/visitor-log/pre-approved', { passId: pass.body.data._id })).status).toBe(201);
    });

    it('left every guarded record unchanged', async () => {
      expect((await (await collection('visitorpasses')).findOne({ _id: oid(residentAPass._id) })).status).toBe('PENDING');
      for (const id of Object.values(blacklistIds)) {
        expect(await (await collection('blacklists')).countDocuments({ _id: oid(id) })).toBe(1);
      }
      expect((await (await collection('visitorlogs')).findOne({ _id: oid(pendingWalkIn) })).logStatus).toBe('PENDING');
      expect((await (await collection('visitorlogs')).findOne({ _id: oid(insideLog) })).logStatus).toBe('INSIDE');
      expect(await (await collection('blacklists')).countDocuments({ name: 'Resident Ban' })).toBe(0);
    });
  });

  describe('real-time channel', () => {
    it('a resident cannot listen in on a neighbour’s gate alerts', async () => {
      const socketIo = require('socket.io-client');
      const E2E = require('../setup/constants');
      const spy = socketIo.io(E2E.socketUrl, { transports: ['websocket'], auth: { token: fixture().sessions.residentB.token }, reconnection: false });
      const received: any[] = [];
      spy.on('GATE_APPROVAL_REQUEST', (p: any) => received.push(p));
      await new Promise<void>((r) => spy.once('connect', () => r()));
      spy.emit('join_room', `user:${actor('residentA').id}`);
      await new Promise((r) => setTimeout(r, 300));

      await apiAs('guardA', 'POST', '/visitor-log/walk-in', { residentId: actor('residentA').id, snapshot: { visitorName: 'Private Visit' } });
      await new Promise((r) => setTimeout(r, 800));

      spy.close();
      expect(received.filter((p) => p?.snapshot?.visitorName === 'Private Visit')).toHaveLength(0);
    });

    it('another community cannot join this community’s guard room', async () => {
      const socketIo = require('socket.io-client');
      const E2E = require('../setup/constants');
      const outsider = socketIo.io(E2E.socketUrl, { transports: ['websocket'], auth: { token: fixture().sessions.guardOther.token }, reconnection: false });
      const received: any[] = [];
      outsider.on('GATE_APPROVAL_RESOLVED', (p: any) => received.push(p));
      await new Promise<void>((r) => outsider.once('connect', () => r()));
      outsider.emit('join_room', `org:${actor('adminA').orgId}:guards`);
      await new Promise((r) => setTimeout(r, 300));

      const w = await apiAs('guardA', 'POST', '/visitor-log/walk-in', { residentId: actor('residentA').id, snapshot: { visitorName: 'Guard Room Probe' } });
      await apiAs('residentA', 'PATCH', `/visitor-log/walk-in/${w.body.data._id}/resolve`, { action: 'REJECT' });
      await new Promise((r) => setTimeout(r, 800));

      outsider.close();
      expect(received.filter((p) => p?.snapshot?.visitorName === 'Guard Room Probe')).toHaveLength(0);
    });

    it('still delivers alerts to the rightful resident and guards', async () => {
      const resident = await connectAs('residentA');
      const guard = await connectAs('guardA');
      const w = await apiAs('guardA', 'POST', '/visitor-log/walk-in', { residentId: actor('residentA').id, snapshot: { visitorName: 'Rightful' } });
      await resident.waitForEvent('GATE_APPROVAL_REQUEST', (p) => p._id === w.body.data._id);
      await apiAs('residentA', 'PATCH', `/visitor-log/walk-in/${w.body.data._id}/resolve`, { action: 'APPROVE' });
      await guard.waitForEvent('GATE_APPROVAL_RESOLVED', (p) => p._id === w.body.data._id);
      resident.close();
      guard.close();
    });
  });
});
