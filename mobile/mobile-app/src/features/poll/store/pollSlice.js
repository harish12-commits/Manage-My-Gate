import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import pollService from '../services/pollService';

// Async Thunks
export const fetchActivePolls = createAsyncThunk(
  'poll/fetchActivePolls',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await pollService.getActivePolls(params);
      return { payload: response.data, page: Number(params.page) || 1 };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch active polls');
    }
  }
);

export const fetchClosedPolls = createAsyncThunk(
  'poll/fetchClosedPolls',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await pollService.getClosedPolls(params);
      return { payload: response.data, page: Number(params.page) || 1 };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch closed polls');
    }
  }
);

export const fetchMyPolls = createAsyncThunk(
  'poll/fetchMyPolls',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await pollService.getMyPolls(params);
      return { payload: response.data, page: Number(params.page) || 1 };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch your polls');
    }
  }
);

export const fetchPollById = createAsyncThunk(
  'poll/fetchPollById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await pollService.getPollById(id);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch poll details');
    }
  }
);

export const castVoteThunk = createAsyncThunk(
  'poll/castVote',
  async ({ id, voteData }, { rejectWithValue }) => {
    try {
      const response = await pollService.voteOnPoll(id, voteData);
      return { id, data: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit vote');
    }
  }
);

export const createPollThunk = createAsyncThunk(
  'poll/createPoll',
  async (pollData, { rejectWithValue }) => {
    try {
      const response = await pollService.createPoll(pollData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create poll');
    }
  }
);

export const closePollThunk = createAsyncThunk(
  'poll/closePoll',
  async (id, { rejectWithValue }) => {
    try {
      const response = await pollService.closePoll(id);
      return { id, data: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to close poll');
    }
  }
);

export const publishPollThunk = createAsyncThunk(
  'poll/publishPoll',
  async (id, { rejectWithValue }) => {
    try {
      const response = await pollService.publishPoll(id);
      return { id, data: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to publish poll');
    }
  }
);

export const deletePollThunk = createAsyncThunk(
  'poll/deletePoll',
  async (id, { rejectWithValue }) => {
    try {
      await pollService.deletePoll(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete poll');
    }
  }
);

export const fetchPollResults = createAsyncThunk(
  'poll/fetchPollResults',
  async (id, { rejectWithValue }) => {
    try {
      const response = await pollService.getPollResults(id);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load poll results');
    }
  }
);

export const fetchPollVoters = createAsyncThunk(
  'poll/fetchPollVoters',
  async (id, { rejectWithValue }) => {
    try {
      const response = await pollService.getPollVoters(id);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load voter accountability');
    }
  }
);

export const togglePollReactionThunk = createAsyncThunk(
  'poll/toggleReaction',
  async ({ pollId, reactionType = 'LIKE' }, { rejectWithValue }) => {
    try {
      const response = await pollService.togglePollReaction(pollId, reactionType);
      return { pollId, data: response.data?.data || response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle reaction');
    }
  }
);

export const fetchPollReactionsThunk = createAsyncThunk(
  'poll/fetchReactions',
  async (pollId, { rejectWithValue }) => {
    try {
      const response = await pollService.getPollReactions(pollId);
      return { pollId, data: response.data?.data || response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch reactions');
    }
  }
);

// Initial State
const initialState = {
  activePolls: {
    data: [],
    total: 0,
    loading: false,
    error: null,
  },
  closedPolls: {
    data: [],
    total: 0,
    loading: false,
    error: null,
  },
  myPolls: {
    data: [],
    total: 0,
    loading: false,
    error: null,
  },
  selectedPoll: null,
  results: null,
  voters: null,
  loading: false,
  voting: false,
  submitting: false,
  error: null,
  success: null,
};

const extractPollsList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.polls)) return payload.polls;
  if (Array.isArray(payload?.data?.polls)) return payload.data.polls;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const extractPollsTotal = (payload, fallbackLength = 0) => {
  return (
    payload?.data?.totalCount ??
    payload?.totalCount ??
    payload?.data?.total ??
    payload?.total ??
    fallbackLength
  );
};

const mergePollPage = (current, incoming, page) => page > 1
  ? [...current, ...incoming.filter((poll) => !current.some((existing) => String(existing._id || existing.id) === String(poll._id || poll.id)))]
  : incoming;

export const pollSlice = createSlice({
  name: 'poll',
  initialState,
  reducers: {
    selectPoll: (state, action) => {
      const payload = action.payload;
      state.selectedPoll =
        payload?.data?.poll ||
        payload?.data?.data ||
        payload?.data ||
        payload?.poll ||
        payload;
    },
    clearPollErrors: (state) => {
      state.error = null;
      state.activePolls.error = null;
      state.closedPolls.error = null;
      state.myPolls.error = null;
    },
    clearPollSuccess: (state) => {
      state.success = null;
    },
    // Real-time socket reducers
    socketPollCreated: (state, action) => {
      const newPoll = action.payload;
      if (newPoll && newPoll.status === 'Active') {
        const exists = state.activePolls.data.some((p) => String(p._id || p.id) === String(newPoll._id || newPoll.id));
        if (!exists) {
          state.activePolls.data.unshift(newPoll);
          state.activePolls.total += 1;
        }
      }
    },
    socketPollUpdated: (state, action) => {
      const updated = action.payload;
      if (!updated || (!updated._id && !updated.id)) return;
      const targetId = updated._id || updated.id;

      const updateItem = (item) => (String(item._id || item.id) === String(targetId) ? { ...item, ...updated } : item);
      state.activePolls.data = state.activePolls.data.map(updateItem);
      state.closedPolls.data = state.closedPolls.data.map(updateItem);
      state.myPolls.data = state.myPolls.data.map(updateItem);

      if (state.selectedPoll && String(state.selectedPoll._id || state.selectedPoll.id) === String(targetId)) {
        state.selectedPoll = { ...state.selectedPoll, ...updated };
      }
    },
    socketPollClosed: (state, action) => {
      const closed = action.payload;
      if (!closed || (!closed._id && !closed.id)) return;
      const targetId = closed._id || closed.id;

      // Remove from active
      state.activePolls.data = state.activePolls.data.filter((p) => String(p._id || p.id) !== String(targetId));
      // Add or update in closed
      const existingInClosed = state.closedPolls.data.some((p) => String(p._id || p.id) === String(targetId));
      if (!existingInClosed) {
        state.closedPolls.data.unshift(closed);
        state.closedPolls.total += 1;
      } else {
        state.closedPolls.data = state.closedPolls.data.map((p) => (String(p._id || p.id) === String(targetId) ? closed : p));
      }

      if (state.selectedPoll && String(state.selectedPoll._id || state.selectedPoll.id) === String(targetId)) {
        state.selectedPoll = { ...state.selectedPoll, ...closed, status: 'Closed' };
      }
    },
    socketVoteAdded: (state, action) => {
      const { pollId, updatedPoll, residentId, optionIndex } = action.payload;
      const targetId = pollId || updatedPoll?._id || updatedPoll?.id;
      if (!targetId) return;

      if (updatedPoll) {
        const updateItem = (item) => (String(item._id || item.id) === String(targetId) ? { ...item, ...updatedPoll } : item);
        state.activePolls.data = state.activePolls.data.map(updateItem);
        if (state.selectedPoll && String(state.selectedPoll._id || state.selectedPoll.id) === String(targetId)) {
          state.selectedPoll = { ...state.selectedPoll, ...updatedPoll };
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Active Polls
      .addCase(fetchActivePolls.pending, (state) => {
        state.activePolls.loading = true;
        state.activePolls.error = null;
      })
      .addCase(fetchActivePolls.fulfilled, (state, action) => {
        state.activePolls.loading = false;
        const result = action.payload?.payload ? action.payload : { payload: action.payload, page: 1 };
        const list = extractPollsList(result.payload);
        state.activePolls.data = mergePollPage(state.activePolls.data, list, result.page);
        state.activePolls.total = extractPollsTotal(result.payload, list.length);
      })
      .addCase(fetchActivePolls.rejected, (state, action) => {
        state.activePolls.loading = false;
        state.activePolls.error = action.payload;
      })

      // Fetch Closed Polls
      .addCase(fetchClosedPolls.pending, (state) => {
        state.closedPolls.loading = true;
        state.closedPolls.error = null;
      })
      .addCase(fetchClosedPolls.fulfilled, (state, action) => {
        state.closedPolls.loading = false;
        const result = action.payload?.payload ? action.payload : { payload: action.payload, page: 1 };
        const list = extractPollsList(result.payload);
        state.closedPolls.data = mergePollPage(state.closedPolls.data, list, result.page);
        state.closedPolls.total = extractPollsTotal(result.payload, list.length);
      })
      .addCase(fetchClosedPolls.rejected, (state, action) => {
        state.closedPolls.loading = false;
        state.closedPolls.error = action.payload;
      })

      // Fetch My Polls
      .addCase(fetchMyPolls.pending, (state) => {
        state.myPolls.loading = true;
        state.myPolls.error = null;
      })
      .addCase(fetchMyPolls.fulfilled, (state, action) => {
        state.myPolls.loading = false;
        const result = action.payload?.payload ? action.payload : { payload: action.payload, page: 1 };
        const list = extractPollsList(result.payload);
        state.myPolls.data = mergePollPage(state.myPolls.data, list, result.page);
        state.myPolls.total = extractPollsTotal(result.payload, list.length);
      })
      .addCase(fetchMyPolls.rejected, (state, action) => {
        state.myPolls.loading = false;
        state.myPolls.error = action.payload;
      })

      // Fetch Single Poll By ID
      .addCase(fetchPollById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPollById.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        const poll =
          payload?.data?.poll ||
          payload?.data?.data ||
          payload?.data ||
          payload?.poll ||
          payload;
        state.selectedPoll = poll;
      })
      .addCase(fetchPollById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Cast Vote
      .addCase(castVoteThunk.pending, (state) => {
        state.voting = true;
        state.error = null;
      })
      .addCase(castVoteThunk.fulfilled, (state, action) => {
        state.voting = false;
        state.success = 'Vote successfully recorded!';
        const pollPayload =
          action.payload?.data?.data?.poll ||
          action.payload?.data?.poll ||
          action.payload?.data?.data ||
          action.payload?.data;
        const targetId = pollPayload?._id || pollPayload?.id || action.payload?.id;
        const votedOptionIndex =
          typeof pollPayload?.votedOptionIndex === 'number'
            ? pollPayload.votedOptionIndex
            : action.payload?.voteData?.optionIndex;
        const votedOptions =
          Array.isArray(pollPayload?.votedOptions) && pollPayload.votedOptions.length > 0
            ? pollPayload.votedOptions
            : (typeof votedOptionIndex === 'number' ? [votedOptionIndex] : []);

        const updateItem = (p) => {
          const merged = pollPayload && (pollPayload._id || pollPayload.id) ? { ...p, ...pollPayload } : { ...p };
          return {
            ...merged,
            hasVoted: true,
            votedOptionIndex,
            votedOptions,
          };
        };

        if (targetId) {
          if (state.selectedPoll && String(state.selectedPoll._id || state.selectedPoll.id) === String(targetId)) {
            state.selectedPoll = updateItem(state.selectedPoll);
          }
          state.activePolls.data = state.activePolls.data.map((p) =>
            String(p._id || p.id) === String(targetId) ? updateItem(p) : p
          );
        }
      })
      .addCase(castVoteThunk.rejected, (state, action) => {
        state.voting = false;
        state.error = action.payload;
      })

      // Create Poll
      .addCase(createPollThunk.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(createPollThunk.fulfilled, (state, action) => {
        state.submitting = false;
        state.success = 'Poll created successfully!';
        const newPoll = action.payload?.data || action.payload;
        if (newPoll && newPoll._id) {
          if (newPoll.status === 'Active') {
            const existsInActive = state.activePolls.data.some((p) => p._id === newPoll._id);
            if (!existsInActive) {
              state.activePolls.data.unshift(newPoll);
              state.activePolls.total += 1;
            }
          }
          const existsInMy = state.myPolls.data.some((p) => p._id === newPoll._id);
          if (!existsInMy) {
            state.myPolls.data.unshift(newPoll);
            state.myPolls.total += 1;
          }
        }
      })
      .addCase(createPollThunk.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload;
      })

      // Close Poll
      .addCase(closePollThunk.fulfilled, (state, action) => {
        const id = action.payload.id;
        state.activePolls.data = state.activePolls.data.filter((p) => p._id !== id);
        if (state.selectedPoll && state.selectedPoll._id === id) {
          state.selectedPoll.status = 'Closed';
        }
      })

      // Delete Poll
      .addCase(deletePollThunk.fulfilled, (state, action) => {
        const id = action.payload;
        state.activePolls.data = state.activePolls.data.filter((p) => p._id !== id);
        state.closedPolls.data = state.closedPolls.data.filter((p) => p._id !== id);
        state.myPolls.data = state.myPolls.data.filter((p) => p._id !== id);
        if (state.selectedPoll && state.selectedPoll._id === id) {
          state.selectedPoll = null;
        }
      })

      // Fetch Results
      .addCase(fetchPollResults.fulfilled, (state, action) => {
        state.results = action.payload?.data || action.payload;
      })

      // Fetch Voters
      .addCase(fetchPollVoters.fulfilled, (state, action) => {
        state.voters = action.payload?.data || action.payload;
      })

      // Toggle Poll Reaction
      .addCase(togglePollReactionThunk.fulfilled, (state, action) => {
        const payload = action.payload || {};
        const pollId = payload.pollId;
        const data = payload.data || payload;
        if (!pollId) return;

        const { likeCount, isLiked, userReaction, reactions, counts } = data;

        const updateReactionFields = (item) => {
          if (item._id === pollId) {
            return {
              ...item,
              likeCount: typeof likeCount === 'number' ? likeCount : item.likeCount,
              isLiked: typeof isLiked === 'boolean' ? isLiked : item.isLiked,
              userReaction: userReaction !== undefined ? userReaction : item.userReaction,
              reactionCounts: counts || reactions || item.reactionCounts,
            };
          }
          return item;
        };

        if (state.selectedPoll && state.selectedPoll._id === pollId) {
          state.selectedPoll = updateReactionFields(state.selectedPoll);
        }

        state.activePolls.data = state.activePolls.data.map(updateReactionFields);
        state.closedPolls.data = state.closedPolls.data.map(updateReactionFields);
        state.myPolls.data = state.myPolls.data.map(updateReactionFields);
      })

      // Fetch Poll Reactions
      .addCase(fetchPollReactionsThunk.fulfilled, (state, action) => {
        const payload = action.payload || {};
        const pollId = payload.pollId;
        const data = payload.data || payload;
        if (!pollId) return;

        const { likeCount, isLiked, userReaction, reactions, counts } = data;

        const updateReactionFields = (item) => {
          if (item._id === pollId) {
            return {
              ...item,
              likeCount: typeof likeCount === 'number' ? likeCount : item.likeCount,
              isLiked: typeof isLiked === 'boolean' ? isLiked : item.isLiked,
              userReaction: userReaction !== undefined ? userReaction : item.userReaction,
              reactionCounts: counts || reactions || item.reactionCounts,
            };
          }
          return item;
        };

        if (state.selectedPoll && state.selectedPoll._id === pollId) {
          state.selectedPoll = updateReactionFields(state.selectedPoll);
        }

        state.activePolls.data = state.activePolls.data.map(updateReactionFields);
        state.closedPolls.data = state.closedPolls.data.map(updateReactionFields);
        state.myPolls.data = state.myPolls.data.map(updateReactionFields);
      });
  },
});

export const {
  selectPoll,
  clearPollErrors,
  clearPollSuccess,
  socketPollCreated,
  socketPollUpdated,
  socketPollClosed,
  socketVoteAdded,
} = pollSlice.actions;

export default pollSlice.reducer;
