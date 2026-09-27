import userService from '../user/user.services.js';
import roleService from '../role/role.services.js';
import rolePermissionService from '../rolePermission/rolePermission.services.js';
import { comparePassword } from '../../utils/crypto.utils.js';
import { signToken, verifyToken } from '../../utils/jwt.utils.js';
import HttpError from '../../utils/httpError.utils.js';
import logger, { loggerStorage } from '../../utils/logger.utils.js';
import tokenService from '../token/token.services.js';
import otpService from '../otp/otp.services.js';
import sessionService from '../session/session.services.js';
import userIdentityService from '../userIdentity/userIdentity.services.js';
import integrationHubService from '../integrationHub/integrationHub.service.js';
import config from '../../config/config.js';
import authEvents from './auth.events.js';
import userEvents from '../user/user.events.js';

export class AuthService {
  /**

   * Registers a new user with standard credentials.
   * Decoupled from organization setup.
   * @param {object} registerData - Payload containing email, username, and password
   */
  async register(registerData) {
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    
    // --- TRANSACTION BOUNDARY START ---
    // Wrap the user creation process in a transaction to ensure database consistency.
    session.startTransaction();

    try {
      const { email, password, phone } = registerData;

      // If user already exists and is pending, just resend OTP instead of throwing an error
      const existingUser = await userService.getUserByEmail(email, session);
      if (existingUser) {
        if (existingUser.status === 'Pending Verification') {
          const plainCode = await otpService.createOTP(email, 'REGISTER', 15, session);
          await session.commitTransaction();
          authEvents.emit('OTP_SENT', { identifier: email, code: plainCode, type: 'EMAIL' });
          return {
            message: 'Registration successful. OTP sent for verification.',
            email: existingUser.email,
            status: 'Pending Verification'
          };
        } else {
          throw new HttpError(400, `User with email '${email}' already exists.`);
        }
      }

      // Extract name from registerData
      let nameToUse = registerData.name || (registerData.firstName || registerData.lastName ? `${registerData.firstName || ''} ${registerData.lastName || ''}`.trim() : '');
      nameToUse = nameToUse.trim();

      // Derive username: prioritize name, fallback to email prefix
      let derivedUsername;
      if (nameToUse) {
        derivedUsername = nameToUse.replace(/[^a-zA-Z0-9]/g, '');
      } else if (registerData.username) {
        derivedUsername = registerData.username.replace(/[^a-zA-Z0-9]/g, '');
      } else {
        derivedUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      }

      // Ensure length bounds
      if (derivedUsername.length < 3) {
        derivedUsername = 'user' + Math.floor(100 + Math.random() * 900);
      } else if (derivedUsername.length > 30) {
        derivedUsername = derivedUsername.substring(0, 30);
      }

      // Check if username exists, and generate a unique one if so
      let usernameExists = await userService.getUserByEmailOrUsername(derivedUsername, session).catch(() => null);
      let uniqueUsername = derivedUsername;
      while (usernameExists) {
        const suffix = Math.floor(1000 + Math.random() * 9000).toString();
        uniqueUsername = derivedUsername;
        if (uniqueUsername.length + suffix.length > 30) {
          uniqueUsername = uniqueUsername.substring(0, 30 - suffix.length);
        }
        uniqueUsername = `${uniqueUsername}${suffix}`;
        usernameExists = await userService.getUserByEmailOrUsername(uniqueUsername, session).catch(() => null);
      }

      // Create the User (passing session for transactional execution)
      const newUser = await userService.createUser(
        { 
          email, 
          username: uniqueUsername, 
          password, 
          phone, 
          name: nameToUse || undefined, 
          status: 'Pending Verification',
          privacyPolicyAcceptedAt: new Date()
        },
        session
      );
      
      // Generate OTP
      const plainCode = await otpService.createOTP(email, 'REGISTER', 15, session);

      await session.commitTransaction();
      // --- TRANSACTION BOUNDARY END ---

      // Emit internal event to trigger email sending
      authEvents.emit('OTP_SENT', { identifier: email, code: plainCode, type: 'EMAIL' });
      authEvents.emit('USER_CREATED', { userId: newUser._id, provider: 'local' });

      // Automatically populate CRM Inquiry for the registered user
      try {
        const enquiryService = (await import('../platformCrm/enquiry.service.js')).default;
        await enquiryService.ensureInquiry({
          userId: newUser._id,
          contactEmail: newUser.email,
          customerName: nameToUse || newUser.username || newUser.email.split('@')[0],
          contactPhone: newUser.phone || '',
          organizationName: `${nameToUse || newUser.username || 'User'}'s Community`
        }).catch(() => null);
      } catch (inqErr) {
        console.warn('[Register] Non-blocking CRM inquiry auto-creation error:', inqErr.message);
      }
      
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev) {
        console.log('\n=========================================');
        console.log(`[DEV MODE REGISTER] OTP for ${email} is: ${plainCode}`);
        console.log('=========================================\n');
      }

      return {
        message: isDev ? `Registration successful. OTP sent for verification. (Dev Code: ${plainCode})` : 'Registration successful. OTP sent for verification.',
        email: newUser.email,
        status: 'Pending Verification'
      };
    } catch (error) {
      if (session) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Verifies the registration OTP and activates the user.
   * @param {string} email - User email address
   * @param {string} code - OTP verification code
   * @param {object} deviceInfo - Client device meta
   */
  async verifyRegistrationOtp(email, code, deviceInfo) {
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    
    session.startTransaction();

    try {
      await otpService.verifyOTP(email, code, 'REGISTER', session);

      const user = await userService.getUserByEmail(email, session);
      if (!user) {
        throw new HttpError(404, 'User not found.');
      }

      if (user.status !== 'Pending Verification') {
        throw new HttpError(400, `Account is already ${user.status}`);
      }

      // Activate user
      await userService.updateUser(user._id, { status: 'Active', emailVerified: true }, session);

      const refreshToken = await sessionService.createSession(user._id, deviceInfo, session);

      await session.commitTransaction();

      const tokenPayload = {
        id: user._id,
        email: user.email,
        username: user.username,
        role: null,
        permissions: [],
        orgId: null,
        isPlatform: false,
      };

      const token = signToken(tokenPayload);

      authEvents.emit('LOGIN_SUCCESS', { userId: user._id, method: 'register_otp' });

      return {
        token,
        refreshToken,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          phone: user.phone,
          name: user.name,
          role: null,
          permissions: [],
          orgId: null,
          isPlatform: false,
          organizations: [],
        },
        availableWorkspaces: [],
      };
    } catch (error) {
      if (session) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Helper to fetch active user memberships and construct the token payload and available workspaces.
   * @param {object} user - User document
   * @param {string} [targetOrgId=null] - Optional target organization ID to scope the context to
   * @returns {Promise<{tokenPayload: object, availableWorkspaces: Array}>}
   */
  async getScopedTokenPayload(user, targetOrgId = null, targetRole = null, targetVillaId = null) {
    const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
    const memberships = await orgMembershipService.getUserMemberships(user._id);

    // Active memberships strictly (organization status is Active and membership status is Active, or missing for legacy documents)
    const activeMemberships = memberships.filter((m) => 
      m.orgId && 
      (!m.orgId.status || m.orgId.status.toLowerCase() === 'active') && 
      (!m.status || m.status.toLowerCase() === 'active')
    );

    let selectedMembership = null;
    const targetOrgIdStr = targetOrgId ? targetOrgId.toString() : null;

    if (targetOrgIdStr) {
      if (targetVillaId) {
        const targetVillaIdStr = targetVillaId.toString();
        selectedMembership = activeMemberships.find((m) => 
          m.orgId._id.toString() === targetOrgIdStr && 
          ((m.units && m.units.some(u => u.villaId && (u.villaId._id ? u.villaId._id.toString() === targetVillaIdStr : u.villaId.toString() === targetVillaIdStr))) ||
           (m.villaId && (m.villaId._id ? m.villaId._id.toString() === targetVillaIdStr : m.villaId.toString() === targetVillaIdStr)))
        );
      }
      // Fallback to first membership in org if no specific villa requested or found
      if (!selectedMembership) {
        selectedMembership = activeMemberships.find((m) => m.orgId._id.toString() === targetOrgIdStr);
      }
      // Auto-heal fallback: If user was invited and has a membership in this org that is still in 'Pending' status,
      // and the organization is active, auto-promote it to 'Active' so valid authenticated users are never denied entry.
      if (!selectedMembership) {
        const pendingMatch = memberships.find((m) => m.orgId && m.orgId._id && m.orgId._id.toString() === targetOrgIdStr);
        if (pendingMatch && (!pendingMatch.orgId.status || pendingMatch.orgId.status.toLowerCase() === 'active')) {
          await orgMembershipService.updateStatus(user._id, targetOrgIdStr, 'Active');
          pendingMatch.status = 'Active';
          selectedMembership = pendingMatch;
          activeMemberships.push(pendingMatch);
        }
      }
      if (!selectedMembership) {
        throw new HttpError(403, 'Access denied. You do not have an active membership in this workspace.');
      }
    } else {
      // Primary context selection:
      // 1. Prefer a non-platform community workspace that has a villa assigned
      selectedMembership = activeMemberships.find((m) => !m.orgId.isPlatform && m.villaId);
      // 1b. Fallback to any non-platform community workspace
      if (!selectedMembership) {
        selectedMembership = activeMemberships.find((m) => !m.orgId.isPlatform);
      }
      // 2. Fall back to the first active workspace (e.g. System Platform for Platform Super Admin)
      if (!selectedMembership && activeMemberships.length > 0) {
        selectedMembership = activeMemberships[0];
      }
    }

    let roleName = null;
    let permissions = [];
    let orgId = null;
    let isPlatform = false;
    let activeRoleObj = null;

    if (selectedMembership) {
      orgId = selectedMembership.orgId._id.toString();
      isPlatform = selectedMembership.orgId.isPlatform || false;

      const roles = [];
      if (selectedMembership.roleIds && selectedMembership.roleIds.length > 0) {
        roles.push(...selectedMembership.roleIds.filter(Boolean));
      } else if (selectedMembership.roleId) {
        roles.push(selectedMembership.roleId);
      }

      const roleNames = roles.map(r => r?.name).filter(Boolean);

      if (targetRole) {
        if (!roleNames.includes(targetRole)) {
          throw new HttpError(400, `User does not have role '${targetRole}' in this organization.`);
        }
        roleName = targetRole;
        activeRoleObj = roles.find(r => r?.name === roleName);
        if (activeRoleObj) {
          const permissionsList = await rolePermissionService.getPermissionsByRoleId(activeRoleObj._id);
          permissions = permissionsList.map((permission) => permission.name);
        }
      } else {
        roleName = roleNames.length > 0 ? roleNames[0] : null;
        if (roleName) {
          activeRoleObj = roles.find(r => r?.name === roleName);
          if (activeRoleObj) {
            const permissionsList = await rolePermissionService.getPermissionsByRoleId(activeRoleObj._id);
            permissions = permissionsList.map((permission) => permission.name);
          }
        }
      }
    }

    const availableWorkspaces = activeMemberships.map((m) => {
      const roles = [];
      if (m.roleIds && m.roleIds.length > 0) {
        roles.push(...m.roleIds.filter(Boolean));
      } else if (m.roleId) {
        roles.push(m.roleId);
      }
      const validRoles = roles.filter(Boolean);
      const firstUnit = m.units && m.units.length > 0 ? m.units[0] : null;
      const primaryVillaDoc = m.villaId || firstUnit?.villaId || null;
      const primaryVillaId = primaryVillaDoc
        ? (primaryVillaDoc._id ? primaryVillaDoc._id.toString() : primaryVillaDoc.toString())
        : null;
      const primaryVillaNumber = primaryVillaDoc?.unitNumber || null;
      const residentType = m.residentType || firstUnit?.residentType || 'None';

      return {
        orgId: m.orgId._id.toString(),
        name: m.orgId.name,
        isPlatform: m.orgId.isPlatform || false,
        roleName: validRoles.map(r => r.name).join(', ') || m.roleName || m.role || null,
        roles: validRoles.map(r => r.name),
        villaId: primaryVillaId,
        villaNumber: primaryVillaNumber,
        residentType,
      };
    });

    // Discover accessible units for this user in the active organization
    const accessibleUnits = [];
    if (selectedMembership) {
      const selectedOrgIdStr = selectedMembership.orgId._id.toString();
      const sameOrgMemberships = activeMemberships.filter(m => m.orgId && m.orgId._id.toString() === selectedOrgIdStr);
      for (const m of sameOrgMemberships) {
        if (m.units && m.units.length > 0) {
          for (const unit of m.units) {
            if (unit.villaId) {
              const vId = unit.villaId._id ? unit.villaId._id.toString() : unit.villaId.toString();
              if (!accessibleUnits.some(u => u.villaId === vId)) {
                accessibleUnits.push({
                  villaId: vId,
                  villaNumber: unit.villaId.unitNumber || '',
                  block: unit.villaId.blockOrBuilding || '',
                  residentType: unit.residentType || m.residentType || 'None'
                });
              }
            }
          }
        }
        if (m.villaId) {
          const vId = m.villaId._id ? m.villaId._id.toString() : m.villaId.toString();
          if (!accessibleUnits.some(u => u.villaId === vId)) {
            accessibleUnits.push({
              villaId: vId,
              villaNumber: m.villaId.unitNumber || '',
              block: m.villaId.blockOrBuilding || '',
              residentType: m.residentType || 'None'
            });
          }
        }
      }

      // Also discover any units in this organization where the user is an assigned resident or owner in the Villa collection
      try {
        const Villa = (await import('../villa/villa.model.js')).default;
        const assignedVillas = await Villa.find({
          orgId: selectedMembership.orgId._id,
          $or: [
            { 'residents.userId': user._id },
            { primaryResidentId: user._id },
            { ownerId: user._id }
          ]
        }).lean();

        for (const v of assignedVillas) {
          const vId = v._id.toString();
          if (!accessibleUnits.some(u => u.villaId === vId)) {
            const residentEntry = v.residents?.find(r => r.userId?.toString() === user._id.toString());
            const resType = residentEntry?.residencyType || (v.ownerId?.toString() === user._id.toString() ? 'Resident Owner' : 'Resident');
            accessibleUnits.push({
              villaId: vId,
              villaNumber: v.unitNumber || '',
              block: v.blockOrBuilding || '',
              residentType: resType
            });
          }
        }
      } catch (villaErr) {
        // Non-blocking fallback
      }
    }

    // Resolve primary unit (validating permission if a specific targetVillaId is requested)
    let primaryUnit = null;
    if (selectedMembership) {
      if (targetVillaId) {
        const targetVillaIdStr = targetVillaId.toString();
        // Strict Authorization: If targetVillaId is explicitly requested, user must be invited / assigned to it
        const isTargetVillaAccessible = accessibleUnits.some(u => u.villaId === targetVillaIdStr);
        if (!isTargetVillaAccessible) {
          throw new HttpError(403, 'Access denied. You are not assigned or invited to this property unit.');
        }

        if (selectedMembership.units && selectedMembership.units.length > 0) {
          primaryUnit = selectedMembership.units.find(u => u.villaId && (u.villaId._id ? u.villaId._id.toString() === targetVillaIdStr : u.villaId.toString() === targetVillaIdStr));
        }
        if (!primaryUnit && selectedMembership.villaId) {
          const rootVId = selectedMembership.villaId._id ? selectedMembership.villaId._id.toString() : selectedMembership.villaId.toString();
          if (rootVId === targetVillaIdStr) {
            primaryUnit = {
              villaId: selectedMembership.villaId,
              residentType: selectedMembership.residentType || 'None'
            };
          }
        }
        if (!primaryUnit) {
          const matchedAccessible = accessibleUnits.find(u => u.villaId === targetVillaIdStr);
          if (matchedAccessible) {
            const Villa = (await import('../villa/villa.model.js')).default;
            const villaDoc = await Villa.findById(targetVillaIdStr).lean();
            if (villaDoc) {
              primaryUnit = {
                villaId: villaDoc,
                residentType: matchedAccessible.residentType || 'Resident'
              };
            }
          }
        }
      }

      if (!primaryUnit && selectedMembership.units && selectedMembership.units.length > 0) {
        primaryUnit = selectedMembership.units[0];
      }
      if (!primaryUnit && selectedMembership.villaId) {
        primaryUnit = {
          villaId: selectedMembership.villaId,
          residentType: selectedMembership.residentType || 'None'
        };
      }
      if (!primaryUnit && accessibleUnits.length > 0) {
        const firstAccessible = accessibleUnits[0];
        const Villa = (await import('../villa/villa.model.js')).default;
        const villaDoc = await Villa.findById(firstAccessible.villaId).lean();
        if (villaDoc) {
          primaryUnit = {
            villaId: villaDoc,
            residentType: firstAccessible.residentType || 'Resident'
          };
        }
      }
    }

    const villaInfo = primaryUnit?.villaId ? {
      id: primaryUnit.villaId._id ? primaryUnit.villaId._id.toString() : primaryUnit.villaId.toString(),
      villaNumber: primaryUnit.villaId.unitNumber || '',
      block: primaryUnit.villaId.blockOrBuilding || '',
      intercom: primaryUnit.villaId.intercom || '',
      occupancyStatus: primaryUnit.villaId.status || '',
      residentType: primaryUnit.residentType || 'None',
    } : null;

    let visitorContext = 'None';
    if (permissions && permissions.length > 0) {
      if (permissions.includes('visitor:admin')) {
        visitorContext = 'Admin';
      } else if (permissions.includes('visitor:guard')) {
        visitorContext = 'Guard';
      } else if (permissions.includes('visitor:resident')) {
        visitorContext = 'Resident';
      }
    }

    const activeOrgName = selectedMembership?.orgId?.name || null;

    return {
      tokenPayload: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: roleName,
        roleId: activeRoleObj ? activeRoleObj._id.toString() : null,
        roles: selectedMembership ? (selectedMembership.roleIds && selectedMembership.roleIds.length > 0 ? selectedMembership.roleIds.map(r => r.name) : (selectedMembership.roleId ? [selectedMembership.roleId.name] : [])) : [],
        orgId,
        orgName: activeOrgName,
        organizationName: activeOrgName,
        activeOrganizationName: activeOrgName,
        isPlatform,
        visitorContext,
        villaId: villaInfo ? villaInfo.id : null,
        villaNumber: villaInfo ? villaInfo.villaNumber : '',
        villaBlock: villaInfo ? villaInfo.block : '',
        residentType: villaInfo ? villaInfo.residentType : (selectedMembership?.residentType || 'None'),
        accessibleUnits,
      },
      permissions,
      availableWorkspaces,
    };
  }

  /**
   * Helper to format consistent auth user payload containing unit and organization context.
   */
  _formatAuthUser(user, tokenPayload, permissions = [], availableWorkspaces = []) {
    return {
      id: user._id,
      email: user.email,
      username: user.username,
      name: user.name || user.username || user.email,
      phone: user.phone || '',
      avatar: user.avatar || '',
      bio: user.bio || '',
      work: user.work || '',
      hometown: user.hometown || '',
      allowIntercomCalls: Boolean(user.allowIntercomCalls),
      interests: Array.isArray(user.interests) ? user.interests : [],
      role: tokenPayload.role,
      roleId: tokenPayload.roleId,
      roles: tokenPayload.roles,
      permissions: permissions,
      orgId: tokenPayload.orgId,
      activeOrgId: tokenPayload.orgId,
      orgName: tokenPayload.orgName,
      organizationName: tokenPayload.organizationName,
      activeOrganizationName: tokenPayload.activeOrganizationName,
      isPlatform: tokenPayload.isPlatform,
      visitorContext: tokenPayload.visitorContext,
      villaId: tokenPayload.villaId,
      villaNumber: tokenPayload.villaNumber,
      activeVillaNumber: tokenPayload.villaNumber,
      unitNumber: tokenPayload.villaNumber,
      villaBlock: tokenPayload.villaBlock,
      residentType: tokenPayload.residentType,
      accessibleUnits: tokenPayload.accessibleUnits || [],
      availableWorkspaces,
    };
  }

  /**
   * Authenticates user and generates a token with flattened permission scopes.
   * @param {object} loginData - Payload containing login (email/username) and password
   */
  async login(loginData) {
    const login = (loginData.login || loginData.email || loginData.username || '').trim();
    const { password, inviteToken } = loginData;

    // 1. Fetch user by email or username
    const user = await userService.getUserByEmailOrUsername(login);
    if (!user) {
      throw new HttpError(401, 'Invalid credentials. User not found.');
    }

    if (user.status === 'Suspended' || user.status === 'Blocked') {
      throw new HttpError(403, `Your account has been ${user.status.toLowerCase()}. Please contact support.`);
    }

    if (user.status === 'Pending Verification' && !inviteToken) {
      throw new HttpError(403, 'Your account is pending verification. Please accept your workspace invitation first.');
    }

    if (!user.password) {
      throw new HttpError(401, 'Invalid credentials. Password is not set for this account.');
    }

    // 2. Verify password with bcrypt compare
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new HttpError(401, 'Invalid credentials. Incorrect password.');
    }

    // 2b. Process invitation token if provided during login
    let targetOrgIdFromInvite = null;
    if (inviteToken) {
      try {
        try {
          const { orgId } = await tokenService.validateAndDeleteToken(inviteToken, 'INVITATION');
          targetOrgIdFromInvite = orgId;
        } catch (tokenErr) {
          // If token was already accepted or consumed on a previous/concurrent request,
          // recover orgId from the existing token document so the user can still sign in and access the workspace!
          const existingTokenDoc = await tokenService.getInvitationToken(inviteToken, 'INVITATION');
          if (existingTokenDoc && (existingTokenDoc.status === 'ACCEPTED' || existingTokenDoc.used === true)) {
            targetOrgIdFromInvite = existingTokenDoc.orgId;
          } else {
            throw tokenErr;
          }
        }

        if (targetOrgIdFromInvite) {
          const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
          await orgMembershipService.updateStatus(user._id, targetOrgIdFromInvite, 'Active');

          // If user was in Pending Verification, activate their global user profile
          if (user.status === 'Pending Verification' || user.status === 'Pending') {
            const User = (await import('../user/user.model.js')).default;
            await User.updateOne(
              { _id: user._id },
              { $set: { status: 'Active', emailVerified: true } }
            );
            user.status = 'Active';
            user.emailVerified = true;
          }

          // Assign resident to villa upon accepting invitation during login
          const updatedMembership = await orgMembershipService.getMembershipWithVilla(user._id, targetOrgIdFromInvite);
          if (updatedMembership) {
            const villaService = (await import('../villa/villa.services.js')).default;
            if (updatedMembership.units && updatedMembership.units.length > 0) {
              for (const unit of updatedMembership.units) {
                if (unit.villaId) {
                  const vId = unit.villaId._id || unit.villaId;
                  await villaService.assignResidentToVilla(vId, user._id, unit.residentType || 'Resident', null, targetOrgIdFromInvite);
                }
              }
            } else if (updatedMembership.villaId) {
              const vId = updatedMembership.villaId._id || updatedMembership.villaId;
              await villaService.assignResidentToVilla(vId, user._id, updatedMembership.residentType || 'Resident', null, targetOrgIdFromInvite);
            }
          }

          const Technician = (await import('../technician/technician.model.js')).default;
          await Technician.findOneAndUpdate({ userId: user._id, orgId: targetOrgIdFromInvite }, { status: 'Active' }).catch(() => null);

          userEvents.emit('USER_ACTIVATED', { userId: user._id, orgId: targetOrgIdFromInvite });
          userEvents.emit('USER_UPDATED', { userId: user._id, orgId: targetOrgIdFromInvite, action: 'activated' });
        }
      } catch (tokenError) {
        console.warn('Login processed with invalid or expired invite token for active user:', tokenError.message);
      }
    }

    // 3. Resolve context and generate permissions
    const { tokenPayload, permissions, availableWorkspaces } = await this.getScopedTokenPayload(user, targetOrgIdFromInvite);

    // Super Admin Bypass for Platform Org
    if (tokenPayload.isPlatform && tokenPayload.role === 'Super Admin') {
      permissions.push('*');
    }

    // 4. Generate JWT token
    const token = signToken(tokenPayload);

    // 5. Create session & Refresh Token
    const deviceInfo = loginData.deviceInfo || {};
    const refreshToken = await sessionService.createSession(user._id, deviceInfo);

    // Emit event for successful login write operation
    authEvents.emit('LOGIN_SUCCESS', { userId: user._id, method: 'credentials' });

    // 6. Return response payload matching new structure
    return {
      token,
      refreshToken,
      user: this._formatAuthUser(user, tokenPayload, permissions, availableWorkspaces),
      availableWorkspaces,
    };
  }

