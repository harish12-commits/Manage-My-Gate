/**
 * Amenity Management v2 - Resident Amenities Discovery Hook
 * Coordinates facility discovery, resource inspection, archetype filtering, pagination, and dynamic availability requests.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../store/store';
import amenityManagementService from '../services/amenityManagementService';
import {
  AmenityFacility,
  AmenityResource,
  AmenityArchetype,
  AmenityErrorDetails,
} from '../types/amenityDomain.types';
import { normalizeFacilityFromApi, normalizeResourceFromApi } from '../utils/amenityPayloadMappers';
import { mapAmenityApiError } from '../utils/amenityErrorMapper';
import { checkAvailabilityThunk } from '../store/amenityBookingSlice';

export interface ResidentAmenitiesPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  currentPage: number;
  totalPages: number;
  totalRecords: number;
}

export function useResidentAmenities(initialArchetype?: AmenityArchetype) {
  const dispatch = useDispatch<AppDispatch>();

  const [facilities, setFacilities] = useState<AmenityFacility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<AmenityFacility | null>(null);
  const [resources, setResources] = useState<AmenityResource[]>([]);
  const [selectedArchetype, setSelectedArchetype] = useState<AmenityArchetype | undefined>(initialArchetype);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pagination, setPagination] = useState<ResidentAmenitiesPagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [resourcesLoading, setResourcesLoading] = useState<boolean>(false);
  const [error, setError] = useState<AmenityErrorDetails | null>(null);

  // Load facilities catalog
  const loadFacilities = useCallback(
    async (page: number = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await amenityManagementService.getFacilities({
          page,
          limit: pagination.limit,
          archetype: selectedArchetype,
          search: searchQuery || undefined,
          status: 'ACTIVE',
        });

        const rawPayload: any = res?.data;
        const rawItems: any[] =
          (Array.isArray(rawPayload) ? rawPayload : null) ||
          (Array.isArray(rawPayload?.data) ? rawPayload.data : null) ||
          (Array.isArray(rawPayload?.items) ? rawPayload.items : null) ||
          (Array.isArray((res as any)?.items) ? (res as any).items : null) ||
          (Array.isArray((res as any)?.data) ? (res as any).data : null) ||
          [];
        const items = rawItems.map(normalizeFacilityFromApi);
        if (page > 1) {
          setFacilities((prev) => [...prev, ...items]);
        } else {
          setFacilities(items);
        }

        const pag = res?.data?.pagination || (res as any)?.pagination;
        if (pag) {
          setPagination({
            page: pag.page || page,
            limit: pag.limit || pagination.limit,
            total: pag.total || items.length,
            pages: pag.pages || 1,
            currentPage: pag.page || page,
            totalPages: pag.pages || 1,
            totalRecords: pag.total || items.length,
          });
        }
      } catch (err) {
        setError(mapAmenityApiError(err));
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit, selectedArchetype, searchQuery]
  );

  useEffect(() => {
    loadFacilities(1);
  }, [loadFacilities]);

  // Load resources for a facility (e.g. INVENTORY_TOOLS or ROOM_RESOURCE)
  const loadResources = useCallback(async (facilityId: string) => {
    if (!facilityId) return;
    setResourcesLoading(true);
    try {
      const res = await amenityManagementService.getResources({
        facilityId,
        page: 1,
        limit: 50,
      });
      const rawResPayload: any = res?.data;
      const rawResItems: any[] =
        (Array.isArray(rawResPayload) ? rawResPayload : null) ||
        (Array.isArray(rawResPayload?.data) ? rawResPayload.data : null) ||
        (Array.isArray(rawResPayload?.items) ? rawResPayload.items : null) ||
        (Array.isArray((res as any)?.items) ? (res as any).items : null) ||
        (Array.isArray((res as any)?.data) ? (res as any).data : null) ||
        [];
      const items = rawResItems.map(normalizeResourceFromApi);
      setResources(items);
      return items;
    } catch (err) {
      const errDetails = mapAmenityApiError(err);
      setError(errDetails);
      return [];
    } finally {
      setResourcesLoading(false);
    }
  }, []);

  // Fetch facility details by ID
  const selectFacility = useCallback(
    async (facilityId: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await amenityManagementService.getFacilityById(facilityId);
        const rawFac = res?.data || res;
        const fac = normalizeFacilityFromApi(rawFac);
        setSelectedFacility(fac);
        const actualFacId = fac._id || (fac as any).id || facilityId;
        if ((fac.archetype === 'ROOM_RESOURCE' || fac.archetype === 'INVENTORY_TOOLS') && actualFacId) {
          await loadResources(String(actualFacId));
        }
        return fac;
      } catch (err) {
        const errDetails = mapAmenityApiError(err);
        setError(errDetails);
        throw errDetails;
      } finally {
        setLoading(false);
      }
    },
    [loadResources]
  );

  // Pagination triggers
  const handleLoadMore = useCallback(() => {
    if (!loading && pagination.currentPage < pagination.totalPages) {
      loadFacilities(pagination.currentPage + 1);
    }
  }, [loading, pagination.currentPage, pagination.totalPages, loadFacilities]);

  const handleRefresh = useCallback(() => {
    loadFacilities(1);
  }, [loadFacilities]);

  // Dynamic availability evaluation
  const checkAvailability = useCallback(
    async (params: {
      facilityId: string;
      resourceId?: string;
      startDateTime: string;
      endDateTime: string;
      requestedQuantity?: number;
    }) => {
      const action = await dispatch(checkAvailabilityThunk(params));
      if (checkAvailabilityThunk.fulfilled.match(action)) {
        return action.payload;
      } else {
        throw action.payload;
      }
    },
    [dispatch]
  );

  return {
    facilities,
    selectedFacility,
    resources,
    selectedArchetype,
    searchQuery,
    pagination,
    loading,
    resourcesLoading,
    error,
    setSelectedArchetype,
    setSearchQuery,
    loadFacilities,
    loadResources,
    selectFacility,
    checkAvailability,
    handleLoadMore,
    handleRefresh,
    clearError: () => setError(null),
  };
}

export default useResidentAmenities;
