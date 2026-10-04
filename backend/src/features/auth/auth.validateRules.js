import { body } from 'express-validator';
import { normalizePhone } from '../../utils/phone.utils.js';

// Strict password policy validation regex matching the frontend policy:
// Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, and 1 special character.
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=~`[\]{}|\\:";'<>?,./]).{8,}$/;

/**
 * Validation rules for registration endpoint
 */
export const registerRules = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('username')
    .optional()
    .isAlphanumeric()
    .withMessage('Username must be alphanumeric')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(passwordRegex)
    .withMessage('Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character'),
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isString()
    .withMessage('Phone must be a string')
    .trim(),
  body('privacyPolicyAccepted')
    .optional()
    .isBoolean()
    .withMessage('privacyPolicyAccepted must be a boolean'),
];

export const setupAccountPasswordRules = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Valid email address is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('orgName')
    .optional()
    .trim(),
];

/**
 * Validation rules for login endpoint
 */
export const loginRules = [
  body('login')
    .custom((val, { req }) => {
      const id = val || req.body?.email || req.body?.username;
      if (!id || !String(id).trim()) {
        throw new Error('Email or Username is required');
      }
      return true;
    })
    .customSanitizer((val, { req }) => {
      return String(val || req.body?.email || req.body?.username || '').trim();
    }),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

/**
 * Validation rules for accepting an invitation endpoint
 */
export const acceptInviteRules = [
  body('token')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .trim(),
  body('password')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(passwordRegex)
    .withMessage('Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character'),
  body('name')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim(),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim(),
];

/**
 * Validation rules for switching workspace context endpoint
 */
export const switchContextRules = [
  body('targetOrgId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('targetOrgId must be a valid Mongo ID')
    .trim(),
  body('targetVillaId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('targetVillaId must be a valid Mongo ID')
    .trim(),
  body('targetRole')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('targetRole must be a string')
    .trim(),
  body('targetAssignmentId')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('targetAssignmentId must be a string')
    .trim(),
  body('targetAssignmentName')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('targetAssignmentName must be a string')
    .trim(),
  body('targetAssignmentType')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['villa', 'gate', 'facility', 'general', 'location'])
    .withMessage('targetAssignmentType must be one of: villa, gate, facility, general, location')
    .trim(),
];

/**
 * Validation rules for SSO token verification
 */
export const ssoVerifyRules = [
  body('inviteToken')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('Invite token must be a string')
    .trim(),
  body()
    .custom((value, { req }) => {
      const ssoToken = req.body.token || req.body.credential;
      const ssoCode = req.body.code;
      if ((!ssoToken || (typeof ssoToken === 'string' && !ssoToken.trim())) && (!ssoCode || (typeof ssoCode === 'string' && !ssoCode.trim()))) {
        throw new Error('SSO provider token or authorization code is required');
      }
      if (ssoToken) {
        if (typeof ssoToken !== 'string') {
          throw new Error('Token must be a string');
        }
        req.body.token = ssoToken.trim();
      }
      if (ssoCode) {
        if (typeof ssoCode !== 'string') {
          throw new Error('Code must be a string');
        }
        req.body.code = ssoCode.trim();
      }
      return true;
    }),
  body('codeVerifier')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('codeVerifier must be a string')
    .trim(),
  body('redirectUri')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('redirectUri must be a string')
    .trim(),
  body('nonce')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('nonce must be a string')
    .trim(),
  body('fullName')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ max: 200 })
    .withMessage('fullName must be a string of 200 characters or fewer')
    .trim(),
];

/**
 * Validation rules for phone login initiation
 */
export const phoneLoginRules = [
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isString()
    .withMessage('Phone must be a string')
      .trim()
      .custom((value) => Boolean(normalizePhone(value)))
      .withMessage('Please enter a valid phone number with country code'),
];

/**
 * Validation rules for phone login verification
 */
export const phoneVerifyRules = [
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isString()
    .withMessage('Phone must be a string')
      .trim()
      .custom((value) => Boolean(normalizePhone(value)))
      .withMessage('Please enter a valid phone number with country code'),
  body('code')
    .notEmpty()
    .withMessage('Verification code is required')
    .isString()
    .withMessage('Verification code must be a string')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be exactly 6 digits')
    .isNumeric()
    .withMessage('Verification code must contain only numbers'),
];

/**
 * Validation rules for email OTP login initiation
 */
export const emailOtpLoginRules = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
];

/**
 * Validation rules for email OTP login verification
 */
export const emailOtpVerifyRules = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('code')
    .notEmpty()
    .withMessage('Verification code is required')
    .isString()
    .withMessage('Verification code must be a string')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be exactly 6 digits')
    .isNumeric()
    .withMessage('Verification code must contain only numbers'),
];

/**
 * Validation rules for forgot password initiation
 */
export const forgotPasswordRules = [
  body('identifier')
    .notEmpty()
    .withMessage('Identifier is required')
    .trim()
    .customSanitizer((value) => {
      if (typeof value === 'string') {
        return value.includes('@') ? value.trim().toLowerCase() : value.replace(/\s+/g, '');
      }
      return value;
    })
    .custom((value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?\d{8,15}$/;
      if (!emailRegex.test(value) && !phoneRegex.test(value)) {
        throw new Error('Identifier must be a valid email address or phone number');
      }
      return true;
    }),
];

/**
 * Validation rules for reset password OTP verification step
 */
export const verifyResetPasswordOtpRules = [
  body('identifier')
    .notEmpty()
    .withMessage('Identifier is required')
    .trim()
    .customSanitizer((value) => {
      if (typeof value === 'string') {
        return value.includes('@') ? value.trim().toLowerCase() : value.replace(/\s+/g, '');
      }
      return value;
    })
    .custom((value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?\d{8,15}$/;
      if (!emailRegex.test(value) && !phoneRegex.test(value)) {
        throw new Error('Identifier must be a valid email address or phone number');
      }
      return true;
    }),
  body('code')
    .notEmpty()
    .withMessage('Verification code is required')
    .isString()
    .withMessage('Verification code must be a string')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be exactly 6 digits')
    .isNumeric()
    .withMessage('Verification code must contain only numbers'),
];

/**
 * Validation rules for final password reset execution
 */
export const resetPasswordRules = [
  body('identifier')
    .notEmpty()
    .withMessage('Identifier is required')
    .trim()
    .customSanitizer((value) => {
      if (typeof value === 'string') {
        return value.includes('@') ? value.trim().toLowerCase() : value.replace(/\s+/g, '');
      }
      return value;
    })
    .custom((value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?\d{8,15}$/;
      if (!emailRegex.test(value) && !phoneRegex.test(value)) {
        throw new Error('Identifier must be a valid email address or phone number');
      }
      return true;
    }),
  body('code')
    .notEmpty()
    .withMessage('Verification code is required')
    .isString()
    .withMessage('Verification code must be a string')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be exactly 6 digits')
    .isNumeric()
    .withMessage('Verification code must contain only numbers'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(passwordRegex)
    .withMessage('Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character'),
];

/**
 * Validation rules for register via SSO with Organization
 */
/**
 * Validation rules for accepting an invitation via SSO
 */
export const acceptInviteSsoRules = [
  body('inviteToken')
    .notEmpty()
    .withMessage('Invitation token is required')
    .trim(),
  body()
    .custom((value, { req }) => {
      const ssoCredential = req.body.ssoCredential || req.body.token || req.body.credential;
      const ssoCode = req.body.code;
      if ((!ssoCredential || (typeof ssoCredential === 'string' && !ssoCredential.trim())) && (!ssoCode || (typeof ssoCode === 'string' && !ssoCode.trim()))) {
        throw new Error('SSO credential or authorization code is required');
      }
      if (ssoCredential) {
        if (typeof ssoCredential !== 'string') {
          throw new Error('SSO credential must be a string');
        }
        req.body.ssoCredential = ssoCredential.trim();
      }
      if (ssoCode) {
        if (typeof ssoCode !== 'string') {
          throw new Error('Code must be a string');
        }
        req.body.code = ssoCode.trim();
      }
      return true;
    }),
  body('provider')
    .notEmpty()
    .withMessage('Provider is required')
    .isIn(['google', 'microsoft', 'apple'])
    .withMessage('Provider must be google, microsoft, or apple')
    .trim(),
  body('codeVerifier')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('codeVerifier must be a string')
    .trim(),
  body('redirectUri')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('redirectUri must be a string')
    .trim(),
  body('nonce')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('nonce must be a string')
    .trim(),
  body('fullName')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ max: 200 })
    .withMessage('fullName must be a string of 200 characters or fewer')
    .trim(),
];

/**
 * Validation rules for exchanging a mobile handoff ticket
 */
export const exchangeHandoffRules = [
  body('handoffId')
    .notEmpty()
    .withMessage('Handoff ID is required')
    .isString()
    .withMessage('Handoff ID must be a string')
    .trim(),
  body('deviceInfo')
    .optional()
    .isObject()
    .withMessage('deviceInfo must be an object'),
];
