import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import amenityApi from '../services/amenityApi.js'
import amenityManagementApi from '../services/amenityManagementApi.js'

const extractErrorMessage = (error, fallback) => {
  const data = error.response?.data
  if (data?.details && Array.isArray(data.details)) {
    const fieldDetails = data.details
      .map((d) => (d.field && d.message ? `${d.field}: ${d.message}` : d.message || d))
      .join(', ')
    return `${data.message || fallback}: ${fieldDetails}`
  }
  return data?.message || error.message || fallback
}

export const getAmenities = createAsyncThunk(
  'amenities/getAmenities',
  async (params, { rejectWithValue }) => {
    try {
      const response = await amenityApi.fetchAmenities(params || {})
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to fetch amenities'))
    }
  },
)

export const mapAmenityToFacilityPayload = (data) => {
  const typeStr = String(data.type || data.category || '').toLowerCase()
  let archetype = 'SHARED_CAPACITY'
  if (/tennis|badminton|squash|court|pitch|cricket/i.test(typeStr)) {
    archetype = 'EXCLUSIVE_HOURLY'
  } else if (/hall|banquet|party|clubhouse|event/i.test(typeStr)) {
    archetype = 'EVENT_SPACE'
  } else if (/room|meeting|conference|theatre|theater/i.test(typeStr)) {
    archetype = 'ROOM_RESOURCE'
  } else if (/tool|equipment|kit|inventory/i.test(typeStr)) {
    archetype = 'INVENTORY_TOOLS'
  }

  const cleanName = String(data.name || 'Amenity').trim()
  const cleanCode = data.code
    ? String(data.code).toUpperCase().trim()
    : `FAC-${
        cleanName
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .slice(0, 8) || 'AMENITY'
      }-${Date.now().toString().slice(-4)}`

  const openTime = data.bookingRules?.openTime || '06:00'
  const closeTime = data.bookingRules?.closeTime || '22:00'
  const openDays =
    Array.isArray(data.openDays) && data.openDays.length > 0 ? data.openDays : [0, 1, 2, 3, 4, 5, 6]

  const operatingHours = openDays.map((day) => ({
    dayOfWeek: Number(day),
    openTime,
    closeTime,
    isOpen: true,
  }))

  const rawPricingType = String(data.pricing?.pricingType || 'HOURLY').toUpperCase()
  const pricingType = ['FREE', 'HOURLY', 'DAILY', 'FIXED_EVENT', 'TIERED'].includes(rawPricingType)
    ? rawPricingType
    : rawPricingType === 'FIXED'
      ? 'FIXED_EVENT'
      : 'HOURLY'

  return {
    name: cleanName,
    code: cleanCode,
    archetype,
    location: data.location || 'Community Premises',
    description: data.description || cleanName,
    timezone: 'Asia/Kolkata',
    operatingHours,
    slotDurationMinutes: Number(data.bookingRules?.slotDurationMinutes || 60),
    setupBufferMinutes: Number(data.bookingRules?.bufferTimeMinutes || 0),
    maxCapacity: Number(data.capacity || 10),
    pricingConfig: {
      pricingType,
      baseRate: Number(data.pricing?.baseRate || 0),
      securityDeposit: Number(data.pricing?.securityDeposit || 0),
    },
    status: 'ACTIVE',
    isActive: true,
    isDraft: false,
  }
}

export const addAmenity = createAsyncThunk(
  'amenities/addAmenity',
  async (data, { dispatch, rejectWithValue }) => {
    try {
      const response = await amenityApi.createAmenity(data)
      // Auto-register V2 Facility so it is immediately available for maintenance
      try {
        const facilityPayload = mapAmenityToFacilityPayload(data)
        await amenityManagementApi.createFacility(facilityPayload)
        dispatch(fetchFacilities())
      } catch (syncErr) {
        console.warn('Auto-sync V2 facility registration note:', syncErr?.message || syncErr)
      }
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to create amenity'))
    }
  },
)

export const editAmenity = createAsyncThunk(
  'amenities/editAmenity',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await amenityApi.updateAmenity(id, data)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to update amenity'))
    }
  },
)

export const changeAmenityStatus = createAsyncThunk(
  'amenities/changeStatus',
  async ({ id, status, bookingAction }, { rejectWithValue }) => {
    try {
      const response = await amenityApi.updateAmenityStatus(id, status, bookingAction)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to update amenity status'))
    }
  },
)

