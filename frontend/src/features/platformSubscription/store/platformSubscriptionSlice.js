import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import platformSubscriptionApi from '../services/platformSubscriptionApi.js'

export const fetchMySubscriptionThunk = createAsyncThunk(
  'platformSubscription/fetchMySubscription',
  async (_, { rejectWithValue }) => {
    try {
      return await platformSubscriptionApi.fetchMySubscription()
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch subscription',
      )
    }
  },
)

const initialState = {
  subscription: null,
  loading: false,
  error: null,
}

const platformSubscriptionSlice = createSlice({
  name: 'platformSubscription',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMySubscriptionThunk.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchMySubscriptionThunk.fulfilled, (state, action) => {
        state.loading = false
        state.subscription = action.payload
      })
      .addCase(fetchMySubscriptionThunk.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearError } = platformSubscriptionSlice.actions
export default platformSubscriptionSlice.reducer
