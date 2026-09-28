import blacklistService from './blacklist.service.js';
import HttpError from '../../utils/httpError.utils.js';
import { assertVisitorPermission } from '../visitorPass/visitorPass.policy.js';

export class BlacklistController {
  /**
   * Block a profile.
   */
  async create(req, res, next) {
    try {
      assertVisitorPermission(['manager'], req.user);
      const { orgId, name, phone, plate, reason } = req.body;
      const targetOrgId = req.tenant?.orgId || orgId;
      if (!req.tenant?.isPlatform && req.tenant?.orgId && orgId && String(req.tenant.orgId) !== String(orgId)) {
        throw new HttpError(403, 'Forbidden. Active workspace context does not match the requested organization.');
      }
      const createdById = req.user?.id || req.body.createdById; // fallback if session inject is missing in test
      
      const data = await blacklistService.createBlacklistEntry({
        orgId: targetOrgId,
        name,
        phone,
        plate,
        reason,
        createdById
      });

      res.success(data, 'Visitor profile blocked successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unban/delete a block rule.
   */
  async delete(req, res, next) {
    try {
      assertVisitorPermission(['manager'], req.user);
      const { id } = req.params;
      const data = await blacklistService.removeBlacklistEntry(id, req.tenant.orgId);
      res.success(data, 'Blacklisted profile unbanned successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch paginated list of blocked records.
   */
  async getByOrgPaginated(req, res, next) {
    try {
      assertVisitorPermission(['gate', 'manager'], req.user);
      const { orgId } = req.params;
      if (!req.tenant?.isPlatform && req.tenant?.orgId && String(req.tenant.orgId) !== String(orgId)) {
        throw new HttpError(403, 'Forbidden. Active workspace context does not match the requested organization.');
      }
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      const { data, totalRecords } = await blacklistService.getBlacklistByOrg(orgId, skip, limit);
      res.success({ data, totalRecords }, 'Blacklisted records retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check if query details match a banned entry.
   */
  async checkMatch(req, res, next) {
    try {
      assertVisitorPermission(['gate', 'manager'], req.user);
      const { orgId } = req.params;
      if (!req.tenant?.isPlatform && req.tenant?.orgId && String(req.tenant.orgId) !== String(orgId)) {
        throw new HttpError(403, 'Forbidden. Active workspace context does not match the requested organization.');
      }
      const { name, phone, plate } = req.query;
      
      const match = await blacklistService.checkMatch(orgId, { name, phone, plate });
      
      res.success(match, 'Check match status executed successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new BlacklistController();
