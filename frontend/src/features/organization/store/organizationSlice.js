import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import organizationApi from '../services/organizationApi.js'
import { updateTokenAndUser } from '../../auth/store/authSlice.js'
import { setActiveWorkspace } from '../../workspace/store/workspaceSlice.js'

export const createOrganization = createAsyncThunk(
  'organization/createOrganization',
  async (workspaceData, { dispatch, rejectWithValue }) => {
    try {
      const response = await organizationApi.setupWorkspace(workspaceData)

      const token = response.data?.token
      const user = response.data?.user
      const availableWorkspaces = response.data?.availableWorkspaces || []

      if (token && user) {
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

      return response.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to create organization',
      )
    }
  },
)

export const loadOrganizations = createAsyncThunk(
  'organization/loadOrganizations',
  async ({ page = 1, limit = 10 } = {}, { rejectWithValue }) => {
    try {
      const response = await organizationApi.fetchOrganizations(page, limit)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch organizations')
    }
  },
)

export const toggleOrgStatus = createAsyncThunk(
  'organization/toggleOrgStatus',
  async ({ orgId, currentStatus }, { rejectWithValue }) => {
    try {
      const nextStatus = currentStatus === 'Active' ? 'Rejected' : 'Active'
      const response = await organizationApi.updateOrganizationStatus(orgId, nextStatus)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to toggle organization status')
    }
  },
)

export const loadOrganizationDetails = createAsyncThunk(
  'organization/loadOrganizationDetails',
  async ({ orgId }, { rejectWithValue }) => {
    try {
      const response = await organizationApi.fetchOrganizationDetails(orgId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch organization details')
    }
  },
)

export const loadOrganizationUsers = createAsyncThunk(
  'organization/loadOrganizationUsers',
  async (
    { orgId, page = 1, limit = 10, search = '', role = '', status = '' },
    { rejectWithValue },
  ) => {
    try {
      const response = await organizationApi.fetchOrganizationUsers(orgId, {
        page,
        limit,
        search,
        role,
        status,
      })
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch organization users')
    }
  },
)

export const loadOrganizationUserDetails = createAsyncThunk(
  'organization/loadOrganizationUserDetails',
  async ({ orgId, userId }, { rejectWithValue }) => {
    try {
      const response = await organizationApi.fetchOrganizationUserDetails(orgId, userId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch user details')
    }
  },
)

const initialState = {
  list: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0,
  loading: false,
  error: null,

  createLoading: false,
  createError: null,
  currentCreatedOrganization: null,

  selectedOrganization: null,
  detailsLoading: false,
  detailsError: null,

  users: {
    list: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
    search: '',
    roleFilter: '',
    statusFilter: '',
    loading: false,
    error: null,
    selectedUser: null,
    userDrawerOpen: false,
    userDrawerLoading: false,
  },
}

export const organizationSlice = createSlice({
  name: 'organization',
  initialState,
  reducers: {
    clearCreateOrganizationState: (state) => {
      state.createLoading = false
      state.createError = null
      state.currentCreatedOrganization = null
    },
    clearOrganizationError: (state) => {
      state.error = null
      state.createError = null
      state.detailsError = null
      state.users.error = null
    },
    setUserSearch: (state, action) => {
      state.users.search = action.payload
      state.users.page = 1
    },
    setUserRoleFilter: (state, action) => {
      state.users.roleFilter = action.payload
      state.users.page = 1
    },
    setUserStatusFilter: (state, action) => {
      state.users.statusFilter = action.payload
      state.users.page = 1
    },
    closeUserDrawer: (state) => {
      state.users.userDrawerOpen = false
      state.users.selectedUser = null
    },
    clearSelectedOrganization: (state) => {
      state.selectedOrganization = null
      state.users.list = []
      state.users.total = 0
      state.users.page = 1
      state.users.totalPages = 0
      state.users.selectedUser = null
      state.users.userDrawerOpen = false
    },
  },
  extraReducers: (builder) => {
    builder
      // loadOrganizations
      .addCase(loadOrganizations.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loadOrganizations.fulfilled, (state, action) => {
        state.loading = false
        state.list = action.payload?.organizations || []
        state.total = action.payload?.total || 0
        state.page = action.payload?.page || 1
        state.limit = action.payload?.limit || 10
        state.totalPages = action.payload?.totalPages || 0
      })
      .addCase(loadOrganizations.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to load organizations'
      })
      // toggleOrgStatus
      .addCase(toggleOrgStatus.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(toggleOrgStatus.fulfilled, (state, action) => {
        state.loading = false
        const updatedOrg = action.payload
        if (updatedOrg && updatedOrg._id) {
          state.list = state.list.map((org) => (org._id === updatedOrg._id ? updatedOrg : org))
          if (
            state.selectedOrganization &&
            state.selectedOrganization.organization._id === updatedOrg._id
          ) {
            state.selectedOrganization.organization = updatedOrg
          }
        }
      })
      .addCase(toggleOrgStatus.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to update organization status'
      })
      // loadOrganizationDetails
      .addCase(loadOrganizationDetails.pending, (state) => {
        state.detailsLoading = true
        state.detailsError = null
      })
      .addCase(loadOrganizationDetails.fulfilled, (state, action) => {
        state.detailsLoading = false
        state.selectedOrganization = action.payload
      })
      .addCase(loadOrganizationDetails.rejected, (state, action) => {
        state.detailsLoading = false
        state.detailsError = action.payload || 'Failed to load organization details'
      })
      // loadOrganizationUsers
      .addCase(loadOrganizationUsers.pending, (state) => {
        state.users.loading = true
        state.users.error = null
      })
      .addCase(loadOrganizationUsers.fulfilled, (state, action) => {
        state.users.loading = false
        state.users.list = action.payload?.data || []
        state.users.total = action.payload?.total || 0
        state.users.page = action.payload?.page || 1
        state.users.limit = action.payload?.limit || 10
        state.users.totalPages = action.payload?.totalPages || 0
      })
      .addCase(loadOrganizationUsers.rejected, (state, action) => {
        state.users.loading = false
        state.users.error = action.payload || 'Failed to load organization users'
      })
      // loadOrganizationUserDetails
      .addCase(loadOrganizationUserDetails.pending, (state) => {
        state.users.userDrawerLoading = true
        state.users.userDrawerOpen = true
      })
      .addCase(loadOrganizationUserDetails.fulfilled, (state, action) => {
        state.users.userDrawerLoading = false
        state.users.selectedUser = action.payload
      })
      .addCase(loadOrganizationUserDetails.rejected, (state, action) => {
        state.users.userDrawerLoading = false
        state.users.error = action.payload || 'Failed to load user details'
      })
      // createOrganization
      .addCase(createOrganization.pending, (state) => {
        state.createLoading = true
        state.createError = null
      })
      .addCase(createOrganization.fulfilled, (state, action) => {
        state.createLoading = false
        state.createError = null
        const createdUser = action.payload?.user
        if (createdUser?.orgId) {
          state.currentCreatedOrganization = {
            id: createdUser.orgId,
            name: createdUser.organizationName || createdUser.orgName,
          }
        }
      })
      .addCase(createOrganization.rejected, (state, action) => {
        state.createLoading = false
        state.createError = action.payload || 'Failed to create organization'
      })
  },
})

export const {
  clearCreateOrganizationState,
  clearOrganizationError,
  setUserSearch,
  setUserRoleFilter,
  setUserStatusFilter,
  closeUserDrawer,
  clearSelectedOrganization,
} = organizationSlice.actions

export default organizationSlice.reducer
