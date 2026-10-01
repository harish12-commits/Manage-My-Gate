import { getIO } from '../../config/socket.js';
import roleEvents from './role.events.js';
import logger from '../../utils/logger.utils.js';

/**
 * Initializes socket event listeners for Role-related events.
 * Listens to internal Node EventEmitter and dispatches to connected WebSocket clients.
 */
export const initRoleSocket = () => {
  roleEvents.on('rolePermissionsUpdated', async (payload) => {
    try {
      const { roleId } = payload;
      const roleService = (await import('./role.services.js')).default;
      const role = await roleService.getRoleById(roleId);
      
      if (!role) return;

      const io = getIO();
      let updatedPermissions = payload.permissions;
      if (!updatedPermissions || !Array.isArray(updatedPermissions)) {
        const perms = await roleService.getRolePermissions(roleId);
        updatedPermissions = perms.map((p) => p.name || p);
      }
      const socketPayload = {
        roleId: role._id.toString(),
        roleName: role.name,
        permissions: updatedPermissions,
        isTenantRole: role.isTenantRole || false,
      };

      // Emit to organization room if present, otherwise broadcast to active sockets
      if (role.orgId) {
        const roomName = `org:${role.orgId.toString()}`;
        io.to(roomName).emit('ROLE_UPDATED', socketPayload);
        io.to(roomName).emit('RECORD_UPDATED', { type: 'ROLE', action: 'UPDATE', data: socketPayload });
      }
      
      // Also broadcast to all connected clients for instant real-time sync
      io.emit('ROLE_UPDATED', socketPayload);
      io.emit('RECORD_UPDATED', { type: 'ROLE', action: 'UPDATE', data: socketPayload });

      logger.info(`Socket emitted ROLE_UPDATED for role: ${role.name} with ${updatedPermissions.length} permissions`);
    } catch (error) {
      logger.error('Failed to emit ROLE_UPDATED socket event:', error);
    }
  });
};

export default initRoleSocket;
