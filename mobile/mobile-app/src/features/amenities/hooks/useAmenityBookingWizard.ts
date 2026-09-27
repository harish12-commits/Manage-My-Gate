/**
 * Amenity Management Phase 6B.2 - Resident Booking Wizard Controller Hook
 * Centralizes transient wizard state, archetype-specific step progressions, availability checks,
 * authoritative server pricing, hold lifecycle (UUID idempotency, countdown derivation, expiration locking),
 * payment handling via existing billing (Wallet / Razorpay), confirmation (confirm_hold_${holdId}),
 * and back-navigation safety guards.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { AppDispatch, RootState } from '../../../store/store';
import {
  AmenityFacility,
  AmenityResource,
  AmenityGuest,
  AmenityAvailabilityResult,
  AmenityPricingSnapshot,
  AmenityReservation,
  AmenityAccessPass,
} from '../types/amenityDomain.types';
import {
  checkAvailabilityThunk,
  calculatePricingThunk,
  createHoldThunk,
  releaseHoldThunk,
  confirmReservationThunk,
  fetchPassesByReservationThunk,
  resetV2BookingState,
  clearV2Errors,
} from '../store/amenityBookingSlice';
import {
  fetchWalletThunk,
  fetchWalletBalance,
  createWalletRazorpayOrder,
  verifyWalletPayment,
} from '../../wallet/store/walletSlice';
import {
  calculateHoldRemainingSeconds,
  canDisplayAmenityAccessPass,
  convertLocalToUtcIso,
} from '../utils/amenityStateHelpers';
import {
  mapHoldFormToApiPayload,
  mapConfirmFormToApiPayload,
  mapPricingFormToApiPayload,
  normalizeResourceFromApi,
} from '../utils/amenityPayloadMappers';
import amenityManagementService, { generateUUID } from '../services/amenityManagementService';
import { createAmenityBooking } from '../services/amenityService';
import paymentService from '../../payment/services/paymentService';
import { RazorpayCheckoutOptions } from '../../billing/components/RazorpayCheckoutModal';
import { isAmbiguousPaymentError } from '../../billing/hooks/useMobilePayment';
import {
  createOperationId,
  buildAmenityBookingKey,
  buildAmenityOrderKey,
  buildAmenityVerifyKey,
  buildWalletOrderKey,
  buildWalletVerifyKey,
  buildAmenityConfirmKey,
  buildAmenityPayAtGateKey,
} from '../../../utils/idempotency';

/**
 * Adapt canonical Phase 6 AmenityBooking document into UI-consumable AmenityReservation shape
 */
const adaptBookingToReservation = (booking: any, facility: AmenityFacility): AmenityReservation => {
  const bStatus = String(booking?.status || 'CONFIRMED').toUpperCase();
  const pStatus = (
    booking?.paymentStatus === 'success' || booking?.paymentStatus === 'paid'
      ? 'PAID'
      : booking?.paymentStatus === 'free'
      ? 'NOT_REQUIRED'
      : booking?.paymentStatus || 'PENDING'
  ).toUpperCase();

  return {
    _id: String(booking?._id || ''),
    reservationNumber: booking?.bookingNumber || booking?.bookingId || String(booking?._id || ''),
    bookingStatus: bStatus as any,
    paymentStatus: pStatus as any,
    approvalStatus: 'NOT_REQUIRED',
    accessStatus: 'ACTIVE',
    completionStatus: 'SCHEDULED',
    facilityId: booking?.amenityId?._id || booking?.amenityId || facility._id,
    resourceId: booking?.resourceId,
    reservedBy: booking?.residentId || booking?.userId,
    slotSelection: {
      slotId: booking?.slotId || 'custom-slot',
      date: booking?.bookingDate || booking?.date || '',
      startTime: booking?.startTime || '',
      endTime: booking?.endTime || '',
      utcStartDateTime: booking?.bookingDate || booking?.date || '',
      utcEndDateTime: booking?.bookingDate || booking?.date || '',
    },
    headcount: booking?.numberOfPersons || booking?.guestsCount || 1,
    quantity: booking?.numberOfPersons || 1,
    pricingSnapshot: {
      baseRate: booking?.totalPrice || 0,
      totalAmount: booking?.totalPrice || 0,
      taxAmount: 0,
      discountAmount: 0,
      currency: 'INR',
    },
    paymentReference: booking?.paymentId,
    notes: booking?.notes,
    createdAt: booking?.createdAt || new Date().toISOString(),
    updatedAt: booking?.updatedAt || new Date().toISOString(),
  } as any;
};

/**
 * Adapt canonical Phase 6 AmenityBooking passes / tokens into UI-consumable AmenityAccessPass list
 */
