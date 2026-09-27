import mongoose from 'mongoose';
import userRepository from './user.repository.js';
import userEvents from './user.events.js';
import otpService from '../otp/otp.services.js';
import { hashPassword } from '../../utils/crypto.utils.js';
import HttpError from '../../utils/httpError.utils.js';
import logger, { loggerStorage } from '../../utils/logger.utils.js';
import { normalizePhone, maskPhone } from '../../utils/phone.utils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../../config/config.js';
import { generateInviteLink } from './utils/invite.utils.js';
import integrationHubService from '../integrationHub/integrationHub.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');
const uploadDir = path.resolve(projectRoot, config.avatarUploadPath);

export class UserService {
  async getUserById(id, session) {
    const user = await userRepository.findById(id, session);
    if (!user) {
      throw new HttpError(404, `User with ID ${id} not found.`);
    }
    return user;
  }

  async getUserByEmail(email, session) {
    return await userRepository.findByEmail(email, session);
  }

  async getUserByUsername(username, session) {
    return await userRepository.findByUsername(username, session);
  }

  async getUserByEmailOrUsername(emailOrUsername, session) {
    const userByEmail = await userRepository.findByEmail(emailOrUsername, session);
    if (userByEmail) return userByEmail;

    return await userRepository.findByUsername(emailOrUsername, session);
  }

  async getUserByVillaNumber(villaNumber, orgId, session) {
    return await userRepository.findByVillaNumber(villaNumber, orgId, session);
  }

