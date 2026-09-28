import amenityReservationService from './amenityReservation.service.js';
import amenityIdempotencyService from '../idempotency/amenityIdempotencyRecord.service.js';
import HttpError from '../../../utils/httpError.utils.js';
import { hasAmenityAdminScope } from '../domain/access/amenityAdminScope.js';

const checkAmenityAdminScope = (user, requiredPermissions) => hasAmenityAdminScope(user, requiredPermissions);

export class AmenityReservationController {
  /**
   * Promotes an active hold into a confirmed or pending-approval reservation.
   */
  async confirm(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const residentId = req.user.id || req.user._id;
      const unitId = req.user.villaId || req.user.unitId || req.user.id || req.user._id;
      const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];

      const confirmParams = {
        holdId: req.body.holdId,
        orgId,
        residentId,
        unitId,
        paymentMethod: req.body.paymentMethod,
        paymentId: req.body.paymentId,
        notes: req.body.notes,
      };

      if (idempotencyKey) {
        const idempResult = await amenityIdempotencyService.executeWithIdempotency(
          {
            orgId,
            idempotencyKey,
            requestPayload: req.body,
          },
          async () => {
            const result = await amenityReservationService.confirmReservationFromHold(confirmParams);
            return { statusCode: 201, body: result };
          }
        );
        return res.success(idempResult.body, 'Reservation confirmed successfully', idempResult.statusCode);
      }

      const result = await amenityReservationService.confirmReservationFromHold(confirmParams);
      return res.success(result, 'Reservation confirmed successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Cancels an existing reservation.
   */
  async cancel(req, res, next) {
    try {
      const { reservationId } = req.params;
      const orgId = req.tenant.orgId;
      const userId = req.user.id || req.user._id;
      const hasAdminScope = await checkAmenityAdminScope(req.user, ['amenities:admin_calander', 'amenities:manage_bookings']);
      const { reason } = req.body;

      const reservation = await amenityReservationService.getReservationById(reservationId);
      if (!reservation || reservation.orgId.toString() !== orgId.toString()) {
        throw new HttpError(404, 'Reservation not found');
      }

      const isAuthorized = await amenityReservationService.canUserAccessReservation(req.user, reservation);
      if (!isAuthorized) {
        throw new HttpError(403, 'Forbidden. You do not have permission to cancel this reservation.');
      }

      // Staff cancelling another resident's booking is a management cancellation (full
      // refund, not subject to the resident cancellation policy).
      const bookedBy = reservation.residentId?._id || reservation.residentId;
      const isManagementCancellation = hasAdminScope && String(bookedBy) !== String(userId);

      const result = await amenityReservationService.cancelReservation({
        reservationId,
        orgId,
        residentId: bookedBy,
        cancelledBy: userId,
        cancellationReason: reason,
        isManagementCancellation,
      });

      return res.success(result, 'Reservation cancelled successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Maker-checker review (Approve / Reject) an event reservation.
   */
  async review(req, res, next) {
    try {
      const { reservationId } = req.params;
      const orgId = req.tenant.orgId;
      const reviewerId = req.user.id || req.user._id;
      const { action, rejectionReason, notes } = req.body;

      const normalizedAction =
        action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : action;

      const result = await amenityReservationService.reviewEventReservation({
        reservationId,
        orgId,
        adminUserId: reviewerId,
        action: normalizedAction,
        notes: notes || rejectionReason,
      });

      return res.success(result.reservation || result, `Event reservation ${action.toLowerCase()}d successfully`);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Lists reservations with pagination, search, and multidimensional filters.
   */
  async getAll(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const page = Number(req.query.page) || 1;
      const limit = Math.min(100, Number(req.query.limit) || 10);

      // Check if user is administrative or resident-restricted
      const hasAdminScope = await checkAmenityAdminScope(req.user, ['amenities:admin_calander', 'amenities:manage_bookings']);
      let effectiveResidentId = req.query.residentId;
      if (!hasAdminScope) {
        effectiveResidentId = req.user.id || req.user._id;
      }

      const result = await amenityReservationService.listReservations({
        orgId,
        page,
        limit,
        facilityId: req.query.facilityId,
        resourceId: req.query.resourceId,
        residentId: effectiveResidentId,
        unitId: req.query.unitId,
        bookingStatus: req.query.bookingStatus,
        paymentStatus: req.query.paymentStatus,
        approvalStatus: req.query.approvalStatus,
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        search: req.query.search,
      });

      return res.success(result, 'Reservations retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Retrieves single reservation by ID within organization and ownership boundaries.
   */
  async getById(req, res, next) {
    try {
      const { reservationId } = req.params;
      const orgId = req.tenant.orgId;

      const reservation = await amenityReservationService.getReservationById(reservationId);
      if (!reservation || reservation.orgId.toString() !== orgId.toString()) {
        throw new HttpError(404, 'Reservation not found');
      }

      const isAuthorized = await amenityReservationService.canUserAccessReservation(req.user, reservation);
      if (!isAuthorized) {
        throw new HttpError(403, 'Forbidden. You do not have permission to view this reservation.');
      }

      return res.success(reservation, 'Reservation retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Retrieves single reservation by tenant-scoped sequential reservation number.
   */
  async getByNumber(req, res, next) {
    try {
      const { reservationNumber } = req.params;
      const orgId = req.tenant.orgId;

      const reservation = await amenityReservationService.getReservationByNumber(orgId, reservationNumber);
      if (!reservation) {
        throw new HttpError(404, 'Reservation not found');
      }

      const isAuthorized = await amenityReservationService.canUserAccessReservation(req.user, reservation);
      if (!isAuthorized) {
        throw new HttpError(403, 'Forbidden. You do not have permission to view this reservation.');
      }

      return res.success(reservation, 'Reservation retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
}

export const amenityReservationController = new AmenityReservationController();
export default amenityReservationController;
