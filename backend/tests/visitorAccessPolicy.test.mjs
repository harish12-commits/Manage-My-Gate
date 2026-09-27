import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertPassAccess,
  assertResidentOwnsVilla,
  assertWalkInResolutionAccess,
  isGateOperator,
} from '../src/features/visitorPass/visitorPass.policy.js';
import { getPassEntryFailure, isWithinTimeWindow } from '../src/features/visitorPass/visitorPass.time.js';

const resident = { id: 'resident-1', role: 'Resident', permissions: ['visitor:resident'] };
const guard = { id: 'guard-1', role: 'Security Guard', permissions: ['visitor:guard'] };

test('visitor role access keeps residents to their own pass and allows gate operators', () => {
  const pass = { createdById: 'resident-1' };
  assert.doesNotThrow(() => assertPassAccess(pass, resident));
  assert.doesNotThrow(() => assertPassAccess(pass, guard));
  assert.throws(() => assertPassAccess(pass, { ...resident, id: 'resident-2' }), { statusCode: 403 });
  assert.equal(isGateOperator(guard), true);
});

test('resident unit and walk-in approval access are ownership-scoped', () => {
  const membership = { villaId: 'villa-1', units: [{ villaId: 'villa-2' }] };
  assert.doesNotThrow(() => assertResidentOwnsVilla(membership, 'villa-2'));
  assert.throws(() => assertResidentOwnsVilla(membership), { statusCode: 400 });
  assert.throws(() => assertResidentOwnsVilla(membership, 'villa-3'), { statusCode: 403 });

  assert.doesNotThrow(() => assertWalkInResolutionAccess({ residentId: 'resident-1' }, resident));
  assert.throws(() => assertWalkInResolutionAccess({ residentId: 'resident-2' }, resident), { statusCode: 403 });
});

test('pass expiry, revocation, time windows, and recurring days are enforced server-side', () => {
  const now = new Date('2026-09-28T10:30:00'); // Monday
  const basePass = {
    status: 'PENDING',
    validity: {
      startDate: new Date('2026-09-28T09:00:00'),
      endDate: new Date('2026-09-28T11:00:00'),
      timeWindowStart: '10:00',
      timeWindowEnd: '11:00',
      allowedDays: [1],
    },
    usageLimit: { currentUses: 0, maxUses: 1 },
  };

  assert.equal(getPassEntryFailure(basePass, now), null);
  assert.match(getPassEntryFailure({ ...basePass, status: 'REVOKED' }, now), /revoked/i);
  assert.match(getPassEntryFailure({ ...basePass, validity: { ...basePass.validity, endDate: new Date('2026-09-28T10:00:00') } }, now), /not currently active/i);
  assert.match(getPassEntryFailure({ ...basePass, validity: { ...basePass.validity, allowedDays: [2] } }, now), /day of the week/i);
  assert.equal(isWithinTimeWindow('00:30', '22:00', '02:00'), true);
  assert.equal(isWithinTimeWindow('12:00', '22:00', '02:00'), false);
});