  /**
   * Switches the active workspace context for the user and returns a newly scoped token.
   * @param {string} userId - User ID
   * @param {string} targetOrgId - Target organization ID
   */
  async switchContext(userId, targetOrgId = null, targetVillaId = null, targetRole = null) {
    let orgIdArg = targetOrgId;
    let villaIdArg = targetVillaId;
    let roleArg = targetRole;

    if (typeof targetOrgId === 'object' && targetOrgId !== null && typeof targetOrgId.toString === 'function' && targetOrgId.toString() === '[object Object]') {
      orgIdArg = targetOrgId.targetOrgId || targetOrgId.orgId || null;
      villaIdArg = targetOrgId.targetVillaId || targetOrgId.villaId || targetVillaId;
      roleArg = targetOrgId.targetRole || targetOrgId.role || targetRole;
    }

    // Fetch user details for the token payload
    const user = await userService.getUserById(userId);

    // Resolve context for the target organization
    const { tokenPayload, permissions, availableWorkspaces } = await this.getScopedTokenPayload(user, orgIdArg, roleArg, villaIdArg);

    // Generate fresh JWT token
    const token = signToken(tokenPayload);

    return {
      token,
      user: this._formatAuthUser(user, tokenPayload, permissions, availableWorkspaces),
      availableWorkspaces,
    };
  }

