import mongoose from 'mongoose';
import { phoneVariants } from '../../utils/phone.utils.js';
import Blacklist from './blacklist.model.js';

export class BlacklistRepository {
  /**
   * Add a profile to the blacklist database using an optional session.
   * @param {Object} data - Banned profile details.
   * @param {import('mongoose').ClientSession} [session] - Mongoose session.
   * @returns {Promise<Object>} The created blacklist entry.
   */
  async create(data, session = null) {
    const entry = new Blacklist(data);
    return await entry.save({ ...(session ? { session } : {}) });
  }

  /**
   * Remove a profile from the blacklist database by its ID.
   * @param {string} id - The blacklist entry ID.
   * @param {import('mongoose').ClientSession} [session] - Mongoose session.
   * @returns {Promise<Object|null>} The deleted document.
   */
  async deleteById(id, orgId, session = null) {
    // Scoped to the caller's community so one tenant can never remove another's entries.
    return await Blacklist.findOneAndDelete({ _id: id, orgId }, { ...(session ? { session } : {}) });
  }

  /**
   * Find blacklist entry by name or phone/plate.
   * @param {string} orgId - Organization context.
   * @param {Object} criteria - Search parameters.
   * @returns {Promise<Object|null>} Match document.
   */
  async findMatch(orgId, { name, phone, plate }) {
    const query = { orgId: new mongoose.Types.ObjectId(orgId) };
    const matches = [];

    // The name is visitor-supplied text, not a pattern: escape it (e.g. "Ravi (Jr" must not throw).
    const escapedName = name ? name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    if (name && name.trim() && name.trim() !== '—') matches.push({ name: new RegExp(`^${escapedName}$`, 'i') });
    if (phone && phone.trim() && phone.trim() !== '—') matches.push({ phone: { $in: phoneVariants(phone) } });
    if (plate && plate.trim() && plate.trim() !== '—') matches.push({ plate: plate.trim().toUpperCase() });

    if (matches.length === 0) return null;
    query.$or = matches;

    return await Blacklist.findOne(query);
  }

  /**
   * Fetch paginated list of banned profiles in an organization.
   * @param {string} orgId - The organization ID.
   * @param {number} [skip=0] - Number of items to skip.
   * @param {number} [limit=10] - Limit of items to return.
   * @param {import('mongoose').ClientSession} [session] - Optional session.
   * @returns {Promise<{ data: Object[], totalRecords: number }>}
   */
  async findByOrgPaginated(orgId, skip = 0, limit = 10, session = null) {
    const matchStage = {
      orgId: new mongoose.Types.ObjectId(orgId)
    };

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalRecords' }],
          data: [
            { $skip: skip },
            { $limit: limit }
          ]
        }
      }
    ];

    const result = await Blacklist.aggregate(pipeline).session(session || null);
    const data = result[0]?.data || [];
    const totalRecords = result[0]?.metadata[0]?.totalRecords || 0;
    return { data, totalRecords };
  }
}

export default new BlacklistRepository();
