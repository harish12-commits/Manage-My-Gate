import Poll from './poll.model.js';
import PollVote from './pollVote.model.js';
import mongoose from 'mongoose';
import HttpError from '../../utils/httpError.utils.js';

export const createPoll = async (pollData, session = null) => {
  if (session && !session._isMockSession) {
    const [poll] = await Poll.create([pollData], { session });
    return poll;
  }
  return await Poll.create(pollData);
};

export const getPollById = async (pollId, orgId, session = null) => {
  return await Poll.findOne({ _id: pollId, orgId }).session(session);
};

export const updatePoll = async (pollId, orgId, updateData, session = null) => {
  return await Poll.findOneAndUpdate(
    { _id: pollId, orgId },
    updateData,
    { new: true, runValidators: true, session }
  );
};

export const deletePoll = async (pollId, orgId, session = null) => {
  if (session) {
    const deletedPoll = await Poll.findOneAndDelete({ _id: pollId, orgId }).session(session);
    if (deletedPoll) {
      await PollVote.deleteMany({ pollId, orgId }).session(session);
    }
    return deletedPoll;
  }

  const localSession = await mongoose.startSession();
  localSession.startTransaction();
  try {
    const deletedPoll = await Poll.findOneAndDelete({ _id: pollId, orgId }).session(localSession);
    if (deletedPoll) {
      await PollVote.deleteMany({ pollId, orgId }).session(localSession);
    }
    await localSession.commitTransaction();
    return deletedPoll;
  } catch (error) {
    await localSession.abortTransaction();
    throw error;
  } finally {
    localSession.endSession();
  }
};

const buildSortStage = (sortParam) => {
  switch (sortParam) {
    case 'oldest': return { createdAt: 1 };
    case 'endingSoon': return { endDate: 1 };
    case 'latest':
    default: return { createdAt: -1 };
  }
};

const buildMatchStage = (baseMatch, search, userContext = null, audienceOr = null) => {
  const conditions = [baseMatch];

  if (search) {
    conditions.push({ question: { $regex: search, $options: 'i' } });
  }

  if (userContext && !userContext.isCommunityAdmin) {
    conditions.push({ status: { $ne: 'Draft' } });
  }

  if (audienceOr && audienceOr.length > 0) {
    conditions.push({ $or: audienceOr });
  } else if (userContext) {
    const { isCommunityAdmin, isResident, userId } = userContext;
    const visibilityConditions = [
      { visibility: 'Everyone' },
      { visibility: { $exists: false } }
    ];
    if (isCommunityAdmin) visibilityConditions.push({ visibility: 'Community Admin Only' });
    if (isResident) visibilityConditions.push({ visibility: 'Residents Only' });
    if (userId) visibilityConditions.push({ createdBy: new mongoose.Types.ObjectId(userId) });
    conditions.push({ $or: visibilityConditions });
  }

  return conditions.length === 1 ? conditions[0] : { $and: conditions };
};

const getPopulateCreatorStages = () => [
  {
    $lookup: {
      from: 'users',
      localField: 'createdBy',
      foreignField: '_id',
      as: 'creator_info'
    }
  },
  {
    $unwind: { path: '$creator_info', preserveNullAndEmptyArrays: true }
  },
  {
    $lookup: {
      from: 'villas',
      localField: 'creator_info.villaId',
      foreignField: '_id',
      as: 'villa_info'
    }
  },
  {
    $unwind: { path: '$villa_info', preserveNullAndEmptyArrays: true }
  },
  {
    $addFields: {
      'createdBy': {
        _id: '$createdBy',
        name: {
          $ifNull: [
            { $cond: [{ $eq: ['$creator_info.name', ''] }, null, '$creator_info.name'] },
            { $cond: [{ $eq: ['$creator_info.username', ''] }, null, '$creator_info.username'] },
            'Unknown'
          ]
        },
        unit: { $ifNull: ['$villa_info.villaNumber', ''] }
      }
    }
  },
  {
    $project: {
      creator_info: 0,
      villa_info: 0
    }
  }
];

export const getPopulatedPollById = async (pollId, orgId) => {
  const pipeline = [
    { $match: { _id: new mongoose.Types.ObjectId(pollId), orgId: new mongoose.Types.ObjectId(orgId) } },
    ...getPopulateCreatorStages()
  ];
  const result = await Poll.aggregate(pipeline);
  return result[0];
};

