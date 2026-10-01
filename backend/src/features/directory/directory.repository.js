import OrgMembership from '../orgMembership/orgMembership.model.js';
import User from '../user/user.model.js';
import mongoose from 'mongoose';

export const directoryRepository = {
  async getPaginatedDirectory({ orgId, role, search, page = 1, limit = 50 }) {
    const cleanOrgId = new mongoose.Types.ObjectId(orgId);
    const skip = (page - 1) * limit;

    // Match Stage for OrgMembership
    const matchStage = {
      orgId: cleanOrgId,
      status: 'Active',
    };

    const pipeline = [
      { $match: matchStage },
      // Lookup User
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },

      // Filter out users who hid themselves from directory or are suspended/blocked
      {
        $match: {
          'user.hideFromDirectory': { $ne: true },
          'user.status': { $in: ['Active', 'Pending Verification'] },
        },
      },

      // Lookup Villa / Unit
      {
        $lookup: {
          from: 'villas',
          let: { orgVillaId: '$villaId', userVillaId: '$user.villaId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$_id', '$$orgVillaId'] },
                    { $eq: ['$_id', '$$userVillaId'] },
                  ],
                },
              },
            },
          ],
          as: 'villa',
        },
      },
      {
        $unwind: {
          path: '$villa',
          preserveNullAndEmptyArrays: true,
        },
      },

      // Resolve every supported role source. Current memberships store roleIds,
      // while older records may only have roleId or the legacy user.roles cache.
      {
        $lookup: {
          from: 'roles',
          let: {
            assignedRoleIds: {
              $setUnion: [
                {
                  $cond: [
                    { $ne: [{ $ifNull: ['$roleId', null] }, null] },
                    ['$roleId'],
                    [],
                  ],
                },
                { $ifNull: ['$roleIds', []] },
                { $ifNull: ['$user.roles', []] },
              ],
            },
          },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$_id', '$$assignedRoleIds'] },
              },
            },
          ],
          as: 'resolvedRoles',
        },
      },
      {
        $set: {
          role: {
            $ifNull: [
              {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$resolvedRoles',
                      as: 'candidateRole',
                      cond: { $eq: ['$$candidateRole._id', '$roleId'] },
                    },
                  },
                  0,
                ],
              },
              { $arrayElemAt: ['$resolvedRoles', 0] },
            ],
          },
        },
      },

      // Group by user._id to deduplicate users with multiple membership/unit records
      {
        $group: {
          _id: '$user._id',
          user: { $first: '$user' },
          villa: { $first: '$villa' },
          role: { $first: '$role' },
          residentType: { $first: '$residentType' },
        },
      },

      // Transform fields & Expose User Profile Data for Community Directory
      {
        $project: {
          _id: '$_id',
          id: '$_id',
          userId: '$_id',
          name: { $ifNull: ['$user.name', '$user.username'] },
          avatarUrl: '$user.avatar',
          email: '$user.email',
          role: {
            $switch: {
              branches: [
                {
                  case: {
                    $regexMatch: {
                      input: { $ifNull: ['$role.name', ''] },
                      regex: /guard|security/i,
                    },
                  },
                  then: 'guard',
                },
                {
                  case: {
                    $regexMatch: {
                      input: { $ifNull: ['$role.name', ''] },
                      regex: /staff|technician|maintenance/i,
                    },
                  },
                  then: 'staff',
                },
                {
                  case: {
                    $regexMatch: {
                      input: { $ifNull: ['$role.name', ''] },
                      regex: /admin|president|board|management/i,
                    },
                  },
                  then: 'admin',
                },
              ],
              default: 'resident',
            },
          },
          designation: { $ifNull: ['$role.name', '$residentType'] },
          unitNumber: { $ifNull: ['$villa.unitNumber', '$villa.name', '$user.unitNumber', ''] },
          phone: {
            $cond: [
              { $eq: [{ $ifNull: ['$user.showPhoneInDirectory', true] }, false] },
              null,
              '$user.phone',
            ],
          },
          intercomNumber: { $ifNull: ['$villa.unitNumber', '$villa.name', '$user.unitNumber', ''] },
          allowDirectoryMessages: { $ifNull: ['$user.allowDirectoryMessages', true] },
          showPhoneInDirectory: { $ifNull: ['$user.showPhoneInDirectory', true] },
          allowIntercomCalls: { $ifNull: ['$user.allowIntercomCalls', true] },
          interests: { $ifNull: ['$user.interests', []] },
          isOnline: true,
        },
      },
    ];

    // Optional Role Filter
    if (role && role !== 'all') {
      const lowerRole = role.toLowerCase();
      let roleCondition;
      if (lowerRole === 'security' || lowerRole === 'guard') {
        roleCondition = { $in: ['guard', 'security'] };
      } else if (lowerRole === 'staff') {
        roleCondition = { $in: ['staff'] };
      } else if (lowerRole === 'maintenance') {
        roleCondition = { $in: ['staff', 'maintenance'] };
      } else if (lowerRole === 'management' || lowerRole === 'admin') {
        roleCondition = { $in: ['admin', 'management'] };
      } else if (lowerRole === 'resident' || lowerRole === 'residents') {
        roleCondition = { $in: ['resident', 'tenant', 'owner'] };
      } else {
        roleCondition = lowerRole;
      }

      pipeline.push({
        $match: {
          role: roleCondition,
        },
      });
    }

    // Optional Search Filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      pipeline.push({
        $match: {
          $or: [
            { name: searchRegex },
            { unitNumber: searchRegex },
            { designation: searchRegex },
            { intercomNumber: searchRegex },
            { phone: searchRegex },
            { email: searchRegex },
          ],
        },
      });
    }

    // $facet for Data + Total Pagination Count
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: skip }, { $limit: limit }],
      },
    });

    const results = await OrgMembership.aggregate(pipeline);
    const metadata = results[0]?.metadata[0] || { total: 0 };
    const data = results[0]?.data || [];

    const total = metadata.total;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: data,
      totalRecords: total,
      currentPage: page,
      totalPages,
      limit,
    };
  },
};

export default directoryRepository;
