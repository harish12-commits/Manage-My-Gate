/**
 * Mock payment gateway guard.
 *
 * The mock provider accepts any signature, so it must never be reachable in an environment that
 * handles real money. It is allowed only when NODE_ENV is explicitly "test", or explicitly
 * "development" together with ALLOW_MOCK_PAYMENTS=true. An unset/unknown NODE_ENV means "not allowed".
 */
export const isMockPaymentAllowed = () => {
  const env = process.env.NODE_ENV;
  if (env === 'test') return true;
  return env === 'development' && process.env.ALLOW_MOCK_PAYMENTS === 'true';
};

export const assertMockPaymentAllowed = (HttpError) => {
  if (!isMockPaymentAllowed()) {
    throw new HttpError(400, 'Mock payment gateway is disabled in this environment.');
  }
};

export default isMockPaymentAllowed;