export const getPollsByStatus = async (orgId, status = null, page = 1, limit = 20, search = '', sort = 'latest', userContext = null, audienceOr = null) => {
  const skip = (page - 1) * limit;
  const baseMatch = { orgId: new mongoose.Types.ObjectId(orgId) };
  if (status) {
    baseMatch.status = status;
  }
  
  const pipeline = [
    { $match: buildMatchStage(baseMatch, search, userContext, audienceOr) },
    { $sort: buildSortStage(sort) },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }, ...getPopulateCreatorStages()],
        totalCount: [{ $count: 'count' }]
      }
    }
  ];

  const result = await Poll.aggregate(pipeline);
  const data = result[0].data;
  const totalCount = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;

  return {
    polls: data,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page
  };
};

export const getMyPolls = async (orgId, userId, page = 1, limit = 20, search = '', sort = 'latest', userContext = null, audienceOr = null) => {
  const skip = (page - 1) * limit;
  const baseMatch = {
    orgId: new mongoose.Types.ObjectId(orgId),
    createdBy: new mongoose.Types.ObjectId(userId)
  };
  
  const pipeline = [
    { $match: buildMatchStage(baseMatch, search, userContext, audienceOr) },
    { $sort: buildSortStage(sort) },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }, ...getPopulateCreatorStages()],
        totalCount: [{ $count: 'count' }]
      }
    }
  ];

  const result = await Poll.aggregate(pipeline);
  const data = result[0].data;
  const totalCount = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;

  return {
    polls: data,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page
  };
};

export const getAllPolls = async (orgId, page = 1, limit = 20, search = '', sort = 'latest', userContext = null, audienceOr = null) => {
  return await getPollsByStatus(orgId, null, page, limit, search, sort, userContext, audienceOr);
};

export const recordVote = async (
  pollId,
  orgId,
  residentId,
  selectedOptions,
  unitId = null,
  votingMode = 'ONE_PER_USER',
  session = null
) => {
  const activeSession = (session && typeof session.inTransaction === 'function' && session.inTransaction()) ? session : null;

  // Normalize selectedOptions to array of integers
  const optionsToRecord = Array.isArray(selectedOptions)
    ? selectedOptions.map(Number)
    : [Number(selectedOptions)];

  // 1. Enforce ONE_PER_UNIT duplicate protection
  if (votingMode === 'ONE_PER_UNIT' && unitId) {
    const unitVoteQuery = PollVote.findOne({
      pollId: new mongoose.Types.ObjectId(pollId),
      orgId: new mongoose.Types.ObjectId(orgId),
      unitId: new mongoose.Types.ObjectId(unitId),
      residentId: { $ne: new mongoose.Types.ObjectId(residentId) }
    });
    const unitVote = activeSession ? await unitVoteQuery.session(activeSession) : await unitVoteQuery;

    if (unitVote) {
      throw new HttpError(409, 'A vote has already been submitted for your unit on this poll.');
    }
  }

  // 2. Check existing vote by this resident
  const existingVoteQuery = PollVote.findOne({
    pollId: new mongoose.Types.ObjectId(pollId),
    orgId: new mongoose.Types.ObjectId(orgId),
    residentId: new mongoose.Types.ObjectId(residentId)
  });
  const existingVote = activeSession ? await existingVoteQuery.session(activeSession) : await existingVoteQuery;

  if (existingVote) {
    const oldOptions = existingVote.selectedOptions?.length ? existingVote.selectedOptions : [existingVote.optionIndex];
    const oldOptionsSorted = [...oldOptions].sort().join(',');
    const newOptionsSorted = [...optionsToRecord].sort().join(',');

    if (oldOptionsSorted === newOptionsSorted) {
      // EXACT same options selected: Treat as Unvote (Revoke)
      const decOps = { totalVotes: -1 };
      oldOptions.forEach((idx) => {
        decOps[`options.${idx}.votesCount`] = -1;
      });
      
      const updatedPoll = await Poll.findOneAndUpdate(
        { _id: pollId, orgId },
        { $inc: decOps },
        { new: true, ...(activeSession ? { session: activeSession } : {}) }
      );
      
      if (activeSession) {
        await PollVote.deleteOne({ _id: existingVote._id }).session(activeSession);
      } else {
        await PollVote.deleteOne({ _id: existingVote._id });
      }
      
      return { poll: updatedPoll, action: 'unvoted' };
    } else {
      // Change vote
      const incOps = {};
      oldOptions.forEach((idx) => {
        incOps[`options.${idx}.votesCount`] = (incOps[`options.${idx}.votesCount`] || 0) - 1;
      });
      optionsToRecord.forEach((idx) => {
        incOps[`options.${idx}.votesCount`] = (incOps[`options.${idx}.votesCount`] || 0) + 1;
      });
      
      Object.keys(incOps).forEach(key => {
        if (incOps[key] === 0) delete incOps[key];
      });
      
      const updateQuery = Object.keys(incOps).length > 0 ? { $inc: incOps } : {};
      
      let updatedPoll;
      if (Object.keys(incOps).length > 0) {
        updatedPoll = await Poll.findOneAndUpdate(
          { _id: pollId, orgId },
          updateQuery,
          { new: true, ...(activeSession ? { session: activeSession } : {}) }
        );
      } else {
        updatedPoll = activeSession 
          ? await Poll.findOne({ _id: pollId, orgId }).session(activeSession)
          : await Poll.findOne({ _id: pollId, orgId });
      }
      
      existingVote.selectedOptions = optionsToRecord;
      existingVote.optionIndex = optionsToRecord[0];
      if (unitId) {
        existingVote.unitId = unitId;
      }
      
      if (activeSession) {
        await existingVote.save({ session: activeSession });
      } else {
        await existingVote.save();
      }
      
      return { poll: updatedPoll, action: 'voted' };
    }
  }

  // New vote
  const incOps = { totalVotes: 1 };
  optionsToRecord.forEach((idx) => {
    incOps[`options.${idx}.votesCount`] = (incOps[`options.${idx}.votesCount`] || 0) + 1;
  });

  const updatedPoll = await Poll.findOneAndUpdate(
    { _id: pollId, orgId },
    { $inc: incOps },
    { new: true, ...(activeSession ? { session: activeSession } : {}) }
  );

  if (activeSession) {
    await PollVote.create(
      [
        {
          orgId,
          pollId,
          residentId,
          unitId,
          selectedOptions: optionsToRecord,
          optionIndex: optionsToRecord[0]
        }
      ],
      { session: activeSession }
    );
  } else {
    const newVote = new PollVote({
      orgId,
      pollId,
      residentId,
      unitId,
      selectedOptions: optionsToRecord,
      optionIndex: optionsToRecord[0]
    });
    await newVote.save();
  }

  return { poll: updatedPoll, action: 'voted' };
};

