/**
 * P2 — Public pass page a visitor opens from a shared link, with nobody signed in.
 */
import React from 'react';
import PublicVisitorPassScreen from '@/src/features/visitor/screens/PublicVisitorPassScreen';
import { renderScreen, nav } from '../helpers/render';
import { lastCall } from '../helpers/api';
import { createGuestPassAs, revokePassAs } from '../helpers/backend';
import { closeDb } from '../helpers/db';

afterAll(closeDb);

describe('P2 public pass page — unauthenticated visitor', () => {
  it('shows the pass for a valid shared code without exposing the phone number', async () => {
    const pass = await createGuestPassAs('residentA', { visitorDetails: { name: 'Public Pat', phone: '9833333333' } });
    nav().params = { code: pass.shortKey };
    const view = await renderScreen(<PublicVisitorPassScreen />);

    expect(await view.findByText('Public Pat')).toBeOnTheScreen();
    const call = lastCall('GET', `/visitor-pass/public/${pass.shortKey}`)!;
    expect(call.status).toBe(200);
    expect(JSON.stringify(call.responseBody)).not.toContain('9833333333');
    expect(view.queryByText(/9833333333/)).toBeNull();
  });

  it('does not resolve a raw database id', async () => {
    const pass = await createGuestPassAs('residentA', { visitorDetails: { name: 'Id Probe' } });
    nav().params = { id: pass._id };
    const view = await renderScreen(<PublicVisitorPassScreen />);

    expect(await view.findByText(/not found|invalid|expired/i)).toBeOnTheScreen();
    expect(view.queryByText('Id Probe')).toBeNull();
  });

  it('stops resolving a code once the pass is revoked', async () => {
    const pass = await createGuestPassAs('residentA', { visitorDetails: { name: 'Revoked Rita' } });
    await revokePassAs('residentA', pass._id);
    nav().params = { code: pass.shortKey };
    const view = await renderScreen(<PublicVisitorPassScreen />);

    expect(await view.findByText(/not found|invalid|expired/i)).toBeOnTheScreen();
    expect(view.queryByText('Revoked Rita')).toBeNull();
  });
});
