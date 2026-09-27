import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import apiClient from '../../../services/apiClient.js'
import authService from '../services/authService.js'
import { setActiveWorkspace } from '../../workspace/store/workspaceSlice.js'

// Async Thunks
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { dispatch, rejectWithValue }) => {
    try {
      const response = await authService.login(credentials)

      const user = response.data?.user
      const availableWorkspaces = response.data?.availableWorkspaces || []

      if (user) {
        dispatch(
          setActiveWorkspace({
            activeOrganizationId: user.orgId,
            activeVillaId: user.villaId || null,
            activeRole: user.role,
            allowedFeatures: user.permissions || [],
            isPlatform: user.isPlatform || false,
            availableWorkspaces: availableWorkspaces,
          }),
        )
      }

      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Login failed')
    }
  },
)

export const loginWithGoogle = createAsyncThunk(
  'auth/loginWithGoogle',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const response = await authService.loginWithGoogle(payload)

      if (response.data?.isNewUser) {
        return response
      }

      const user = response.data?.user
      const token = response.data?.token
      const availableWorkspaces = response.data?.availableWorkspaces || []

      if (user) {
        dispatch(updateTokenAndUser({ token, user }))

        dispatch(
          setActiveWorkspace({
            activeOrganizationId: user.orgId,
            activeVillaId: user.villaId || null,
            activeRole: user.role,
            activeVillaId: user.villaId || null,
            allowedFeatures: user.permissions || [],
            isPlatform: user.isPlatform || false,
            availableWorkspaces: availableWorkspaces,
          }),
        )
      }

      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Google login failed',
      )
    }
  },
)

export const loginWithMicrosoft = createAsyncThunk(
  'auth/loginWithMicrosoft',
  async (token, { dispatch, rejectWithValue }) => {
    try {
      const response = await authService.loginWithMicrosoft(token)

      const user = response.data?.user
      const availableWorkspaces = response.data?.availableWorkspaces || []

      if (user) {
        dispatch(
          setActiveWorkspace({
            activeOrganizationId: user.orgId,
            activeVillaId: user.villaId || null,
            activeRole: user.role,
            allowedFeatures: user.permissions || [],
            isPlatform: user.isPlatform || false,
            availableWorkspaces: availableWorkspaces,
          }),
        )
      }

      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Microsoft login failed',
      )
    }
  },
)

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authService.register(userData)
      return response // Now returns { data: { message, email, status } }
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Registration failed',
      )
    }
  },
)

export const verifyRegistration = createAsyncThunk(
  'auth/verifyRegistration',
  async ({ email, code }, { dispatch, rejectWithValue }) => {
    try {
      const response = await authService.verifyRegistration(email, code)

      const user = response.data?.user
      const availableWorkspaces = response.data?.availableWorkspaces || []

      if (user) {
        dispatch(
          setActiveWorkspace({
            activeOrganizationId: user.orgId,
            activeVillaId: user.villaId || null,
            activeRole: user.role,
            allowedFeatures: user.permissions || [],
            isPlatform: user.isPlatform || false,
            availableWorkspaces: availableWorkspaces,
          }),
        )
      }

      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Verification failed',
      )
    }
  },
)

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await apiClient.put('/users/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Profile update failed',
      )
    }
  },
)

export const validateInvitation = createAsyncThunk(
  'auth/validateInvitation',
  async (token, { rejectWithValue }) => {
    try {
      const response = await authService.validateInvite(token)
      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Invalid or expired invitation token',
      )
    }
  },
)

export const acceptInvitation = createAsyncThunk(
  'auth/acceptInvitation',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const response = await authService.acceptInvite(payload)

      const user = response.data?.user
      const token = response.data?.token
      const availableWorkspaces = response.data?.availableWorkspaces || []

      if (token || user) {
        dispatch(updateTokenAndUser({ token, user }))
      }

      if (user) {
        dispatch(
          setActiveWorkspace({
            activeOrganizationId: user.orgId,
            activeVillaId: user.villaId || null,
            activeRole: user.role,
            allowedFeatures: user.permissions || [],
            isPlatform: user.isPlatform || false,
            availableWorkspaces: availableWorkspaces,
          }),
        )
      }
      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to accept invitation',
      )
    }
  },
)

