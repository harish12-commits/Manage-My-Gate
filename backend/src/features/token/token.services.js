import crypto from 'crypto';
import tokenRepository from './token.repository.js';
import HttpError from '../../utils/httpError.utils.js';

export class TokenService {
  /**
   * Generates a random secure token, hashes it using SHA-256, and saves it in the database.
   * @param {string} userId - ID of the user the token is linked to
   * @param {string} [orgId] - ID of the organization (optional)
   * @param {import('mongoose').ClientSession} [session]
   * @param {string} [invitationSource='WEB'] - 'WEB' or 'APP'
   * @param {string} [inviterId=null] - ID of administrator creating the invitation
   * @returns {Promise<{ invitationToken: string, invitationSource: string, expiresAt: Date }>} Unhashed token info
   */
  async generateInvitationToken(userId, orgId = null, session = null, invitationSource = 'WEB', inviterId = null) {
    let actualOrgId = orgId;
    let actualSession = session;
    let actualSource = invitationSource;
    let actualInviterId = inviterId;

    if (orgId && typeof orgId === 'object' && orgId.constructor && orgId.constructor.name === 'ClientSession') {
      actualSession = orgId;
      actualOrgId = null;
    }

    if (session && typeof session === 'string' && ['WEB', 'APP'].includes(session.toUpperCase())) {
      actualSource = session.toUpperCase();
      actualSession = null;
    }

    if (invitationSource && typeof invitationSource === 'string' && !['WEB', 'APP'].includes(invitationSource.toUpperCase()) && !actualInviterId) {
      actualInviterId = invitationSource;
      actualSource = 'WEB';
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour standard lifecycle

    const tokenDoc = await tokenRepository.create(
      {
        userId,
        orgId: actualOrgId,
        inviterId: actualInviterId,
        token: hashedToken,
        type: 'INVITATION',
        status: 'PENDING',
        invitationSource: ['WEB', 'APP'].includes(actualSource?.toUpperCase()) ? actualSource.toUpperCase() : 'WEB',
        expiresAt,
      },
      actualSession
    );

    return { invitationToken: rawToken, invitationSource: actualSource, expiresAt, tokenDoc };
  }

  /**
   * Finds a token document by unhashed token string without mutating it.
   * The Token collection is the sole authority. Outbox payloads and user IDs
   * must never be promoted into synthetic, renewable invitation credentials.
   *
   * @param {string} unhashedToken - Raw token string
   * @param {string} [type='INVITATION'] - Token type
   * @param {import('mongoose').ClientSession} [session]
   */
  async getInvitationToken(unhashedToken, type = 'INVITATION', session = null) {
    if (!unhashedToken) return null;
    const hashedToken = crypto.createHash('sha256').update(unhashedToken).digest('hex');

    // Query Token collection (both hashed and legacy unhashed representations).
    let doc = await tokenRepository.findOne(
      {
        $or: [{ token: hashedToken }, { token: unhashedToken }],
        type: { $regex: new RegExp(`^${type}$`, 'i') },
      },
      session
    );

    if (doc) {
      // Dynamic check for expired pending token
      if (doc.status === 'PENDING' && doc.expiresAt && new Date() > new Date(doc.expiresAt)) {
        doc.status = 'EXPIRED';
        await tokenRepository.updateOne(
          { _id: doc._id },
          { $set: { status: 'EXPIRED' } },
          session
        ).catch(() => null);
      }
      return doc;
    }

    return null;
  }

  /**
   * Validates an invitation token against the explicit lifecycle state machine.
   * Throws typed HttpErrors for invalid state transitions.
   *
   * @param {string} unhashedToken - Raw invitation token
   * @param {import('mongoose').ClientSession} [session]
   * @returns {Promise<{ userId: string, orgId: string, inviterId: string, tokenDoc: Object }>}
   */
  async validateInvitationToken(unhashedToken, session = null) {
    if (!unhashedToken) {
      throw new HttpError(400, 'Invitation token is required.');
    }

    const tokenDoc = await this.getInvitationToken(unhashedToken, 'INVITATION', session);

    if (!tokenDoc || !tokenDoc.userId) {
      throw new HttpError(400, 'Invalid or expired invitation token.');
    }

    // Check expiration timestamp
    if (tokenDoc.status === 'EXPIRED' || (tokenDoc.expiresAt && new Date() > new Date(tokenDoc.expiresAt))) {
      if (tokenDoc._id && tokenDoc.status === 'PENDING') {
        await tokenRepository.updateOne(
          { _id: tokenDoc._id },
          { $set: { status: 'EXPIRED' } },
          session
        ).catch(() => null);
        tokenDoc.status = 'EXPIRED';
      }
      throw new HttpError(400, 'Invitation has expired. Please ask your administrator to resend the invitation.');
    }

    // Check lifecycle status
    if (tokenDoc.status === 'REVOKED') {
      throw new HttpError(400, 'Invitation has been revoked by the administrator.');
    }

    if (tokenDoc.status === 'REJECTED') {
      throw new HttpError(400, 'Invitation has already been rejected.');
    }

    if (tokenDoc.status === 'ACCEPTED' || tokenDoc.used === true) {
      throw new HttpError(400, 'Invitation has already been accepted.');
    }

    if (tokenDoc.status !== 'PENDING') {
      throw new HttpError(400, 'Invitation is not valid.');
    }

    return {
      userId: tokenDoc.userId,
      orgId: tokenDoc.orgId,
      inviterId: tokenDoc.inviterId,
      tokenDoc,
    };
  }

  /**
   * Atomically transitions a pending invitation token to ACCEPTED.
   * @param {string} unhashedToken - Raw token string
   * @param {import('mongoose').ClientSession} [session]
   */
  async consumeInvitationToken(unhashedToken, session = null) {
    const { userId, orgId, inviterId, tokenDoc } = await this.validateInvitationToken(unhashedToken, session);

    if (tokenDoc && tokenDoc._id) {
      const consumed = await tokenRepository.findOneAndUpdate(
        { _id: tokenDoc._id, status: 'PENDING', used: { $ne: true } },
        {
          $set: {
            status: 'ACCEPTED',
            used: true,
            usedAt: new Date(),
          },
        },
        {},
        session
      );
      if (!consumed) throw new HttpError(409, 'Invitation has already been processed.');
      tokenDoc.status = 'ACCEPTED';
      tokenDoc.used = true;
      tokenDoc.usedAt = new Date();
    }

    return { userId, orgId, inviterId, tokenDoc };
  }

  /**
   * Atomically transitions a pending invitation token to REJECTED.
   * @param {string} unhashedToken - Raw token string
   * @param {import('mongoose').ClientSession} [session]
   */
  async rejectInvitationToken(unhashedToken, session = null) {
    const { userId, orgId, inviterId, tokenDoc } = await this.validateInvitationToken(unhashedToken, session);

    if (tokenDoc && tokenDoc._id) {
      const rejected = await tokenRepository.findOneAndUpdate(
        { _id: tokenDoc._id, status: 'PENDING', used: { $ne: true } },
        {
          $set: {
            status: 'REJECTED',
            used: true,
            usedAt: new Date(),
          },
        },
        {},
        session
      );
      if (!rejected) throw new HttpError(409, 'Invitation has already been processed.');
      tokenDoc.status = 'REJECTED';
      tokenDoc.used = true;
      tokenDoc.usedAt = new Date();
    }

    return { userId, orgId, inviterId, tokenDoc };
  }

  /**
   * Revokes an invitation token by token ID or user ID within an organization.
   * Transitions status PENDING -> REVOKED.
   * Throws errors if already ACCEPTED, REJECTED, EXPIRED, or REVOKED.
   *
   * @param {string} identifier - Token _id or User _id
   * @param {string} orgId - Target organization ID
   * @param {string} [inviterId=null] - Authenticated admin ID executing the revocation
   * @param {import('mongoose').ClientSession} [session]
   */
  async revokeInvitationToken(identifier, orgId, inviterId = null, session = null) {
    if (!identifier) {
      throw new HttpError(400, 'Invitation identifier is required.');
    }

    const mongoose = (await import('mongoose')).default;
    let query = {};

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      query = {
        $or: [
          { _id: identifier },
          { userId: identifier, orgId, type: 'INVITATION' },
        ],
      };
    } else {
      const hashed = crypto.createHash('sha256').update(identifier).digest('hex');
      query = {
        $or: [{ token: hashed }, { token: identifier }],
        type: 'INVITATION',
      };
    }

    const tokenDoc = await tokenRepository.findOne(query, session);

    if (!tokenDoc) {
      throw new HttpError(404, 'Invitation not found.');
    }

    if (orgId && tokenDoc.orgId && tokenDoc.orgId.toString() !== orgId.toString()) {
      throw new HttpError(403, 'Forbidden. Invitation belongs to another organization.');
    }

    // State transition guards
    if (tokenDoc.status === 'ACCEPTED' || tokenDoc.used === true) {
      throw new HttpError(400, 'Cannot revoke an invitation that has already been accepted.');
    }

    if (tokenDoc.status === 'REJECTED') {
      throw new HttpError(400, 'Cannot revoke an invitation that has already been rejected.');
    }

    if (tokenDoc.status === 'REVOKED') {
      throw new HttpError(400, 'Invitation is already revoked.');
    }

    if (tokenDoc.status === 'EXPIRED' || (tokenDoc.expiresAt && new Date() > new Date(tokenDoc.expiresAt))) {
      if (tokenDoc.status === 'PENDING') {
        await tokenRepository.updateOne(
          { _id: tokenDoc._id },
          { $set: { status: 'EXPIRED' } },
          session
        ).catch(() => null);
      }
      throw new HttpError(400, 'Cannot revoke an expired invitation.');
    }

    await tokenRepository.updateOne(
      { _id: tokenDoc._id },
      {
        $set: {
          status: 'REVOKED',
          used: true,
          usedAt: new Date(),
        },
      },
      session
    );

    tokenDoc.status = 'REVOKED';
    tokenDoc.used = true;
    tokenDoc.usedAt = new Date();

    return tokenDoc;
  }

