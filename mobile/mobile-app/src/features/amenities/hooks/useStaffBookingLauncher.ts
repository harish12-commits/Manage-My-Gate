/**
 * Staff start a booking for a resident: pick the resident, then a published facility,
 * then continue in the booking wizard in the resident's name (no charge).
 */

import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { AppDispatch, RootState } from '../../../store/store';
import { fetchBookableFacilitiesThunk } from '../store/amenityBookingSlice';
import { AmenityFacility } from '../types/amenityDomain.types';
import type { PickedResident } from '../../villa/components/ResidentPickerSheet';

export function useStaffBookingLauncher() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const facilities = useSelector((state: RootState) => (state as any).amenityBookings.bookableFacilities as AmenityFacility[]);
  const facilitiesLoading = useSelector((state: RootState) => Boolean((state as any).amenityBookings.bookableFacilitiesLoading));
  const [step, setStep] = useState<'resident' | 'facility' | null>(null);
  const [resident, setResident] = useState<PickedResident | null>(null);

  useEffect(() => {
    if (step === 'facility') dispatch(fetchBookableFacilitiesThunk());
  }, [step, dispatch]);

  const start = useCallback(() => {
    setResident(null);
    setStep('resident');
  }, []);

  const chooseResident = useCallback((picked: PickedResident) => {
    setResident(picked);
    setStep('facility');
  }, []);

  const chooseFacility = useCallback(
    (facility: AmenityFacility) => {
      if (!resident) return;
      setStep(null);
      router.push({
        pathname: '/(resident)/amenities/booking/[id]',
        params: { id: facility._id, residentId: resident.id, residentName: `${resident.name} (${resident.villaName})` },
      } as any);
    },
    [resident, router]
  );

  return {
    step,
    resident,
    facilities,
    facilitiesLoading,
    start,
    chooseResident,
    chooseFacility,
    back: () => setStep(step === 'facility' ? 'resident' : null),
    close: () => setStep(null),
  };
}

export default useStaffBookingLauncher;