export const removeAmenity = createAsyncThunk(
  'amenities/removeAmenity',
  async (id, { rejectWithValue }) => {
    try {
      await amenityApi.deleteAmenity(id)
      return id
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to delete amenity'))
    }
  },
)

export const fetchAmenitySlots = createAsyncThunk(
  'amenities/fetchSlots',
  async ({ id, date }, { rejectWithValue }) => {
    try {
      const response = await amenityApi.fetchSlots(id, date)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to fetch slots'))
    }
  },
)

export const fetchAllAmenitySlots = createAsyncThunk(
  'amenities/fetchAllSlots',
  async ({ id, date }, { rejectWithValue }) => {
    try {
      const response = await amenityApi.fetchAllSlots(id, date)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to fetch all slots'))
    }
  },
)

export const fetchMaintenanceList = createAsyncThunk(
  'amenities/fetchMaintenance',
  async (_, { rejectWithValue }) => {
    try {
      const response = await amenityApi.fetchMaintenanceList()
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to fetch maintenance schedules'))
    }
  },
)

export const scheduleAmenityMaintenance = createAsyncThunk(
  'amenities/scheduleMaintenance',
  async ({ amenityId, data }, { rejectWithValue }) => {
    try {
      const response = await amenityApi.scheduleMaintenance(amenityId, data)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to schedule maintenance'))
    }
  },
)

export const editMaintenance = createAsyncThunk(
  'amenities/editMaintenance',
  async ({ amenityId, maintenanceId, data }, { rejectWithValue }) => {
    try {
      const response = await amenityApi.updateMaintenance(amenityId, maintenanceId, data)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to update maintenance'))
    }
  },
)

export const removeMaintenance = createAsyncThunk(
  'amenities/removeMaintenance',
  async ({ amenityId, maintenanceId }, { rejectWithValue }) => {
    try {
      await amenityApi.deleteMaintenance(amenityId, maintenanceId)
      return maintenanceId
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to delete maintenance'))
    }
  },
)

// ==========================================
// V2 Amenity Management Thunks (Phase 6.4 Contract)
// ==========================================

export const fetchFacilities = createAsyncThunk(
  'amenities/fetchFacilities',
  async (params, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.listFacilities(params || {})
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to fetch facilities'))
    }
  },
)

export const createFacility = createAsyncThunk(
  'amenities/createFacility',
  async (data, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.createFacility(data)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to create facility'))
    }
  },
)

export const fetchResources = createAsyncThunk(
  'amenities/fetchResources',
  async (params, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.listResources(params || {})
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to fetch resources'))
    }
  },
)

export const fetchResourcesByFacility = createAsyncThunk(
  'amenities/fetchResourcesByFacility',
  async (facilityId, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.getResourcesByFacility(facilityId)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to fetch resources for facility'))
    }
  },
)

export const fetchV2Maintenance = createAsyncThunk(
  'amenities/fetchV2Maintenance',
  async (params, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.listMaintenance(params || {})
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to fetch maintenance blocks'))
    }
  },
)

export const scheduleV2Maintenance = createAsyncThunk(
  'amenities/scheduleV2Maintenance',
  async (data, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.scheduleMaintenance(data)
      return response.data
    } catch (error) {
      const respData = error.response?.data
      return rejectWithValue({
        message: extractErrorMessage(error, 'Failed to schedule maintenance'),
        code: respData?.code,
        reason: respData?.reason,
        details: respData?.details,
      })
    }
  },
)

export const fetchImpactPreview = createAsyncThunk(
  'amenities/fetchImpactPreview',
  async (data, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.getImpactPreview(data)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to preview maintenance impact'))
    }
  },
)

export const resolveV2Impact = createAsyncThunk(
  'amenities/resolveV2Impact',
  async ({ blockId, data }, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.resolveMaintenanceImpact(blockId, data)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to resolve maintenance impact'))
    }
  },
)

export const fetchV2Impacts = createAsyncThunk(
  'amenities/fetchV2Impacts',
  async (blockId, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.getImpacts(blockId)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to fetch maintenance impacts'))
    }
  },
)

export const fetchAlternativeSlots = createAsyncThunk(
  'amenities/fetchAlternativeSlots',
  async (data, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.getAlternatives(data)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to fetch alternative slots'))
    }
  },
)

