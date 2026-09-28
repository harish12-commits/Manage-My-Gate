import { EventEmitter } from 'events';
import amenityManagementSocket from './amenityManagement.socket.js';

export const AMENITY_EVENTS = {
  HOLD_CREATED: 'amenity:hold:created',
  HOLD_EXPIRED: 'amenity:hold:expired',
  RESERVATION_CONFIRMED: 'amenity:reservation:confirmed',
  RESERVATION_CANCELLED: 'amenity:reservation:cancelled',
  RESERVATION_UPDATED: 'amenity:reservation:updated',
  GATE_PASS_ISSUED: 'amenity:pass:issued',
  APPROVAL_REQUESTED: 'amenity:approval:requested',
  MAINTENANCE_SCHEDULED: 'amenity:maintenance:scheduled',
  RECURRING_MAINTENANCE_SCHEDULED: 'amenity:maintenance:recurring_scheduled',
  MAINTENANCE_EXTENDED: 'amenity:maintenance:extended',
  MAINTENANCE_COMPLETED: 'amenity:maintenance:completed',
  MAINTENANCE_CANCELLED: 'amenity:maintenance:cancelled',
  MAINTENANCE_DELETED: 'amenity:maintenance:deleted',
  REFUND_DISPATCH_REQUIRED: 'amenity:refund:required',
  FACILITY_CREATED: 'amenity:facility:created',
  FACILITY_PUBLISHED: 'amenity:facility:published',
  FACILITY_DEACTIVATED: 'amenity:facility:deactivated',
  RESERVATION_CANCELLED_BY_ADMIN: 'amenity:reservation:cancelled_by_admin',
  REFUND_REQUESTED: 'amenity:refund:requested',
};

class AmenityManagementEvents extends EventEmitter {}

export const amenityManagementEvents = new AmenityManagementEvents();

// Register real-time socket delivery listeners
amenityManagementEvents.on(AMENITY_EVENTS.HOLD_CREATED, (payload) => {
  amenityManagementSocket.dispatchHoldEvent(payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.HOLD_EXPIRED, (payload) => {
  amenityManagementSocket.dispatchHoldEvent(payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.RESERVATION_CONFIRMED, (payload) => {
  amenityManagementSocket.dispatchReservationEvent('RESERVATION_CONFIRMED', payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.RESERVATION_CANCELLED, (payload) => {
  amenityManagementSocket.dispatchReservationEvent('RESERVATION_CANCELLED', payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.RESERVATION_UPDATED, (payload) => {
  amenityManagementSocket.dispatchReservationEvent('RESERVATION_UPDATED', payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.APPROVAL_REQUESTED, (payload) => {
  amenityManagementSocket.dispatchReservationEvent('APPROVAL_REQUESTED', payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.GATE_PASS_ISSUED, (payload) => {
  amenityManagementSocket.dispatchPassEvent(payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.MAINTENANCE_SCHEDULED, (payload) => {
  amenityManagementSocket.dispatchMaintenanceEvent(payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.RECURRING_MAINTENANCE_SCHEDULED, (payload) => {
  amenityManagementSocket.dispatchMaintenanceEvent(payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.MAINTENANCE_EXTENDED, (payload) => {
  amenityManagementSocket.dispatchMaintenanceEvent(payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.MAINTENANCE_COMPLETED, (payload) => {
  amenityManagementSocket.dispatchMaintenanceEvent(payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.MAINTENANCE_CANCELLED, (payload) => {
  amenityManagementSocket.dispatchMaintenanceEvent(payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.MAINTENANCE_DELETED, (payload) => {
  amenityManagementSocket.dispatchMaintenanceEvent({ ...payload, status: 'CANCELLED' });
});

amenityManagementEvents.on(AMENITY_EVENTS.FACILITY_CREATED, (payload) => {
  amenityManagementSocket.dispatchFacilityEvent('AMENITY_CREATED', payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.FACILITY_PUBLISHED, (payload) => {
  amenityManagementSocket.dispatchFacilityEvent('AMENITY_UPDATED', payload);
});

amenityManagementEvents.on(AMENITY_EVENTS.FACILITY_DEACTIVATED, (payload) => {
  amenityManagementSocket.dispatchFacilityEvent('AMENITY_UPDATED', payload);
});

export default amenityManagementEvents;
