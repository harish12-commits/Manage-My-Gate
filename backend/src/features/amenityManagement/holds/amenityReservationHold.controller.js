import amenityReservationHoldService from './amenityReservationHold.service.js';
import amenityIdempotencyService from '../idempotency/amenityIdempotencyRecord.service.js';
import HttpError from '../../../utils/httpError.utils.js';
import { hasAmenityAdminScope } from '../domain/access/amenityAdminScope.js';

const checkAmenityAdminScope = (user, requiredPermissions) => hasAmenityAdminScope(user, requiredPermissions);

export class AmenityReservationHoldController {
  /**
   * Creates an ephemeral reservation hold.
   */
  async create(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const residentId = req.user.id || req.user._id;
      const hasAdminScope = await checkAmenityAdminScope(req.user, ['amenities:admin_calander', 'amenities:manage_bookings']);
      const unitId = (!hasAdminScope && (req.user.villaId || req.user.unitId)) ? (req.user.villaId || req.user.unitId) : (req.body.unitId || req.user.villaId || req.user.unitId || req.user.id);
      const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];

      const holdParams = {
        facilityId: req.body.facilityId,
        resourceId: req.body.resourceId,
        requestedStartDateTime: req.body.requestedStartDateTime,
        requestedEndDateTime: req.body.requestedEndDateTime,
        headcount: req.body.headcount,
        quantity: req.body.quantity,
        holdType: req.body.holdType,
        quotaLimit: req.body.quotaLimit,
        orgId,
        residentId,
        unitId,
      };

      if (idempotencyKey) {
        const idempResult = await amenityIdempotencyService.executeWithIdempotency(
          {
            orgId,
            idempotencyKey,
            requestPayload: req.body,
          },
          async () => {
            const result = await amenityReservationHoldService.createStandardHold(holdParams);
            return { statusCode: 201, body: result };
          }
        );
        return res.success(idempResult.body, 'Reservation hold created successfully', idempResult.statusCode);
      }

      const result = await amenityReservationHoldService.createStandardHold(holdParams);
      return res.success(result, 'Reservation hold created successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Retrieves single hold by ID with tenant and ownership verification.
   */
  async getById(req, res, next) {
    try {
      const { holdId } = req.params;
      const orgId = req.tenant.orgId;
      const userId = req.user.id || req.user._id;
      const hasAdminScope = await checkAmenityAdminScope(req.user, ['amenities:admin_calander', 'amenities:manage_bookings']);
      const hold = await amenityReservationHoldService.getHoldById(holdId);

      if (!hold) {
        throw new HttpError(404, 'Reservation hold not found');
      }

      if (hold.orgId.toString() !== orgId.toString()) {
        throw new HttpError(403, 'Forbidden. Reservation hold does not belong to this organization.');
      }

      const holdResidentId = (hold.residentId?._id || hold.residentId)?.toString();
      if (!hasAdminScope && holdResidentId !== userId.toString()) {
        throw new HttpError(403, 'Forbidden. You do not have permission to view this hold.');
      }

      return res.success(hold, 'Reservation hold retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Explicitly expires an active hold early with tenant and ownership verification.
   */
  async expire(req, res, next) {
    try {
      const { holdId } = req.params;
      const orgId = req.tenant.orgId;
      const userId = req.user.id || req.user._id;
      const hasAdminScope = await checkAmenityAdminScope(req.user, ['amenities:admin_calander', 'amenities:manage_bookings']);

      const hold = await amenityReservationHoldService.getHoldById(holdId);
      if (!hold) {
        throw new HttpError(404, 'Reservation hold not found');
      }

      if (hold.orgId.toString() !== orgId.toString()) {
        throw new HttpError(403, 'Forbidden. Reservation hold does not belong to this organization.');
      }

      const holdResidentId = (hold.residentId?._id || hold.residentId)?.toString();
      if (!hasAdminScope && holdResidentId !== userId.toString()) {
        throw new HttpError(403, 'Forbidden. You do not have permission to release this hold.');
      }

      const result = await amenityReservationHoldService.expireHold(holdId);
      return res.success(result, 'Reservation hold expired successfully');
    } catch (error) {
      return next(error);
    }
  }
}

export const amenityReservationHoldController = new AmenityReservationHoldController();
export default amenityReservationHoldController;
