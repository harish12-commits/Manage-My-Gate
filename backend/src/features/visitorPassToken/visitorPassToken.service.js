import crypto from 'crypto';
import visitorPassTokenRepository from './visitorPassToken.repository.js';
import HttpError from '../../utils/httpError.utils.js';

export class VisitorPassTokenService {
  /**
   * Generates a unique 6-digit numeric key per organization and registers it.
   * @param {string} orgId - The organization ID.
   * @param {string} passId - The visitor pass ID.
   * @param {Date} expiresAt - The expiration date for TTL cleanup.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<string>} The generated 6-digit short key.
   */
  async generateToken(orgId, passId, expiresAt, session = null) {
    let key = '';
    let passCode = '';
    let exists = true;
    let attempts = 0;

    // Retry up to 10 times to prevent duplicate keys in the active pool
    while (exists && attempts < 10) {
      key = crypto.randomInt(100000, 1000000).toString();
      passCode = `${orgId}_${key}`;
      // Keep active short keys unique across communities so a bare key (public share links) is unambiguous.
      const existing = await visitorPassTokenRepository.findByShortKey(key, session);
      if (!existing) {
        exists = false;
      }
      attempts++;
    }

    if (exists) {
      throw new HttpError(500, 'Unable to generate a unique entry key. Please try again.');
    }

    await visitorPassTokenRepository.create(
      {
        orgId,
        passId,
        passCode,
        shortKey: key,
        expiresAt,
      },
      session
    );

    return key;
  }

  /**
   * Resolves the pass ID from a full passCode (prefixed short key).
   * @param {string} passCode - The prefixed code string.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<string>} The associated visitor pass ID.
   */
  async getPassIdByCode(passCode, session = null, orgId = null) {
    const tokenDoc = await visitorPassTokenRepository.findByCode(passCode, session, orgId);
    if (!tokenDoc) {
      throw new HttpError(404, 'Invalid or expired entry code.');
    }
    return tokenDoc.passId;
  }

  /**
   * Resolves the shortKey from a passId.
   * @param {string} passId - The visitor pass ID.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<string|null>} The short key, or null if not found.
   */
  async getShortKeyByPassId(passId, session = null) {
    const tokenDoc = await visitorPassTokenRepository.findByPassId(passId, session);
    return tokenDoc ? tokenDoc.shortKey : null;
  }

  /**
   * Deletes the token mapping associated with a passId.
   * @param {string} passId - The visitor pass ID.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   */
  async deleteTokenByPassId(passId, session = null) {
    await visitorPassTokenRepository.deleteByPassId(passId, session);
  }
}

export default new VisitorPassTokenService();
