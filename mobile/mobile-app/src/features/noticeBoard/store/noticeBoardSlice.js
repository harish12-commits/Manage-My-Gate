import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  getNotices,
  getNoticeById,
  createNotice as apiCreateNotice,
  updateNotice as apiUpdateNotice,
  deleteNotice as apiDeleteNotice,
  togglePin as apiTogglePin,
  markAsRead as apiMarkAsRead,
  bookmarkNotice as apiBookmarkNotice,
  getNoticeStats as apiGetNoticeStats,
  acknowledgeNotice as apiAcknowledgeNotice,
  getNoticeAcknowledgements as apiGetNoticeAcknowledgements,
  getNoticeComments as apiGetNoticeComments,
  addNoticeComment as apiAddNoticeComment,
  deleteNoticeComment as apiDeleteNoticeComment,
  getNoticeReactions as apiGetNoticeReactions,
  toggleNoticeReaction as apiToggleNoticeReaction,
} from '../services/noticeBoardService';
import storage from '../../../utils/storage';

// Async Thunks
export const fetchNotices = createAsyncThunk(
  'noticeBoard/fetchNotices',
  async (overrides = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const { noticeBoard } = state;
      const user = state.auth?.user || {};
      const communityId = String(user.activeOrgId || user.orgId || user.organizationId || user.activeOrganizationId || '');
      const params = {
        search: noticeBoard.search,
        page: noticeBoard.pagination.currentPage,
        limit: noticeBoard.pagination.limit,
        sortBy: noticeBoard.sort.sortBy,
        sortOrder: noticeBoard.sort.sortOrder,
        ...noticeBoard.filters,
        ...overrides,
      };
      
      // Inject KPI card filter override if active
      if (noticeBoard.activeKpiCard) {
        if (noticeBoard.activeKpiCard === 'High') {
          params.priority = 'High';
        } else {
          params.status = noticeBoard.activeKpiCard;
        }
      }

      // Clean up empty params
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const response = await getNotices(params);
      try {
        const notices = response.data?.data?.data || response.data?.data || [];
        // First-page cache is namespaced to the active community. Later pages
        // are transient list state and must not appear after a community switch.
        if (params.page === 1 && Array.isArray(notices)) {
          await storage.setItem(
            `cached_notices_${communityId || 'default'}`,
            JSON.stringify({ communityId, notices })
          );
        }
      } catch (cacheErr) {
        console.warn('Failed to cache notices:', cacheErr);
      }
      return { payload: response.data, page: Number(params.page) || 1, communityId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch notices');
    }
  }
);

export const fetchNoticeById = createAsyncThunk(
  'noticeBoard/fetchNoticeById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await getNoticeById(id);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch notice');
    }
  }
);

export const createNotice = createAsyncThunk(
  'noticeBoard/createNotice',
  async (formData, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiCreateNotice(formData);
      dispatch(fetchNotices());
      dispatch(fetchNoticeStats());
      return response.data;
    } catch (error) {
      const data = error.response?.data;
      const details = data?.details;
      let errorMsg = data?.message || 'Failed to create notice';
      if (Array.isArray(details) && details.length > 0) {
        errorMsg = details.map((d) => d.message || `${d.field} is invalid`).join('. ');
      }
      return rejectWithValue(errorMsg);
    }
  }
);

export const updateNotice = createAsyncThunk(
  'noticeBoard/updateNotice',
  async ({ id, formData }, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiUpdateNotice(id, formData);
      dispatch(fetchNotices());
      dispatch(fetchNoticeStats());
      return response.data;
    } catch (error) {
      const data = error.response?.data;
      const details = data?.details;
      let errorMsg = data?.message || 'Failed to update notice';
      if (Array.isArray(details) && details.length > 0) {
        errorMsg = details.map((d) => d.message || `${d.field} is invalid`).join('. ');
      }
      return rejectWithValue(errorMsg);
    }
  }
);

