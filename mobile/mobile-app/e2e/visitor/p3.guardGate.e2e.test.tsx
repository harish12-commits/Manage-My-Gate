/**
 * P3 — Guard gate console: scan or type a pass code, verify it, and admit the visitor.
 * Every refusal the backend makes must reach the guard, and must not create an entry.
 */
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import GateConsoleScreen from '@/app/(resident)/visitor/gate-console';
import { encodeAppBarcode } from '@/src/utils/appBarcodeProtocol';
import { renderScreen } from '../helpers/render';
import { signInAs, actor } from '../helpers/session';
import { findCalls, lastCall } from '../helpers/api';
import { typeInto } from '../helpers/ui';
import { simulateScan } from '../helpers/camera';
import { apiAs, createGuestPassAs, revokePassAs } from '../helpers/backend';
import { collection, oid, closeDb } from '../helpers/db';

afterAll(closeDb);

type View = Awaited<ReturnType<typeof renderScreen>>;
type Pass = { _id: string; shortKey: string };

const HOUR = 60 * 60 * 1000;
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const qrFor = (pass: Pass, name: string) => encodeAppBarcode('GUEST', pass.shortKey, pass._id, name);

const insideLogsFor = async (passId: string) =>
  (await collection('visitorlogs')).countDocuments({ passId: oid(passId), logStatus: 'INSIDE' });

const openConsole = async () => {
  await signInAs('guardA');
  return renderScreen(<GateConsoleScreen />);
};

/** Enters a code in the console's manual lookup box and submits it. */
const lookUp = async (view: View, code: string) => {
  await typeInto(view, 'Enter 6-digit PIN, Plate, or Name...', code);
  await fireEvent.press(view.getByLabelText('Search Pass Code'));
};

const confirmEntry = async (view: View) => {
  await fireEvent.press(await view.findByLabelText('Confirm Gate Entry'));
  await waitFor(() => expect(findCalls('POST', '/visitor-log/pre-approved').length).toBe(1));
  return lastCall('POST', '/visitor-log/pre-approved')!;
};

