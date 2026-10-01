import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { pollApi } from '../services/pollApi'

// Thunks
export const fetchActivePolls = createAsyncThunk(
  'poll/fetchActivePolls',
  async (params, { rejectWithValue }) => {
    try {
      const response = await pollApi.getActivePolls(params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch active polls')
    }
  },
)

export const fetchClosedPolls = createAsyncThunk(
  'poll/fetchClosedPolls',
  async (params, { rejectWithValue }) => {
    try {
      const response = await pollApi.getClosedPolls(params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch closed polls')
    }
  },
)

export const fetchMyPolls = createAsyncThunk(
  'poll/fetchMyPolls',
  async (params, { rejectWithValue }) => {
    try {
      const response = await pollApi.getMyPolls(params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch my polls')
    }
  },
)

export const createPoll = createAsyncThunk(
  'poll/createPoll',
  async (pollData, { rejectWithValue }) => {
    try {
      const response = await pollApi.createPoll(pollData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create poll')
    }
  },
)

export const voteOnPoll = createAsyncThunk(
  'poll/voteOnPoll',
  async ({ id, optionIndex }, { rejectWithValue }) => {
    try {
      const response = await pollApi.voteOnPoll(id, optionIndex)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to record vote')
    }
  },
)

const initialState = {
  activePolls: { data: [], total: 0, loading: false, error: null },
  closedPolls: { data: [], total: 0, loading: false, error: null },
  myPolls: { data: [], total: 0, loading: false, error: null },
  // Local state for sockets
}

const updatePollInList = (list, updatedPoll) => {
  const index = list.findIndex((p) => p._id === updatedPoll._id)
  if (index !== -1) {
    list[index] = { ...list[index], ...updatedPoll }
  }
}

const pollSlice = createSlice({
  name: 'poll',
  initialState,
  reducers: {
    // Socket events
    pollCreatedSocket: (state, action) => {
      const poll = action.payload
      if (poll.status === 'Active') {
        state.activePolls.data.unshift(poll)
        state.activePolls.total += 1
      }
    },
    pollUpdatedSocket: (state, action) => {
      const poll = action.payload
      updatePollInList(state.activePolls.data, poll)
      updatePollInList(state.closedPolls.data, poll)
      updatePollInList(state.myPolls.data, poll)
    },
    pollPublishedSocket: (state, action) => {
      const poll = action.payload
      // Add to active polls
      const exists = state.activePolls.data.find((p) => p._id === poll._id)
      if (!exists) {
        state.activePolls.data.unshift(poll)
        state.activePolls.total += 1
      }
      updatePollInList(state.myPolls.data, poll)
    },
    pollClosedSocket: (state, action) => {
      const poll = action.payload
      // Remove from active, add to closed
      state.activePolls.data = state.activePolls.data.filter((p) => p._id !== poll._id)

      const exists = state.closedPolls.data.find((p) => p._id === poll._id)
      if (!exists) {
        state.closedPolls.data.unshift(poll)
        state.closedPolls.total += 1
      }
      updatePollInList(state.myPolls.data, poll)
    },
    pollReopenedSocket: (state, action) => {
      const poll = action.payload
      // Remove from closed, add to active
      state.closedPolls.data = state.closedPolls.data.filter((p) => p._id !== poll._id)

      const exists = state.activePolls.data.find((p) => p._id === poll._id)
      if (!exists) {
        state.activePolls.data.unshift(poll)
        state.activePolls.total += 1
      }
      updatePollInList(state.myPolls.data, poll)
    },
    pollVoteAddedSocket: (state, action) => {
      const { poll, residentId, optionIndex, currentUserId } = action.payload

      const pollUpdate = { ...poll }

      // If the current user is the one who voted (useful for syncing across multiple browser tabs)
      if (residentId === currentUserId && currentUserId) {
        pollUpdate.hasVoted = true
        pollUpdate.votedOptionIndex = optionIndex
      }

      updatePollInList(state.activePolls.data, pollUpdate)
      updatePollInList(state.myPolls.data, pollUpdate)
      updatePollInList(state.closedPolls.data, pollUpdate)
    },
    pollVoteRemovedSocket: (state, action) => {
      const { poll, residentId, currentUserId } = action.payload

      const pollUpdate = { ...poll }

      if (residentId === currentUserId && currentUserId) {
        pollUpdate.hasVoted = false
        pollUpdate.votedOptionIndex = null
      }

      updatePollInList(state.activePolls.data, pollUpdate)
      updatePollInList(state.myPolls.data, pollUpdate)
      updatePollInList(state.closedPolls.data, pollUpdate)
    },
    pollDeletedSocket: (state, action) => {
      const { pollId } = action.payload
      const filterOut = (listState) => {
        const initialLength = listState.data.length
        listState.data = listState.data.filter((p) => p._id !== pollId)
        if (listState.data.length < initialLength) {
          listState.total = Math.max(0, listState.total - 1)
        }
      }
      filterOut(state.activePolls)
      filterOut(state.closedPolls)
      filterOut(state.myPolls)
    },
  },
  extraReducers: (builder) => {
    // Active Polls
    builder.addCase(fetchActivePolls.pending, (state) => {
      state.activePolls.loading = true
      state.activePolls.error = null
    })
    builder.addCase(fetchActivePolls.fulfilled, (state, action) => {
      state.activePolls.loading = false
      state.activePolls.data = action.payload.polls || []
      state.activePolls.total = action.payload.totalCount || 0
    })
    builder.addCase(fetchActivePolls.rejected, (state, action) => {
      state.activePolls.loading = false
      state.activePolls.error = action.payload
    })

    // Closed Polls
    builder.addCase(fetchClosedPolls.pending, (state) => {
      state.closedPolls.loading = true
      state.closedPolls.error = null
    })
    builder.addCase(fetchClosedPolls.fulfilled, (state, action) => {
      state.closedPolls.loading = false
      state.closedPolls.data = action.payload.polls || []
      state.closedPolls.total = action.payload.totalCount || 0
    })
    builder.addCase(fetchClosedPolls.rejected, (state, action) => {
      state.closedPolls.loading = false
      state.closedPolls.error = action.payload
    })

    // My Polls
    builder.addCase(fetchMyPolls.pending, (state) => {
      state.myPolls.loading = true
      state.myPolls.error = null
    })
    builder.addCase(fetchMyPolls.fulfilled, (state, action) => {
      state.myPolls.loading = false
      state.myPolls.data = action.payload.polls || []
      state.myPolls.total = action.payload.totalCount || 0
    })
    builder.addCase(fetchMyPolls.rejected, (state, action) => {
      state.myPolls.loading = false
      state.myPolls.error = action.payload
    })

    // Handle vote directly so UI updates instantly for the user who voted
    builder.addCase(voteOnPoll.pending, (state, action) => {
      const { id, optionIndex } = action.meta.arg
      const lists = [state.activePolls.data, state.myPolls.data, state.closedPolls.data]

      lists.forEach((list) => {
        const index = list.findIndex((p) => p._id === id)
        if (index !== -1) {
          const poll = list[index]
          const updatedOptions = [...poll.options]

          let isUnvoting = false
          if (poll.hasVoted && poll.votedOptionIndex === optionIndex) {
            isUnvoting = true
          }

          if (isUnvoting) {
            if (updatedOptions[optionIndex].votesCount > 0) {
              updatedOptions[optionIndex] = {
                ...updatedOptions[optionIndex],
                votesCount: updatedOptions[optionIndex].votesCount - 1,
              }
            }
            list[index] = {
              ...poll,
              hasVoted: false,
              votedOptionIndex: null,
              options: updatedOptions,
            }
          } else {
            if (
              poll.hasVoted &&
              poll.votedOptionIndex !== undefined &&
              poll.votedOptionIndex !== null
            ) {
              if (updatedOptions[poll.votedOptionIndex].votesCount > 0) {
                updatedOptions[poll.votedOptionIndex] = {
                  ...updatedOptions[poll.votedOptionIndex],
                  votesCount: updatedOptions[poll.votedOptionIndex].votesCount - 1,
                }
              }
            }
            updatedOptions[optionIndex] = {
              ...updatedOptions[optionIndex],
              votesCount: updatedOptions[optionIndex].votesCount + 1,
            }
            list[index] = {
              ...poll,
              hasVoted: true,
              votedOptionIndex: optionIndex,
              options: updatedOptions,
            }
          }
        }
      })
    })

    builder.addCase(voteOnPoll.fulfilled, (state, action) => {
      // Backend now returns the updated poll with correct hasVoted and votedOptionIndex
      const poll = action.payload // payload is already response.data
      updatePollInList(state.activePolls.data, poll)
      updatePollInList(state.myPolls.data, poll)
      updatePollInList(state.closedPolls.data, poll)
    })
  },
})

export const {
  pollCreatedSocket,
  pollUpdatedSocket,
  pollPublishedSocket,
  pollClosedSocket,
  pollReopenedSocket,
  pollVoteAddedSocket,
  pollVoteRemovedSocket,
  pollDeletedSocket,
} = pollSlice.actions

export default pollSlice.reducer