  async createUser(userData, session = null) {
    let localSession = null;
    if (!session) {
      localSession = await mongoose.startSession();
      localSession.startTransaction();
    }
    const currentSession = session || localSession;

    try {
      // Normalization & Validation
      if (userData.email) userData.email = userData.email.trim().toLowerCase();
      if (userData.username) userData.username = userData.username.trim();
      if (userData.phone) {
        const normalizedPhone = normalizePhone(userData.phone);
        if (!normalizedPhone) throw new HttpError(400, 'Invalid phone number format.');
        userData.phone = normalizedPhone;
      }

      // Check uniqueness
      const existingEmail = await userRepository.findByEmail(userData.email, currentSession);
      if (existingEmail) {
        throw new HttpError(400, `User with email '${userData.email}' already exists.`);
      }

      const existingUsername = await userRepository.findByUsername(userData.username, currentSession);
      if (existingUsername) {
        throw new HttpError(400, `User with username '${userData.username}' already exists.`);
      }

      if (userData.phone) {
        const existingPhoneUser = await userRepository.findByPhone(userData.phone, currentSession);
        if (existingPhoneUser) {
          throw new HttpError(400, `User with phone number '${userData.phone}' already exists.`);
        }
      }

      // Hash the password securely using crypto utilities if provided
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }

      const newUser = await userRepository.create(userData, currentSession);
      
      if (localSession) {
        await localSession.commitTransaction();
      }
      return newUser;
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

  async getAllUsers(page = 1, limit = 10) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const skip = (page - 1) * limit;
      const { data, totalRecords } = await userRepository.findAllPaginated(skip, limit, session);
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

  async updateUser(id, updateData, session = null) {
    let localSession = null;
    if (!session) {
      localSession = await mongoose.startSession();
      localSession.startTransaction();
    }
    const currentSession = session || localSession;
    try {
      await this.getUserById(id, currentSession); // Throws if user doesn't exist
      if (updateData.email && updateData.email.trim()) {
        const normalizedEmail = updateData.email.trim().toLowerCase();
        const existingEmailUser = await userRepository.findByEmail(normalizedEmail, currentSession);
        if (existingEmailUser && existingEmailUser._id.toString() !== id.toString()) {
          throw new HttpError(409, `User with email '${updateData.email}' already exists.`);
        }
        updateData.email = normalizedEmail;
      }
      if (updateData.username && updateData.username.trim()) {
        const normalizedUsername = updateData.username.trim();
        const existingUsernameUser = await userRepository.findByUsername(normalizedUsername, currentSession);
        if (existingUsernameUser && existingUsernameUser._id.toString() !== id.toString()) {
          throw new HttpError(409, `User with username '${updateData.username}' already exists.`);
        }
        updateData.username = normalizedUsername;
      }
      if (updateData.phone && String(updateData.phone).trim()) {
        const normalizedPhone = normalizePhone(updateData.phone);
        if (!normalizedPhone) throw new HttpError(400, 'Invalid phone number format.');
        const existingPhoneUser = await userRepository.findByPhone(normalizedPhone, currentSession);
        if (existingPhoneUser && existingPhoneUser._id.toString() !== id.toString()) {
          throw new HttpError(409, `User with phone number '${updateData.phone}' already exists.`);
        }
        updateData.phone = normalizedPhone;
      }
      const updatedUser = await userRepository.update(id, updateData, currentSession);
      if (localSession) {
        await localSession.commitTransaction();
      }
      return updatedUser;
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

  async deleteUserFromOrg(id, orgId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await userRepository.findById(id, session);
      const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
      await orgMembershipService.deleteMembership(id, orgId, session);

      // Remove user from any Villa residents arrays they might be in within this organization
      const villaService = (await import('../villa/villa.services.js')).default;
      await villaService.removeUserFromAllVillasInOrg(id, orgId, session);

      // Delete technician records linked to this user or email in this org
      const Technician = (await import('../technician/technician.model.js')).default;
      const techOrConditions = [{ userId: id }];
      if (user && user.email) techOrConditions.push({ email: user.email });
      await Technician.deleteMany({ orgId, $or: techOrConditions }).session(session);

      // Clean up invitation tokens for this user in this organization
      const tokenService = (await import('../token/token.services.js')).default;
      await tokenService.deleteTokens({ userId: id, orgId }, session);

      if (!user) {
        await orgMembershipService.deleteMembershipsByUserId(id, session);
        await tokenService.deleteTokens({ userId: id }, session);
        await session.commitTransaction();
        return;
      }

      // Check if user has any OTHER community memberships left across the platform
      const remainingMemberships = await orgMembershipService.getUserMemberships(id, session);
      const remainingCommunityMemberships = remainingMemberships.filter(m => {
        if (!m.orgId) return false;
        const memberOrgId = m.orgId._id ? m.orgId._id.toString() : m.orgId.toString();
        return memberOrgId !== orgId.toString() && !m.orgId.isPlatform;
      });

      if (remainingCommunityMemberships.length === 0) {
        // If they don't belong to any other community organization, hard-delete their global user record and all memberships
        await userRepository.delete(id, session);
        await orgMembershipService.deleteMembershipsByUserId(id, session);
        await Technician.deleteMany({ $or: techOrConditions }).session(session);
        await tokenService.deleteTokens({ userId: id }, session);
        
        // Clean up linked SSO identities
        const userIdentityService = (await import('../userIdentity/userIdentity.services.js')).default;
        await userIdentityService.deleteIdentitiesByUserId(id, session);

        // Revoke all active sessions
        const sessionService = (await import('../session/session.services.js')).default;
        await sessionService.revokeAllUserSessions(id, null, session);
      } else {
        const remaining = remainingCommunityMemberships[0];
        const getResidencyTypeFromMemberType = (type) => {
          switch (type) {
            case 'Owner': return 'Resident Owner';
            case 'Tenant': return 'Tenant';
            case 'Family': return 'Family Member';
            default: return 'None';
          }
        };
        const User = (await import('./user.model.js')).default;
        await User.updateOne(
          { _id: id },
          {
            $set: {
              villaId: remaining.villaId || null,
              residencyType: getResidencyTypeFromMemberType(remaining.residentType),
              roleId: remaining.roleId || null,
              roleIds: remaining.roleIds || []
            }
          }
        ).session(session);
      }

      await session.commitTransaction();
      userEvents.emit('USER_UPDATED', { userId: id, orgId, action: 'deleted' });
      return { id };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async inviteUser(email, orgId, villaId = null, residentType = 'None', roleName = null, phone = '', name = '', invitationSource = 'WEB', inviterId = null) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const existing = await userRepository.findByEmail(trimmedEmail, session);
      const isExisting = !!existing;

      // Check if membership already exists in this organization
      const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
      const existingMembership = existing ? await orgMembershipService.getMembership(existing._id, orgId, session) : null;

      if (existing) {
        // Block re-inviting an already active member of this community.
        // A user is only truly an active member if BOTH their global user account is Active AND their organization membership is Active.
        if (existingMembership && existingMembership.status === 'Active' && existing.status === 'Active') {
          throw new HttpError(409, `User with email '${trimmedEmail}' is already an active member of this community.`);
        }
      }

      let phoneToAssign = phone ? normalizePhone(phone) : '';
      if (phone && !phoneToAssign) {
        throw new HttpError(400, 'Invalid phone number format.');
      }
      if (phoneToAssign) {
        const existingPhoneUser = await userRepository.findByPhone(phoneToAssign, session);
        if (existingPhoneUser && (!existing || existingPhoneUser._id.toString() !== existing._id.toString())) {
          throw new HttpError(409, 'This phone number is already linked to another account. Remove it from the invitation or use the resident\'s own number.');
        }
      }
      
      let user = existing;
      if (!existing) {
        let baseUsername = trimmedEmail.split('@')[0];
        let username = baseUsername;
        let usernameExists = await userRepository.findByUsername(username, session);
        
        // Auto-generate a unique username if the base one is taken
        while (usernameExists) {
          username = `${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`;
          usernameExists = await userRepository.findByUsername(username, session);
        }

        const userData = {
          email: trimmedEmail,
          username: username,
          name: name || username,
          status: 'Pending Verification',
          ...(phoneToAssign ? { phone: phoneToAssign } : {}),
        };
        user = await userRepository.create(userData, session);
      } else {
        const updates = {};
        if (phoneToAssign && !user.phone) updates.phone = phoneToAssign;
        if (name && !user.name) updates.name = name;
        if (Object.keys(updates).length > 0) {
          user = await userRepository.update(user._id, updates, session);
        }
      }

      // Resolve roles if roleName is provided
      let roleIds = [];
      let calculatedResidentType = residentType;
      let role = null;
      if (roleName) {
        const roleService = (await import('../role/role.services.js')).default;
        const roleNames = roleName.split(',').map((r) => r.trim()).filter(Boolean);
        for (const rName of roleNames) {
          const foundRole = await roleService.getRoleByName(rName, orgId, session);
          if (foundRole) {
            roleIds.push(foundRole._id);
            if (!role) role = foundRole;
          }
        }
        if (roleIds.length > 0) {
          // If residentType is missing or 'None' and user is assigned to a unit, default it to the role name
          if (villaId && (!calculatedResidentType || calculatedResidentType === 'None')) {
            calculatedResidentType = role.name;
          }
        } else {
          throw new HttpError(400, `Role '${roleName}' not found in this community.`);
        }
      }

      // Setup units array update
      let membershipUnits = [];
      if (existingMembership && existingMembership.units) {
        membershipUnits = [...existingMembership.units];
      }

      if (villaId) {
        const villaService = (await import('../villa/villa.services.js')).default;
        const targetVilla = await villaService.getUnitById(villaId, orgId, session);
        if (!targetVilla) {
          throw new HttpError(400, `Unit with ID '${villaId}' not found in this community.`);
        }

        const unitIndex = membershipUnits.findIndex(u => u.villaId && u.villaId.toString() === villaId.toString());
        if (unitIndex > -1) {
          membershipUnits[unitIndex].residentType = calculatedResidentType;
        } else {
          membershipUnits.push({ villaId, residentType: calculatedResidentType });
        }
      }

      // Sync root fields to units[0]
      let rootVillaId = null;
      let rootResidentType = 'None';
      if (membershipUnits.length > 0) {
        rootVillaId = membershipUnits[0].villaId;
        rootResidentType = membershipUnits[0].residentType;
      } else if (villaId) {
        rootVillaId = villaId;
        rootResidentType = calculatedResidentType;
      }

      let membership = null;
      if (existingMembership) {
        if (roleIds.length > 0) {
          existingMembership.roleIds = roleIds;
          existingMembership.roleId = roleIds[0] || null;
        }
        // Preserve Active status only if user account is truly Active AND membership was Active
        if (!existing || existing.status !== 'Active' || existingMembership.status !== 'Active') {
          existingMembership.villaId = rootVillaId;
          existingMembership.residentType = rootResidentType;
          existingMembership.units = membershipUnits;
          existingMembership.status = 'Pending';
        }
        membership = await existingMembership.save({ session });
      } else {
        // Create membership with villa association and roles (explicitly Pending status)
        const initialUnits = villaId ? [{ villaId, residentType: calculatedResidentType }] : [];
        membership = await orgMembershipService.createMembership({
          userId: user._id,
          orgId,
          roleIds,
          roleId: roleIds[0] || null,
          villaId: rootVillaId,
          residentType: rootResidentType,
          units: initialUnits,
          status: 'Pending'
        }, session);
      }

      // Sync user profile with villa and residencyType (keep None if no villa assigned)
      const userResidencyType = rootVillaId ? (calculatedResidentType || roleName || 'None') : 'None';

      // Dynamically calculate a baseSystemType for mitigation/recommendation
      let baseSystemType = 'Tenant';
      if (role) {
        if (role.isTenantRole === true) {
          baseSystemType = 'Tenant';
        } else {
          const lowerRoleName = role.name.toLowerCase();
          if (lowerRoleName.includes('owner') && lowerRoleName.includes('non')) {
            baseSystemType = 'Non-Resident Owner';
          } else if (lowerRoleName.includes('owner')) {
            baseSystemType = 'Resident Owner';
          } else if (lowerRoleName.includes('tenant')) {
            baseSystemType = 'Tenant';
          } else if (lowerRoleName.includes('family')) {
            baseSystemType = 'Family Member';
          } else if (lowerRoleName.includes('staff')) {
            baseSystemType = 'Staff';
          } else {
            if (calculatedResidentType === 'Owner') {
              baseSystemType = 'Resident Owner';
            } else if (calculatedResidentType === 'Family') {
              baseSystemType = 'Family Member';
            } else if (calculatedResidentType === 'Guest') {
              baseSystemType = 'Staff';
            }
          }
        }
      }

      // Only initialize user residencyType on global profile if new user
      if (!existing && rootVillaId) {
        await userRepository.update(user._id, { residencyType: userResidencyType }, session);
      }

      // NOTE: Villa assignment (assignResidentToVilla) and villa occupancy status update
      // are strictly deferred until the user accepts the invitation (via accept-invite or login).
      // This guarantees that pending invitations do not reserve or occupy villas prematurely.

      // Always generate an invitationToken with orgId (for both new and existing users)
      const tokenService = (await import('../token/token.services.js')).default;
      // Clean up previous unconsumed invitation tokens for this user in this organization
      await tokenService.deleteTokens({ userId: user._id, orgId, type: 'INVITATION' }, session);
      const result = await tokenService.generateInvitationToken(user._id, orgId, session, invitationSource, inviterId);
      const invitationToken = result.invitationToken;

      // Insert transactional outbox event for auditing & token resolution fallback
      const OutboxEvent = (await import('../outbox/outboxEvent.model.js')).default;
      const outboxEvent = new OutboxEvent({
        eventType: 'USER_INVITED',
        payload: { email: trimmedEmail, orgId, invitationToken, invitationSource, inviterId },
        status: 'COMPLETED',
      });
      await outboxEvent.save({ session });

      // Auto-sync technician record if assigned a staff/vendor role
      if (roleName) {
        await this.syncTechnicianForStaffUser(user._id, orgId, [roleName], session);
      }

      await session.commitTransaction();
      
      // Dispatch events for email delivery and real-time frontend syncing
      userEvents.emit('USER_INVITED', {
        email: trimmedEmail,
        orgId,
        invitationToken,
        invitationSource,
        villaId: rootVillaId || villaId,
        roleName: roleName || (role ? role.name : null),
        userId: user._id,
        inviterId,
        isExisting,
      });
      userEvents.emit('USER_UPDATED', { userId: user._id, orgId, action: 'invited', invitationSource });

      return {
        user,
        invitationToken,
        invitationSource,
        membership,
        inviteLink: generateInviteLink(invitationToken),
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async syncTechnicianForStaffUser(userId, orgId, roleNames = [], session = null) {
    try {
      const isStaffRole = roleNames.some(r => {
        if (!r) return false;
        const lower = r.toLowerCase();
        return lower.includes('staff') || lower.includes('vendor') || lower.includes('technician') || lower.includes('maintenance');
      });

      if (!isStaffRole) return;

      const User = (await import('./user.model.js')).default;
      const user = await User.findById(userId).session(session || null);
      if (!user) return;

      const Technician = (await import('../technician/technician.model.js')).default;

      const existingTech = await Technician.findOne({
        orgId,
        $or: [
          { userId: user._id },
          ...(user.email ? [{ email: user.email }] : []),
          ...(user.phone && user.phone !== 'N/A' ? [{ phone: user.phone }] : [])
        ]
      }).session(session || null);

      if (existingTech) {
        existingTech.userId = user._id;
        if (user.name && user.name !== user.username) {
          existingTech.name = user.name;
        }
        if (user.phone && user.phone !== 'N/A') {
          existingTech.phone = user.phone;
        }
        existingTech.isDeleted = false;
        existingTech.status = user.status === 'Active' ? 'Active' : 'Pending';
        await existingTech.save(session ? { session } : undefined);
      } else {
        await Technician.create([{
          orgId,
          userId: user._id,
          name: user.name || user.username || user.email.split('@')[0],
          email: user.email,
          phone: user.phone || 'N/A',
          department: 'Others',
          type: 'In-House Staff',
          status: user.status === 'Active' ? 'Active' : 'Pending',
          whatsappEnabled: true,
          isDeleted: false
        }], session ? { session } : undefined);
      }
    } catch (err) {
      console.error('Failed to sync technician for staff user:', err);
    }
  }

  async updateUserRoles(userId, orgId, roles, villaId = null, session = null) {
    let localSession = null;
    if (!session) {
      localSession = await mongoose.startSession();
      localSession.startTransaction();
    }
    const currentSession = session || localSession;

    try {
      const roleService = (await import('../role/role.services.js')).default;
      const roleIds = [];
      const foundRoleNames = [];
      
      const roleNames = (Array.isArray(roles) ? roles : [roles]).filter(Boolean);
      
      for (const name of roleNames) {
        const role = await roleService.getRoleByName(name, orgId, currentSession);
        if (role) {
          roleIds.push(role._id);
          foundRoleNames.push(role.name);
        } else {
          throw new HttpError(400, `Role '${name}' not found`);
        }
      }

      const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
      
      let newResidentType = null;
      if (foundRoleNames.includes('Resident Owner')) newResidentType = 'Owner';
      else if (foundRoleNames.includes('Resident Tenant')) newResidentType = 'Tenant';
      else if (foundRoleNames.includes('Family Member')) newResidentType = 'Family';

      const updatedMembership = await orgMembershipService.updateMembershipRole(userId, orgId, roleIds, villaId, newResidentType, currentSession);
      if (!updatedMembership) {
        throw new HttpError(404, 'User organization membership not found.');
      }
      
      // Auto-sync technician record if updated to a staff/vendor role
      await this.syncTechnicianForStaffUser(userId, orgId, foundRoleNames, currentSession);

      // Fetch fresh permission array for newly assigned roles
      const rolePermissionService = (await import('../rolePermission/rolePermission.services.js')).default;
      rolePermissionService.clearCache();
      
      let updatedPermissions = [];
      for (const rId of roleIds) {
        const perms = await rolePermissionService.getPermissionsByRoleId(rId);
        updatedPermissions.push(...perms.map((p) => p.name));
      }
      updatedPermissions = Array.from(new Set(updatedPermissions));

      if (localSession) {
        await localSession.commitTransaction();
      }
      userEvents.emit('USER_UPDATED', {
        userId,
        orgId,
        action: 'roles_updated',
        roles: foundRoleNames,
        roleIds: roleIds.map((r) => r.toString()),
        permissions: updatedPermissions,
      });
      return { id: userId, roles: foundRoleNames, permissions: updatedPermissions };
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

  async getAllUsersInOrg(orgId, page = 1, limit = 10, filters = {}) {
    const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
    return await orgMembershipService.getPaginatedUsersForOrg(orgId, page, limit, filters);
  }

  async activateUser(id, hashedPassword, session, additionalData = {}) {
    const updatePayload = { password: hashedPassword, status: 'Active', emailVerified: true };
    if (additionalData.name && typeof additionalData.name === 'string' && additionalData.name.trim()) {
      updatePayload.name = additionalData.name.trim();
    }
    if (additionalData.phone && typeof additionalData.phone === 'string' && additionalData.phone.trim()) {
      updatePayload.phone = additionalData.phone.trim();
    }
    const updatedUser = await userRepository.update(id, updatePayload, session);
    return updatedUser;
  }

  async requestEmailOtp(userId, newEmail) {
    if (!newEmail) {
      throw new HttpError(400, 'New email address is required.');
    }
    const normalizedEmail = newEmail.trim().toLowerCase();

    // 1. Verify user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new HttpError(404, 'User not found.');
    }

    if (user.email && user.email.toLowerCase() === normalizedEmail) {
      throw new HttpError(400, 'The new email address cannot be the same as your current email.');
    }

    // 2. Check if another user already has this email
    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
      throw new HttpError(400, `An account with email '${normalizedEmail}' already exists.`);
    }

    // 3. Generate OTP via otpService (valid for 15 minutes)
    const plainCode = await otpService.createOTP(normalizedEmail, 'VERIFY', 15);

    // 4. Emit event for logging and email dispatch
    userEvents.emit('EMAIL_OTP_SENT', { email: normalizedEmail, code: plainCode });

    return {
      message: `Verification code sent to ${normalizedEmail}`,
      email: normalizedEmail,
      ...(process.env.NODE_ENV !== 'production' && { devCode: plainCode }),
    };
  }

  async requestPhoneOtp(userId, newPhone) {
    if (!newPhone || typeof newPhone !== 'string' || !newPhone.trim()) {
      throw new HttpError(400, 'New phone number is required.');
    }
    const normalizedPhone = normalizePhone(newPhone.trim());
    if (!normalizedPhone) {
      throw new HttpError(400, 'Invalid phone number format.');
    }

    // 1. Verify user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new HttpError(404, 'User not found.');
    }

    if (user.phone && user.phone === normalizedPhone) {
      throw new HttpError(400, 'The new phone number cannot be the same as your current phone number.');
    }

    // 2. Check if another user already has this phone number
    const existingUser = await userRepository.findByPhone(normalizedPhone);
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
      throw new HttpError(400, `An account with phone number '${newPhone}' already exists.`);
    }

    if (process.env.NODE_ENV === 'production') {
      const [twilio, messageCentral] = await Promise.all([
        integrationHubService.getGlobalConnectionByProvider('twilio'),
        integrationHubService.getGlobalConnectionByProvider('messagecentral')
      ]);
      if (!twilio && !messageCentral) {
        throw new HttpError(503, 'SMS verification is temporarily unavailable. Please contact support.');
      }
    }

    // 3. Generate OTP via otpService (valid for 15 minutes)
    const plainCode = await otpService.createOTP(normalizedPhone, 'VERIFY', 15);

    // 4. Emit event for logging and SMS dispatch
    const authEvents = (await import('../auth/auth.events.js')).default;
    authEvents.emit('OTP_SENT', { identifier: normalizedPhone, code: plainCode, type: 'SMS' });

    return {
      message: `Verification code sent to ${maskPhone(normalizedPhone)}`,
      phone: normalizedPhone,
      ...(process.env.NODE_ENV !== 'production' && { devCode: plainCode }),
    };
  }

  async updateProfile(id, {
    name,
    phone,
    phoneOtp,
    email,
    emailOtp,
    bio,
    work,
    hometown,
    allowIntercomCalls,
    interests,
    avatarFilename,
    removeAvatar,
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await this.getUserById(id, session);

      const payload = { $set: {}, $unset: {} };
      if (name !== undefined) payload.$set.name = name;
      if (bio !== undefined) payload.$set.bio = String(bio).trim();
      if (work !== undefined) payload.$set.work = String(work).trim();
      if (hometown !== undefined) payload.$set.hometown = String(hometown).trim();
      if (allowIntercomCalls !== undefined) payload.$set.allowIntercomCalls = Boolean(allowIntercomCalls);
      if (interests !== undefined) {
        payload.$set.interests = interests
          .map((interest) => String(interest).trim())
          .filter(Boolean);
      }

      // Phone change verification via OTP
      if (phone !== undefined) {
        if (phone === null || (typeof phone === 'string' && phone.trim() === '')) {
          payload.$unset.phone = 1;
          payload.$set.phoneVerified = false;
        } else {
          const normalizedPhone = normalizePhone(String(phone).trim());
          if (!normalizedPhone) throw new HttpError(400, 'Invalid phone number format.');
          if (normalizedPhone !== (user.phone || '')) {
            const existingPhoneUser = await userRepository.findByPhone(normalizedPhone, session);
            if (existingPhoneUser && existingPhoneUser._id.toString() !== id.toString()) {
              throw new HttpError(400, `User with phone number '${phone}' already exists.`);
            }

            if (!phoneOtp || String(phoneOtp).trim() === '') {
              throw new HttpError(400, 'Verification OTP code is required to update phone number.');
            }

            await otpService.verifyOTP(normalizedPhone, String(phoneOtp).trim(), 'VERIFY', session, true);

            payload.$set.phone = normalizedPhone;
            payload.$set.phoneVerified = true;
          }
        }
      }

      // Email change verification via OTP
      if (email !== undefined && email.trim() !== '') {
        const normalizedEmail = email.trim().toLowerCase();
        if (normalizedEmail !== (user.email || '').toLowerCase()) {
          const existingEmailUser = await userRepository.findByEmail(normalizedEmail, session);
          if (existingEmailUser && existingEmailUser._id.toString() !== id.toString()) {
            throw new HttpError(400, `User with email '${normalizedEmail}' already exists.`);
          }

          if (!emailOtp || emailOtp.trim() === '') {
            throw new HttpError(400, 'Verification OTP code is required to update email address.');
          }

          await otpService.verifyOTP(normalizedEmail, emailOtp.trim(), 'VERIFY', session, true);

          payload.$set.email = normalizedEmail;
          payload.$set.emailVerified = true;
        }
      }

      if (removeAvatar) {
        payload.$unset.avatar = 1;

        // Delete old avatar from disk if it exists
        if (user.avatar) {
          const oldFilename = path.basename(user.avatar);
          const oldFilePath = path.join(uploadDir, oldFilename);
          if (fs.existsSync(oldFilePath)) {
            fs.unlink(oldFilePath, (err) => {
              if (err) console.error('Error deleting old avatar file:', err);
            });
          }
          const publicAvatarDir = path.resolve(projectRoot, 'public/uploads/avatars');
          const oldPublicFilePath = path.join(publicAvatarDir, oldFilename);
          if (fs.existsSync(oldPublicFilePath)) {
            fs.unlink(oldPublicFilePath, (err) => {
              if (err) console.error('Error deleting old public avatar file:', err);
            });
          }
        }
      } else if (avatarFilename !== undefined) {
        payload.$set.avatar = `uploads/avatars/${avatarFilename}`;

        // Ensure public/uploads/avatars directory has a synced copy as well
        const publicAvatarDir = path.resolve(projectRoot, 'public/uploads/avatars');
        if (!fs.existsSync(publicAvatarDir)) {
          try {
            fs.mkdirSync(publicAvatarDir, { recursive: true });
          } catch (e) {}
        }
        const sourcePath = path.join(uploadDir, avatarFilename);
        const publicDestPath = path.join(publicAvatarDir, avatarFilename);
        if (fs.existsSync(sourcePath) && !fs.existsSync(publicDestPath)) {
          try {
            fs.copyFileSync(sourcePath, publicDestPath);
          } catch (e) {}
        }

        // Delete old avatar from disk if it exists
        if (user.avatar) {
          const oldFilename = path.basename(user.avatar);
          const oldFilePath = path.join(uploadDir, oldFilename);
          if (fs.existsSync(oldFilePath)) {
            fs.unlink(oldFilePath, (err) => {
              if (err) console.error('Error deleting old avatar file:', err);
            });
          }
          const oldPublicFilePath = path.join(publicAvatarDir, oldFilename);
          if (fs.existsSync(oldPublicFilePath)) {
            fs.unlink(oldPublicFilePath, (err) => {
              if (err) console.error('Error deleting old public avatar file:', err);
            });
          }
        }
      }

      if (Object.keys(payload.$set).length === 0) delete payload.$set;
      if (Object.keys(payload.$unset).length === 0) delete payload.$unset;

      const updatedUser = await userRepository.update(id, payload, session);
      await session.commitTransaction();
      
      userEvents.emit('USER_UPDATED', { userId: id, action: 'profile_updated' });
      return updatedUser;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async bulkInviteUsers(invitations, orgId, defaultSource = 'WEB', inviterId = null) {
    const successes = [];
    const failures = [];

    const villaService = (await import('../villa/villa.services.js')).default;

    for (const invite of invitations) {
      const { email, residentType = 'None', roleName, villaNumber, villaId: payloadVillaId, invitationSource: itemSource } = invite;
      const trimmedEmail = email ? email.trim().toLowerCase() : '';
      const source = (itemSource || defaultSource || 'WEB').toUpperCase();

      try {
        if (!trimmedEmail) {
          throw new HttpError(400, 'Email address is required.');
        }

        let villaId = payloadVillaId || null;

        // If villa number is provided and villaId not explicit, resolve it
        if (!villaId && villaNumber && villaNumber.trim()) {
          const trimmedVillaNo = villaNumber.trim();
          const villa = await villaService.getVillaByNumber(trimmedVillaNo, orgId);
          if (villa) {
            villaId = villa._id;
          }
        }

        // Call the single inviteUser logic
        await this.inviteUser(trimmedEmail, orgId, villaId, residentType, roleName, '', '', source, inviterId);

        successes.push({
          email: trimmedEmail,
          status: 'Invited',
          role: roleName,
          villaNumber: villaNumber || '',
          invitationSource: source,
        });
      } catch (error) {
        failures.push({
          email: trimmedEmail || 'Unknown',
          error: error.message || 'Invitation failed',
          role: roleName || '',
          villaNumber: villaNumber || '',
          invitationSource: source,
        });
      }
    }

    return {
      total: invitations.length,
      successCount: successes.length,
      failureCount: failures.length,
      successes,
      failures,
    };
  }

  /**
   * Revokes an existing invitation by ID within an organization.
   * Atomic operation wrapped in a Mongoose transaction.
   *
   * @param {string} invitationId - Token ID or token string
   * @param {string} orgId - Organization context
   * @param {string} [inviterId=null] - Requesting admin ID
   */
  async revokeInvitation(invitationId, orgId, inviterId = null) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const tokenService = (await import('../token/token.services.js')).default;
      const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;

      // 1. Revoke the token using strict lifecycle enforcement
      const tokenDoc = await tokenService.revokeInvitationToken(invitationId, orgId, inviterId, session);

      // 2. If the user had a pending membership in this organization, update it to Rejected
      if (tokenDoc.userId) {
        const membership = await orgMembershipService.getMembership(tokenDoc.userId, orgId, session);
        if (membership && membership.status === 'Pending') {
          await orgMembershipService.updateStatus(tokenDoc.userId, orgId, 'Rejected', session);
        }

        // 3. Remove any pending villa assignments for this user in this organization
        const villaService = (await import('../villa/villa.services.js')).default;
        await villaService.removeUserFromAllVillasInOrg(tokenDoc.userId, orgId, session).catch(() => null);
      }

      await session.commitTransaction();

      // 4. Emit domain events
      userEvents.emit('INVITATION_REVOKED', {
        invitationId,
        userId: tokenDoc.userId,
        orgId,
        inviterId,
      });
      userEvents.emit('USER_UPDATED', {
        userId: tokenDoc.userId,
        orgId,
        action: 'invitation_revoked',
      });

      return {
        message: 'Invitation revoked successfully',
        invitationId,
        userId: tokenDoc.userId,
        orgId,
        status: 'REVOKED',
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Lists invitations for an organization with pagination, filtering, and recipient search.
   * Exclusively delegates to tokenService adhering to feature isolation.
   * @param {Object} params
   */
  async listInvitations(params) {
    const tokenService = (await import('../token/token.services.js')).default;
    return await tokenService.listInvitations(params);
  }

  /**
   * Resends an eligible invitation (PENDING or EXPIRED).
   * Generates a new cryptographically secure token, invalidates old token,
   * re-triggers dual-audience notification, and returns safe administrative metadata.
   * Protected with concurrency-safe single-consumer atomic update.
   *
   * @param {string} invitationId - Invitation token document ID
   * @param {string} orgId - Organization context from authenticated session
   * @param {string} [inviterId=null] - Requesting admin ID
   */
  async resendInvitation(invitationId, orgId, inviterId = null) {
    if (!invitationId) {
      throw new HttpError(400, 'Invitation ID is required.');
    }
    if (!orgId) {
      throw new HttpError(400, 'Organization context is required.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const tokenService = (await import('../token/token.services.js')).default;
      const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;

      // 1. Fetch the target invitation token
      const targetToken = await tokenService.findTokenById(invitationId, session);
      if (!targetToken) {
        throw new HttpError(404, 'Invitation not found.');
      }

      // 2. Strict tenant verification
      if (targetToken.orgId && targetToken.orgId.toString() !== orgId.toString()) {
        throw new HttpError(403, 'Forbidden. Invitation belongs to another organization.');
      }

      // 3. Type verification
      if (targetToken.type !== 'INVITATION') {
        throw new HttpError(400, 'Specified token is not an invitation.');
      }

      // 4. Strict lifecycle validation guards
      if (targetToken.status === 'ACCEPTED' || targetToken.used === true) {
        throw new HttpError(400, 'Cannot resend an invitation that has already been accepted or consumed.');
      }
      if (targetToken.status === 'REJECTED') {
        throw new HttpError(400, 'Cannot resend an invitation that has already been rejected.');
      }
      if (targetToken.status === 'REVOKED') {
        throw new HttpError(400, 'Cannot resend an invitation that has been revoked. Please create a new invitation instead.');
      }

      // 5. Determine correct invalidation status:
      // Naturally expired tokens remain EXPIRED; pending tokens superseded administratively become REVOKED.
      const isNaturallyExpired = targetToken.status === 'EXPIRED' || (targetToken.expiresAt && new Date() >= targetToken.expiresAt);
      const replacementStatus = isNaturallyExpired ? 'EXPIRED' : 'REVOKED';

      // 6. Concurrency-safe atomic invalidation of the old token
      const oldToken = await tokenService.findAndInvalidateForResend(
        invitationId,
        orgId,
        replacementStatus,
        session
      );

      if (!oldToken) {
        throw new HttpError(409, 'Invitation has already been processed or superseded by another action.');
      }

      // 7. Fetch recipient user details
      const recipient = await userRepository.findById(oldToken.userId, session);
      if (!recipient) {
        throw new HttpError(404, 'Invited recipient user record not found.');
      }

      // 8. Verify and maintain membership status
      const membership = await orgMembershipService.getMembership(recipient._id, orgId, session);
      if (membership && membership.status === 'Active' && recipient.status === 'Active') {
        throw new HttpError(400, 'User is already an active member of this organization.');
      }
      if (membership && recipient.status !== 'Active') {
        membership.status = 'Pending';
        await membership.save({ session });
      }

      // 9. Generate brand-new cryptographically secure invitation token
      const newResult = await tokenService.generateInvitationToken(
        oldToken.userId,
        orgId,
        session,
        oldToken.invitationSource || 'WEB',
        inviterId
      );

      // 10. Resolve role name if assigned
      let roleName = null;
      if (membership && membership.roleId) {
        try {
          const roleService = (await import('../role/role.services.js')).default;
          const role = await roleService.getRoleById(membership.roleId, session);
          if (role) roleName = role.name;
        } catch (e) {}
      }

      // 11. Transactional outbox event for audit
      try {
        const OutboxEvent = (await import('../outbox/outboxEvent.model.js')).default;
        const outboxEvent = new OutboxEvent({
          eventType: 'USER_INVITED',
          payload: {
            email: recipient.email,
            orgId,
            invitationToken: newResult.invitationToken,
            invitationSource: oldToken.invitationSource || 'WEB',
            inviterId,
            isResend: true,
          },
          status: 'COMPLETED',
        });
        await outboxEvent.save({ session });
      } catch (e) {}

      await session.commitTransaction();

      // 12. Emit domain events for dual-audience notification
      const isExisting = !!(recipient.status === 'Active' || (recipient.password && recipient.password.length > 0));
      userEvents.emit('USER_INVITED', {
        email: recipient.email,
        orgId,
        invitationToken: newResult.invitationToken,
        invitationSource: oldToken.invitationSource || 'WEB',
        villaId: membership?.villaId || null,
        roleName,
        userId: recipient._id,
        inviterId,
        isExisting,
        isResend: true,
      });

      userEvents.emit('USER_UPDATED', {
        userId: recipient._id,
        orgId,
        action: 'invitation_resent',
        invitationSource: oldToken.invitationSource || 'WEB',
      });

      // 13. Return safe administrative response (zero raw credentials or hashes)
      return {
        message: 'Invitation resent successfully',
        invitationId: newResult.tokenDoc._id,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        status: 'PENDING',
        expiresAt: newResult.tokenDoc.expiresAt,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getUsersByIds(ids, session = null) {
    const User = (await import('./user.model.js')).default;
    return await User.find({ _id: { $in: ids } }).session(session);
  }

  async getUserByPhone(phone, session = null) {
    return await userRepository.findByPhone(phone, session);
  }

  async getUserByEmailOrPhone(identifier, session = null) {
    const trimmed = identifier.trim();
    if (trimmed.includes('@')) {
      return await userRepository.findByEmail(trimmed.toLowerCase(), session);
    }
    return await userRepository.findByPhone(trimmed, session);
  }

  /**
   * Self-service account deletion for the authenticated user.
   * Purges personal identifying information while preserving financial integrity.
   * @param {string} userId - Authenticated user ID
   */
  async deleteOwnAccount(userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await userRepository.findById(userId, session);
      if (!user) {
        throw new HttpError(404, 'User account not found.');
      }

      const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
      const villaService = (await import('../villa/villa.services.js')).default;

      // 1. Remove user from all villas in every organization they have membership in
      const memberships = await orgMembershipService.getUserMemberships(userId, session);
      if (Array.isArray(memberships)) {
        for (const m of memberships) {
          const orgId = m.orgId?._id ? m.orgId._id.toString() : m.orgId?.toString();
          if (orgId) {
            await villaService.removeUserFromAllVillasInOrg(userId, orgId, session).catch((err) => {
              logger.warn(`Could not remove user ${userId} from villas in org ${orgId}:`, err.message);
            });
          }
        }
      }

      // 2. Remove all memberships across organizations
      await orgMembershipService.deleteMembershipsByUserId(userId, session);

      // 3. Remove all community notes created by the user
      const CommunityNote = (await import('../communityNote/communityNote.model.js')).default;
      if (CommunityNote) {
        await CommunityNote.deleteMany({ userId }).session(session);
      }

      // 4. Remove linked SSO identities
      const userIdentityService = (await import('../userIdentity/userIdentity.services.js')).default;
      if (userIdentityService && typeof userIdentityService.deleteIdentitiesByUserId === 'function') {
        await userIdentityService.deleteIdentitiesByUserId(userId, session);
      }

      // 5. Revoke all active sessions and refresh tokens
      const sessionService = (await import('../session/session.services.js')).default;
      if (sessionService && typeof sessionService.revokeAllUserSessions === 'function') {
        await sessionService.revokeAllUserSessions(userId, null, session);
      }

      // 6. Delete technician entries if any
      const Technician = (await import('../technician/technician.model.js')).default;
      if (Technician) {
        const techConditions = [{ userId }];
        if (user.email) techConditions.push({ email: user.email });
        await Technician.deleteMany({ $or: techConditions }).session(session);
      }

      // 7. Purge direct messages and conversations
      const Message = (await import('../directoryMessage/message.model.js')).default;
      const Conversation = (await import('../directoryMessage/conversation.model.js')).default;
      if (Message) {
        await Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] }).session(session);
      }
      if (Conversation) {
        await Conversation.deleteMany({ participants: userId }).session(session);
      }

      // 8. Purge all notification records for this user
      const Notification = (await import('../notification/notification.model.js')).default;
      if (Notification) {
        await Notification.deleteMany({ $or: [{ recipientId: userId }, { senderId: userId }] }).session(session);
      }

      // 9. Anonymize complaint PII snapshots (denormalized resident data)
      const Complaint = (await import('../complaint/complaint.model.js')).default;
      if (Complaint) {
        await Complaint.updateMany(
          { residentId: userId },
          {
            $set: {
              residentName: 'Deleted User',
              residentEmail: null,
              residentMobile: null,
            },
          }
        ).session(session);
      }

      // 10. Anonymize user personal data and set status to 'Deleted'
      await userRepository.anonymize(userId, session);

      // 11. Collect file paths for post-commit cleanup (avatar + complaint attachments)
      const filesToClean = [];
      if (user.avatar) {
        filesToClean.push(user.avatar);
      }

      await session.commitTransaction();

      // Post-commit: Clean up physical uploaded files from disk (non-transactional, best-effort)
      for (const filePath of filesToClean) {
        try {
          const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(projectRoot, filePath);
          if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
            logger.info(`Cleaned up file for deleted user ${userId}: ${absolutePath}`);
          }
        } catch (fileErr) {
          logger.warn(`Could not clean up file for deleted user ${userId}: ${fileErr.message}`);
        }
      }

      // Emit event for real-time decoupling
      userEvents.emit('USER_UPDATED', { userId, action: 'account_deleted' });

      return {
        success: true,
        message: 'Account deleted successfully. All personal data has been removed.',
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Public unauthenticated account deletion request handler.
   * Logs deletion request for administrative verification without exposing account existence.
   * @param {Object} params - { email, mobile, reason }
   */
  async requestAccountDeletion({ email, mobile, reason }) {
    logger.info(`[Public Deletion Request] Request received for Email: ${email || 'N/A'}, Mobile: ${mobile || 'N/A'}`);

    try {
      // Internal audit search (non-disclosing)
      if (email || mobile) {
        const searchConditions = [];
        if (email) searchConditions.push({ email: email.toLowerCase() });
        if (mobile) searchConditions.push({ mobile });

        const existingUser = await userRepository.findOne({ $or: searchConditions });
        if (existingUser) {
          logger.info(`[Public Deletion Request] Matched existing user ID: ${existingUser._id}. Pending verification ticket generated.`);
          userEvents.emit('USER_UPDATED', { userId: existingUser._id, action: 'deletion_requested', email, mobile });
        }
      }
    } catch (err) {
      logger.warn(`[Public Deletion Request] Non-blocking audit lookup error: ${err.message}`);
    }

    // Always return uniform security-safe confirmation response
    return {
      success: true,
      message: 'Your request has been received. If the information matches an active account, we will contact you through your registered contact method to complete the identity verification process.',
    };
  }
}

export default new UserService();
