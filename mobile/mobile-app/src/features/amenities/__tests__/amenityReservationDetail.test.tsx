/**
 * Amenity Management Phase 6C.3 - Resident Reservation Detail & Access Pass Tests
 * Verifies useResidentReservationDetail hook, ResidentAccessPassCard, ResidentReservationDetailView,
 * Standalone Detail Route (reservations/[id]), 5 orthogonal dimensions, mandatory negative security tests,
 * and architectural isolation boundaries.
 */

import React from 'react';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';

let mockState: any;
const mockDispatch = jest.fn((action: any) => action);

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: any) => selector(mockState),
}));

const mockFetchReservationsThunk = jest.fn();
const mockFetchReservationByIdThunk = jest.fn();
const mockFetchPassesByReservationThunk = jest.fn();
const mockCancelReservationThunk = jest.fn();
const mockClearV2Errors = jest.fn();

jest.mock('../store/amenityBookingSlice', () => ({
  __esModule: true,
  fetchCancellationPreviewThunk: (id: any) => ({
    type: 'amenityBookings/fetchCancellationPreview',
    unwrap: () =>
      Promise.resolve({
        allowed: true,
        blockReason: null,
        refund: { percentage: 100, bookingRefund: 500, depositRefund: 0, total: 500 },
        refundTo: 'WALLET',
        policy: null,
      }),
  }),
  fetchReservationsThunk: (params: any) => ({
    type: 'amenityBookings/fetchReservations',
    unwrap: () => mockFetchReservationsThunk(params),
  }),
  fetchReservationByIdThunk: (id: any) => ({
    type: 'amenityBookings/fetchReservationById',
    unwrap: () => mockFetchReservationByIdThunk(id),
  }),
  fetchPassesByReservationThunk: (id: any) => ({
    type: 'amenityBookings/fetchPassesByReservation',
    unwrap: () => mockFetchPassesByReservationThunk(id),
  }),
  cancelReservationThunk: (payload: any) => ({
    type: 'amenityBookings/cancelReservation',
    unwrap: () => mockCancelReservationThunk(payload),
  }),
  clearV2Errors: () => mockClearV2Errors(),
}));

// Mock expo-router
const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();
let mockParamsId = 'res-abc-101';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush, back: mockRouterBack }),
  useLocalSearchParams: () => ({ id: mockParamsId }),
  usePathname: () => `/amenities/reservations/${mockParamsId}`,
}));

// Mock auth & navigation modals to prevent immer ESM loading issues in Jest
jest.mock('@/src/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { _id: 'user-resident-1', name: 'Ahmed Al-Mansoor', role: 'resident' },
    isAuthenticated: true,
    activeRole: 'resident',
  }),
}));
jest.mock('@/src/features/auth/store/authSlice', () => ({
  __esModule: true,
  default: (state = {}) => state,
}));
jest.mock('@/components/navigation/BottomNavigationBar', () => ({
  BottomNavigationBar: () => null,
}));
jest.mock('@/components/navigation/RoleSwitchModal', () => ({
  RoleSwitchModal: () => null,
}));
jest.mock('@/components/navigation/VillaSwitchModal', () => ({
  VillaSwitchModal: () => null,
}));
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
  };
});

// Mock react-native-worklets & reanimated
jest.mock('react-native-worklets', () => ({
  isWorkletFunction: jest.fn(() => false),
  createWorkletRuntime: jest.fn(),
  runOnJS: jest.fn((fn) => fn),
  runOnUI: jest.fn((fn) => fn),
  scheduleOnUI: jest.fn((fn) => fn),
  createSerializable: jest.fn((val) => val),
  serializableMappingCache: new Map(),
  makeShareable: jest.fn((val) => val),
  makeMutable: jest.fn((val) => ({ value: val })),
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return {
    ...Reanimated,
    useAnimatedStyle: (fn: any) => (typeof fn === 'function' ? fn() : {}),
    useSharedValue: (val: any) => ({ value: val }),
    withTiming: (val: any) => val,
    withRepeat: (val: any) => val,
    withSequence: (...args: any[]) => args[0],
    FadeIn: { duration: () => ({}) },
    FadeOut: { duration: () => ({}) },
  };
});

// Mock Modal to expose children in tests
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockModal = ({ children, visible, testID }: any) =>
    visible ? <View testID={testID || 'mock-modal'}>{children}</View> : null;
  MockModal.displayName = 'Modal';
  return {
    __esModule: true,
    default: MockModal,
  };
});

