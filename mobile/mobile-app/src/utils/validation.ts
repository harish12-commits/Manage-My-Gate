/**
 * Centralized Validation & Error-Handling Engine
 * Provides unified validation rules, formatting, and backend error sanitation.
 */

import { getDefaultPhoneCountry, getPhoneCountries, maxNationalDigits, parsePhone, phoneLengthStatus } from './phone';

export type ValidationStatus = 'idle' | 'incomplete' | 'validating' | 'valid' | 'invalid';

export interface ValidationResult {
  isValid: boolean;
  status: ValidationStatus;
  message?: string;
}

export interface PasswordRequirements {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

export interface PasswordValidationResult extends ValidationResult {
  requirements: PasswordRequirements;
  satisfiedCount: number;
}

/**
 * Validates email input with intelligent typing stages:
 * - Empty: 'idle'
 * - Partial before @ or partial domain: 'incomplete'
 * - Complete valid email: 'valid'
 * - Malformed pattern: 'invalid'
 */
export const validateEmail = (rawEmail: string): ValidationResult => {
  if (!rawEmail || !rawEmail.trim()) {
    return {
      isValid: false,
      status: 'idle',
      message: 'Email address is required.',
    };
  }

  const email = rawEmail.trim().toLowerCase();

  // Basic check for disallowed characters
  if (/\s/.test(email) || /[^\w@.\-+_]/.test(email)) {
    return {
      isValid: false,
      status: 'invalid',
      message: 'Email cannot contain spaces or special characters.',
    };
  }

  const atIndex = email.indexOf('@');

  // No '@' yet
  if (atIndex === -1) {
    if (email.length < 3) {
      return {
        isValid: false,
        status: 'incomplete',
        message: 'Enter a valid email address.',
      };
    }
    return {
      isValid: false,
      status: 'incomplete',
      message: 'Include an "@" in the email address.',
    };
  }

  // Multiple '@' characters
  if (email.indexOf('@', atIndex + 1) !== -1) {
    return {
      isValid: false,
      status: 'invalid',
      message: 'Email can only contain one "@" symbol.',
    };
  }

  const localPart = email.substring(0, atIndex);
  const domainPart = email.substring(atIndex + 1);

  if (!localPart) {
    return {
      isValid: false,
      status: 'incomplete',
      message: 'Enter the part before "@".',
    };
  }

  if (!domainPart) {
    return {
      isValid: false,
      status: 'incomplete',
      message: 'Enter a domain (e.g. gmail.com).',
    };
  }

  const dotIndex = domainPart.lastIndexOf('.');

  if (dotIndex === -1) {
    return {
      isValid: false,
      status: 'incomplete',
      message: 'Complete the domain name (e.g. .com).',
    };
  }

  const domainExtension = domainPart.substring(dotIndex + 1);

  if (domainExtension.length < 2) {
    return {
      isValid: false,
      status: 'incomplete',
      message: 'Complete the domain extension (e.g. .com).',
    };
  }

  // Standard strict regex for complete email check
  const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!strictEmailRegex.test(email)) {
    return {
      isValid: false,
      status: 'invalid',
      message: 'Enter a valid email address.',
    };
  }

  return {
    isValid: true,
    status: 'valid',
    message: 'Email format is valid.',
  };
};

/**
 * Validates phone numbers for any country (libphonenumber-js).
 * `country` accepts an ISO code ('IN', 'AE') or a dial code ('+91'); a value that
 * starts with '+' is parsed as international regardless of `country`.
 */
export const validatePhone = (
  rawPhone: string,
  country: string = getDefaultPhoneCountry()
): ValidationResult & { currentDigits: number; requiredDigits: number } => {
  const iso = country.startsWith('+')
    ? getPhoneCountries().find((c) => c.dialCode === country)?.code || getDefaultPhoneCountry()
    : country;
  if (!rawPhone || !rawPhone.trim()) {
    return { isValid: false, status: 'idle', message: 'Phone number is required.', currentDigits: 0, requiredDigits: maxNationalDigits(iso) };
  }

  const parsed = parsePhone(rawPhone, iso);
  const currentDigits = parsed.nationalNumber.length;
  const requiredDigits = maxNationalDigits(parsed.country);
  const lengthStatus = phoneLengthStatus(parsed.nationalNumber, parsed.country);

  if (currentDigits === 0) {
    return { isValid: false, status: 'incomplete', message: 'Enter your mobile number.', currentDigits, requiredDigits };
  }
  if (lengthStatus === 'short') {
    return { isValid: false, status: 'incomplete', message: 'Number is too short for the selected country.', currentDigits, requiredDigits };
  }
  if (lengthStatus === 'long') {
    return { isValid: false, status: 'invalid', message: 'Number is too long for the selected country.', currentDigits, requiredDigits };
  }
  if (!parsed.isValid) {
    return { isValid: false, status: 'invalid', message: 'Enter a valid phone number for the selected country.', currentDigits, requiredDigits };
  }
  return { isValid: true, status: 'valid', message: 'Mobile number is valid.', currentDigits, requiredDigits };
};

/**
 * Validates password criteria with dynamic requirement tracker
 */
