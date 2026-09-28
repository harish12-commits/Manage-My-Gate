import visitorLogRepository from './visitorLog.repository.js';
import visitorPassService from '../visitorPass/visitorPass.service.js';
import visitorLogEvents from './visitorLog.events.js';
import HttpError from '../../utils/httpError.utils.js';
import blacklistService from '../blacklist/blacklist.service.js';
import visitorPassTokenService from '../visitorPassToken/visitorPassToken.service.js';
import orgMembershipService from '../orgMembership/orgMembership.services.js';
import {
  assertVisitorPermission,
  assertWalkInResolutionAccess,
  getActorId,
  isGateOperator,
  isVisitorManager,
} from '../visitorPass/visitorPass.policy.js';

export class VisitorLogService {
  /**
   * Logs entry for a pre-approved visitor pass.
   * Modifies pass status and usages transactionally inside the session.
   * @param {string} passId - The visitor pass ID.
   * @param {string} guardId - The checking-in guard's user ID.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object>} The created entry log.
   */
  async logPreApprovedEntry(passId, actor, context = {}, session = null) {
    assertVisitorPermission(['gate', 'manager'], actor);
    const guardId = getActorId(actor);
    // 1. Verify pass status, dates, times, allowed days, usage limits
    const pass = await visitorPassService.verifyPassForEntry(passId, session);
    if (String(pass.orgId) !== String(context.orgId)) {
      throw new HttpError(403, 'Forbidden. This pass belongs to another community.');
    }

    // 2. Use pass transactionally (increments usage count, updates status)
    await visitorPassService.usePass(pass, session);

    // 3. Prepare log data
    const logData = {
      orgId: pass.orgId,
      passId: pass._id,
      guardId,
      residentId: pass.createdById,
      ...(context.gateName ? { gateName: context.gateName } : {}),
      entryType: 'PRE_APPROVED',
      logStatus: 'INSIDE',
      snapshot: {
        visitorName: pass.visitorDetails?.name,
        idProofNumber: pass.visitorDetails?.idProofNumber,
        vehicleNumber: pass.vehicleDetails?.number
      },
      checkInTime: new Date()
    };
    logData.actionHistory = [{
      action: 'CHECKED_IN',
      actorId: guardId,
      ...(context.gateName ? { gateName: context.gateName } : {}),
      occurredAt: logData.checkInTime,
    }];

    // 4. Create log entry
    const log = await visitorLogRepository.create(logData, session);

    // 5. Emit events
    visitorLogEvents.emit('log_created', log);

    return log;
  }

  /**
   * Initiates a walk-in entry request at the gate, waiting for resident approval.
   * @param {Object} walkInData - Details of the walk-in visitor.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object>} The pending visitor log.
   */
  async initiateWalkInRequest(walkInData, actor, session = null) {
    assertVisitorPermission(['gate', 'manager'], actor);
    const guardId = getActorId(actor);
    if (!walkInData.residentId) {
      throw new HttpError(400, 'A resident host must be selected before a walk-in request can be sent.');
    }
    const residentMembership = await orgMembershipService.getMembership(
      walkInData.residentId,
      walkInData.orgId,
      session
    );
    if (!residentMembership || residentMembership.status !== 'Active') {
      throw new HttpError(400, 'The selected resident is not active in this community.');
    }
    // Check Blacklist before initiating walk-in
    const isBanned = await blacklistService.checkMatch(walkInData.orgId, {
      name: walkInData.snapshot?.visitorName,
      phone: walkInData.snapshot?.phone,
      plate: walkInData.snapshot?.vehicleNumber
    });
    if (isBanned) {
      throw new HttpError(403, `Visitor is blacklisted: ${isBanned.reason}`);
    }

    const logData = {
      orgId: walkInData.orgId,
      guardId,
      residentId: walkInData.residentId,
      entryType: 'WALK_IN',
      logStatus: 'PENDING',
      snapshot: {
        visitorName: walkInData.snapshot?.visitorName,
        phone: walkInData.snapshot?.phone,
        idProofNumber: walkInData.snapshot?.idProofNumber,
        vehicleNumber: walkInData.snapshot?.vehicleNumber
      }
    };
    if (walkInData.gateName) logData.gateName = walkInData.gateName;
    logData.actionHistory = [{
      action: 'REQUESTED',
      actorId: guardId,
      ...(walkInData.gateName ? { gateName: walkInData.gateName } : {}),
      occurredAt: new Date(),
    }];

    const log = await visitorLogRepository.create(logData, session);
    visitorLogEvents.emit('walk_in_pending', log);
    return log;
  }

  /**
   * Resident resolves a pending walk-in check-in request (APPROVE or REJECT).
   * @param {string} logId - The visitor log ID.
   * @param {'APPROVE'|'REJECT'} action - The resident action.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object>} The resolved visitor log.
   */
  async resolveWalkInRequest(logId, action, actor, session = null) {
    const log = await visitorLogRepository.findById(logId, session);
    if (!log) {
      throw new HttpError(404, `Visitor log with ID ${logId} not found.`);
    }

    if (String(log.orgId) !== String(actor?.orgId)) {
      throw new HttpError(403, 'Forbidden. This request belongs to another community.');
    }
    if (log.logStatus !== 'PENDING') {
      throw new HttpError(400, `Visitor log with ID ${logId} is already resolved or not pending.`);
    }
    assertWalkInResolutionAccess(log, actor);

    let updateData = {};
    if (action === 'APPROVE') {
      updateData = {
        logStatus: 'INSIDE',
        checkInTime: new Date()
      };
    } else if (action === 'REJECT') {
      updateData = {
        logStatus: 'REJECTED'
      };
    } else {
      throw new HttpError(400, `Invalid action "${action}". Must be "APPROVE" or "REJECT".`);
    }

    const updatedLog = await visitorLogRepository.update(logId, {
      $set: updateData,
      $push: {
        actionHistory: {
          action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          actorId: getActorId(actor),
          occurredAt: new Date(),
        },
      },
    }, session);
    visitorLogEvents.emit('walk_in_resolved', updatedLog);
    return updatedLog;
  }

