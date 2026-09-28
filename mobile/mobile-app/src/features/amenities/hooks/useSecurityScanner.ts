import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../../store/store';
import { useAppSocket } from '../../../hooks/useAppSocket';
import {
  checkInPassThunk,
  checkOutPassThunk,
  collectBalancePaymentThunk,
  clearV2PassResults,
  clearCheckInResult,
  fetchRecentScansThunk,
} from '../store/amenityBookingSlice';
import { parseAndValidateAppBarcode } from '@/src/utils/appBarcodeProtocol';
import { useTranslation } from '@/src/utils/i18n';
import type { ScanResultData } from '@/components/hardware/ScanResultSheet';
import {
  AmenityAccessPass,
  AmenityCheckOutResult,
  AmenityErrorDetails,
} from '../types/amenityDomain.types';
import { formatAmenityAmount, formatUtcToLocalDisplay } from '../utils/amenityStateHelpers';
import type { ReturnInspection } from '../components/ReturnInspectionSheet';

export type ScanMode = 'CHECK_IN' | 'CHECK_OUT';

/** What the guard can do next with the scanned pass. */
export type GateAction = 'COLLECT_AND_ADMIT' | 'RECORD_EXIT' | 'DONE';

export interface UseSecurityScannerOptions {
  defaultMode?: ScanMode;
  gateId?: string;
}

/**
 * Safely extracts an amenity pass token or reference from QR or manual input.
 * Supports:
 * 1. Raw 64-character hexadecimal pass token
 * 2. Canonical MMG:AMENITY:<token> format
 * 3. Application barcode protocol (parseAndValidateAppBarcode)
 * 4. Backward-compatible JSON wrapper inspection (Web & Mobile legacy)
 * 5. Booking ID pattern (e.g. BKG-...) or Mongo ObjectId
 * Strictly avoids logging or persisting the token.
 */
export function extractRawPassToken(rawInput: string): string | null {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const trimmed = rawInput.trim();

  // 1. Direct 64-character hexadecimal token match
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Canonical MMG:AMENITY prefix (e.g. MMG:AMENITY:<token>)
  if (/^MMG:AMENITY:/i.test(trimmed)) {
    const token = trimmed.replace(/^MMG:AMENITY:/i, '').trim();
    if (token) return token;
  }

  // 3. Backward-compatible JSON wrapper inspection (Web & Mobile legacy)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        const candidate = String(
          parsed.passToken || parsed.rawToken || parsed.qrData || parsed.token || parsed.bookingId || parsed.id || ''
        ).trim();
        if (candidate) {
          return candidate;
        }
      }
    } catch {
      // Not valid JSON; fall through
    }
  }

  // 4. Manage-My-Gate application barcode protocol inspection (must be AMENITY or valid token/ID)
  const validation = parseAndValidateAppBarcode(trimmed);
  if (validation.isValid && validation.code) {
    if (
      validation.type === 'AMENITY' ||
      /^[0-9a-fA-F]{64}$/.test(validation.code) ||
      /^(RES|BKG|GYM|POOL|TEN|CLUB|BAD|BBALL|SQUASH|SPA|CINE)-[0-9A-Z_-]+$/i.test(validation.code) ||
      /^[A-Z]{2,6}-\d+$/i.test(validation.code) ||
      /^[0-9a-fA-F]{6}$/i.test(validation.code) ||
      /^\d{6}-\d{6}$/.test(validation.code) ||
      /^[0-9a-fA-F]{24}$/.test(validation.code)
    ) {
      return validation.code;
    }
  }

  // 5. Booking / Reservation pattern (e.g. RES-..., POOL-..., GYM-..., 6BBF46, 202609-000004) or Mongo ObjectId
  if (
    /^(RES|BKG|GYM|POOL|TEN|CLUB|BAD|BBALL|SQUASH|SPA|CINE)-[0-9A-Z_-]+$/i.test(trimmed) ||
    /^[A-Z]{2,6}-\d+$/i.test(trimmed) ||
    /^[0-9a-fA-F]{6}$/i.test(trimmed) ||
    /^\d{6}-\d{6}$/.test(trimmed) ||
    /^[0-9a-fA-F]{24}$/.test(trimmed)
  ) {
    return trimmed;
  }

  return null;
}

const detailsOf = (error: AmenityErrorDetails | null): Record<string, any> =>
  error && error.details && typeof error.details === 'object' && !Array.isArray(error.details) ? (error.details as any) : {};