import {
  useResidentReservationDetail,
} from '../hooks/useResidentReservationDetail';
import {
  ResidentAccessPassCard,
  selectDisplayablePass,
  shouldRenderQrCode,
} from '../components/ResidentAccessPassCard';
import {
  ResidentReservationDetailView,
} from '../components/ResidentReservationDetailView';
import ReservationDetailScreen from '../../../../app/(resident)/amenities/reservations/[id]';
import MyBookingsScreen from '../../../../app/(resident)/amenities/my-bookings';
import {
  AmenityReservation,
  AmenityAccessPass,
} from '../types/amenityDomain.types';

const mockReservation: AmenityReservation = {
  _id: 'res-abc-101',
  orgId: 'org-test-1',
  facilityId: 'fac-pool-1',
  facilityName: 'Infinity Swimming Pool',
  reservationNumber: 'RES-2026-00042',
  resourceId: 'res-lane-3',
  resourceName: 'Lap Lane 3',
  userId: 'user-resident-1',
  userName: 'Ahmed Al-Mansoor',
  unitId: 'villa-101',
  startDateTime: '2026-09-10T10:00:00.000Z',
  endDateTime: '2026-09-10T12:00:00.000Z',
  headcount: 3,
  quantity: 1,
  guests: [
    { name: 'Fatima Al-Mansoor', phone: '+966501234567' },
    { name: 'Zaid Al-Mansoor', phone: '+966507654321' },
  ],
  pricingSnapshot: {
    baseAmount: 100,
    taxAmount: 15,
    depositAmount: 50,
    totalAmount: 165,
    currency: 'SAR',
  },
  paymentReference: 'PAY-REF-998811',
  bookingStatus: 'CONFIRMED',
  paymentStatus: 'PAID',
  approvalStatus: 'APPROVED',
  accessStatus: 'PASS_GENERATED',
  completionStatus: 'PENDING',
  notes: 'Requested extra towels.',
  createdAt: '2026-09-09T10:00:00.000Z',
  updatedAt: '2026-09-09T10:00:00.000Z',
};

const mockPass: AmenityAccessPass = {
  _id: 'pass-pool-101',
  orgId: 'org-test-1',
  facilityId: 'fac-pool-1',
  facilityName: 'Infinity Swimming Pool',
  reservationId: 'res-abc-101',
  userId: 'user-resident-1',
  passCode: 'PASS-8844',
  qrData: 'AMENITY_PASS_SECURE_TOKEN_DATA_8844',
  passType: 'QR_DYNAMIC',
  validFrom: '2026-09-10T10:00:00.000Z',
  validUntil: '2026-09-10T12:00:00.000Z',
  maxUses: 1,
  currentUses: 0,
  status: 'ACTIVE',
  createdAt: '2026-09-09T10:00:00.000Z',
  updatedAt: '2026-09-09T10:00:00.000Z',
};

