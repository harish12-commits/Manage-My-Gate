/**
 * P1 — Pass creation: resident creates a guest pass through the invite wizard UI.
 * Checks what the resident sees, what the app sends, and what the backend persisted.
 */
import React from 'react';
import { waitFor } from '@testing-library/react-native';
import InviteVisitorScreen from '@/app/(resident)/visitor/invite';
import { renderScreen } from '../helpers/render';
import { signInAs } from '../helpers/session';
import { findCalls, lastCall } from '../helpers/api';
import { tap, typeInto } from '../helpers/ui';
import { collection, oid, closeDb } from '../helpers/db';

afterAll(closeDb);

const passCount = async (filter: object) => (await collection('visitorpasses')).countDocuments(filter);

describe('P1 guest pass — resident invite wizard → backend', () => {
  it('creates a single-entry guest pass for the resident’s own villa and shows its entry code', async () => {
    const residentA = await signInAs('residentA');
    const view = await renderScreen(<InviteVisitorScreen />);

    await typeInto(view, 'e.g. Ramesh Chandra', 'Kiran Guest');
    await typeInto(view, '9876543210', '9876543210');
    await typeInto(view, 'e.g. Family dinner, Personal meeting', 'Dinner');
    await tap(view, 'Continue'); // → schedule (default: arriving now)
    await tap(view, 'Continue'); // → options (default: single entry)
    await tap(view, 'Continue'); // → review
    await tap(view, 'Generate Pass');

    await waitFor(() => expect(findCalls('POST', '/visitor-pass').length).toBe(1));
    const create = lastCall('POST', '/visitor-pass')!;
    expect({ status: create.status, message: create.responseBody?.message }).toEqual({
      status: 201,
      message: 'Visitor pass created successfully',
    });

    const pass = create.responseBody.data;
    expect(pass.shortKey).toMatch(/^\d{6}$/);
    // The generated pass screen shows the entry code as "123 456" and names the visitor.
    expect(await view.findByText(`${pass.shortKey.slice(0, 3)} ${pass.shortKey.slice(3)}`)).toBeOnTheScreen();
    expect(view.getAllByText('Kiran Guest').length).toBeGreaterThan(0);

    const stored = await (await collection('visitorpasses')).findOne({ _id: oid(pass._id) });
    expect(stored).toMatchObject({
      orgId: oid(residentA.orgId),
      createdById: oid(residentA.id),
      villaId: oid(residentA.villaId!),
      passType: 'GUEST',
      status: 'PENDING',
      visitorDetails: expect.objectContaining({ name: 'Kiran Guest', phone: '9876543210' }),
      usageLimit: expect.objectContaining({ maxUses: 1, currentUses: 0 }),
    });

    // "Arriving Now (Valid 4 Hours)" — the default slot — must expire 4 hours after issue.
    const validForMs = new Date(stored!.validity.endDate).getTime() - new Date(stored!.createdAt).getTime();
    expect(Math.abs(validForMs - 4 * 60 * 60 * 1000)).toBeLessThan(5 * 60 * 1000);

    const token = await (await collection('visitorpasstokens')).findOne({ passId: oid(pass._id) });
    expect(token).toMatchObject({ shortKey: pass.shortKey, orgId: oid(residentA.orgId) });
  });

  it('blocks Continue without a guest name and sends nothing to the backend', async () => {
    await signInAs('residentA');
    const view = await renderScreen(<InviteVisitorScreen />);

    await tap(view, 'Continue');

    expect(await view.findByText('Please enter the guest name.')).toBeOnTheScreen();
    expect(findCalls('POST', '/visitor-pass')).toHaveLength(0);
  });

  it('stops an invalid phone number on the details step, before anything reaches the backend', async () => {
    const residentA = await signInAs('residentA');
    const before = await passCount({ createdById: oid(residentA.id) });
    const view = await renderScreen(<InviteVisitorScreen />);

    await typeInto(view, 'e.g. Ramesh Chandra', 'Short Phone');
    await typeInto(view, '9876543210', '12345');
    await tap(view, 'Continue');

    expect(await view.findByText('Please enter a valid 10-digit phone number.')).toBeOnTheScreen();
    expect(view.getByText('Step 1 of 4: Guest Details')).toBeOnTheScreen();
    expect(findCalls('POST', '/visitor-pass')).toHaveLength(0);
    expect(await passCount({ createdById: oid(residentA.id) })).toBe(before);
  });
});
