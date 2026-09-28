import visitorPassRepository from './visitorPass.repository.js';
import visitorPassEvents from './visitorPass.events.js';
import HttpError from '../../utils/httpError.utils.js';
import blacklistService from '../blacklist/blacklist.service.js';
import visitorPassTokenService from '../visitorPassToken/visitorPassToken.service.js';
import { getPassEntryFailure } from './visitorPass.time.js';

export class VisitorPassService {
  /**
   * Create a new VisitorPass.
   * @param {Object} passData - The visitor pass details.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object>} The created pass document.
   */
  async createPass(passData, session) {
    if (passData && passData.validity) {
      if (passData.validity.startDate) {
        const start = new Date(passData.validity.startDate);
        start.setHours(0, 0, 0, 0);
        passData.validity.startDate = start;
      }
      if (passData.validity.endDate) {
        const end = new Date(passData.validity.endDate);
        // Preserve intraday expiration times if explicit time was passed (e.g. 30-min or 1-hr passes)
        if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
          end.setHours(23, 59, 59, 999);
        }
        passData.validity.endDate = end;
      }
    }
    const pass = await visitorPassRepository.create(passData, session);
    const shortKey = await visitorPassTokenService.generateToken(pass.orgId, pass._id, pass.validity.endDate, session);
    
    const passObj = pass.toObject ? pass.toObject() : pass;
    passObj.shortKey = shortKey;

    visitorPassEvents.emit('pass_created', passObj);
    return passObj;
  }

  /**
   * Revoke an active or pending VisitorPass.
   * @param {string} passId - The ID of the pass to revoke.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object>} The revoked pass document.
   */
  async revokePass(passId, session, metadata = {}) {
    const pass = await visitorPassRepository.findById(passId, session);
    if (!pass) {
      throw new HttpError(404, `Visitor pass with ID ${passId} not found.`);
    }

    if (pass.status === 'REVOKED' || pass.status === 'EXPIRED') {
      throw new HttpError(400, `Visitor pass is already ${pass.status.toLowerCase()}.`);
    }

    const updatedPass = await this.updatePassStatus(passId, 'REVOKED', session, metadata);
    await visitorPassTokenService.deleteTokenByPassId(passId, session);

    visitorPassEvents.emit('pass_revoked', updatedPass);
    return updatedPass;
  }

  /**
   * Verify if a pass is valid for entry.
   * @param {string} passId - The ID of the pass to verify.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object>} The verified pass document if valid.
   */
  async verifyPassForEntry(passId, session) {
    const pass = await visitorPassRepository.findById(passId, session);
    if (!pass) {
      throw new HttpError(404, `Visitor pass with ID ${passId} not found.`);
    }

    const now = new Date();
    const failure = getPassEntryFailure(pass, now);
    if (failure) throw new HttpError(400, failure);

    // 6. Check Blacklist Banned Profile
    const isBanned = await blacklistService.checkMatch(pass.orgId, {
      name: pass.visitorDetails?.name,
      phone: pass.visitorDetails?.phone,
      plate: pass.vehicleDetails?.number
    });
    if (isBanned) {
      throw new HttpError(403, `Visitor is blacklisted: ${isBanned.reason}`);
    }

    return pass;
  }

  /**
   * Record pass usage (increments uses, transitions status from PENDING to ACTIVE, and to EXPIRED if limit reached).
   * @param {string|Object} pass - Pass ID or pass document.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object>} The updated pass document.
   */
  async usePass(pass, session = null) {
    const passDoc = typeof pass === 'string'
      ? await this.verifyPassForEntry(pass, session)
      : pass;

    const updated = await visitorPassRepository.consumeForEntry(passDoc._id, session);
    if (!updated) {
      throw new HttpError(409, 'Visitor pass was already used, revoked, or changed by another gate action.');
    }

    visitorPassEvents.emit('pass_updated', updated);
    return updated;
  }

  /**
   * Get a pass by its ID (read-only, does not perform gate validations).
   * @param {string} id - The pass ID.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object>} The pass document.
   */
  async getPassById(id, session = null) {
    const pass = await visitorPassRepository.findByIdWithParties(id, session);
    if (!pass) {
      throw new HttpError(404, `Visitor pass with ID ${id} not found.`);
    }
    const passObj = pass.toObject ? pass.toObject() : pass;
    passObj.shortKey = await visitorPassTokenService.getShortKeyByPassId(pass._id, session);
    return passObj;
  }

  /**
   * Get paginated active/pending passes in an organization with multi-filter support.
   * @param {string} orgId - The organization ID.
   * @param {Object|number} optionsOrSkip - Query options or skip.
   * @param {number} [limit=10] - Limit.
   * @param {string[]} [statuses] - Statuses to query.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<{ data: Object[], totalRecords: number }>}
   */
  async getActivePasses(orgId, optionsOrSkip = {}, limit = 10, statuses = ['PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED'], session = null) {
    const opts =
      typeof optionsOrSkip === 'object' && !Array.isArray(optionsOrSkip)
        ? optionsOrSkip
        : { skip: optionsOrSkip, limit, statuses };

    // Passes never used before their validity ended would otherwise stay PENDING ("upcoming") forever.
    await visitorPassRepository.expireEndedPasses(orgId, new Date(), session);
    const result = await visitorPassRepository.findActivePassesByOrg(orgId, opts, session);
    if (result && result.data) {
      const mapped = [];
      for (const pass of result.data) {
        const passObj = pass.toObject ? pass.toObject() : pass;
        passObj.shortKey = await visitorPassTokenService.getShortKeyByPassId(passObj._id, session);
        mapped.push(passObj);
      }
      result.data = mapped;
    }
    return result;
  }

  /**
   * Update a pass status.
   * @param {string} id - The pass ID.
   * @param {string} status - The new status.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>}
   */
  async updatePassStatus(id, status, session = null, metadata = {}) {
    const existing = await visitorPassRepository.findById(id, session);
    if (!existing) {
      throw new HttpError(404, `Visitor pass with ID ${id} not found.`);
    }
    const historyItem = {
      fromStatus: existing.status,
      toStatus: status,
      ...(metadata.actorId ? { actorId: metadata.actorId } : {}),
      ...(metadata.reason ? { reason: metadata.reason } : {}),
      occurredAt: new Date(),
    };
    const updated = await visitorPassRepository.update(id, {
      $set: { status },
      $push: { statusHistory: historyItem },
    }, session);
    if (!updated) {
      throw new HttpError(404, `Visitor pass with ID ${id} not found.`);
    }
    visitorPassEvents.emit('pass_updated', updated);
    return updated;
  }
}

export default new VisitorPassService();
