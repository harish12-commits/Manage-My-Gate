import { body } from 'express-validator';
import { SINGLE_EMAIL_REGEX } from './issueReportConfig.service.js';

export const updateConfigRules = [
  body('email')
    .optional({ checkFalsy: false })
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const str = String(value).trim();
      if (str === '') return true;
      if (str.length > 254 || !SINGLE_EMAIL_REGEX.test(str)) {
        throw new Error('Please provide a valid email address.');
      }
      return true;
    }),
];

export const testEmailRules = [
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .custom((value) => {
      if (value.length > 254 || !SINGLE_EMAIL_REGEX.test(value)) {
        throw new Error('Please provide a valid email address.');
      }
      return true;
    }),
];

export default {
  updateConfigRules,
  testEmailRules,
};