export const validatePassword = (password: string): PasswordValidationResult => {
  if (!password) {
    return {
      isValid: false,
      status: 'idle',
      message: 'Password is required.',
      requirements: {
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false,
      },
      satisfiedCount: 0,
    };
  }

  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const satisfiedCount = Object.values(requirements).filter(Boolean).length;
  const isMinimumMet = requirements.length && (satisfiedCount >= 3);

  let message = 'Password looks strong.';
  let status: ValidationStatus = 'valid';

  if (!requirements.length) {
    message = 'Password must be at least 8 characters.';
    status = 'incomplete';
  } else if (!isMinimumMet) {
    message = 'Include uppercase, lowercase, and numbers.';
    status = 'incomplete';
  }

  return {
    isValid: isMinimumMet,
    status,
    message,
    requirements,
    satisfiedCount,
  };
};

/**
 * Validates required field
 */
export const validateRequired = (value: any, fieldLabel: string = 'Field'): ValidationResult => {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    return {
      isValid: false,
      status: 'invalid',
      message: `${fieldLabel} is required.`,
    };
  }
  return {
    isValid: true,
    status: 'valid',
  };
};

/**
 * Validates numeric ranges
 */
export const validateNumber = (
  value: any,
  options: {
    min?: number;
    max?: number;
    integerOnly?: boolean;
    fieldLabel?: string;
  } = {}
): ValidationResult => {
  const { min, max, integerOnly = false, fieldLabel = 'Value' } = options;

  if (value === undefined || value === null || String(value).trim() === '') {
    return {
      isValid: false,
      status: 'idle',
      message: `${fieldLabel} is required.`,
    };
  }

  const num = Number(value);

  if (isNaN(num)) {
    return {
      isValid: false,
      status: 'invalid',
      message: `${fieldLabel} must be a valid number.`,
    };
  }

  if (integerOnly && !Number.isInteger(num)) {
    return {
      isValid: false,
      status: 'invalid',
      message: `${fieldLabel} must be a whole number.`,
    };
  }

  if (min !== undefined && num < min) {
    return {
      isValid: false,
      status: 'invalid',
      message: `${fieldLabel} must be at least ${min}.`,
    };
  }

  if (max !== undefined && num > max) {
    return {
      isValid: false,
      status: 'invalid',
      message: `${fieldLabel} cannot exceed ${max}.`,
    };
  }

  return {
    isValid: true,
    status: 'valid',
  };
};

/**
 * Translates technical backend / Mongo / Axios errors into human-readable user messages
 */
export const parseBackendError = (
  error: any,
  fallbackMessage: string = 'Something went wrong. Please try again.'
): {
  userMessage: string;
  field?: string;
  isDuplicate: boolean;
} => {
  if (!error) {
    return { userMessage: fallbackMessage, isDuplicate: false };
  }

  const rawMsg =
    typeof error === 'string'
      ? error
      : error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        '';

  const status = error?.response?.status;

  // MongoDB Duplicate Key Error (E11000)
  if (rawMsg.includes('E11000') || rawMsg.includes('duplicate key error')) {
    if (rawMsg.toLowerCase().includes('email')) {
      return {
        userMessage: 'This email address is already registered.',
        field: 'email',
        isDuplicate: true,
      };
    }
    if (rawMsg.toLowerCase().includes('phone')) {
      return {
        userMessage: 'This phone number is already registered.',
        field: 'phone',
        isDuplicate: true,
      };
    }
    if (rawMsg.toLowerCase().includes('unit') || rawMsg.toLowerCase().includes('villa')) {
      return {
        userMessage: 'This villa or unit number already exists.',
        field: 'unitNumber',
        isDuplicate: true,
      };
    }
    return {
      userMessage: 'A record with this information already exists.',
      isDuplicate: true,
    };
  }

  // HTTP 409 Conflict
  if (status === 409 || rawMsg.toLowerCase().includes('already exists') || rawMsg.toLowerCase().includes('already an active member')) {
    if (rawMsg.toLowerCase().includes('email') || rawMsg.toLowerCase().includes('user')) {
      return {
        userMessage: 'This user is already an active member of this community.',
        field: 'email',
        isDuplicate: true,
      };
    }
    if (rawMsg.toLowerCase().includes('unit') || rawMsg.toLowerCase().includes('villa')) {
      return {
        userMessage: 'This villa / unit already exists in this community.',
        field: 'unitNumber',
        isDuplicate: true,
      };
    }
    return {
      userMessage: rawMsg || 'This entry already exists.',
      isDuplicate: true,
    };
  }

  // Validation Failed 400
  if (status === 400 && rawMsg.toLowerCase().includes('validation failed')) {
    return {
      userMessage: 'Please check your inputs and make sure all required fields are filled correctly.',
      isDuplicate: false,
    };
  }

  // Network / Connection drop
  if (
    error?.code === 'ECONNABORTED' ||
    rawMsg.toLowerCase().includes('network error') ||
    rawMsg.toLowerCase().includes('timeout')
  ) {
    return {
      userMessage: 'Unable to connect right now. Please check your internet connection.',
      isDuplicate: false,
    };
  }

  // Return cleaned message if already user-readable, avoiding raw stack dumps
  if (rawMsg && !rawMsg.includes('at ') && !rawMsg.includes('Error:') && rawMsg.length < 150) {
    return {
      userMessage: rawMsg,
      isDuplicate: false,
    };
  }

  return {
    userMessage: fallbackMessage,
    isDuplicate: false,
  };
};
