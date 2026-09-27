import VisitorLog from './visitorLog.model.js';
import mongoose from 'mongoose';

export class VisitorLogRepository {
  /**
   * Create a new VisitorLog (check-in / walkthrough / walk-in).
   * @param {Object} logData - The data of the visitor entry.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object>} The created log document.
   */
  async create(logData, session) {
    const log = new VisitorLog(logData);
    return await log.save(session ? { session } : undefined);
  }

  /**
   * Update an entry log for checkout, transitioning status to COMPLETED and recording checkout time.
   * @param {string} id - The ID of the visitor log.
   * @param {Date} [checkOutTime=new Date()] - The checkout timestamp.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>} The updated log document.
   */
  async updateLogForCheckout(id, checkOutTime = new Date(), actorId, { gateName, reason } = {}, session = null) {
    return await VisitorLog.findByIdAndUpdate(
      id,
      {
        $set: {
          logStatus: 'COMPLETED',
          checkOutTime: checkOutTime || new Date(),
        },
        ...(actorId ? {
          $push: {
            actionHistory: {
              action: 'CHECKED_OUT',
              actorId,
              ...(gateName ? { gateName } : {}),
              ...(reason ? { reason } : {}),
              occurredAt: checkOutTime || new Date(),
            },
          },
        } : {}),
      },
      { returnDocument: 'after', runValidators: true, ...(session ? { session } : {}) }
    );
  }

  /**
   * Fetch active logs for visitors currently inside the premises.
   * @param {string} orgId - The organization (community) ID.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object[]>} List of active visitor log documents.
   */
  async findActiveLogsInside(orgId, residentId = null, session = null) {
    if (!orgId) return [];
    const isMongoId = mongoose.isValidObjectId(orgId);
    const orgQuery = isMongoId
      ? { $or: [{ orgId: new mongoose.Types.ObjectId(orgId) }, { orgId: String(orgId) }] }
      : { orgId: String(orgId) };

    return await VisitorLog.find({
      ...orgQuery,
      logStatus: 'INSIDE',
      ...(residentId ? { residentId } : {}),
    })
    .sort({ checkInTime: -1 })
    .populate({
      path: 'residentId',
      select: 'username name phone email villaId',
      populate: {
        path: 'villaId',
        select: 'unitNumber blockOrBuilding villaNumber block'
      }
    })
    .populate({
      path: 'passId',
      populate: {
        path: 'villaId',
        select: 'unitNumber blockOrBuilding villaNumber block'
      }
    })
    .session(session || null)
    .exec();
  }

  /**
   * Find a VisitorLog by its ID.
   * @param {string} id - The ID of the log.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>} The log document, or null if not found.
   */
  async findById(id, session = null) {
    return await VisitorLog.findById(id).session(session || null);
  }

  /**
   * Find an active VisitorLog by its associated passId.
   * @param {string} passId - The ID of the visitor pass.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>} The log document, or null if not found.
   */
  async findActiveLogByPassId(passId, session = null) {
    return await VisitorLog.findOne({ passId, logStatus: 'INSIDE' }).session(session || null);
  }

  /**
   * Update an existing VisitorLog.
   * @param {string} id - The ID of the log.
   * @param {Object} updateData - The update parameters.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object|null>} The updated log document.
   */
  async update(id, updateData, session = null) {
    const hasOperators = Object.keys(updateData).some((key) => key.startsWith('$'));
    return await VisitorLog.findByIdAndUpdate(
      id,
      hasOperators ? updateData : { $set: updateData },
      { returnDocument: 'after', runValidators: true, ...(session ? { session } : {}) }
    );
  }

  /**
   * Find pending walk-in log approvals.
   * @param {Object} query - The Mongoose query filter.
   * @returns {Promise<Object[]>}
   */
  async findPendingApprovals(query) {
    return await VisitorLog.find(query)
      .sort({ createdAt: -1 })
      .populate({
        path: 'residentId',
        select: 'username name email'
      })
      .populate({
        path: 'guardId',
        select: 'username name'
      })
      .exec();
  }

  /**
   * Fetch paginated visitor logs history with aggregation facet count.
   * @param {string} orgId - The organization ID.
   * @param {number} skip - Number of records to skip.
   * @param {number} limit - Max number of records to return.
   * @param {Object} [filterQuery={}] - Filtering parameters.
   * @param {import('mongoose').ClientSession} [session=null] - Optional Mongoose session.
   * @returns {Promise<{ data: Object[], totalRecords: number }>}
   */
  async findHistoryLogsByOrg(orgId, skip = 0, limit = 10, filterQuery = {}, session = null) {
    const matchStage = {
      orgId: new mongoose.Types.ObjectId(orgId),
      ...filterQuery
    };

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'users',
          localField: 'residentId',
          foreignField: '_id',
          as: 'resident'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'guardId',
          foreignField: '_id',
          as: 'guard'
        }
      },
      {
        $lookup: {
          from: 'visitorpasses',
          localField: 'passId',
          foreignField: '_id',
          as: 'pass'
        }
      },
      {
        $unwind: {
          path: '$resident',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$guard',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$pass',
          preserveNullAndEmptyArrays: true
        }
      },
      // The visited unit: the pass's villa, or the host's villa for walk-ins (no pass).
      {
        $lookup: {
          from: 'villas',
          localField: 'pass.villaId',
          foreignField: '_id',
          as: 'passVilla'
        }
      },
      {
        $lookup: {
          from: 'villas',
          localField: 'resident.villaId',
          foreignField: '_id',
          as: 'residentVilla'
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalRecords' }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                orgId: 1,
                entryType: 1,
                logStatus: 1,
                snapshot: 1,
                gateName: 1,
                actionHistory: 1,
                checkInTime: 1,
                checkOutTime: 1,
                villa: {
                  $let: {
                    vars: {
                      v: { $ifNull: [{ $arrayElemAt: ['$passVilla', 0] }, { $arrayElemAt: ['$residentVilla', 0] }] }
                    },
                    in: { _id: '$$v._id', unitNumber: '$$v.unitNumber', blockOrBuilding: '$$v.blockOrBuilding' }
                  }
                },
                createdAt: 1,
                updatedAt: 1,
                residentId: {
                  _id: '$resident._id',
                  username: '$resident.username',
                  name: '$resident.name',
                  email: '$resident.email'
                },
                guardId: {
                  _id: '$guard._id',
                  username: '$guard.username',
                  name: '$guard.name'
                },
                passId: {
                  _id: '$pass._id',
                  passType: '$pass.passType',
                  status: '$pass.status',
                  visitorDetails: '$pass.visitorDetails',
                  vehicleDetails: '$pass.vehicleDetails',
                  validity: '$pass.validity'
                }
              }
            }
          ]
        }
      }
    ];

    const result = await VisitorLog.aggregate(pipeline).session(session || null);
    const data = result[0]?.data || [];
    const totalRecords = result[0]?.metadata[0]?.totalRecords || 0;
    return { data, totalRecords };
  }
}

export default new VisitorLogRepository();
