import userService from './user.services.js'
import HttpError from '../../utils/httpError.utils.js'
import { generateInviteLink, resolveInvitationSource } from './utils/invite.utils.js'
import fs from 'fs'


export class UserController {
  /**
   * Retrieves and formats all users.
   */
  async getAllUsers(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const orgId = req.tenant.orgId;

      const search = req.query.search || '';
      let roles = req.query.roles || [];
      if (typeof roles === 'string') {
        roles = roles.split(',').map(r => r.trim()).filter(Boolean);
      }
      let status = req.query.status || [];
      if (typeof status === 'string') {
        status = status.split(',').map(s => s.trim()).filter(Boolean);
      }

      const { data: users, pagination } = await userService.getAllUsersInOrg(orgId, page, limit, { search, roles, status });

      const formatted = users.map((u) => ({
        id: u.id || u._id,
        _id: u._id || u.id,
        username: u.username,
        name: u.name || u.username,
        phone: u.phone || '',
        email: u.email,
        role: u.role || '',
        status: u.status || 'Pending',
        assignedUnits: u.assignedUnits || [],
      }));
      res.success({ data: formatted, pagination }, 'Users retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Invites a new user.
   */
  async inviteUser(req, res, next) {
    try {
      const { email, phone, villaId, residentType, roleName, name } = req.body;
      const orgId = req.tenant.orgId;

      const inviterId = req.user?.id || req.user?._id || null;

      // The web admin panel always sends web invitations — the email link must
      // always point to the smart /invite/:token web landing page, never to a
      // mobile-specific path. Do NOT derive this from Referer/Origin headers.
      const invitationSource = 'WEB';

      const { user, invitationToken, membership } = await userService.inviteUser(
        email,
        orgId,
        villaId,
        residentType,
        roleName,
        phone,
        name || '',
        invitationSource,
        inviterId
      );

      // Generate the canonical invite URL for the admin UI "Copy Link" feature
      const inviteLink = generateInviteLink(invitationToken);

      const formatted = {
        id: user._id,
        username: user.username,
        name: user.name || user.username,
        phone: user.phone || '',
        email: user.email,
        role: roleName || '',
        status: membership?.status || 'Pending',
        villaId: villaId || null,
        residentType: residentType || 'None',
        invitationToken,
        invitationSource,
        inviteLink,
      };
      res.success(formatted, 'User invited successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deletes a user by ID.
   */
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const { villaId } = req.query;
      const orgId = req.tenant.orgId;
      await userService.deleteUserFromOrg(id, orgId, villaId);
      res.success({ id }, 'User deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates roles for a user.
   */
  async updateUserRoles(req, res, next) {
    try {
      const { id } = req.params;
      const { roles, villaId } = req.body;
      const orgId = req.tenant.orgId;

      const result = await userService.updateUserRoles(id, orgId, roles, villaId);
      res.success(result, 'User roles updated successfully')
    } catch (error) {
      next(error)
    }
  }

  /**
   * Requests an OTP to verify a new email address during profile update.
   */
  async requestEmailOtp(req, res, next) {
    try {
      const userId = req.user.id;
      const { newEmail } = req.body;
      const result = await userService.requestEmailOtp(userId, newEmail);
      res.success(result, 'Verification OTP sent to new email address');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Requests an OTP to verify a new phone number during profile update.
   */
  async requestPhoneOtp(req, res, next) {
    try {
      const userId = req.user.id || req.user._id;
      const { newPhone } = req.body;
      const result = await userService.requestPhoneOtp(userId, newPhone);
      res.success(result, 'Verification OTP sent to new phone number');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates current user's profile, contact verification fields, avatar, and profile details.
   */
  async updateProfile(req, res, next) {
    try {
      const userId = req.user.id || req.user._id;
      const { name, phone, phoneOtp, email, emailOtp, removeAvatar, bio, work, hometown, allowIntercomCalls } = req.body;
      let interests = req.body.interests;
      if (typeof interests === 'string') {
        interests = JSON.parse(interests);
      }
      const avatarFilename = req.file ? req.file.filename : undefined;

      const updatedUser = await userService.updateProfile(userId, {
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
        removeAvatar: removeAvatar === 'true' || removeAvatar === true || removeAvatar === '1',
      });
      
      res.success({
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        phoneVerified: updatedUser.phoneVerified,
        avatar: updatedUser.avatar || null,
        bio: updatedUser.bio || '',
        work: updatedUser.work || '',
        hometown: updatedUser.hometown || '',
        allowIntercomCalls: Boolean(updatedUser.allowIntercomCalls),
        interests: updatedUser.interests || [],
      }, 'Profile updated successfully');
    } catch (error) {
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file on profile update error:', err);
        });
      }
      next(error);
    }
  }

  /**
   * Bulk invites multiple users.
   */
  async bulkInviteUsers(req, res, next) {
    try {
      const { invitations } = req.body;
      const orgId = req.tenant.orgId;
      const inviterId = req.user?.id || req.user?._id || null;

      const defaultSource = resolveInvitationSource(req);

      const result = await userService.bulkInviteUsers(invitations, orgId, defaultSource, inviterId);
      res.success(result, 'Bulk invitation process completed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves organization invitations with pagination, status filtering, and recipient search.
   */
  async getInvitations(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const { page, limit, status, search, sortBy, sortOrder } = req.query;
      const result = await userService.listInvitations({
        orgId,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        status: status || 'ALL',
        search: search || '',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc',
      });
      res.success(result, 'Invitations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resends an eligible invitation with a fresh token.
   */
  async resendInvitation(req, res, next) {
    try {
      const { id } = req.params;
      const orgId = req.tenant.orgId;
      const inviterId = req.user?.id || req.user?._id || null;

      const result = await userService.resendInvitation(id, orgId, inviterId);
      res.success(result, 'Invitation resent successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revokes an existing invitation.
   */
  async revokeInvitation(req, res, next) {
    try {
      const { id } = req.params;
      const orgId = req.tenant.orgId;
      const inviterId = req.user?.id || req.user?._id || null;

      const result = await userService.revokeInvitation(id, orgId, inviterId);
      res.success(result, 'Invitation revoked successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Self-service account deletion for the currently authenticated user.
   */
  async deleteMyAccount(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await userService.deleteOwnAccount(userId);
      res.success(result, 'Account deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Public unauthenticated account deletion request.
   */
  async requestAccountDeletion(req, res, next) {
    try {
      const { email, mobile, reason } = req.body;
      const result = await userService.requestAccountDeletion({ email, mobile, reason });
      res.success(result, 'Deletion request processed successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController()
