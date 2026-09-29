import { validatePhone } from '../validation';

describe('validatePhone country-code normalization', () => {
  it('accepts a canonical Indian E.164 phone when the screen passes the IN ISO code', () => {
    expect(validatePhone('+919876543210', 'IN')).toMatchObject({
      isValid: true,
      status: 'valid',
      currentDigits: 10,
    });
  });

  it('accepts the same phone when a +91 dial code is supplied', () => {
    expect(validatePhone('+919876543210', '+91')).toMatchObject({
      isValid: true,
      status: 'valid',
      currentDigits: 10,
    });
  });

  it('still rejects an overlong Indian national number', () => {
    expect(validatePhone('+9198765432109', 'IN')).toMatchObject({
      isValid: false,
      status: 'invalid',
      currentDigits: 11,
    });
  });
});