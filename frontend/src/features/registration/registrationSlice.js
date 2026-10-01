import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { submitEnquiry } from './services/registration.js'

export const submitRegistrationEnquiry = createAsyncThunk(
  'registration/submitEnquiry',
  async (registrationData, { rejectWithValue }) => {
    try {
      const response = await submitEnquiry(registrationData)
      return response
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Registration failed',
      )
    }
  },
)

const registrationSlice = createSlice({
  name: 'registration',
  initialState: {
    loading: false,
    success: false,
    error: null,
    enquiryId: null,
  },
  reducers: {
    resetRegistrationState: (state) => {
      state.loading = false
      state.success = false
      state.error = null
      state.enquiryId = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitRegistrationEnquiry.pending, (state) => {
        state.loading = true
        state.error = null
        state.success = false
      })
      .addCase(submitRegistrationEnquiry.fulfilled, (state, action) => {
        state.loading = false
        state.success = true
        state.enquiryId = action.payload?.data?.enquiryId || null
      })
      .addCase(submitRegistrationEnquiry.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.success = false
      })
  },
})

export const { resetRegistrationState } = registrationSlice.actions

export default registrationSlice.reducer
