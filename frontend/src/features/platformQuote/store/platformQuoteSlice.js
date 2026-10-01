import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import platformQuoteApi from '../services/platformQuoteApi.js'

export const generateOrderThunk = createAsyncThunk(
  'platformQuote/generateOrder',
  async ({ quoteId, payload }, { rejectWithValue }) => {
    try {
      const response = await platformQuoteApi.generateOrder(quoteId, payload)
      return response.data || response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to dispatch order',
      )
    }
  },
)

const initialState = {
  quotes: [],
  activeQuote: null,
  loading: false,
  error: null,
  orderStatus: null,
}

const platformQuoteSlice = createSlice({
  name: 'platformQuote',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateOrderThunk.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(generateOrderThunk.fulfilled, (state, action) => {
        state.loading = false
      })
      .addCase(generateOrderThunk.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearError } = platformQuoteSlice.actions
export default platformQuoteSlice.reducer
