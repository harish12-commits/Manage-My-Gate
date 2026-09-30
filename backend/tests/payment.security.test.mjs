import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.JWT_SECRET ||= 'x'.repeat(40);
process.env.SESSION_SECRET ||= 'y'.repeat(40);
process.env.ENCRYPTION_KEY ||= 'k'.repeat(40);

const { isMockPaymentAllowed } = await import('../src/features/payment/utils/mockGuard.js');
const { default: mockProvider } = await import('../src/features/payment/providers/mock.provider.js');
const { encryptGCM, encrypt, decryptCredential } = await import('../src/features/integrationHub/utils/crypto.util.js');

const withEnv = async (vars, fn) => {
  const prev = {};
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return await fn(); } finally { for (const k of Object.keys(prev)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
};

test('mock payments are blocked when NODE_ENV is unset, production or staging', async () => {
  for (const env of [undefined, 'production', 'staging']) {
    await withEnv({ NODE_ENV: env, ALLOW_MOCK_PAYMENTS: 'true' }, () => assert.equal(isMockPaymentAllowed(), false, String(env)));
  }
});

test('mock payments need an explicit opt-in in development, and are allowed in test', async () => {
  await withEnv({ NODE_ENV: 'development', ALLOW_MOCK_PAYMENTS: undefined }, () => assert.equal(isMockPaymentAllowed(), false));
  await withEnv({ NODE_ENV: 'development', ALLOW_MOCK_PAYMENTS: 'true' }, () => assert.equal(isMockPaymentAllowed(), true));
  await withEnv({ NODE_ENV: 'test' }, () => assert.equal(isMockPaymentAllowed(), true));
});

test('mock provider refuses to verify any signature outside allowed environments', async () => {
  await withEnv({ NODE_ENV: 'production' }, async () => {
    await assert.rejects(() => mockProvider.verifySignature({ orderId: 'o', paymentId: 'p', signature: 'anything' }), /disabled/);
    await assert.rejects(() => mockProvider.refund({ paymentId: 'p', amount: 1 }), /disabled/);
  });
});

test('credentials decrypt from both GCM and legacy CBC, and GCM rejects tampering', () => {
  const gcm = encryptGCM('rzp_secret_value');
  assert.equal(decryptCredential(gcm), 'rzp_secret_value');
  const cbc = encrypt('legacy_secret');
  assert.equal(decryptCredential(cbc), 'legacy_secret');
  const tampered = { ...gcm, encryptedValue: (gcm.encryptedValue[0] === 'a' ? 'b' : 'a') + gcm.encryptedValue.slice(1) };
  assert.throws(() => decryptCredential(tampered));
});