export const acceptSsoInvitation = createAsyncThunk(
  'auth/acceptSsoInvitation',
  async ({ inviteToken, ssoCredential, provider }, { dispatch, rejectWithValue }) => {
    try {
      const response = await authService.acceptSsoInvite({ inviteToken, ssoCredential, provider })

      const user = response.data?.user
      const availableWorkspaces = response.data?.availableWorkspaces || []

      if (user) {
        dispatch(
          setActiveWorkspace({
            activeOrganizationId: user.orgId,
            activeVillaId: user.villaId || null,
            activeRole: user.role,
            allowedFeatures: user.permissions || [],
            isPlatform: user.isPlatform || false,
            availableWorkspaces: availableWorkspaces,
          }),
        )
      }
      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to accept SSO invitation',
      )
    }
  },
)

export const rejectInvitation = createAsyncThunk(
  'auth/rejectInvitation',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await authService.rejectInvite(payload)
      return response.data || response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to reject invitation',
      )
    }
  },
)

export const switchWorkspaceContext = createAsyncThunk(
  'auth/switchWorkspaceContext',
  async (arg, { dispatch, rejectWithValue }) => {
    try {
      const rawPayload = typeof arg === 'string' ? { targetOrgId: arg } : { ...arg }
      const payload = {}
      if (rawPayload.targetOrgId) payload.targetOrgId = rawPayload.targetOrgId
      if (rawPayload.targetVillaId) payload.targetVillaId = rawPayload.targetVillaId
      if (rawPayload.targetRole) payload.targetRole = rawPayload.targetRole
      if (rawPayload.targetAssignmentId) payload.targetAssignmentId = rawPayload.targetAssignmentId
      if (rawPayload.targetAssignmentName)
        payload.targetAssignmentName = rawPayload.targetAssignmentName
      if (rawPayload.targetAssignmentType)
        payload.targetAssignmentType = rawPayload.targetAssignmentType

      const response = await authService.switchContext(payload)

      const responseData = response?.data || response
      const token = responseData?.token
      const user = responseData?.user
      const availableWorkspaces = responseData?.availableWorkspaces || []

      dispatch(updateTokenAndUser({ token, user }))

      if (user) {
        dispatch(
          setActiveWorkspace({
            activeOrganizationId: user.orgId,
            activeVillaId: user.villaId || null,
            activeRole: user.role,
            activeAssignment: user.activeAssignment || null,
            availableAssignments: user.availableAssignments || [],
            allowedFeatures: user.permissions || [],
            isPlatform: user.isPlatform || false,
            availableWorkspaces: availableWorkspaces,
          }),
        )
      }

      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to switch workspace context',
      )
    }
  },
)

export const createWorkspace = createAsyncThunk(
  'auth/createWorkspace',
  async (workspaceData, { dispatch, rejectWithValue }) => {
    try {
      const response = await authService.createWorkspace(workspaceData)

      const token = response.data?.token
      const user = response.data?.user
      const availableWorkspaces = response.data?.availableWorkspaces || []

      dispatch(updateTokenAndUser({ token, user }))

      if (user) {
        dispatch(
          setActiveWorkspace({
            activeOrganizationId: user.orgId,
            activeVillaId: user.villaId || null,
            activeRole: user.role,
            allowedFeatures: user.permissions || [],
            isPlatform: user.isPlatform || false,
            availableWorkspaces: availableWorkspaces,
          }),
        )
      }

      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to create workspace',
      )
    }
  },
)

export const registerSsoWithOrg = createAsyncThunk(
  'auth/registerSsoWithOrg',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const response = await authService.registerSsoWithOrg(payload)

      const token = response.data?.token
      const user = response.data?.user
      const availableWorkspaces = response.data?.availableWorkspaces || []

      dispatch(updateTokenAndUser({ token, user }))

      if (user) {
        dispatch(
          setActiveWorkspace({
            activeOrganizationId: user.orgId,
            activeVillaId: user.villaId || null,
            activeRole: user.role,
            allowedFeatures: user.permissions || [],
            isPlatform: user.isPlatform || false,
            availableWorkspaces: availableWorkspaces,
          }),
        )
      }

      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          'Failed to register and create organization',
      )
    }
  },
)

