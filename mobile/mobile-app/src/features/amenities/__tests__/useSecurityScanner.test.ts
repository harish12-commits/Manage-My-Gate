/**
 * Amenity Management: Unified Single Security Scanner Tests
 * Verifies useSecurityScanner hook, raw token parsing, single turnstile check-in,
 * anti-replay handling, validity window guards, and static forensic single-scanner architecture.
 */

import { renderHook, act } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import {
  useSecurityScanner,
  extractRawPassToken,
} from '../hooks/useSecurityScanner';

// Test Token: 64 hexadecimal characters (256-bit entropy)
const VALID_RAW_TOKEN =
  '4e11d334e2c9e782635a968fd2a987d60910129bc48da7093217d84a7e93bd20';

let mockState: any = {
  amenityBookings: {
    v2CheckInResult: null,
    v2PassActionLoading: false,
    v2PassError: null,
    recentScans: [],
  },
};

const mockDispatch = jest.fn((action: any) => action);

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: any) => selector(mockState),
}));

const mockSocketOn = jest.fn();
const mockSocketOff = jest.fn();
const mockSocketEmit = jest.fn();

jest.mock('../../../hooks/useAppSocket', () => ({
  useAppSocket: () => ({
    socket: {
      on: mockSocketOn,
      off: mockSocketOff,
      emit: mockSocketEmit,
    },
  }),
}));

const mockCheckInPassThunk = jest.fn((payload: any) => ({
  type: 'amenityBookings/checkInPass',
  payload,
}));

const mockClearV2PassResults = jest.fn(() => ({
  type: 'amenityBookings/clearV2PassResults',
}));

const mockClearCheckInResult = jest.fn(() => ({
  type: 'amenityBookings/clearCheckInResult',
}));

const mockFetchRecentScansThunk = jest.fn((payload: any) => ({
  type: 'amenityBookings/fetchRecentScans',
  payload,
}));

jest.mock('../store/amenityBookingSlice', () => ({
  __esModule: true,
  checkInPassThunk: (payload: any) => mockCheckInPassThunk(payload),
  clearV2PassResults: () => mockClearV2PassResults(),
  clearCheckInResult: () => mockClearCheckInResult(),
  fetchRecentScansThunk: (payload: any) => mockFetchRecentScansThunk(payload),
}));