export const updateV2MaintenanceStatus = createAsyncThunk(
  'amenities/updateV2MaintenanceStatus',
  async ({ blockId, data }, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.updateMaintenanceStatus(blockId, data)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to update maintenance status'))
    }
  },
)

export const extendV2MaintenanceBlock = createAsyncThunk(
  'amenities/extendV2MaintenanceBlock',
  async ({ blockId, data }, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.extendMaintenanceBlock(blockId, data)
      return response.data
    } catch (error) {
      const respData = error.response?.data
      return rejectWithValue({
        message: extractErrorMessage(error, 'Failed to extend maintenance window'),
        code: respData?.code,
        reason: respData?.reason,
        details: respData?.details,
      })
    }
  },
)

export const declareEmergencyMaintenance = createAsyncThunk(
  'amenities/declareEmergencyMaintenance',
  async (data, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.declareEmergencyMaintenance(data)
      return response.data
    } catch (error) {
      const respData = error.response?.data
      return rejectWithValue({
        message: extractErrorMessage(error, 'Failed to declare emergency maintenance'),
        code: respData?.code,
        reason: respData?.reason,
        details: respData?.details,
      })
    }
  },
)

export const previewRecurringMaintenance = createAsyncThunk(
  'amenities/previewRecurringMaintenance',
  async (data, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.previewRecurringMaintenance(data)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to preview recurring maintenance'))
    }
  },
)

export const scheduleRecurringMaintenance = createAsyncThunk(
  'amenities/scheduleRecurringMaintenance',
  async (data, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.scheduleRecurringMaintenance(data)
      return response.data
    } catch (error) {
      const respData = error.response?.data
      return rejectWithValue({
        message: extractErrorMessage(error, 'Failed to schedule recurring maintenance'),
        code: respData?.code,
        reason: respData?.reason,
        details: respData?.details,
      })
    }
  },
)

export const fetchRecurringSeries = createAsyncThunk(
  'amenities/fetchRecurringSeries',
  async (seriesId, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.getRecurringSeries(seriesId)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to fetch recurring series'))
    }
  },
)

export const fetchRecurringOccurrences = createAsyncThunk(
  'amenities/fetchRecurringOccurrences',
  async ({ seriesId, params }, { rejectWithValue }) => {
    try {
      const response = await amenityManagementApi.getRecurringSeriesOccurrences(seriesId, params)
      return response.data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Failed to fetch recurring occurrences'))
    }
  },
)

const initialState = {
  items: [],
  availableSlots: [],
  allSlots: [],
  maintenanceList: [],
  // V2 Subsystem state
  facilities: [],
  resources: [],
  maintenanceBlocks: [],
  maintenancePagination: { total: 0, page: 1, limit: 50, pages: 1 },
  activeMaintenance: null,
  impactPreview: null,
  activeImpacts: [],
  alternativeSlots: [],
  recurringSeries: null,
  recurringOccurrences: [],
  loading: false,
  slotsLoading: false,
  error: null,
  successMsg: null,
}

