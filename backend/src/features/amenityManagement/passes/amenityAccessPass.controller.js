import amenityAccessPassService from './amenityAccessPass.service.js';
import amenityReservationService from '../reservations/amenityReservation.service.js';
import HttpError from '../../../utils/httpError.utils.js';
import { hasAmenityAdminScope } from '../domain/access/amenityAdminScope.js';

const checkAmenityAdminScope = (user, requiredPermissions) => hasAmenityAdminScope(user, requiredPermissions);

export class AmenityAccessPassController {
  /**
   * Turnstile or guard QR check-in validation.
   */
  async checkIn(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const { rawToken, gateId } = req.body;
      const guardId = req.user?.id || req.user?._id;

      const result = await amenityAccessPassService.validateAndRecordCheckIn({
        orgId,
        rawToken,
        gateId,
        guardId,
      });

      return res.success(result, 'Check-in validated and recorded successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Check-out and physical asset inspection.
   */
  async checkOut(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const { rawToken, inspectionDetails } = req.body;

      const result = await amenityAccessPassService.recordCheckOut({
        orgId,
        rawToken,
        inspectionDetails,
        guardId: req.user?.id || req.user?._id,
      });

      return res.success(result, 'Check-out recorded successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Retrieves passes associated with a reservation with tenant and ownership verification.
   */
  async getByReservation(req, res, next) {
    try {
      const { reservationId } = req.params;
      const orgId = req.tenant.orgId;
      const userId = req.user.id || req.user._id;
      const hasAdminScope = await checkAmenityAdminScope(req.user, ['amenities:admin_calander', 'amenities:manage_bookings', 'amenities:scanner']);

      const reservation = await amenityReservationService.getReservationById(reservationId);
      if (!reservation || reservation.orgId.toString() !== orgId.toString()) {
        throw new HttpError(404, 'Reservation not found');
      }

      const isAuthorized = await amenityReservationService.canUserAccessReservation(req.user, reservation);
      if (!isAuthorized) {
        throw new HttpError(403, 'Forbidden. You do not have permission to view passes for this reservation.');
      }

      const passes = await amenityAccessPassService.getPassesByReservationId(reservationId);
      return res.success(passes, 'Access passes retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Administrative pass revocation.
   */
  async revoke(req, res, next) {
    try {
      const { passId } = req.params;
      const orgId = req.tenant.orgId;
      const { reason } = req.body;

      const result = await amenityAccessPassService.revokePass(passId, orgId, reason);
      return res.success(result, 'Access pass revoked successfully');
    } catch (error) {
      return next(error);
    }
  }
}

export const amenityAccessPassController = new AmenityAccessPassController();
export default amenityAccessPassController;
