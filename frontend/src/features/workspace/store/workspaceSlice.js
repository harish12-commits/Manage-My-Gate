import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import workspaceApi from '../services/workspaceApi.js'

// Async Thunks
export const loadWorkspaces = createAsyncThunk(
  'workspace/loadWorkspaces',
  async (_, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.getWorkspaces()
      return response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to load workspaces')
    }
  },
)

export const getWorkspaceDetails = createAsyncThunk(
  'workspace/getWorkspaceDetails',
  async (id, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.getWorkspaceDetails(id)
      return response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to load workspace details')
    }
  },
)

export const editWorkspaceDetails = createAsyncThunk(
  'workspace/editWorkspaceDetails',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.updateWorkspace(id, data)
      return response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update workspace details')
    }
  },
)

export const removeWorkspace = createAsyncThunk(
  'workspace/removeWorkspace',
  async (id, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.deleteWorkspace(id)
      return response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete workspace')
    }
  },
)

export const createNewWorkspace = createAsyncThunk(
  'workspace/createNewWorkspace',
  async (workspaceData, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.createWorkspace(workspaceData)
      return response.data || response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create workspace')
    }
  },
)

export const toggleModule = createAsyncThunk(
  'workspace/toggleModule',
  async ({ workspaceId, moduleId, enabled }, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.toggleWorkspaceModule(workspaceId, moduleId, enabled)
      return response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to toggle module')
    }
  },
)

export const addModule = createAsyncThunk(
  'workspace/addModule',
  async ({ workspaceId, moduleData }, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.addWorkspaceModule(workspaceId, moduleData)
      return response.data || response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to add module')
    }
  },
)

export const editModule = createAsyncThunk(
  'workspace/editModule',
  async ({ workspaceId, moduleId, moduleData }, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.updateWorkspaceModule(workspaceId, moduleId, moduleData)
      return response.data || response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update module')
    }
  },
)

export const removeModule = createAsyncThunk(
  'workspace/removeModule',
  async ({ workspaceId, moduleId }, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.deleteWorkspaceModule(workspaceId, moduleId)
      return response.data || response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete module')
    }
  },
)

export const loadWorkspaceMembers = createAsyncThunk(
  'workspace/loadWorkspaceMembers',
  async (workspaceId, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.getWorkspaceMembers(workspaceId)
      return response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to load workspace members')
    }
  },
)

export const addMember = createAsyncThunk(
  'workspace/addMember',
  async ({ workspaceId, identifier }, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.addWorkspaceMember(workspaceId, identifier)
      return response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to add member')
    }
  },
)

export const removeMember = createAsyncThunk(
  'workspace/removeMember',
  async ({ workspaceId, userId }, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.removeWorkspaceMember(workspaceId, userId)
      return response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to remove member')
    }
  },
)

export const loadCurrentModules = createAsyncThunk(
  'workspace/loadCurrentModules',
  async (_, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.getCurrentWorkspaceModules()
      return response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to load current modules')
    }
  },
)

// Synchronously hydrate initial workspace state from localStorage on page refresh
const cachedUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null
const cachedWorkspaces = localStorage.getItem('availableWorkspaces')
  ? JSON.parse(localStorage.getItem('availableWorkspaces'))
  : []

const initialState = {
  activeOrganizationId: cachedUser?.orgId || null,
  activeVillaId: cachedUser?.villaId || null,
  activeRole: cachedUser?.role || null,
  activeAssignment: cachedUser?.activeAssignment || null,
  availableAssignments: cachedUser?.availableAssignments || [],
  allowedFeatures: cachedUser?.permissions || [],
  organizationName: cachedWorkspaces.find((w) => w.orgId === cachedUser?.orgId)?.name || null,
  isPlatform: cachedUser?.isPlatform || false,
  availableWorkspaces: cachedWorkspaces,
  loading: false,
  error: null,

  activeWorkspaceDetails: null,
  workspaceModules: [],
  workspaceMembers: [],
  workspaceActivityLogs: [],
  modules: [],
}

