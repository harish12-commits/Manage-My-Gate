import HttpError from '../utils/httpError.utils.js';
import config from '../config/config.js';
import logger from '../utils/logger.utils.js';
import fs from 'fs';
/**
 * Middleware to handle routes that are not found (404).
 */
export const pageNotFound = (req, res, next) => {
  const error = new HttpError(404, `Not Found - ${req.originalUrl}`);
  next(error);
};

/**
 * Global error handler middleware.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  const details = err.details || null;

  // Handle Multer errors
  if (err.name === 'MulterError' || (typeof err.code === 'string' && err.code.startsWith('LIMIT_'))) {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large. Maximum size is 10MB.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files. Maximum is 5 images.';
    } else {
      message = err.message;
    }
  }

  // Handle CORS errors specifically
  else if (err.message === 'Not allowed by CORS') {
    statusCode = 403;
    message = 'Not allowed by CORS';
    
    // Set CORS headers so browser lets the client read the 403 response
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle MongoDB Duplicate Key Errors
  else if (err.name === 'MongoServerError' && err.code === 11000) {
    statusCode = 409; // Conflict
    if (err.keyValue) {
      const keys = Object.keys(err.keyValue);
      if (keys.length === 1) {
        const field = keys[0];
        const value = err.keyValue[field];
        const formattedField = field.charAt(0).toUpperCase() + field.slice(1);
        if (value !== null && value !== undefined && value !== 'null' && value !== '') {
          message = `${formattedField} '${value}' is already registered or in use.`;
        } else {
          message = `A record with a duplicate or unassigned ${formattedField.toLowerCase()} already exists.`;
        }
      } else {
        const fieldDetails = keys
          .filter(k => k !== 'orgId')
          .map(k => `${k}: '${err.keyValue[k]}'`)
          .join(', ');
        message = fieldDetails 
          ? `A record with these details already exists (${fieldDetails}).`
          : 'A duplicate record already exists.';
      }
    } else {
      message = 'A duplicate record already exists.';
    }
  }

  // Handle Mongoose Validation Errors
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message || 'Validation failed. Please correct the invalid fields.';
  }

  // Handle Mongoose Cast Errors (invalid ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ID format provided for ${err.path || 'resource'}.`;
  }

  // Log error using Winston logger: 5xx server errors get error level with stack; 4xx client errors get warn level
  if (statusCode >= 500) {
    logger.error(`HTTP ${statusCode} - ${message}`, {
      statusCode,
      stack: err.stack,
      requestId: req.id
    });
  } else {
    logger.warn(`HTTP ${statusCode} - ${message}`, {
      statusCode,
      requestId: req.id
    });
  }

  // Local debugging aid only; never persist request bodies (credentials, OTPs) outside development.
  if (config.nodeEnv === 'development') {
    try {
      const { password, newPassword, currentPassword, confirmPassword, otp, code, token, ...safeBody } = req.body || {};
      fs.writeFileSync('last_error.json', JSON.stringify({ statusCode, message, stack: err.stack, details, body: safeBody }), 'utf-8');
    } catch (e) {
      // ignore
    }
  }

  // Do not leak internals of unexpected server errors to clients in production
  if (statusCode >= 500 && config.nodeEnv === 'production' && !err.statusCode) {
    message = 'Internal Server Error';
  }

  const code = err.code || (details && details.code) || undefined;
  const reason = err.reason || (details && details.reason) || undefined;

  const response = {
    success: false,
    ...(code && typeof code === 'string' && { code }),
    ...(reason && typeof reason === 'string' && { reason }),
    message,
    ...(details && { details }),
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};
