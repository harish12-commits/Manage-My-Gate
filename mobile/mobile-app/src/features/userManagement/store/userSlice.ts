import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as userService from '../services/userService';
import { UserData, InviteUserData } from '../services/userService';

export const STATUS_OPTIONS = ['Active', 'Inactive', 'Pending', 'Rejected'];

export interface UserManagementState {
  users: UserData[];
  searchQuery: string;
  selectedRoles: string[];
  statusFilter: string[];
  currentPage: number;
  rowsPerPage: number;
  totalRecords: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}

export const DUMMY_USERS: UserData[] = [];

const initialState: UserManagementState = {
  users: [],
  searchQuery: '',
  selectedRoles: [],
  statusFilter: ['Active', 'Inactive', 'Pending', 'Rejected'],
  currentPage: 1,
  rowsPerPage: 10,
  totalRecords: 0,
  totalPages: 1,
  loading: false,
  error: null,
};

// Async Thunks
export const fetchUsersAsync = createAsyncThunk(
  'userManagement/fetchUsers',
  async (params: { page: number; limit: number } | undefined, { getState, rejectWithValue }) => {
    try {
      const state = (getState() as any).userManagement as UserManagementState;
      const page = params?.page || state.currentPage || 1;
      const limit = params?.limit || state.rowsPerPage || 10;

      const response = await userService.fetchUsers({
        page,
        limit,
        search: state.searchQuery,
        roles: state.selectedRoles,
        status: state.statusFilter,
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch users');
    }
  }
);

export const fetchUsersThunk = fetchUsersAsync;

export const inviteUserAsync = createAsyncThunk(
  'userManagement/inviteUser',
  async (inviteData: InviteUserData, { rejectWithValue }) => {
    try {
      const response = await userService.inviteUser(inviteData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to invite user');
    }
  }
);

export const bulkInviteUsersAsync = createAsyncThunk(
  'userManagement/bulkInviteUsers',
  async (invitations: InviteUserData[], { rejectWithValue }) => {
    try {
      const response = await userService.bulkInviteUsers(invitations);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to bulk invite users');
    }
  }
);

export const deleteUserAsync = createAsyncThunk(
  'userManagement/deleteUser',
  async (payload: { userId: string; villaId?: string | null }, { rejectWithValue }) => {
    try {
      const response = await userService.deleteUser(payload.userId, payload.villaId);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete user');
    }
  }
);

export const updateUserRolesAsync = createAsyncThunk(
  'userManagement/updateUserRoles',
  async (payload: { userId: string; roles: string[]; villaId?: string | null }, { rejectWithValue }) => {
    try {
      const response = await userService.updateUserRoles(payload.userId, payload.roles, payload.villaId);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update user roles');
    }
  }
);

const userSlice = createSlice({
  name: 'userManagement',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    toggleRole: (state, action: PayloadAction<string>) => {
      const role = action.payload;
      if (state.selectedRoles.includes(role)) {
        state.selectedRoles = [];
      } else {
        state.selectedRoles = [role];
      }
    },
    toggleStatus: (state, action: PayloadAction<string>) => {
      const status = action.payload;
      if (state.statusFilter.includes(status)) {
        state.statusFilter = state.statusFilter.filter((s) => s !== status);
      } else {
        state.statusFilter.push(status);
      }
    },
    clearRoleFilter: (state) => {
      state.selectedRoles = [];
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    setRowsPerPage: (state, action: PayloadAction<number>) => {
      state.rowsPerPage = action.payload;
    },
    clearUsers: (state) => {
      state.users = [];
      state.totalRecords = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Users
      .addCase(fetchUsersAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsersAsync.fulfilled, (state, action: any) => {
        state.loading = false;
        const fetchedData = action.payload?.data || [];
        const page = action.meta.arg?.page || 1;

        if (page === 1) {
          state.users = fetchedData;
        } else {
          // Append for infinite scroll, avoiding duplicates
          const existingIds = new Set(state.users.map((u) => u.id || (u as any)._id));
          const newUsers = fetchedData.filter((u: any) => !existingIds.has(u.id || u._id));
          state.users = [...state.users, ...newUsers];
        }

        state.totalRecords = action.payload?.pagination?.totalRecords || state.users.length;
        state.currentPage = action.payload?.pagination?.currentPage || 1;
        state.totalPages = action.payload?.pagination?.totalPages || 1;
      })
      .addCase(fetchUsersAsync.rejected, (state, action: any) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch users';
      })
      // Invite User
      .addCase(inviteUserAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(inviteUserAsync.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(inviteUserAsync.rejected, (state, action: any) => {
        state.loading = false;
        state.error = action.payload || 'Failed to invite user';
      })
      // Bulk Invite Users
      .addCase(bulkInviteUsersAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(bulkInviteUsersAsync.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(bulkInviteUsersAsync.rejected, (state, action: any) => {
        state.loading = false;
        state.error = action.payload || 'Failed to bulk invite users';
      })
      // Delete User
      .addCase(deleteUserAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteUserAsync.fulfilled, (state, action: any) => {
        state.loading = false;
        if (!action.payload.villaId) {
          state.users = state.users.filter((u) => u.id !== action.payload.userId && u._id !== action.payload.userId);
        }
      })
      .addCase(deleteUserAsync.rejected, (state, action: any) => {
        state.loading = false;
        state.error = action.payload || 'Failed to delete user';
      })
      // Update User Roles
      .addCase(updateUserRolesAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserRolesAsync.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateUserRolesAsync.rejected, (state, action: any) => {
        state.loading = false;
        state.error = action.payload || 'Failed to update user roles';
      });
  },
});

export const {
  setSearchQuery,
  toggleRole,
  toggleStatus,
  clearRoleFilter,
  setCurrentPage,
  setRowsPerPage,
  clearUsers,
} = userSlice.actions;

export default userSlice.reducer;
