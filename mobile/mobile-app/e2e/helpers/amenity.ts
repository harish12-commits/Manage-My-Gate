/**
 * Amenity suite setup helpers: direct V2 API calls for arranging state (never for the
 * step under test), seeded facility lookup, IST slot times and DB polling.
 */
import { fixture, actor, Actor } from './session';
import { ApiResult } from './backend';
import { collection, oid } from './db';

const E2E = require('../setup/constants');

export const AMENITY_V2 = '/amenity-management';

export const amenityApiAs = async <T = any>(
  who: Actor | null,
  method: string,
  path: string,
  body?: any,
  extraHeaders: Record<string, string> = {}
): Promise<ApiResult<T>> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Client-Type': 'APP', ...extraHeaders };
  if (who) {
    headers.Authorization = `Bearer ${fixture().sessions[who].token}`;
    headers['x-organization-id'] = actor(who).orgId;
  }
  const res = await fetch(`${E2E.apiV2Url}${AMENITY_V2}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { message: text };
  }
  return { status: res.status, body: parsed };
};

export type FacilityKey = 'pool' | 'gym' | 'court' | 'hall' | 'rooms' | 'tools' | 'draft' | 'poolOther';

export const facility = (key: FacilityKey) => {
  const f = fixture().facilities?.[key];
  if (!f) throw new Error(`Facility "${key}" is not in the amenity fixture`);
  return f;
};

const IST_OFFSET_MIN = 330;

/** UTC ISO string for `HH:mm` IST, `daysAhead` days from today (IST calendar). */
export const istAt = (daysAhead: number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const nowIst = new Date(Date.now() + IST_OFFSET_MIN * 60000);
  const utcMs =
    Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate() + daysAhead, h, m) -
    IST_OFFSET_MIN * 60000;
  return new Date(utcMs).toISOString();
};

/** IST calendar date `YYYY-MM-DD`, `daysAhead` days from today. */
export const istDate = (daysAhead: number) => istAt(daysAhead, '12:00').slice(0, 10);

let keySeq = 0;
export const idemKey = (prefix = 'e2e') => `${prefix}-${Date.now()}-${++keySeq}`;

export interface HoldInput {
  facilityKey: FacilityKey;
  daysAhead?: number;
  start: string;
  end: string;
  headcount?: number;
  quantity?: number;
  resourceIndex?: number;
}

/** Creates a V2 hold as `who` (setup only). Returns the raw API result. */
export const createHoldAs = (who: Actor, input: HoldInput) => {
  const f = facility(input.facilityKey);
  const days = input.daysAhead ?? 1;
  return amenityApiAs(
    who,
    'POST',
    '/holds',
    {
      facilityId: f.id,
      ...(input.resourceIndex !== undefined ? { resourceId: f.resourceIds[input.resourceIndex] } : {}),
      requestedStartDateTime: istAt(days, input.start),
      requestedEndDateTime: istAt(days, input.end),
      headcount: input.headcount ?? 1,
      quantity: input.quantity ?? 1,
      holdType: 'STANDARD',
    },
    { 'x-idempotency-key': idemKey('hold') }
  );
};

/** Confirms a hold as `who` (setup only). */
export const confirmHoldAs = (who: Actor, holdId: string, body: Record<string, any> = {}) =>
  amenityApiAs(who, 'POST', '/reservations/confirm', { holdId, ...body }, { 'x-idempotency-key': idemKey('cfm') });

/** Hold + confirm in one step; throws if either fails. */
export const bookAs = async (who: Actor, input: HoldInput, confirmBody: Record<string, any> = {}) => {
  const hold = await createHoldAs(who, input);
  if (hold.status !== 201 && hold.status !== 200) {
    throw new Error(`Setup: hold failed for ${who}: ${hold.status} ${JSON.stringify(hold.body)}`);
  }
  const holdId = hold.body.data?.hold?._id;
  const confirm = await confirmHoldAs(who, holdId, confirmBody);
  if (confirm.status !== 201 && confirm.status !== 200) {
    throw new Error(`Setup: confirm failed for ${who}: ${confirm.status} ${JSON.stringify(confirm.body)}`);
  }
  return { holdId, reservation: confirm.body.data?.reservation || confirm.body.data, raw: confirm.body.data };
};

/** Polls `probe` until it returns a truthy value (e.g. a worker has processed a document). */
export const eventually = async <T>(probe: () => Promise<T | null | undefined | false>, timeoutMs = 15000, label = 'condition') => {
  const deadline = Date.now() + timeoutMs;
  let last: any;
  while (Date.now() < deadline) {
    last = await probe();
    if (last) return last as T;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`);
};

export const walletBalance = async (who: Actor) => {
  const me = actor(who);
  const w = await (await collection('wallets')).findOne({ userId: oid(me.id), orgId: oid(me.orgId) });
  return w ? Number(w.balance) : null;
};

export const amenityCollection = (name: string) => collection(`amenity_management_${name}`);