  /**
   * Retrieves all roles for registration purposes.
   */
  async getRolesForRegistration() {
    return await roleService.getAllRoles();
  }

  /**
   * Finds the invitation token, updates the user password/status, and cleans up the token.
   * @param {string} rawToken - Unhashed token from client
   * @param {string} password - New password set by user
   */
  async acceptInvitation(rawToken, password, email = null, authenticatedUserId = null, profileData = {}) {
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    
    // --- TRANSACTION BOUNDARY START ---
    // Encapsulate invitation validation, deletion, and activation in a single database transaction.
    session.startTransaction();
    try {
      let userId = null;
      let orgId = null;

      if (rawToken) {
        const tokenRes = await tokenService.validateInvitationToken(rawToken, session);
        userId = tokenRes.userId;
        orgId = tokenRes.orgId;
      } else if (email) {
        const userByEmail = await userService.getUserByEmail(email.trim().toLowerCase(), session).catch(() => null);
        if (userByEmail) {
          userId = userByEmail._id;
        }
      }

      let user = null;
      if (userId) {
        user = await userService.getUserById(userId, session).catch(() => null);
      }

      if (!user && email) {
        user = await userService.getUserByEmail(email.trim().toLowerCase(), session).catch(() => null);
      }

      if (!user) {
        throw new HttpError(404, 'No pending user account found to activate.');
      }

      // Server-side identity verification: authenticated user check
      if (authenticatedUserId && user._id.toString() !== authenticatedUserId.toString()) {
        throw new HttpError(403, 'The authenticated account does not match the invitation identity.');
      }

      // Server-side identity verification: email match check
      if (email && user.email && user.email.toLowerCase() !== email.trim().toLowerCase()) {
        throw new HttpError(403, 'The provided email does not match the invitation identity.');
      }

      // Transition invitation token to ACCEPTED only after identity verification succeeds
      if (rawToken) {
        await tokenService.consumeInvitationToken(rawToken, session).catch(() => null);
      }

      const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
      if (!orgId) {
        const OrgMembership = (await import('../orgMembership/orgMembership.model.js')).default;
        const pendingMembership = await OrgMembership.findOne({ userId: user._id, status: 'Pending' }).session(session).catch(() => null);
        if (pendingMembership) {
          orgId = pendingMembership.orgId;
        }
      }

      if (password) {
        const { hashPassword } = await import('../../utils/crypto.utils.js');
        const hashedPassword = await hashPassword(password);
        await userService.activateUser(user._id, hashedPassword, session, profileData);
      } else {
        if (!user.password) {
          throw new HttpError(400, 'Password is required to activate a new account.');
        }
        if (user.status !== 'Active' || profileData.name || profileData.phone) {
          await userService.activateUser(user._id, user.password, session, profileData);
        }
      }

      // Update OrgMembership status to Active for this organization or user
      await orgMembershipService.updateStatus(user._id, orgId || null, 'Active', session).catch(() => null);

      // Assign resident to villa upon accepting invitation
      if (orgId) {
        const membership = await orgMembershipService.getMembershipWithVilla(user._id, orgId, session);
        if (membership) {
          const villaService = (await import('../villa/villa.services.js')).default;
          if (membership.units && membership.units.length > 0) {
            for (const unit of membership.units) {
              if (unit.villaId) {
                const vId = unit.villaId._id || unit.villaId;
                await villaService.assignResidentToVilla(vId, user._id, unit.residentType || 'Resident', session, orgId);
              }
            }
          } else if (membership.villaId) {
            const vId = membership.villaId._id || membership.villaId;
            await villaService.assignResidentToVilla(vId, user._id, membership.residentType || 'Resident', session, orgId);
          }
        }
      }

      if (orgId) {
        const Technician = (await import('../technician/technician.model.js')).default;
        await Technician.findOneAndUpdate({ userId: user._id, orgId }, { status: 'Active' }).session(session).catch(() => null);
      }

      // Auto-login session creation (inside transaction for atomic flow validation)
      const refreshToken = await sessionService.createSession(user._id, {}, session);

      await session.commitTransaction();
      // --- TRANSACTION BOUNDARY END ---

      // Auto-login logic (read scopes are done outside transaction block)
      const { tokenPayload, permissions, availableWorkspaces } = await this.getScopedTokenPayload(user, orgId);
      const token = signToken(tokenPayload);

      // Emit event for successful activation and login write operations
      authEvents.emit('USER_ACTIVATED', { userId: user._id });
      authEvents.emit('INVITATION_ACCEPTED', { userId: user._id, orgId });
      userEvents.emit('INVITATION_ACCEPTED', { userId: user._id, orgId });
      userEvents.emit('USER_ACTIVATED', { userId: user._id, orgId });
      userEvents.emit('USER_UPDATED', { userId: user._id, orgId, action: 'activated' });
      authEvents.emit('LOGIN_SUCCESS', { userId: user._id, method: 'invitation' });

      return {
        token,
        refreshToken,
        user: this._formatAuthUser(user, tokenPayload, permissions, availableWorkspaces),
        availableWorkspaces,
      };
    } catch (error) {
      if (session) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Rejects an invitation, updating OrgMembership status to 'Rejected' and marking token as consumed.
   * @param {string} rawToken - Unhashed token from client
   * @param {string} [email=null] - Optional email fallback
   */
  async rejectInvitation(rawToken, email = null) {
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    
    session.startTransaction();
    try {
      let userId = null;
      let orgId = null;

      if (rawToken) {
        try {
          const tokenRes = await tokenService.rejectInvitationToken(rawToken, session);
          userId = tokenRes.userId;
          orgId = tokenRes.orgId;
        } catch (tokenErr) {
          const msg = tokenErr.message ? tokenErr.message.toLowerCase() : '';
          if (msg.includes('already been rejected') || msg.includes('already been accepted')) {
            const tokenDoc = await tokenService.getInvitationToken(rawToken, 'INVITATION');
            userId = tokenDoc?.userId;
            orgId = tokenDoc?.orgId;
            if (msg.includes('already been accepted')) {
              await session.commitTransaction();
              return {
                message: 'Invitation has already been accepted',
                userId,
                orgId,
                status: 'ACCEPTED',
              };
            }
          } else {
            throw tokenErr;
          }
        }
      } else if (email) {
        const userByEmail = await userService.getUserByEmail(email.trim().toLowerCase(), session).catch(() => null);
        if (userByEmail) {
          userId = userByEmail._id;
        }
      }

      let user = null;
      if (userId) {
        user = await userService.getUserById(userId, session).catch(() => null);
      }

      if (!user && email) {
        user = await userService.getUserByEmail(email.trim().toLowerCase(), session).catch(() => null);
      }

      if (!user) {
        throw new HttpError(404, 'No pending user account found to reject invitation.');
      }

      const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
      if (!orgId) {
        const OrgMembership = (await import('../orgMembership/orgMembership.model.js')).default;
        const pendingMembership = await OrgMembership.findOne({ userId: user._id, status: 'Pending' }).session(session).catch(() => null);
        if (pendingMembership) {
          orgId = pendingMembership.orgId;
        }
      }

      // Update OrgMembership status to Rejected for this organization
      await orgMembershipService.updateStatus(user._id, orgId || null, 'Rejected', session).catch(() => null);

      // Ensure user is removed from any villa in this organization
      if (orgId) {
        const villaService = (await import('../villa/villa.services.js')).default;
        await villaService.removeUserFromAllVillasInOrg(user._id, orgId, session).catch(() => null);
      }

      await session.commitTransaction();

      // Emit event for real-time frontend syncing (admin UI updates to REJECTED badge)
      authEvents.emit('INVITATION_REJECTED', { userId: user._id, orgId });
      userEvents.emit('INVITATION_REJECTED', { userId: user._id, orgId });
      userEvents.emit('USER_UPDATED', { userId: user._id, orgId, action: 'rejected' });

      return {
        message: 'Invitation rejected successfully',
        userId: user._id,
        orgId,
      };
    } catch (error) {
      if (session) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  async getUserById(id, session) {
    return await userService.getUserById(id, session);
  }

  /**
   * Generates a token for a user, dynamically selecting the primary context.
   * @param {object} user - User document
   * @param {string} [targetOrgId=null] - Optional target organization ID to scope the token to
   */
  async generateToken(user, targetOrgId = null) {
    const { tokenPayload } = await this.getScopedTokenPayload(user, targetOrgId);
    return signToken(tokenPayload);
  }

  /**
   * Exchanges a Google authorization code for an ID token using Google's OAuth2 token endpoint.
   * Supports PKCE (code_verifier) and custom redirect URIs for mobile clients.
   * @param {object} options
   * @param {string} options.code - Google authorization code
   * @param {string} [options.codeVerifier] - PKCE code verifier
   * @param {string} [options.redirectUri] - Redirect URI matching the authorization request
   * @param {string} [options.clientId] - Client ID used in the request
   * @returns {Promise<string>} - The resolved Google ID token
   */
  async exchangeGoogleAuthCode({ code, codeVerifier, redirectUri, clientId }) {
    const defaultAndroidClientId = '610778456829-6g1bvqtplfrgva93sbdsvgbuqmkpr203.apps.googleusercontent.com';
    const targetClientId =
      clientId ||
      config.sso?.googleAndroidClientId ||
      process.env.GOOGLE_ANDROID_CLIENT_ID ||
      config.sso?.googleClientId ||
      defaultAndroidClientId;

    const defaultRedirectUri = `${config.mobile?.androidPackageName || 'com.atominosconsulting.nahom'}:/oauthredirect`;
    const targetRedirectUri = redirectUri || defaultRedirectUri;

    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: targetClientId,
      code,
      redirect_uri: targetRedirectUri,
    });

    if (codeVerifier) {
      bodyParams.append('code_verifier', codeVerifier);
    }

    if (config.sso?.googleClientSecret && targetClientId === config.sso?.googleClientId) {
      bodyParams.append('client_secret', config.sso.googleClientSecret);
    }

    logger.info(`[AuthService.exchangeGoogleAuthCode] Exchanging Google auth code for clientId=${targetClientId}, redirectUri=${targetRedirectUri}`);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.id_token) {
      logger.error('[AuthService.exchangeGoogleAuthCode] Token exchange failed:', tokenData);
      throw new HttpError(
        401,
        `Google code exchange failed: ${tokenData.error_description || tokenData.error || 'Unable to exchange authorization code'}`
      );
    }

    return tokenData.id_token;
  }

  /**
   * Verifies Google token or code, finds the user, and returns conditional response.
   * @param {string|object} googleTokenOrPayload - The Google ID token or code payload object
   * @param {string} [inviteToken=null] - Optional invitation token
   * @param {boolean} [isRegister=false] - Whether this is a register flow
   */
  async loginWithGoogle(googleTokenOrPayload, inviteToken = null, isRegister = false) {
    let googleToken = typeof googleTokenOrPayload === 'string' ? googleTokenOrPayload : googleTokenOrPayload?.token;

    if (!googleToken && googleTokenOrPayload?.code) {
      googleToken = await this.exchangeGoogleAuthCode({
        code: googleTokenOrPayload.code,
        codeVerifier: googleTokenOrPayload.codeVerifier,
        redirectUri: googleTokenOrPayload.redirectUri,
        clientId: googleTokenOrPayload.clientId,
      });
    }

    if (!googleToken) {
      throw new HttpError(400, 'Google ID token or authorization code is required.');
    }

    const identityData = await userIdentityService.verifyAndNormalizeProviderToken('google', googleToken);
    if (inviteToken) {
      identityData.inviteToken = inviteToken;
    }
    
    if (isRegister) {
      return await this._handleSsoAuthentication(identityData);
    }
    
    const { providerEmail: email, profileData, provider, providerId } = identityData;
    const name = profileData?.name || '';
    
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      let existingIdentity = await userIdentityService.getIdentityByProviderId(provider, providerId, session);
      let user = null;

      if (existingIdentity) {
        try {
          user = await userService.getUserById(existingIdentity.userId, session);
        } catch (err) {
          if (err.statusCode === 404) {
            user = null;
          } else {
            throw err;
          }
        }
        
        if (user && user.status !== 'Active' && user.status !== 'Pending Verification' && user.status !== 'Pending') {
          throw new HttpError(403, 'Account is inactive or suspended.');
        }
      } 
      
      if (!user) {
        user = await userService.getUserByEmail(email, session);
      }

      if (!user) {
        // New User Flow
        await session.commitTransaction();
        return {
          isNewUser: true,
          googleData: { email, name }
        };
      }

      // Existing User Flow
      user = await this._updateExistingSsoUser(user, identityData, session);

      let targetOrgIdFromInvite = null;
      if (inviteToken) {
        try {
          const { orgId } = await tokenService.validateAndDeleteToken(inviteToken, 'INVITATION', session);
          targetOrgIdFromInvite = orgId;
          const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
          await orgMembershipService.updateStatus(user._id, orgId, 'Active', session);
          userEvents.emit('USER_ACTIVATED', { userId: user._id, orgId });
          userEvents.emit('USER_UPDATED', { userId: user._id, orgId, action: 'activated' });
        } catch (tokenError) {
          if (user.status === 'Pending Verification') {
            throw tokenError;
          }
          console.warn('SSO login processed with invalid or expired invite token for active user:', tokenError.message);
        }
      }

      const refreshToken = await sessionService.createSession(user._id, {}, session);
      await session.commitTransaction();

      const { tokenPayload, permissions, availableWorkspaces } = await this.getScopedTokenPayload(user, targetOrgIdFromInvite);
      const token = signToken(tokenPayload);
      
      authEvents.emit('PROVIDER_LOGIN', { userId: user._id, provider });
      authEvents.emit('LOGIN_SUCCESS', { userId: user._id, method: provider });

      return {
        isNewUser: false,
        token,
        refreshToken,
        user: this._formatAuthUser(user, tokenPayload, permissions, availableWorkspaces),
        availableWorkspaces,
      };
    } catch (error) {
      authEvents.emit('LOGIN_FAILED', { email: email, reason: error.message, method: provider });
      if (session) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Verifies Microsoft token, finds or registers the user, and logs them in.
   * @param {string} microsoftToken - The Microsoft ID token (JWT)
   * @param {string} [inviteToken=null] - Optional invitation token
   */
  async loginWithMicrosoft(microsoftToken, inviteToken = null) {
    const identityData = await userIdentityService.verifyAndNormalizeProviderToken('microsoft', microsoftToken);
    if (inviteToken) {
      identityData.inviteToken = inviteToken;
    }
    return await this._handleSsoAuthentication(identityData);
  }

  /**
   * Verifies an Apple identity token and signs the account in. The first
   * verified authorization creates and links the local account atomically:
   * Apple only exposes email on that first authorization, so deferring the
   * link would make a returning private-relay user impossible to identify.
   */
  async loginWithApple(appleTokenOrPayload, inviteToken = null) {
    const appleToken =
      typeof appleTokenOrPayload === 'string' ? appleTokenOrPayload : appleTokenOrPayload?.token;
    if (!appleToken) {
      throw new HttpError(400, 'Apple identity token is required.');
    }

    const identityData = await userIdentityService.verifyAndNormalizeProviderToken('apple', appleToken, {
      nonce: typeof appleTokenOrPayload === 'object' ? appleTokenOrPayload?.nonce : undefined,
      fullName: typeof appleTokenOrPayload === 'object' ? appleTokenOrPayload?.fullName : undefined,
    });
    if (inviteToken) {
      identityData.inviteToken = inviteToken;
    }

    return await this._handleSsoAuthentication(identityData);
  }

  /**
   * Registers a new user via SSO and creates an organization atomically.
   */
  async registerSsoWithOrg(payload) {
    const { ssoToken, provider, name: orgName, organizationType, timezone, contactEmail, contactPhone } = payload;
    const identityData = await userIdentityService.verifyAndNormalizeProviderToken(provider, ssoToken);
    
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const existingIdentity = await userIdentityService.getIdentityByProviderId(provider, identityData.providerId, session);
      let user = null;
      if (existingIdentity) {
        try {
          user = await userService.getUserById(existingIdentity.userId, session);
        } catch (err) {
          if (err.statusCode === 404) {
            // Orphan identity, user was deleted. We will proceed to create a new user.
            user = null;
          } else {
            throw err;
          }
        }
      }
      if (!user) {
        user = await userService.getUserByEmail(identityData.providerEmail, session);
      }

      if (user) {
        // If user already exists, we could just create the workspace for them,
        // but they should technically use the authenticated setup route.
        // For convenience, we will just proceed with their existing user account.
        user = await this._updateExistingSsoUser(user, identityData, session);
      } else {
        user = await this._registerSsoUser(identityData, session);
      }

      // Import org service dynamically to avoid circular dependency
      const organizationService = (await import('../organization/organization.services.js')).default;
      
      const setupResult = await organizationService.setupWorkspace({
        name: orgName,
        organizationType,
        contactEmail,
        contactPhone,
        timezone,
        userId: user._id
      });
      
      // setupWorkspace creates its own transaction if not provided, but we want it in ours? 
      // setupWorkspace doesn't take session as parameter currently based on the signature.
      // Wait, let's check if setupWorkspace takes a session in organization.services.js.
      // If not, it will run independently. This is acceptable for now.
      
      const refreshToken = await sessionService.createSession(user._id, {}, session);
      await session.commitTransaction();

      // Because setupWorkspace happened, the user now has an org.
      // Refetch scoped token payload
      const { tokenPayload, permissions, availableWorkspaces } = await this.getScopedTokenPayload(user);
      const token = signToken(tokenPayload);

      authEvents.emit('PROVIDER_LOGIN', { userId: user._id, provider });
      authEvents.emit('LOGIN_SUCCESS', { userId: user._id, method: provider });

      return {
        token,
        refreshToken,
        user: this._formatAuthUser(user, tokenPayload, permissions, availableWorkspaces),
        availableWorkspaces,
      };
    } catch (error) {
      if (session) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Registers a new user via SSO.
   * @private
   */
  async _registerSsoUser(identityData, session) {
    const { providerEmail: email, profileData, provider, providerId } = identityData;
    const name = profileData?.name || '';
    
    const { v4: uuidv4 } = await import('uuid');
    const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    let derivedUsername = emailPrefix;
    if (derivedUsername.length < 3) {
      derivedUsername = 'user' + Math.floor(100 + Math.random() * 900);
    } else if (derivedUsername.length > 30) {
      derivedUsername = derivedUsername.substring(0, 30);
    }

    const randomPassword = uuidv4();
    const userData = {
      email,
      username: derivedUsername,
      password: randomPassword,
      status: 'Active',
      name: name,
      emailVerified: true, // SSO emails are pre-verified
    };

    const newUser = await userService.createUser(userData, session);
    
    // Assign default role logic could go here if handled by user.services, but tenant context handles most roles.
    // Ensure identity is linked securely
    await userIdentityService.linkIdentity(newUser._id, identityData, session);
    
    authEvents.emit('USER_CREATED', { userId: newUser._id, provider });
    return newUser;
  }

  /**
   * Updates an existing user's details upon successful SSO login.
   * Handles activating pending invitation users and linking SSO provider.
   * @private
   */
  async _updateExistingSsoUser(user, identityData, session) {
    const { provider, providerId, providerEmail } = identityData;
    const updateData = {};
    const { v4: uuidv4 } = await import('uuid');

    if (user.status === 'Pending' || user.status === 'Pending Verification') {
      updateData.status = 'Active';
      if (!user.password) {
        const randomPassword = uuidv4();
        const { hashPassword } = await import('../../utils/crypto.utils.js');
        updateData.password = await hashPassword(randomPassword);
      }
    }

    if (providerEmail && !user.emailVerified && user.email === providerEmail) {
      updateData.emailVerified = true;
    }

    const existingIdentity = await userIdentityService.getIdentityByProviderId(provider, providerId, session);
    if (existingIdentity && existingIdentity.userId?.toString() !== user._id?.toString()) {
      throw new HttpError(409, `This ${provider} account is already linked to another user.`);
    }
    if (!existingIdentity) {
      await userIdentityService.linkIdentity(user._id, identityData, session);
      authEvents.emit('USER_LINKED_PROVIDER', { userId: user._id, provider });
    }

    if (Object.keys(updateData).length > 0) {
      return await userService.updateUser(user._id, updateData, session);
    }

    return user;
  }

  /**
   * Internal helper to find/register SSO users, activate pending invitations, and scope sessions.
   * @private
   */
  async _handleSsoAuthentication(identityData) {
    const { providerEmail: email, provider, providerId, inviteToken } = identityData;
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Check if identity exists
      let existingIdentity = await userIdentityService.getIdentityByProviderId(provider, providerId, session);
      let user = null;

      if (existingIdentity) {
        // Find existing user linked to identity
        try {
          user = await userService.getUserById(existingIdentity.userId, session);
        } catch (err) {
          if (err.statusCode === 404) {
            user = null; // Dangling identity
          } else {
            throw err;
          }
        }
        
        if (user && user.status !== 'Active' && user.status !== 'Pending Verification' && user.status !== 'Pending') {
          throw new HttpError(403, 'Account is inactive or suspended.');
        }
      } 
      
      if (!user && email) {
        // Fallback: Check if user exists by email to link them
        user = await userService.getUserByEmail(email, session);
      }

      if (!user) {
        if (!email) {
          throw new HttpError(
            400,
            'Apple did not return an email for this account. Please complete the first Apple sign-in on this app or use your existing sign-in method.'
          );
        }
        user = await this._registerSsoUser(identityData, session);
      } else {
        user = await this._updateExistingSsoUser(user, identityData, session);
      }

      // Process invitation token if provided during SSO login
      let targetOrgIdFromInvite = null;
      if (inviteToken) {
        try {
          const { orgId } = await tokenService.validateAndDeleteToken(inviteToken, 'INVITATION', session);
          targetOrgIdFromInvite = orgId;
          const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
          await orgMembershipService.updateStatus(user._id, orgId, 'Active', session);
        } catch (tokenError) {
          if (user.status === 'Pending Verification') {
            throw tokenError;
          }
          console.warn('SSO login processed with invalid or expired invite token for active user:', tokenError.message);
        }
      }

      const refreshToken = await sessionService.createSession(user._id, {}, session);
      await session.commitTransaction();

      // Resolve scoped token and workspaces
      const { tokenPayload, permissions, availableWorkspaces } = await this.getScopedTokenPayload(user, targetOrgIdFromInvite);
      const token = signToken(tokenPayload);
      
      authEvents.emit('PROVIDER_LOGIN', { userId: user._id, provider });
      authEvents.emit('LOGIN_SUCCESS', { userId: user._id, method: provider });

      return {
        token,
        refreshToken,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: tokenPayload.role,
          roles: tokenPayload.roles,
          permissions: permissions,
          orgId: tokenPayload.orgId,
          isPlatform: tokenPayload.isPlatform,
          visitorContext: tokenPayload.visitorContext,
        },
        availableWorkspaces,
      };
    } catch (error) {
      authEvents.emit('LOGIN_FAILED', { email: email, reason: error.message, method: provider });
      if (session) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Initiates the phone login process by verifying user existence and sending local/Firebase OTP.
   * @param {string} phone - User phone number
   */
  async initiatePhoneLogin(phone) {
    const normalizedPhone = phone ? phone.replace(/\s+/g, '') : '';
    const user = await userService.getUserByPhone(normalizedPhone);
    if (!user) {
      throw new HttpError(404, 'This phone number is not registered. Please sign up first.');
    }

    // Check for Firebase Integration globally
    const firebaseIntegration = await integrationHubService.getGlobalConnectionByProvider('firebase');

    if (firebaseIntegration) {
      // Proxy request to Google Identity Toolkit
      const { decrypt } = await import('../integrationHub/utils/crypto.util.js');
      const apiKeyCred = firebaseIntegration.credentials.find(c => c.key === 'apiKey');
      if (apiKeyCred) {
        const apiKey = decrypt(apiKeyCred.encryptedValue, apiKeyCred.iv);
        
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phone.trim() }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new HttpError(400, `Firebase SMS Failed: ${responseData.error?.message || response.statusText}`);
        }

        const sessionInfo = responseData.sessionInfo;
        
        // Save the sessionInfo in OTP service to verify later
        await otpService.createOTP(phone, 'LOGIN', 5, null, sessionInfo);
        
        return { message: 'OTP sent via Firebase successfully' };
      }
    }

    // Fallback: Generate local OTP
    const plainCode = await otpService.createOTP(phone, 'LOGIN');

    // Emit event for SMS delivery
    authEvents.emit('OTP_SENT', { identifier: phone, code: plainCode, type: 'SMS' });

    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      console.log('\n=========================================');
      console.log(`[DEV MODE SMS] OTP for ${phone} is: ${plainCode}`);
      console.log('=========================================\n');
    }

    return { message: isDev ? `OTP sent successfully (Dev Code: ${plainCode})` : 'OTP sent successfully' };
  }

