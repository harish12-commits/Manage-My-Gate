import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RootState, AppDispatch } from '../../../store/store';
import {
  fetchAmenityByIdThunk,
  fetchAmenitySlotsThunk,
  clearAmenityError,
  AmenitySlot,
} from '../store/amenitySlice';
import {
  createBookingThunk,
  clearBookingStatus,
  createHoldThunk,
  releaseHoldThunk,
  confirmReservationThunk,
  fetchPassesByReservationThunk,
  calculatePricingThunk,
  checkAvailabilityThunk,
  clearV2Errors,
  resetV2BookingState,
} from '../store/amenityBookingSlice';
import { fetchWalletThunk } from '../../wallet/store/walletSlice';
import {
  calculateHoldRemainingSeconds,
  canDisplayAmenityAccessPass,
} from '../utils/amenityStateHelpers';
import {
  mapHoldFormToApiPayload,
  mapConfirmFormToApiPayload,
  mapGuestsToApiPayload,
} from '../utils/amenityPayloadMappers';
import { AmenityGuest, AmenitySlotSelection } from '../types/amenityDomain.types';

export function useResidentBooking() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedSlot, setSelectedSlot] = useState<AmenitySlot | null>(null);
  const [guestsCount, setGuestsCount] = useState<number>(1);
  const [guestList, setGuestList] = useState<AmenityGuest[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'ONLINE'>('WALLET');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);

  // Redux Slices
  const { currentAmenity, slots, loading: amenityLoading, slotsLoading, error: amenityError } = useSelector(
    (state: RootState) => state.amenities
  );

  const {
    creatingBooking,
    error: bookingError,
    isOCCError,
    occErrorMessage,
    successMsg,
    activeHold,
    v2Reservations,
    v2CurrentReservation,
    v2AccessPasses,
    v2PricingCalculation,
    v2Availability,
    v2Loading,
    v2Holding,
    v2Confirming,
    v2Error,
  } = useSelector((state: RootState) => state.amenityBookings);

  const { balance = 0, isLoading: walletLoading = false } = useSelector(
    (state: RootState) => state.wallet
  );

  // Authoritative remaining seconds calculation from active hold
  const holdRemainingSeconds = useMemo(() => {
    return calculateHoldRemainingSeconds(activeHold?.expiresAt);
  }, [activeHold?.expiresAt]);

  // Access pass eligibility check
  const isPassEligible = useMemo(() => {
    return canDisplayAmenityAccessPass(v2CurrentReservation);
  }, [v2CurrentReservation]);

  useEffect(() => {
    if (id) {
      dispatch(clearAmenityError());
      dispatch(clearBookingStatus());
      dispatch(clearV2Errors());
      dispatch(fetchAmenityByIdThunk(id));
      dispatch(fetchWalletThunk());
    }
  }, [dispatch, id]);

  const loadSlots = useCallback(() => {
    if (id && selectedDate) {
      dispatch(fetchAmenitySlotsThunk({ id, date: selectedDate }));
    }
  }, [dispatch, id, selectedDate]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot: AmenitySlot) => {
    const isAvail = slot.isAvailable !== undefined ? slot.isAvailable : slot.status ? slot.status === 'Available' : true;
    const count = slot.availableCount !== undefined ? slot.availableCount : 1;
    if (isAvail && count > 0) {
      setSelectedSlot(slot);
    }
  };

  const handleOpenCheckout = () => {
    const isDaily = currentAmenity?.pricing?.pricingType === 'daily';
    if (!isDaily && !selectedSlot) return;
    setIsCheckoutOpen(true);
  };

  const handleCloseCheckout = () => {
    setIsCheckoutOpen(false);
  };

  // ==========================================
  // Legacy Booking Submission
  // ==========================================
  const handleConfirmBooking = async () => {
    const isDaily = currentAmenity?.pricing?.pricingType === 'daily';
    if (!id) return;
    if (!isDaily && !selectedSlot) return;

    const startTime = isDaily ? (currentAmenity?.bookingRules?.openTime || '00:00') : (selectedSlot?.startTime || '00:00');
    const endTime = isDaily ? (currentAmenity?.bookingRules?.closeTime || '23:59') : (selectedSlot?.endTime || '23:59');
    const slotId = isDaily ? undefined : selectedSlot?._id;

    const result = await dispatch(
      createBookingThunk({
        amenityId: id,
        date: selectedDate,
        startTime,
        endTime,
        slotId,
        paymentMethod,
        guestsCount: isDaily ? (currentAmenity.capacity || 1) : guestsCount,
      })
    );

    if (createBookingThunk.fulfilled.match(result)) {
      dispatch(fetchWalletThunk());
      setIsCheckoutOpen(false);
      setIsSuccessModalOpen(true);
    }
  };

  // ==========================================
  // v2 Two-Phase Booking Operations
  // ==========================================

  // Check Availability
  const handleCheckAvailability = useCallback(
    async (params: {
      facilityId: string;
      resourceId?: string;
      startDateTime: string;
      endDateTime: string;
      requestedQuantity?: number;
    }) => {
      return await dispatch(checkAvailabilityThunk(params)).unwrap();
    },
    [dispatch]
  );

  // Calculate Pricing
  const handleCalculatePricing = useCallback(
    async (params: {
      facilityId: string;
      startDateTime: string;
      endDateTime: string;
      headcount?: number;
      quantity?: number;
    }) => {
      return await dispatch(calculatePricingThunk(params)).unwrap();
    },
    [dispatch]
  );

  // Create Temporary Hold (Step 1)
  const handleCreateHold = useCallback(
    async (params: {
      facilityId: string;
      resourceId?: string;
      slotSelection: AmenitySlotSelection;
      headcount?: number;
      quantity?: number;
      holdType?: 'STANDARD' | 'ADMIN_REVIEW' | 'PAYMENT_PENDING';
      holdDurationMinutes?: number;
      unitId?: string;
      idempotencyKey?: string;
    }) => {
      const payload = mapHoldFormToApiPayload(params);
      return await dispatch(
        createHoldThunk({ payload, idempotencyKey: params.idempotencyKey })
      ).unwrap();
    },
    [dispatch]
  );

  // Release Active Hold
  const handleReleaseHold = useCallback(
    async (holdId?: string) => {
      const targetHoldId = holdId || activeHold?._id;
      if (!targetHoldId) return;
      return await dispatch(releaseHoldThunk(targetHoldId)).unwrap();
    },
    [dispatch, activeHold?._id]
  );

  // Confirm Reservation (Step 2)
  const handleConfirmV2Reservation = useCallback(
    async (paymentReference?: string, notes?: string, idempotencyKey?: string) => {
      if (!activeHold?._id) {
        throw new Error('No active hold found to confirm reservation.');
      }

      const payload = mapConfirmFormToApiPayload({
        holdId: activeHold._id,
        paymentReference,
        notes,
      });

      const confirmResult = await dispatch(
        confirmReservationThunk({ payload, idempotencyKey })
      ).unwrap();
      const reservation = confirmResult.reservation;

      // If eligible for access pass, proactively fetch passes
      if (canDisplayAmenityAccessPass(reservation)) {
        dispatch(fetchPassesByReservationThunk(reservation._id));
      }

      return reservation;
    },
    [dispatch, activeHold?._id]
  );

  // Fetch Passes for Reservation
  const handleFetchPasses = useCallback(
    async (reservationId: string) => {
      return await dispatch(fetchPassesByReservationThunk(reservationId)).unwrap();
    },
    [dispatch]
  );

  const handleCloseSuccessModal = () => {
    setIsSuccessModalOpen(false);
    router.push('/(resident)/amenities/my-bookings');
  };

  const handleViewPass = () => {
    setIsSuccessModalOpen(false);
    router.push('/(resident)/amenities/my-bookings');
  };

  const handleRetryOCC = () => {
    dispatch(clearBookingStatus());
    dispatch(clearV2Errors());
    setSelectedSlot(null);
    loadSlots();
  };

  const handleOpenTopUp = () => {
    setIsTopUpOpen(false);
    router.push('/(resident)/billing/wallet' as any);
  };
  const handleCloseTopUp = () => setIsTopUpOpen(false);

  const handleTopUpSubmit = async (_amount: number) => {
    setIsTopUpOpen(false);
    router.push('/(resident)/billing/wallet' as any);
  };

  const isDaily = currentAmenity?.pricing?.pricingType === 'daily';
  const securityDeposit = currentAmenity?.pricing?.securityDeposit || 0;
  const unitFee = selectedSlot?.price ?? selectedSlot?.fee ?? currentAmenity?.bookingFee ?? currentAmenity?.pricing?.baseRate ?? 0;
  const computedTotalFee = (isDaily ? unitFee : unitFee * guestsCount) + securityDeposit;
  const isBalanceSufficient = paymentMethod === 'ONLINE' || balance >= computedTotalFee;

  return {
    // Shared / Legacy State
    id,
    currentAmenity,
    slots,
    selectedDate,
    selectedSlot,
    guestsCount,
    guestList,
    setGuestList,
    paymentMethod,
    isCheckoutOpen,
    isTopUpOpen,
    balance,
    toppingUp: walletLoading,
    totalFee: computedTotalFee,
    isBalanceSufficient,
    loading: amenityLoading || slotsLoading || v2Loading,
    creatingBooking: creatingBooking || v2Confirming || v2Holding,
    error: amenityError || bookingError || v2Error?.message || null,
    isOCCError: isOCCError || v2Error?.isConflict || false,
    occErrorMessage: occErrorMessage || v2Error?.message || null,
    successMsg,
    isSuccessModalOpen,

    // v2 State
    activeHold,
    holdRemainingSeconds,
    v2Reservations,
    v2CurrentReservation,
    v2AccessPasses,
    v2PricingCalculation,
    v2Availability,
    v2Loading,
    v2Holding,
    v2Confirming,
    v2Error,
    isPassEligible,

    // Legacy Handlers
    handleCloseSuccessModal,
    handleViewPass,
    handleDateChange,
    handleSlotSelect,
    setGuestsCount,
    setPaymentMethod,
    handleOpenCheckout,
    handleCloseCheckout,
    handleConfirmBooking,
    handleRetryOCC,
    handleOpenTopUp,
    handleCloseTopUp,
    handleTopUpSubmit,

    // v2 Handlers
    handleCheckAvailability,
    handleCalculatePricing,
    handleCreateHold,
    handleReleaseHold,
    handleConfirmV2Reservation,
    handleFetchPasses,
    resetV2Booking: () => dispatch(resetV2BookingState()),
    clearV2Error: () => dispatch(clearV2Errors()),
  };
}

export default useResidentBooking;