export const requestOtp = createAsyncThunk(
  'auth/requestOtp',
  async ({ identifier, isEmail }, { rejectWithValue }) => {
    try {
      const response = isEmail
        ? await authService.initiateEmailOtpLogin(identifier)
        : await authService.initiatePhoneLogin(identifier)
      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to request OTP',
      )
    }
  },
)

export const verifyOtpLogin = createAsyncThunk(
  'auth/verifyOtpLogin',
  async ({ identifier, code, isEmail }, { dispatch, rejectWithValue }) => {
    try {
      const response = isEmail
        ? await authService.verifyEmailOtpLogin(identifier, code)
        : await authService.verifyPhoneLogin(identifier, code)

      const user = response.data?.user
      const availableWorkspaces = response.data?.availableWorkspaces || []

      if (user) {
        dispatch(
          setActiveWorkspace({
            activeOrganizationId: user.orgId,
            activeVillaId: user.villaId || null,
            activeRole: user.role,
            allowedFeatures: user.permissions || [],
            isPlatform: user.isPlatform || false,
            availableWorkspaces: availableWorkspaces,
          }),
        )
      }
      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'OTP verification failed',
      )
    }
  },
)

export const requestPasswordReset = createAsyncThunk(
  'auth/requestPasswordReset',
  async (identifier, { rejectWithValue }) => {
    try {
      const response = await authService.forgotPassword(identifier)
      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to request password reset',
      )
    }
  },
)

export const verifyResetOtp = createAsyncThunk(
  'auth/verifyResetOtp',
  async ({ identifier, code }, { rejectWithValue }) => {
    try {
      const response = await authService.verifyResetPasswordOtp(identifier, code)
      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'OTP verification failed',
      )
    }
  },
)

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async ({ identifier, code, newPassword }, { rejectWithValue }) => {
    try {
      const response = await authService.resetPassword(identifier, code, newPassword)
      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to reset password',
      )
    }
  },
)

export const performLogout = createAsyncThunk(
  'auth/performLogout',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      await authService.logoutApi()
      dispatch(logout()) // trigger the standard reducer
      return true
    } catch (error) {
      dispatch(logout()) // still logout on frontend
      return rejectWithValue(error.response?.data?.message || error.message || 'Logout API failed')
    }
  },
)

const tokenFromStorage = localStorage.getItem('token') || null
const userFromStorage = localStorage.getItem('user')
  ? JSON.parse(localStorage.getItem('user'))
  : null

