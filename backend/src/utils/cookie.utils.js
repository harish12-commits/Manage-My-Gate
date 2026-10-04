import config from '../config/config.js';

/**
 * Sets the authentication JWT token cookie on the response.
 * @param {import('express').Response} res - Express response object
 * @param {string} token - JWT token string
 */
export const setAuthCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
};

/**
 * Sets the refresh token cookie on the response.
 * @param {import('express').Response} res - Express response object
 * @param {string} token - Refresh token string
 */
export const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/**
 * Clears the authentication JWT token cookies.
 * @param {import('express').Response} res - Express response object
 */
export const clearAuthCookie = (res) => {
  const options = {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
  };
  res.clearCookie('token', options);
  res.clearCookie('refreshToken', options);
};

export default {
  setAuthCookie,
  setRefreshTokenCookie,
  clearAuthCookie,
};
