import {
  parsePhone,
  toE164,
  formatPhoneDisplay,
  getPhoneCountries,
  setDefaultPhoneCountry,
  getDefaultPhoneCountry,
  phoneLengthStatus,
} from '../phone';
import { validatePhone } from '../validation';

describe('phone utils', () => {
  afterEach(() => setDefaultPhoneCountry(null));

  it('lists every libphonenumber country with a name, dial code and flag', () => {
    const countries = getPhoneCountries();
    expect(countries.length).toBeGreaterThan(240);
    const ae = countries.find((c) => c.code === 'AE')!;
    expect(ae).toMatchObject({ name: 'United Arab Emirates', dialCode: '+971' });
    expect(ae.flag).toBe('🇦🇪');
  });

  it.each([
    ['+971 50 123 4567', 'IN', '+971501234567', 'AE'],
    ['00971501234567', 'IN', '+971501234567', 'AE'],
    ['+44 7400 123456', 'IN', '+447400123456', 'GB'],
    ['+1 (415) 555-2671', 'IN', '+14155552671', 'US'],
    ['98765 43210', 'IN', '+919876543210', 'IN'],
    ['098765-43210', 'IN', '+919876543210', 'IN'],
    ['+91 98765 43210', 'AE', '+919876543210', 'IN'],
    ['050 123 4567', 'AE', '+971501234567', 'AE'],
    ['05 1234 5678', 'SA', '+966512345678', 'SA'],
  ])('parses contact number %s (default %s) → %s', (raw, def, e164, country) => {
    const parsed = parsePhone(raw, def);
    expect(parsed.e164).toBe(e164);
    expect(parsed.country).toBe(country);
  });

  it('returns null for empty or impossible numbers', () => {
    expect(toE164('')).toBeNull();
    expect(toE164('12', 'IN')).toBeNull();
    expect(toE164('abc', 'IN')).toBeNull();
  });

  it('uses the community country as the default for bare numbers', () => {
    setDefaultPhoneCountry('AE');
    expect(getDefaultPhoneCountry()).toBe('AE');
    expect(toE164('050 123 4567')).toBe('+971501234567');
    setDefaultPhoneCountry('xx');
    expect(getDefaultPhoneCountry()).not.toBe('XX');
  });

  it('formats for display', () => {
    expect(formatPhoneDisplay('+971501234567')).toBe('+971 50 123 4567');
    expect(formatPhoneDisplay('')).toBe('');
  });

  it('reports length status per country', () => {
    expect(phoneLengthStatus('', 'IN')).toBe('empty');
    expect(phoneLengthStatus('98765', 'IN')).toBe('short');
    expect(phoneLengthStatus('9876543210', 'IN')).toBe('ok');
    expect(phoneLengthStatus('501234567', 'AE')).toBe('ok');
  });
});

describe('validatePhone (international)', () => {
  it('accepts valid numbers in any country', () => {
    expect(validatePhone('+971501234567').isValid).toBe(true);
    expect(validatePhone('+447400123456').isValid).toBe(true);
    expect(validatePhone('9876543210', 'IN').isValid).toBe(true);
    expect(validatePhone('9876543210', '+91').isValid).toBe(true);
  });

  it('flags short, long and invalid numbers', () => {
    expect(validatePhone('98765', 'IN').status).toBe('incomplete');
    expect(validatePhone('98765432101234', 'IN').status).toBe('invalid');
    expect(validatePhone('0000000000', 'IN').isValid).toBe(false);
    expect(validatePhone('', 'IN').status).toBe('idle');
  });
});