const initialState = {
  isAuthenticated: !!(tokenFromStorage || userFromStorage),
  user: userFromStorage,
  token: tokenFromStorage,
  loading: false,
  error: null,
  successMsg: null,
  invitation: {
    loading: false,
    error: null,
    token: null,
    valid: false,
    data: null,
  },
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('availableWorkspaces')
      localStorage.setItem('auth_logout', Date.now().toString())
      state.isAuthenticated = false
      state.user = null
      state.token = null
      state.error = null
      state.successMsg = null
      state.otpSent = false // for UI flow
    },
    clearStatus: (state) => {
      state.error = null
      state.successMsg = null
      state.loading = false
      state.otpSent = false
    },
    clearInvitation: (state) => {
      state.invitation = {
        loading: false,
        error: null,
        token: null,
        valid: false,
        data: null,
      }
    },
    updateTokenAndUser: (state, action) => {
      const { token, user } = action.payload || {}
      if (token) {
        state.token = token
        localStorage.setItem('token', token)
      }
      if (user) {
        state.user = user
        localStorage.setItem('user', JSON.stringify(user))
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false
        state.isAuthenticated = true
        state.token = action.payload.data?.token
        state.user = action.payload.data?.user
        state.successMsg = action.payload.message || 'Login successful!'

        if (action.payload.data?.token) {
          localStorage.setItem('token', action.payload.data.token)
        }
        if (action.payload.data?.user) {
          localStorage.setItem('user', JSON.stringify(action.payload.data.user))
        }
        if (action.payload.data?.availableWorkspaces) {
          localStorage.setItem(
            'availableWorkspaces',
            JSON.stringify(action.payload.data.availableWorkspaces),
          )
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Login failed'
      })
      // Google Login
      .addCase(loginWithGoogle.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        state.loading = false

        if (action.payload.data?.isNewUser) {
          state.successMsg = action.payload.message || 'Google token verified'
          return
        }

        state.isAuthenticated = true
        state.token = action.payload.data?.token
        state.user = action.payload.data?.user
        state.successMsg = action.payload.message || 'Google login successful!'

        if (action.payload.data?.token) {
          localStorage.setItem('token', action.payload.data.token)
        }
        if (action.payload.data?.user) {
          localStorage.setItem('user', JSON.stringify(action.payload.data.user))
        }
        if (action.payload.data?.availableWorkspaces) {
          localStorage.setItem(
            'availableWorkspaces',
            JSON.stringify(action.payload.data.availableWorkspaces),
          )
        }
      })
      .addCase(loginWithGoogle.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Google login failed'
      })
      // Microsoft Login
      .addCase(loginWithMicrosoft.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(loginWithMicrosoft.fulfilled, (state, action) => {
        state.loading = false
        state.isAuthenticated = true
        state.token = action.payload.data?.token
        state.user = action.payload.data?.user
        state.successMsg = action.payload.message || 'Microsoft login successful!'

        if (action.payload.data?.token) {
          localStorage.setItem('token', action.payload.data.token)
        }
        if (action.payload.data?.user) {
          localStorage.setItem('user', JSON.stringify(action.payload.data.user))
        }
        if (action.payload.data?.availableWorkspaces) {
          localStorage.setItem(
            'availableWorkspaces',
            JSON.stringify(action.payload.data.availableWorkspaces),
          )
        }
      })
      .addCase(loginWithMicrosoft.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Microsoft login failed'
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false
        state.isAuthenticated = true
        state.token = action.payload.data?.token
        state.user = action.payload.data?.user
        state.successMsg = action.payload.message || 'Registration successful!'

        if (action.payload.data?.token) {
          localStorage.setItem('token', action.payload.data.token)
        }
        if (action.payload.data?.user) {
          localStorage.setItem('user', JSON.stringify(action.payload.data.user))
        }
        if (action.payload.data?.availableWorkspaces) {
          localStorage.setItem(
            'availableWorkspaces',
            JSON.stringify(action.payload.data.availableWorkspaces),
          )
        }
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.message = action.payload
      })
      // verifyRegistration
      .addCase(verifyRegistration.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(verifyRegistration.fulfilled, (state, action) => {
        state.loading = false
        state.isAuthenticated = true
        state.user = action.payload.data?.user
        state.token = action.payload.data?.token
        state.successMsg = action.payload.message || 'Verification successful!'

        if (action.payload.data?.token) {
          localStorage.setItem('token', action.payload.data.token)
        }
        if (action.payload.data?.user) {
          localStorage.setItem('user', JSON.stringify(action.payload.data.user))
        }
        if (action.payload.data?.availableWorkspaces) {
          localStorage.setItem(
            'availableWorkspaces',
            JSON.stringify(action.payload.data.availableWorkspaces),
          )
        }
      })
      .addCase(verifyRegistration.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.message = action.payload
      })
      // Register SSO With Org
      .addCase(registerSsoWithOrg.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(registerSsoWithOrg.fulfilled, (state, action) => {
        state.loading = false
        state.isAuthenticated = true
        state.token = action.payload.data?.token
        state.user = action.payload.data?.user
        state.successMsg = action.payload.message || 'Registration successful!'

        if (action.payload.data?.token) {
          localStorage.setItem('token', action.payload.data.token)
        }
        if (action.payload.data?.user) {
          localStorage.setItem('user', JSON.stringify(action.payload.data.user))
        }
        if (action.payload.data?.availableWorkspaces) {
          localStorage.setItem(
            'availableWorkspaces',
            JSON.stringify(action.payload.data.availableWorkspaces),
          )
        }
      })
      .addCase(registerSsoWithOrg.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Registration failed'
      })
      // Update Profile
      .addCase(updateProfile.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false
        state.user = {
          ...state.user,
          ...action.payload.data,
        }
        state.successMsg = action.payload.message || 'Profile updated successfully!'

        if (state.user) {
          localStorage.setItem('user', JSON.stringify(state.user))
        }
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Profile update failed'
      })
      // Accept Invitation
      .addCase(acceptInvitation.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(acceptInvitation.fulfilled, (state, action) => {
        state.loading = false
        state.isAuthenticated = true
        state.token = action.payload.data?.token
        state.user = action.payload.data?.user
        state.successMsg = action.payload.message || 'Password set successfully.'

        if (action.payload.data?.token) {
          localStorage.setItem('token', action.payload.data.token)
        }
        if (action.payload.data?.user) {
          localStorage.setItem('user', JSON.stringify(action.payload.data.user))
        }
        if (action.payload.data?.availableWorkspaces) {
          localStorage.setItem(
            'availableWorkspaces',
            JSON.stringify(action.payload.data.availableWorkspaces),
          )
        }
      })
      .addCase(acceptInvitation.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to accept invitation'
      })
      // Accept SSO Invitation
      .addCase(acceptSsoInvitation.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(acceptSsoInvitation.fulfilled, (state, action) => {
        state.loading = false
        state.isAuthenticated = true
        state.token = action.payload.data?.token
        state.user = action.payload.data?.user
        state.successMsg = action.payload.message || 'SSO Invitation accepted successfully.'

        if (action.payload.data?.token) {
          localStorage.setItem('token', action.payload.data.token)
        }
        if (action.payload.data?.user) {
          localStorage.setItem('user', JSON.stringify(action.payload.data.user))
        }
        if (action.payload.data?.availableWorkspaces) {
          localStorage.setItem(
            'availableWorkspaces',
            JSON.stringify(action.payload.data.availableWorkspaces),
          )
        }
      })
      .addCase(acceptSsoInvitation.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to accept SSO invitation'
      })
      // Switch Workspace Context
      .addCase(switchWorkspaceContext.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(switchWorkspaceContext.fulfilled, (state, action) => {
        state.loading = false
        state.token = action.payload.data?.token || action.payload.token || state.token
        state.user = action.payload.data?.user || action.payload.user || state.user
        state.successMsg = action.payload.message || 'Switched workspace context successfully!'

        if (state.token) {
          localStorage.setItem('token', state.token)
        }
        if (state.user) {
          localStorage.setItem('user', JSON.stringify(state.user))
        }
        const availableWs =
          action.payload?.data?.availableWorkspaces || action.payload?.availableWorkspaces
        if (availableWs) {
          localStorage.setItem('availableWorkspaces', JSON.stringify(availableWs))
        }
      })
      .addCase(switchWorkspaceContext.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Workspace context switch failed'
      })
      // Create Workspace
      .addCase(createWorkspace.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(createWorkspace.fulfilled, (state, action) => {
        state.loading = false
        state.token = action.payload.data?.token
        state.user = action.payload.data?.user
        state.successMsg = action.payload.message || 'Workspace created successfully!'

        if (action.payload.data?.token) {
          localStorage.setItem('token', action.payload.data.token)
        }
        if (action.payload.data?.user) {
          localStorage.setItem('user', JSON.stringify(action.payload.data.user))
        }
        if (action.payload.data?.availableWorkspaces) {
          localStorage.setItem(
            'availableWorkspaces',
            JSON.stringify(action.payload.data.availableWorkspaces),
          )
        }
      })
      .addCase(createWorkspace.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Workspace creation failed'
      })
      // Request OTP
      .addCase(requestOtp.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(requestOtp.fulfilled, (state, action) => {
        state.loading = false
        state.otpSent = true
        state.successMsg = action.payload.message || 'OTP sent successfully!'
      })
      .addCase(requestOtp.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to send OTP'
      })
      // Verify OTP Login
      .addCase(verifyOtpLogin.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(verifyOtpLogin.fulfilled, (state, action) => {
        state.loading = false
        state.isAuthenticated = true
        state.otpSent = false
        state.token = action.payload.data?.token
        state.user = action.payload.data?.user
        state.successMsg = action.payload.message || 'Login successful!'

        if (action.payload.data?.token) {
          localStorage.setItem('token', action.payload.data.token)
        }
        if (action.payload.data?.user) {
          localStorage.setItem('user', JSON.stringify(action.payload.data.user))
        }
        if (action.payload.data?.availableWorkspaces) {
          localStorage.setItem(
            'availableWorkspaces',
            JSON.stringify(action.payload.data.availableWorkspaces),
          )
        }
      })
      .addCase(verifyOtpLogin.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Login failed'
      })
      // Password Reset
      .addCase(requestPasswordReset.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(requestPasswordReset.fulfilled, (state, action) => {
        state.loading = false
        state.otpSent = true
        state.successMsg = action.payload.message || 'Reset OTP sent!'
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to send reset OTP'
      })
      .addCase(verifyResetOtp.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(verifyResetOtp.fulfilled, (state, action) => {
        state.loading = false
        state.successMsg = action.payload.message || 'OTP verified successfully!'
      })
      .addCase(verifyResetOtp.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Invalid OTP'
      })
      .addCase(resetPassword.pending, (state) => {
        state.loading = true
        state.error = null
        state.successMsg = null
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        state.loading = false
        state.otpSent = false
        state.successMsg = action.payload.message || 'Password reset successfully!'
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Password reset failed'
      })
      // Validate Invitation
      .addCase(validateInvitation.pending, (state) => {
        state.invitation.loading = true
        state.invitation.error = null
      })
      .addCase(validateInvitation.fulfilled, (state, action) => {
        state.invitation.loading = false
        state.invitation.token = action.meta?.arg
        const data = action.payload.data?.data || action.payload.data || action.payload
        state.invitation.data = data
        state.invitation.valid = data?.valid !== false
        state.invitation.error =
          data?.valid === false ? data?.state || data?.invitationStatus || 'INVALID' : null
      })
      .addCase(validateInvitation.rejected, (state, action) => {
        state.invitation.loading = false
        state.invitation.valid = false
        state.invitation.token = action.meta?.arg || null
        state.invitation.data = null
        const errMsg = action.payload || ''
        if (typeof errMsg === 'string' && errMsg.toLowerCase().includes('reject')) {
          state.invitation.error = 'REJECTED'
        } else {
          state.invitation.error = errMsg || 'Invalid or expired invitation token'
        }
      })
      // Reject Invitation
      .addCase(rejectInvitation.pending, (state) => {
        state.invitation.loading = true
        state.invitation.error = null
      })
      .addCase(rejectInvitation.fulfilled, (state, action) => {
        state.invitation.loading = false
        state.invitation.valid = false
        state.invitation.error = 'REJECTED'
        if (state.invitation.data) {
          state.invitation.data.membershipStatus = 'Rejected'
          state.invitation.data.invitationStatus = 'REJECTED'
        }
      })
      .addCase(rejectInvitation.rejected, (state, action) => {
        state.invitation.loading = false
        const errMsg = action.payload || ''
        if (typeof errMsg === 'string' && errMsg.toLowerCase().includes('reject')) {
          state.invitation.valid = false
          state.invitation.error = 'REJECTED'
          if (state.invitation.data) {
            state.invitation.data.membershipStatus = 'Rejected'
            state.invitation.data.invitationStatus = 'REJECTED'
          }
        } else {
          state.invitation.error = errMsg || 'Failed to reject invitation'
        }
      })
  },
})

export const { logout, clearStatus, clearInvitation, updateTokenAndUser } = authSlice.actions
export default authSlice.reducer
