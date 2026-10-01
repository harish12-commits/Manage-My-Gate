import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  validatePhoneNumberLength,
  type CountryCode,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import { COUNTRY_NAMES } from './countryNames';

/**
 * Single phone standard for the app: numbers are stored and sent as E.164
 * (e.g. +971501234567), matching backend `normalizePhone`.
 */

export interface PhoneCountry {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
}

export const FALLBACK_COUNTRY: CountryCode = 'IN';

const isCountryCode = (value?: string | null): value is CountryCode =>
  !!value && (getCountries() as string[]).includes(value.toUpperCase());

export const countryFlag = (code: string): string =>
  code
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));

const toPhoneCountry = (code: CountryCode): PhoneCountry => ({
  code,
  name: COUNTRY_NAMES[code] || code,
  dialCode: `+${getCountryCallingCode(code)}`,
  flag: countryFlag(code),
});

let cachedCountries: PhoneCountry[] | null = null;
export const getPhoneCountries = (): PhoneCountry[] => {
  if (!cachedCountries) {
    cachedCountries = getCountries()
      .map(toPhoneCountry)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return cachedCountries;
};

export const getPhoneCountry = (code?: string | null): PhoneCountry =>
  toPhoneCountry(isCountryCode(code) ? (code.toUpperCase() as CountryCode) : getDefaultPhoneCountry());

// ── Default country: community setting → device region → India ──

let communityCountry: CountryCode | null = null;

/** Called when the active community is known (organization.countryCode). */
export const setDefaultPhoneCountry = (code?: string | null) => {
  communityCountry = isCountryCode(code) ? (code.toUpperCase() as CountryCode) : null;
};

const deviceRegion = (): CountryCode | null => {
  try {
    // Lazy require keeps this module usable in tests and on web without the native module.
    const { getLocales } = require('expo-localization');
    const region = getLocales?.()?.[0]?.regionCode;
    return isCountryCode(region) ? (region.toUpperCase() as CountryCode) : null;
  } catch {
    return null;
  }
};

export const getDefaultPhoneCountry = (): CountryCode =>
  communityCountry || deviceRegion() || FALLBACK_COUNTRY;

// ── Parsing ──

export interface ParsedPhone {
  /** E.164 when the number is possible, otherwise null. */
  e164: string | null;
  country: CountryCode;
  /** National significant number, digits only. */
  nationalNumber: string;
  isValid: boolean;
  isPossible: boolean;
}

/**
 * Parses any user/contact-book phone string. Handles "+971 50…", "00971 50…",
 * "(050) 123-4567" and bare local numbers (read in `defaultCountry`).
 */
export const parsePhone = (raw: string, defaultCountry?: string | null): ParsedPhone => {
  const fallback = isCountryCode(defaultCountry)
    ? (defaultCountry.toUpperCase() as CountryCode)
    : getDefaultPhoneCountry();
  const trimmed = (raw || '').trim().replace(/^00(?=\d)/, '+');
  const digits = trimmed.replace(/\D/g, '');
  const parsed = trimmed ? parsePhoneNumberFromString(trimmed, fallback) : undefined;

  if (!parsed) {
    return { e164: null, country: fallback, nationalNumber: digits, isValid: false, isPossible: false };
  }
  const isPossible = parsed.isPossible();
  return {
    e164: isPossible ? parsed.number : null,
    country: (parsed.country as CountryCode) || fallback,
    nationalNumber: String(parsed.nationalNumber),
    isValid: parsed.isValid(),
    isPossible,
  };
};

/** Returns E.164 or null when the number is not a possible phone number. */
export const toE164 = (raw: string, defaultCountry?: string | null): string | null =>
  raw && raw.trim() ? parsePhone(raw, defaultCountry).e164 : null;

/** Human display: "+971 50 123 4567". Falls back to the raw value. */
export const formatPhoneDisplay = (value?: string | null): string => {
  if (!value) return '';
  const parsed = parsePhoneNumberFromString(value.trim(), getDefaultPhoneCountry());
  return parsed ? parsed.formatInternational() : value;
};

/** Example national number for placeholders, e.g. "81234 56789". */
export const examplePhone = (code: string): string => {
  try {
    return getExampleNumber(code as CountryCode, examples)?.formatNational() || '';
  } catch {
    return '';
  }
};

/** Max national digits for the country (from its example mobile number). */
export const maxNationalDigits = (code: string): number => {
  return 10;
};

export type PhoneLengthStatus = 'empty' | 'short' | 'ok' | 'long' | 'invalid';

export const phoneLengthStatus = (national: string, code: string): PhoneLengthStatus => {
  const digits = (national || '').replace(/\D/g, '');
  if (!digits) return 'empty';
  
  if (digits.length < 10) return 'short';
  if (digits.length > 10) return 'long';
  return 'ok';
};
