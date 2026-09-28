/**
 * Community-wide amenity rules (Amenity Management V2 /settings): booking quota per unit,
 * approval timeout, early check-in window and no-show grace. One document per community.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import amenityManagementService from '../services/amenityManagementService';
import { mapAmenityApiError } from '../utils/amenityErrorMapper';
import { AmenityErrorDetails } from '../types/amenityDomain.types';

export interface AmenityCommunitySettings {
  quota: { enabled: boolean; limitMinutes: number; longDurationLimitMinutes: number };
  approvalTimeoutHours: number;
  checkInEarlyMinutes: number;
  noShowGraceMinutes: number;
  updatedAt?: string | null;
}

export type AmenitySettingsUpdate = Partial<Omit<AmenityCommunitySettings, 'quota' | 'updatedAt'>> & {
  quota?: Partial<AmenityCommunitySettings['quota']>;
};

interface AmenitySettingsState {
  data: AmenityCommunitySettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  savedAt: number | null;
}

const initialState: AmenitySettingsState = { data: null, loading: false, saving: false, error: null, savedAt: null };

const normalize = (raw: any): AmenityCommunitySettings => ({
  quota: {
    enabled: raw?.quota?.enabled !== false,
    limitMinutes: Number(raw?.quota?.limitMinutes ?? 2400),
    longDurationLimitMinutes: Number(raw?.quota?.longDurationLimitMinutes ?? 43200),
  },
  approvalTimeoutHours: Number(raw?.approvalTimeoutHours ?? 24),
  checkInEarlyMinutes: Number(raw?.checkInEarlyMinutes ?? 15),
  noShowGraceMinutes: Number(raw?.noShowGraceMinutes ?? 30),
  updatedAt: raw?.updatedAt || null,
});

export const fetchAmenitySettingsThunk = createAsyncThunk('amenitySettings/fetch', async (_: void, { rejectWithValue }) => {
  try {
    const res = await amenityManagementService.getAmenitySettings();
    return normalize(res?.data || res);
  } catch (err) {
    return rejectWithValue(mapAmenityApiError(err));
  }
});

export const saveAmenitySettingsThunk = createAsyncThunk(
  'amenitySettings/save',
  async (update: AmenitySettingsUpdate, { rejectWithValue }) => {
    try {
      const res = await amenityManagementService.updateAmenitySettings(update);
      return normalize(res?.data || res);
    } catch (err) {
      return rejectWithValue(mapAmenityApiError(err));
    }
  }
);

const amenitySettingsSlice = createSlice({
  name: 'amenitySettings',
  initialState,
  reducers: {
    clearAmenitySettingsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAmenitySettingsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAmenitySettingsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchAmenitySettingsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as AmenityErrorDetails)?.message || 'Could not load the amenity settings.';
      })
      .addCase(saveAmenitySettingsThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(saveAmenitySettingsThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.data = action.payload;
        state.savedAt = Date.now();
      })
      .addCase(saveAmenitySettingsThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = (action.payload as AmenityErrorDetails)?.message || 'Could not save the amenity settings.';
      });
  },
});

export const { clearAmenitySettingsError } = amenitySettingsSlice.actions;
export default amenitySettingsSlice.reducer;
