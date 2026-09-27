import { useState, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../../store/store';
import { selectActiveOrgId } from '../../auth/store/authSelectors';
import { useVisitorSocket } from './useVisitorSocket';
import visitorService from '../services/visitorService';
import { ScanResultData } from '@/components/hardware/ScanResultSheet';
import { parseAndValidateAppBarcode } from '@/src/utils/appBarcodeProtocol';

export interface GuardRecentScan {
  id: string;
  visitorName: string;
  passType: string;
  unitOrVilla?: string;
  scanTime: string;
  status: 'VERIFIED' | 'REJECTED' | 'EXPIRED';
}

export function useGuardGateScanner() {
  const dispatch = useDispatch<AppDispatch>();
  const activeOrgId = useSelector(selectActiveOrgId);

  // Real-time visitor pass event socket listener
  useVisitorSocket();

  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [isFlashlightOn, setIsFlashlightOn] = useState<boolean>(false);
  const [isResultSheetOpen, setIsResultSheetOpen] = useState<boolean>(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState<boolean>(false);
  const [checkingIn, setCheckingIn] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [recentScans, setRecentScans] = useState<GuardRecentScan[]>([]);

  const toggleFlashlight = useCallback(() => {
    setIsFlashlightOn((prev) => !prev);
  }, []);

  const openManualEntry = useCallback(() => {
    setIsManualEntryOpen(true);
  }, []);

  const closeManualEntry = useCallback(() => {
    setIsManualEntryOpen(false);
  }, []);

  const handleBarCodeScanned = useCallback(
    async ({ type, data }: { type: string; data: string }) => {
      if (!isScanning || checkingIn || !data) return;

      setIsScanning(false);
      setCheckingIn(true);

      let lookupCode = data.trim();
      let passId = '';

      // 1. Validate & extract using canonical MMG barcode protocol
      const validation = parseAndValidateAppBarcode(data);
      if (validation.isValid) {
        if (validation.code) lookupCode = validation.code;
        if (validation.passId) passId = validation.passId;
      } else {
        // Fallback JSON payload check
        try {
          const parsed = JSON.parse(data);
          if (parsed.code || parsed.passCode) {
            lookupCode = parsed.code || parsed.passCode;
          }
          if (parsed._id || parsed.id || parsed.passId) {
            passId = parsed._id || parsed.id || parsed.passId;
          }
        } catch {
          // Raw string code or ID
        }
      }

      try {
        let passData: any = null;

        // 2. Fetch pass by code or ID
        // Strategy A: If passId is a valid 24-char ObjectId, fetch pass details directly
        if (passId && /^[0-9a-fA-F]{24}$/.test(passId)) {
          try {
            const res = await visitorService.getPassDetails(passId);
            const body = res && (res as any).success !== undefined ? res : (res as any)?.data;
            passData = body?.data || body;
          } catch {
            // Fall through to code search
          }
        }

        // Strategy B: If not found or no passId, search by pass code (e.g. 6-digit PIN)
        if (!passData && lookupCode) {
          try {
            const res = await visitorService.getPassByCode(lookupCode);
            const body = res && (res as any).success !== undefined ? res : (res as any)?.data;
            passData = body?.data || body;
          } catch {
            // Fall through to direct ID lookup if code search missed
          }
        }

        // Strategy C: If still not found and lookupCode is a 24-char ObjectId, try getPassDetails
        if (!passData && lookupCode && /^[0-9a-fA-F]{24}$/.test(lookupCode)) {
          try {
            const res = await visitorService.getPassDetails(lookupCode);
            const body = res && (res as any).success !== undefined ? res : (res as any)?.data;
            passData = body?.data || body;
          } catch {
            // Pass not found
          }
        }

        // 3. Evaluate verification status
        if (passData && (passData._id || passData.visitorName)) {
          const isRevoked = passData.status === 'REVOKED';
          const isExpired =
            passData.status === 'EXPIRED' ||
            (passData.validUntil && new Date(passData.validUntil).getTime() < Date.now());
          const requiresServerDecision = !isRevoked && !isExpired;

          const status: 'VERIFIED' | 'REJECTED' | 'EXPIRED' | 'PENDING' | 'REVOKED' = isRevoked
            ? 'REVOKED'
            : isExpired
            ? 'EXPIRED'
            : requiresServerDecision
            ? 'PENDING'
            : 'REJECTED';

          const formattedResult: ScanResultData = {
            success: false,
            status,
            title: requiresServerDecision ? 'Pass Located' : 'Visitor Access Denied',
            message: isRevoked
              ? 'Pass has been revoked by host resident or estate admin.'
              : isExpired
              ? 'Visitor pass has expired.'
              : requiresServerDecision
              ? 'Confirm entry to request the current server authorization decision.'
              : 'Pass is invalid or unrecognized.',
            visitorName: passData.visitorName || 'Guest Visitor',
            visitorPhone: passData.phone || passData.visitorPhone,
            visitorPhoto: passData.visitorPhoto || passData.photo,
            passType: passData.purpose || passData.passType || 'GUEST',
            unitOrVilla: passData.unit || passData.villaNumber || passData.flatNumber || 'Estate',
            hostName: passData.hostName || passData.residentName || 'Host Resident',
            bookingReference: passData.code || passData._id,
            validityWindow:
              passData.validFrom && passData.validUntil
                ? `${new Date(passData.validFrom).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} - ${new Date(passData.validUntil).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Today',
            metadata: {
              passId: passData._id,
              code: passData.code,
            },
          };

          setScanResult(formattedResult);
          setIsResultSheetOpen(true);

          // Add to recent scans preview (capped at 5)
          setRecentScans((prev) => [
            {
              id: passData._id || String(Date.now()),
              visitorName: formattedResult.visitorName || 'Visitor',
              passType: formattedResult.passType || 'GUEST',
              unitOrVilla: formattedResult.unitOrVilla,
              scanTime: new Date().toISOString(),
              status: requiresServerDecision ? 'VERIFIED' : isExpired ? 'EXPIRED' : 'REJECTED',
            },
            ...prev.slice(0, 4),
          ]);
        } else {
          // Unrecognized or invalid mock code fallback
          const fallbackResult: ScanResultData = {
            success: false,
            status: 'REJECTED',
            title: 'Unrecognized Pass Code',
            message: `No active pass found matching token "${lookupCode}".`,
            bookingReference: lookupCode,
            visitorName: 'Unknown Visitor',
            passType: 'UNVERIFIED',
          };
          setScanResult(fallbackResult);
          setIsResultSheetOpen(true);
        }
      } catch (err: any) {
        const errorResult: ScanResultData = {
          success: false,
          status: 'REJECTED',
          title: 'Verification Error',
          message: err?.message || 'Failed to verify visitor pass. Check network connection.',
        };
        setScanResult(errorResult);
        setIsResultSheetOpen(true);
      } finally {
        setCheckingIn(false);
      }
    },
    [isScanning, checkingIn]
  );

  const handleManualCodeSubmit = useCallback(
    (code: string) => {
      setIsManualEntryOpen(false);
      handleBarCodeScanned({ type: 'MANUAL', data: code });
    },
    [handleBarCodeScanned]
  );

  const handleConfirmGateEntry = useCallback(async () => {
    if (!scanResult?.metadata?.passId && !scanResult?.bookingReference) {
      resetScanner();
      return;
    }

    setCheckingIn(true);
    try {
      if (visitorService.processPreApproved) {
        await visitorService.processPreApproved({
          passId: scanResult?.metadata?.passId,
          code: scanResult?.bookingReference,
          orgId: activeOrgId,
          entryGate: 'Main Security Gate',
        });
      }
    } catch (err) {
      console.warn('Process pre-approved entry log error:', err);
    } finally {
      setCheckingIn(false);
      resetScanner();
    }
  }, [scanResult, activeOrgId]);

  const resetScanner = useCallback(() => {
    setIsResultSheetOpen(false);
    setScanResult(null);
    setIsScanning(true);
  }, []);

  return {
    isScanning,
    isFlashlightOn,
    isResultSheetOpen,
    isManualEntryOpen,
    checkingIn,
    scanResult,
    recentScans,
    toggleFlashlight,
    openManualEntry,
    closeManualEntry,
    handleBarCodeScanned,
    handleManualCodeSubmit,
    handleConfirmGateEntry,
    resetScanner,
  };
}

export default useGuardGateScanner;
