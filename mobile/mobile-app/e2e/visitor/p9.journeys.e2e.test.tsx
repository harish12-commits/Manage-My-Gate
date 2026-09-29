/**
 * P9 — Full journeys: each story runs across several actors' screens, with every step
 * performed through the UI and the next actor picking up only what the previous one saw.
 */
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import InviteVisitorScreen from '@/app/(resident)/visitor/invite';
import StaffPassScreen from '@/app/(resident)/visitor/staff-pass';
import GateConsoleScreen from '@/app/(resident)/visitor/gate-console';
import WalkInApprovalsScreen from '@/app/(resident)/visitor/walk-ins';
import VisitorHistoryScreen from '@/app/(resident)/visitor/history';
import AdminGateLogsScreen from '@/app/(resident)/visitor/admin-logs';
import { InsideVisitorsView } from '@/src/features/visitor/components/guard/InsideVisitorsView';
import { renderScreen } from '../helpers/render';
import { signInAs, actor } from '../helpers/session';
import { lastCall, resetApiLog } from '../helpers/api';
import { tap, typeInto, visibleTexts, typePhone } from '../helpers/ui';
import { collection, oid, closeDb } from '../helpers/db';

type View = Awaited<ReturnType<typeof renderScreen>>;

afterAll(closeDb);
beforeEach(async () => {
  await (await collection('visitorlogs')).updateMany({ logStatus: { $in: ['INSIDE', 'PENDING'] } }, { $set: { logStatus: 'COMPLETED' } });
});

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Reads the 6-digit entry code the resident sees on the generated pass ("123 456"). */
const codeOnScreen = async (view: View) => {
  await waitFor(() => expect(visibleTexts(view).some((t) => /^\d{3} \d{3}$/.test(t))).toBe(true));
  return visibleTexts(view).find((t) => /^\d{3} \d{3}$/.test(t))!.replace(' ', '');
};

const guardAdmitsByCode = async (code: string, visitorName: string) => {
  await signInAs('guardA');
  const view = await renderScreen(<GateConsoleScreen />);
  await typeInto(view, 'Enter 6-digit PIN, Plate, or Name...', code);
  await fireEvent.press(view.getByLabelText('Search Pass Code'));
  expect(await view.findByText(visitorName)).toBeOnTheScreen();
  await fireEvent.press(await view.findByLabelText('Confirm Gate Entry'));
  expect(await view.findByText(new RegExp(`${visitorName} successfully admitted`))).toBeOnTheScreen();
  await view.unmount();
};

const guardChecksOut = async (visitorName: string) => {
  await signInAs('guardA');
  const view = await renderScreen(<InsideVisitorsView />);
  await view.findByText(visitorName);
  await fireEvent.press(view.getByLabelText('Check Out Visitor'));
  await tap(view, 'Confirm Check-Out');
  await waitFor(() => expect(view.queryByText(visitorName)).toBeNull());
  await view.unmount();
};