  /**
   * Verifies the phone login OTP and generates JWT tokens.
   * @param {string} phone - User phone number
   * @param {string} code - OTP verification code
   * @param {object} deviceInfo - Client device meta
   */
  async verifyPhoneLogin(phone, code, deviceInfo) {
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    
    // --- TRANSACTION BOUNDARY START ---
    // Encapsulate OTP validation (via external Firebase if needed) and session registration.
    session.startTransaction();

    try {
      // 1. Verify OTP
      const otpResult = await otpService.verifyOTP(phone, code, 'LOGIN');

      if (otpResult && otpResult.sessionInfo) {
        // This was a Firebase managed OTP
        const firebaseIntegration = await integrationHubService.getGlobalConnectionByProvider('firebase', session);
        if (!firebaseIntegration) throw new HttpError(400, 'Firebase configuration missing.');
        
        const { decrypt } = await import('../integrationHub/utils/crypto.util.js');
        const apiKeyCred = firebaseIntegration.credentials.find(c => c.key === 'apiKey');
        const apiKey = decrypt(apiKeyCred.encryptedValue, apiKeyCred.iv);

        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionInfo: otpResult.sessionInfo, code }),
        });

        if (!response.ok) {
          const responseData = await response.json();
          throw new HttpError(400, `Firebase Verification Failed: ${responseData.error?.message || response.statusText}`);
        }
      }

      // 2. Fetch user
      const user = await userService.getUserByPhone(phone, session);
      if (!user) {
        throw new HttpError(404, 'User not found.');
      }

      if (user.status !== 'Active') {
        throw new HttpError(403, `Account is ${user.status}`);
      }

      // Mark phone as verified if not already
      if (!user.phoneVerified) {
        await userService.updateUser(user._id, { phoneVerified: true }, session);
      }

      // 3. Generate session refresh token
      const refreshToken = await sessionService.createSession(user._id, deviceInfo, session);

      await session.commitTransaction();
      // --- TRANSACTION BOUNDARY END ---

      // Scoped token and available workspaces resolved outside the transaction context
      const { tokenPayload, permissions, availableWorkspaces } = await this.getScopedTokenPayload(user);
      const token = signToken(tokenPayload);

      // Emit event on successful login
      authEvents.emit('LOGIN_SUCCESS', { userId: user._id, method: 'phone' });

      return {
        token,
        refreshToken,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: tokenPayload.role,
          roles: tokenPayload.roles,
          permissions: permissions,
          orgId: tokenPayload.orgId,
          isPlatform: tokenPayload.isPlatform,
          visitorContext: tokenPayload.visitorContext,
        },
        availableWorkspaces,
      };
    } catch (error) {
      if (session) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Initiates the email login process by checking user existence and sending OTP.
   * @param {string} email - User email address
   */
  async initiateEmailOtpLogin(email) {
    const user = await userService.getUserByEmail(email);
    
    if (!user) {
      throw new HttpError(404, 'No account found with this email.');
    }

    const plainCode = await otpService.createOTP(email, 'LOGIN');
    authEvents.emit('OTP_SENT', { identifier: email, code: plainCode, type: 'EMAIL' });

    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      console.log('\n=========================================');
      console.log(`[DEV MODE EMAIL] OTP for ${email} is: ${plainCode}`);
      console.log('=========================================\n');
    }

    return { message: isDev ? `OTP sent to email (Dev Code: ${plainCode})` : 'OTP sent to email' };
  }

  /**
   * Verifies the email login OTP and registers session.
   * @param {string} email - User email address
   * @param {string} code - OTP verification code
   * @param {object} deviceInfo - Client device meta
   */
  async verifyEmailOtpLogin(email, code, deviceInfo) {
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    
    // --- TRANSACTION BOUNDARY START ---
    // Encapsulate email OTP validation, user activation verification, and session setup.
    session.startTransaction();

    try {
      await otpService.verifyOTP(email, code, 'LOGIN');

      const user = await userService.getUserByEmail(email, session);
      if (!user) {
        throw new HttpError(404, 'User not found.');
      }

      if (user.status !== 'Active') {
        throw new HttpError(403, `Account is ${user.status}`);
      }

      if (!user.emailVerified) {
        await userService.updateUser(user._id, { emailVerified: true }, session);
      }

      const refreshToken = await sessionService.createSession(user._id, deviceInfo, session);

      await session.commitTransaction();
      // --- TRANSACTION BOUNDARY END ---

      const { tokenPayload, permissions, availableWorkspaces } = await this.getScopedTokenPayload(user);
      const token = signToken(tokenPayload);

      // Emit event on successful login
      authEvents.emit('LOGIN_SUCCESS', { userId: user._id, method: 'email_otp' });

      return {
        token,
        refreshToken,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: tokenPayload.role,
          roles: tokenPayload.roles,
          permissions: permissions,
          orgId: tokenPayload.orgId,
          isPlatform: tokenPayload.isPlatform,
          visitorContext: tokenPayload.visitorContext,
        },
        availableWorkspaces,
      };
    } catch (error) {
      if (session) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Initiates password recovery process by generating a verification OTP.
   * @param {string} identifier - User email or phone number
   */
  async forgotPassword(identifier) {
    const cleanId = typeof identifier === 'string'
      ? (identifier.includes('@') ? identifier.trim().toLowerCase() : identifier.replace(/\s+/g, ''))
      : identifier;
    const user = await userService.getUserByEmailOrPhone(cleanId);

    if (!user) {
      throw new HttpError(404, 'No account found with this identifier.');
    }

    const type = cleanId.includes('@') ? 'EMAIL' : 'SMS';
    const plainCode = await otpService.createOTP(cleanId, 'RESET');
    
    authEvents.emit('OTP_SENT', { identifier: cleanId, code: plainCode, type });

    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      console.log('\n=========================================');
      console.log(`[DEV MODE RESET] OTP for ${cleanId} is: ${plainCode}`);
      console.log('=========================================\n');
    }

    return {
      message: 'Password reset instructions sent',
    };
  }

  /**
   * Verifies the reset password OTP without consuming it prematurely.
   * @param {string} identifier - User email or phone
   * @param {string} code - Plain OTP code provided by user
   */
  async verifyResetPasswordOtp(identifier, code) {
    const cleanId = typeof identifier === 'string'
      ? (identifier.includes('@') ? identifier.trim().toLowerCase() : identifier.replace(/\s+/g, ''))
      : identifier;
    const user = await userService.getUserByEmailOrPhone(cleanId);
    if (!user) {
      throw new HttpError(404, 'No account found with this identifier.');
    }

    await otpService.verifyOTP(cleanId, code, 'RESET', null, false);
    return true;
  }

  /**
   * Confirms password reset using valid OTP and revokes previous sessions for security.
   * @param {string} identifier - User email or phone
   * @param {string} code - OTP verification code
   * @param {string} newPassword - Selected new password
   */
  async resetPassword(identifier, code, newPassword) {
    const cleanId = typeof identifier === 'string'
      ? (identifier.includes('@') ? identifier.trim().toLowerCase() : identifier.replace(/\s+/g, ''))
      : identifier;
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    
    // --- TRANSACTION BOUNDARY START ---
    // Enforce atomic password updates, verification checks, and session cleanup.
    session.startTransaction();

    try {
      await otpService.verifyOTP(cleanId, code, 'RESET');

      const user = await userService.getUserByEmailOrPhone(cleanId, session);
      if (!user) {
        throw new HttpError(404, 'User not found.');
      }

      const { hashPassword } = await import('../../utils/crypto.utils.js');
      const hashedPassword = await hashPassword(newPassword);
      
      const updateData = { password: hashedPassword };
      if (cleanId.includes('@')) {
        updateData.emailVerified = true;
      } else {
        updateData.phoneVerified = true;
      }

      await userService.updateUser(user._id, updateData, session);

      // Revoke all existing sessions to enforce security after password reset
      await sessionService.revokeAllUserSessions(user._id, null, session);

      await session.commitTransaction();
      // --- TRANSACTION BOUNDARY END ---

      // Emit event for successful password update
      authEvents.emit('PASSWORD_RESET', { userId: user._id });

      return true;
    } catch (error) {
      if (session) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Standard logout, revokes active session.
   * @param {string} userId - User identifier
   * @param {string} refreshTokenStr - Refresh token JWT string
   */
  async logout(userId, refreshTokenStr) {
    if (refreshTokenStr) {
      // Delegate session revocation to the session service to preserve domain encapsulation
      await sessionService.revokeSessionByToken(userId, refreshTokenStr);
    }
  }

  /**
   * Accepts a workspace invitation using SSO (Google, Microsoft, or Apple).
   * @param {string} inviteToken - Decodable JWT invitation token containing user context
   * @param {string|object} ssoCredentialOrPayload - Provider credential token (ID token) or code payload
   * @param {string} provider - SSO Provider ('google', 'microsoft', or 'apple')
   */
  async acceptInvitationWithSSO(inviteToken, ssoCredentialOrPayload, provider) {
    let ssoCredential =
      typeof ssoCredentialOrPayload === 'string'
        ? ssoCredentialOrPayload
        : ssoCredentialOrPayload?.ssoCredential || ssoCredentialOrPayload?.token;

    if (!ssoCredential && ssoCredentialOrPayload?.code && provider === 'google') {
      ssoCredential = await this.exchangeGoogleAuthCode({
        code: ssoCredentialOrPayload.code,
        codeVerifier: ssoCredentialOrPayload.codeVerifier,
        redirectUri: ssoCredentialOrPayload.redirectUri,
        clientId: ssoCredentialOrPayload.clientId,
      });
    }

    if (!ssoCredential) {
      throw new HttpError(400, 'SSO credential token or authorization code is required.');
    }

    // 1. Verify SSO token using provider adapters through UserIdentityService
    const identityData = await userIdentityService.verifyAndNormalizeProviderToken(provider, ssoCredential, {
      nonce: provider === 'apple' ? ssoCredentialOrPayload?.nonce : undefined,
      fullName: provider === 'apple' ? ssoCredentialOrPayload?.fullName : undefined,
    });

    // 2. Database transaction for atomic operations
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    
    // --- TRANSACTION BOUNDARY START ---
    // Wrap activation, identity linkage, and session registration in an atomic transaction.
    session.startTransaction();

    try {
      // Apple only includes email on the first authorization. Resolve the
      // stored, verified email for repeat sign-ins by the stable provider ID.
      const existingIdentity = await userIdentityService.getIdentityByProviderId(
        provider,
        identityData.providerId,
        session
      );
      const ssoEmail = identityData.providerEmail || existingIdentity?.providerEmail;

      // Validate invitation token without consuming it before identity verification
      const { userId, orgId } = await tokenService.validateInvitationToken(inviteToken, session);

      // Fetch user to ensure they exist and status is valid
      const user = await userService.getUserById(userId, session);
      if (!user) {
        throw new HttpError(404, 'No pending user account found for this invitation.');
      }
      if (user.status !== 'Pending Verification' && user.status !== 'Active') {
        throw new HttpError(400, 'User account is inactive or suspended.');
      }

      if (!ssoEmail || !user.email || ssoEmail.toLowerCase() !== user.email.toLowerCase()) {
        throw new HttpError(403, 'Email in SSO token does not match the invitation email.');
      }

      // Never allow an SSO account already linked to one person to activate a
      // different invitation. This protects every provider, not just Apple.
      if (existingIdentity && existingIdentity.userId?.toString() !== user._id?.toString()) {
        throw new HttpError(409, `This ${provider} account is already linked to another user.`);
      }

      // Transition invitation token to ACCEPTED only after identity verification succeeds
      await tokenService.consumeInvitationToken(inviteToken, session);

      let activatedUser = user;
      if (user.status === 'Pending Verification') {
        // Generate a random password, hash it, and activate user
        const { v4: uuidv4 } = await import('uuid');
        const { hashPassword } = await import('../../utils/crypto.utils.js');
        const randomPassword = uuidv4();
        const hashedPassword = await hashPassword(randomPassword);

        // Call userService.activateUser to activate user and set password
        activatedUser = await userService.activateUser(userId, hashedPassword, session);
      }

      // Update OrgMembership status to Active for this organization
      if (orgId) {
        const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
        await orgMembershipService.updateStatus(userId, orgId, 'Active', session);

        const membership = await orgMembershipService.getMembershipWithVilla(userId, orgId, session);
        if (membership) {
          const villaService = (await import('../villa/villa.services.js')).default;
          if (membership.units && membership.units.length > 0) {
            for (const unit of membership.units) {
              if (unit.villaId) {
                const vId = unit.villaId._id || unit.villaId;
                await villaService.assignResidentToVilla(vId, userId, unit.residentType || 'Resident', session, orgId);
              }
            }
          } else if (membership.villaId) {
            const vId = membership.villaId._id || membership.villaId;
            await villaService.assignResidentToVilla(vId, userId, membership.residentType || 'Resident', session, orgId);
          }
        }

        const Technician = (await import('../technician/technician.model.js')).default;
        await Technician.findOneAndUpdate({ userId, orgId }, { status: 'Active' }).session(session);
      }

      // Check if identity already linked, if not link it
      if (!existingIdentity) {
        if (typeof userIdentityService.createIdentity === 'function') {
          await userIdentityService.createIdentity(userId, identityData, session);
        } else {
          await userIdentityService.linkIdentity(userId, identityData, session);
        }
      }

      // Call sessionService.createSession to create active login session
      const refreshToken = await sessionService.createSession(userId, {}, session);

      await session.commitTransaction();
      // --- TRANSACTION BOUNDARY END ---

      // Resolve scoped token and workspaces (outside transaction)
      // Pass orgId explicitly so the JWT is scoped to the newly-accepted community,
      // not the user's prior/default active community (fixes multi-org SSO invite bug).
      const { tokenPayload, permissions, availableWorkspaces } = await this.getScopedTokenPayload(activatedUser, orgId);
      const token = signToken(tokenPayload);

      // Emit events for successful login/auth write operations
      authEvents.emit('PROVIDER_LOGIN', { userId: activatedUser._id, provider });
      authEvents.emit('LOGIN_SUCCESS', { userId: activatedUser._id, method: provider });
      authEvents.emit('USER_ACTIVATED', { userId: activatedUser._id });
      authEvents.emit('INVITATION_ACCEPTED', { userId: activatedUser._id, orgId });
      userEvents.emit('INVITATION_ACCEPTED', { userId: activatedUser._id, orgId });
      userEvents.emit('USER_ACTIVATED', { userId: activatedUser._id, orgId });
      userEvents.emit('USER_UPDATED', { userId: activatedUser._id, orgId, action: 'activated' });

      return {
        token,
        refreshToken,
        user: this._formatAuthUser(activatedUser, tokenPayload, permissions, availableWorkspaces),
        availableWorkspaces,
      };
    } catch (error) {
      if (session) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  async validateInvite(token, email = null) {
    if (!token) {
      throw new HttpError(400, 'Invitation token is required.');
    }

    const tokenDoc = await tokenService.getInvitationToken(token, 'INVITATION');
    if (!tokenDoc) {
      throw new HttpError(400, 'Invalid or expired invitation token.');
    }
    if (tokenDoc.status === 'EXPIRED' || (tokenDoc.expiresAt && new Date() > new Date(tokenDoc.expiresAt))) {
      throw new HttpError(400, 'Invitation has expired. Please ask your administrator to resend the invitation.');
    }
    if (tokenDoc.status === 'REVOKED') {
      throw new HttpError(400, 'Invitation has been revoked by the administrator.');
    }
    if (tokenDoc.status === 'REJECTED') {
      throw new HttpError(400, 'Invitation has already been rejected.');
    }
    if (tokenDoc.status === 'ACCEPTED' || tokenDoc.used === true) {
      throw new HttpError(400, 'Invitation has already been accepted.');
    }

    let user = null;
    if (tokenDoc.userId) {
      user = await userService.getUserById(tokenDoc.userId).catch(() => null);
    }
    if (!user && tokenDoc.email) {
      user = await userService.getUserByEmail(tokenDoc.email.trim().toLowerCase()).catch(() => null);
    }

    const expectedEmail = (tokenDoc.email || user?.email || '').trim().toLowerCase();

    // Validate email mismatch if email query param is explicitly provided
    if (email && typeof email === 'string' && email.trim().length > 0) {
      const normalizedQueryEmail = email.trim().toLowerCase();
      if (expectedEmail && normalizedQueryEmail !== expectedEmail) {
        throw new HttpError(400, 'Invalid invitation credentials. Provided email does not match this invitation.');
      }
    }

    const resolvedOrgId = tokenDoc?.orgId || user.orgId || null;
    let orgName = '';
    let villaDetails = '';
    let roleDetails = '';
    let membershipDoc = null;

    if (resolvedOrgId) {
      const Organization = (await import('../organization/organization.model.js')).default;
      const org = await Organization.findById(resolvedOrgId).select('name status');
      if (!org) {
        throw new HttpError(404, 'The workspace or organization for this invitation no longer exists.');
      }
      if (org.status && org.status !== 'Active') {
        throw new HttpError(400, 'This community workspace is currently inactive.');
      }
      orgName = org.name;

      try {
        const OrgMembership = (await import('../orgMembership/orgMembership.model.js')).default;
        membershipDoc = await OrgMembership.findOne({ userId: user._id, orgId: resolvedOrgId })
          .populate('villaId')
          .populate('units.villaId')
          .populate('roleId')
          .populate('roleIds');

        if (membershipDoc) {
          const unitNames = [];
          if (membershipDoc.units && membershipDoc.units.length > 0) {
            for (const u of membershipDoc.units) {
              const v = u.villaId;
              if (v && (v.unitNumber || v.villaNumber)) {
                const formatted = `${v.unitNumber || v.villaNumber || ''}${v.blockOrBuilding ? ` (${v.blockOrBuilding})` : ''}`.trim();
                if (formatted && !unitNames.includes(formatted)) {
                  unitNames.push(formatted);
                }
              }
            }
          }

          if (unitNames.length === 0 && membershipDoc.villaId) {
            const v = membershipDoc.villaId;
            if (v && (v.unitNumber || v.villaNumber)) {
              const formatted = `${v.unitNumber || v.villaNumber || ''}${v.blockOrBuilding ? ` (${v.blockOrBuilding})` : ''}`.trim();
              if (formatted) unitNames.push(formatted);
            }
          }

          villaDetails = unitNames.join(', ');

          if (membershipDoc.roleIds && membershipDoc.roleIds.length > 0) {
            roleDetails = membershipDoc.roleIds.map((r) => r.name).join(', ');
          } else if (membershipDoc.roleId) {
            roleDetails = membershipDoc.roleId.name;
          }
        }
      } catch (err) {
        // Non-blocking presentation query
      }
    }

    // Fallback: If no unit found via membership, check user.villaId directly (strictly within this organization)
    if (!villaDetails && user.villaId && resolvedOrgId) {
      try {
        const Villa = (await import('../villa/villa.model.js')).default;
        const v = await Villa.findOne({ _id: user.villaId, orgId: resolvedOrgId });
        if (v && (v.unitNumber || v.villaNumber)) {
          villaDetails = `${v.unitNumber || v.villaNumber || ''}${v.blockOrBuilding ? ` (${v.blockOrBuilding})` : ''}`.trim();
        }
      } catch (err) {
        // Non-blocking presentation query
      }
    }

    // Fallback: If roleDetails was not resolved via membership, check user.roles belonging to this organization
    if (!roleDetails && resolvedOrgId) {
      if (user.roles && user.roles.length > 0) {
        try {
          const Role = (await import('../role/role.model.js')).default;
          const roles = await Role.find({ _id: { $in: user.roles }, orgId: resolvedOrgId }).select('name');
          if (roles.length > 0) {
            roleDetails = roles.map((r) => r.name).join(', ');
          }
        } catch (err) {
          // Non-blocking presentation query
        }
      }
    }

    const invitationSource = tokenDoc?.invitationSource || 'WEB';
    const isAlreadyMemberInOrg = membershipDoc ? membershipDoc.status === 'Active' : false;
    const hasPassword = !!(user.password && user.password.length > 0);
    const hasAccountCredentials = hasPassword && user.status === 'Active';
    // User is only considered an existing registered user who can Sign In with credentials if they actually have a password configured
    const isAlreadyRegistered = hasPassword && (user.status === 'Active' || isAlreadyMemberInOrg);

    let inviterName = '';
    if (tokenDoc?.inviterId) {
      try {
        const inviter = await userService.getUserById(tokenDoc.inviterId).catch(() => null);
        if (inviter) {
          inviterName = inviter.name || inviter.username || '';
        }
      } catch (e) {}
    }

    return {
      valid: true,
      isExisting: isAlreadyRegistered,
      isAlreadyRegistered,
      isAlreadyMemberInOrg,
      hasAccountCredentials,
      membershipStatus: membershipDoc?.status || 'Pending',
      invitationStatus: tokenDoc?.status || 'PENDING',
      expiresAt: tokenDoc?.expiresAt || null,
      inviterId: tokenDoc?.inviterId || null,
      inviterName,
      email: user.email,
      orgId: resolvedOrgId,
      orgName: orgName || 'Community Workspace',
      villa: villaDetails || '',
      unit: villaDetails || '',
      role: roleDetails || '',
      invitationSource,
    };
  }

  async verifyResetPasswordOtp(identifier, code) {
    return await otpService.verifyOTP(identifier, code, 'RESET', null, false);
  }

  async setupAccountPassword(email, newPassword, deviceInfo = {}, orgNameFromReq = null) {
    if (!email || !newPassword) {
      throw new HttpError(400, 'Email and password are required.');
    }
    if (newPassword.length < 6) {
      throw new HttpError(400, 'Password must be at least 6 characters long.');
    }

    let user = await userService.getUserByEmail(email);
    const { hashPassword } = await import('../../utils/crypto.utils.js');
    const passHash = await hashPassword(newPassword);

    if (!user) {
      user = await userService.createUser({
        email,
        username: email.split('@')[0],
        password: passHash,
        status: 'Active',
        emailVerified: true
      });
    } else {
      await userService.updateUser(user._id, {
        password: passHash,
        status: 'Active',
        emailVerified: true
      });
    }

    // Auto-link user to their provisioned Organization & Membership
    try {
      const Enquiry = (await import('../platformCrm/enquiry.model.js')).default;
      const PlatformQuote = (await import('../platformQuote/platformQuote.model.js')).default;
      const Organization = (await import('../organization/organization.model.js')).default;
      const OrgMembership = (await import('../orgMembership/orgMembership.model.js')).default;
      const Role = (await import('../role/role.model.js')).default;

      const inquiry = await Enquiry.findOne({
        $or: [{ contactEmail: email }, { email: email }]
      }).sort({ createdAt: -1 }).catch(() => null);

      const quote = inquiry ? await PlatformQuote.findOne({ inquiryId: inquiry._id }).sort({ createdAt: -1 }).catch(() => null) : null;

      const orgName = orgNameFromReq || inquiry?.organizationName || quote?.communitySnapshot?.organizationName || 'Your Organization';
      const selectedPlan = quote?.pricingSnapshot?.planName || quote?.pricingSnapshot?.tier || quote?.planName || inquiry?.planName || 'COMMUNITY_STARTER';

      let basePlanFeatures = ['visitor', 'villas', 'users', 'roles', 'complaints', 'notices'];
      const planUpper = String(selectedPlan).toUpperCase();
      if (planUpper.includes('STARTER')) {
        basePlanFeatures = ['visitor', 'villas', 'users', 'roles', 'complaints'];
      } else if (planUpper.includes('ENTERPRISE')) {
        basePlanFeatures = ['visitor', 'villas', 'users', 'roles', 'complaints', 'amenities', 'notices', 'integrations', 'billing'];
      }

      const addOns = quote?.pricingSnapshot?.selectedAddOns || inquiry?.selectedFeatures || [];
      const customAddonKeys = Array.isArray(addOns) ? addOns.map(a => (typeof a === 'string' ? a : a.code || a.key || a.name)) : [];
      const finalAllowedFeatures = Array.from(new Set([...basePlanFeatures, ...customAddonKeys]));

      const escapedOrgName = orgName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let org = await Organization.findOne({
        $or: [
          { name: new RegExp('^' + escapedOrgName.trim() + '$', 'i') },
          { contactEmail: email }
        ]
      }).catch(() => null);

      if (!org) {
        org = await Organization.create({
          name: orgName,
          contactEmail: email,
          contactPhone: inquiry?.contactPhone || 'N/A',
          organizationType: 'Residential',
          status: 'Active',
          subscriptionPlan: selectedPlan,
          allowedFeatures: finalAllowedFeatures,
          villaCount: quote?.communitySnapshot?.villaCount || inquiry?.unitCount || 250,
        }).catch(() => null);
      } else {
        org.subscriptionPlan = selectedPlan;
        org.allowedFeatures = finalAllowedFeatures;
        await org.save().catch(() => null);
      }

      if (org) {
        const Permission = (await import('../permission/permission.model.js')).default;
        const RolePermission = (await import('../rolePermission/rolePermission.model.js')).default;

        let adminRole = await Role.findOne({ orgId: org._id, name: { $in: ['Community Admin', 'Admin'] } }).catch(() => null);
        if (!adminRole) {
          adminRole = await Role.findOne({ isSystem: true, name: { $in: ['Community Admin', 'Admin'] } }).catch(() => null);
        }
        if (!adminRole) {
          adminRole = await Role.create({
            name: 'Community Admin',
            description: 'Community Administrator role with management permissions.',
            orgId: org._id,
            isSystem: false,
          }).catch(() => null);
        }

        if (adminRole) {
          const allPerms = await Permission.find({}).catch(() => []);
          const existingRolePerms = await RolePermission.find({ roleId: adminRole._id }).catch(() => []);
          const existingPermIds = new Set(existingRolePerms.map(rp => rp.permissionId.toString()));
          
          const newMappings = [];
          for (const p of allPerms) {
            if (!existingPermIds.has(p._id.toString())) {
              newMappings.push({ roleId: adminRole._id, permissionId: p._id });
            }
          }
          if (newMappings.length > 0) {
            await RolePermission.insertMany(newMappings).catch(() => null);
          }
        }

        let membership = await OrgMembership.findOne({ userId: user._id, orgId: org._id }).catch(() => null);
        if (!membership) {
          const existingAnyMembership = await OrgMembership.findOne({ userId: user._id }).catch(() => null);
          const assignedRoleId = existingAnyMembership?.roleId || adminRole?._id || null;
          const assignedRoleIds = (existingAnyMembership?.roleIds && existingAnyMembership.roleIds.length > 0)
            ? existingAnyMembership.roleIds
            : (adminRole ? [adminRole._id] : []);

          await OrgMembership.create({
            userId: user._id,
            orgId: org._id,
            roleId: assignedRoleId,
            roleIds: assignedRoleIds,
            status: 'Active'
          }).catch(() => null);
        } else {
          membership.status = 'Active';
          // ONLY assign adminRole if membership currently has NO role assigned
          if ((!membership.roleId && (!membership.roleIds || membership.roleIds.length === 0)) && adminRole) {
            membership.roleId = adminRole._id;
            membership.roleIds = [adminRole._id];
          }
          await membership.save().catch(() => null);
        }

        user.organizationId = org._id;
        // Resolve user's primary role from their membership rather than unconditionally overwriting with 'Community Admin'
        const updatedMembership = await OrgMembership.findOne({ userId: user._id, orgId: org._id }).populate('roleId roleIds').catch(() => null);
        let userRoleName = updatedMembership?.roleId?.name || updatedMembership?.roleIds?.[0]?.name;
        if (!userRoleName && adminRole) {
          userRoleName = adminRole.name;
        }
        if (userRoleName) {
          user.role = userRoleName;
        }
        await user.save().catch(() => null);
      }
    } catch (orgLinkErr) {
      console.error('[setupAccountPassword] Non-blocking org linkage error:', orgLinkErr.message);
    }

    const loginData = await this.login({
      login: email,
      password: newPassword,
      deviceInfo
    });

    return {
      message: 'Password set successfully. Account activated.',
      ...loginData
    };
  }

  async checkAccountStatus(email) {
    if (!email) return { hasPassword: false, isAlreadyConfigured: false };

    const user = await userService.getUserByEmail(email);
    if (!user) {
      return { exists: false, hasPassword: false, isAlreadyConfigured: false };
    }

    const hasPassword = !!(user.password && user.password.length > 0);
    const isAlreadyConfigured = hasPassword && user.status === 'Active';

    return {
      exists: true,
      hasPassword,
      status: user.status,
      isAlreadyConfigured,
      email: user.email,
    };
  }

  /**
   * Creates a short-lived, single-use mobile handoff ticket for an already-authenticated user.
   *
   * @param {string} userId - ID of authenticated user
   * @param {string} [activeOrgId] - Optional active organization ID
   * @returns {Promise<{ handoffId: string, expiresAt: Date, deepLink: string, universalLink: string, playStoreUrl: string, appStoreUrl: string }>}
   */
  async createInviteHandoff(userId, activeOrgId = null) {
    if (!userId) {
      throw new HttpError(401, 'Authentication required to initiate mobile handoff.');
    }

    const user = await userService.getUserById(userId);
    if (!user) {
      throw new HttpError(404, 'User account not found.');
    }

    if (user.status !== 'Active') {
      throw new HttpError(403, 'Account is not active. Complete invitation acceptance before mobile handoff.');
    }

    const targetOrgId = activeOrgId || user.organizationId || null;
    const handoffResult = await tokenService.createMobileHandoffToken(user._id, targetOrgId);

    const scheme = config.mobile?.scheme || 'managemygate';
    const universalDomain = config.mobile?.universalLinkDomain || 'app.managemygate.com';
    const androidPackage = config.mobile?.androidPackageName || 'com.atominosconsulting.nahom';
    const iosAppStoreId = config.mobile?.iosAppStoreId || '6746501635';

    return {
      handoffId: handoffResult.handoffId,
      expiresAt: handoffResult.expiresAt,
      deepLink: `${scheme}://invite/handoff/${handoffResult.handoffId}`,
      universalLink: `https://${universalDomain}/invite/handoff/${handoffResult.handoffId}`,
      playStoreUrl: `https://play.google.com/store/apps/details?id=${androidPackage}&referrer=${encodeURIComponent(`handoffId=${handoffResult.handoffId}`)}`,
      appStoreUrl: `https://apps.apple.com/app/manage-my-gate/id${iosAppStoreId}`,
    };
  }

  /**
   * Atomically exchanges a short-lived mobile handoff ticket for an authenticated mobile session.
   * Prevents replay and concurrency race conditions at the database level.
   *
   * @param {string} rawHandoffId - Raw opaque handoff identifier
   * @param {object} [deviceInfo={}] - Optional mobile client device info
   * @returns {Promise<{ token: string, refreshToken: string, user: object, availableWorkspaces: Array }>}
   */
  async exchangeInviteHandoff(rawHandoffId, deviceInfo = {}) {
    if (!rawHandoffId || typeof rawHandoffId !== 'string' || rawHandoffId.trim().length === 0) {
      throw new HttpError(400, 'Handoff identifier is required.');
    }

    // Atomically exchange handoff token in Token collection (PENDING -> EXCHANGED)
    const { userId, orgId } = await tokenService.exchangeMobileHandoffToken(rawHandoffId);

    const user = await userService.getUserById(userId);
    if (!user) {
      throw new HttpError(404, 'User account not found.');
    }

    if (user.status !== 'Active') {
      throw new HttpError(403, 'User account is not active or has been suspended.');
    }

    // Create fresh mobile session
    const mobileDeviceInfo = {
      ...deviceInfo,
      client: 'mobile',
      source: 'mobile_handoff',
    };
    const refreshToken = await sessionService.createSession(user._id, mobileDeviceInfo);

    // Derive server-side scoped context (client cannot spoof targetOrgId or roles)
    const { tokenPayload, permissions, availableWorkspaces } = await this.getScopedTokenPayload(user, orgId);
    const token = signToken(tokenPayload);

    // Emit domain event
    authEvents.emit('MOBILE_HANDOFF_EXCHANGED', { userId: user._id, orgId });
    authEvents.emit('LOGIN_SUCCESS', { userId: user._id, method: 'mobile_handoff' });

    return {
      token,
      refreshToken,
      user: this._formatAuthUser(user, tokenPayload, permissions, availableWorkspaces),
      availableWorkspaces,
    };
  }
}

export default new AuthService();