export const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setActiveWorkspace: (state, action) => {
      const {
        activeOrganizationId,
        activeVillaId,
        activeRole,
        activeAssignment,
        availableAssignments,
        allowedFeatures,
        isPlatform,
        availableWorkspaces,
      } = action.payload || {}

      state.activeOrganizationId = activeOrganizationId ?? null
      state.activeVillaId = activeVillaId ?? null
      state.activeRole = activeRole ?? null
      if (activeAssignment !== undefined) {
        state.activeAssignment = activeAssignment ?? null
      }
      if (availableAssignments !== undefined) {
        state.availableAssignments = availableAssignments ?? []
      }
      state.allowedFeatures = allowedFeatures ?? []
      state.isPlatform = isPlatform ?? false

      if (availableWorkspaces) {
        state.availableWorkspaces = availableWorkspaces
        localStorage.setItem('availableWorkspaces', JSON.stringify(availableWorkspaces))
      }

      // Update organizationName based on the matching workspace in availableWorkspaces
      const matched = state.availableWorkspaces.find((w) => w.orgId === state.activeOrganizationId)
      state.organizationName = matched ? matched.name : null
    },
    clearWorkspace: (state) => {
      localStorage.removeItem('availableWorkspaces')
      state.activeOrganizationId = null
      state.activeVillaId = null
      state.activeRole = null
      state.activeAssignment = null
      state.availableAssignments = []
      state.allowedFeatures = []
      state.organizationName = null
      state.isPlatform = false
      state.availableWorkspaces = []
      state.loading = false
      state.error = null
      state.activeWorkspaceDetails = null
      state.workspaceModules = []
      state.workspaceMembers = []
      state.workspaceActivityLogs = []
      state.modules = []
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase('auth/logout', (state) => {
        localStorage.removeItem('availableWorkspaces')
        state.activeOrganizationId = null
        state.activeVillaId = null
        state.activeRole = null
        state.activeAssignment = null
        state.availableAssignments = []
        state.allowedFeatures = []
        state.organizationName = null
        state.isPlatform = false
        state.availableWorkspaces = []
        state.loading = false
        state.error = null
        state.activeWorkspaceDetails = null
        state.workspaceModules = []
        state.workspaceMembers = []
        state.workspaceActivityLogs = []
        state.modules = []
      })
      .addCase('auth/createWorkspace/fulfilled', (state, action) => {
        const payloadData = action.payload?.data
        if (payloadData && payloadData.user) {
          state.activeOrganizationId = payloadData.user.orgId
          state.activeVillaId = payloadData.user.villaId || null
          state.activeRole = payloadData.user.role
          state.allowedFeatures = payloadData.user.permissions || []
          state.isPlatform = payloadData.user.isPlatform || false
        }
        if (payloadData && payloadData.availableWorkspaces) {
          state.availableWorkspaces = payloadData.availableWorkspaces
          const matched = payloadData.availableWorkspaces.find(
            (w) => w.orgId === state.activeOrganizationId,
          )
          state.organizationName = matched ? matched.name : null
        }
      })
      // loadWorkspaces
      .addCase(loadWorkspaces.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loadWorkspaces.fulfilled, (state, action) => {
        state.loading = false
        if (action.payload?.data) {
          state.availableWorkspaces = action.payload.data
        }
      })
      .addCase(loadWorkspaces.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to load workspaces'
      })
      // getWorkspaceDetails
      .addCase(getWorkspaceDetails.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getWorkspaceDetails.fulfilled, (state, action) => {
        state.loading = false
        const details = action.payload?.data
        state.activeWorkspaceDetails = details
        state.workspaceModules = details?.modules || []
        state.workspaceMembers = details?.members || []
        state.workspaceActivityLogs = details?.activityLogs || []
      })
      .addCase(getWorkspaceDetails.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to load workspace details'
      })
      // editWorkspaceDetails
      .addCase(editWorkspaceDetails.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(editWorkspaceDetails.fulfilled, (state, action) => {
        state.loading = false
        const updatedWorkspace = action.payload?.data
        state.activeWorkspaceDetails = updatedWorkspace

        // Also update the workspace name in availableWorkspaces
        if (updatedWorkspace && state.availableWorkspaces) {
          const index = state.availableWorkspaces.findIndex(
            (w) => w.orgId === updatedWorkspace.organizationId,
          )
          if (index !== -1) {
            state.availableWorkspaces[index].name = updatedWorkspace.workspaceName
            localStorage.setItem('availableWorkspaces', JSON.stringify(state.availableWorkspaces))
          }
        }
      })
      .addCase(editWorkspaceDetails.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to edit workspace details'
      })
      // removeWorkspace
      .addCase(removeWorkspace.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(removeWorkspace.fulfilled, (state) => {
        state.loading = false
        state.activeWorkspaceDetails = null
        state.workspaceModules = []
        state.workspaceMembers = []
        state.workspaceActivityLogs = []
      })
      .addCase(removeWorkspace.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to remove workspace'
      })
      // createNewWorkspace
      .addCase(createNewWorkspace.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createNewWorkspace.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(createNewWorkspace.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to create workspace'
      })
      // toggleModule
      .addCase(toggleModule.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(toggleModule.fulfilled, (state, action) => {
        state.loading = false
        const payloadData = action.payload?.data
        const all = payloadData?.allModules || (Array.isArray(payloadData) ? payloadData : [])
        const enabled = payloadData?.modules || all.filter((m) => m.enabled)
        state.workspaceModules = all
        state.modules = enabled
        state.allowedFeatures = enabled.map((m) => m.moduleKey)
        if (state.activeWorkspaceDetails) {
          state.activeWorkspaceDetails.modules = all
        }
      })
      .addCase(toggleModule.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to toggle module'
      })
      // addModule
      .addCase(addModule.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(addModule.fulfilled, (state, action) => {
        state.loading = false
        state.workspaceModules = action.payload?.data || []
      })
      .addCase(addModule.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to add module'
      })
      // editModule
      .addCase(editModule.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(editModule.fulfilled, (state, action) => {
        state.loading = false
        state.workspaceModules = action.payload?.data || []
      })
      .addCase(editModule.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to update module'
      })
      // removeModule
      .addCase(removeModule.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(removeModule.fulfilled, (state, action) => {
        state.loading = false
        state.workspaceModules = action.payload?.data || []
      })
      .addCase(removeModule.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to delete module'
      })
      // loadWorkspaceMembers
      .addCase(loadWorkspaceMembers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loadWorkspaceMembers.fulfilled, (state, action) => {
        state.loading = false
        state.workspaceMembers = action.payload?.data || []
      })
      .addCase(loadWorkspaceMembers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to load workspace members'
      })
      // addMember
      .addCase(addMember.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(addMember.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(addMember.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to add member'
      })
      // removeMember
      .addCase(removeMember.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(removeMember.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(removeMember.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to remove member'
      })
      // loadCurrentModules
      .addCase(loadCurrentModules.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loadCurrentModules.fulfilled, (state, action) => {
        state.loading = false
        const payloadData = action.payload?.data
        const all = payloadData?.allModules || (Array.isArray(payloadData) ? payloadData : [])
        const modules = payloadData?.modules || (Array.isArray(payloadData) ? payloadData : [])
        state.modules = modules
        if (all.length > 0) {
          state.workspaceModules = all
          if (state.activeWorkspaceDetails) {
            state.activeWorkspaceDetails.modules = all
          }
        }
        state.allowedFeatures = modules.map((m) => m.moduleKey)
        state.subscriptionStatus = payloadData?.subscriptionStatus || 'ACTIVE'
        state.accessGranted = payloadData?.accessGranted !== false
        state.subscriptionReason = payloadData?.reason || null
      })
      .addCase(loadCurrentModules.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Failed to load current modules'
      })
  },
})

export const { setActiveWorkspace, clearWorkspace } = workspaceSlice.actions
export default workspaceSlice.reducer