  /**
   * Record checkout for a visitor.
   * @param {string} logIdOrPassId - The visitor log ID or visitor pass ID.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object>} The checked out log.
   */
  async checkout(logIdOrPassId, actor, context = {}, session = null) {
    assertVisitorPermission(['gate', 'manager'], actor);
    let log = await visitorLogRepository.findById(logIdOrPassId, session);
    
    // If log not found by ID, it might be a pass ID from the admin screens, so check for active logs matching this passId
    if (!log) {
      log = await visitorLogRepository.findActiveLogByPassId(logIdOrPassId, session);
    }

    if (!log) {
      try {
        await visitorPassService.getPassById(logIdOrPassId);
      } catch (err) {
        // Ignore pass fetch errors and throw standard log not found error below
      }
      throw new HttpError(404, `Visitor log with ID ${logIdOrPassId} not found.`);
    }

    if (String(log.orgId) !== String(context.orgId)) {
      throw new HttpError(403, 'Forbidden. This entry belongs to another community.');
    }
    if (log.logStatus !== 'INSIDE') {
      throw new HttpError(400, `Visitor log with ID ${log._id} status is not INSIDE.`);
    }

    const updatedLog = await visitorLogRepository.updateLogForCheckout(
      log._id,
      new Date(),
      getActorId(actor),
      { gateName: context.gateName, reason: context.reason },
      session
    );
    
    // Update pass status to EXPIRED upon check-out if usage limit reached and no other visitors remain inside
    if (updatedLog.passId) {
      try {
        const pass = await visitorPassService.getPassById(updatedLog.passId, session);
        if (pass && (pass.status === 'ACTIVE' || pass.status === 'PENDING')) {
          const logsInside = await visitorLogRepository.findActiveLogsInside(log.orgId, null, session);
          const anyoneLeft = logsInside.some(l => 
            l.passId?.toString() === pass._id?.toString() && 
            l._id?.toString() !== log._id.toString()
          );
          if (!anyoneLeft && (pass.usageLimit?.currentUses >= pass.usageLimit?.maxUses)) {
            await visitorPassService.updatePassStatus(pass._id, 'EXPIRED', session, { actorId: getActorId(actor) });
            await visitorPassTokenService.deleteTokenByPassId(pass._id, session);
          }
        }
      } catch (err) {
        console.error('Failed to update pass status on checkout:', err);
      }
    }

    visitorLogEvents.emit('log_checked_out', updatedLog);
    return updatedLog;
  }

  /**
   * Fetch active logs for visitors currently inside the premises.
   * @param {string} orgId - The organization ID.
   * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
   * @returns {Promise<Object[]>}
   */
  async getActiveLogsInside(orgId, actor, session = null) {
    assertVisitorPermission(['resident', 'gate', 'manager'], actor);
    const residentId = isGateOperator(actor) || isVisitorManager(actor) ? null : getActorId(actor);
    return visitorLogRepository.findActiveLogsInside(orgId, residentId, session);
  }

  /**
   * Fetch pending walk-in log approvals.
   * @param {string} orgId - The organization ID.
   * @param {string|null} residentId - Optional resident ID to filter by.
   * @returns {Promise<Object[]>}
   */
  /**
   * Walk-in requests raised since `since`, in every status, for the gate's walk-in board.
   * @param {string} orgId - The organization ID.
   * @param {Object} actor - The requesting user.
   * @param {Date} since - Lower bound on request time.
   * @returns {Promise<Object[]>}
   */
  async getWalkInBoard(orgId, actor, since) {
    assertVisitorPermission(['gate', 'manager'], actor);
    return await visitorLogRepository.findPendingApprovals({
      orgId,
      entryType: 'WALK_IN',
      createdAt: { $gte: since },
    });
  }

  async getPendingApprovals(orgId, actor) {
    assertVisitorPermission(['resident', 'gate', 'manager'], actor);
    const query = {
      orgId,
      logStatus: 'PENDING'
    };
    if (!isGateOperator(actor) && !isVisitorManager(actor)) {
      query.residentId = getActorId(actor);
    }
    return await visitorLogRepository.findPendingApprovals(query);
  }

  /**
   * Fetch paginated visitor logs history in an organization.
   * @param {string} orgId - The organization ID.
   * @param {number} skip - Number of items to skip.
   * @param {number} limit - Number of items to return.
   * @param {Object} [filters={}] - Optional filters.
   * @param {import('mongoose').ClientSession} [session=null] - Optional Mongoose session.
   * @returns {Promise<{ data: Object[], totalRecords: number }>}
   */
  async getHistoryLogs(orgId, skip, limit, filters = {}, actor, session = null) {
    assertVisitorPermission(['resident', 'gate', 'manager'], actor);
    const scopedFilters = { ...filters };
    if (!isGateOperator(actor) && !isVisitorManager(actor)) {
      scopedFilters.residentId = getActorId(actor);
    }
    return visitorLogRepository.findHistoryLogsByOrg(orgId, skip, limit, scopedFilters, session);
  }
}

export default new VisitorLogService();