export function useSecurityScanner(options: UseSecurityScannerOptions = {}) {
  const { gateId } = options;
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useTranslation();
  const { socket } = useAppSocket();

  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [isFlashlightOn, setIsFlashlightOn] = useState<boolean>(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState<boolean>(false);
  const [localScanError, setLocalScanError] = useState<string | null>(null);
  const [isInspectionOpen, setIsInspectionOpen] = useState<boolean>(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [collected, setCollected] = useState<{ amount: number; receiptNumber: string | null } | null>(null);
  const lastTokenRef = useRef<string | null>(null);

  const amenityBookingsState = useSelector(
    (state: RootState) => (state as any)?.amenityBookings || {}
  );

  const v2CheckInResult: AmenityAccessPass | null = amenityBookingsState?.v2CheckInResult || null;
  const v2CheckOutResult: AmenityCheckOutResult | null = amenityBookingsState?.v2CheckOutResult || null;
  const v2PassActionLoading: boolean = Boolean(amenityBookingsState?.v2PassActionLoading);
  const v2PassError: AmenityErrorDetails | null = amenityBookingsState?.v2PassError || null;
  const recentScans = amenityBookingsState?.recentScans || [];

  // Legacy compatibility aliases
  const checkInResult = v2CheckInResult || amenityBookingsState?.checkInResult || null;
  const checkingIn = v2PassActionLoading || Boolean(amenityBookingsState?.checkingIn);

  const loadRecentScans = useCallback(() => {
    dispatch(fetchRecentScansThunk({}));
  }, [dispatch]);

  useEffect(() => {
    loadRecentScans();
  }, [loadRecentScans]);

  // Real-time Socket.IO listener for live scanner updates
  useEffect(() => {
    if (!socket) return;

    const handleBookingUpdate = () => {
      loadRecentScans();
    };

    socket.on('bookingUpdated', handleBookingUpdate);
    socket.on('bookingCompleted', handleBookingUpdate);

    return () => {
      socket.off('bookingUpdated', handleBookingUpdate);
      socket.off('bookingCompleted', handleBookingUpdate);
    };
  }, [socket, loadRecentScans]);

  const toggleFlashlight = useCallback(() => {
    setIsFlashlightOn((prev) => !prev);
  }, []);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (v2PassActionLoading || !data) return;

      setIsScanning(false);
      setLocalScanError(null);
      setCollected(null);

      const rawToken = extractRawPassToken(data);
      if (!rawToken) {
        setLocalScanError('Invalid QR/pass format. Please scan a valid amenity access pass.');
        setIsResultModalOpen(true);
        return;
      }

      lastTokenRef.current = rawToken;
      await dispatch(checkInPassThunk({ rawToken, gateId }));
      setIsResultModalOpen(true);
      loadRecentScans();
    },
    [dispatch, v2PassActionLoading, gateId, loadRecentScans]
  );

  const errorCode = v2PassError?.code || detailsOf(v2PassError).code;
  const errorDetails = detailsOf(v2PassError);

  /** Next step the guard can take for the current result. */
  const nextAction: GateAction | null = useMemo(() => {
    if (localScanError) return null;
    if (v2PassError) {
      if (v2PassError.statusCode === 402 && errorCode === 'BALANCE_DUE' && errorDetails.reservationId) return 'COLLECT_AND_ADMIT';
      if (v2PassError.statusCode === 409 && errorCode === 'ALREADY_CHECKED_IN' && errorDetails.canCheckOut) return 'RECORD_EXIT';
      return null;
    }
    if (v2CheckOutResult || v2CheckInResult) return 'DONE';
    return null;
  }, [localScanError, v2PassError, errorCode, errorDetails, v2CheckOutResult, v2CheckInResult]);

  const recordExit = useCallback(
    async (inspection?: ReturnInspection) => {
      const rawToken = lastTokenRef.current;
      if (!rawToken) return;
      setInspectionError(null);
      try {
        await dispatch(
          checkOutPassThunk({
            rawToken,
            ...(inspection
              ? {
                  inspectionDetails: {
                    isDamaged: inspection.isDamaged,
                    damageNotes: inspection.damageNotes,
                    assessedPenaltyAmount: inspection.damageCharge,
                  },
                }
              : {}),
          })
        ).unwrap();
        setIsInspectionOpen(false);
        loadRecentScans();
      } catch (err: any) {
        // With the inspection sheet open the error belongs there; otherwise the result sheet shows it.
        if (inspection) setInspectionError(err?.message || t('amenity_gate_exit_failed', 'The exit could not be recorded.'));
      }
    },
    [dispatch, loadRecentScans, t]
  );

  const collectAndAdmit = useCallback(async () => {
    const rawToken = lastTokenRef.current;
    const reservationId = errorDetails.reservationId;
    const amount = Number(errorDetails.balanceAmount || 0);
    if (!rawToken || !reservationId || amount <= 0) return;
    try {
      const receipt = await dispatch(collectBalancePaymentThunk({ reservationId, amount })).unwrap();
      setCollected({ amount, receiptNumber: receipt.receiptNumber });
      dispatch(clearV2PassResults());
      await dispatch(checkInPassThunk({ rawToken, gateId }));
      loadRecentScans();
    } catch {
      // The rejected thunk leaves its error on v2PassError for the result sheet.
    }
  }, [dispatch, errorDetails, gateId, loadRecentScans]);

  const resetScanner = useCallback(() => {
    dispatch(clearV2PassResults());
    dispatch(clearCheckInResult());
    setLocalScanError(null);
    setIsResultModalOpen(false);
    setIsInspectionOpen(false);
    setInspectionError(null);
    setCollected(null);
    lastTokenRef.current = null;
    setIsScanning(true);
  }, [dispatch]);

  const runPrimaryAction = useCallback(async () => {
    if (nextAction === 'COLLECT_AND_ADMIT') return collectAndAdmit();
    if (nextAction === 'RECORD_EXIT') {
      if (errorDetails.requiresInspection) {
        setInspectionError(null);
        setIsInspectionOpen(true);
        return;
      }
      return recordExit();
    }
    return resetScanner();
  }, [nextAction, collectAndAdmit, recordExit, resetScanner, errorDetails.requiresInspection]);

  const primaryActionLabel = useMemo(() => {
    if (nextAction === 'COLLECT_AND_ADMIT') {
      return t('amenity_gate_collect_admit', 'Collect {amount} cash & admit', { amount: formatAmenityAmount(errorDetails.balanceAmount) });
    }
    if (nextAction === 'RECORD_EXIT') {
      return errorDetails.requiresInspection
        ? t('amenity_gate_inspect_return', 'Inspect & record return')
        : t('amenity_gate_record_exit', 'Record exit');
    }
    return t('amenity_gate_done', 'Done');
  }, [nextAction, errorDetails, t]);

  /** Result sheet content for the current scan. */
  const scanResult: ScanResultData | null = useMemo(() => {
    if (localScanError) {
      return { success: false, status: 'REJECTED', title: 'Invalid Pass Format', message: localScanError, passType: 'AMENITY PASS' };
    }

    if (v2CheckOutResult) {
      const deposit = v2CheckOutResult.deposit;
      const r = v2CheckOutResult.reservation;
      const details: { label: string; value: string }[] = [];
      if (deposit && deposit.paid > 0) {
        details.push({ label: t('amenity_gate_deposit_refunded', 'Deposit refunded'), value: formatAmenityAmount(deposit.refunded) });
        if (deposit.retained > 0) {
          details.push({ label: t('amenity_gate_deposit_kept', 'Deposit kept'), value: formatAmenityAmount(deposit.retained) });
        }
      }
      return {
        success: true,
        status: 'VERIFIED',
        statusLabel: t('amenity_gate_exit_label', 'EXIT RECORDED'),
        title: t('amenity_gate_exit_title', 'Exit recorded'),
        message: t('amenity_gate_exit_message', 'The booking is complete.'),
        passType: 'AMENITY ACCESS',
        visitorName: r?.userName,
        amenityName: r?.facilityName,
        bookingReference: r?.reservationNumber,
        details,
      };
    }

    if (v2PassError) {
      const code = v2PassError.statusCode;

      if (code === 402 && errorCode === 'BALANCE_DUE') {
        return {
          success: false,
          status: 'PENDING',
          statusLabel: t('amenity_gate_balance_label', 'BALANCE DUE'),
          title: t('amenity_gate_balance_title', 'Collect {amount} before entry', { amount: formatAmenityAmount(errorDetails.balanceAmount) }),
          message: t('amenity_gate_balance_message', 'Collect the balance in cash. Entry is recorded once it is paid.'),
          visitorName: errorDetails.residentName || undefined,
          passType: 'AMENITY PASS',
          amenityName: errorDetails.facilityName || undefined,
          bookingReference: errorDetails.reservationNumber || undefined,
        };
      }

      if (code === 409 && errorCode === 'ALREADY_CHECKED_IN' && errorDetails.canCheckOut) {
        const enteredAt = errorDetails.checkedInAt ? formatUtcToLocalDisplay(errorDetails.checkedInAt).formatted : '';
        return {
          success: false,
          status: 'PENDING',
          statusLabel: t('amenity_gate_inside_label', 'CHECKED IN'),
          title: t('amenity_gate_inside_title', 'Already checked in'),
          message: enteredAt
            ? t('amenity_gate_inside_message', 'Entered at {time}. Record the exit?', { time: enteredAt })
            : t('amenity_gate_inside_message_nt', 'This pass was used for entry. Record the exit?'),
          passType: 'AMENITY PASS',
          bookingReference: errorDetails.reservationNumber || undefined,
        };
      }

      let title = 'Verification Refused';
      let message = v2PassError.message || 'Pass verification failed.';

      if (code === 409) {
        title = 'Security Alert: Pass Replay Detected';
        message = v2PassError.message || 'This pass has already been used for entry.';
      } else if (code === 403) {
        if (
          v2PassError.code === 'PASS_REVOKED' ||
          v2PassError.reason === 'EMERGENCY_MAINTENANCE' ||
          v2PassError.message?.toLowerCase().includes('emergency') ||
          v2PassError.message?.toLowerCase().includes('evacuat')
        ) {
          title = 'EMERGENCY EVACUATION — ACCESS REVOKED';
          message = 'Facility is closed under emergency maintenance. Turnstile entry is strictly barred.';
        } else {
          title = 'Access Denied';
          message = v2PassError.message || 'Pass is revoked or outside its validity window.';
        }
      } else if (code === 404) {
        title = 'Pass Not Recognized';
        message = v2PassError.message || 'Invalid pass. This QR code is not recognized for this community.';
      } else if (code === 400) {
        title = 'Check-In Rejected';
        message = v2PassError.message || 'Pass validation failed.';
      }

      return { success: false, status: 'REJECTED', title, message, passType: 'AMENITY PASS' };
    }

    if (v2CheckInResult) {
      const validFromStr = formatUtcToLocalDisplay(v2CheckInResult.validFrom).formatted;
      const validUntilStr = formatUtcToLocalDisplay(v2CheckInResult.validUntil).formatted;
      const checkInStr = v2CheckInResult.checkInTimestamp
        ? formatUtcToLocalDisplay(v2CheckInResult.checkInTimestamp).formatted
        : 'Just now';
      const resident: any = v2CheckInResult.resident || {};
      const booking: any = v2CheckInResult.booking || {};
      const unitOrVilla =
        resident.unitNumber || resident.villaNumber || (v2CheckInResult.gateId ? `Gate: ${v2CheckInResult.gateId}` : 'Main Turnstile');
      const details: { label: string; value: string }[] = [];
      if (booking.headcount > 1) details.push({ label: t('amenity_gate_party', 'Party size'), value: String(booking.headcount) });
      if (collected) {
        details.push({
          label: t('amenity_gate_cash_collected', 'Cash collected'),
          value: collected.receiptNumber
            ? `${formatAmenityAmount(collected.amount)} · ${collected.receiptNumber}`
            : formatAmenityAmount(collected.amount),
        });
      }

      return {
        success: true,
        status: 'VERIFIED',
        title: 'Facility Entry Verified',
        message: 'Reservation pass is active and verified for facility entry.',
        visitorName: resident.name || 'Resident',
        visitorPhoto: resident.photoUrl || undefined,
        visitorPhone: resident.phone || undefined,
        passType: v2CheckInResult.passType || 'AMENITY ACCESS',
        amenityName: (v2CheckInResult as any).facility?.name || v2CheckInResult.facilityName || 'Community Facility',
        unitOrVilla,
        validityWindow: validFromStr && validUntilStr ? `${validFromStr} - ${validUntilStr}` : 'Active Window',
        entryTime: checkInStr,
        bookingReference: v2CheckInResult.passCode || booking.reservationNumber || v2CheckInResult.reservationId || 'N/A',
        details,
      };
    }

    return null;
  }, [localScanError, v2CheckOutResult, v2PassError, errorCode, errorDetails, v2CheckInResult, collected, t]);

  return {
    isScanning,
    isFlashlightOn,
    isResultModalOpen,
    v2CheckInResult,
    v2CheckOutResult,
    v2PassActionLoading,
    v2PassError,
    localScanError,
    checkInResult,
    checkingIn,
    recentScans,
    scanResult,
    nextAction,
    primaryActionLabel,
    runPrimaryAction,
    inspection: {
      visible: isInspectionOpen,
      depositAmount: Number(errorDetails.depositAmount || 0),
      reservationNumber: errorDetails.reservationNumber || null,
      error: inspectionError,
      onConfirm: (value: ReturnInspection) => recordExit(value),
      onClose: () => setIsInspectionOpen(false),
    },
    toggleFlashlight,
    handleBarCodeScanned,
    resetScanner,
    loadRecentScans,
  };
}

export default useSecurityScanner;