export const deleteNotice = createAsyncThunk(
  'noticeBoard/deleteNotice',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiDeleteNotice(id);
      dispatch(fetchNotices());
      dispatch(fetchNoticeStats());
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete notice');
    }
  }
);

export const togglePinNotice = createAsyncThunk(
  'noticeBoard/togglePinNotice',
  async ({ id, isPinned }, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiTogglePin(id, isPinned);
      dispatch(fetchNoticeStats());
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to pin/unpin notice');
    }
  }
);

export const markNoticeAsRead = createAsyncThunk(
  'noticeBoard/markNoticeAsRead',
  async (id, { rejectWithValue }) => {
    try {
      const response = await apiMarkAsRead(id);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark notice as read');
    }
  }
);

export const bookmarkNotice = createAsyncThunk(
  'noticeBoard/bookmarkNotice',
  async ({ id, isBookmarked }, { rejectWithValue }) => {
    try {
      const response = await apiBookmarkNotice(id, isBookmarked);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to bookmark notice');
    }
  }
);

export const fetchNoticeStats = createAsyncThunk(
  'noticeBoard/fetchNoticeStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiGetNoticeStats();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch notice statistics');
    }
  }
);

export const loadCachedNotices = createAsyncThunk(
  'noticeBoard/loadCachedNotices',
  async (_, { getState, rejectWithValue }) => {
    try {
      const user = getState().auth?.user || {};
      const communityId = String(user.activeOrgId || user.orgId || user.organizationId || user.activeOrganizationId || '');
      const cached = await storage.getItem(`cached_notices_${communityId || 'default'}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed?.communityId === communityId && Array.isArray(parsed?.notices)
          ? parsed
          : { communityId, notices: [] };
      }
      return { communityId, notices: [] };
    } catch (error) {
      return rejectWithValue('Failed to load cached notices');
    }
  }
);

export const DEFAULT_MOCK_NOTICES = [];

export const acknowledgeNoticeThunk = createAsyncThunk(
  'noticeBoard/acknowledgeNotice',
  async ({ id, payload = {} }, { rejectWithValue }) => {
    try {
      const response = await apiAcknowledgeNotice(id, payload);
      return { id, data: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to acknowledge notice');
    }
  }
);

export const fetchNoticeAcknowledgements = createAsyncThunk(
  'noticeBoard/fetchNoticeAcknowledgements',
  async ({ id, params = {} }, { rejectWithValue }) => {
    try {
      const response = await apiGetNoticeAcknowledgements(id, params);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch notice acknowledgements');
    }
  }
);

export const fetchNoticeComments = createAsyncThunk(
  'noticeBoard/fetchNoticeComments',
  async (id, { rejectWithValue }) => {
    try {
      const response = await apiGetNoticeComments(id);
      return { id, comments: response.data?.data || response.data || [] };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch comments');
    }
  }
);

export const addNoticeCommentThunk = createAsyncThunk(
  'noticeBoard/addNoticeComment',
  async ({ id, content, parentCommentId = null }, { rejectWithValue }) => {
    try {
      const response = await apiAddNoticeComment(id, { content, parentCommentId });
      return { id, comment: response.data?.data || response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to post comment');
    }
  }
);

export const deleteNoticeCommentThunk = createAsyncThunk(
  'noticeBoard/deleteNoticeComment',
  async ({ id, commentId }, { rejectWithValue }) => {
    try {
      await apiDeleteNoticeComment(id, commentId);
      return { id, commentId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete comment');
    }
  }
);

export const fetchNoticeReactions = createAsyncThunk(
  'noticeBoard/fetchNoticeReactions',
  async (id, { rejectWithValue }) => {
    try {
      const response = await apiGetNoticeReactions(id);
      return { id, reactions: response.data?.data || response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch reactions');
    }
  }
);

export const toggleNoticeReactionThunk = createAsyncThunk(
  'noticeBoard/toggleNoticeReaction',
  async ({ id, reactionType = 'LIKE' }, { rejectWithValue }) => {
    try {
      const response = await apiToggleNoticeReaction(id, reactionType);
      return { id, result: response.data?.data || response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle reaction');
    }
  }
);

// Initial Redux State
const initialState = {
  notices: [],
  communityId: null,
  selectedNotice: null,
  loading: false,
  error: null,
  success: null,
  acknowledging: false,
  acknowledgeError: null,
  acknowledgements: [],
  acknowledgementsLoading: false,
  comments: [],
  commentsLoading: false,
  commentsError: null,
  addingComment: false,
  reactions: { counts: {}, userReaction: null },
  reactionsLoading: false,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10,
  },
  search: '',
  filters: {
    category: '',
    priority: '',
    status: '',
    isPinned: '',
    isBookmarked: '',
    readStatus: '',
  },
  activeKpiCard: null, // 'Published' | 'Draft' | 'High' | 'Expired' | null
  sort: {
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
  dashboardStats: {
    kpis: {
      activeNotices: 0,
      draftNotices: 0,
      highPriorityNotices: 0,
      expiredNotices: 0,
      scheduledNotices: 0,
      archivedNotices: 0,
      urgentNotices: 0,
    },
    categories: {
      General: 0,
      Maintenance: 0,
      Events: 0,
      Emergency: 0,
      Meetings: 0,
    },
    recentActivity: [],
    trends: [],
  },
  dashboardLoading: false,
  dashboardError: null,
};

// Redux Slice
export const noticeBoardSlice = createSlice({
  name: 'noticeBoard',
  initialState,
  reducers: {
    setSearch: (state, action) => {
      state.search = action.payload;
      state.pagination.currentPage = 1;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.activeKpiCard = null; // Clear KPI card filter when manual filters change
      state.pagination.currentPage = 1;
    },
    setActiveKpiCard: (state, action) => {
      state.activeKpiCard = action.payload;
      state.pagination.currentPage = 1;
    },
    setSort: (state, action) => {
      state.sort = { ...state.sort, ...action.payload };
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
      state.activeKpiCard = null;
      state.search = '';
      state.sort = { ...initialState.sort };
      state.pagination.currentPage = 1;
    },
    setCurrentPage: (state, action) => {
      state.pagination.currentPage = action.payload;
    },
    setLimit: (state, action) => {
      state.pagination.limit = action.payload;
      state.pagination.currentPage = 1;
    },
    selectNotice: (state, action) => {
      state.selectedNotice = action.payload;
    },
    clearNoticeErrors: (state) => {
      state.error = null;
      state.dashboardError = null;
    },
    clearNoticeSuccess: (state) => {
      state.success = null;
    },
    clearNotices: (state) => {
      state.notices = [];
      state.pagination = initialState.pagination;
      state.communityId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load Cached Notices
      .addCase(loadCachedNotices.fulfilled, (state, action) => {
        const cached = action.payload;
        if (state.notices.length === 0 && cached?.communityId && Array.isArray(cached.notices)) {
          state.communityId = cached.communityId;
          state.notices = cached.notices;
        }
      })
      // Fetch Notices List
      .addCase(fetchNotices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotices.fulfilled, (state, action) => {
        state.loading = false;
        const result = action.payload || {};
        const payload = result.payload || {};
        
        // Handle nested data envelope: payload.data might be { data: [], pagination: {} }
        const dataEnvelope = payload.data || {};
        const noticesData = dataEnvelope.data || (Array.isArray(dataEnvelope) ? dataEnvelope : []);
        const pagination = dataEnvelope.pagination || payload.pagination || null;
        
        state.notices = result.page > 1
          ? [...state.notices, ...noticesData.filter((notice) => !state.notices.some((existing) => String(existing._id) === String(notice._id)))]
          : noticesData;
        state.communityId = result.communityId || state.communityId;
        if (pagination) {
          state.pagination = { ...state.pagination, ...pagination };
        }
      })
      .addCase(fetchNotices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Notice by ID
      .addCase(fetchNoticeById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNoticeById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedNotice = action.payload.data || action.payload;
      })
      .addCase(fetchNoticeById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create Notice
      .addCase(createNotice.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = null;
      })
      .addCase(createNotice.fulfilled, (state, action) => {
        state.loading = false;
        state.success = 'createSuccess';
        const created = action.payload?.data || action.payload;
        if (created && created._id) {
          state.notices = [created, ...state.notices.filter((n) => n._id !== created._id)];
          state.pagination.totalRecords = (state.pagination.totalRecords || 0) + 1;
        }
      })
      .addCase(createNotice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update Notice
      .addCase(updateNotice.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = null;
      })
      .addCase(updateNotice.fulfilled, (state, action) => {
        state.loading = false;
        state.success = 'updateSuccess';
        const updated = action.payload?.data || action.payload;
        if (updated && updated._id) {
          state.notices = state.notices.map((n) => (n._id === updated._id ? { ...n, ...updated } : n));
        }
      })
      .addCase(updateNotice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Delete Notice
      .addCase(deleteNotice.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = null;
      })
      .addCase(deleteNotice.fulfilled, (state) => {
        state.loading = false;
        state.success = 'deleteSuccess';
      })
      .addCase(deleteNotice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Toggle Pin
      .addCase(togglePinNotice.fulfilled, (state, action) => {
        const updatedNotice = action.payload.data || action.payload;
        if (updatedNotice) {
          // Optimistically update pinned flag across list
          state.notices = state.notices.map((n) => {
            if (n._id === updatedNotice._id) {
              return { ...n, isPinned: updatedNotice.isPinned };
            }
            // A pin policy allows maximum 1 pin per organization.
            // If updatedNotice is pinned, unpin all other notices.
            return updatedNotice.isPinned ? { ...n, isPinned: false } : n;
          });
          if (state.selectedNotice?._id === updatedNotice._id) {
            state.selectedNotice.isPinned = updatedNotice.isPinned;
          }
        }
      })

      // Mark Notice as Read
      .addCase(markNoticeAsRead.fulfilled, (state, action) => {
        const updatedNotice = action.payload.data || action.payload;
        if (updatedNotice) {
          state.notices = state.notices.map((n) =>
            n._id === updatedNotice._id ? { ...n, isReadByUser: true, readerCount: updatedNotice.readerCount } : n
          );
          if (state.selectedNotice?._id === updatedNotice._id) {
            state.selectedNotice.isReadByUser = true;
            state.selectedNotice.readerCount = updatedNotice.readerCount;
          }
        }
      })

      // Toggle Bookmark
      .addCase(bookmarkNotice.fulfilled, (state, action) => {
        const updatedNotice = action.payload.data || action.payload;
        if (updatedNotice) {
          state.notices = state.notices.map((n) =>
            n._id === updatedNotice._id ? { ...n, isBookmarkedByUser: updatedNotice.isBookmarkedByUser } : n
          );
          if (state.selectedNotice?._id === updatedNotice._id) {
            state.selectedNotice.isBookmarkedByUser = updatedNotice.isBookmarkedByUser;
          }
        }
      })

      // Fetch Stats
      .addCase(fetchNoticeStats.pending, (state) => {
        state.dashboardLoading = true;
        state.dashboardError = null;
      })
      .addCase(fetchNoticeStats.fulfilled, (state, action) => {
        state.dashboardLoading = false;
        state.dashboardStats = action.payload.data || action.payload;
      })
      .addCase(fetchNoticeStats.rejected, (state, action) => {
        state.dashboardLoading = false;
        state.dashboardError = action.payload;
      })

      // Acknowledge Notice
      .addCase(acknowledgeNoticeThunk.pending, (state) => {
        state.acknowledging = true;
        state.acknowledgeError = null;
      })
      .addCase(acknowledgeNoticeThunk.fulfilled, (state, action) => {
        state.acknowledging = false;
        const ackData = action.payload.data?.data || action.payload.data;
        if (state.selectedNotice && (state.selectedNotice._id === action.payload.id || state.selectedNotice.id === action.payload.id)) {
          state.selectedNotice.hasAcknowledged = true;
          state.selectedNotice.userAcknowledgement = ackData;
          state.selectedNotice.acknowledgementCount = (state.selectedNotice.acknowledgementCount || 0) + 1;
        }
        state.notices = state.notices.map((n) =>
          n._id === action.payload.id || n.id === action.payload.id
            ? { ...n, hasAcknowledged: true, acknowledgementCount: (n.acknowledgementCount || 0) + 1 }
            : n
        );
      })
      .addCase(acknowledgeNoticeThunk.rejected, (state, action) => {
        state.acknowledging = false;
        state.acknowledgeError = action.payload;
      })

      // Fetch Acknowledgements
      .addCase(fetchNoticeAcknowledgements.pending, (state) => {
        state.acknowledgementsLoading = true;
      })
      .addCase(fetchNoticeAcknowledgements.fulfilled, (state, action) => {
        state.acknowledgementsLoading = false;
        state.acknowledgements = action.payload.data?.data || action.payload.data || action.payload || [];
      })
      .addCase(fetchNoticeAcknowledgements.rejected, (state) => {
        state.acknowledgementsLoading = false;
      })

      // Fetch Comments
      .addCase(fetchNoticeComments.pending, (state) => {
        state.commentsLoading = true;
        state.commentsError = null;
      })
      .addCase(fetchNoticeComments.fulfilled, (state, action) => {
        state.commentsLoading = false;
        state.comments = Array.isArray(action.payload.comments) ? action.payload.comments : [];
      })
      .addCase(fetchNoticeComments.rejected, (state, action) => {
        state.commentsLoading = false;
        state.commentsError = action.payload;
      })

      // Add Comment
      .addCase(addNoticeCommentThunk.pending, (state) => {
        state.addingComment = true;
      })
      .addCase(addNoticeCommentThunk.fulfilled, (state, action) => {
        state.addingComment = false;
        if (action.payload.comment) {
          state.comments = [action.payload.comment, ...state.comments];
        }
      })
      .addCase(addNoticeCommentThunk.rejected, (state) => {
        state.addingComment = false;
      })

      // Delete Comment
      .addCase(deleteNoticeCommentThunk.fulfilled, (state, action) => {
        state.comments = state.comments.filter(c => c._id !== action.payload.commentId && c.id !== action.payload.commentId);
      })

      // Fetch Reactions
      .addCase(fetchNoticeReactions.pending, (state) => {
        state.reactionsLoading = true;
      })
      .addCase(fetchNoticeReactions.fulfilled, (state, action) => {
        state.reactionsLoading = false;
        const res = action.payload.reactions;
        state.reactions = {
          counts: res?.counts || {},
          userReaction: res?.userReaction || null,
        };
      })
      .addCase(fetchNoticeReactions.rejected, (state) => {
        state.reactionsLoading = false;
      })

      // Toggle Reaction
      .addCase(toggleNoticeReactionThunk.fulfilled, (state, action) => {
        const res = action.payload.result;
        state.reactions = {
          counts: res?.counts || {},
          userReaction: res?.userReaction || null,
        };
      });
  },
});

export const {
  setSearch,
  setFilters,
  setActiveKpiCard,
  setSort,
  resetFilters,
  setCurrentPage,
  setLimit,
  selectNotice,
  clearNoticeErrors,
  clearNoticeSuccess,
  clearNotices,
} = noticeBoardSlice.actions;

export default noticeBoardSlice.reducer;