export const getPollResults = async (pollId, orgId, session = null) => {
  return await Poll.findOne({ _id: pollId, orgId }).session(session);
};

export const hasVoted = async (pollId, orgId, residentId) => {
  const vote = await PollVote.findOne({ pollId, orgId, residentId });
  return !!vote;
};

export const getUserVote = async (pollId, orgId, residentId) => {
  return await PollVote.findOne({ pollId, orgId, residentId }).lean();
};

export const getUserVotedPollIds = async (orgId, residentId, pollIds) => {
  const votes = await PollVote.find({ orgId, residentId, pollId: { $in: pollIds } });
  return votes.map(v => v.pollId.toString());
};

export const getPollVoters = async (pollId, orgId, isAnonymous = false) => {
  if (isAnonymous) {
    const votes = await PollVote.find({
      pollId: new mongoose.Types.ObjectId(pollId),
      orgId: new mongoose.Types.ObjectId(orgId)
    }).lean();

    return votes.map((v) => ({
      optionIndex: typeof v.optionIndex === 'number' ? v.optionIndex : (v.selectedOptions ? v.selectedOptions[0] : 0),
      selectedOptions: v.selectedOptions || [v.optionIndex],
      name: 'Anonymous Voter',
      unit: null,
      createdAt: v.createdAt
    }));
  }

  const pipeline = [
    { $match: { pollId: new mongoose.Types.ObjectId(pollId), orgId: new mongoose.Types.ObjectId(orgId) } },
    {
      $lookup: {
        from: 'users',
        localField: 'residentId',
        foreignField: '_id',
        as: 'user_info'
      }
    },
    { $unwind: { path: '$user_info', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'villas',
        localField: 'user_info.villaId',
        foreignField: '_id',
        as: 'villa_info'
      }
    },
    { $unwind: { path: '$villa_info', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        optionIndex: 1,
        selectedOptions: 1,
        name: {
          $ifNull: [
            { $cond: [ { $eq: ['$user_info.name', ''] }, null, '$user_info.name' ] },
            { $cond: [ { $eq: ['$user_info.username', ''] }, null, '$user_info.username' ] },
            'Unknown'
          ]
        },
        unit: {
          $ifNull: [
            '$villa_info.villaNumber',
            { $ifNull: ['$villa_info.unitNumber', ''] }
          ]
        },
        createdAt: 1
      }
    }
  ];
  return await PollVote.aggregate(pipeline);
};
