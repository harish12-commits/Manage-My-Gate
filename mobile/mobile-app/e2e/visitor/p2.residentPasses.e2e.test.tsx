/**
 * P2 — Resident pass management: list, details, share, revoke.
 */
import React from 'react';
import { Share } from 'react-native';
import { fireEvent, waitFor, within } from '@testing-library/react-native';
import ResidentPassesScreen from '@/app/(resident)/visitor/resident-passes';
import { renderScreen } from '../helpers/render';
import { signInAs, store } from '../helpers/session';
import { findCalls, lastCall } from '../helpers/api';
import { tap, typeInto } from '../helpers/ui';
import { createGuestPassAs, revokePassAs } from '../helpers/backend';
import { collection, oid, closeDb } from '../helpers/db';

afterAll(closeDb);

const SEARCH = 'Search visitor name, phone or pass code...';

describe('P2 resident passes — list, details, share, revoke', () => {
  let mine: { _id: string; shortKey: string };
  let neighbours: { _id: string; shortKey: string };

  beforeAll(async () => {
    mine = await createGuestPassAs('residentA', { visitorDetails: { name: 'Meera Visitor', phone: '9811111111' } });
    neighbours = await createGuestPassAs('residentB', { visitorDetails: { name: 'Neighbour Guest', phone: '9822222222' } });
  });

  it('lists only the resident’s own passes, showing the visitor’s name and real entry code', async () => {
    await signInAs('residentA');
    const view = await renderScreen(<ResidentPassesScreen />);

    expect(await view.findByText('Meera Visitor')).toBeOnTheScreen();
    expect(view.getByText(new RegExp(`Ph: 9811111111`))).toBeOnTheScreen();
    expect(view.queryByText('Neighbour Guest')).toBeNull();

    const listCall = lastCall('GET', '/visitor-pass/org/')!;
    const ids = listCall.responseBody.data.data.map((p: any) => p._id);
    expect(ids).toContain(mine._id);
    expect(ids).not.toContain(neighbours._id);
  });

  it('filters the list by visitor name and by entry code', async () => {
    await signInAs('residentA');
    const extra = await createGuestPassAs('residentA', { visitorDetails: { name: 'Zubin Other' } });
    const view = await renderScreen(<ResidentPassesScreen />);
    await view.findByText('Zubin Other');

    await typeInto(view, SEARCH, 'meera');
    await waitFor(() => expect(view.queryByText('Zubin Other')).toBeNull());
    expect(view.getByText('Meera Visitor')).toBeOnTheScreen();

    await typeInto(view, SEARCH, extra.shortKey);
    await waitFor(() => expect(view.queryByText('Meera Visitor')).toBeNull());
    expect(view.getByText('Zubin Other')).toBeOnTheScreen();
  });

  it('opens pass details with the entry code and shares a message containing it', async () => {
    await signInAs('residentA');
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    const view = await renderScreen(<ResidentPassesScreen />);

    await tap(view, 'Meera Visitor');
    expect(await view.findByText(mine.shortKey)).toBeOnTheScreen();

    await tap(view, 'Share Pass');
    await waitFor(() => expect(share).toHaveBeenCalled());
    const shared = JSON.stringify(share.mock.calls[0][0]);
    expect(shared).toContain(mine.shortKey);
    expect(shared).toContain('Meera Visitor');
    share.mockRestore();
  });

  it('revokes a pass: backend marks it revoked, deletes its entry code, and records who did it', async () => {
    const residentA = await signInAs('residentA');
    const target = await createGuestPassAs('residentA', { visitorDetails: { name: 'To Be Revoked' } });
    const view = await renderScreen(<ResidentPassesScreen />);

    await view.findByText('To Be Revoked');
    const revokedLabelsBefore = view.queryAllByText('Revoked').length;
    await tap(view, 'To Be Revoked');
    await tap(view, /^Revoke Visitor Pass/);
    await tap(view, 'Revoke Pass');

    await waitFor(() => expect(lastCall('PATCH', `/visitor-pass/${target._id}/status`)?.status).toBe(200));
    const pass = await (await collection('visitorpasses')).findOne({ _id: oid(target._id) });
    expect(pass.status).toBe('REVOKED');
    expect(pass.statusHistory.at(-1)).toMatchObject({ fromStatus: 'PENDING', toStatus: 'REVOKED', actorId: oid(residentA.id) });
    expect(await (await collection('visitorpasstokens')).countDocuments({ passId: oid(target._id) })).toBe(0);

    // The list refreshes and the card now carries the Revoked badge.
    await waitFor(() => {
      const inStore = (store.getState() as any).visitorPass.passes.find((p: any) => p._id === target._id);
      expect(inStore?.status).toBe('REVOKED');
      expect(view.queryAllByText('Revoked').length).toBe(revokedLabelsBefore + 1);
    });
  });

  it('tells the resident when a revoke fails instead of silently closing', async () => {
    await signInAs('residentA');
    const target = await createGuestPassAs('residentA', { visitorDetails: { name: 'Raced Revoke' } });
    const view = await renderScreen(<ResidentPassesScreen />);

    await tap(view, 'Raced Revoke');
    await tap(view, /^Revoke Visitor Pass/);
    // Meanwhile the community admin revokes the same pass.
    expect((await revokePassAs('adminA', target._id, 'Security concern')).status).toBe(200);
    await tap(view, 'Revoke Pass');

    await waitFor(() => expect(lastCall('PATCH', `/visitor-pass/${target._id}/status`)?.status).toBe(400));
    expect(await view.findByText(/already revoked/i)).toBeOnTheScreen();
  });
});
