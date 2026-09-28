/**
 * Community amenity rules for the settings screen: load once, save changes.
 */

import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store/store';
import {
  fetchAmenitySettingsThunk,
  saveAmenitySettingsThunk,
  clearAmenitySettingsError,
  AmenitySettingsUpdate,
} from '../store/amenitySettingsSlice';

export function useAmenitySettings() {
  const dispatch = useDispatch<AppDispatch>();
  const state = useSelector((s: RootState) => (s as any).amenitySettings);

  const load = useCallback(() => dispatch(fetchAmenitySettingsThunk()), [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (update: AmenitySettingsUpdate) => {
      try {
        await dispatch(saveAmenitySettingsThunk(update)).unwrap();
        return true;
      } catch {
        return false;
      }
    },
    [dispatch]
  );

  return {
    settings: state.data,
    loading: state.loading as boolean,
    saving: state.saving as boolean,
    error: state.error as string | null,
    savedAt: state.savedAt as number | null,
    reload: load,
    save,
    clearError: () => dispatch(clearAmenitySettingsError()),
  };
}

export default useAmenitySettings;
