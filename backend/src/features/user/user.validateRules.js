import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';
import { normalizePhone } from '../../utils/phone.utils.js';

/**
 * Validation rules for inviting a new user.
 */
export const inviteUserRules = [
  body('email')
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .trim(),
  body('villaId')
    .optional({ nullable: true, checkFalsy: true })
    .custom((val) => {
      if (val === '' || val === null) return true;
      return mongoose.Types.ObjectId.isValid(val);
    })
    .withMessage('Villa ID must be a valid Mongo ID'),
  body('residentType')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('Resident type must be a string')
    .trim(),
  body('roleName')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('Role name must be a string')
    .trim(),
  body('name')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('Name must be a string')
    .trim(),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('Phone must be a string')
    .trim(),
];

/**
 * Validation rules for updating user roles.
 */
export const updateUserRolesRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid User ID format'),
  body('roles')
    .exists()
    .withMessage('roles field is required')
    .custom((value) => {
      if (Array.isArray(value) || typeof value === 'string') {
        return true;
      }
      throw new Error('roles must be an array or string');
    }),
  body('villaId')
    .optional({ nullable: true })
    .isMongoId()
    .withMessage('Invalid Villa ID format'),
];

/**
 * Validation rules for requesting an email OTP during profile update.
 */
export const requestEmailOtpRules = [
  body('newEmail')
    .notEmpty()
    .withMessage('New email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .trim(),
];

/**
 * Validation rules for requesting a phone OTP during profile update.
 */
export const requestPhoneOtpRules = [
  body('newPhone')
    .notEmpty()
    .withMessage('New phone number is required')
    .isString()
      .withMessage('Please provide a valid phone number')
      .trim()
      .custom((value) => Boolean(normalizePhone(value)))
      .withMessage('Please provide a valid phone number with country code'),
];

/**
 * Validation rules for updating user profile.
 */
export const updateProfileRules = [
  body('name')
    .optional()
    .trim()
    .escape(),
    body('phone')
      .optional()
      .trim()
      .custom((value) => value === '' || Boolean(normalizePhone(value)))
      .withMessage('Please provide a valid phone number with country code'),
  body('phoneOtp')
    .optional()
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Phone OTP must be 6 digits'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('emailOtp')
    .optional()
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits'),
  body('removeAvatar')
    .optional(),
  body('bio')
    .optional()
    .isString()
    .withMessage('Bio must be text')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  body('work')
    .optional()
    .isString()
    .withMessage('Work must be text')
    .trim()
    .isLength({ max: 120 })
    .withMessage('Work cannot exceed 120 characters'),
  body('hometown')
    .optional()
    .isString()
    .withMessage('Hometown must be text')
    .trim()
    .isLength({ max: 120 })
    .withMessage('Hometown cannot exceed 120 characters'),
  body('allowIntercomCalls')
    .optional()
    .isBoolean()
    .withMessage('allowIntercomCalls must be a boolean')
    .toBoolean(),
  body('interests')
    .optional()
    .custom((value) => {
      let items = value;
      if (typeof value === 'string') {
        try {
          items = JSON.parse(value);
        } catch {
          return false;
        }
      }
      return Array.isArray(items)
        && items.length <= 20
        && items.every((item) => typeof item === 'string' && item.trim().length > 0 && item.trim().length <= 60);
    })
    .withMessage('Interests must be an array of up to 20 short labels'),
];

export const bulkInviteUserRules = [
  body('invitations')
    .isArray({ min: 1 })
    .withMessage('invitations must be a non-empty array'),
  body('invitations.*.email')
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .trim(),
  body('invitations.*.residentType')
    .optional()
    .isString()
    .withMessage('Resident type must be a string')
    .trim(),
  body('invitations.*.roleName')
    .notEmpty()
    .withMessage('Role name is required')
    .isString()
    .trim(),
  body('invitations.*.villaNumber')
    .optional()
    .custom((val) => {
      if (val === undefined || val === null || val === '') return true;
      return typeof val === 'string';
    })
    .withMessage('Villa Number must be a string')
    .trim(),
];

/**
 * Validation rules for public unauthenticated account deletion requests.
 */
export const requestDeletionRules = [
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Please provide a valid email address')
    .trim(),
  body('mobile')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('Mobile number must be a string')
    .trim()
    .escape(),
  body('reason')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('Reason must be text')
    .trim()
    .escape(),
];

/**
 * Validation rules for revoking an invitation.
 */
export const revokeInvitationRules = [
  param('id')
    .notEmpty()
    .withMessage('Invitation ID is required')
    .isMongoId()
    .withMessage('Invalid Invitation ID format'),
];

/**
 * Validation rules for listing organization invitations.
 */
export const listInvitationsRules = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100')
    .toInt(),
  query('status')
    .optional()
    .isIn(['ALL', 'PENDING', 'ACCEPTED', 'REJECTED', 'REVOKED', 'EXPIRED'])
    .withMessage('Invalid status filter value'),
  query('search')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Search query cannot exceed 100 characters')
    .trim(),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'expiresAt', 'status'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc', '1', '-1'])
    .withMessage('Invalid sort order'),
];

/**
 * Validation rules for resending an invitation.
 */
export const resendInvitationRules = [
  param('id')
    .notEmpty()
    .withMessage('Invitation ID is required')
    .isMongoId()
    .withMessage('Invalid Invitation ID format'),
];
