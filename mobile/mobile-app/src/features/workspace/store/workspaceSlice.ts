import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import workspaceService from '../services/workspaceService';

export interface WorkspaceSettings {
  workspaceName?: string;
  name?: string;
  description?: string;
  organizationName?: string;
  timeZone?: string;
  language?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** ISO country; default for phone numbers typed without a country code. */
  countryCode?: string;
  settings?: any;
}

export interface WorkspaceModule {
  _id: string;
  moduleName: string;
  moduleKey: string;
  route: string;
  icon: string;
  enabled: boolean;
  displayOrder?: number;
}

interface WorkspaceState {
  settings: WorkspaceSettings | null;
  modules: WorkspaceModule[];
  allModules: WorkspaceModule[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: WorkspaceState = {
  settings: null,
  modules: [],
  allModules: [],
  loading: false,
  saving: false,
  error: null,
};

export const fetchWorkspaceSettings = createAsyncThunk(
  'workspace/fetchSettings',
  async (workspaceId: string, { rejectWithValue }) => {
    try {
      const response = await workspaceService.getWorkspaceDetails(workspaceId);
      return response?.data || response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to load workspace settings');
    }
  }
);

export const saveWorkspaceSettings = createAsyncThunk(
  'workspace/saveSettings',
  async ({ workspaceId, data }: { workspaceId: string; data: WorkspaceSettings }, { rejectWithValue }) => {
    try {
      const response = await workspaceService.updateWorkspaceSettings(workspaceId, data);
      return response?.data || response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to save workspace settings');
    }
  }
);

export const fetchWorkspaceModules = createAsyncThunk(
  'workspace/fetchModules',
  async (workspaceId: string, { rejectWithValue }) => {
    try {
      const response = await workspaceService.getWorkspaceModules(workspaceId);
      return response?.data || response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to load workspace modules');
    }
  }
);

export const toggleWorkspaceModule = createAsyncThunk(
  'workspace/toggleModule',
  async ({ workspaceId, moduleId, enabled }: { workspaceId: string; moduleId: string; enabled: boolean }, { rejectWithValue }) => {
    try {
      const response = await workspaceService.toggleWorkspaceModule(workspaceId, moduleId, enabled);
      return response?.data || response; // Should return updated modules array
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to toggle module');
    }
  }
);

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    clearWorkspaceError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWorkspaceSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkspaceSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = action.payload;
      })
      .addCase(fetchWorkspaceSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(saveWorkspaceSettings.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(saveWorkspaceSettings.fulfilled, (state, action) => {
        state.saving = false;
        state.settings = action.payload;
      })
      .addCase(saveWorkspaceSettings.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      })
      .addCase(fetchWorkspaceModules.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkspaceModules.fulfilled, (state, action) => {
        state.loading = false;
        const data = action.payload?.data || action.payload;
        state.modules = Array.isArray(data) ? data : (Array.isArray(data?.modules) ? data.modules : []);
        state.allModules = Array.isArray(data) ? data : (Array.isArray(data?.allModules) ? data.allModules : state.modules);
      })
      .addCase(fetchWorkspaceModules.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(toggleWorkspaceModule.pending, (state, action) => {
        state.saving = true;
        state.error = null;
        // Optimistic update for instant UI feedback
        const { moduleId, enabled } = action.meta.arg;
        const targetModule = state.modules.find(m => m._id === moduleId || m.moduleKey === moduleId);
        if (targetModule) {
          targetModule.enabled = enabled;
        }
        const targetAllModule = state.allModules.find(m => m._id === moduleId || m.moduleKey === moduleId);
        if (targetAllModule) {
          targetAllModule.enabled = enabled;
        }
      })
      .addCase(toggleWorkspaceModule.fulfilled, (state, action) => {
        state.saving = false;
        const data = action.payload?.data || action.payload;
        
        if (data && Array.isArray(data.allModules)) {
          state.allModules = data.allModules;
          state.modules = Array.isArray(data.modules) ? data.modules : data.allModules.filter((m: any) => m.enabled);
        } else {
          const returnedModules = Array.isArray(data) ? data : (Array.isArray(data?.modules) ? data.modules : []);
          
          if (returnedModules && returnedModules.length > 0) {
            state.allModules = returnedModules;
            state.modules = returnedModules.filter((m: any) => m.enabled);
          }
        }
      })
      .addCase(toggleWorkspaceModule.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
        // Revert optimistic update if API call fails
        const { moduleId, enabled } = action.meta.arg;
        const targetModule = state.modules.find(m => m._id === moduleId || m.moduleKey === moduleId);
        if (targetModule) {
          targetModule.enabled = !enabled;
        }
        const targetAllModule = state.allModules.find(m => m._id === moduleId || m.moduleKey === moduleId);
        if (targetAllModule) {
          targetAllModule.enabled = !enabled;
        }
      });
  },
});

export const { clearWorkspaceError } = workspaceSlice.actions;
export default workspaceSlice.reducer;
