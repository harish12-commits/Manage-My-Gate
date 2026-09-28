import securityLogService from '../../securityLog/securityLog.services.js';
import logger from '../../../utils/logger.utils.js';

const idOf = (ref) => (ref && typeof ref === 'object' && ref._id ? ref._id : ref) || undefined;

/**
 * Records a gate scan of an amenity pass in the community's security log (the same log
 * the guard console and admins read). The log is an audit trail: a failure to write it
 * never blocks the scan itself.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {'Entry'|'Exit'|'Denied'} params.scanType
 * @param {Object} [params.reservation] - V2 reservation (facility and resident may be populated)
 * @param {Object} [params.resident] - { id, name, photoUrl } when already resolved
 * @param {Object} [params.guard] - { id, name }
 * @param {string} [params.reason]
 * @param {string} [params.remarks]
 */
export const logGateScan = async ({ orgId, scanType, reservation = null, resident = null, guard = null, reason, remarks }) => {
  try {
    const facility = reservation?.facilityId && typeof reservation.facilityId === 'object' ? reservation.facilityId : null;
    const residentDoc = reservation?.residentId && typeof reservation.residentId === 'object' ? reservation.residentId : null;
    await securityLogService.createLog({
      orgId,
      booking: reservation
        ? {
            _id: reservation._id,
            orgId: reservation.orgId,
            bookingId: reservation.reservationNumber,
            userId: {
              _id: resident?.id || idOf(reservation.residentId),
              name: resident?.name || residentDoc?.name || residentDoc?.fullName || residentDoc?.username,
              profilePicture: resident?.photoUrl || undefined,
            },
            amenityId: { _id: idOf(reservation.facilityId), name: facility?.name, images: facility?.images },
          }
        : undefined,
      guardId: guard?.id,
      guardName: guard?.name,
      scanType,
      status: scanType === 'Denied' ? 'Denied' : 'Success',
      reason,
      remarks,
    });
  } catch (err) {
    logger.warn('[AmenityGate] Could not write the security log', { scanType, error: err.message });
  }
};

export default logGateScan;
