import visitorPassService from './visitorPass.service.js';
import visitorPassTokenService from '../visitorPassToken/visitorPassToken.service.js';
import HttpError from '../../utils/httpError.utils.js';
import {
  assertPassAccess,
  assertResidentOwnsVilla,
  assertVisitorPermission,
  getActorId,
  isVisitorManager,
} from './visitorPass.policy.js';

export class VisitorPassController {
  /**
   * Create a new VisitorPass.
   */
  async create(req, res, next) {
    try {
      assertVisitorPermission(['resident', 'manager'], req.user);
      if (req.body.orgId && String(req.body.orgId) !== String(req.tenant.orgId)) {
        throw new HttpError(403, 'Forbidden. Passes must be created in the active community.');
      }
      if (!isVisitorManager(req.user)) {
        assertResidentOwnsVilla(req.tenantMembership, req.body.villaId);
      }
      const createdById = getActorId(req.user);
      const data = await visitorPassService.createPass({
        ...req.body,
        orgId: req.tenant.orgId,
        createdById,
      });
      res.success(data, 'Visitor pass created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a VisitorPass by ID.
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const data = await visitorPassService.getPassById(id);
      if (String(data.orgId) !== String(req.tenant.orgId)) {
        throw new HttpError(403, 'Forbidden. This pass belongs to another community.');
      }
      assertPassAccess(data, req.user);
      res.success(data, 'Visitor pass retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update the status of a VisitorPass (e.g. revoke or set to other status).
   */
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const existing = await visitorPassService.getPassById(id);
      if (String(existing.orgId) !== String(req.tenant.orgId)) {
        throw new HttpError(403, 'Forbidden. This pass belongs to another community.');
      }
      assertPassAccess(existing, req.user);
      // Gate staff may read any pass to verify it, but only its owner or a manager may change it.
      const isOwner = String(existing.createdById?._id || existing.createdById) === String(getActorId(req.user));
      if (!isOwner && !isVisitorManager(req.user)) {
        throw new HttpError(403, 'Forbidden. Only the resident who issued this pass or a community manager can change it.');
      }
      let data;
      if (status === 'REVOKED') {
        data = await visitorPassService.revokePass(id, null, { actorId: getActorId(req.user), reason: req.body.reason });
      } else {
        if (!isVisitorManager(req.user)) {
          throw new HttpError(403, 'Forbidden. Only community managers can set a pass status other than revoked.');
        }
        data = await visitorPassService.updatePassStatus(id, status, null, { actorId: getActorId(req.user), reason: req.body.reason });
      }

      res.success(data, `Visitor pass status updated to ${status} successfully`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieve paginated passes for an organization with full multi-filtering.
   */
  async getByOrgPaginated(req, res, next) {
    try {
      assertVisitorPermission(['resident', 'gate', 'manager'], req.user);
      const { orgId } = req.params;
      if (!req.tenant?.isPlatform && req.tenant?.orgId && String(req.tenant.orgId) !== String(orgId)) {
        throw new HttpError(403, 'Forbidden. Active workspace context does not match the requested community.');
      }
      const skip = parseInt(req.query.skip, 10) || 0;
      const limit = parseInt(req.query.limit, 10) || 10;
      const search = req.query.search;
      const villaId = req.query.villaId;
      const scope = req.query.scope; // 'COMMUNITY' or 'ALL'
      
      let statuses = ['PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED'];
      if (req.query.statuses) {
        statuses = req.query.statuses.split(',').map(s => s.trim().toUpperCase());
      } else if (req.query.status && req.query.status.toUpperCase() !== 'ALL') {
        statuses = [req.query.status.toUpperCase()];
      }

      const data = await visitorPassService.getActivePasses(orgId, {
        skip,
        limit,
        statuses,
        search,
        villaId,
        scope,
        ...(!isVisitorManager(req.user) ? { createdById: getActorId(req.user) } : {}),
      });
      res.success(data, 'Visitor passes retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
  /**
   * Retrieve a VisitorPass by its short code.
   */
  async getByCode(req, res, next) {
    try {
      const { code } = req.params;
      let passId;
      try {
        passId = await visitorPassTokenService.getPassIdByCode(code, null, req.tenant.orgId);
      } catch (err) {
        if (/^[0-9a-fA-F]{24}$/.test(code)) {
          passId = code;
        } else {
          throw err;
        }
      }
      const data = await visitorPassService.getPassById(passId);
      if (String(data.orgId) !== String(req.tenant.orgId)) {
        throw new HttpError(403, 'Forbidden. This pass belongs to another community.');
      }
      assertPassAccess(data, req.user);
      res.success(data, 'Visitor pass retrieved by code successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieve the bearer-safe fields of a VisitorPass by its revocable short code.
   */
  async getPublicPass(req, res, next) {
    try {
      const token = req.params.token || req.params.code || req.params.id;
      let passId = null;
      try {
        passId = await visitorPassTokenService.getPassIdByCode(token);
      } catch (err) {
        // Do not fall back to a database ID: a public pass must use its revocable token.
      }
      if (!passId) {
        return res.status(404).json({ success: false, message: 'Visitor pass not found or expired' });
      }
      const data = await visitorPassService.getPassById(passId);
      res.success({
        _id: data._id,
        shortKey: token,
        passType: data.passType,
        status: data.status,
        purpose: data.purpose,
        visitorDetails: { name: data.visitorDetails?.name },
        vehicleDetails: { number: data.vehicleDetails?.number },
        validity: {
          startDate: data.validity?.startDate,
          endDate: data.validity?.endDate,
          timeWindowStart: data.validity?.timeWindowStart,
          timeWindowEnd: data.validity?.timeWindowEnd,
        },
      }, 'Public visitor pass retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new VisitorPassController();
