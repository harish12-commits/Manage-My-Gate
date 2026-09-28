/**
 * P0 — Harness smoke: proves the mobile app talks to the real backend end to end.
 */
import React from 'react';
import { waitFor } from '@testing-library/react-native';
import VisitorDashboardScreen from '@/app/(resident)/visitor/index';
import { loginUser } from '@/src/features/auth/store/authSlice';
import { selectActiveOrgId } from '@/src/features/auth/store/authSelectors';
import { renderScreen } from '../helpers/render';
import { signInAs, fixture, actor, store } from '../helpers/session';
import { lastCall, findCalls } from '../helpers/api';
import { collection, oid, closeDb } from '../helpers/db';

afterAll(closeDb);

describe('P0 harness: mobile app ↔ real backend', () => {
  it('logs in through the real loginUser thunk and resolves the active community', async () => {
    const residentB = actor('residentB');
    const result = await store.dispatch(loginUser({ email: residentB.email, password: fixture().password }));

    expect({ status: result.meta.requestStatus, payload: result.meta.requestStatus === 'rejected' ? result.payload : 'ok' })
      .toEqual({ status: 'fulfilled', payload: 'ok' });
    const state = store.getState() as any;
    expect(state.auth.isAuthenticated).toBe(true);
    expect(selectActiveOrgId(state)).toBe(fixture().orgs.A);
    expect(lastCall('POST', '/auth/login')?.status).toBe(200);
  });

  it('loads the resident visitor home from the backend with auth and org headers', async () => {
    const residentA = await signInAs('residentA');
    const view = await renderScreen(<VisitorDashboardScreen />);

    await waitFor(() => {
      expect(lastCall('GET', `/visitor-pass/org/${residentA.orgId}`)?.status).toBe(200);
      expect(lastCall('GET', `/visitor-log/org/${residentA.orgId}/inside`)?.status).toBe(200);
      expect(lastCall('GET', `/visitor-log/org/${residentA.orgId}/pending`)?.status).toBe(200);
    });

    const passCall = lastCall('GET', `/visitor-pass/org/${residentA.orgId}`)!;
    expect(passCall.requestHeaders.Authorization).toBe(`Bearer ${fixture().sessions.residentA.token}`);
    expect(passCall.requestHeaders['x-organization-id']).toBe(residentA.orgId);

    expect(await view.findByText('Active Passes')).toBeOnTheScreen();
    expect(view.queryByText('Gate Console')).toBeNull();
  });

  it('shows the Gate Console action to a guard', async () => {
    const guardA = await signInAs('guardA');
    const view = await renderScreen(<VisitorDashboardScreen />);

    expect(await view.findByText('Gate Console')).toBeOnTheScreen();
    await waitFor(() => expect(findCalls('GET', `/visitor-log/org/${guardA.orgId}/inside`).length).toBeGreaterThan(0));
  });

  it('can read the seeded state directly from the E2E database', async () => {
    const memberships = await collection('orgmemberships');
    expect(await memberships.countDocuments({ orgId: oid(fixture().orgs.A), status: 'Active' })).toBe(4);
  });
});
