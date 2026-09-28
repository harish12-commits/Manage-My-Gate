/**
 * Resident booking wizard controller (Amenity Management V2).
 *
 * The server is the source of truth for everything bookable and payable:
 *  - windows come from /availability/daily-slots (slots, event sessions, full day,
 *    overnight check-in, loan pickup) for the facility's archetype;
 *  - the price and the payment schedule (amount due now, balance later, deposit) are
 *    fixed when the hold is created;
 *  - the amount due now is paid from the digital wallet (confirm) or online (Razorpay
 *    order → checkout → verify, where the server creates the booking). Nothing is due
 *    online for free and pay-at-gate facilities.
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
  AmenityAmountSchedule,
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
import { calculateHoldRemainingSeconds, canDisplayAmenityAccessPass } from '../utils/amenityStateHelpers';
import {
  mapHoldFormToApiPayload,
  mapPricingFormToApiPayload,
  normalizeResourceFromApi,
  normalizeReservationFromApi,
} from '../utils/amenityPayloadMappers';
import { bookingWindowEnd, isLoanFacility, isOvernightFacility, maxLoanDays } from '../utils/amenityBookingWindow';
import amenityManagementService, { generateUUID, ApiDailySlot } from '../services/amenityManagementService';
import paymentService from '../../payment/services/paymentService';
import { RazorpayCheckoutOptions } from '../../billing/components/RazorpayCheckoutModal';
import { createOperationId, buildWalletOrderKey, buildWalletVerifyKey } from '../../../utils/idempotency';
import { useTranslation } from '@/src/utils/i18n';

export type WizardStepKey = 'resource' | 'datetime' | 'quantity' | 'review' | 'payment' | 'result';

export interface WizardStepDefinition {
  key: WizardStepKey;
  title: string;
  subtitle?: string;
}

export type BookingPaymentMethod = 'WALLET' | 'RAZORPAY';

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function useAmenityBookingWizard(facility: AmenityFacility, options: { initialDate?: string } = {}) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { t } = useTranslation();

  const { activeHold, v2CurrentReservation, v2AccessPasses, v2Holding, v2Confirming, v2Error } = useSelector(
    (state: RootState) => state.amenityBookings
  );
  const { balance = 0, isLoading: walletLoading = false } = useSelector((state: RootState) => state.wallet);

  const isResourceDriven = facility.archetype === 'ROOM_RESOURCE' || facility.archetype === 'INVENTORY_TOOLS';
  const partyIsQuantity = facility.archetype === 'INVENTORY_TOOLS';

  // ─── Steps ──────────────────────────────────────────────────────────────
  const steps: WizardStepDefinition[] = useMemo(() => {
    const list: WizardStepDefinition[] = [];
    if (isResourceDriven) {
      list.push({
        key: 'resource',
        title: partyIsQuantity
          ? t('amenity_booking_step_equipment', 'Select Equipment')
          : t('amenity_booking_step_room', 'Select Room/Suite'),
        subtitle: t('amenity_booking_step_resource_sub', 'Choose what you want to book'),
      });
    }
    list.push(
      {
        key: 'datetime',
        title: t('amenity_booking_step_schedule', 'Schedule'),
        subtitle: isOvernightFacility(facility)
          ? t('amenity_booking_step_schedule_stay', 'Check-in date and nights')
          : isLoanFacility(facility)
            ? t('amenity_booking_step_schedule_loan', 'Pickup and return')
            : t('amenity_booking_step_schedule_sub', 'Select date and time'),
      },
      {
        key: 'quantity',
        title: partyIsQuantity
          ? t('amenity_booking_step_quantity', 'Quantity')
          : t('amenity_booking_step_guests', 'Guests & Headcount'),
        subtitle: t('amenity_booking_step_quantity_sub', 'Specify booking details'),
      },
      { key: 'review', title: t('amenity_booking_step_review', 'Review & Price'), subtitle: t('amenity_booking_step_review_sub', 'Price confirmed by the community') },
      { key: 'payment', title: t('amenity_booking_step_payment', 'Hold & Payment'), subtitle: t('amenity_booking_step_payment_sub', 'Your slot is held while you pay') },
      { key: 'result', title: t('amenity_booking_step_result', 'Booking Result'), subtitle: t('amenity_booking_step_result_sub', 'Status and access pass') }
    );
    return list;
  }, [facility, isResourceDriven, partyIsQuantity, t]);

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const currentStep = steps[currentStepIndex] || steps[0];

  // ─── Selections ─────────────────────────────────────────────────────────
  const [selectedResource, setSelectedResource] = useState<AmenityResource | null>(null);
  const [availableResources, setAvailableResources] = useState<AmenityResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState<boolean>(false);

  const [selectedDate, setSelectedDate] = useState<string>(options.initialDate || todayLocal());
  const [availableDailySlots, setAvailableDailySlots] = useState<ApiDailySlot[] | undefined>(undefined);
  const [loadingDailySlots, setLoadingDailySlots] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<ApiDailySlot | null>(null);
  const [nights, setNights] = useState<number>(1);
  const [loanDays, setLoanDays] = useState<number>(0);

  const [headcount, setHeadcount] = useState<number>(1);
  const [quantity, setQuantity] = useState<number>(1);
  const [guests, setGuests] = useState<AmenityGuest[]>([]);
  const [bookingNotes, setBookingNotes] = useState<string>('');

  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod>('WALLET');
  const [isRazorpayConfigured, setIsRazorpayConfigured] = useState<boolean>(false);

  const [availabilityResult, setAvailabilityResult] = useState<AmenityAvailabilityResult | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState<boolean>(false);
  const [pricingSnapshot, setPricingSnapshot] = useState<AmenityPricingSnapshot | null>(null);
  const [calculatingPricing, setCalculatingPricing] = useState<boolean>(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [paying, setPaying] = useState<boolean>(false);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState<boolean>(false);
  const [isRazorpayOpen, setIsRazorpayOpen] = useState<boolean>(false);
  const [razorpayOptions, setRazorpayOptions] = useState<RazorpayCheckoutOptions | null>(null);
  const [gatewayReservation, setGatewayReservation] = useState<AmenityReservation | null>(null);
  const operationIdRef = useRef<string>(createOperationId());

  useEffect(() => {
    let active = true;
    paymentService
      .getGatewayStatus()
      .then((res: any) => {
        const data = res?.data || res;
        if (active) setIsRazorpayConfigured(Boolean(data?.isConfigured ?? data === true));
      })
      .catch(() => active && setIsRazorpayConfigured(false));
    return () => {
      active = false;
    };
  }, []);

  // ─── Hold countdown ─────────────────────────────────────────────────────
  const [holdRemainingSeconds, setHoldRemainingSeconds] = useState<number>(0);
  useEffect(() => {
    if (!activeHold?.expiresAt) {
      setHoldRemainingSeconds(0);
      return;
    }
    const tick = () => setHoldRemainingSeconds(calculateHoldRemainingSeconds(activeHold.expiresAt));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeHold?.expiresAt]);
  const isHoldExpired = useMemo(() => !!activeHold && holdRemainingSeconds <= 0, [activeHold, holdRemainingSeconds]);

  // ─── Resources (rooms / items) ──────────────────────────────────────────
  useEffect(() => {
    if (!isResourceDriven || !facility?._id) return;
    let mounted = true;
    setResourcesLoading(true);
    amenityManagementService
      .getResources({ facilityId: String(facility._id) })
      .then((res) => {
        if (!mounted) return;
        const payload: any = res?.data;
        const list: any[] = Array.isArray(payload) ? payload : payload?.data || payload?.items || [];
        const normalized = list.map((r: any) => normalizeResourceFromApi(r)).filter((r) => r.isActive !== false);
        setAvailableResources(normalized);
        if (normalized.length === 1) setSelectedResource((prev) => prev || normalized[0]);
      })
      .catch(() => mounted && setAvailableResources([]))
      .finally(() => mounted && setResourcesLoading(false));
    return () => {
      mounted = false;
    };
  }, [facility?._id, isResourceDriven]);

  // ─── Bookable windows for the selected day ──────────────────────────────
  const fetchDailySlots = useCallback(
    async (date: string, resourceId?: string) => {
      if (!facility._id || !date) return;
      setLoadingDailySlots(true);
      try {
        const res = await amenityManagementService.getDailySlots({
          facilityId: facility._id,
          date,
          resourceId,
          headcount: partyIsQuantity ? 1 : headcount,
          quantity: partyIsQuantity ? quantity : 1,
        });
        const slots: ApiDailySlot[] = (res?.data as any)?.slots || (res as any)?.slots || [];
        setAvailableDailySlots(slots);
        setSelectedSlot((prev) => (prev && slots.some((s) => s.startUtc === prev.startUtc) ? prev : slots[0] || null));
      } catch {
        setAvailableDailySlots([]);
        setSelectedSlot(null);
      } finally {
        setLoadingDailySlots(false);
      }
    },
    [facility._id, partyIsQuantity, headcount, quantity]
  );

  useEffect(() => {
    if (isResourceDriven && !selectedResource) return;
    fetchDailySlots(selectedDate, selectedResource?._id);
  }, [fetchDailySlots, selectedDate, selectedResource?._id, isResourceDriven, selectedResource]);

  useEffect(() => {
    dispatch(fetchWalletThunk());
  }, [dispatch]);

  useEffect(() => {
    setStepError(null);
    dispatch(clearV2Errors());
  }, [currentStepIndex, dispatch]);

  // ─── Requested window (UTC) ─────────────────────────────────────────────
  const startUtcIso = selectedSlot?.startUtc || '';
  const endUtcIso = useMemo(
    () => (selectedSlot ? bookingWindowEnd(facility, selectedSlot, { nights, loanDays }) : ''),
    [facility, selectedSlot, nights, loanDays]
  );

  const selectWindow = useCallback((slot: ApiDailySlot) => {
    setSelectedSlot(slot);
    setAvailabilityResult(null);
  }, []);

  // ─── Availability & price ───────────────────────────────────────────────
  const handleEvaluateAvailability = useCallback(async (): Promise<boolean> => {
    if (!startUtcIso || !endUtcIso) {
      setStepError(t('amenity_booking_err_pick_window', 'Please choose a time to continue.'));
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
          requestedQuantity: partyIsQuantity ? quantity : headcount,
          headcount: partyIsQuantity ? 1 : headcount,
          quantity: partyIsQuantity ? quantity : 1,
        } as any)
      ).unwrap();
      setAvailabilityResult(res);
      if (!res.available) {
        setStepError(res.reason || t('amenity_booking_err_unavailable', 'This time is not available.'));
        return false;
      }
      return true;
    } catch (err: any) {
      setStepError(err?.message || t('amenity_booking_err_availability', 'Could not check availability. Please try again.'));
      return false;
    } finally {
      setCheckingAvailability(false);
    }
  }, [dispatch, facility._id, selectedResource?._id, startUtcIso, endUtcIso, partyIsQuantity, quantity, headcount, t]);

  const handleFetchAuthoritativePricing = useCallback(async (): Promise<boolean> => {
    if (!startUtcIso || !endUtcIso) return false;
    setCalculatingPricing(true);
    try {
      const quote = await dispatch(
        calculatePricingThunk(
          mapPricingFormToApiPayload({ facilityId: facility._id, startDateTime: startUtcIso, endDateTime: endUtcIso, headcount, quantity })
        )
      ).unwrap();
      setPricingSnapshot(quote);
      return true;
    } catch (err: any) {
      setStepError(err?.message || t('amenity_booking_err_price', 'Could not get the price. Please try again.'));
      return false;
    } finally {
      setCalculatingPricing(false);
    }
  }, [dispatch, facility._id, startUtcIso, endUtcIso, headcount, quantity, t]);

  // ─── Step progression ───────────────────────────────────────────────────
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    switch (currentStep.key) {
      case 'resource':
        if (!selectedResource) {
          setStepError(t('amenity_booking_err_pick_resource', 'Please select an item or room to continue.'));
          return false;
        }
        return true;
      case 'datetime':
        if (!selectedSlot) {
          setStepError(t('amenity_booking_err_pick_window', 'Please choose a time to continue.'));
          return false;
        }
        return handleEvaluateAvailability();
      case 'quantity': {
        const n = partyIsQuantity ? quantity : headcount;
        if (n < 1) {
          setStepError(t('amenity_booking_err_min_one', 'Enter at least 1.'));
          return false;
        }
        // Capacity is re-checked for the final party size (shared pools, stock).
        return handleEvaluateAvailability();
      }
      default:
        return true;
    }
  }, [currentStep.key, selectedResource, selectedSlot, handleEvaluateAvailability, partyIsQuantity, quantity, headcount, t]);

  const handleCreateHold = useCallback(async () => {
    setStepError(null);
    try {
      const payload = mapHoldFormToApiPayload({
        facilityId: facility._id,
        resourceId: selectedResource?._id,
        slotSelection: {
          slotId: selectedSlot?.startUtc || 'window',
          date: selectedDate,
          startTime: selectedSlot?.start || '',
          endTime: selectedSlot?.end || '',
          utcStartDateTime: startUtcIso,
          utcEndDateTime: endUtcIso,
        },
        headcount: partyIsQuantity ? 1 : headcount,
        quantity: partyIsQuantity ? quantity : 1,
        holdType: 'STANDARD',
      });
      return await dispatch(createHoldThunk({ payload, idempotencyKey: generateUUID() })).unwrap();
    } catch (err: any) {
      setStepError(err?.message || t('amenity_booking_err_hold', 'Could not hold this time. Please pick another.'));
      throw err;
    }
  }, [dispatch, facility._id, selectedResource?._id, selectedSlot, selectedDate, startUtcIso, endUtcIso, partyIsQuantity, headcount, quantity, t]);

  const handleNext = useCallback(async () => {
    if (!(await validateCurrentStep())) return;
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= steps.length) return;
    const nextKey = steps[nextIndex].key;
    if (nextKey === 'review' && !(await handleFetchAuthoritativePricing())) return;
    if (currentStep.key === 'review' && nextKey === 'payment' && !activeHold) {
      try {
        await handleCreateHold();
      } catch {
        return;
      }
    }
    setCurrentStepIndex(nextIndex);
  }, [validateCurrentStep, currentStepIndex, steps, currentStep.key, handleFetchAuthoritativePricing, activeHold, handleCreateHold]);

  const handleBack = useCallback(() => {
    if (currentStepIndex === 0) {
      router.back();
      return;
    }
    if (currentStep.key === 'payment' && activeHold && !isHoldExpired) {
      setIsCancelModalOpen(true);
      return;
    }
    setCurrentStepIndex(currentStepIndex - 1);
  }, [currentStepIndex, currentStep.key, activeHold, isHoldExpired, router]);

  const handleReleaseHoldAndExit = useCallback(async () => {
    if (activeHold?._id) {
      try {
        await dispatch(releaseHoldThunk(activeHold._id)).unwrap();
      } catch {
        // The hold also lapses on its own when its time runs out.
      }
    }
    dispatch(resetV2BookingState());
    setIsCancelModalOpen(false);
    router.back();
  }, [activeHold?._id, dispatch, router]);

  // ─── Payment ────────────────────────────────────────────────────────────
  const amountSchedule: AmenityAmountSchedule | null = activeHold?.amountSchedule || null;
  const dueNow = Number(amountSchedule?.dueNowAmount ?? 0);
  const currency = pricingSnapshot?.currency || activeHold?.pricingSnapshot?.currency || 'INR';

  const goToResult = useCallback(() => {
    const idx = steps.findIndex((s) => s.key === 'result');
    if (idx >= 0) setCurrentStepIndex(idx);
  }, [steps]);

  const confirmHold = useCallback(
    async (method?: BookingPaymentMethod) => {
      if (!activeHold?._id) return;
      const payload: Record<string, any> = { holdId: activeHold._id, notes: bookingNotes || undefined };
      if (method) payload.paymentMethod = method;
      const result = await dispatch(
        confirmReservationThunk({ payload: payload as any, idempotencyKey: `amenity-cfm-${activeHold._id}-${method || 'NONE'}` })
      ).unwrap();
      if (canDisplayAmenityAccessPass(result.reservation)) {
        dispatch(fetchPassesByReservationThunk(result.reservation._id));
      }
      dispatch(fetchWalletBalance());
      goToResult();
    },
    [activeHold?._id, bookingNotes, dispatch, goToResult]
  );

  const handleLaunchRazorpay = useCallback(async () => {
    if (!activeHold?._id) return;
    const response = await amenityManagementService.createReservationPaymentOrder({ holdId: activeHold._id });
    const order: any = response.data;
    if (order?.alreadyVerified) {
      // A replayed checkout that was already captured: the booking already exists.
      await confirmHold('RAZORPAY');
      return;
    }
    if (!order?.paymentId || !order?.orderId || !order?.razorpayKeyId) {
      throw new Error(t('amenity_booking_err_gateway', 'The payment gateway did not return a valid checkout.'));
    }
    setRazorpayOptions({
      paymentId: order.paymentId,
      orderId: order.orderId,
      razorpayKeyId: order.razorpayKeyId,
      amount: Number(order.amount || 0),
      currency: order.currency || 'INR',
      description: `${t('amenity_booking_payment_for', 'Amenity booking')}: ${facility.name}`,
    });
    setIsRazorpayOpen(true);
  }, [activeHold?._id, confirmHold, facility.name, t]);

  /** Single CTA: confirm (nothing due online), pay from wallet, or open online checkout. */
  const handleConfirmReservation = useCallback(async () => {
    if (!activeHold?._id) {
      setStepError(t('amenity_booking_err_no_hold', 'Your hold is no longer active. Please choose a time again.'));
      return;
    }
    if (isHoldExpired) {
      setStepError(t('amenity_booking_err_hold_expired', 'Your hold has expired. Please choose a new time.'));
      return;
    }
    setStepError(null);
    setPaying(true);
    try {
      if (dueNow <= 0) {
        await confirmHold();
      } else if (paymentMethod === 'RAZORPAY') {
        await handleLaunchRazorpay();
      } else if (balance < dueNow) {
        setStepError(
          t('amenity_booking_err_low_balance', 'Your wallet balance ({balance}) is less than the amount due now ({due}). Please top up.', {
            balance,
            due: dueNow,
          })
        );
        setIsTopUpOpen(true);
      } else {
        await confirmHold('WALLET');
      }
    } catch (err: any) {
      setStepError(err?.message || t('amenity_booking_err_confirm', 'Could not confirm the booking. Please try again.'));
    } finally {
      setPaying(false);
    }
  }, [activeHold?._id, isHoldExpired, dueNow, paymentMethod, balance, confirmHold, handleLaunchRazorpay, t]);

  const handleRazorpaySuccess = useCallback(
    async (payload: any) => {
      setIsRazorpayOpen(false);
      const isWalletTopUp = (razorpayOptions as any)?.isWalletTopUp;
      const paymentId = payload?.paymentId || razorpayOptions?.paymentId;
      const orderId = payload?.orderId || payload?.razorpayOrderId || razorpayOptions?.orderId;
      const razorpayPaymentId = payload?.razorpayPaymentId || payload?.razorpay_payment_id;
      const razorpaySignature = payload?.razorpaySignature || payload?.razorpay_signature;

      if (isWalletTopUp) {
        try {
          await dispatch(
            verifyWalletPayment({
              paymentData: { ...payload, paymentId, orderId, razorpayPaymentId, razorpaySignature, amount: razorpayOptions?.amount },
              idempotencyKey: paymentId && orderId ? buildWalletVerifyKey(paymentId, orderId) : undefined,
            })
          ).unwrap();
          await dispatch(fetchWalletBalance());
          setStepError(null);
        } catch (err: any) {
          setStepError(err?.message || t('amenity_booking_err_topup_verify', 'Wallet top-up could not be verified.'));
        }
        return;
      }

      setPaying(true);
      setStepError(null);
      try {
        const res = await amenityManagementService.verifyReservationPayment({
          paymentId,
          orderId,
          razorpayPaymentId,
          razorpaySignature,
        });
        const data: any = res.data;
        if (!data?.fulfilled || !data?.reservation) {
          setStepError(
            t('amenity_booking_err_late_payment', 'Your payment arrived after the hold ended, so it is being refunded to your card. Please book again.')
          );
          return;
        }
        const reservation = normalizeReservationFromApi(data.reservation);
        setGatewayReservation(reservation);
        dispatch(fetchPassesByReservationThunk(reservation._id));
        dispatch(resetV2BookingState());
        goToResult();
      } catch (err: any) {
        setStepError(err?.message || t('amenity_booking_err_verify', 'Your payment could not be verified. Check My Bookings before paying again.'));
      } finally {
        setPaying(false);
      }
    },
    [dispatch, razorpayOptions, goToResult, t]
  );

  const handleRazorpayDismiss = useCallback(() => {
    setIsRazorpayOpen(false);
    setRazorpayOptions(null);
  }, []);

  const handleTopUpSubmit = useCallback(
    async (amount: number) => {
      if (amount <= 0) return;
      setIsTopUpOpen(false);
      try {
        const orderData: any = await dispatch(
          createWalletRazorpayOrder({ amount, idempotencyKey: buildWalletOrderKey('amenity-topup', amount, operationIdRef.current) })
        ).unwrap();
        setRazorpayOptions({
          razorpayKeyId: orderData?.razorpayKeyId || orderData?.keyId || orderData?.key || '',
          orderId: orderData?.orderId || orderData?.id || '',
          paymentId: orderData?.paymentId || '',
          amount,
          currency: orderData?.currency || 'INR',
          description: t('amenity_booking_topup_desc', 'Digital wallet top-up'),
          isWalletTopUp: true,
        });
        setIsRazorpayOpen(true);
      } catch (err: any) {
        setStepError(err?.message || t('amenity_booking_err_topup', 'Could not start the wallet top-up.'));
      }
    },
    [dispatch, t]
  );

  const handleRestartBooking = useCallback(() => {
    operationIdRef.current = createOperationId();
    setGatewayReservation(null);
    setRazorpayOptions(null);
    setAvailabilityResult(null);
    dispatch(resetV2BookingState());
    setCurrentStepIndex(0);
    setStepError(null);
  }, [dispatch]);

  const displayReservation = gatewayReservation || v2CurrentReservation;
  const displayPasses: AmenityAccessPass[] = v2AccessPasses;
  const isPassEligible = useMemo(
    () => canDisplayAmenityAccessPass(displayReservation) && displayPasses.length > 0,
    [displayReservation, displayPasses]
  );

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
    availableDailySlots,
    loadingDailySlots,
    fetchDailySlots,
    selectedSlot,
    selectWindow,
    nights,
    setNights,
    loanDays,
    setLoanDays,
    maxLoanDays: maxLoanDays(facility),
    startUtcIso,
    endUtcIso,
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

    // Feedback
    availabilityResult,
    checkingAvailability,
    pricingSnapshot,
    calculatingPricing,
    stepError,
    setStepError,

    // Hold, payment & result
    activeHold,
    amountSchedule,
    dueNow,
    currency,
    holdRemainingSeconds,
    isHoldExpired,
    v2Holding,
    v2Confirming: v2Confirming || paying,
    v2CurrentReservation: displayReservation,
    v2AccessPasses: displayPasses,
    v2Error,
    isPassEligible,

    // Modals & gateway
    isCancelModalOpen,
    setIsCancelModalOpen,
    isTopUpOpen,
    setIsTopUpOpen,
    isRazorpayOpen,
    setIsRazorpayOpen,
    razorpayOptions,
    isRazorpayConfigured,
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
