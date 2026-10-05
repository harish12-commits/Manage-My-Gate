import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import HttpError from '../utils/httpError.utils.js';
import userService from '../features/user/user.services.js';
import OrgMembership from '../features/orgMembership/orgMembership.model.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cookie-borne sessions are sent automatically by browsers, so state-changing requests that rely on
 * the cookie must come from a trusted origin (CSRF defence). Bearer-header requests are unaffected.
 */
const assertTrustedOriginForCookieAuth = (req) => {
  if (SAFE_METHODS.has(req.method)) return;
  const source = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer, 'http://invalid').origin : null);
  const isLocal = config.nodeEnv !== 'production'
    && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/i.test(source || '');
  if (!source || !(isLocal || config.cors.allowedOrigins.includes(source))) {
    throw new HttpError(403, 'Cross-site request blocked.');
  }
};

const JWT_VERIFY_OPTIONS = { algorithms: ['HS256'] };

/**
 * Client-supplied organisation headers are untrusted. If one names an organisation other than the
 * one in the signed token, the caller must hold an active membership there (platform users exempt).
 */
const assertOrgHeaderAllowed = async (req, decoded) => {
  if (req.originalUrl && (req.originalUrl.includes('/switch-context') || req.originalUrl.includes('/current-context'))) return;
  const headerOrg = req.headers['x-organization-id'] || req.headers['x-org-id'];
  if (!headerOrg || decoded.isPlatform === true) return;
  const requested = String(headerOrg);
  if (decoded.orgId && String(decoded.orgId) === requested) return;
  if (!/^[a-f\d]{24}$/i.test(requested)) {
    throw new HttpError(400, 'Invalid community identifier.');
  }
  const membership = await OrgMembership.findOne({ userId: decoded.id, orgId: requested, status: 'Active' })
    .select('_id')
    .lean();
  if (!membership) {
    throw new HttpError(403, 'Forbidden. You are not a member of the requested community.');
  }
};

/**
 * Authentication middleware to verify JWT token.
 */
export const isAuthenticated = async (req, res, next) => {
  try {
    let token = null;

    // Check authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // Check cookies
    else if (req.cookies && req.cookies.token) {
      assertTrustedOriginForCookieAuth(req);
      token = req.cookies.token;
    }
    // Check query params (for file downloads like export, pdf)
    else if (req.method === 'GET' && typeof req.query?.auth_token === 'string') {
      // Legacy file-download links only; tokens in URLs leak via logs, so never accept them for writes.
      token = req.query.auth_token;
    }

    if (!token) {
      throw new HttpError(401, 'Access denied. No authentication token provided.');
    }

    const decoded = jwt.verify(token, config.jwt.secret, JWT_VERIFY_OPTIONS);
    
    // Verify that the user still exists in the database and is Active
    let user;
    try {
      user = await userService.getUserById(decoded.id);
    } catch (err) {
      throw new HttpError(401, 'User account no longer exists.');
    }

    if (!user || user.status !== 'Active') {
      throw new HttpError(401, 'User account is inactive.');
    }

    await assertOrgHeaderAllowed(req, decoded);

    req.user = decoded; // Contains user ID, email, role, permissions, etc.
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      return next(error);
    }
    const message = error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid authentication token';
    next(new HttpError(401, message));
  }
};

/**
 * Optional authentication middleware that attaches req.user if a valid token is present,
 * but does NOT throw 401 if token is missing or expired (useful for public payment links/checkouts).
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.query && req.query.auth_token) {
      token = req.query.auth_token;
    }

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret, JWT_VERIFY_OPTIONS);
      const user = await userService.getUserById(decoded.id).catch(() => null);
      if (user && user.status === 'Active') {
        req.user = decoded;
      }
    }
  } catch (err) {
    // Ignore invalid/expired token on optional auth routes
  }
  next();
};

export default isAuthenticated;
