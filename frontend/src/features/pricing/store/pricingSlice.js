import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import apiClient from '../../../services/apiClient.js'

export const fetchMasterPricing = createAsyncThunk(
  'pricing/fetchMasterPricing',
  async (queryParams = {}, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/master-pricing', { params: queryParams })

      // The apiClient interceptor returns the JSON body, which looks like:
      // { success: true, message: "...", data: { data: [...], pagination: {...} } }
      // Or it might be nested differently. Let's find the array.

      let items = []
      let pagination = { total: 0, page: 1, limit: 10 }

      const resData = response.data || response

      if (Array.isArray(resData)) {
        items = resData
      } else if (resData && Array.isArray(resData.data)) {
        items = resData.data
        if (resData.pagination) pagination = resData.pagination
      } else if (resData && Array.isArray(resData.docs)) {
        items = resData.docs
        pagination = { total: resData.totalDocs, page: resData.page, limit: resData.limit }
      }

      return { data: items, pagination }
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch pricing')
    }
  },
)

export const createPricingItem = createAsyncThunk(
  'pricing/createPricingItem',
  async (pricingData, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/master-pricing', pricingData)
      const data = response.data || response
      // If it returned an array of 1 element by accident, unpack it
      if (Array.isArray(data) && data.length > 0) {
        return data[0]
      }
      return data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create pricing item')
    }
  },
)

export const updatePricingItem = createAsyncThunk(
  'pricing/updatePricingItem',
  async ({ id, updateData }, { rejectWithValue }) => {
    try {
      const response = await apiClient.put(`/master-pricing/${id}`, updateData)
      return response.data || response
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update pricing item')
    }
  },
)

export const deletePricingItem = createAsyncThunk(
  'pricing/deletePricingItem',
  async (id, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/master-pricing/${id}`)
      return id
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete pricing item')
    }
  },
)

const pricingSlice = createSlice({
  name: 'pricing',
  initialState: {
    items: [],
    pagination: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMasterPricing.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchMasterPricing.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload.data || []
        state.pagination = action.payload.pagination
      })
      .addCase(fetchMasterPricing.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(createPricingItem.fulfilled, (state, action) => {
        state.items.unshift(action.payload)
      })
      .addCase(updatePricingItem.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item._id === action.payload._id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
      })
      .addCase(deletePricingItem.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item._id !== action.payload)
      })
  },
})

export const { clearError } = pricingSlice.actions
export default pricingSlice.reducer