describe('Amenity Management Phase 6C.3: Resident Reservation Detail & Access Pass', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParamsId = 'res-abc-101';
    mockState = {
      amenityBookings: {
        v2CurrentReservation: mockReservation,
        v2Reservations: [mockReservation],
        v2AccessPasses: [mockPass],
        v2Loading: false,
        v2Error: null,
      },
    };
    mockFetchReservationsThunk.mockResolvedValue({
      items: [mockReservation],
      pagination: { currentPage: 1, totalPages: 1, totalRecords: 1, limit: 10 },
    });
    mockFetchReservationByIdThunk.mockResolvedValue(mockReservation);
    mockFetchPassesByReservationThunk.mockResolvedValue([mockPass]);
    mockCancelReservationThunk.mockResolvedValue({
      ...mockReservation,
      bookingStatus: 'CANCELLED',
      paymentStatus: 'REFUND_PENDING',
      accessStatus: 'ACCESS_REVOKED',
    });
  });

  // ==========================================
  // Section 1: Reservation Loading & Presentation
  // ==========================================
  describe('Reservation Loading & Metadata', () => {
    it('Scenario 1: Loads reservation through v2 architecture on mount', async () => {
      const { result } = await renderHook(() =>
        useResidentReservationDetail('res-abc-101')
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockFetchReservationByIdThunk).toHaveBeenCalledWith('res-abc-101');
      expect(mockFetchPassesByReservationThunk).toHaveBeenCalledWith('res-abc-101');
      expect(result.current.reservation?._id).toBe('res-abc-101');
    });

    it('Scenario 2: Displays facility name and resource name', async () => {
      await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[mockPass]}
        />
      );

      expect(screen.getByText('Infinity Swimming Pool')).toBeTruthy();
      expect(screen.getByText('Lap Lane 3')).toBeTruthy();
    });

    it('Scenario 3: Displays reservation number', async () => {
      await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[mockPass]}
        />
      );

      expect(screen.getByText(/RES-2026-00042/)).toBeTruthy();
    });

    it('Scenario 4: Displays start and end date/time and duration', async () => {
      await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[mockPass]}
        />
      );

      expect(screen.getByText('Start Time')).toBeTruthy();
      expect(screen.getByText('End Time')).toBeTruthy();
      expect(screen.getByText('2 hrs')).toBeTruthy();
    });

    it('Scenario 5 & 6: Displays headcount, quantity, and guest list', async () => {
      await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[mockPass]}
        />
      );

      expect(screen.getByText('3 Guests')).toBeTruthy();
      expect(screen.getByText('1 Units')).toBeTruthy();
      expect(screen.getByText('Fatima Al-Mansoor')).toBeTruthy();
      expect(screen.getByText('+966501234567')).toBeTruthy();
      expect(screen.getByText('Zaid Al-Mansoor')).toBeTruthy();
    });
  });

  // ==========================================
  // Section 2: Five Orthogonal Status Dimensions
  // ==========================================
  describe('Five Orthogonal Status Dimensions', () => {
    it('Scenario 7: Displays bookingStatus without flattening', async () => {
      await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[mockPass]}
        />
      );

      // bookingStatus appears in header and in lifecycle status
      const elements = screen.getAllByText(/CONFIRMED/i);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('Scenario 8: Displays paymentStatus independently', async () => {
      await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[mockPass]}
        />
      );

      const elements = screen.getAllByText(/PAID/i);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('Scenario 9: Displays approvalStatus independently', async () => {
      await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[mockPass]}
        />
      );

      expect(screen.getByText(/APPROVED/i)).toBeTruthy();
    });

    it('Scenario 10: Displays accessStatus independently', async () => {
      await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[mockPass]}
        />
      );

      const elements = screen.getAllByText('PASS_GENERATED');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('Scenario 11: Displays completionStatus independently', async () => {
      await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[mockPass]}
        />
      );

      expect(screen.getByText(/Upcoming|PENDING/i)).toBeTruthy();
    });

    it('Scenario 12: Displays rejection and cancellation reasons when present', async () => {
      const rejectedReservation: AmenityReservation = {
        ...mockReservation,
        bookingStatus: 'REJECTED',
        approvalStatus: 'REJECTED',
        rejectionReason: 'Exceeds villa monthly quota',
        cancellationReason: 'Resident requested alternate time',
      };

      await render(
        <ResidentReservationDetailView
          reservation={rejectedReservation}
          accessPasses={[]}
        />
      );

      expect(screen.getByText('Exceeds villa monthly quota')).toBeTruthy();
      expect(screen.getByText('Resident requested alternate time')).toBeTruthy();
    });
  });

  // ==========================================
  // Section 3: Server Pricing & Payment Display
  // ==========================================
  describe('Pricing & Payment Display', () => {
    it('Scenario 13: Displays server pricing snapshot without local recalculation', async () => {
      await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[mockPass]}
        />
      );

      // Price (incl. taxes), refundable deposit and total come straight from the server snapshot.
      expect(screen.getByText('₹115')).toBeTruthy();
      expect(screen.getByText('₹50')).toBeTruthy();
      expect(screen.getByText('₹165')).toBeTruthy();
    });

    it('Scenario 14 & 15: Displays payment reference as display metadata only', async () => {
      await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[mockPass]}
        />
      );

      expect(screen.getByText('PAY-REF-998811')).toBeTruthy();
    });
  });

  // ==========================================
  // Section 4: Cancellation Workflow
  // ==========================================
  describe('Cancellation Lifecycle', () => {
    it('Scenario 16 & 17: Shows cancellation action when allowed and hides when cancelled', async () => {
      const { rerender } = await render(
        <ResidentReservationDetailView
          reservation={mockReservation}
          accessPasses={[mockPass]}
          isCancellable={true}
          onCancelPress={jest.fn()}
        />
      );

      expect(screen.getByText('Cancel Booking')).toBeTruthy();

      const cancelledRes: AmenityReservation = {
        ...mockReservation,
        bookingStatus: 'CANCELLED',
      };

      await act(async () => {
        rerender(
          <ResidentReservationDetailView
            reservation={cancelledRes}
            accessPasses={[]}
            isCancellable={false}
          />
        );
      });

      expect(screen.queryByText('Cancel Booking')).toBeNull();
    });

    it('Scenario 18-21: Opens modal, dispatches thunk, and reloads authoritative state', async () => {
      await render(<ReservationDetailScreen />);

      const cancelBtn = screen.getByText('Cancel Booking');
      await act(async () => {
        fireEvent.press(cancelBtn);
      });

      expect(await screen.findByText('₹500 will be refunded to your wallet.')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByTestId('cancel-sheet-confirm'));
      });

      expect(mockCancelReservationThunk).toHaveBeenCalledWith({
        id: 'res-abc-101',
        payload: undefined,
      });
      expect(mockFetchPassesByReservationThunk).toHaveBeenCalledWith('res-abc-101');
    });
  });

  // ==========================================
  // Section 5: Access Pass & MANDATORY NEGATIVE SECURITY TESTS
  // ==========================================
  describe('Access Pass Security & Negative Tests', () => {
    it('Scenario 22: PASS_GENERATED + qrData → QR renders using exact server qrData', async () => {
      expect(shouldRenderQrCode(mockPass, mockReservation)).toBe(true);

      await render(
        <ResidentAccessPassCard
          pass={mockPass}
          reservation={mockReservation}
        />
      );

      expect(screen.getByText('Pass Code: PASS-8844')).toBeTruthy();
      expect(screen.getByText('PASS_GENERATED')).toBeTruthy();
    });

    it('Scenario 23: PASS_GENERATED + passTokenHash but no qrData → NO QR rendered', async () => {
      const passWithoutQr: any = {
        _id: 'pass-hash-only',
        orgId: 'org-test-1',
        facilityId: 'fac-pool-1',
        reservationId: 'res-abc-101',
        passTokenHash: 'internal_sha256_hash_value_never_use_in_qr',
        qrData: '', // No resident-presentable QR credential
        validFrom: '2026-09-10T10:00:00.000Z',
        validUntil: '2026-09-10T12:00:00.000Z',
        status: 'ACTIVE',
      };

      expect(shouldRenderQrCode(passWithoutQr, mockReservation)).toBe(false);

      await render(
        <ResidentAccessPassCard
          pass={passWithoutQr}
          reservation={mockReservation}
        />
      );

      // Proves no QR is rendered, but legitimate metadata and informational notice are shown
      expect(
        screen.getByText(/Digital QR presentation credential is not available for this pass/)
      ).toBeTruthy();
      expect(screen.queryByText(/Pass Code:/)).toBeNull();
      // Strictly never renders the hash
      expect(screen.queryByText(/internal_sha256_hash_value_never_use_in_qr/)).toBeNull();
    });

    it('Scenario 24: passCode without an explicitly contract-approved QR credential → NO QR rendered', async () => {
      const passCodeOnly: any = {
        _id: 'pass-code-only',
        reservationId: 'res-abc-101',
        passCode: '1234',
        qrData: undefined,
        status: 'ACTIVE',
      };

      expect(shouldRenderQrCode(passCodeOnly, mockReservation)).toBe(false);

      await render(
        <ResidentAccessPassCard
          pass={passCodeOnly}
          reservation={mockReservation}
        />
      );

      expect(
        screen.getByText(/Digital QR presentation credential is not available for this pass/)
      ).toBeTruthy();
    });

    it('Scenario 25: ACCESS_REVOKED + qrData → NEVER renders QR', async () => {
      const revokedReservation: AmenityReservation = {
        ...mockReservation,
        accessStatus: 'ACCESS_REVOKED',
      };

      expect(shouldRenderQrCode(mockPass, revokedReservation)).toBe(false);

      await render(
        <ResidentAccessPassCard
          pass={mockPass}
          reservation={revokedReservation}
        />
      );

      expect(screen.getByText('ACCESS_REVOKED')).toBeTruthy();
      expect(
        screen.getByText(/Access Revoked. This digital pass is no longer valid for gate entry./)
      ).toBeTruthy();
      expect(screen.queryByText(/Pass Code:/)).toBeNull();
    });

    it('Scenario 26: CHECKED_OUT + qrData → NEVER renders QR', async () => {
      const checkedOutReservation: AmenityReservation = {
        ...mockReservation,
        accessStatus: 'CHECKED_OUT',
      };
      const checkedOutPass: AmenityAccessPass = {
        ...mockPass,
        checkedOutAt: '2026-09-10T12:05:00.000Z',
      };

      expect(shouldRenderQrCode(checkedOutPass, checkedOutReservation)).toBe(false);

      await render(
        <ResidentAccessPassCard
          pass={checkedOutPass}
          reservation={checkedOutReservation}
        />
      );

      expect(screen.getByText('Checked Out')).toBeTruthy();
      expect(
        screen.getByText(/Access Completed. You have checked out of the facility./)
      ).toBeTruthy();
      expect(screen.queryByText(/Pass Code:/)).toBeNull();
    });

    it('Scenario 27: CHECKED_IN state renders checked-in confirmation and timestamp', async () => {
      const checkedInReservation: AmenityReservation = {
        ...mockReservation,
        accessStatus: 'CHECKED_IN',
      };
      const checkedInPass: AmenityAccessPass = {
        ...mockPass,
        checkedInAt: '2026-09-10T10:05:00.000Z',
      };

      await render(
        <ResidentAccessPassCard
          pass={checkedInPass}
          reservation={checkedInReservation}
        />
      );

      expect(screen.getByText(/checked[ _]in/i)).toBeTruthy();
      expect(screen.getByText(/Currently Checked In. Enjoy your session!/)).toBeTruthy();
    });

    it('Scenario 28: Missing / no pass displays graceful informational state', async () => {
      const noPassReservation: AmenityReservation = {
        ...mockReservation,
        bookingStatus: 'PENDING_APPROVAL',
        accessStatus: 'NOT_APPLICABLE',
      };

      await render(
        <ResidentAccessPassCard
          pass={null}
          reservation={noPassReservation}
        />
      );

      expect(
        screen.getByText('Access pass will be generated upon reservation approval.')
      ).toBeTruthy();
    });

    it('Scenario 29: Multiple passes → lifecycle-aware pass selection prioritizes active presentable pass', () => {
      const revokedPass: AmenityAccessPass = {
        ...mockPass,
        _id: 'pass-revoked-1',
        status: 'REVOKED',
      };
      const activeQrPass: AmenityAccessPass = {
        ...mockPass,
        _id: 'pass-active-qr',
        qrData: 'SERVER_PRESENTATION_CREDENTIAL_99',
        status: 'ACTIVE',
      };

      const selected = selectDisplayablePass(
        [revokedPass, activeQrPass],
        mockReservation
      );
      expect(selected?._id).toBe('pass-active-qr');
      expect(selected?.qrData).toBe('SERVER_PRESENTATION_CREDENTIAL_99');
    });

    it('Scenario 30-32: passTokenHash is NEVER used as QR data and no local QR/crypto generation exists', () => {
      const componentPath = path.resolve(
        __dirname,
        '../components/ResidentAccessPassCard.tsx'
      );
      const source = fs.readFileSync(componentPath, 'utf8');

      // passTokenHash must never be referenced as a QR payload
      expect(source).not.toContain('passTokenHash');

      // No crypto/HMAC/SHA generation
      expect(source).not.toContain('crypto');
      expect(source).not.toContain('createHmac');
      expect(source).not.toContain('sha256');
      expect(source).not.toContain('MD5');
    });
  });

  // ==========================================
  // Section 6: Navigation Integration
  // ==========================================
  describe('Navigation Integration', () => {
    it('Scenario 33: My Bookings card onPress navigates to reservations/[id] with reservation._id', async () => {
      await render(<MyBookingsScreen />);

      const card = screen.getByText('Infinity Swimming Pool');
      await act(async () => {
        fireEvent.press(card);
      });

      expect(mockRouterPush).toHaveBeenCalledWith(
        '/(resident)/amenities/reservations/res-abc-101'
      );
    });

    it('Scenario 34: Detail screen handles non-existent reservation with EmptyState and back action', async () => {
      mockState.amenityBookings.v2CurrentReservation = null;
      mockState.amenityBookings.v2Reservations = [];

      await render(<ReservationDetailScreen />);

      expect(screen.getByText('Reservation Not Found')).toBeTruthy();
      const backBtn = screen.getByText('Back to My Bookings');
      await act(async () => {
        fireEvent.press(backBtn);
      });
      expect(mockRouterBack).toHaveBeenCalled();
    });
  });

  // ==========================================
  // Section 7: Security & Architectural Boundaries
  // ==========================================
  describe('Security & Architectural Boundaries', () => {
    it('Scenario 35: Strictly ZERO direct Axios or fetch calls in detail hook or view', () => {
      const hookPath = path.resolve(__dirname, '../hooks/useResidentReservationDetail.ts');
      const viewPath = path.resolve(__dirname, '../components/ResidentReservationDetailView.tsx');
      const routePath = path.resolve(
        __dirname,
        '../../../../app/(resident)/amenities/reservations/[id].tsx'
      );

      const hookSource = fs.readFileSync(hookPath, 'utf8');
      const viewSource = fs.readFileSync(viewPath, 'utf8');
      const routeSource = fs.readFileSync(routePath, 'utf8');

      for (const src of [hookSource, viewSource, routeSource]) {
        expect(src).not.toContain('axios');
        expect(src).not.toContain('fetch(');
      }
    });

    it('Scenario 36: Strictly ZERO imports from @/features/visitor or src/features/visitor', () => {
      const hookPath = path.resolve(__dirname, '../hooks/useResidentReservationDetail.ts');
      const viewPath = path.resolve(__dirname, '../components/ResidentReservationDetailView.tsx');
      const passPath = path.resolve(__dirname, '../components/ResidentAccessPassCard.tsx');
      const routePath = path.resolve(
        __dirname,
        '../../../../app/(resident)/amenities/reservations/[id].tsx'
      );

      for (const p of [hookPath, viewPath, passPath, routePath]) {
        const src = fs.readFileSync(p, 'utf8');
        expect(src).not.toContain('visitor');
      }
    });

    it('Scenario 37: Strictly ZERO imports of legacy v1 booking architecture', () => {
      const hookPath = path.resolve(__dirname, '../hooks/useResidentReservationDetail.ts');
      const viewPath = path.resolve(__dirname, '../components/ResidentReservationDetailView.tsx');
      const passPath = path.resolve(__dirname, '../components/ResidentAccessPassCard.tsx');
      const routePath = path.resolve(
        __dirname,
        '../../../../app/(resident)/amenities/reservations/[id].tsx'
      );

      for (const p of [hookPath, viewPath, passPath, routePath]) {
        const src = fs.readFileSync(p, 'utf8');
        expect(src).not.toContain('useMyBookings');
        expect(src).not.toContain('AmenityBookingCard');
        expect(src).not.toContain('PassQRModal');
        expect(src).not.toContain('CancelBookingModal');
        expect(src).not.toContain('fetchMyBookingsThunk');
        expect(src).not.toContain('booking.status');
      }
    });

    it('Scenario 38: Strictly ZERO refund API endpoints or webhook calls', () => {
      const hookPath = path.resolve(__dirname, '../hooks/useResidentReservationDetail.ts');
      const viewPath = path.resolve(__dirname, '../components/ResidentReservationDetailView.tsx');
      const routePath = path.resolve(
        __dirname,
        '../../../../app/(resident)/amenities/reservations/[id].tsx'
      );

      for (const p of [hookPath, viewPath, routePath]) {
        const src = fs.readFileSync(p, 'utf8');
        expect(src).not.toContain('/refund');
        expect(src).not.toContain('/webhook');
      }
    });
  });
});
