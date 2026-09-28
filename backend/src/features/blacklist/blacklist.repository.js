import mongoose from 'mongoose';
import Blacklist from './blacklist.model.js';

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const normalizeIdProof = (value) => String(value || '').replace(/[\s-]/g, '').toUpperCase();
const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
   * Find blacklist entry by any identifying value supplied for a visitor.
   * @param {string} orgId - Organization context.
   * @param {Object} criteria - Search parameters.
   * @returns {Promise<Object|null>} Match document.
   */
  async findMatch(orgId, { name, phone, idProofNumber, plate }) {
    const query = { orgId: new mongoose.Types.ObjectId(orgId) };
    const matches = [];

    const normalizedName = normalizeName(name);
    const normalizedPhone = normalizePhone(phone);
    const normalizedIdProof = normalizeIdProof(idProofNumber);

    if (normalizedName && normalizedName !== '—') matches.push({ name: new RegExp(`^${escapeRegex(normalizedName)}$`, 'i') });
    if (normalizedPhone && normalizedPhone !== '—') matches.push({ phone: normalizedPhone });
    if (normalizedIdProof && normalizedIdProof !== '—') matches.push({ idProofNumber: normalizedIdProof });
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
