import { getIO } from '../../config/socket.js';
import logger from '../../utils/logger.utils.js';

/** Room ids from a payload whose refs may be populated documents. */
const idOf = (ref) => (ref && typeof ref === 'object' && ref._id ? String(ref._id) : ref ? String(ref) : null);

/**
 * Socket.io Dispatcher for Amenity Management.
 * Decoupled from service business logic.
 * Safely executes socket emissions inside try/catch blocks.
 */
export class AmenityManagementSocket {
  /**
   * Dispatches hold lifecycle event to resident.
   * @param {Object} payload
   */
  dispatchHoldEvent(payload) {
    try {
      const io = getIO();
      if (!io) return;
      if (payload.residentId) {
        io.to(`user:${idOf(payload.residentId)}`).emit('AMENITY_HOLD_UPDATE', payload);
      }
      if (payload.orgId) {
        io.to(`org:${idOf(payload.orgId)}`).emit('AMENITY_HOLD_UPDATED', {
          holdId: payload.holdId,
          status: payload.status,
        });
      }
    } catch (err) {
      logger.warn('Failed to emit AMENITY_HOLD socket event:', { error: err.message });
    }
  }

  /**
   * Dispatches reservation confirmation, approval, or cancellation event.
   * @param {Object} payload
   */
  dispatchReservationEvent(eventType, payload) {
    try {
      const io = getIO();
      if (!io) return;
      if (payload.residentId) {
        io.to(`user:${idOf(payload.residentId)}`).emit(eventType, payload);
      }
      if (payload.orgId) {
        io.to(`org:${idOf(payload.orgId)}`).emit(eventType, {
          reservationId: idOf(payload._id || payload.reservationId),
          reservationNumber: payload.reservationNumber,
          bookingStatus: payload.bookingStatus,
        });
      }
    } catch (err) {
      logger.warn(`Failed to emit ${eventType} socket event:`, { error: err.message });
    }
  }

  /**
   * Dispatches gate pass issuance event.
   * @param {Object} payload
   */
  dispatchPassEvent(payload) {
    try {
      const io = getIO();
      if (!io) return;
      if (payload.residentId) {
        io.to(`user:${idOf(payload.residentId)}`).emit('GATE_PASS_ISSUED', payload);
      }
    } catch (err) {
      logger.warn('Failed to emit GATE_PASS_ISSUED socket event:', { error: err.message });
    }
  }

  /**
   * Dispatches maintenance scheduling event to organization.
   * @param {Object} payload
   */
  dispatchMaintenanceEvent(payload) {
    try {
      const io = getIO();
      if (!io) return;
      if (payload.orgId) {
        io.to(`org:${idOf(payload.orgId)}`).emit('MAINTENANCE_SCHEDULED', payload);
      }
    } catch (err) {
      logger.warn('Failed to emit MAINTENANCE_SCHEDULED socket event:', { error: err.message });
    }
  }

  /**
   * Dispatches facility lifecycle event to organization room.
   * @param {string} eventType ('AMENITY_CREATED' | 'AMENITY_UPDATED' | 'AMENITY_DELETED')
   * @param {Object} payload
   */
  dispatchFacilityEvent(eventType, payload) {
    try {
      const io = getIO();
      if (!io) return;
      if (payload.orgId) {
        io.to(`org:${idOf(payload.orgId)}`).emit(eventType, payload);
      }
    } catch (err) {
      logger.warn(`Failed to emit ${eventType} socket event:`, { error: err.message });
    }
  }
}

export const amenityManagementSocket = new AmenityManagementSocket();
export default amenityManagementSocket;
