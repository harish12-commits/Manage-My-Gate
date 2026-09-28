import blacklistRepository from './blacklist.repository.js';
import blacklistEvents from './blacklist.events.js';
import HttpError from '../../utils/httpError.utils.js';

export class BlacklistService {
  /**
   * Block a profile by saving it to the blacklist.
   * @param {Object} data - Profile input fields.
   * @param {import('mongoose').ClientSession} [session] - Optional session.
   * @returns {Promise<Object>} Created rule log document.
   */
  async createBlacklistEntry(data, session = null) {
    // Check if matching block record already exists
    const existing = await blacklistRepository.findMatch(data.orgId, {
      name: data.name,
      phone: data.phone,
      plate: data.plate
    });

    if (existing) {
      throw new HttpError(400, 'A matching blacklisted name, phone number, or vehicle plate already exists.');
    }

    const record = await blacklistRepository.create(data, session);
    blacklistEvents.emit('profile_blocked', record);
    return record;
  }

  /**
   * Remove a profile block from the database.
   * @param {string} id - The blacklist record ID.
   * @param {import('mongoose').ClientSession} [session] - Optional session.
   * @returns {Promise<Object>} Banned profile metadata.
   */
  async removeBlacklistEntry(id, orgId, session = null) {
    const deleted = await blacklistRepository.deleteById(id, orgId, session);
    if (!deleted) {
      throw new HttpError(404, `Blacklist rule with ID ${id} was not found.`);
    }

    blacklistEvents.emit('profile_unblocked', deleted);
    return deleted;
  }

  /**
   * Check if a visitor query matches any active block rule.
   * @param {string} orgId - Organization ID.
   * @param {Object} query - visitor details (name, phone, plate).
   * @returns {Promise<Object|null>} Matching blacklist entry or null.
   */
  async checkMatch(orgId, query) {
    return await blacklistRepository.findMatch(orgId, query);
  }

  /**
   * Retrieve paginated block records.
   * @param {string} orgId - Organization ID.
   * @param {number} skip - Offset.
   * @param {number} limit - Size.
   * @returns {Promise<{ data: Object[], totalRecords: number }>}
   */
  async getBlacklistByOrg(orgId, skip = 0, limit = 10) {
    return await blacklistRepository.findByOrgPaginated(orgId, skip, limit);
  }
}

export default new BlacklistService();
