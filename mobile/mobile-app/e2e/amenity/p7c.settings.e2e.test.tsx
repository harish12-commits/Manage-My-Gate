/**
 * P7c — Amenity settings (mobile UI → V2 backend): staff see the community rules in
 * hours / days / minutes, change them, and the API stores minutes. Invalid values never
 * reach the API; residents cannot open or change the settings.
 * Runs against community B so the rules community A's suites rely on stay untouched.
 */
import React from 'react';
import { waitFor, fireEvent } from '@testing-library/react-native';
import SettingsRoute from '@/app/(resident)/amenities/settings';
import { renderScreen, nav } from '../helpers/render';
import { signInAs, actor } from '../helpers/session';
import { lastCall, findCalls, resetApiLog } from '../helpers/api';
import { tap, expectVisible } from '../helpers/ui';
import { closeDb, collection, oid } from '../helpers/db';
import { amenityApiAs } from '../helpers/amenity';

afterAll(closeDb);

const settingsDoc = async () =>
  (await collection('amenity_management_settings')).findOne({ orgId: oid(actor('adminOther').orgId) });

const openSettings = async () => {
  resetApiLog();
  await signInAs('adminOther');
  const view = await renderScreen(<SettingsRoute />);
  await waitFor(() => expect(lastCall('GET', '/amenity-management/settings')?.status).toBe(200), { timeout: 15000 });
  await view.findByTestId('amenity-settings-approvalTimeoutHours');
  return view;
};

const field = (view: any, name: string) => view.getByTestId(`amenity-settings-${name}`);

describe('P7c amenity settings', () => {
  afterAll(async () => {
    // Back to the defaults for any later run.
    await amenityApiAs('adminOther', 'PUT', '/settings', {
      quota: { enabled: true, limitMinutes: 2400, longDurationLimitMinutes: 43200 },
      approvalTimeoutHours: 24,
      checkInEarlyMinutes: 15,
      noShowGraceMinutes: 30,
    });
  });

  it('shows the rules in hours and days and saves them in minutes', async () => {
    const view = await openSettings();
    expect(field(view, 'quotaHours').props.value).toBe('40'); // 2400 minutes
    expect(field(view, 'longStayDays').props.value).toBe('30'); // 43200 minutes

    await fireEvent.changeText(field(view, 'quotaHours'), '12');
    await fireEvent.changeText(field(view, 'approvalTimeoutHours'), '48');
    await fireEvent.changeText(field(view, 'noShowGraceMinutes'), '45');
    await tap(view, /^save changes$/i);

    await waitFor(() => expect(lastCall('PUT', '/amenity-management/settings')?.status).toBe(200), { timeout: 15000 });
    expect(lastCall('PUT', '/amenity-management/settings')!.requestBody).toEqual({
      quota: { enabled: true, limitMinutes: 720, longDurationLimitMinutes: 43200 },
      approvalTimeoutHours: 48,
      checkInEarlyMinutes: 15,
      noShowGraceMinutes: 45,
    });
    await view.findByTestId('amenity-settings-saved');
    const s = await settingsDoc();
    expect({ quota: s!.quota.limitMinutes, approval: s!.approvalTimeoutHours, grace: s!.noShowGraceMinutes }).toEqual({
      quota: 720,
      approval: 48,
      grace: 45,
    });
  });

  it('keeps invalid values from being saved', async () => {
    const view = await openSettings();
    await fireEvent.changeText(field(view, 'checkInEarlyMinutes'), '500');
    await tap(view, /^save changes$/i);
    await expectVisible(view, 'Enter 0–240 minutes');
    expect(findCalls('PUT', '/amenity-management/settings')).toHaveLength(0);
  });

  it('keeps residents out', async () => {
    await signInAs('residentOther');
    nav().redirects.length = 0;
    await renderScreen(<SettingsRoute />);
    expect(nav().redirects).toContain('/(resident)/dashboard');
    const put = await amenityApiAs('residentOther', 'PUT', '/settings', { approvalTimeoutHours: 1 });
    expect(put.status).toBe(403);
  });
});
