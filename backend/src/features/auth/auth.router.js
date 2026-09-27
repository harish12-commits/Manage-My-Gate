import { Router } from 'express';
import authController from './auth.controller.js';
import { validate } from '../../middlewares/validator.middleware.js';
import { 
  loginRules, 
  registerRules, 
  acceptInviteRules, 
  switchContextRules, 
  ssoVerifyRules,
  phoneLoginRules,
  phoneVerifyRules,
  emailOtpLoginRules,
  emailOtpVerifyRules,
  forgotPasswordRules,
  verifyResetPasswordOtpRules,
  resetPasswordRules,
  setupAccountPasswordRules,
  acceptInviteSsoRules,
  registerSsoWithOrgRules,
  exchangeHandoffRules,
} from './auth.validateRules.js';
import { isAuthenticated, optionalAuth } from '../../middlewares/auth.middleware.js';
import { authLimiter, otpLimiter } from '../../middlewares/rateLimiter.middleware.js';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - password
 *               - roleId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               username:
 *                 type: string
 *                 example: john_doe
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecureP@ss123"
 *               roleId:
 *                 type: string
 *                 description: Valid Mongo ID of the role
 *                 example: 60d21b4667d0d8992e610c85
 *     responses:
 *       201:
 *         description: Registered successfully.
 *       400:
 *         description: Validation error.
 */
router.post('/register', authLimiter, validate(registerRules), authController.register);

/**
 * @swagger
 * /auth/register/verify:
 *   post:
 *     summary: Verify registration OTP
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verified successfully.
 */
router.post('/register/verify', otpLimiter, validate(emailOtpVerifyRules), authController.verifyRegistrationOtp);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - login
 *               - password
 *             properties:
 *               login:
 *                 type: string
 *                 description: Username or Email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecureP@ss123"
 *     responses:
 *       200:
 *         description: Login successful.
 *       400:
 *         description: Invalid credentials or validation error.
 */
router.post('/login', authLimiter, validate(loginRules), authController.login);

/**
 * @swagger
 * /auth/accept-invite:
 *   post:
 *     summary: Accept user invitation and set password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 description: Invitation token received via email
 *                 example: "a8f3b20e7d56c802b1f8632e..."
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecureP@ss123"
 *     responses:
 *       200:
 *         description: Invitation accepted.
 *       400:
 *         description: Invalid token or validation error.
 */
router.post('/accept-invite', optionalAuth, validate(acceptInviteRules), authController.acceptInvite);
router.post('/reject-invite', authController.rejectInvite);

/**
 * @swagger
 * /auth/accept-invite/sso:
 *   post:
 *     summary: Accept user invitation via SSO provider
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inviteToken
 *               - ssoCredential
 *               - provider
 *             properties:
 *               inviteToken:
 *                 type: string
 *                 description: Decodable JWT invitation token containing user context
 *               ssoCredential:
 *                 type: string
 *                 description: Identity token from SSO provider
 *               provider:
 *                 type: string
 *                 enum: [google, microsoft, apple]
 *     responses:
 *       200:
 *         description: Invitation accepted and user activated via SSO.
 *       400:
 *         description: Validation error.
 */
router.post('/accept-invite/sso', validate(acceptInviteSsoRules), authController.acceptInviteWithSSO);

router.post('/register-with-org/sso', authLimiter, validate(registerSsoWithOrgRules), authController.registerSsoWithOrg);

/**
 * @swagger
 * /auth/invite/handoff:
 *   post:
 *     summary: Create single-use short-lived mobile handoff ticket for authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Handoff ticket created.
 *       401:
 *         description: Unauthorized.
 */
router.post('/invite/handoff', isAuthenticated, authController.createInviteHandoff);

/**
 * @swagger
 * /auth/invite/handoff/exchange:
 *   post:
 *     summary: Atomically exchange mobile handoff ticket for authenticated mobile session
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - handoffId
 *             properties:
 *               handoffId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Handoff ticket exchanged successfully.
 *       400:
 *         description: Invalid or expired handoff ticket.
 */
router.post('/invite/handoff/exchange', authLimiter, validate(exchangeHandoffRules), authController.exchangeInviteHandoff);

/**
 * @swagger
 * /auth/roles:
 *   get:
 *     summary: Get all roles available for registration dropdown
 *     security: []
 *     responses:
 *       200:
 *         description: List of roles available.
 */
router.get('/roles', authController.getRoles);

/**
 * @swagger
 * /auth/validate-invite:
 *   get:
 *     summary: Validate an invitation token and check if the associated user exists
 *     security: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token is valid.
 *       400:
 *         description: Invalid token.
 */
// Public endpoint, but attach a valid session when present so invitation state is identity-aware.
router.get('/validate-invite', optionalAuth, authController.validateInvite);

/**
 * @swagger
 * /auth/switch-context:
 *   post:
 *     summary: Switch active workspace context
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetOrgId
 *             properties:
 *               targetOrgId:
 *                 type: string
 *                 description: Valid Mongo ID of the target organization
 *                 example: 60d21b4667d0d8992e610c85
 *     responses:
 *       200:
 *         description: Context switched successfully.
 *       400:
 *         description: Validation error.
 *       403:
 *         description: Access denied.
 */
router.post('/switch-context', isAuthenticated, validate(switchContextRules), authController.switchContext);
router.get('/current-context', isAuthenticated, authController.getCurrentContext);
router.get('/context', isAuthenticated, authController.getCurrentContext);

router.post('/google', authLimiter, validate(ssoVerifyRules), authController.googleLogin);
router.post('/microsoft', authLimiter, validate(ssoVerifyRules), authController.microsoftLogin);
router.post('/apple', authLimiter, validate(ssoVerifyRules), authController.appleLogin);

// OTP & Verification Routes with validation schemas
router.post('/login/phone', otpLimiter, validate(phoneLoginRules), authController.initiatePhoneLogin);
router.post('/login/phone/verify', authLimiter, validate(phoneVerifyRules), authController.verifyPhoneLogin);
router.post('/login/email-otp', otpLimiter, validate(emailOtpLoginRules), authController.initiateEmailOtpLogin);
router.post('/login/email-otp/verify', authLimiter, validate(emailOtpVerifyRules), authController.verifyEmailOtpLogin);
router.post('/forgot-password', otpLimiter, validate(forgotPasswordRules), authController.forgotPassword);
router.post('/forgot-password/initiate', otpLimiter, validate(forgotPasswordRules), authController.forgotPassword);
router.post('/forgot-password/verify-otp', authLimiter, validate(verifyResetPasswordOtpRules), authController.verifyResetPasswordOtp);
router.post('/reset-password', authLimiter, validate(resetPasswordRules), authController.resetPassword);
router.post('/setup-account-password', validate(setupAccountPasswordRules), authController.setupAccountPassword);
router.get('/check-account-status', authController.checkAccountStatus);

// Session Routes
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', isAuthenticated, authController.logout);

export default router;