  /**
   * Validates a raw token, marks it consumed/deleted, and returns token info.
   * Kept for 100% backward compatibility with existing callers.
   * @param {string} unhashedToken - Raw token string
   * @param {string} [type='INVITATION'] - Token type
   * @param {import('mongoose').ClientSession} [session]
   */
  async validateAndDeleteToken(unhashedToken, type = 'INVITATION', session = null) {
    if (type === 'INVITATION') {
      return await this.consumeInvitationToken(unhashedToken, session);
    }

    if (!unhashedToken) {
      throw new HttpError(400, 'Invalid or expired token.');
    }

    const tokenDoc = await this.getInvitationToken(unhashedToken, type, session);
    let userId = tokenDoc?.userId;
    let orgId = tokenDoc?.orgId;

    if (!userId) {
      throw new HttpError(400, 'Invalid or expired token.');
    }

    if (tokenDoc && tokenDoc._id) {
      try {
        await tokenRepository.updateOne(
          { _id: tokenDoc._id },
          { $set: { used: true, usedAt: new Date() } },
          session
        );
      } catch (err) {
        try {
          await tokenRepository.deleteOne({ _id: tokenDoc._id }, session);
        } catch (_) {}
      }
    }

    return { userId, orgId, tokenDoc };
  }

  /**
   * Generates a short-lived opaque mobile handoff token (5-minute TTL).
   * Stored server-side as SHA-256 hash.
   *
   * @param {string} userId - Authenticated user ID
   * @param {string} orgId - Active organization ID
   * @param {import('mongoose').ClientSession} [session]
   * @returns {Promise<{ handoffId: string, expiresAt: Date }>}
   */
  async createMobileHandoffToken(userId, orgId = null, session = null) {
    if (!userId) {
      throw new HttpError(400, 'User ID is required to generate mobile handoff.');
    }

    const rawHandoffId = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawHandoffId).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes strict window

