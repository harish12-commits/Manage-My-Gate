import mongoose from 'mongoose';
import OrgMembership from './orgMembership.model.js';

export class OrgMembershipRepository {
  async create(membershipData, session) {
    const membership = new OrgMembership(membershipData);
    return await membership.save(session ? { session } : undefined);
  }

  async findByUserIdAndOrgId(userId, orgId, session) {
    return await OrgMembership.findOne({ userId, orgId }).session(session || null);
  }

  async findFirstByUserId(userId, session = null) {
    return await OrgMembership.findOne({ userId }).session(session || null);
  }

  async findByUserIdWithPopulate(userId, session = null) {
    return await OrgMembership.find({ userId })
      .populate({ path: 'orgId', select: 'name allowedFeatures status isPlatform countryCode' })
      .populate({ path: 'roleId', select: 'name' })
      .populate({ path: 'roleIds', select: 'name' })
      .populate({ path: 'villaId' })
      .populate({ path: 'units.villaId' })
      .populate({ path: 'assignments.roleId', select: 'name' })
      .session(session || null);
  }

  /**
   * Retrieves paginated users for a specific organization using aggregation pipeline.
   * @param {string} orgId - Organization ID
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @returns {Promise<{ data: Array, totalRecords: number }>}
   */
  async findPaginatedUsersByOrg(orgId, page = 1, limit = 10, filters = {}) {
    const skip = (page - 1) * limit;
    const matchQuery = { orgId: new mongoose.Types.ObjectId(orgId) };

    const filterMatch = {};
    if (filters.search) {
      filterMatch.$or = [
        { 'user.username': { $regex: filters.search, $options: 'i' } },
        { 'user.email': { $regex: filters.search, $options: 'i' } },
        { 'user.name': { $regex: filters.search, $options: 'i' } },
      ];
    }
    if (filters.roles && filters.roles.length > 0) {
      filterMatch['rolesPopulated.name'] = { $in: filters.roles };
    }
    if (filters.status && filters.status.length > 0) {
      filterMatch['status'] = { $in: filters.status };
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $lookup: {
          from: 'roles',
          localField: 'roleIds',
          foreignField: '_id',
          as: 'rolesPopulated',
        },
      },
      {
        $lookup: {
          from: 'roles',
          localField: 'roleId',
          foreignField: '_id',
          as: 'rolePopulatedFallback',
        },
      },
      {
        $lookup: {
          from: 'villas',
          localField: 'villaId',
          foreignField: '_id',
          as: 'villa',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $unwind: {
          path: '$villa',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '$user._id',
          user: { $first: '$user' },
          // We don't need $first for rolesPopulated globally, we compute the combined string per unit
          status: { $first: '$status' },
          assignedUnits: {
            $push: {
              $cond: [
                { $eq: [{ $ifNull: ['$villa._id', null] }, null] },
                '$$REMOVE',
                {
                  villaId: '$villa._id',
                  residentType: '$residentType',
                  villaNumber: '$villa.unitNumber',
                  villaBlock: '$villa.blockOrBuilding',
                  status: '$status',
                  role: {
                    $cond: {
                      if: { $gt: [{ $size: '$rolesPopulated' }, 0] },
                      then: {
                        $reduce: {
                          input: '$rolesPopulated.name',
                          initialValue: '',
                          in: {
                            $cond: [
                              { $eq: ['$$value', ''] },
                              '$$this',
                              { $concat: ['$$value', ', ', '$$this'] }
                            ]
                          }
                        }
                      },
                      else: { $ifNull: [{ $arrayElemAt: ['$rolePopulatedFallback.name', 0] }, ''] }
                    }
                  }
                }
              ]
            }
          },
          // We still need a global role string for users without units (e.g. Community Admin)
          rolesPopulated: { $first: '$rolesPopulated' },
          rolePopulatedFallback: { $first: '$rolePopulatedFallback' }
        }
      },
    ];

    if (Object.keys(filterMatch).length > 0) {
      pipeline.push({ $match: filterMatch });
    }

    pipeline.push({
      $facet: {
        metadata: [{ $count: 'totalRecords' }],
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              id: '$_id',
              username: '$user.username',
              name: '$user.name',
              phone: '$user.phone',
              email: '$user.email',
              role: {
                $cond: {
                  if: { $gt: [{ $size: '$rolesPopulated' }, 0] },
                  then: {
                    $reduce: {
                      input: '$rolesPopulated.name',
                      initialValue: '',
                      in: {
                        $cond: [
                          { $eq: ['$$value', ''] },
                          '$$this',
                          { $concat: ['$$value', ', ', '$$this'] }
                        ]
                      }
                    }
                  },
                  else: { $ifNull: [{ $arrayElemAt: ['$rolePopulatedFallback.name', 0] }, ''] }
                }
              },
              status: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$user.status', 'Pending Verification'] },
                      { $eq: ['$user.status', 'Pending'] },
                      { $eq: ['$status', 'Pending'] },
                    ],
                  },
                  'Pending',
                  { $ifNull: ['$status', 'Active'] },
                ],
              },
              assignedUnits: '$assignedUnits',
            },
          },
        ],
      },
    });

    const result = await OrgMembership.aggregate(pipeline);

    const totalRecords = result[0]?.metadata[0]?.totalRecords || 0;
    const data = result[0]?.data || [];

    return {
      data,
      totalRecords,
    };
  }

  async updateRoles(userId, orgId, roleIds, villaId = null, residentType = null, session = null) {
    const query = { userId, orgId };
    if (villaId) {
      query.villaId = villaId;
    }
    
    const cleanRoleIds = (Array.isArray(roleIds) ? roleIds : [roleIds]).filter(Boolean);
    const updatePayload = { roleIds: cleanRoleIds, roleId: cleanRoleIds.length > 0 ? cleanRoleIds[0] : null };
    if (residentType) {
      updatePayload.residentType = residentType;
    }
    
    return await OrgMembership.findOneAndUpdate(
      query,
      updatePayload,
      { returnDocument: 'after', runValidators: true, session: session || null }
    );
  }

  async updateStatus(userId, orgId, status, session = null) {
    const query = {};
    if (userId) {
      query.userId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    }
    if (orgId) {
      query.orgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;
    }
    return await OrgMembership.updateMany(
      query,
      { status },
      session ? { session } : undefined
    );
  }

  async deleteByUserId(userId, session) {
    return await OrgMembership.deleteMany(
      { userId },
      session ? { session } : undefined
    );
  }

  async deleteByUserIdAndOrgId(userId, orgId, session = null) {
    return await OrgMembership.deleteMany(
      { userId, orgId },
      session ? { session } : undefined
    );
  }

  async clearRoleFromMemberships(roleId, session) {
    return await OrgMembership.updateMany(
      { $or: [{ roleIds: roleId }, { roleId: roleId }] },
      { 
        $pull: { roleIds: roleId },
        $unset: { roleId: 1 }
      },
      { session: session || null }
    );
  }

  async findResidentsByVillaId(villaId, session = null) {
    return await OrgMembership.find({ villaId })
      .populate({ path: 'userId', select: 'name email phone status' })
      .session(session);
  }

  async findByUserIdAndOrgIdWithPopulate(userId, orgId, session = null) {
    return await OrgMembership.findOne({ userId, orgId })
      .populate({ path: 'villaId' })
      .populate({ path: 'units.villaId' })
      .session(session);
  }

  async findActiveMemberships(orgId, filter = {}, session = null) {
    const query = {
      orgId: new mongoose.Types.ObjectId(orgId),
      status: 'Active',
      ...filter,
    };
    return await OrgMembership.find(query)
      .populate({ path: 'villaId' })
      .populate({ path: 'units.villaId' })
      .session(session || null);
  }

  async findActiveUserIds(orgId, filter = {}, session = null) {
    const query = {
      orgId: new mongoose.Types.ObjectId(orgId),
      status: 'Active',
      ...filter,
    };
    const memberships = await OrgMembership.find(query).select('userId').session(session || null);
    return [...new Set(memberships.map((m) => m.userId?.toString()).filter(Boolean))];
  }
}

export default new OrgMembershipRepository();