export const amenitySlice = createSlice({
  name: 'amenities',
  initialState,
  reducers: {
    clearStatus: (state) => {
      state.error = null
      state.successMsg = null
    },
    clearImpactPreview: (state) => {
      state.impactPreview = null
    },
    clearActiveImpacts: (state) => {
      state.activeImpacts = []
    },
    clearAlternativeSlots: (state) => {
      state.alternativeSlots = []
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getAmenities.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getAmenities.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload || []
      })
      .addCase(getAmenities.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      .addCase(addAmenity.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(addAmenity.fulfilled, (state, action) => {
        state.loading = false
        state.items.unshift(action.payload)
        state.successMsg = 'Amenity added successfully!'
      })
      .addCase(addAmenity.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      .addCase(editAmenity.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(editAmenity.fulfilled, (state, action) => {
        state.loading = false
        const index = state.items.findIndex((item) => item._id === action.payload._id)
        if (index !== -1) state.items[index] = action.payload
        state.successMsg = 'Amenity updated successfully!'
      })
      .addCase(editAmenity.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      .addCase(changeAmenityStatus.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(changeAmenityStatus.fulfilled, (state, action) => {
        state.loading = false
        const index = state.items.findIndex((item) => item._id === action.payload._id)
        if (index !== -1) state.items[index] = action.payload
        state.successMsg = 'Amenity status updated successfully!'
      })
      .addCase(changeAmenityStatus.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      .addCase(removeAmenity.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(removeAmenity.fulfilled, (state, action) => {
        state.loading = false
        state.items = state.items.filter((item) => item._id !== action.payload)
        state.successMsg = 'Amenity deleted successfully!'
      })
      .addCase(removeAmenity.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      .addCase(fetchAmenitySlots.pending, (state) => {
        state.slotsLoading = true
        state.error = null
      })
      .addCase(fetchAmenitySlots.fulfilled, (state, action) => {
        state.slotsLoading = false
        state.availableSlots = action.payload || []
      })
      .addCase(fetchAmenitySlots.rejected, (state, action) => {
        state.slotsLoading = false
        state.error = action.payload
      })

      .addCase(fetchAllAmenitySlots.pending, (state) => {
        state.slotsLoading = true
        state.error = null
      })
      .addCase(fetchAllAmenitySlots.fulfilled, (state, action) => {
        state.slotsLoading = false
        state.allSlots = action.payload || []
      })
      .addCase(fetchAllAmenitySlots.rejected, (state, action) => {
        state.slotsLoading = false
        state.error = action.payload
      })

      .addCase(fetchMaintenanceList.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchMaintenanceList.fulfilled, (state, action) => {
        state.loading = false
        state.maintenanceList = action.payload || []
      })
      .addCase(fetchMaintenanceList.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      // Schedule Maintenance
      .addCase(scheduleAmenityMaintenance.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(scheduleAmenityMaintenance.fulfilled, (state) => {
        state.loading = false
        state.successMsg = 'Maintenance scheduled successfully'
      })
      .addCase(scheduleAmenityMaintenance.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      // Edit Maintenance
      .addCase(editMaintenance.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(editMaintenance.fulfilled, (state) => {
        state.loading = false
        state.successMsg = 'Maintenance updated successfully'
      })
      .addCase(editMaintenance.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      // Remove Maintenance
      .addCase(removeMaintenance.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(removeMaintenance.fulfilled, (state, action) => {
        state.loading = false
        state.successMsg = 'Maintenance task deleted'
        state.maintenanceList = state.maintenanceList.filter((t) => t._id !== action.payload)
      })
      .addCase(removeMaintenance.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // V2 Facilities
      .addCase(fetchFacilities.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchFacilities.fulfilled, (state, action) => {
        state.loading = false
        const payloadData =
          action.payload?.records ||
          action.payload?.data?.records ||
          action.payload?.data ||
          action.payload?.items ||
          action.payload
        state.facilities = Array.isArray(payloadData)
          ? payloadData
          : Array.isArray(payloadData?.data)
            ? payloadData.data
            : Array.isArray(payloadData?.records)
              ? payloadData.records
              : Array.isArray(payloadData?.items)
                ? payloadData.items
                : []
      })
      .addCase(fetchFacilities.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // V2 Create Facility
      .addCase(createFacility.fulfilled, (state, action) => {
        state.loading = false
        const newFac = action.payload?.data || action.payload
        if (newFac && newFac._id) {
          state.facilities.unshift(newFac)
        }
      })

      // V2 Resources
      .addCase(fetchResources.fulfilled, (state, action) => {
        const payloadData = action.payload?.data || action.payload?.items || action.payload
        state.resources = Array.isArray(payloadData)
          ? payloadData
          : Array.isArray(payloadData?.data)
            ? payloadData.data
            : []
      })
      .addCase(fetchResourcesByFacility.fulfilled, (state, action) => {
        const payloadData = action.payload?.data || action.payload?.items || action.payload
        state.resources = Array.isArray(payloadData)
          ? payloadData
          : Array.isArray(payloadData?.data)
            ? payloadData.data
            : []
      })

      // V2 Maintenance Blocks List
      .addCase(fetchV2Maintenance.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchV2Maintenance.fulfilled, (state, action) => {
        state.loading = false
        const payloadData =
          action.payload?.records ||
          action.payload?.data?.records ||
          action.payload?.data ||
          action.payload?.items ||
          action.payload
        state.maintenanceBlocks = Array.isArray(payloadData)
          ? payloadData
          : Array.isArray(payloadData?.data)
            ? payloadData.data
            : Array.isArray(payloadData?.records)
              ? payloadData.records
              : Array.isArray(payloadData?.items)
                ? payloadData.items
                : []
        if (action.payload?.pagination) {
          state.maintenancePagination = action.payload.pagination
        } else if (action.payload?.total !== undefined) {
          state.maintenancePagination = {
            total: action.payload.total,
            page: action.payload.page || 1,
            limit: action.payload.limit || 50,
            pages: action.payload.pages || action.payload.totalPages || 1,
          }
        }
      })
      .addCase(fetchV2Maintenance.rejected, (state, action) => {
        state.loading = false
        state.error = typeof action.payload === 'object' ? action.payload?.message : action.payload
      })

      // V2 Schedule Maintenance
      .addCase(scheduleV2Maintenance.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(scheduleV2Maintenance.fulfilled, (state, action) => {
        state.loading = false
        state.successMsg = 'Maintenance block scheduled successfully'
        if (action.payload) {
          state.maintenanceBlocks.unshift(action.payload)
        }
      })
      .addCase(scheduleV2Maintenance.rejected, (state, action) => {
        state.loading = false
        state.error = typeof action.payload === 'object' ? action.payload?.message : action.payload
      })

      // V2 Impact Preview
      .addCase(fetchImpactPreview.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchImpactPreview.fulfilled, (state, action) => {
        state.loading = false
        state.impactPreview = action.payload
      })
      .addCase(fetchImpactPreview.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // V2 Resolve Impact
      .addCase(resolveV2Impact.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(resolveV2Impact.fulfilled, (state, action) => {
        state.loading = false
        state.successMsg = 'Maintenance impacts resolved successfully'
      })
      .addCase(resolveV2Impact.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // V2 Fetch Impacts
      .addCase(fetchV2Impacts.fulfilled, (state, action) => {
        state.activeImpacts = action.payload || []
      })

      // V2 Alternative Slots
      .addCase(fetchAlternativeSlots.fulfilled, (state, action) => {
        state.alternativeSlots = action.payload || []
      })

      // V2 Update Status
      .addCase(updateV2MaintenanceStatus.fulfilled, (state, action) => {
        state.successMsg = 'Maintenance status updated successfully'
        const updated = action.payload
        if (updated?._id) {
          const idx = state.maintenanceBlocks.findIndex((b) => b._id === updated._id)
          if (idx !== -1) {
            state.maintenanceBlocks[idx] = updated
          }
        }
      })

      // V2 Extend Block
      .addCase(extendV2MaintenanceBlock.fulfilled, (state, action) => {
        state.successMsg = 'Maintenance window extended successfully'
        const extended = action.payload
        if (extended?._id) {
          const idx = state.maintenanceBlocks.findIndex((b) => b._id === extended._id)
          if (idx !== -1) {
            state.maintenanceBlocks[idx] = extended
          }
        }
      })

      // V2 Declare Emergency
      .addCase(declareEmergencyMaintenance.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(declareEmergencyMaintenance.fulfilled, (state, action) => {
        state.loading = false
        state.successMsg = 'Emergency maintenance declared successfully'
        if (action.payload) {
          state.maintenanceBlocks.unshift(action.payload)
        }
      })
      .addCase(declareEmergencyMaintenance.rejected, (state, action) => {
        state.loading = false
        state.error = typeof action.payload === 'object' ? action.payload?.message : action.payload
      })

      // V2 Recurring Preview
      .addCase(previewRecurringMaintenance.fulfilled, (state, action) => {
        state.impactPreview = action.payload
      })

      // V2 Recurring Schedule
      .addCase(scheduleRecurringMaintenance.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(scheduleRecurringMaintenance.fulfilled, (state, action) => {
        state.loading = false
        state.successMsg = 'Recurring maintenance series scheduled successfully'
      })
      .addCase(scheduleRecurringMaintenance.rejected, (state, action) => {
        state.loading = false
        state.error = typeof action.payload === 'object' ? action.payload?.message : action.payload
      })

      // V2 Recurring Series & Occurrences
      .addCase(fetchRecurringSeries.fulfilled, (state, action) => {
        state.recurringSeries = action.payload
      })
      .addCase(fetchRecurringOccurrences.fulfilled, (state, action) => {
        state.recurringOccurrences = action.payload?.items || action.payload || []
      })
  },
})

export const { clearStatus, clearImpactPreview, clearActiveImpacts, clearAlternativeSlots } =
  amenitySlice.actions

export default amenitySlice.reducer
