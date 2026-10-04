import authService from './auth.services.js';
import config from '../../config/config.js';
import { setAuthCookie, setRefreshTokenCookie, clearAuthCookie } from '../../utils/cookie.utils.js';
import * as sessionController from '../session/session.controller.js';

export class AuthController {
  async register(req, res, next) {
    try {
      const data = await authService.register(req.body);
      res.success(data, data?.message || 'User registered successfully, pending verification', 201);
    } catch (error) {
      console.error('[AuthController.register] Error:', error);
      next(error);
    }
  }

  async verifyRegistrationOtp(req, res, next) {
    try {
      const { email, code } = req.body;
      const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
      const data = await authService.verifyRegistrationOtp(email, code, deviceInfo);
      setAuthCookie(res, data.token);
      res.success(data, 'Account verified and activated successfully');
    } catch (error) {
      console.error('[AuthController.verifyRegistrationOtp] Error:', error);
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const data = await authService.login(req.body);
      setAuthCookie(res, data.token);
      if (data.refreshToken) {
        setRefreshTokenCookie(res, data.refreshToken);
      }
      res.success(data, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async getRoles(req, res, next) {
    try {
      const roles = await authService.getRolesForRegistration();
      res.success(roles, 'Registration roles retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async validateInvite(req, res, next) {
    try {
      const token = req.query.token || req.query.invitationId;
      const email = req.query.email;
      const invitationId = req.query.invitationId;
      const authenticatedUserId = req.user?.id || req.user?._id || null;
      const data = await authService.validateInvite(token, email, invitationId, authenticatedUserId);
      res.success(data, 'Invitation token validated successfully');
    } catch (error) {
      next(error);
    }
  }

  async acceptInvite(req, res, next) {
    try {
      const { token, password, email, name, phone } = req.body;
      const authenticatedUserId = req.user?.id || req.user?._id || null;
      const data = await authService.acceptInvitation(token, password, email, authenticatedUserId, { name, phone });
      
      if (data && data.token) {
        setAuthCookie(res, data.token);
      }
      if (data && data.refreshToken) {
        setRefreshTokenCookie(res, data.refreshToken);
      }

      res.success(data, 'Invitation accepted and account activated successfully');
    } catch (error) {
      next(error);
    }
  }

  async rejectInvite(req, res, next) {
    try {
      const { token, email } = req.body;
      const data = await authService.rejectInvitation(token, email);
      res.success(data, 'Invitation rejected successfully');
    } catch (error) {
      next(error);
    }
  }

  async acceptInviteWithSSO(req, res, next) {
    try {
      const { inviteToken, ssoCredential, code, codeVerifier, redirectUri, clientId, nonce, fullName, provider } = req.body;
      const credentialOrOptions = ssoCredential
        ? { ssoCredential, nonce, fullName }
        : { code, codeVerifier, redirectUri, clientId };
      const data = await authService.acceptInvitationWithSSO(inviteToken, credentialOrOptions, provider);
      
      if (data && data.token) {
        setAuthCookie(res, data.token);
      }
      if (data && data.refreshToken) {
        setRefreshTokenCookie(res, data.refreshToken);
      }

      res.success(data, 'Invitation accepted via SSO and account activated successfully');
    } catch (error) {
      next(error);
    }
  }



  async switchContext(req, res, next) {
    try {
      const { targetOrgId, targetVillaId, targetRole, targetAssignmentId, targetAssignmentName, targetAssignmentType } = req.body;
      const userId = req.user.id;
      // Default to active organization context if targetOrgId is not explicitly provided
      const orgId = targetOrgId || req.user?.orgId || null;
      
      // Determine if effective role is a resident role before considering any villa context
      const effectiveRole = targetRole || req.user?.role || '';
      const isResidentRole = /resident|tenant|owner|family/i.test(effectiveRole);
      const villaId = isResidentRole
        ? (targetVillaId || (orgId === req.user?.orgId ? req.user?.villaId : null))
        : null;
      
      const targetAssignment = (targetAssignmentId || targetAssignmentName || targetAssignmentType)
        ? { id: targetAssignmentId, name: targetAssignmentName, type: targetAssignmentType }
        : null;

      const data = await authService.switchContext(userId, orgId, villaId, targetRole, targetAssignment);

      setAuthCookie(res, data.token);

      res.success(data, 'Workspace context switched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCurrentContext(req, res, next) {
    try {
      const userId = req.user.id;
      const targetOrgId = req.query.orgId || req.user.orgId || null;
      const data = await authService.getCurrentContext(userId, targetOrgId);
      res.success(data, 'Current workspace context retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async googleLogin(req, res, next) {
    try {
      const { token, code, codeVerifier, redirectUri, clientId, inviteToken } = req.body;
      const credentialOrPayload = token ? token : { code, codeVerifier, redirectUri, clientId };
      const data = await authService.loginWithGoogle(credentialOrPayload, inviteToken, true);

      setAuthCookie(res, data.token);
      if (data.refreshToken) {
        setRefreshTokenCookie(res, data.refreshToken);
      }
      res.success(data, 'Google login successful');
    } catch (error) {
      next(error);
    }
  }

  async microsoftLogin(req, res, next) {
    try {
      const { token, inviteToken } = req.body;
      const data = await authService.loginWithMicrosoft(token, inviteToken, true);
      if (data.token) {
        setAuthCookie(res, data.token);
      }
      if (data.refreshToken) {
        setRefreshTokenCookie(res, data.refreshToken);
      }
      res.success(data, 'Microsoft login successful');
    } catch (error) {
      next(error);
    }
  }

  async appleLogin(req, res, next) {
    try {
      const { token, inviteToken, nonce, fullName } = req.body;
      const data = await authService.loginWithApple({ token, nonce, fullName }, inviteToken);

      setAuthCookie(res, data.token);
      if (data.refreshToken) {
        setRefreshTokenCookie(res, data.refreshToken);
      }
      res.success(data, 'Apple login successful');
    } catch (error) {
      next(error);
    }
  }

  async initiatePhoneLogin(req, res, next) {
    try {
      const { phone } = req.body;
      const data = await authService.initiatePhoneLogin(phone);
      res.success(data, data?.message || 'OTP sent to phone');
    } catch (error) {
      next(error);
    }
  }

  async verifyPhoneLogin(req, res, next) {
    try {
      const { phone, code } = req.body;
      const deviceInfo = {
        deviceName: req.headers['user-agent'],
        browser: 'Browser',
        os: 'OS',
        ipAddress: req.ip,
      };
      const data = await authService.verifyPhoneLogin(phone, code, deviceInfo);
      setAuthCookie(res, data.token);
      setRefreshTokenCookie(res, data.refreshToken);
      res.success(data, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async initiateEmailOtpLogin(req, res, next) {
    try {
      const { email } = req.body;
      const data = await authService.initiateEmailOtpLogin(email);
      res.success(data, data?.message || 'OTP sent to email');
    } catch (error) {
      next(error);
    }
  }

  async verifyEmailOtpLogin(req, res, next) {
    try {
      const { email, code } = req.body;
      const deviceInfo = {
        deviceName: req.headers['user-agent'],
        browser: 'Browser',
        os: 'OS',
        ipAddress: req.ip,
      };
      const data = await authService.verifyEmailOtpLogin(email, code, deviceInfo);
      setAuthCookie(res, data.token);
      setRefreshTokenCookie(res, data.refreshToken);
      res.success(data, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { identifier } = req.body;
      const data = await authService.forgotPassword(identifier);
      res.success(data, 'Password reset OTP sent');
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { identifier, code, newPassword } = req.body;
      await authService.resetPassword(identifier, code, newPassword);
      res.success(null, 'Password has been reset successfully');
    } catch (error) {
      next(error);
    }
  }

  async verifyResetPasswordOtp(req, res, next) {
    try {
      const { identifier, code } = req.body;
      await authService.verifyResetPasswordOtp(identifier, code);
      res.success(null, 'OTP verified successfully');
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    return sessionController.refreshToken(req, res, next);
  }

  async logout(req, res, next) {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;
      const userId = req.user?._id || req.user?.id;
      if (userId) {
        await authService.logout(userId, token);
      }
      clearAuthCookie(res);
      res.success(null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async setupAccountPassword(req, res, next) {
    try {
      const { email, password, orgName } = req.body;
      const deviceInfo = {
        deviceName: req.headers['user-agent'],
        browser: 'Browser',
        os: 'OS',
        ipAddress: req.ip,
      };
      const data = await authService.setupAccountPassword(email, password, deviceInfo, orgName);
      res.success(data, 'Password configured successfully. Account activated.');
    } catch (error) {
      next(error);
    }
  }

  async checkAccountStatus(req, res, next) {
    try {
      const { email } = req.query;
      const data = await authService.checkAccountStatus(email);
      res.success(data, 'Account status fetched successfully.');
    } catch (error) {
      next(error);
    }
  }

  async createInviteHandoff(req, res, next) {
    try {
      const userId = req.user?.id || req.user?._id;
      const activeOrgId = req.user?.orgId || req.body?.orgId || null;
      const data = await authService.createInviteHandoff(userId, activeOrgId);
      res.success(data, 'Mobile handoff ticket created successfully.');
    } catch (error) {
      next(error);
    }
  }

  async exchangeInviteHandoff(req, res, next) {
    try {
      const { handoffId, deviceInfo } = req.body;
      const clientDeviceInfo = {
        ...deviceInfo,
        deviceName: deviceInfo?.deviceName || req.headers['user-agent'],
        ipAddress: req.ip,
      };
      const data = await authService.exchangeInviteHandoff(handoffId, clientDeviceInfo);

      if (data && data.token) {
        setAuthCookie(res, data.token);
      }
      if (data && data.refreshToken) {
        setRefreshTokenCookie(res, data.refreshToken);
      }

      res.success(data, 'Mobile handoff ticket exchanged successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