    // Invalidate any previous pending handoff tokens for this user
    await tokenRepository.updateMany(
      { userId, type: 'MOBILE_HANDOFF', status: 'PENDING' },
      { $set: { status: 'EXPIRED' } },
      session
    ).catch(() => null);

    await tokenRepository.create(
      {
        userId,
        orgId: orgId || null,
        token: hashedToken,
        type: 'MOBILE_HANDOFF',
        status: 'PENDING',
        used: false,
        expiresAt,
      },
      session
    );

    return { handoffId: rawHandoffId, expiresAt };
  }

  /**
   * Atomically validates and exchanges a mobile handoff token.
   * Prevents concurrent race conditions via atomic state transition to EXCHANGED.
   *
   * @param {string} rawHandoffId - Raw opaque handoff identifier
   * @param {import('mongoose').ClientSession} [session]
   * @returns {Promise<{ userId: string, orgId: string, tokenDoc: Object }>}
   */
  async exchangeMobileHandoffToken(rawHandoffId, session = null) {
    if (!rawHandoffId || typeof rawHandoffId !== 'string' || rawHandoffId.trim().length === 0) {
      throw new HttpError(400, 'Handoff identifier is required.');
    }

    const trimmedHandoff = rawHandoffId.trim();
    const hashedToken = crypto.createHash('sha256').update(trimmedHandoff).digest('hex');

    // Atomic find and update: only match if status is PENDING and not expired and not used
    // This strictly prevents race conditions: Request A succeeds, concurrent Request B fails!
    const tokenDoc = await tokenRepository.findOneAndUpdate(
      {
        $or: [{ token: hashedToken }, { token: trimmedHandoff }],
        type: 'MOBILE_HANDOFF',
        status: 'PENDING',
        used: false,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          status: 'EXCHANGED',
          used: true,
          usedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
      session
    );

    if (!tokenDoc) {
      // Determine reason for failure for precise error reporting without leaking raw data
      const existingToken = await tokenRepository.findOne(
        {
          $or: [{ token: hashedToken }, { token: trimmedHandoff }],
          type: 'MOBILE_HANDOFF',
        },
        session
      );

      if (!existingToken) {
        throw new HttpError(400, 'Invalid mobile handoff identifier.');
      }

      if (existingToken.status === 'EXCHANGED' || existingToken.used === true) {
        throw new HttpError(400, 'This mobile handoff has already been used.');
      }

      if (existingToken.expiresAt && new Date() >= new Date(existingToken.expiresAt)) {
        throw new HttpError(400, 'This mobile handoff has expired. Please initiate a new handoff from your browser.');
      }

      throw new HttpError(400, 'Mobile handoff is not valid.');
    }

    return {
      userId: tokenDoc.userId,
      orgId: tokenDoc.orgId,
      tokenDoc,
    };
  }

  /**
   * Revokes or deletes tokens by query.
   * @param {Object} query
   * @param {import('mongoose').ClientSession} [session]
   */
  async deleteTokens(query, session = null) {
    return await tokenRepository.deleteMany(query, session);
  }

  /**
   * Finds a token by its ID.
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {import('mongoose').ClientSession} [session]
   */
  async findTokenById(id, session = null) {
    return await tokenRepository.findById(id, session);
  }

  /**
   * Atomically invalidates an old invitation token during resend.
   * Enforces single-consumer concurrency protection.
   * @param {string} invitationId
   * @param {string} orgId
   * @param {string} replacementStatus ('EXPIRED' or 'REVOKED')
   * @param {import('mongoose').ClientSession} [session]
   */
  async findAndInvalidateForResend(invitationId, orgId, replacementStatus, session = null) {
    return await tokenRepository.findOneAndUpdate(
      {
        _id: invitationId,
        orgId,
        type: 'INVITATION',
        status: { $in: ['PENDING', 'EXPIRED'] },
        used: false,
      },
      {
        $set: {
          status: replacementStatus,
          used: true,
          usedAt: new Date(),
        },
      },
      {},
      session
    );
  }

  /**
   * Lists invitations with pagination, status filtering, and recipient search using $facet aggregation.
   * Zero raw credentials or token hashes are returned.
   * @param {Object} params
   * @param {string} params.orgId - Authoritative organization ID
   * @param {number} [params.page=1] - Page number (1-indexed)
   * @param {number} [params.limit=10] - Items per page
   * @param {string} [params.status='ALL'] - Status filter ('ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVOKED' | 'EXPIRED')
   * @param {string} [params.search=''] - Search query (name, email, username, phone)
   * @param {string} [params.sortBy='createdAt'] - Sort field
   * @param {string} [params.sortOrder='desc'] - Sort order ('asc' | 'desc')
   * @param {import('mongoose').ClientSession} [session]
   */
  async listInvitations({
    orgId,
    page = 1,
    limit = 10,
    status = 'ALL',
    search = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
  }, session = null) {
    if (!orgId) {
      throw new HttpError(400, 'Organization context is required to list invitations.');
    }

    const mongoose = (await import('mongoose')).default;
    const orgObjectId = mongoose.Types.ObjectId.isValid(orgId)
      ? new mongoose.Types.ObjectId(orgId)
      : orgId;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const sortDirection = sortOrder === 'asc' || sortOrder === '1' ? 1 : -1;
    const allowedSortFields = ['createdAt', 'expiresAt', 'status'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const pipeline = [];

    // Stage 1: Base match on orgId and INVITATION type
    pipeline.push({
      $match: {
        orgId: orgObjectId,
        type: 'INVITATION',
      },
    });

    // Stage 2: Join recipient User details
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'recipient',
      },
    });
    pipeline.push({
      $unwind: {
        path: '$recipient',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Stage 3: Join inviter User details
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'inviterId',
        foreignField: '_id',
        as: 'inviter',
      },
    });
    pipeline.push({
      $unwind: {
        path: '$inviter',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Stage 4: Join OrgMembership details for residencyType and roleId
    pipeline.push({
      $lookup: {
        from: 'orgmemberships',
        let: { uId: '$userId', oId: '$orgId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userId', '$$uId'] },
                  { $eq: ['$orgId', '$$oId'] },
                ],
              },
            },
          },
        ],
        as: 'membership',
      },
    });
    pipeline.push({
      $unwind: {
        path: '$membership',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Stage 5: Join Role details
    pipeline.push({
      $lookup: {
        from: 'roles',
        localField: 'membership.roleId',
        foreignField: '_id',
        as: 'role',
      },
    });
    pipeline.push({
      $unwind: {
        path: '$role',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Stage 6: Compute dynamic expiration status
    // PENDING with elapsed expiresAt is computed as EXPIRED
    const now = new Date();
    pipeline.push({
      $addFields: {
        computedStatus: {
          $cond: {
            if: {
              $and: [
                { $eq: ['$status', 'PENDING'] },
                { $lte: ['$expiresAt', now] },
              ],
            },
            then: 'EXPIRED',
            else: '$status',
          },
        },
      },
    });

    // Stage 7: Status filter matching computedStatus
    if (status && status !== 'ALL') {
      const upperStatus = status.toUpperCase();
      pipeline.push({
        $match: {
          computedStatus: upperStatus,
        },
      });
    }

    // Stage 8: Recipient search
    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitized, 'i');
      pipeline.push({
        $match: {
          $or: [
            { 'recipient.name': searchRegex },
            { 'recipient.email': searchRegex },
            { 'recipient.username': searchRegex },
            { 'recipient.phone': searchRegex },
          ],
        },
      });
    }

    // Stage 9: Facet for single round-trip pagination and count
    pipeline.push({
      $facet: {
        data: [
          { $sort: { [sortField]: sortDirection } },
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
          {
            $project: {
              _id: 1,
              userId: 1,
              orgId: 1,
              inviterId: 1,
              status: '$computedStatus',
              rawStatus: '$status',
              invitationSource: 1,
              expiresAt: 1,
              usedAt: 1,
              createdAt: 1,
              updatedAt: 1,
              recipient: {
                _id: '$recipient._id',
                name: '$recipient.name',
                email: '$recipient.email',
                phone: '$recipient.phone',
                username: '$recipient.username',
                status: '$recipient.status',
              },
              inviter: {
                _id: '$inviter._id',
                name: '$inviter.name',
                email: '$inviter.email',
              },
              role: {
                _id: '$role._id',
                name: '$role.name',
              },
              residencyType: '$membership.residentType',
              // CRITICAL: Zero token or hash or URL projection!
            },
          },
        ],
        totalCount: [
          { $count: 'count' },
        ],
      },
    });

    const results = await tokenRepository.aggregate(pipeline, session);
    const facetResult = results && results[0] ? results[0] : { data: [], totalCount: [] };
    const records = facetResult.data || [];
    const totalRecords = (facetResult.totalCount && facetResult.totalCount[0] && facetResult.totalCount[0].count) || 0;
    const totalPages = Math.ceil(totalRecords / limitNum) || 1;

    return {
      records,
      currentPage: pageNum,
      totalPages,
      totalRecords,
      limit: limitNum,
    };
  }
}

export default new TokenService();


