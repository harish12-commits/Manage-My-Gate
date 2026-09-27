import visitorLogService from './visitorLog.service.js';
import visitorPassTokenService from '../visitorPassToken/visitorPassToken.service.js';
import HttpError from '../../utils/httpError.utils.js';
import { assertVisitorPermission } from '../visitorPass/visitorPass.policy.js';

export class VisitorLogController {
  /**
   * Log entry for a pre-approved visitor pass.
   */
  async logPreApproved(req, res, next) {
    try {
      let { passId, code } = req.body;
      if (!passId && code) {
        passId = await visitorPassTokenService.getPassIdByCode(code, null, req.tenant.orgId);
      }
      const data = await visitorLogService.logPreApprovedEntry(passId, req.user, {
        orgId: req.tenant.orgId,
        gateName: req.body.gateName,
      });
      res.success(data, 'Pre-approved visitor check-in logged successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Initiate a walk-in check-in request.
   */
  async initiateWalkIn(req, res, next) {
    try {
      assertVisitorPermission(['gate', 'manager'], req.user);
      let residentId = req.body.residentId;
      if (residentId && !/^[0-9a-fA-F]{24}$/.test(residentId)) {
        residentId = undefined;
      }
      const data = await visitorLogService.initiateWalkInRequest({
        ...req.body,
        orgId: req.tenant.orgId,
        ...(residentId ? { residentId } : {}),
      }, req.user);
      res.success(data, 'Walk-in visitor check-in request initiated', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resolve a pending walk-in check-in request.
   */
  async resolveWalkIn(req, res, next) {
    try {
      const { id } = req.params;
      const { action } = req.body;
      const data = await visitorLogService.resolveWalkInRequest(id, action, req.user);
      res.success(data, `Walk-in visitor check-in request resolved as ${action} successfully`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Record visitor checkout.
   */
  async checkout(req, res, next) {
    try {
      const { id } = req.params;
      const data = await visitorLogService.checkout(id, req.user, { orgId: req.tenant.orgId, gateName: req.body.gateName });
      res.success(data, 'Visitor checked out successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get active entry logs (visitors currently inside).
   */
  async getInside(req, res, next) {
    try {
      const orgId = req.params.orgId || req.tenant?.orgId;
      if (!req.tenant?.isPlatform && req.tenant?.orgId && String(req.tenant.orgId) !== String(orgId)) {
        throw new HttpError(403, 'Forbidden. Active workspace context does not match the requested organization.');
      }
      const data = await visitorLogService.getActiveLogsInside(orgId, req.user);
      res.success(data, 'Active logs retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pending walk-in check-in requests.
   */
  async getPending(req, res, next) {
    try {
      const { orgId } = req.params;
      if (!req.tenant?.isPlatform && req.tenant?.orgId && String(req.tenant.orgId) !== String(orgId)) {
        throw new HttpError(403, 'Forbidden. Active workspace context does not match the requested organization.');
      }
      const data = await visitorLogService.getPendingApprovals(orgId, req.user);
      res.success(data, 'Pending approvals retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get paginated visitor logs history for an organization.
   */
  async getHistory(req, res, next) {
    try {
      const { orgId } = req.params;
      if (!req.tenant?.isPlatform && req.tenant?.orgId && String(req.tenant.orgId) !== String(orgId)) {
        throw new HttpError(403, 'Forbidden. Active workspace context does not match the requested organization.');
      }
      const skip = parseInt(req.query.skip, 10) || 0;
      const limit = parseInt(req.query.limit, 10) || 10;
      
      const filter = {};
      if (req.query.status && req.query.status !== 'all') {
        filter.logStatus = req.query.status.toUpperCase();
      }
      if (req.query.entryType && req.query.entryType !== 'all') {
        filter.entryType = req.query.entryType.toUpperCase();
      }
      
      const data = await visitorLogService.getHistoryLogs(orgId, skip, limit, filter, req.user);
      res.success(data, 'Visitor logs history retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new VisitorLogController();
