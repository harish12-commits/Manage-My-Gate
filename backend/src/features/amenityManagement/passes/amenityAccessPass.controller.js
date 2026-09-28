import amenityAccessPassService from './amenityAccessPass.service.js';
import amenityReservationService from '../reservations/amenityReservation.service.js';
import HttpError from '../../../utils/httpError.utils.js';
import { hasAmenityAdminScope } from '../domain/access/amenityAdminScope.js';
import { logGateScan } from './amenityGateLog.js';

const guardOf = (user) => ({ id: user?.id || user?._id, name: user?.name || user?.username || 'Security Guard' });

/** Best-effort: the booking a refused scan was for, so the denial is logged against it. */
const reservationForDeniedScan = async (orgId, rawToken, error) => {
  try {
    const reservationId = error?.details?.reservationId;
    if (reservationId) return await amenityReservationService.getReservationById(reservationId);
    const pass = await amenityAccessPassService._findPassForGate(orgId, rawToken);
    return pass ? await amenityReservationService.getReservationById(pass.reservationId) : null;
  } catch {
    return null;
  }
};

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

      let result;
      try {
        result = await amenityAccessPassService.validateAndRecordCheckIn({
          orgId,
          rawToken,
          gateId,
          guardId,
        });
      } catch (error) {
        // A pass that is inside is the start of an exit, not a refused entry.
        const isExitScan = error?.details?.code === 'ALREADY_CHECKED_IN' && error?.details?.canCheckOut;
        if (Number(error?.statusCode) < 500 && rawToken && !isExitScan) {
          // Looked up inside the guard's community only, so a foreign pass logs without a booking.
          const reservation = await reservationForDeniedScan(orgId, rawToken, error);
          await logGateScan({ orgId, scanType: 'Denied', reservation, guard: guardOf(req.user), reason: error.message, remarks: error.details?.code || null });
        }
        throw error;
      }

      if (result?.booking?.id) {
        const reservation = await amenityReservationService.getReservationById(result.booking.id);
        await logGateScan({
          orgId,
          scanType: 'Entry',
          reservation,
          resident: result.resident,
          guard: guardOf(req.user),
          reason: 'Valid amenity pass',
          remarks: 'Access granted',
        });
      }

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

      const reservation = result?.reservation?._id
        ? await amenityReservationService.getReservationById(result.reservation._id)
        : null;
      await logGateScan({
        orgId,
        scanType: 'Exit',
        reservation,
        guard: guardOf(req.user),
        reason: 'Exit recorded',
        remarks: result?.deposit?.retained > 0
          ? `₹${result.deposit.retained} kept from the deposit${inspectionDetails?.damageNotes ? `: ${inspectionDetails.damageNotes}` : ''}`
          : null,
      });

      return res.success({ ...result, reservation: reservation || result.reservation }, 'Check-out recorded successfully');
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
