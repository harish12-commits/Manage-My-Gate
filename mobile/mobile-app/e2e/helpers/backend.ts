/**
 * Direct backend calls for test *setup* (arranging state before the screen under test
 * is exercised) and for probing the API the way a hostile client would. Never used for
 * the step a test is actually verifying through the UI.
 */
import { fixture, actor, Actor } from './session';

const E2E = require('../setup/constants');

export interface ApiResult<T = any> {
  status: number;
  body: { success?: boolean; message?: string; data?: T; details?: any[] };
}

export const apiAs = async <T = any>(who: Actor | null, method: string, path: string, body?: any): Promise<ApiResult<T>> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Client-Type': 'APP' };
  if (who) {
    headers.Authorization = `Bearer ${fixture().sessions[who].token}`;
    headers['x-organization-id'] = actor(who).orgId;
  }
  const res = await fetch(`${E2E.apiUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { message: text };
  }
  return { status: res.status, body: parsed };
};

const HOUR = 60 * 60 * 1000;

/** Creates a guest pass valid from today for `hours` hours, owned by `who` (a resident). */
export const createGuestPassAs = async (who: Actor, overrides: Record<string, any> = {}) => {
  const me = actor(who);
  const now = new Date();
  const payload = {
    passType: 'GUEST',
    villaId: me.villaId,
    visitorDetails: { name: `Guest of ${me.name}`, phone: '9800000000' },
    validity: { startDate: now.toISOString(), endDate: new Date(now.getTime() + 4 * HOUR).toISOString() },
    usageLimit: { maxUses: 1 },
    ...overrides,
  };
  const res = await apiAs(who, 'POST', '/visitor-pass', payload);
  if (res.status !== 201) {
    throw new Error(`Setup: pass creation failed for ${who}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data as { _id: string; shortKey: string; [k: string]: any };
};

export const revokePassAs = (who: Actor, passId: string, reason?: string) =>
  apiAs(who, 'PATCH', `/visitor-pass/${passId}/status`, { status: 'REVOKED', ...(reason ? { reason } : {}) });
