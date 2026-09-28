import blacklistRepository from './blacklist.repository.js';
import blacklistEvents from './blacklist.events.js';
import HttpError from '../../utils/httpError.utils.js';

const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const normalizeIdProof = (value) => String(value || '').replace(/[\s-]/g, '').toUpperCase();

export class BlacklistService {
  /**
   * Block a profile by saving it to the blacklist.
   * @param {Object} data - Profile input fields.
   * @param {import('mongoose').ClientSession} [session] - Optional session.
   * @returns {Promise<Object>} Created rule log document.
   */
  async createBlacklistEntry(data, session = null) {
    const normalizedData = {
      ...data,
      name: normalizeName(data.name),
      phone: normalizePhone(data.phone) || undefined,
      idProofNumber: normalizeIdProof(data.idProofNumber) || undefined,
      plate: data.plate ? String(data.plate).trim().toUpperCase() : undefined,
    };

    // Check if matching block record already exists
    const existing = await blacklistRepository.findMatch(normalizedData.orgId, {
      name: normalizedData.name,
      phone: normalizedData.phone,
      idProofNumber: normalizedData.idProofNumber,
      plate: normalizedData.plate
    });

    if (existing) {
      throw new HttpError(400, 'A matching blacklisted name, phone number, government ID, or vehicle plate already exists.');
    }

    const record = await blacklistRepository.create(normalizedData, session);
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
   * @param {Object} query - visitor details (name, phone, government ID, plate).
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
