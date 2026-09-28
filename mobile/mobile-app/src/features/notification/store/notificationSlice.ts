import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import notificationService, { NotificationItemData, GetNotificationsResponse } from '../services/notificationService';

export interface NotificationState {
  items: NotificationItemData[];
  unreadCount: number;
  latestNotification: NotificationItemData | null;
  pendingRoute: string | null;
  lastHandledNotificationId: string | null;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
  };
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  items: [],
  unreadCount: 0,
  latestNotification: null,
  pendingRoute: null,
  lastHandledNotificationId: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
  },
  loading: false,
  error: null,
};

export const fetchNotificationsThunk = createAsyncThunk<
  GetNotificationsResponse,
  { page?: number; limit?: number } | void,
  { rejectValue: string }
>('notifications/fetchNotifications', async (params, { rejectWithValue }) => {
  try {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const data = await notificationService.getNotifications(page, limit);
    return data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch notifications');
  }
});

export const markAsReadThunk = createAsyncThunk<
  NotificationItemData,
  string,
  { rejectValue: string }
>('notifications/markAsRead', async (id, { rejectWithValue }) => {
  try {
    const data = await notificationService.markAsRead(id);
    return data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || error.message || 'Failed to mark notification as read');
  }
});

export const markAllAsReadThunk = createAsyncThunk<
  { matchedCount: number; modifiedCount: number },
  void,
  { rejectValue: string }
>('notifications/markAllAsRead', async (_, { rejectWithValue }) => {
  try {
    const data = await notificationService.markAllAsRead();
    return data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || error.message || 'Failed to mark all as read');
  }
});

export const deleteNotificationThunk = createAsyncThunk<
  { id: string },
  string,
  { rejectValue: string }
>('notifications/deleteNotification', async (id, { rejectWithValue }) => {
  try {
    await notificationService.deleteNotification(id);
    return { id };
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || error.message || 'Failed to delete notification');
  }
});

export const deleteAllNotificationsThunk = createAsyncThunk<
  { deletedCount: number },
  void,
  { rejectValue: string }
>('notifications/deleteAllNotifications', async (_, { rejectWithValue }) => {
  try {
    return await notificationService.deleteAllNotifications();
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || error.message || 'Failed to delete all notifications');
  }
});

export const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    addRealTimeNotification: (state, action: PayloadAction<NotificationItemData>) => {
      const targetId = action.payload.id || action.payload._id;
      const exists = state.items.some((i) => (i.id || i._id) === targetId);
      if (!exists) {
        state.items.unshift(action.payload);
        state.unreadCount += 1;
        state.pagination.totalRecords += 1;
      }
      // Set latest real-time notification to trigger screen banner/toast
      state.latestNotification = action.payload;
    },
    clearLatestNotification: (state) => {
      state.latestNotification = null;
    },
    setPendingRoute: (state, action: PayloadAction<string | null>) => {
      state.pendingRoute = action.payload;
    },
    clearPendingRoute: (state) => {
      state.pendingRoute = null;
    },
    setLastHandledNotificationId: (state, action: PayloadAction<string | null>) => {
      state.lastHandledNotificationId = action.payload;
    },
    clearNotificationError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchNotificationsThunk
      .addCase(fetchNotificationsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotificationsThunk.fulfilled, (state, action) => {
        state.loading = false;
        const page = action.meta.arg?.page || 1;
        const fetchedItems = action.payload?.notifications || [];

        if (page === 1) {
          state.items = fetchedItems;
        } else {
          // Filter duplicates before appending
          const existingIds = new Set(state.items.map((i) => i.id || i._id));
          const newItems = fetchedItems.filter((i) => !existingIds.has(i.id || i._id));
          state.items.push(...newItems);
        }

        if (action.payload?.pagination) {
          state.pagination.currentPage = action.payload.pagination.currentPage;
          state.pagination.totalPages = action.payload.pagination.totalPages;
          state.pagination.totalRecords = action.payload.pagination.totalRecords;
          state.unreadCount = action.payload.pagination.unreadRecords;
        }
      })
      .addCase(fetchNotificationsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch notifications';
      })

      // markAsReadThunk
      .addCase(markAsReadThunk.fulfilled, (state, action) => {
        const updated = action.payload;
        const targetId = updated.id || updated._id;
        const item = state.items.find((i) => (i.id || i._id) === targetId);
        if (item && !item.isRead) {
          item.isRead = true;
          item.readAt = updated.readAt || new Date().toISOString();
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })

      // markAllAsReadThunk
      .addCase(markAllAsReadThunk.fulfilled, (state) => {
        state.items.forEach((item) => {
          if (!item.isRead) {
            item.isRead = true;
            item.readAt = new Date().toISOString();
          }
        });
        state.unreadCount = 0;
      })

      // deleteNotificationThunk
      .addCase(deleteNotificationThunk.fulfilled, (state, action) => {
        const deletedId = action.payload.id;
        const idx = state.items.findIndex((i) => (i.id || i._id) === deletedId);
        if (idx !== -1) {
          const item = state.items[idx];
          if (!item.isRead) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
          state.items.splice(idx, 1);
          state.pagination.totalRecords = Math.max(0, state.pagination.totalRecords - 1);
        }
      })
      .addCase(deleteAllNotificationsThunk.fulfilled, (state) => {
        state.items = [];
        state.unreadCount = 0;
        state.pagination = {
          currentPage: 1,
          totalPages: 1,
          totalRecords: 0,
        };
      });
  },
});

export const {
  addRealTimeNotification,
  clearLatestNotification,
  setPendingRoute,
  clearPendingRoute,
  setLastHandledNotificationId,
  clearNotificationError,
} = notificationSlice.actions;
export default notificationSlice.reducer;
