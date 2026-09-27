import mongoose from 'mongoose';
import roleRepository from './role.repository.js';
import roleEvents from './role.events.js';
import HttpError from '../../utils/httpError.utils.js';

export class RoleService {
  async getAllRoles(orgId, page = 1, limit = 10) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const skip = (page - 1) * limit;
      const { data, totalRecords } = await roleRepository.findAllPaginated(orgId, skip, limit, session);
      await session.commitTransaction();
      const totalPages = Math.ceil(totalRecords / limit);
      return {
        data,
        pagination: {
          totalRecords,
          currentPage: page,
          totalPages: totalPages || 1,
          limit,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getRoleById(id, session) {
    const role = await roleRepository.findById(id, session);
    if (!role) {
      throw new HttpError(404, `Role with ID ${id} not found.`);
    }
    return role;
  }

  async getRoleByName(name, orgId = null, session = null) {
    return await roleRepository.findByName(name, orgId, session);
  }

  async createRole(roleData, session = null) {
    let localSession = null;
    if (!session) {
      localSession = await mongoose.startSession();
      localSession.startTransaction();
    }
    const currentSession = session || localSession;

    try {
      const { name, description, permissions, integrationMappings, orgId, isTenantRole } = roleData;
      const trimmedName = name ? name.trim() : '';
      if (!trimmedName) {
        throw new HttpError(400, 'Role name is required.');
      }
      const existingRole = await roleRepository.findByOrgAndName(trimmedName, orgId, currentSession);
      if (existingRole) {
        throw new HttpError(400, `Role with name '${trimmedName}' already exists.`);
      }
      const newRole = await roleRepository.create({ name: trimmedName, description, integrationMappings, orgId, isTenantRole }, currentSession);
      
      let populatedPermissions = [];
      if (permissions && permissions.length > 0) {
        const permissionService = (await import('../permission/permission.services.js')).default;
        const rolePermissionService = (await import('../rolePermission/rolePermission.services.js')).default;
        
        const allPermissions = await permissionService.getAllPermissions();
        const matchedPermissions = allPermissions.filter((p) => {
          const pId = p._id ? p._id.toString() : '';
          const pName = p.name ? p.name.trim() : '';
          const pCode = p.code ? p.code.trim() : '';
          const pNormalized = pName.replace(':', '.');

          return permissions.some((perm) => {
            if (!perm) return false;
            const strPerm = String(perm).trim();
            const permNormalized = strPerm.replace(':', '.');
            return (
              strPerm === pId ||
              strPerm === pName ||
              strPerm === pCode ||
              permNormalized === pNormalized
            );
          });
        });
        const permissionIds = matchedPermissions.map((p) => p._id);
        
        await rolePermissionService.updateRolePermissions(newRole._id.toString(), permissionIds, currentSession);
        populatedPermissions = matchedPermissions.map(p => p.name);
        // Emit event after role creation with permissions
        roleEvents.emit('rolePermissionsUpdated', { roleId: newRole._id.toString(), permissionIds });
      }
      
      if (localSession) {
        await localSession.commitTransaction();
      }
      return {
        ...newRole.toObject(),
        permissions: populatedPermissions
      };
    } catch (error) {
      if (localSession) {
        await localSession.abortTransaction();
      }
      throw error;
    } finally {
      if (localSession) {
        await localSession.endSession();
      }
    }
  }

  async updateRole(id, updateData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await this.getRoleById(id, session);
      const { name, description, permissions, integrationMappings, orgId, isTenantRole } = updateData;
      
      const roleUpdates = { description, integrationMappings };
      if (isTenantRole !== undefined) {
        roleUpdates.isTenantRole = isTenantRole;
      }
      if (name) {
        const trimmedName = name.trim();
        const existing = await roleRepository.findByOrgAndName(trimmedName, orgId, session);
        if (existing && existing._id.toString() !== id) {
          throw new HttpError(400, `Role with name '${trimmedName}' already exists.`);
        }
        roleUpdates.name = trimmedName;
      }
      const updatedRole = await roleRepository.update(id, roleUpdates, session);
      
      let populatedPermissions = [];
      const rolePermissionService = (await import('../rolePermission/rolePermission.services.js')).default;
      if (permissions !== undefined) {
        const permissionService = (await import('../permission/permission.services.js')).default;
        const allPermissions = await permissionService.getAllPermissions();
        const matchedPermissions = allPermissions.filter((p) => {
          const pId = p._id ? p._id.toString() : '';
          const pName = p.name ? p.name.trim() : '';
          const pCode = p.code ? p.code.trim() : '';
          const pNormalized = pName.replace(':', '.');

          return permissions.some((perm) => {
            if (!perm) return false;
            const strPerm = String(perm).trim();
            const permNormalized = strPerm.replace(':', '.');
            return (
              strPerm === pId ||
              strPerm === pName ||
              strPerm === pCode ||
              permNormalized === pNormalized
            );
          });
        });
        const permissionIds = matchedPermissions.map((p) => p._id);
        
        await rolePermissionService.updateRolePermissions(id, permissionIds, session);
        populatedPermissions = matchedPermissions.map(p => p.name);
        // Emit event after successful permission update
        roleEvents.emit('rolePermissionsUpdated', { roleId: id, permissionIds });
      } else {
        const permissionsList = await rolePermissionService.getPermissionsByRoleId(id);
        populatedPermissions = permissionsList.map(p => p.name);
      }
      
      await session.commitTransaction();
      return {
        ...updatedRole.toObject(),
        permissions: populatedPermissions
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async deleteRole(id) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await this.getRoleById(id, session);
      const deletedRole = await roleRepository.delete(id, session);
      
      const rolePermissionService = (await import('../rolePermission/rolePermission.services.js')).default;
      await rolePermissionService.updateRolePermissions(id, [], session);
      
      const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
      await orgMembershipService.clearRoleFromMemberships(id, session);
      
      await session.commitTransaction();
      return deletedRole;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async isConnectionInUse(connectionId) {
    if (!connectionId) {
      throw new HttpError(400, 'Connection ID is required.');
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const inUse = await roleRepository.isConnectionInUse(connectionId, session);
      await session.commitTransaction();
      return inUse;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getGroupedPermissions() {
    const permissionService = (await import('../permission/permission.services.js')).default;
    const permissions = await permissionService.getAllPermissions();
    const grouped = {};
    permissions.forEach((perm) => {
      let feature = perm.feature || 'other';
      if (feature.toLowerCase() === 'billing' && perm.action === 'action_center') {
        feature = 'digital_wallet';
      }
      const category = feature.charAt(0).toUpperCase() + feature.slice(1);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push({
        _id: perm._id,
        name: perm.name,
        feature: perm.feature,
        action: perm.action,
      });
    });
    return grouped;
  }

  async getRolePermissions(roleId) {
    await this.getRoleById(roleId);
    const rolePermissionService = (await import('../rolePermission/rolePermission.services.js')).default;
    return await rolePermissionService.getPermissionsByRoleId(roleId);
  }

  async syncRolePermissions(roleId, permissionNames) {
    await this.getRoleById(roleId);
    
    let permissionIds = [];
    if (permissionNames && permissionNames.length > 0) {
      const permissionService = (await import('../permission/permission.services.js')).default;
      const allPermissions = await permissionService.getAllPermissions();
      const matchedPermissions = allPermissions.filter(p => permissionNames.includes(p.name) || permissionNames.includes(p._id.toString()));
      permissionIds = matchedPermissions.map(p => p._id);
    }
    
    const rolePermissionService = (await import('../rolePermission/rolePermission.services.js')).default;
    await rolePermissionService.updateRolePermissions(roleId, permissionIds);
    roleEvents.emit('rolePermissionsUpdated', { roleId, permissionIds });
    return await rolePermissionService.getPermissionsByRoleId(roleId);
  }

  async getRolesByIds(ids, session = null) {
    const Role = (await import('./role.model.js')).default;
    return await Role.find({ _id: { $in: ids } }).session(session);
  }
}

export default new RoleService();
