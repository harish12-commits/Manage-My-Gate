import HttpError from '../../../utils/httpError.utils.js';
import amenityFacilityService from './amenityFacility.service.js';
import amenityIdempotencyService from '../idempotency/amenityIdempotencyRecord.service.js';
import { mapPermission } from '../../../utils/permissionMapper.js';

const isAdminUser = (user) => {
  if (!user) return false;
  const adminRoles = [
    'super admin',
    'platform super admin',
    'community admin',
    'admin',
    'superadmin',
    'facility manager',
    'super_admin',
    'platform_super_admin',
    'platform_admin',
    'community_admin',
    'facility_manager',
  ];
  const cleanRole = (r) => (r || '').toLowerCase().trim().replace(/[_-]/g, ' ');
  const userRole = cleanRole(user.role);
  const userRoles = Array.isArray(user.roles) ? user.roles.map(cleanRole) : [];
  return (
    adminRoles.some((ar) => cleanRole(ar) === userRole) ||
    userRoles.some((r) => adminRoles.some((ar) => cleanRole(ar) === r))
  );
};

export class AmenityFacilityController {
  /**
   * Creates a new amenity facility.
   */
  async create(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
      const { _id, orgId: bodyOrgId, concurrencyVersion, isDeleted, deletedAt, ...cleanBody } = req.body;
      const facilityData = { ...cleanBody, orgId };

      if (idempotencyKey) {
        const idempResult = await amenityIdempotencyService.executeWithIdempotency(
          {
            orgId,
            idempotencyKey,
            requestPayload: req.body,
          },
          async () => {
            const facility = await amenityFacilityService.createFacility(facilityData);
            return { statusCode: 201, body: facility };
          }
        );
        return res.success(idempResult.body, 'Amenity facility created successfully', idempResult.statusCode);
      }

      const facility = await amenityFacilityService.createFacility(facilityData);
      return res.success(facility, 'Amenity facility created successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Lists facilities with pagination and filters.
   */
  async getAll(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const page = Number(req.query.page) || 1;
      const limit = Math.min(100, Number(req.query.limit) || 10);
      const { search, archetype, isActive, status, isDraft } = req.query;
      let isAdmin = isAdminUser(req.user);

      if (!isAdmin && req.user) {
        try {
          // Tenant-resolved permissions only; grants held in other communities must not count.
          const permissions = Array.isArray(req.tenantPermissions) ? req.tenantPermissions : req.user.permissions || [];
          const userPermissions = permissions.map(mapPermission);
          if (
            userPermissions.includes('amenities:amenities') ||
            userPermissions.includes('amenities:create') ||
            userPermissions.includes('amenities:update') ||
            userPermissions.includes('amenities:manage_bookings')
          ) {
            isAdmin = true;
          }
        } catch (rbacErr) {
          // Gracefully fallback
        }
      }

      // Non-admins (residents, guests) can ONLY view published, active facilities
      const queryIsDraft = isAdmin
        ? (isDraft !== undefined ? isDraft === 'true' : undefined)
        : false;

      const queryIsActive = isAdmin
        ? (isActive !== undefined ? isActive === 'true' : undefined)
        : (isActive !== undefined ? isActive === 'true' : true);

      const queryStatus = isAdmin
        ? status
        : (status && status !== 'DRAFT' ? status : 'ACTIVE');

      const result = await amenityFacilityService.listFacilities({
        orgId,
        page,
        limit,
        search,
        archetype,
        status: queryStatus,
        isDraft: queryIsDraft,
        isActive: queryIsActive,
      });

      console.log(`[amenityFacility.getAll] tenant.orgId: "${orgId}", header.orgId: "${req.headers['x-organization-id']}", found: ${result?.data?.length}, total: ${result?.total}`);
      return res.success(result, 'Facilities retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Retrieves single facility by ID.
   * Draft facilities return 404 to non-admins (P0-2).
   */
  async getById(req, res, next) {
    try {
      const { facilityId } = req.params;
      const orgId = req.tenant.orgId;
      const facility = await amenityFacilityService.getFacilityById(facilityId, orgId);

      if (facility.isDraft && !isAdminUser(req.user)) {
        throw new HttpError(404, 'Facility not found');
      }

      return res.success(facility, 'Facility retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Retrieves single facility by code.
   * Draft facilities return 404 to non-admins (P0-2).
   */
  async getByCode(req, res, next) {
    try {
      const { code } = req.params;
      const orgId = req.tenant.orgId;
      const facility = await amenityFacilityService.getFacilityByCode(orgId, code);

      if (facility.isDraft && !isAdminUser(req.user)) {
        throw new HttpError(404, 'Facility not found');
      }

      return res.success(facility, 'Facility retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Updates an existing facility.
   * Forwards bookingAction and audit metadata.
   */
  async update(req, res, next) {
    try {
      const { facilityId } = req.params;
      const orgId = req.tenant.orgId;
      const { _id, orgId: bodyOrgId, concurrencyVersion, isDeleted, deletedAt, ...cleanBody } = req.body;
      const updateData = {
        ...cleanBody,
        cancelledBy: req.user?._id || req.user?.id,
      };
      const updated = await amenityFacilityService.updateFacility(facilityId, orgId, updateData);
      return res.success(updated, 'Facility updated successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Soft deletes a facility.
   */
  async delete(req, res, next) {
    try {
      const { facilityId } = req.params;
      const orgId = req.tenant.orgId;
      const deleted = await amenityFacilityService.softDeleteFacility(facilityId, orgId);
      return res.success(deleted, 'Facility deleted successfully');
    } catch (error) {
      return next(error);
    }
  }
}

export const amenityFacilityController = new AmenityFacilityController();
export default amenityFacilityController;
