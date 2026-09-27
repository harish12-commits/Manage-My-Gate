/**
 * P10 (automatable part) — notifications the backend raises for visitor events are
 * delivered to the right person and open the right screen when tapped.
 * The rest of P10 (camera, push delivery, WhatsApp share) is the device checklist in
 * e2e/VISITOR_DEVICE_CHECKLIST.md.
 */
import { resolveNotificationRoute } from '@/src/features/notification/utils/notificationNavigation';
import { actor, Actor } from '../helpers/session';
import { apiAs, createGuestPassAs } from '../helpers/backend';
import { closeDb } from '../helpers/db';

afterAll(closeDb);

/** The newest notification for `who` whose title matches, as the app's notification list receives it. */
const latestNotification = async (who: Actor, title: string, bodyIncludes: string) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await apiAs(who, 'GET', '/notifications?limit=50');
    const rows: any[] = res.body.data?.data || res.body.data?.notifications || res.body.data || [];
    const hit = rows.find((n) => n.title === title && String(n.body || '').includes(bodyIncludes));
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`${who} has no "${title}" notification about ${bodyIncludes}`);
};

describe('P10 visitor notifications → right person, right screen', () => {
  it('walk-in request alerts the host and opens their walk-in approvals', async () => {
    const w = await apiAs('guardA', 'POST', '/visitor-log/walk-in', { residentId: actor('residentA').id, snapshot: { visitorName: 'Notify Nia' } });
    expect(w.status).toBe(201);

    const note = await latestNotification('residentA', 'Gate Approval Required', 'Notify Nia');
    expect(resolveNotificationRoute(note)).toBe('/(resident)/visitor/walk-ins');
    await expect(latestNotification('residentB', 'Gate Approval Required', 'Notify Nia')).rejects.toThrow();

    await apiAs('residentA', 'PATCH', `/visitor-log/walk-in/${w.body.data._id}/resolve`, { action: 'APPROVE' });
    const outcome = await latestNotification('guardA', 'Walk-in Entry Approved', 'Notify Nia');
    expect(resolveNotificationRoute(outcome)).toBe('/(resident)/visitor/gate-console');
  });

  it('check-in and check-out of a pre-approved guest notify the host and open their passes', async () => {
    const pass = await createGuestPassAs('residentA', { visitorDetails: { name: 'Notify Noor' } });
    const entry = await apiAs('guardA', 'POST', '/visitor-log/pre-approved', { passId: pass._id });
    await apiAs('guardA', 'PATCH', `/visitor-log/${entry.body.data._id}/checkout`, {});

    const inNote = await latestNotification('residentA', 'Visitor Checked In', 'Notify Noor');
    const outNote = await latestNotification('residentA', 'Visitor Checked Out', 'Notify Noor');
    expect(resolveNotificationRoute(inNote)).toBe('/(resident)/visitor/resident-passes');
    expect(resolveNotificationRoute(outNote)).toBe('/(resident)/visitor/resident-passes');
  });
});
