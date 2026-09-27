import VisitorPassToken from './visitorPassToken.model.js';

export class VisitorPassTokenRepository {
  /**
   * Create a new VisitorPassToken.
   * @param {Object} data - The data to create the token mapping.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object>} The created token mapping document.
   */
  async create(data, session = null) {
    const token = new VisitorPassToken(data);
    return await token.save(session ? { session } : undefined);
  }

  /**
   * Find a VisitorPassToken by its passCode (prefixed key).
   * @param {string} passCode - The prefixed code string.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>} The token mapping document, or null if not found.
   */
  async findByCode(passCode, session = null, orgId = null) {
    if (!passCode) return null;
    const raw = String(passCode).trim();
    const clean = raw.replace(/^PASS-?/i, '').replace(/[\s-]/g, '').trim();
    return await VisitorPassToken.findOne({
      // Short keys are only unique per community, so signed-in lookups pass their community.
      ...(orgId ? { orgId } : {}),
      $or: [
        { passCode: raw },
        { passCode: clean },
        { shortKey: raw },
        { shortKey: clean },
        { passCode: { $regex: new RegExp(`_${clean}$`, 'i') } },
      ],
    }).session(session || null);
  }

  /**
   * Find an active token by its bare short key in any community.
   * @param {string} shortKey - The 6-digit key.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>} The token mapping document, or null if not found.
   */
  async findByShortKey(shortKey, session = null) {
    return await VisitorPassToken.findOne({ shortKey }).session(session || null);
  }

  /**
   * Find a VisitorPassToken by its passId.
   * @param {string} passId - The visitor pass ID.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>} The token mapping document, or null if not found.
   */
  async findByPassId(passId, session = null) {
    return await VisitorPassToken.findOne({ passId }).session(session || null);
  }

  /**
   * Delete a VisitorPassToken mapping by its passId.
   * @param {string} passId - The visitor pass ID.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>} The deleted result.
   */
  async deleteByPassId(passId, session = null) {
    return await VisitorPassToken.deleteOne({ passId }, session ? { session } : undefined);
  }
}

export default new VisitorPassTokenRepository();
