import VisitorPass from './visitorPass.model.js';
import mongoose from 'mongoose';

export class VisitorPassRepository {
  /**
   * Create a new VisitorPass.
   * @param {Object} passData - The data to create the pass.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object>} The created pass document.
   */
  async create(passData, session) {
    const pass = new VisitorPass(passData);
    return await pass.save(session ? { session } : undefined);
  }

  /**
   * Find a VisitorPass by its ID.
   * @param {string} id - The ID of the pass.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>} The pass document, or null if not found.
   */
  async findById(id, session) {
    return await VisitorPass.findById(id).session(session || null);
  }

  /**
   * Find a VisitorPass with the unit and host resolved, for screens that show who is visiting whom.
   * @param {string} id - The ID of the pass.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>} The pass document, or null if not found.
   */
  async findByIdWithParties(id, session = null) {
    return await VisitorPass.findById(id)
      .populate('villaId', 'unitNumber blockOrBuilding')
      .populate('createdById', 'name')
      .session(session || null);
  }

  /**
   * Update the status of a VisitorPass.
   * @param {string} id - The ID of the pass.
   * @param {string} status - The new status value (PENDING, ACTIVE, REVOKED, EXPIRED).
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>} The updated pass document.
   */
  async updateStatus(id, status, session) {
    return await VisitorPass.findByIdAndUpdate(
      id,
      { status },
      { returnDocument: 'after', runValidators: true, ...(session ? { session } : {}) }
    );
  }

  /**
   * Update VisitorPass properties.
   * @param {string} id - The ID of the pass.
   * @param {Object} updateData - The update parameters.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>} The updated pass document.
   */
  async update(id, updateData, session = null) {
    return await VisitorPass.findByIdAndUpdate(
      id,
      updateData,
      { returnDocument: 'after', runValidators: true, ...(session ? { session } : {}) }
    );
  }

  /** Atomically consumes one pass use, preventing replayed QR scans from admitting twice. */
  async consumeForEntry(id, session = null) {
    return VisitorPass.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ['PENDING', 'ACTIVE'] },
        $expr: {
          $lt: [
            { $ifNull: ['$usageLimit.currentUses', 0] },
            { $ifNull: ['$usageLimit.maxUses', 1] },
          ],
        },
      },
      [
        {
          $set: {
            status: { $cond: [{ $eq: ['$status', 'PENDING'] }, 'ACTIVE', '$status'] },
            'usageLimit.currentUses': { $add: [{ $ifNull: ['$usageLimit.currentUses', 0] }, 1] },
          },
        },
      ],
      // Mongoose 9 rejects pipeline (array) updates unless explicitly opted in.
      { returnDocument: 'after', updatePipeline: true, ...(session ? { session } : {}) }
    );
  }

  /**
   * Paginated aggregation to retrieve passes in an organization with multi-filtering and deep lookups.
   * @param {string} orgId - The organization ID.
   * @param {Object} [options={}] - Query options (skip, limit, statuses, search, villaId, scope).
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<{ data: Object[], totalRecords: number }>} Paginated list of passes and total count.
   */
  async findActivePassesByOrg(orgId, options = {}, session = null) {
    const opts =
      typeof options === 'object' && !Array.isArray(options)
        ? options
        : {
            skip: arguments[1] || 0,
            limit: arguments[2] || 10,
            statuses: arguments[3] || ['PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED'],
          };

    const {
      skip = 0,
      limit = 10,
      statuses = ['PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED'],
      search,
      villaId,
      scope,
      createdById,
    } = opts;

    const matchStage = {
      orgId: new mongoose.Types.ObjectId(orgId),
    };

    if (statuses && statuses.length > 0) {
      matchStage.status = { $in: statuses };
    }

    if (createdById && mongoose.Types.ObjectId.isValid(createdById)) {
      matchStage.createdById = new mongoose.Types.ObjectId(createdById);
    }

    if (scope === 'COMMUNITY') {
      matchStage.$or = [
        { villaId: { $exists: false } },
        { villaId: null },
        { passType: 'ADMIN_GUEST' },
      ];
    } else if (villaId && mongoose.Types.ObjectId.isValid(villaId)) {
      matchStage.villaId = new mongoose.Types.ObjectId(villaId);
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const searchOr = [
        { 'visitorDetails.name': searchRegex },
        { 'visitorDetails.phone': searchRegex },
        { 'vehicleDetails.number': searchRegex },
        { purpose: searchRegex },
      ];
      if (matchStage.$or) {
        matchStage.$and = [{ $or: matchStage.$or }, { $or: searchOr }];
        delete matchStage.$or;
      } else {
        matchStage.$or = searchOr;
      }
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'villas',
          localField: 'villaId',
          foreignField: '_id',
          as: 'villaId',
        },
      },
      {
        $unwind: {
          path: '$villaId',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdById',
          foreignField: '_id',
          pipeline: [
            {
              $project: {
                name: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                phone: 1,
                role: 1,
              },
            },
          ],
          as: 'createdById',
        },
      },
      {
        $unwind: {
          path: '$createdById',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $facet: {
          metadata: [{ $count: 'totalRecords' }],
          data: [
            { $skip: skip },
            { $limit: limit },
          ],
        },
      },
    ];

    const result = await VisitorPass.aggregate(pipeline).session(session || null);
    const data = result[0]?.data || [];
    const totalRecords = result[0]?.metadata[0]?.totalRecords || 0;
    return { data, totalRecords };
  }
}

export default new VisitorPassRepository();
