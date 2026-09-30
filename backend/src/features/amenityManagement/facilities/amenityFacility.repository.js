import mongoose from 'mongoose';
import AmenityFacility from './amenityFacility.model.js';
import { escapeRegex } from '../../../utils/regex.utils.js';
import { getValidSession } from '../domain/concurrency/transaction.utils.js';

export class AmenityFacilityRepository {
  /**
   * Creates a new facility document.
   * @param {Object} facilityData
   * @param {mongoose.ClientSession} [session]
   */
  async create(facilityData, session) {
    const validSession = getValidSession(session);
    const options = validSession ? { session: validSession } : {};
    const [doc] = await AmenityFacility.create([facilityData], options);
    return doc;
  }

  /**
   * Finds a facility by ID within an organization.
   * @param {string|mongoose.Types.ObjectId} facilityId
   * @param {string|mongoose.Types.ObjectId} [orgId]
   * @param {mongoose.ClientSession} [session]
   */
  async findById(facilityId, orgId, session) {
    let actualOrgId = orgId;
    let actualSession = session;
    if (orgId && typeof orgId === 'object' && typeof orgId.inTransaction === 'function') {
      actualSession = orgId;
      actualOrgId = undefined;
    }
    const filter = { _id: facilityId, isDeleted: false };
    if (actualOrgId) filter.orgId = actualOrgId;
    const validSession = getValidSession(actualSession);
    const query = AmenityFacility.findOne(filter);
    return validSession ? query.session(validSession) : query;
  }

  /**
   * Finds a facility by code within an organization.
   * @param {string|mongoose.Types.ObjectId} orgId
   * @param {string} code
   * @param {mongoose.ClientSession} [session]
   */
  async findByCode(orgId, code, session) {
    const validSession = getValidSession(session);
    const query = AmenityFacility.findOne({
      orgId,
      code: code.trim().toUpperCase(),
      isDeleted: false,
    });
    return validSession ? query.session(validSession) : query;
  }

  /**
   * Atomically increments concurrencyVersion for facility-level mutex locking.
   * @param {string|mongoose.Types.ObjectId} facilityId
   * @param {string|mongoose.Types.ObjectId} orgId
   * @param {mongoose.ClientSession} [session]
   */
  async incrementConcurrencyVersion(facilityId, orgId, session) {
    const validSession = getValidSession(session);
    const options = validSession ? { session: validSession, returnDocument: 'after' } : { returnDocument: 'after' };
    const query = AmenityFacility.findOneAndUpdate(
      { _id: facilityId, orgId, isDeleted: false, isActive: true },
      { $inc: { concurrencyVersion: 1 } },
      options
    );
    return validSession ? query.session(validSession) : query;
  }

  /**
   * Updates facility document fields.
   * @param {string|mongoose.Types.ObjectId} facilityId
   * @param {string|mongoose.Types.ObjectId} orgId
   * @param {Object} updateData
   * @param {mongoose.ClientSession} [session]
   */
  async update(facilityId, orgId, updateData, session) {
    const validSession = getValidSession(session);
    const options = validSession ? { session: validSession, returnDocument: 'after', runValidators: true } : { returnDocument: 'after', runValidators: true };
    const query = AmenityFacility.findOneAndUpdate(
      { _id: facilityId, orgId, isDeleted: false },
      { $set: updateData },
      options
    );
    return validSession ? query.session(validSession) : query;
  }

  /**
   * Soft deletes a facility.
   * @param {string|mongoose.Types.ObjectId} facilityId
   * @param {string|mongoose.Types.ObjectId} orgId
   * @param {mongoose.ClientSession} [session]
   */
  async softDelete(facilityId, orgId, session) {
    const validSession = getValidSession(session);
    const options = validSession ? { session: validSession, returnDocument: 'after' } : { returnDocument: 'after' };
    const query = AmenityFacility.findOneAndUpdate(
      { _id: facilityId, orgId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), isActive: false } },
      options
    );
    return validSession ? query.session(validSession) : query;
  }

  /**
   * Paginated list query with total count via single-roundtrip $facet aggregation pipeline.
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {string} [params.archetype]
   * @param {boolean} [params.isActive]
   * @param {string} [params.search]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   */
  async findWithPagination({ orgId, archetype, isActive, status, isDraft, search, page = 1, limit = 10 }) {
    const targetOrgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;
    const match = {
      $or: [
        { orgId: targetOrgId },
        { orgId: String(orgId) }
      ],
      isDeleted: false,
    };

    if (archetype) match.archetype = archetype;
    if (typeof isActive === 'boolean') match.isActive = isActive;
    if (isDraft === true) {
      match.isDraft = true;
    } else if (isDraft === false) {
      match.isDraft = { $ne: true };
      match.status = { $ne: 'DRAFT' };
    }
    if (status && status.toUpperCase() !== 'ALL') match.status = status.toUpperCase();
    if (search && search.trim()) {
      match.$or = [
        { name: { $regex: escapeRegex(search.trim()), $options: 'i' } },
        { code: { $regex: escapeRegex(search.trim()), $options: 'i' } },
        { description: { $regex: escapeRegex(search.trim()), $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [result] = await AmenityFacility.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]);

    const data = result?.data || [];
    const total = result?.totalCount?.[0]?.count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      items: data,
      total,
      page,
      limit,
      totalPages,
    };
  }
}

export const amenityFacilityRepository = new AmenityFacilityRepository();
export default amenityFacilityRepository;
