import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Badge } from 'src/components/ui/badge';
import {
  Camera,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  Ban,
  Search,
  Eye,
  ShieldCheck,
  Building,
  Car,
  AlertTriangle
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { fetchPassByCode, getPassDetails } from '../store/visitorPassSlice.js';

export const GuardScannerConsole = ({ passes, liveEntries, onCheckInSuccess, onCheckOutSuccess }) => {
  const [scannerMode, setScannerMode] = useState('camera'); // 'camera' | 'search'
  
  // Scanned / Selected Pass State
  const [matchedPass, setMatchedPass] = useState(null);
  const [typedCode, setTypedCode] = useState('');

  const dispatch = useDispatch();
  const activeOrgId = useSelector((state) => state.workspace?.activeOrganizationId);

  // Web Camera scanning states and references
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const isScanningRef = useRef(false);
  const lastScannedCodeRef = useRef({ code: '', time: 0 });

  useEffect(() => {
    let html5QrCode = null;
    
    if (scannerMode === 'camera') {
      setCameraActive(false);
      setCameraError('');

      // Create a small delay to make sure the div #qr-reader is mounted in the DOM
      const timer = setTimeout(() => {
        const element = document.getElementById('qr-reader');
        if (!element) return;
        
        try {
          html5QrCode = new Html5Qrcode('qr-reader');
          
          html5QrCode.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.85;
                return { width: Math.max(300, size), height: Math.max(300, size) };
              },
              formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
            },
            (decodedText) => {
              const now = Date.now();
              // Prevent duplicate scanning (within 3 seconds)
              if (lastScannedCodeRef.current.code === decodedText && now - lastScannedCodeRef.current.time < 3000) {
                return;
              }
              lastScannedCodeRef.current = { code: decodedText, time: now };
              toast.success('QR Code scanned successfully!');
              handleVerifyCode(decodedText);
            },
            (errorMessage) => {
              // Frame failures can be ignored
            }
          )
          .then(() => {
            isScanningRef.current = true;
            setCameraActive(true);
            setCameraError('');
          })
          .catch((err) => {
            console.error('Failed to start camera scanner:', err);
            setCameraError('Webcam access failed. Check device permissions.');
            setCameraActive(false);
            isScanningRef.current = false;
          });
        } catch (e) {
          console.error('Html5Qrcode initialization error:', e);
          setCameraError('Scanner init failed. Use mock selection below.');
          setCameraActive(false);
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (html5QrCode) {
          if (isScanningRef.current) {
            isScanningRef.current = false;
            html5QrCode.stop()
              .then(() => {
                setCameraActive(false);
              })
              .catch((err) => {
                console.error('Error stopping scanner during cleanup:', err);
              });
          }
        }
      };
    } else {
      setCameraActive(false);
      setCameraError('');
    }
  }, [scannerMode]);

  // Check if pass dates and times are active
  const isPassDateActive = (pass) => {
    if (!pass || !pass.validity) return false;
    const now = new Date();
    const start = new Date(pass.validity.startDate);
    const end = new Date(pass.validity.endDate);
    
    // Check Date Range
    if (now < start || now > end) return false;
    
    // Check Time Window
    if (pass.validity.timeWindowStart && pass.validity.timeWindowEnd) {
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      if (currentTimeStr < pass.validity.timeWindowStart || currentTimeStr > pass.validity.timeWindowEnd) {
        return false;
      }
    }
    
    // Check Allowed Days
    if (pass.validity.allowedDays && pass.validity.allowedDays.length > 0) {
      const currentDay = now.getDay();
      if (!pass.validity.allowedDays.includes(currentDay)) {
        return false;
      }
    }
    
    return true;
  };

  // Perform search / verify logic
  const handleVerifyCode = async (code) => {
    if (!code || !code.trim()) {
      toast.error('Please enter or select a valid pass code.');
      return;
    }

    const cleaned = code.trim().toLowerCase();
    let found = null;
    
    // 1. Direct database fetches for exact keys/IDs
    if (/^\d{6}$/.test(cleaned) && activeOrgId) {
      try {
        toast.loading('Fetching pass code from database...', { id: 'fetch-code-task' });
        const prefixedCode = `${activeOrgId}_${cleaned}`;
        const pass = await dispatch(fetchPassByCode(prefixedCode)).unwrap();
        found = pass;
        toast.success('Pass details loaded successfully!', { id: 'fetch-code-task' });
      } catch (err) {
        toast.error(err.message || 'No matching active visitor pass found for this code.', { id: 'fetch-code-task' });
      }
    } else if (/^[0-9a-fA-F]{24}$/.test(cleaned)) {
      try {
        toast.loading('Fetching pass details from database...', { id: 'fetch-code-task' });
        const pass = await dispatch(getPassDetails(code)).unwrap();
        found = pass;
        toast.success('Pass details loaded successfully!', { id: 'fetch-code-task' });
      } catch (err) {
        toast.error(err.message || 'No matching visitor pass found.', { id: 'fetch-code-task' });
      }
    } else {
      // 2. Fall back to local search in memory
      found = passes.find(p => 
        p.id?.toLowerCase() === cleaned || 
        p._id?.toLowerCase() === cleaned ||
        p.visitorDetails?.name?.toLowerCase().includes(cleaned) ||
        p.visitorName?.toLowerCase().includes(cleaned) ||
        p.vehicleDetails?.number?.toLowerCase().includes(cleaned) ||
        p.vehicleNumber?.toLowerCase().includes(cleaned) ||
        p.visitorDetails?.phone?.includes(cleaned) ||
        p.visitorDetails?.idProofNumber?.toLowerCase().includes(cleaned) ||
        p.details?.toLowerCase().includes(cleaned)
      );

      if (!found) {
        const matchedActiveLog = liveEntries.find(entry => 
          !entry.passId && (
            entry.visitorName?.toLowerCase().includes(cleaned) ||
            entry.vehicleNumber?.toLowerCase().includes(cleaned) ||
            entry.idProofNumber?.toLowerCase().includes(cleaned) ||
            entry.villa?.toLowerCase().includes(cleaned) ||
            entry.resident?.toLowerCase().includes(cleaned)
          )
        );
        if (matchedActiveLog) {
          found = {
            id: matchedActiveLog.id,
            _id: matchedActiveLog.id,
            passType: 'WALK_IN',
            status: 'ACTIVE',
            visitorName: matchedActiveLog.visitorName,
            visitorDetails: { 
              name: matchedActiveLog.visitorName,
              idProofNumber: matchedActiveLog.idProofNumber
            },
            vehicleDetails: { number: matchedActiveLog.vehicleNumber },
            isWalkInLog: true
          };
        }
      }
    }

    if (found) {
      setMatchedPass(found);
      const isInside = isVisitorCurrentlyInside(found);
      if (isInside) {
        toast.success(`Pass verified! Resident host currently inside.`);
      } else {
        const isStatusActive = ['ACTIVE', 'Active', 'PENDING', 'Pending'].includes(found.status);
        const isDateActive = isPassDateActive(found);

        if (isStatusActive && isDateActive) {
          toast.success(`Pass verified! Access Approved for ${found.visitorName || found.visitorDetails?.name}.`);
        } else if (!isDateActive) {
          toast.error(`Access Blocked: Pass validity date range is not currently active.`);
        } else {
          toast.error(`Pass Status is ${found.status}. Access Blocked.`);
        }
      }
    } else if (!/^\d{6}$/.test(cleaned) && !/^[0-9a-fA-F]{24}$/.test(cleaned)) {
      setMatchedPass(null);
      toast.error('Invalid pass: No matching pre-approved invitation found.');
    }
  };

  // Check if visitor is inside
  const isVisitorCurrentlyInside = (pass) => {
    if (!pass) return false;
    if (pass.isWalkInLog) return true;
    const passIdStr = (pass._id || pass.id)?.toString();
    return liveEntries.some(entry => {
      const entryPassId = (entry.passId?._id || entry.passId || entry.passIdId)?.toString();
      return entryPassId === passIdStr;
    });
  };

  // Find active log ID for checkout
  const getActiveLogId = (pass) => {
    if (!pass) return null;
    if (pass.isWalkInLog) return pass.id || pass._id;
    const passIdStr = (pass._id || pass.id)?.toString();
    const matched = liveEntries.find(entry => {
      const entryPassId = (entry.passId?._id || entry.passId || entry.passIdId)?.toString();
      return entryPassId === passIdStr;
    });
    return matched ? matched.id || matched._id : null;
  };

  const [isLoading, setIsLoading] = useState(false);

  // Actions
  const handleCheckIn = async () => {
    if (!matchedPass || isLoading) return;
    setIsLoading(true);
    const success = await onCheckInSuccess({
      passId: matchedPass._id || matchedPass.id,
      visitorName: matchedPass.visitorName || matchedPass.visitorDetails?.name,
      type: matchedPass.passType || matchedPass.method || 'GUEST',
      villa: 'Villa 101',
      resident: 'Resident Host',
      checkIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'INSIDE',
      guard: 'Officer Ramesh'
    });
    setIsLoading(false);
    if (success) {
      setMatchedPass(null);
      setTypedCode('');
    }
  };

  const handleCheckOut = async () => {
    if (!matchedPass || isLoading) return;
    const logId = getActiveLogId(matchedPass);
    if (logId) {
      setIsLoading(true);
      const success = await onCheckOutSuccess(logId);
      setIsLoading(false);
      if (success) {
        setMatchedPass(null);
        setTypedCode('');
      }
    } else {
      toast.error('Failed to locate live entry log for checkout.');
    }
  };

  const activePasses = passes.filter(p => p.status === 'ACTIVE' || p.status === 'Active' || p.status === 'PENDING' || p.status === 'Pending');

  const isGroupPass = matchedPass && (
    matchedPass.isGroupPass === true ||
    (matchedPass.passType?.toUpperCase() === 'GUEST' && matchedPass.usageLimit?.maxUses > 2)
  );
  
  const isVisitorInside = matchedPass && isVisitorCurrentlyInside(matchedPass);

  const isInside = matchedPass && (
    isVisitorInside ||
    (!isGroupPass && (
      matchedPass.isInside ||
      matchedPass.activeEntryExists ||
      ['CHECKED_IN', 'Checked-in', 'IN_PREMISES', 'Inside', 'INSIDE'].includes(matchedPass.status)
    ))
  );

  const isOutOfUses = matchedPass && matchedPass.usageLimit?.maxUses && matchedPass.usageLimit.currentUses >= matchedPass.usageLimit.maxUses;
  const isExpiredOrRevoked = matchedPass && (
    isGroupPass 
      ? (['REVOKED', 'Revoked'].includes(matchedPass.status) || !isPassDateActive(matchedPass) || (isOutOfUses && !isVisitorInside))
      : (!isInside && (
          ['EXPIRED', 'Expired', 'REVOKED', 'Revoked', 'COMPLETED', 'Completed'].includes(matchedPass.status) || 
          isOutOfUses ||
          !isPassDateActive(matchedPass)
        ))
  );

  const showCheckIn = matchedPass && !isExpiredOrRevoked && (
    isGroupPass 
      ? (matchedPass.usageLimit.currentUses < matchedPass.usageLimit.maxUses) 
      : !isInside
  );

  const showCheckOut = matchedPass && (
    isGroupPass 
      ? isVisitorInside 
      : isInside
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Left Box: Scanner / Type Selector Console */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark min-h-[380px] flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-4 mb-6">
            <h3 className="text-base font-bold flex items-center gap-2 text-black dark:text-white">
              <Camera className="h-4.5 w-4.5 text-primary shrink-0" />
              <span>Security Gate Scanner Console</span>
            </h3>
            
            <div className="flex gap-1.5">
              <Button 
                variant={scannerMode === 'camera' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setScannerMode('camera'); setMatchedPass(null); }}
                className="text-2xs font-semibold h-8 border-stroke dark:border-strokedark text-black dark:text-white"
              >
                Scan QR Code
              </Button>
              <Button 
                variant={scannerMode === 'search' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setScannerMode('search'); setMatchedPass(null); }}
                className="text-2xs font-semibold h-8 border-stroke dark:border-strokedark text-black dark:text-white"
              >
                Search / Type Code
              </Button>
            </div>
          </div>

          {scannerMode === 'camera' ? (
            /* Mode 1: Active Web Camera Scanner with Simulator Fallback */
            <div className="flex flex-col items-center justify-center space-y-4">
              <style>{`
                #qr-reader video {
                  width: 100% !important;
                  height: 100% !important;
                  object-fit: cover !important;
                  border-radius: 12px;
                }
              `}</style>
              
              <div className="relative w-60 h-60 border-4 border-primary rounded-2xl bg-slate-950 flex items-center justify-center overflow-hidden shadow-default shrink-0">
                {cameraActive && !cameraError && <div className="scanner-glow-line" />}
                
                <div id="qr-reader" className="absolute inset-0 w-full h-full" />

                {(!cameraActive || cameraError) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-slate-900 text-gray-400 z-10 space-y-2">
                    {cameraError ? (
                      <>
                        <AlertTriangle className="h-10 w-10 text-red-500 mb-1" />
                        <div className="text-[10px] font-bold text-red-500 uppercase">CAMERA BLOCKED</div>
                        <div className="text-[9px] leading-relaxed max-w-xs">{cameraError}</div>
                      </>
                    ) : (
                      <>
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent mb-1" />
                        <div className="text-[10px] font-bold tracking-wider">STARTING CAMERA...</div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Simulated camera select trigger for testing and fallback */}
              <div className="w-full max-w-xs space-y-1.5">
                <select
                  onChange={(e) => handleVerifyCode(e.target.value)}
                  className="w-full rounded border border-stroke bg-transparent py-2 px-3 text-xs outline-none transition focus:border-primary active:border-primary dark:border-strokedark dark:bg-meta-4 text-black dark:text-white"
                >
                  <option value="" className="bg-white dark:bg-boxdark">-- Choose QR to Mock Scan --</option>
                  {activePasses.map(p => (
                    <option key={p._id || p.id} value={p._id || p.id} className="bg-white dark:bg-boxdark">
                      {p.visitorName || p.visitorDetails?.name} ({p.id || p._id?.substring(0,6)})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-normal">
                  Choose a pass from the list to mock a camera scan detection if no camera is connected.
                </p>
              </div>

            </div>
          ) : (
            /* Mode 2: Search/Type ID Details - Auto-submit on Enter keypress */
            <form onSubmit={(e) => { e.preventDefault(); handleVerifyCode(typedCode); }} className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Enter Visitor Details / Pass Code / QR number
                </Label>
                <div className="flex gap-2">
                  <Input 
                    type="text" 
                    placeholder="e.g. G-10029, Alice, Robert" 
                    value={typedCode}
                    onChange={(e) => setTypedCode(e.target.value)}
                    className="text-xs bg-white dark:bg-meta-4 border-stroke dark:border-strokedark text-black dark:text-white"
                  />
                  <Button 
                    type="submit"
                    variant="default"
                    size="sm"
                    className="text-xs font-bold whitespace-nowrap"
                  >
                    Verify Pass
                  </Button>
                </div>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400 bg-slate-50 dark:bg-meta-4/20 p-3 rounded-lg border border-stroke dark:border-strokedark leading-relaxed">
                <strong className="text-black dark:text-white font-bold block mb-1">How to Verify:</strong>
                Type the Guest's Name, QR Code string (e.g. `G-10029`), or vehicle number to manually lookup active gate tickets.
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Right Box: Scanned Code Details Summary */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark min-h-[380px] flex flex-col justify-between">
        {matchedPass ? (
          <div className="flex flex-col h-full justify-between flex-1">
            
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-black dark:text-white">
                Pass Verification Results
              </h4>

              {/* Status Header Banner */}
              <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center space-y-1.5 ${
                isExpiredOrRevoked 
                  ? 'bg-red-50/20 dark:bg-red-950/10 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400' 
                  : isInside 
                    ? 'bg-blue-50/20 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900/30 text-blue-700 dark:text-blue-400' 
                    : 'bg-green-50/20 dark:bg-green-950/10 border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-400'
              }`}>
                {isExpiredOrRevoked ? (
                  <>
                    <XCircle className="h-8 w-8 text-red-500 mb-1" />
                    <div className="font-extrabold text-sm uppercase">ACCESS DENIED</div>
                    <p className="text-[10px] opacity-80 leading-normal">Pass Invalid or Expired. Access blocked at gate.</p>
                  </>
                ) : isInside ? (
                  <>
                    <LogIn className="h-8 w-8 text-blue-500 mb-1" />
                    <div className="font-extrabold text-sm uppercase">CURRENTLY INSIDE</div>
                    <p className="text-[10px] opacity-80 leading-normal">Awaiting exit check-out.</p>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-8 w-8 text-green-500 mb-1" />
                    <div className="font-extrabold text-sm uppercase">ACCESS APPROVED</div>
                    <p className="text-[10px] opacity-80 leading-normal">Pass is active. Ready for Entry.</p>
                  </>
                )}
              </div>

              {/* Detail fields */}
              <div className="divide-y divide-stroke dark:divide-strokedark text-xs">
                <div className="flex justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">Visitor:</span>
                  <strong className="text-black dark:text-white font-bold">{matchedPass.visitorName || matchedPass.visitorDetails?.name}</strong>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">Ticket Type:</span>
                  <strong className="text-black dark:text-white font-bold capitalize">
                    {matchedPass.passType || matchedPass.method || 'GUEST'}
                  </strong>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">Plate No:</span>
                  <strong className="text-black dark:text-white font-bold">
                    {matchedPass.vehicleNumber || matchedPass.vehicleDetails?.number || '—'}
                  </strong>
                </div>
                {matchedPass.usageLimit && matchedPass.usageLimit.maxUses > 1 && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-500 dark:text-gray-400">
                      {isGroupPass ? 'Group Code Entries:' : 'Pass Entries Used:'}
                    </span>
                    <strong className="text-black dark:text-white font-bold">
                      {matchedPass.usageLimit.currentUses || 0} / {matchedPass.usageLimit.maxUses}
                    </strong>
                  </div>
                )}
                <div className="flex justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>
                  <strong className={`font-bold ${
                    isExpiredOrRevoked 
                      ? 'text-red-500' 
                      : isInside 
                        ? 'text-blue-500' 
                        : 'text-green-500'
                  }`}>
                    {matchedPass.status}
                  </strong>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6">
              {showCheckIn && showCheckOut ? (
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    variant="default"
                    onClick={handleCheckIn}
                    disabled={isLoading}
                    className="w-full text-xs font-bold py-3 bg-success hover:bg-success/90 border-0 flex items-center justify-center gap-1.5 text-white"
                  >
                    <LogIn className="h-4 w-4" />
                    Check-In Guest
                  </Button>
                  <Button 
                    variant="default"
                    onClick={handleCheckOut}
                    disabled={isLoading}
                    className="w-full text-xs font-bold py-3 bg-warning hover:bg-warning/90 border-0 flex items-center justify-center gap-1.5 text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    Check-Out Guest
                  </Button>
                </div>
              ) : showCheckIn ? (
                <Button 
                  variant="default"
                  onClick={handleCheckIn}
                  disabled={isLoading}
                  className="w-full text-xs font-bold py-3 bg-success hover:bg-success/90 border-0 flex items-center justify-center gap-1.5 text-white"
                >
                  <LogIn className="h-4 w-4" />
                  {isLoading ? 'Processing check-in...' : 'Confirm Gate Check-In'}
                </Button>
              ) : showCheckOut ? (
                <Button 
                  variant="default"
                  onClick={handleCheckOut}
                  disabled={isLoading}
                  className="w-full text-xs font-bold py-3 bg-warning hover:bg-warning/90 border-0 flex items-center justify-center gap-1.5 text-white"
                >
                  <LogOut className="h-4 w-4" />
                  {isLoading ? 'Processing checkout...' : 'Confirm Gate Check-Out'}
                </Button>
              ) : (
                <Button 
                  disabled
                  className="w-full text-xs font-bold py-3 bg-slate-200 dark:bg-meta-4 text-gray-400 dark:text-gray-600 border-0 flex items-center justify-center gap-1.5 cursor-not-allowed"
                >
                  <Ban className="h-4 w-4" />
                  Gate Access Blocked / Expired
                </Button>
              )}
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-grow text-gray-400 dark:text-gray-500 text-center p-6 space-y-3">
            <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-1" />
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400">No Pass Loaded</h4>
            <p className="text-[10px] text-gray-400 leading-normal max-w-[200px]">Scan QR or type a verification code to inspect ticket credentials.</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default GuardScannerConsole;