describe('P9 full journeys', () => {
  it('guest: invite → share code → gate entry → checkout → history & audit', async () => {
    // Resident invites a guest.
    await signInAs('residentA');
    const invite = await renderScreen(<InviteVisitorScreen />);
    await typeInto(invite, 'e.g. Ramesh Chandra', 'Journey Jaya');
    await typePhone(invite, 'guest-phone', '9812345678');
    await tap(invite, 'Continue');
    await tap(invite, 'Continue');
    await tap(invite, 'Continue');
    await tap(invite, 'Generate Pass');
    const code = await codeOnScreen(invite);
    await invite.unmount();

    // Guard admits with the code the guest was sent, then checks her out.
    await guardAdmitsByCode(code, 'Journey Jaya');
    const log = await (await collection('visitorlogs')).findOne({ 'snapshot.visitorName': 'Journey Jaya' });
    expect(log.logStatus).toBe('INSIDE');
    await guardChecksOut('Journey Jaya');

    // Resident sees the finished pass in history.
    await signInAs('residentA');
    const history = await renderScreen(<VisitorHistoryScreen />);
    await tap(history, 'Expired');
    expect(await history.findByText('Journey Jaya')).toBeOnTheScreen();
    await history.unmount();

    // Admin audit shows the real visit.
    await signInAs('adminA');
    const audit = await renderScreen(<AdminGateLogsScreen />);
    expect(await audit.findByText('Journey Jaya')).toBeOnTheScreen();
    const finished = await (await collection('visitorlogs')).findOne({ _id: log._id });
    expect(finished.logStatus).toBe('COMPLETED');
    expect(finished.actionHistory.map((a: any) => a.action)).toEqual(['CHECKED_IN', 'CHECKED_OUT']);
  });

  it('walk-in: guard request → resident approves → inside → checkout', async () => {
    await signInAs('guardA');
    const console1 = await renderScreen(<GateConsoleScreen />);
    await fireEvent.press(await console1.findByLabelText('Initiate Walk-In'));
    await tap(console1, 'Choose Host');
    const rows = await console1.findAllByText(/^Villa A-101\b/);
    await fireEvent.press(rows[rows.length - 1]);
    await typeInto(console1, 'e.g. Rahul Sharma', 'Journey Walker');
    await typePhone(console1, 'guard-walkin-phone', '9813333333');
    await tap(console1, 'Send Resident Request');
    expect(await console1.findByText('PENDING APPROVAL')).toBeOnTheScreen();
    await console1.unmount();

    await signInAs('residentA');
    const approvals = await renderScreen(<WalkInApprovalsScreen />);
    await approvals.findByText('Journey Walker');
    await tap(approvals, 'Approve');
    await waitFor(() => expect(approvals.queryByText('Journey Walker')).toBeNull());
    await approvals.unmount();

    await guardChecksOut('Journey Walker');
    const log = await (await collection('visitorlogs')).findOne({ 'snapshot.visitorName': 'Journey Walker' });
    expect(log.actionHistory.map((a: any) => a.action)).toEqual(['REQUESTED', 'APPROVED', 'CHECKED_OUT']);
    expect(log.logStatus).toBe('COMPLETED');
  });

  it('recurring staff: service pass admits the same worker twice in a day and stays valid', async () => {
    await signInAs('residentA');
    const wizard = await renderScreen(<StaffPassScreen />);
    await typeInto(wizard, 'e.g. Sunita Devi, Ramesh Plumber', 'Journey Maid');
    await typePhone(wizard, 'staff-phone', '9814444444');
    await tap(wizard, 'Continue'); // → category
    await tap(wizard, 'Continue'); // → date range
    await tap(wizard, 'Continue'); // → weekdays
    if (wizard.queryByText('Select All Days')) await tap(wizard, 'Select All Days');
    await tap(wizard, 'Continue'); // → daily slot
    await tap(wizard, 'Custom Time Slot');
    const now = Date.now();
    await typeInto(wizard, '09:00 AM', hhmm(new Date(now - 60 * 60 * 1000)));
    await typeInto(wizard, '06:00 PM', hhmm(new Date(now + 60 * 60 * 1000)));
    await tap(wizard, 'Continue'); // → review
    await tap(wizard, 'Generate Pass');
    const code = await codeOnScreen(wizard);
    await wizard.unmount();

    await guardAdmitsByCode(code, 'Journey Maid');
    await guardChecksOut('Journey Maid');
    resetApiLog();
    await guardAdmitsByCode(code, 'Journey Maid');
    expect(lastCall('POST', '/visitor-log/pre-approved')!.status).toBe(201);

    const pass = await (await collection('visitorpasses')).findOne({ 'visitorDetails.name': 'Journey Maid' });
    expect(pass).toMatchObject({ passType: 'SERVICE', status: 'ACTIVE', usageLimit: expect.objectContaining({ currentUses: 2 }) });
    expect(await (await collection('visitorlogs')).countDocuments({ passId: pass._id })).toBe(2);
    expect(pass.createdById).toEqual(oid(actor('residentA').id));
  });
});
