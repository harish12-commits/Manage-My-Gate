import test from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';
import { normalizePhone, phoneVariants, isNormalizablePhone, toE164OrSelf } from '../src/utils/phone.utils.js';
import { createPassRules } from '../src/features/visitorPass/visitorPass.validator.js';
import { createBlacklistRules } from '../src/features/blacklist/blacklist.validator.js';

const runRules = async (rules, body) => {
  const req = { body, query: {}, params: {} };
  for (const rule of rules) await rule.run(req);
  return { req, errors: validationResult(req).array() };
};

test('normalizePhone accepts international and legacy bare numbers', () => {
  assert.equal(normalizePhone('+971 50 123 4567'), '+971501234567');
  assert.equal(normalizePhone('+44 7400 123456'), '+447400123456');
  assert.equal(normalizePhone('9876543210'), '+919876543210');
  assert.equal(normalizePhone('050 123 4567', 'AE'), '+971501234567');
  assert.equal(normalizePhone('12'), null);
});

test('phoneVariants covers E.164 and legacy national spelling', () => {
  const v = phoneVariants('+919876543210');
  assert.ok(v.includes('+919876543210'));
  assert.ok(v.includes('9876543210'));
  assert.ok(phoneVariants('9876543210').includes('+919876543210'));
  assert.deepEqual(phoneVariants(''), []);
});

test('validator helpers', () => {
  assert.equal(isNormalizablePhone('+971501234567'), true);
  assert.equal(isNormalizablePhone('abc'), false);
  assert.equal(toE164OrSelf('9876543210'), '+919876543210');
  assert.equal(toE164OrSelf(''), '');
});

test('visitor pass rules accept a foreign number and store E.164', async () => {
  const { req, errors } = await runRules(createPassRules, {
    visitorDetails: { name: 'Sam', phone: '+44 7400 123456' },
    groupGuests: [{ name: 'A', phone: '9876543210' }],
  });
  assert.equal(errors.filter((e) => /phone/i.test(e.path)).length, 0);
  assert.equal(req.body.visitorDetails.phone, '+447400123456');
  assert.equal(req.body.groupGuests[0].phone, '+919876543210');
});

test('visitor pass rules reject an invalid phone', async () => {
  const { errors } = await runRules(createPassRules, { visitorDetails: { name: 'Sam', phone: '123' } });
  assert.ok(errors.some((e) => e.path === 'visitorDetails.phone'));
});

test('blacklist rules normalize phone', async () => {
  const { req } = await runRules(createBlacklistRules, { orgId: 'x', name: 'N', reason: 'r', phone: '98765 43210' });
  assert.equal(req.body.phone, '+919876543210');
});