describe('P3 guard gate — verify and admit pre-approved visitors', () => {
  it('scans a pass QR, shows who is visiting whom, and admits the visitor', async () => {
    const pass = await createGuestPassAs('residentA', { visitorDetails: { name: 'Scan Sam', phone: '9844444444' } });
    const view = await openConsole();

    await simulateScan(qrFor(pass, 'Scan Sam'));

    expect(await view.findByText('Scan Sam')).toBeOnTheScreen();
    expect(view.getByText(/A-101/)).toBeOnTheScreen();
    expect(view.getByText('Ravi Resident')).toBeOnTheScreen();

    const entry = await confirmEntry(view);
    expect(entry.status).toBe(201);
    expect(await view.findByText(/Scan Sam successfully admitted/)).toBeOnTheScreen();

    const log = await (await collection('visitorlogs')).findOne({ passId: oid(pass._id) });
    expect(log).toMatchObject({
      logStatus: 'INSIDE',
      entryType: 'PRE_APPROVED',
      guardId: oid(actor('guardA').id),
      residentId: oid(actor('residentA').id),
    });
    const stored = await (await collection('visitorpasses')).findOne({ _id: oid(pass._id) });
    expect(stored).toMatchObject({ status: 'ACTIVE', usageLimit: expect.objectContaining({ currentUses: 1 }) });
  });

  it('finds a pass from its 6-digit code typed by the guard', async () => {
    const pass = await createGuestPassAs('residentA', { visitorDetails: { name: 'Typed Tara' } });
    const view = await openConsole();

    await lookUp(view, pass.shortKey);

    expect(await view.findByText('Typed Tara')).toBeOnTheScreen();
    expect((await confirmEntry(view)).status).toBe(201);
    expect(await insideLogsFor(pass._id)).toBe(1);
  });

  it('shows a revoked pass as denied and offers no way to admit', async () => {
    const pass = await createGuestPassAs('residentA', { visitorDetails: { name: 'Revoked Ravi' } });
    const view = await openConsole();
    // Revoked after the QR was shared; the QR still carries the pass id.
    await revokePassAs('residentA', pass._id);

    await simulateScan(qrFor(pass, 'Revoked Ravi'));

    expect(await view.findByText(/revoked/i)).toBeOnTheScreen();
    expect(view.queryByLabelText('Confirm Gate Entry')).toBeNull();
    expect(await insideLogsFor(pass._id)).toBe(0);
  });

  describe('refusals decided by the backend at confirmation are shown to the guard', () => {
    const expectRefusal = async (pass: Pass, name: string, status: number, message: RegExp) => {
      const view = await openConsole();
      await simulateScan(qrFor(pass, name));
      await view.findByText(name);

      const entry = await confirmEntry(view);
      expect({ status: entry.status, message: entry.responseBody?.message }).toEqual({
        status,
        message: expect.stringMatching(message),
      });
      expect(await view.findByText(message)).toBeOnTheScreen();
      expect(view.queryByText(/successfully admitted/)).toBeNull();
      expect(await insideLogsFor(pass._id)).toBe(0);
    };

    it('single-use pass already used at another gate', async () => {
      const pass = await createGuestPassAs('residentA', { visitorDetails: { name: 'Used Uma' } });
      await (await collection('visitorpasses')).updateOne({ _id: oid(pass._id) }, { $set: { 'usageLimit.currentUses': 1, status: 'ACTIVE' } });
      await expectRefusal(pass, 'Used Uma', 400, /maximum usage limit/i);
    });

    it('outside the pass’s daily time window', async () => {
      const now = new Date();
      const pass = await createGuestPassAs('residentA', {
        visitorDetails: { name: 'Late Lata' },
        validity: {
          startDate: now.toISOString(),
          endDate: new Date(now.getTime() + 24 * HOUR).toISOString(),
          timeWindowStart: hhmm(new Date(now.getTime() + 2 * HOUR)),
          timeWindowEnd: hhmm(new Date(now.getTime() + 3 * HOUR)),
        },
      });
      await expectRefusal(pass, 'Late Lata', 400, /not valid during the current access window/i);
    });

    it('on a weekday the pass does not allow', async () => {
      const now = new Date();
      const pass = await createGuestPassAs('residentA', {
        visitorDetails: { name: 'Weekday Wasim' },
        validity: {
          startDate: now.toISOString(),
          endDate: new Date(now.getTime() + 7 * 24 * HOUR).toISOString(),
          allowedDays: [(now.getDay() + 1) % 7],
        },
      });
      await expectRefusal(pass, 'Weekday Wasim', 400, /not authorized for use on this day/i);
    });

    it('visitor on the community blacklist', async () => {
      const pass = await createGuestPassAs('residentA', { visitorDetails: { name: 'Banned Bala', phone: '9855555555' } });
      const ban = await apiAs('adminA', 'POST', '/blacklist', {
        orgId: actor('adminA').orgId,
        name: 'Banned Bala',
        phone: '9855555555',
        reason: 'Theft reported',
      });
      expect(ban.status).toBe(201);
      await expectRefusal(pass, 'Banned Bala', 403, /blacklisted/i);
    });
  });

  it('does not resolve another community’s pass code', async () => {
    const foreign = await createGuestPassAs('residentOther', { visitorDetails: { name: 'Foreign Fay' } });
    const view = await openConsole();

    await lookUp(view, foreign.shortKey);

    expect(await view.findByText(/No active pass found/)).toBeOnTheScreen();
    expect(view.queryByText('Foreign Fay')).toBeNull();
  });

  it('resolves the guard’s own community pass even when another community reuses the same code', async () => {
    // The foreign token is stored first, so an unscoped lookup would find it first.
    const foreign = await createGuestPassAs('residentOther', { visitorDetails: { name: 'Clash Chen' } });
    const mine = await createGuestPassAs('residentA', { visitorDetails: { name: 'Home Hari' } });
    // Codes are only unique per community; force a collision.
    await (await collection('visitorpasstokens')).updateOne(
      { passId: oid(foreign._id) },
      { $set: { shortKey: mine.shortKey, passCode: `${actor('residentOther').orgId}_${mine.shortKey}` } }
    );
    const view = await openConsole();

    await lookUp(view, mine.shortKey);

    expect(await view.findByText('Home Hari')).toBeOnTheScreen();
    expect(view.queryByText('Clash Chen')).toBeNull();
  });

  it('tells the guard when a code matches nothing', async () => {
    const view = await openConsole();
    await lookUp(view, '000001');
    expect(await view.findByText(/No active pass found matching "000001"/)).toBeOnTheScreen();
  });

  it('admits a single-use pass only once when two gates confirm at the same moment', async () => {
    const pass = await createGuestPassAs('residentA', { visitorDetails: { name: 'Race Rohan' } });
    const results = await Promise.all([
      apiAs('guardA', 'POST', '/visitor-log/pre-approved', { passId: pass._id, gateName: 'Gate 1' }),
      apiAs('guardA', 'POST', '/visitor-log/pre-approved', { passId: pass._id, gateName: 'Gate 2' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await insideLogsFor(pass._id)).toBe(1);
  });
});