const adaptBookingToPasses = (booking: any): AmenityAccessPass[] => {
  if (!booking?.passToken && !booking?.qrCode && !booking?._id) return [];
  return [
    {
      _id: `pass-${booking._id}`,
      reservationId: booking._id,
      passCode: booking.passToken || booking.bookingNumber || booking._id,
      qrData: booking.qrCode || `MMG:AMENITY:${booking.passToken || booking._id}`,
      status: 'ACTIVE',
      issuedAt: new Date().toISOString(),
      validUntil: booking.bookingDate
        ? new Date(`${booking.bookingDate}T${booking.endTime || '23:59'}:00`).toISOString()
        : undefined,
    } as any,
  ];
};

export type WizardStepKey = 'resource' | 'datetime' | 'quantity' | 'review' | 'payment' | 'result';

export interface WizardStepDefinition {
  key: WizardStepKey;
  title: string;
  subtitle?: string;
}

export function useAmenityBookingWizard(facility: AmenityFacility) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  // Redux state
  const {
    activeHold,
    v2CurrentReservation,
    v2AccessPasses,
    v2Holding,
    v2Confirming,
    v2Error,
  } = useSelector((state: RootState) => state.amenityBookings);

  const { balance = 0, isLoading: walletLoading = false } = useSelector(
    (state: RootState) => state.wallet
  );

  // Dynamic Step Definitions based on Facility Archetype
  const steps: WizardStepDefinition[] = useMemo(() => {
    const isResourceDriven =
      facility.archetype === 'ROOM_RESOURCE' || facility.archetype === 'INVENTORY_TOOLS';

    const list: WizardStepDefinition[] = [];
    if (isResourceDriven) {
      list.push({
        key: 'resource',
        title: facility.archetype === 'INVENTORY_TOOLS' ? 'Select Equipment' : 'Select Room/Suite',
        subtitle: 'Choose from available inventory resources',
      });
    }

    list.push(
      { key: 'datetime', title: 'Schedule & Slot', subtitle: 'Select date and timing' },
      {
        key: 'quantity',
        title: facility.archetype === 'INVENTORY_TOOLS' ? 'Quantity' : 'Guests & Headcount',
        subtitle: 'Specify reservation details',
      },
      { key: 'review', title: 'Review & Pricing', subtitle: 'Authoritative server quote' },
      { key: 'payment', title: 'Hold & Payment', subtitle: 'Confirm temporary reservation hold' },
      { key: 'result', title: 'Confirmation Result', subtitle: 'Reservation status & access pass' }
    );

    return list;
  }, [facility.archetype]);

  // Wizard Navigation Index
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const currentStep = steps[currentStepIndex] || steps[0];

  // Wizard Transient Selections
  const [selectedResource, setSelectedResource] = useState<AmenityResource | null>(null);
  const [availableResources, setAvailableResources] = useState<AmenityResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState<boolean>(false);

  // Default to today in YYYY-MM-DD
  const _now = new Date();
  const defaultDate = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(
    _now.getDate()
  ).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  // Dynamically derive next upcoming hour for today's default, avoiding hardcoded past '09:00'
  const currentHour = _now.getHours();
  const nextHour = Math.min(23, currentHour + 1);
  const hourAfter = Math.min(23, nextHour + 1);
  const defaultStartTime = `${String(nextHour).padStart(2, '0')}:00`;
  const defaultEndTime = `${String(hourAfter).padStart(2, '0')}:00`;

  const [startTime, setStartTime] = useState<string>(defaultStartTime);
  const [endTime, setEndTime] = useState<string>(defaultEndTime);

  // Available Daily Slots evaluated from server (disappearing booked/past slots)
  const [availableDailySlots, setAvailableDailySlots] = useState<
    Array<{ start: string; end: string; label: string }> | undefined
  >(undefined);
  const [loadingDailySlots, setLoadingDailySlots] = useState<boolean>(false);

  const [headcount, setHeadcount] = useState<number>(1);
  const [quantity, setQuantity] = useState<number>(1);
  const [guests, setGuests] = useState<AmenityGuest[]>([]);
  const [bookingNotes, setBookingNotes] = useState<string>('');

  // Payment Selection
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'RAZORPAY' | 'PAY_AT_GATE'>('WALLET');
  const [paymentReference, setPaymentReference] = useState<string>('');

  // API Feedback & Caches
  const [availabilityResult, setAvailabilityResult] = useState<AmenityAvailabilityResult | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState<boolean>(false);
  const [pricingSnapshot, setPricingSnapshot] = useState<AmenityPricingSnapshot | null>(null);
  const [calculatingPricing, setCalculatingPricing] = useState<boolean>(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Modals & Navigation Guards
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState<boolean>(false);
  const [isRazorpayOpen, setIsRazorpayOpen] = useState<boolean>(false);
  const [razorpayOptions, setRazorpayOptions] = useState<RazorpayCheckoutOptions | null>(null);
  const [canonicalReservation, setCanonicalReservation] = useState<AmenityReservation | null>(null);
  const [canonicalPasses, setCanonicalPasses] = useState<AmenityAccessPass[]>([]);
  const operationIdRef = useRef<string>(createOperationId());
  const createdBookingRef = useRef<any>(null);

  // Live Hold Countdown derived from activeHold.expiresAt
  const [holdRemainingSeconds, setHoldRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    if (!activeHold?.expiresAt) {
      setHoldRemainingSeconds(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = calculateHoldRemainingSeconds(activeHold.expiresAt);
      setHoldRemainingSeconds(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeHold?.expiresAt]);

  const isHoldExpired = useMemo(() => {
    return !!activeHold && holdRemainingSeconds <= 0;
  }, [activeHold, holdRemainingSeconds]);

  // Load Resources for resource-driven archetypes
  useEffect(() => {
    const targetFacilityId = facility?._id || (facility as any)?.id;
    if ((facility?.archetype === 'ROOM_RESOURCE' || facility?.archetype === 'INVENTORY_TOOLS') && targetFacilityId) {
      let isMounted = true;
      setResourcesLoading(true);
      amenityManagementService
        .getResources({ facilityId: String(targetFacilityId) })
        .then((res) => {
          if (isMounted) {
            const rawPayload: any = res?.data;
            const resList: any[] =
              (Array.isArray(rawPayload) ? rawPayload : null) ||
              (Array.isArray(rawPayload?.data) ? rawPayload.data : null) ||
              (Array.isArray(rawPayload?.items) ? rawPayload.items : null) ||
              (Array.isArray((res as any)?.items) ? (res as any).items : null) ||
              (Array.isArray((res as any)?.data) ? (res as any).data : null) ||
              [];
            let normalized = resList.map((r: any) => normalizeResourceFromApi(r));

            // Fallback synthesis: If inventory tools have no discrete child resource, provide facility-level bulk resource
            if (normalized.length === 0 && facility?.archetype === 'INVENTORY_TOOLS') {
              const fallbackResource: any = {
                _id: String(targetFacilityId),
                facilityId: String(targetFacilityId),
                name: facility.name || 'Equipment Item',
                identifier: `${facility.code || 'FAC'}-ITEM-01`,
                totalBulkStock: (facility as any)?.availableStock || (facility as any)?.capacity || 1,
                assetState: 'AVAILABLE',
                isSerializedAsset: false,
              } as any;
              normalized = [fallbackResource];
            }

            setAvailableResources(normalized);

            // Auto-select when exactly 1 resource exists (e.g. single inventory tool or dedicated suite)
            if (normalized.length === 1) {
              setSelectedResource((prev) => prev || normalized[0]);
            }
          }
        })
        .catch((err) => {
          console.error('[useAmenityBookingWizard] Failed to fetch resources:', err);
          if (isMounted) {
            if (facility?.archetype === 'INVENTORY_TOOLS') {
              const fallbackResource: any = {
                _id: String(targetFacilityId),
                facilityId: String(targetFacilityId),
                name: facility.name || 'Equipment Item',
                identifier: `${facility.code || 'FAC'}-ITEM-01`,
                totalBulkStock: (facility as any)?.availableStock || (facility as any)?.capacity || 1,
                assetState: 'AVAILABLE',
                isSerializedAsset: false,
              } as any;
              setAvailableResources([fallbackResource]);
              setSelectedResource((prev) => prev || fallbackResource);
            } else {
              setAvailableResources([]);
            }
          }
        })
        .finally(() => {
          if (isMounted) setResourcesLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [
    facility?._id,
    (facility as any)?.id,
    facility?.archetype,
    facility?.name,
    facility?.code,
    (facility as any)?.availableStock,
    (facility as any)?.capacity,
  ]);

  // Fetch available slots from server (filtering out booked and past slots)
  const fetchDailySlots = useCallback(async (date: string, resourceId?: string) => {
    if (!facility._id || !date) return;
    setLoadingDailySlots(true);
    try {
      const res = await amenityManagementService.getDailySlots({
        facilityId: facility._id,
        date,
        resourceId,
        requestedQuantity: facility.archetype === 'INVENTORY_TOOLS' ? quantity : headcount,
      });
      const rawSlots = res?.data?.slots || (res as any)?.slots || [];
      setAvailableDailySlots(rawSlots);

      // If available slots returned and current selection is not in list, auto-select first available slot
      if (rawSlots.length > 0) {
        setStartTime((prevStart) => {
          const hasMatch = rawSlots.some((s: any) => s.start === prevStart);
          return hasMatch ? prevStart : rawSlots[0].start;
        });
        setEndTime((prevEnd) => {
          const hasMatch = rawSlots.some((s: any) => s.end === prevEnd);
          return hasMatch ? prevEnd : rawSlots[0].end;
        });
      }
    } catch {
      // Gracefully retained, fallback handled in DateTimeStep
    } finally {
      setLoadingDailySlots(false);
    }
  }, [facility._id, facility.archetype, quantity, headcount]);

  useEffect(() => {
    fetchDailySlots(selectedDate, selectedResource?._id);
  }, [fetchDailySlots, selectedDate, selectedResource?._id]);

  // Fetch digital wallet balance on mount
  useEffect(() => {
    dispatch(fetchWalletThunk());
  }, [dispatch]);

  // Clean errors when changing steps
  useEffect(() => {
    setStepError(null);
    dispatch(clearV2Errors());
  }, [currentStepIndex, dispatch]);

  // Computed ISO timestamps in UTC from facility date & time
  const startUtcIso = useMemo(() => {
    return convertLocalToUtcIso(selectedDate, startTime, facility.timezone);
  }, [selectedDate, startTime, facility.timezone]);

  const endUtcIso = useMemo(() => {
    return convertLocalToUtcIso(selectedDate, endTime, facility.timezone);
  }, [selectedDate, endTime, facility.timezone]);

  // ==========================================
  // Availability Evaluation (Step 2)
  // ==========================================
  const handleEvaluateAvailability = useCallback(async (): Promise<boolean> => {
    if (!startUtcIso || !endUtcIso) {
      setStepError('Please select valid start and end times.');
      return false;
    }

    setCheckingAvailability(true);
    setStepError(null);
    try {
      const res = await dispatch(
        checkAvailabilityThunk({
          facilityId: facility._id,
          resourceId: selectedResource?._id,
          startDateTime: startUtcIso,
          endDateTime: endUtcIso,
          requestedQuantity: facility.archetype === 'INVENTORY_TOOLS' ? quantity : headcount,
        })
      ).unwrap();

      setAvailabilityResult(res);
      if (!res.available) {
        setStepError(res.reason || 'This facility is not available for the selected time window.');
        return false;
      }
      return true;
    } catch (err: any) {
      setStepError(err?.message || 'Failed to verify slot availability. Please try again.');
      return false;
    } finally {
      setCheckingAvailability(false);
    }
  }, [dispatch, facility._id, facility.archetype, selectedResource?._id, startUtcIso, endUtcIso, quantity, headcount]);

  // ==========================================
  // Server-Authoritative Pricing (Step 4)
  // ==========================================
  const handleFetchAuthoritativePricing = useCallback(async (): Promise<boolean> => {
    if (!startUtcIso || !endUtcIso) return false;

    setCalculatingPricing(true);
    setStepError(null);
    try {
      const payload = mapPricingFormToApiPayload({
        facilityId: facility._id,
        startDateTime: startUtcIso,
        endDateTime: endUtcIso,
        headcount,
        quantity,
      });

      const quote = await dispatch(calculatePricingThunk(payload)).unwrap();
      setPricingSnapshot(quote);
      return true;
    } catch (err: any) {
      setStepError(err?.message || 'Unable to retrieve pricing quote from server.');
      return false;
    } finally {
      setCalculatingPricing(false);
    }
  }, [dispatch, facility._id, startUtcIso, endUtcIso, headcount, quantity]);

  // Auto-recalculate pricing when slot selection, headcount, or quantity changes
  useEffect(() => {
    if (startUtcIso && endUtcIso) {
      handleFetchAuthoritativePricing();
    }
  }, [startUtcIso, endUtcIso, headcount, quantity, handleFetchAuthoritativePricing]);

  // ==========================================
  // Step Progression & Validation
  // ==========================================
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const key = currentStep.key;

    if (key === 'resource') {
      if (!selectedResource) {
        setStepError('Please select an item or room to continue.');
        return false;
      }
      return true;
    }

    if (key === 'datetime') {
      if (!selectedDate) {
        setStepError('Please pick a reservation date.');
        return false;
      }
      if (!startTime || !endTime || startTime >= endTime) {
        setStepError('End time must be after start time.');
        return false;
      }
      const isAvailable = await handleEvaluateAvailability();
      return isAvailable;
    }

    if (key === 'quantity') {
      if (facility.archetype === 'INVENTORY_TOOLS') {
        if (quantity < 1) {
          setStepError('Quantity must be at least 1.');
          return false;
        }
      } else {
        if (headcount < 1) {
          setStepError('Headcount must be at least 1.');
          return false;
        }
        if (
          facility.maxHeadcountPerReservation &&
          headcount > facility.maxHeadcountPerReservation
        ) {
          setStepError(`Maximum ${facility.maxHeadcountPerReservation} participants per reservation.`);
          return false;
        }
      }
      return true;
    }

    if (key === 'review') {
      // Create hold upon completing review step
      return true;
    }

    return true;
  }, [
    currentStep.key,
    selectedResource,
    selectedDate,
    startTime,
    endTime,
    handleEvaluateAvailability,
    facility.archetype,
    facility.maxHeadcountPerReservation,
    quantity,
    headcount,
  ]);

  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (!isValid) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      const nextKey = steps[nextIndex].key;

      // When moving into review step, fetch server quote
      if (nextKey === 'review') {
        const pricingOk = await handleFetchAuthoritativePricing();
        if (!pricingOk) return;
      }

      // When moving from review into hold/payment, create backend hold
      if (currentStep.key === 'review' && nextKey === 'payment') {
        if (!activeHold) {
          try {
            await handleCreateHold();
          } catch {
            return;
          }
        }
      }

      setCurrentStepIndex(nextIndex);
    }
  }, [
    validateCurrentStep,
    currentStepIndex,
    steps,
    currentStep.key,
    handleFetchAuthoritativePricing,
    activeHold,
  ]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      // If going back from hold step, prompt confirmation
      if (currentStep.key === 'payment' && activeHold && !isHoldExpired) {
        setIsCancelModalOpen(true);
        return;
      }
      setCurrentStepIndex(currentStepIndex - 1);
    } else {
      router.back();
    }
  }, [currentStepIndex, currentStep.key, activeHold, isHoldExpired, router]);

  // ==========================================
  // Hold Lifecycle Operations
  // ==========================================
  const handleCreateHold = useCallback(async () => {
    setStepError(null);
    try {
      const payload = mapHoldFormToApiPayload({
        facilityId: facility._id,
        resourceId: selectedResource?._id,
        slotSelection: {
          slotId: 'custom-slot',
          date: selectedDate,
          startTime,
          endTime,
          utcStartDateTime: startUtcIso,
          utcEndDateTime: endUtcIso,
        },
        headcount,
        quantity,
        holdType: 'STANDARD',
      });

      const idempotencyKey = generateUUID();
      const res = await dispatch(createHoldThunk({ payload, idempotencyKey })).unwrap();
      return res;
    } catch (err: any) {
      const msg = err?.message || 'Failed to place temporary hold on facility.';
      setStepError(msg);
      throw err;
    }
  }, [
    dispatch,
    facility._id,
    selectedResource?._id,
    selectedDate,
    startTime,
    endTime,
    startUtcIso,
    endUtcIso,
    headcount,
    quantity,
  ]);

  const handleReleaseHoldAndExit = useCallback(async () => {
    if (activeHold?._id) {
      try {
        await dispatch(releaseHoldThunk(activeHold._id)).unwrap();
      } catch {
        // Fallback gracefully on release error
      }
    }
    dispatch(resetV2BookingState());
    setIsCancelModalOpen(false);
    router.back();
  }, [activeHold?._id, dispatch, router]);

  // ==========================================
  // Confirmation & Payment Operations
  // ==========================================
  const completeReservation = useCallback(async (params?: {
    paymentMethod?: 'WALLET' | 'RAZORPAY';
    paymentId?: string;
  }) => {
    if (!activeHold?._id) {
      setStepError('No active reservation hold found.');
      return;
    }

    if (isHoldExpired) {
      setStepError('Your reservation hold has expired. Please select a new slot.');
      return;
    }

    // Determine if payment is required based on authoritative pricing
    const totalAmount = pricingSnapshot?.totalAmount ?? activeHold?.pricingSnapshot?.totalAmount ?? 0;
    const isPaymentRequired = totalAmount > 0;

    // 1. Free Facility flow (no payment required)
    if (!isPaymentRequired) {
      setStepError(null);
      try {
        const payload = mapConfirmFormToApiPayload({
          holdId: activeHold._id,
          notes: bookingNotes,
        });

        const idempotencyKey = buildAmenityConfirmKey(activeHold._id);
        const confirmResult = await dispatch(
          confirmReservationThunk({ payload, idempotencyKey })
        ).unwrap();
        const reservation = confirmResult.reservation;

        if (canDisplayAmenityAccessPass(reservation)) {
          dispatch(fetchPassesByReservationThunk(reservation._id));
        }

        const resultIdx = steps.findIndex((s) => s.key === 'result');
        if (resultIdx >= 0) {
          setCurrentStepIndex(resultIdx);
        }
      } catch (err: any) {
        setStepError(err?.message || 'Failed to confirm reservation. Please try again.');
      }
      return;
    }

    // 2. Paid Facility - Digital Wallet Flow (Phase 6 Canonical POST /amenity-bookings)
    if (paymentMethod === 'WALLET') {
      if (balance < totalAmount) {
        const currency = pricingSnapshot?.currency || 'INR';
        setStepError(`Insufficient wallet balance (${balance} ${currency}). Please top up.`);
        setIsTopUpOpen(true);
        return;
      }

      setStepError(null);
      try {
        const bookingDate = selectedDate;
        const res: any = await createAmenityBooking({
          amenityId: facility._id,
          bookingDate,
          startTime,
          endTime,
          numberOfPersons: headcount || quantity || 1,
          paymentMethod: 'WALLET',
        });

        const responseData = res?.data || res;
        const booking = responseData?.booking || responseData;

        // Clean up temporary hold to return hold inventory
        if (activeHold?._id) {
          dispatch(releaseHoldThunk(activeHold._id)).catch(() => {});
        }

        // Re-synchronize resident wallet balance with committed ledger state
        dispatch(fetchWalletBalance());

        // Adapt canonical booking into reservation and passes for Result step
        const adaptedRes = adaptBookingToReservation(booking, facility);
        const adaptedPasses = adaptBookingToPasses(booking);
        setCanonicalReservation(adaptedRes);
        setCanonicalPasses(adaptedPasses);

        const resultIdx = steps.findIndex((s) => s.key === 'result');
        if (resultIdx >= 0) {
          setCurrentStepIndex(resultIdx);
        }
      } catch (err: any) {
        setStepError(
          err?.response?.data?.message || err?.message || 'Wallet payment and reservation failed.'
        );
      }
      return;
    }

    // 3. Paid Facility - Razorpay Online Gateway Flow
    if (paymentMethod === 'RAZORPAY') {
      setStepError(null);
      try {
        const bookingDate = selectedDate;
        const res: any = await createAmenityBooking({
          amenityId: facility._id,
          bookingDate,
          startTime,
          endTime,
          numberOfPersons: headcount || quantity || 1,
          paymentMethod: 'ONLINE',
        });

        const responseData = res?.data || res;
        const booking = responseData?.booking || responseData;
        const paymentIntent = responseData?.paymentIntent;

        createdBookingRef.current = booking;

        let keyId = paymentIntent?.razorpayKeyId;
        let orderId = paymentIntent?.orderId;
        let paymentId = paymentIntent?.paymentId;

        // If backend did not auto-populate paymentIntent, create order via Unified Payment Core
        if (!orderId && booking?._id) {
          const orderRes = await paymentService.createPaymentOrder(
            {
              referenceId: booking._id,
              referenceType: 'AmenityBooking',
              amount: totalAmount,
              currency: pricingSnapshot?.currency || 'INR',
            },
            buildAmenityOrderKey(booking._id, totalAmount, operationIdRef.current)
          );
          keyId = orderRes.razorpayKeyId;
          orderId = orderRes.orderId;
          paymentId = orderRes.paymentId;
        }

        if (!keyId) {
          try {
            const gwStatus = await paymentService.getGatewayStatus();
            keyId = gwStatus.keyId;
          } catch {}
          keyId = keyId || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';
        }

        setRazorpayOptions({
          razorpayKeyId: keyId,
          orderId,
          paymentId,
          amount: totalAmount,
          currency: pricingSnapshot?.currency || 'INR',
          description: `Amenity Booking: ${facility.name}`,
          customerName: 'Resident',
          isWalletTopUp: false,
        });
        setIsRazorpayOpen(true);
      } catch (err: any) {
        setStepError(
          err?.response?.data?.message || err?.message || 'Failed to initiate online payment order.'
        );
      }
      return;
    }

    // 4. Paid Facility - Pay-at-Gate / Cash Flow
    if (paymentMethod === 'PAY_AT_GATE') {
      setStepError(null);
      const idempotencyKey = buildAmenityPayAtGateKey(operationIdRef.current);

      // Persist active session before initiating mutation
      await paymentService.saveActivePaymentSession({
        operationId: operationIdRef.current,
        referenceType: 'AmenityBooking',
        referenceId: facility._id,
        amount: totalAmount,
        currency: pricingSnapshot?.currency || 'INR',
        paymentMethod: 'PAY_AT_GATE',
        status: 'SUBMITTING',
        createdAt: new Date().toISOString(),
      });

      try {
        const bookingDate = selectedDate;
        const res: any = await createAmenityBooking(
          {
            amenityId: facility._id,
            bookingDate,
            startTime,
            endTime,
            numberOfPersons: headcount || quantity || 1,
            paymentMethod: 'PAY_AT_GATE',
          },
          idempotencyKey
        );

        const responseData = res?.data || res;
        const booking = responseData?.booking || responseData;

        // CRITICAL HOLD RULE: Release temporary inventory hold ONLY after definitive successful booking creation
        if (activeHold?._id) {
          dispatch(releaseHoldThunk(activeHold._id)).catch(() => {});
        }

        // Clear active session upon definitive success
        await paymentService.clearActivePaymentSession('AmenityBooking', facility._id);

        // Adapt authoritative backend booking fields into reservation and passes
        const adaptedRes = adaptBookingToReservation(booking, facility);
        const adaptedPasses = adaptBookingToPasses(booking);
        setCanonicalReservation(adaptedRes);
        setCanonicalPasses(adaptedPasses);

        const resultIdx = steps.findIndex((s) => s.key === 'result');
        if (resultIdx >= 0) {
          setCurrentStepIndex(resultIdx);
        }
      } catch (err: any) {
        const isAmbiguous = isAmbiguousPaymentError(err);
        if (isAmbiguous) {
          // Ambiguous network interruption -> retain session in CHECKING, do NOT release hold on lost response
          await paymentService.saveActivePaymentSession({
            operationId: operationIdRef.current,
            referenceType: 'AmenityBooking',
            referenceId: facility._id,
            amount: totalAmount,
            currency: pricingSnapshot?.currency || 'INR',
            paymentMethod: 'PAY_AT_GATE',
            status: 'CHECKING',
            createdAt: new Date().toISOString(),
          });
          setStepError('Booking creation response delayed. Please check your bookings in My Bookings.');
        } else {
          // Definitive failure
          await paymentService.clearActivePaymentSession('AmenityBooking', facility._id);
          setStepError(
            err?.response?.data?.message || err?.message || 'Pay at Gate booking creation failed.'
          );
        }
      }
      return;
    }
  }, [
    activeHold?._id,
    isHoldExpired,
    pricingSnapshot?.totalAmount,
    pricingSnapshot?.currency,
    paymentMethod,
    balance,
    selectedDate,
    startTime,
    endTime,
    headcount,
    quantity,
    facility,
    bookingNotes,
    dispatch,
    steps,
  ]);

  const handleLaunchRazorpay = useCallback(async () => {
    if (!activeHold?._id || isHoldExpired) {
      setStepError('Your reservation hold has expired. Please select a new slot.');
      return;
    }

    setStepError(null);
    try {
      const response = await amenityManagementService.createReservationPaymentOrder(activeHold._id);
      const order = response.data;

      // A checkout response can be replayed after an app interruption. If the
      // order was already verified, finish the reservation without opening a
      // second checkout or charging the resident again.
      if (order?.alreadyVerified && order?.paymentId) {
        await completeReservation({ paymentMethod: 'RAZORPAY', paymentId: order.paymentId });
        return;
      }

      if (!order?.paymentId || !order?.orderId || !order?.razorpayKeyId) {
        throw new Error('The payment gateway did not return a valid checkout order.');
      }

      setRazorpayOptions({
        paymentId: order.paymentId,
        orderId: order.orderId,
        razorpayKeyId: order.razorpayKeyId,
        amount: Number(order.amount || 0),
        currency: order.currency || 'INR',
        description: `Amenity Booking: ${facility.name}`,
      });
      setCheckoutPurpose('AMENITY');
      setIsRazorpayOpen(true);
    } catch (err: any) {
      setStepError(err?.message || 'Unable to start secure Razorpay checkout.');
    }
  }, [activeHold?._id, completeReservation, facility.name, isHoldExpired]);

  const handleConfirmReservation = useCallback(async () => {
    const totalAmount = pricingSnapshot?.totalAmount ?? activeHold?.pricingSnapshot?.totalAmount ?? 0;
    if (totalAmount <= 0) {
      await completeReservation();
      return;
    }

    if (paymentMethod === 'RAZORPAY') {
      await handleLaunchRazorpay();
      return;
    }

    if (balance < totalAmount) {
      const currency = pricingSnapshot?.currency || 'INR';
      setStepError(`Insufficient wallet balance (${balance} ${currency}). Please top up.`);
      setIsTopUpOpen(true);
      return;
    }

    await completeReservation({ paymentMethod: 'WALLET' });
  }, [
    activeHold?.pricingSnapshot?.totalAmount,
    balance,
    completeReservation,
    handleLaunchRazorpay,
    paymentMethod,
    pricingSnapshot?.currency,
    pricingSnapshot?.totalAmount,
  ]);

  const handleRazorpaySuccess = useCallback(
    async (payload: any) => {
      setIsRazorpayOpen(false);

      const isWalletTopUp = (razorpayOptions as any)?.isWalletTopUp;
      const paymentId = payload?.paymentId || razorpayOptions?.paymentId;
      const orderId = payload?.orderId || payload?.razorpayOrderId || razorpayOptions?.orderId;
      const razorpayPaymentId = payload?.razorpayPaymentId || payload?.razorpay_payment_id;
      const razorpaySignature = payload?.razorpaySignature || payload?.razorpay_signature;

      // Handle Wallet Top-Up Payment Verification
      if (isWalletTopUp) {
        try {
          const idempotencyKey = paymentId && orderId ? buildWalletVerifyKey(paymentId, orderId) : undefined;
          await dispatch(
            verifyWalletPayment({
              paymentData: {
                ...payload,
                paymentId,
                orderId,
                razorpayPaymentId,
                razorpaySignature,
                amount: razorpayOptions?.amount,
              },
              idempotencyKey,
            })
          ).unwrap();
          await dispatch(fetchWalletBalance());
          setStepError(null);
        } catch (err: any) {
          setStepError(err?.message || 'Wallet top-up signature verification failed.');
        }
        return;
      }

      // Handle Amenity Booking Online Payment Verification
      setStepError(null);
      try {
        const idempotencyKey = paymentId && orderId ? buildAmenityVerifyKey(paymentId, orderId) : undefined;
        const verifyResult = await paymentService.verifyPaymentSignature(
          {
            paymentId,
            orderId,
            razorpayPaymentId,
            razorpaySignature,
          },
          idempotencyKey
        );

        const booking = verifyResult?.booking || verifyResult?.data?.booking || createdBookingRef.current;

        // Clean up temporary hold
        if (activeHold?._id) {
          dispatch(releaseHoldThunk(activeHold._id)).catch(() => {});
        }

        // Adapt canonical verified booking to result view
        const adaptedRes = adaptBookingToReservation(booking, facility);
        const adaptedPasses = adaptBookingToPasses(booking);
        setCanonicalReservation(adaptedRes);
        setCanonicalPasses(adaptedPasses);

        const resultIdx = steps.findIndex((s) => s.key === 'result');
        if (resultIdx >= 0) {
          setCurrentStepIndex(resultIdx);
        }
      } catch (err: any) {
        setStepError(
          err?.response?.data?.message || err?.message || 'Payment signature could not be verified by backend.'
        );
      }
    },
    [activeHold?._id, dispatch, facility, razorpayOptions, steps]
  );

  const handleRazorpayDismiss = useCallback(() => {
    setIsRazorpayOpen(false);
    setRazorpayOptions(null);
    setCheckoutPurpose(null);
    setWalletTopUpAmount(0);
  }, []);

  const handleTopUpSubmit = useCallback(
    async (amount: number) => {
      if (amount <= 0) return;
      setIsTopUpOpen(false);
      try {
        const idempotencyKey = buildWalletOrderKey(facility?._id || 'user', amount, operationIdRef.current);
        const orderData: any = await dispatch(
          createWalletRazorpayOrder({ amount, idempotencyKey })
        ).unwrap();

        const keyId =
          orderData?.razorpayKeyId ||
          orderData?.keyId ||
          orderData?.key ||
          process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ||
          '';
        const orderId = orderData?.orderId || orderData?.id || '';
        const paymentId = orderData?.paymentId || '';

        setRazorpayOptions({
          razorpayKeyId: keyId,
          orderId,
          paymentId,
          amount,
          currency: orderData?.currency || 'INR',
          description: `Digital Wallet Top-Up (₹${amount})`,
          isWalletTopUp: true,
        });
        setIsRazorpayOpen(true);
      } catch (err: any) {
        setStepError(err?.message || 'Failed to create wallet recharge order.');
      }
      }
    },
    [dispatch, facility?._id]
  );

  const handleRestartBooking = useCallback(() => {
    operationIdRef.current = createOperationId();
    setCanonicalReservation(null);
    setCanonicalPasses([]);
    setRazorpayOptions(null);
    createdBookingRef.current = null;
    dispatch(resetV2BookingState());
    setCurrentStepIndex(0);
    setStepError(null);
  }, [dispatch]);

  const displayReservation = canonicalReservation || v2CurrentReservation;
  const displayPasses = canonicalPasses.length > 0 ? canonicalPasses : v2AccessPasses;

  const isPassEligible = useMemo(() => {
    if (
      displayReservation?.bookingStatus === 'CONFIRMED' &&
      displayPasses.length > 0 &&
      Boolean((displayPasses[0] as any)?.qrData || (displayPasses[0] as any)?.passCode)
    ) {
      return true;
    }
    return canDisplayAmenityAccessPass(displayReservation);
  }, [displayReservation, displayPasses]);

  return {
    facility,
    steps,
    currentStepIndex,
    currentStep,
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === steps.length - 1,

    // Selections
    selectedResource,
    setSelectedResource,
    availableResources,
    resourcesLoading,
    selectedDate,
    setSelectedDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    availableDailySlots,
    loadingDailySlots,
    fetchDailySlots,
    headcount,
    setHeadcount,
    quantity,
    setQuantity,
    guests,
    setGuests,
    bookingNotes,
    setBookingNotes,
    paymentMethod,
    setPaymentMethod,
    paymentReference,
    setPaymentReference,

    // Feedback & Caches
    availabilityResult,
    checkingAvailability,
    pricingSnapshot,
    calculatingPricing,
    stepError,
    setStepError,

    // Hold State & Results
    activeHold,
    holdRemainingSeconds,
    isHoldExpired,
    v2Holding,
    v2Confirming,
    v2CurrentReservation: displayReservation,
    v2AccessPasses: displayPasses,
    v2Error,
    isPassEligible,

    // Modals & Gateway
    isCancelModalOpen,
    setIsCancelModalOpen,
    isTopUpOpen,
    setIsTopUpOpen,
    isRazorpayOpen,
    setIsRazorpayOpen,
    razorpayOptions,
    balance,
    walletLoading,

    // Handlers
    handleNext,
    handleBack,
    handleEvaluateAvailability,
    handleFetchAuthoritativePricing,
    handleCreateHold,
    handleReleaseHoldAndExit,
    handleConfirmReservation,
    handleLaunchRazorpay: handleConfirmReservation,
    handleRazorpaySuccess,
    handleRazorpayDismiss,
    handleTopUpSubmit,
    handleRestartBooking,
  };
}

export default useAmenityBookingWizard;
