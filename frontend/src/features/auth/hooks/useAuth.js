import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import {
  logout as logoutAction,
  updateProfile as updateProfileAction,
  clearStatus as clearStatusAction,
  clearInvitation as clearInvitationAction,
  validateInvitation,
  acceptInvitation,
  acceptSsoInvitation,
  rejectInvitation,
  loginUser,
  loginWithGoogle,
  loginWithMicrosoft,
  registerUser,
  verifyRegistration as verifyRegistrationAction,
  requestOtp,
  verifyOtpLogin,
  requestPasswordReset,
  verifyResetOtp as verifyResetOtpAction,
  resetPassword as resetPasswordAction,
  performLogout,
  switchWorkspaceContext,
} from '../store/authSlice'
import authService from '../services/authService.js'

/**
 * useAuth Custom Hook
 *
 * Controller hook encapsulating auth state selectors and action dispatchers.
 * Follows the "Thin View" architectural pattern.
 */
export const useAuth = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const currentUser = useSelector((state) => state.auth.user)
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated)
  const token = useSelector((state) => state.auth.token)
  const loading = useSelector((state) => state.auth.loading)
  const error = useSelector((state) => state.auth.error)
  const successMsg = useSelector((state) => state.auth.successMsg)

  const otpSent = useSelector((state) => state.auth.otpSent)
  const invitation = useSelector(
    (state) =>
      state.auth.invitation || {
        loading: false,
        error: null,
        token: null,
        valid: false,
        data: null,
      },
  )
  const activeWorkspace = useSelector((state) => state.workspace)
  const allowedFeatures = useSelector((state) => state.workspace?.allowedFeatures || [])
  const isPlatform = useSelector((state) => state.workspace?.isPlatform || false)

  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === 'auth_logout' && isAuthenticated) {
        dispatch(logoutAction())
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [dispatch, isAuthenticated])

  const logout = () => {
    dispatch(performLogout())
  }

  const updateProfile = (formData) => {
    return dispatch(updateProfileAction(formData))
  }

  const clearStatus = () => {
    dispatch(clearStatusAction())
  }

  const handleValidateInvitation = async (invitationToken) => {
    try {
      const resultAction = await dispatch(validateInvitation(invitationToken))
      if (validateInvitation.fulfilled.match(resultAction)) {
        return {
          success: true,
          data:
            resultAction.payload.data?.data || resultAction.payload.data || resultAction.payload,
        }
      } else {
        return {
          success: false,
          error: resultAction.payload || t('auth.invite.invalidToken'),
        }
      }
    } catch (err) {
      return {
        success: false,
        error: err.message || t('auth.invite.invalidToken'),
      }
    }
  }

  const handleClearInvitation = () => {
    dispatch(clearInvitationAction())
  }

  const handleAcceptInvitation = async (arg1, arg2, options = {}) => {
    try {
      let payload
      let opts = options
      if (typeof arg1 === 'object' && arg1 !== null) {
        payload = arg1
        if (typeof arg2 === 'object' && arg2 !== null) {
          opts = arg2
        } else if (arg1.options) {
          opts = arg1.options
        }
      } else {
        payload = { token: arg1, password: arg2 }
      }
      const resultAction = await dispatch(acceptInvitation(payload))
      if (acceptInvitation.fulfilled.match(resultAction)) {
        toast.success(t('auth.invite.success', 'Invitation accepted successfully!'))
        if (!opts.skipNavigate) {
          navigate('/dashboard', { replace: true })
        }
        return { success: true, payload: resultAction.payload }
      } else {
        const errorMsg =
          resultAction.payload || t('auth.invite.error', 'Failed to accept invitation')
        toast.error(errorMsg)
        return { success: false, error: errorMsg }
      }
    } catch (err) {
      const fallbackMsg = err.message || t('auth.invite.error', 'Failed to accept invitation')
      toast.error(fallbackMsg)
      return { success: false, error: fallbackMsg }
    }
  }

  const handleRejectInvitation = async (payload) => {
    try {
      const resultAction = await dispatch(rejectInvitation(payload))
      if (rejectInvitation.fulfilled.match(resultAction)) {
        toast.success(t('auth.invite.declinedSuccess', 'Invitation declined.'))
        return { success: true, payload: resultAction.payload }
      } else {
        const errorMsg =
          resultAction.payload || t('auth.invite.error', 'Failed to reject invitation')
        return { success: false, error: errorMsg }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const login = async (credentials) => {
    const resultAction = await dispatch(loginUser(credentials))
    if (loginUser.fulfilled.match(resultAction)) {
      return { success: true, payload: resultAction.payload }
    }
    return { success: false, error: resultAction.payload }
  }

  const loginGoogle = async (credential, inviteToken, options = {}) => {
    const payload = typeof credential === 'object' ? credential : { token: credential, inviteToken }
    const resultAction = await dispatch(loginWithGoogle(payload))
    if (loginWithGoogle.fulfilled.match(resultAction)) {
      const data = resultAction.payload?.data

      if (data?.isNewUser) {
        return { success: true, isNewUser: true, googleData: data.googleData }
      }

      const workspaces = data?.workspaces || data?.availableWorkspaces || []
      const navigateTo = workspaces.length === 0 ? '/workspace-setup' : '/dashboard'
      if (!options.skipNavigate) {
        navigate(navigateTo)
      }
      return { success: true, navigateTo }
    }
    return { success: false, error: resultAction.payload }
  }

  const loginMicrosoft = async (idToken, inviteToken, options = {}) => {
    const payload = typeof idToken === 'object' ? idToken : { token: idToken, inviteToken }
    const resultAction = await dispatch(loginWithMicrosoft(payload))
    if (loginWithMicrosoft.fulfilled.match(resultAction)) {
      const data = resultAction.payload?.data
      const workspaces = data?.workspaces || data?.availableWorkspaces || []
      const navigateTo = workspaces.length === 0 ? '/workspace-setup' : '/dashboard'
      if (!options.skipNavigate) {
        navigate(navigateTo)
      }
      return { success: true, navigateTo }
    }
    return { success: false, error: resultAction.payload }
  }

  const handleAcceptSsoInvitation = async (
    inviteTokenOrObj,
    ssoCredential,
    provider,
    options = {},
  ) => {
    try {
      let inviteToken = inviteTokenOrObj
      let finalCredential = ssoCredential
      let finalProvider = provider
      let finalOptions = options

      // Defensive argument normalization: support both positional and single-object argument styles
      if (typeof inviteTokenOrObj === 'object' && inviteTokenOrObj !== null && !ssoCredential) {
        inviteToken = inviteTokenOrObj.inviteToken || inviteTokenOrObj.token
        finalCredential = inviteTokenOrObj.ssoCredential || inviteTokenOrObj.credential
        finalProvider = inviteTokenOrObj.provider
        finalOptions = inviteTokenOrObj.options || options
      }

      const resultAction = await dispatch(
        acceptSsoInvitation({
          inviteToken,
          ssoCredential: finalCredential,
          provider: finalProvider,
        }),
      )
      if (acceptSsoInvitation.fulfilled.match(resultAction)) {
        const data = resultAction.payload?.data
        const workspaces = data?.workspaces || data?.availableWorkspaces || []
        const navigateTo = workspaces.length === 0 ? '/workspace-setup' : '/dashboard'
        toast.success(t('auth.invite.success'))
        if (!finalOptions?.skipNavigate) {
          navigate(navigateTo)
        }
        return { success: true, navigateTo, payload: resultAction.payload }
      } else {
        const errorMsg = resultAction.payload || t('auth.invite.error')
        toast.error(errorMsg)
        return { success: false, error: errorMsg }
      }
    } catch (err) {
      const fallbackMsg = t('auth.invite.error')
      toast.error(fallbackMsg)
      return { success: false, error: fallbackMsg }
    }
  }

  const handleCreateInviteHandoff = async (payload = {}) => {
    try {
      const res = await authService.createInviteHandoff(payload)
      const handoffData = res.data?.data || res.data
      return { success: true, data: handoffData }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.message || err.message || 'Failed to create mobile handoff.',
      }
    }
  }

  const handleSwitchWorkspace = async (orgId) => {
    const resultAction = await dispatch(switchWorkspaceContext({ targetOrgId: orgId }))
    if (switchWorkspaceContext.fulfilled.match(resultAction)) return { success: true }
    return { success: false, error: resultAction.payload }
  }

  const register = (userData) => {
    return dispatch(registerUser(userData))
  }

  const verifyRegistration = async (email, code) => {
    const resultAction = await dispatch(verifyRegistrationAction({ email, code }))
    if (verifyRegistrationAction.fulfilled.match(resultAction)) {
      return { success: true, payload: resultAction.payload }
    }
    return { success: false, error: resultAction.payload }
  }

  const checkPermission = (permissionName) => {
    if (!currentUser) return false

    const roleUpper = (currentUser.role || '').toUpperCase()
    if (
      ['Super Admin', 'Platform Super Admin', 'Community Admin', 'Admin', 'SuperAdmin'].includes(
        currentUser.role,
      ) ||
      roleUpper.includes('ADMIN') ||
      roleUpper.includes('SUPER') ||
      currentUser.isPlatform
    ) {
      return true
    }

    const adminRoles = [
      'super admin',
      'platform super admin',
      'community admin',
      'admin',
      'superadmin',
      'facility manager',
      'super_admin',
      'platform_super_admin',
      'community_admin',
      'facility_manager',
    ]
    const cleanRole = (r) => (r || '').toLowerCase().trim().replace(/[_-]/g, ' ')
    const userRole = cleanRole(currentUser.role)
    const userRoles = Array.isArray(currentUser.roles) ? currentUser.roles.map(cleanRole) : []

    if (
      adminRoles.some((ar) => cleanRole(ar) === userRole) ||
      userRoles.some((r) => adminRoles.some((ar) => cleanRole(ar) === r))
    ) {
      return true
    }

    if (
      currentUser.permissions &&
      (currentUser.permissions.includes('*') || currentUser.permissions.includes('all'))
    ) {
      return true
    }

    const isPermEnabledInWorkspace = (perm) => {
      if (!perm || isPlatform) return true
      const featurePart = perm.split(':')[0]
      if (featurePart === 'workspaces' || featurePart === 'dashboard') return true

      const isModuleEnabled = (key) => {
        if (allowedFeatures.includes(key)) return true
        if (activeWorkspace?.modules?.some((m) => m.moduleKey === key && m.enabled !== false))
          return true
        if (
          activeWorkspace?.workspaceModules?.some((m) => m.moduleKey === key && m.enabled === true)
        )
          return true
        return false
      }

      if (featurePart === 'amenities' || featurePart === 'booking') {
        return ['amenities', 'booking', 'amenity', 'amenitiesBooking'].some((f) =>
          isModuleEnabled(f),
        )
      }

      if (['villas', 'users', 'roles', 'integrations'].includes(featurePart)) {
        return (
          isModuleEnabled('administration_security') ||
          isModuleEnabled(featurePart) ||
          allowedFeatures.includes(perm)
        )
      }

      return isModuleEnabled(featurePart) || allowedFeatures.includes(perm)
    }

    if (Array.isArray(permissionName)) {
      return permissionName.some(
        (perm) => isPermEnabledInWorkspace(perm) && currentUser.permissions?.includes(perm),
      )
    }

    if (!isPermEnabledInWorkspace(permissionName)) return false

    if (
      (permissionName === 'amenities:wallet' || permissionName === 'billing:wallet') &&
      ([
        'Family Member',
        'Family',
        'Resident',
        'Resident Owner',
        'Resident Tenant',
        'Tenant',
        'Owner',
      ].includes(currentUser.role) ||
        ['Family Member', 'Family', 'Resident Owner', 'Tenant', 'Owner'].includes(
          currentUser.residencyType,
        ))
    ) {
      return true
    }

    return !!(currentUser.permissions && currentUser.permissions.includes(permissionName))
  }

  const sendOtp = (identifier, isEmail) => {
    return dispatch(requestOtp({ identifier, isEmail }))
  }

  const verifyOtp = async (identifier, code, isEmail) => {
    const resultAction = await dispatch(verifyOtpLogin({ identifier, code, isEmail }))
    if (verifyOtpLogin.fulfilled.match(resultAction)) {
      return { success: true, payload: resultAction.payload }
    }
    return { success: false, error: resultAction.payload }
  }

  const sendPasswordResetOtp = (identifier) => {
    return dispatch(requestPasswordReset(identifier))
  }

  const verifyResetOtp = (identifier, code) => {
    return dispatch(verifyResetOtpAction({ identifier, code }))
  }

  const resetAccountPassword = (identifier, code, newPassword) => {
    return dispatch(resetPasswordAction({ identifier, code, newPassword }))
  }

  return {
    currentUser,
    isAuthenticated,
    token,
    loading,
    error,
    successMsg,
    logout,
    updateProfile,
    clearStatus,
    invitation,
    handleValidateInvitation,
    handleClearInvitation,
    handleAcceptInvitation,
    handleAcceptSsoInvitation,
    handleRejectInvitation,
    login,
    loginGoogle,
    loginMicrosoft,
    register,
    verifyRegistration,
    checkPermission,
    otpSent,
    sendOtp,
    verifyOtp,
    sendPasswordResetOtp,
    verifyResetOtp,
    resetAccountPassword,
    handleCreateInviteHandoff,
    handleSwitchWorkspace,
  }
}

export default useAuth
