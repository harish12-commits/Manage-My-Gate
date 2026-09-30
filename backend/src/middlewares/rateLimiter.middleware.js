import rateLimit from 'express-rate-limit';

/**
 * Standard rate limiter for generic API routes.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1500, // Generous per-IP ceiling: authenticated SPA/mobile clients fan out many calls; abuse-prone routes have stricter limiters
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

/**
 * Stricter rate limiter for authentication routes (login, register, forgot-password).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Limit each IP to 60 attempts per 15-minute window
  skipSuccessfulRequests: true, // Do not penalize successful authentications
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  },
});

/**
 * Very strict rate limiter for OTP requests (SMS/Email).
 */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests from this IP, please try again after 15 minutes',
  },
});

/**
 * Rate limiter for public organization name availability checks.
 * Allows up to 300 requests per 15-minute window per IP.
 * This is enough headroom for real typing sessions with 800ms debouncing
 * while still protecting against enumeration scraping.
 */
export const nameCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many organization name checks from this IP, please try again after 15 minutes',
  },
});

/**
 * Per-user limiter for issue report submissions (each one fans out notifications and an email).
 * Must be mounted after authentication so req.user is populated.
 */
export const reportSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `report:${String(req.user?.id || req.user?._id)}`,
  message: {
    success: false,
    message: 'Too many issue reports submitted. Please try again after 15 minutes.',
  },
});

/**
 * Per-user limiter for admin test emails, preventing SMTP abuse.
 * Must be mounted after authentication so req.user is populated.
 */
export const testEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `test-email:${String(req.user?.id || req.user?._id)}`,
  message: {
    success: false,
    message: 'Too many test emails requested. Please try again after 15 minutes.',
  },
});