describe('Amenity Management: Unified Single Security Scanner Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState = {
      amenityBookings: {
        v2CheckInResult: null,
        v2PassActionLoading: false,
        v2PassError: null,
        recentScans: [],
      },
    };
  });

  // =========================================================================
  // Unit Tests for extractRawPassToken helper
  // =========================================================================
  describe('Raw Token Extraction & Validation', () => {
    it('passes a valid 64-character raw hex token unchanged', () => {
      const extracted = extractRawPassToken(VALID_RAW_TOKEN);
      expect(extracted).toBe(VALID_RAW_TOKEN);
      expect(extracted?.length).toBe(64);
    });

    it('extracts raw token from backward-compatible JSON wrapper { rawToken: "..." }', () => {
      const jsonWrapper = JSON.stringify({ rawToken: VALID_RAW_TOKEN });
      const extracted = extractRawPassToken(jsonWrapper);
      expect(extracted).toBe(VALID_RAW_TOKEN);
    });

    it('extracts raw token from backward-compatible JSON wrapper { qrData: "..." }', () => {
      const jsonWrapper = JSON.stringify({ qrData: VALID_RAW_TOKEN });
      const extracted = extractRawPassToken(jsonWrapper);
      expect(extracted).toBe(VALID_RAW_TOKEN);
    });

    it('extracts pass token from canonical MMG:AMENITY format', () => {
      const canonical = `MMG:AMENITY:${VALID_RAW_TOKEN}`;
      const extracted = extractRawPassToken(canonical);
      expect(extracted).toBe(VALID_RAW_TOKEN);
    });

    it('extracts booking token from legacy JSON with { bookingId: "..." } for cross-platform compatibility', () => {
      const legacyJson = JSON.stringify({
        bookingId: '67cb1a48f872c842b4059098',
        _id: '67cb1a48f872c842b4059098',
        code: 'BK-123456',
      });
      const extracted = extractRawPassToken(legacyJson);
      expect(extracted).toBe('67cb1a48f872c842b4059098');
    });

    it('extracts formatted resident passcode 202609-000004 and canonical RES-202609-000004', () => {
      expect(extractRawPassToken('202609-000004')).toBe('202609-000004');
      expect(extractRawPassToken('RES-202609-000004')).toBe('RES-202609-000004');
      expect(extractRawPassToken('  202609-000004  ')).toBe('202609-000004');
    });

    it('extracts letter and number amenity passcodes across various amenity types', () => {
      expect(extractRawPassToken('POOL-000004')).toBe('POOL-000004');
      expect(extractRawPassToken('GYM-000012')).toBe('GYM-000012');
      expect(extractRawPassToken('TEN-000007')).toBe('TEN-000007');
      expect(extractRawPassToken('CLUB-000003')).toBe('CLUB-000003');
      expect(extractRawPassToken('RES-000004')).toBe('RES-000004');
      expect(extractRawPassToken('6BBF46')).toBe('6BBF46');
    });

    it('rejects invalid/random string content and returns null', () => {
      expect(extractRawPassToken('')).toBeNull();
      expect(extractRawPassToken('random-malformed-string')).toBeNull();
      expect(
        extractRawPassToken(
          'not-a-hex-token-with-bad-chars-!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
        )
      ).toBeNull();
    });
  });

  // =========================================================================
  // Hook Behavior Tests (useSecurityScanner) - Single Unified Scanner
  // =========================================================================
  describe('useSecurityScanner Hook Lifecycle & Execution (Single Scanner)', () => {
    it('Test 1: Single scanner dispatches checkInPassThunk with { rawToken, gateId } and opens result modal', async () => {
      const { result } = await renderHook(() =>
        useSecurityScanner({ gateId: 'GATE-01' })
      );

      await act(async () => {
        await result.current.handleBarCodeScanned({
          type: 'CAMERA',
          data: VALID_RAW_TOKEN,
        });
      });

      expect(mockCheckInPassThunk).toHaveBeenCalledTimes(1);
      expect(mockCheckInPassThunk).toHaveBeenCalledWith({
        rawToken: VALID_RAW_TOKEN,
        gateId: 'GATE-01',
      });
      expect(result.current.isResultModalOpen).toBe(true);
      expect(result.current.localScanError).toBeNull();
    });

    it('Test 2: invalid QR sets local validation error and does NOT call backend thunk', async () => {
      const { result } = await renderHook(() => useSecurityScanner());

      await act(async () => {
        await result.current.handleBarCodeScanned({
          type: 'CAMERA',
          data: 'invalid-non-hex-qr-content',
        });
      });

      expect(mockCheckInPassThunk).not.toHaveBeenCalled();
      expect(result.current.localScanError).toMatch(/Invalid QR\/pass format/i);
      expect(result.current.isResultModalOpen).toBe(true);
    });

    it('Test 3: 409 Anti-Replay Conflict surfaces security error state', async () => {
      mockState = {
        amenityBookings: {
          v2CheckInResult: null,
          v2PassActionLoading: false,
          v2PassError: {
            statusCode: 409,
            message:
              'Anti-replay violation: pass was already used for check-in at 2026-09-10T14:00:00.000Z',
          },
          recentScans: [],
        },
      };

      const { result } = await renderHook(() => useSecurityScanner());
      expect(result.current.v2PassError?.statusCode).toBe(409);
      expect(result.current.v2PassError?.message).toMatch(/Anti-replay violation/i);
    });

    it('Test 4: 403 Validity Window / Revocation surfaces access denied error state', async () => {
      mockState = {
        amenityBookings: {
          v2CheckInResult: null,
          v2PassActionLoading: false,
          v2PassError: {
            statusCode: 403,
            message: 'Access denied: pass is outside its validity window',
          },
          recentScans: [],
        },
      };

      const { result } = await renderHook(() => useSecurityScanner());
      expect(result.current.v2PassError?.statusCode).toBe(403);
      expect(result.current.v2PassError?.message).toMatch(/Access denied/i);
    });

    it('Test 5: resetScanner clears Redux V2 pass results and local modal states', async () => {
      const { result } = await renderHook(() => useSecurityScanner());

      await act(async () => {
        result.current.resetScanner();
      });

      expect(mockClearV2PassResults).toHaveBeenCalledTimes(1);
      expect(mockClearCheckInResult).toHaveBeenCalledTimes(1);
      expect(result.current.isResultModalOpen).toBe(false);
      expect(result.current.isScanning).toBe(true);
      expect(result.current.localScanError).toBeNull();
    });

    it('Test 6: toggleFlashlight toggles flashlight state', async () => {
      const { result } = await renderHook(() => useSecurityScanner());
      expect(result.current.isFlashlightOn).toBe(false);

      await act(async () => {
        result.current.toggleFlashlight();
      });
      expect(result.current.isFlashlightOn).toBe(true);

      await act(async () => {
        result.current.toggleFlashlight();
      });
      expect(result.current.isFlashlightOn).toBe(false);
    });

    it('Test 7: loads recent scans on mount', async () => {
      await act(async () => {
        renderHook(() => useSecurityScanner());
      });
      expect(mockFetchRecentScansThunk).toHaveBeenCalledWith({});
    });
  });

  // =========================================================================
  // Static Forensic Verification: Unified Single Scanner Architecture
  // =========================================================================
  describe('Static Forensic Verification: Unified Single Scanner Architecture', () => {
    const scannerPath = path.resolve(
      __dirname,
      '../../../../app/(resident)/amenities/scanner.tsx'
    );
    const hookPath = path.resolve(__dirname, '../hooks/useSecurityScanner.ts');

    it('verifies useSecurityScanner.ts does NOT import or call checkInBookingThunk or amenityService.checkInBooking', () => {
      const hookContent = fs.readFileSync(hookPath, 'utf8');

      expect(hookContent).not.toMatch(/checkInBookingThunk/);
      expect(hookContent).not.toMatch(/amenityService\.checkInBooking/);
      expect(hookContent).not.toMatch(/\/api\/v1\/amenity-bookings/);
      expect(hookContent).toMatch(/checkInPassThunk/);
    });

    it('verifies scanner.tsx only gates access and the console has a single scan flow (no mode tabs, no log deletion)', () => {
      const scannerContent = fs.readFileSync(scannerPath, 'utf8');
      const consoleContent = fs.readFileSync(path.resolve(__dirname, '../components/AmenityGateConsole.tsx'), 'utf8');

      expect(scannerContent).toMatch(/<AmenityGateConsole \/>/);
      expect(scannerContent).not.toMatch(/useSecurityScanner/);
      expect(consoleContent).not.toMatch(/SCAN_MODE_TABS/);
      // Exit is offered by the server's answer to a scan (ALREADY_CHECKED_IN), not by a mode switch.
      expect(consoleContent).toMatch(/runPrimaryAction/);
      expect(consoleContent).not.toMatch(/onDelete=/);
    });
  });
});
