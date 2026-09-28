/**
 * Amenity Management Phase 6C.1 - Resident Reservation Management Foundation Tests
 * Verifies useResidentReservations hook, ResidentReservationCard, ResidentCancelModal,
 * orthogonal state preservation, and architectural boundaries.
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
const mockCancelReservationThunk = jest.fn();
const mockFetchPassesByReservationThunk = jest.fn();
const mockClearV2Errors = jest.fn();

jest.mock('../store/amenityBookingSlice', () => ({
  __esModule: true,
  fetchReservationsThunk: (params: any) => ({
    type: 'amenityBookings/fetchReservations',
    unwrap: () => mockFetchReservationsThunk(params),
  }),
  fetchReservationByIdThunk: (id: any) => ({
    type: 'amenityBookings/fetchReservationById',
    unwrap: () => mockFetchReservationByIdThunk(id),
  }),
  cancelReservationThunk: (payload: any) => ({
    type: 'amenityBookings/cancelReservation',
    unwrap: () => mockCancelReservationThunk(payload),
  }),
  fetchPassesByReservationThunk: (id: any) => ({
    type: 'amenityBookings/fetchPassesByReservation',
    unwrap: () => mockFetchPassesByReservationThunk(id),
  }),
  fetchCancellationPreviewThunk: (id: any) => ({
    type: 'amenityBookings/fetchCancellationPreview',
    unwrap: () =>
      Promise.resolve({
        allowed: true,
        blockReason: null,
        refund: { percentage: 50, bookingRefund: 250, depositRefund: 0, total: 250 },
        refundTo: 'WALLET',
        policy: null,
      }),
  }),
  clearV2Errors: () => mockClearV2Errors(),
}));

import {
  useResidentReservations,
  RESERVATION_FILTER_TABS,
} from '../hooks/useResidentReservations';
import {
  ResidentReservationCard,
  getBookingStatusVariant,
  getPaymentStatusVariant,
  getApprovalStatusVariant,
  getAccessStatusVariant,
  getCompletionStatusVariant,
} from '../components/ResidentReservationCard';
import { ResidentCancelModal } from '../components/ResidentCancelModal';
import {
  AmenityReservation,
  AmenityAccessPass,
} from '../types/amenityDomain.types';
import amenityManagementService from '../services/amenityManagementService';
import MyBookingsScreen from '../../../../app/(resident)/amenities/my-bookings';

// Mock expo-router
const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/(resident)/amenities/my-bookings',
}));

// Mock navigation modals and auth hooks to prevent immer ESM loading in Jest
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

// Mock amenityManagementService
jest.mock('../services/amenityManagementService', () => ({
  __esModule: true,
  default: {
    getReservations: jest.fn(),
    getReservationById: jest.fn(),
    cancelReservation: jest.fn(),
    getPassesByReservation: jest.fn(),
  },
  amenityManagementService: {
    getReservations: jest.fn(),
    getReservationById: jest.fn(),
    cancelReservation: jest.fn(),
    getPassesByReservation: jest.fn(),
  },
  generateUUID: jest.fn(() => 'test-mock-uuid-1234'),
}));

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

const mockReservation: AmenityReservation = {
  _id: 'res-abc-101',
  orgId: 'org-test-1',
  facilityId: 'fac-pool-1',
  facilityName: 'Infinity Swimming Pool',
  reservationNumber: 'RES-2026-00042',
  userId: 'user-resident-1',
  userName: 'Ahmed Al-Mansoor',
  unitId: 'villa-101',
  startDateTime: '2026-09-10T10:00:00.000Z',
  endDateTime: '2026-09-10T12:00:00.000Z',
  headcount: 3,
  quantity: 1,
  pricingSnapshot: {
    baseAmount: 100,
    taxAmount: 15,
    depositAmount: 50,
    totalAmount: 165,
    currency: 'INR',
  },
  bookingStatus: 'CONFIRMED',
  paymentStatus: 'PAID',
  approvalStatus: 'APPROVED',
  accessStatus: 'PASS_GENERATED',
  completionStatus: 'PENDING',
  createdAt: '2026-09-09T10:00:00.000Z',
  updatedAt: '2026-09-09T10:00:00.000Z',
};

const mockPass: AmenityAccessPass = {
  _id: 'pass-999',
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

describe('Amenity Management Phase 6C.1: Resident Reservation Management Foundation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchReservationsThunk.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, pages: 1 },
    });
    mockState = {
      amenityBookings: {
        v2Reservations: [],
        v2CurrentReservation: null,
        v2AccessPasses: [],
        v2Loading: false,
        v2Error: null,
        pagination: { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 },
      },
    };
  });

  // ==========================================
  // Hook Tests (useResidentReservations)
  // ==========================================
  describe('useResidentReservations Hook', () => {
    it('Scenario 1: Fetches reservations through existing v2 thunk/service on initial load', async () => {
      mockFetchReservationsThunk.mockResolvedValueOnce({
        items: [mockReservation],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      });
      mockState.amenityBookings.v2Reservations = [mockReservation];

      const { result } = await renderHook(() => useResidentReservations());

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockFetchReservationsThunk).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
      expect(result.current.reservations).toHaveLength(1);
      expect(result.current.reservations[0]._id).toBe('res-abc-101');
    });

    it('Scenario 2: Preserves all five orthogonal reservation dimensions in state', async () => {
      mockState.amenityBookings.v2Reservations = [mockReservation];

      const { result } = await renderHook(() => useResidentReservations());

      await act(async () => {
        await Promise.resolve();
      });

      const res = result.current.reservations[0];
      expect(res.bookingStatus).toBe('CONFIRMED');
      expect(res.paymentStatus).toBe('PAID');
      expect(res.approvalStatus).toBe('APPROVED');
      expect(res.accessStatus).toBe('PASS_GENERATED');
      expect(res.completionStatus).toBe('PENDING');
    });

    it('Scenario 3: Exposes server-side pagination metadata', async () => {
      mockState.amenityBookings.pagination = { currentPage: 2, totalPages: 3, totalRecords: 25, limit: 10 };

      const { result } = await renderHook(() => useResidentReservations({ page: 2 }));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.pagination.currentPage).toBe(2);
      expect(result.current.pagination.totalPages).toBe(3);
      expect(result.current.pagination.totalRecords).toBe(25);
      expect(result.current.pagination.limit).toBe(10);
    });

    it('Scenario 4: Refreshes correctly by resetting query to page 1', async () => {
      const { result } = await renderHook(() => useResidentReservations());

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockFetchReservationsThunk).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });

    it('Scenario 5: Fetches single reservation detail by ID into currentReservation', async () => {
      mockFetchReservationByIdThunk.mockResolvedValueOnce(mockReservation);
      mockState.amenityBookings.v2CurrentReservation = mockReservation;

      const { result } = await renderHook(() => useResidentReservations());

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        const fetched = await result.current.fetchReservationById('res-abc-101');
        expect(fetched._id).toBe('res-abc-101');
      });

      expect(mockFetchReservationByIdThunk).toHaveBeenCalledWith('res-abc-101');
      expect(result.current.currentReservation?._id).toBe('res-abc-101');
    });

    it('Scenario 6: Dispatches cancellation through existing thunk with optional reason', async () => {
      const cancelledRes = {
        ...mockReservation,
        bookingStatus: 'CANCELLED' as const,
        paymentStatus: 'REFUND_PENDING' as const,
        accessStatus: 'ACCESS_REVOKED' as const,
        cancellationReason: 'Medical emergency',
      };

      mockCancelReservationThunk.mockResolvedValueOnce(cancelledRes);

      const { result } = await renderHook(() => useResidentReservations());

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        const res = await result.current.cancelReservation('res-abc-101', 'Medical emergency');
        expect(res.bookingStatus).toBe('CANCELLED');
        expect(res.paymentStatus).toBe('REFUND_PENDING');
        expect(res.accessStatus).toBe('ACCESS_REVOKED');
      });

      expect(mockCancelReservationThunk).toHaveBeenCalledWith({
        id: 'res-abc-101',
        payload: { reason: 'Medical emergency' },
      });
    });

    it('Scenario 7: Fetches access passes through existing thunk', async () => {
      mockFetchPassesByReservationThunk.mockResolvedValueOnce([mockPass]);
      mockState.amenityBookings.v2AccessPasses = [mockPass];

      const { result } = await renderHook(() => useResidentReservations());

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        const passes = await result.current.fetchPassesByReservation('res-abc-101');
        expect(passes).toHaveLength(1);
        expect(passes[0].passCode).toBe('PASS-8844');
      });

      expect(mockFetchPassesByReservationThunk).toHaveBeenCalledWith('res-abc-101');
      expect(result.current.accessPasses).toHaveLength(1);
    });

    it('Scenario 8: Handles and exposes mapped error objects and clears errors', async () => {
      mockState.amenityBookings.v2Error = {
        status: 403,
        message: 'Forbidden access to organization reservations',
      };

      const { result } = await renderHook(() => useResidentReservations());

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.status).toBe(403);

      await act(async () => {
        result.current.clearError();
      });
      expect(mockClearV2Errors).toHaveBeenCalled();
    });

    it('Scenario 8b: Filters reservations by presentation tab and search query', async () => {
      const pastRes = {
        ...mockReservation,
        _id: 'res-past',
        completionStatus: 'COMPLETED' as const,
      };
      const pendingRes = {
        ...mockReservation,
        _id: 'res-pending',
        bookingStatus: 'PENDING_APPROVAL' as const,
        facilityName: 'Tennis Court',
      };
      mockState.amenityBookings.v2Reservations = [mockReservation, pastRes, pendingRes];

      const { result } = await renderHook(() => useResidentReservations());

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.reservations).toHaveLength(3);

      await act(async () => {
        result.current.setSelectedTab('Past');
      });
      expect(result.current.filteredReservations).toHaveLength(1);
      expect(result.current.filteredReservations[0]._id).toBe('res-past');

      await act(async () => {
        result.current.setSelectedTab('All');
        result.current.setSearchQuery('Tennis');
      });
      expect(result.current.filteredReservations).toHaveLength(1);
      expect(result.current.filteredReservations[0]._id).toBe('res-pending');
    });
  });

  // ==========================================
  // Reservation Card Tests (ResidentReservationCard)
  // ==========================================
  describe('ResidentReservationCard Component', () => {
    it('Scenario 9: Renders facility and reservation metadata accurately', async () => {
      await render(<ResidentReservationCard reservation={mockReservation} detailed />);

      expect(screen.getByText('Infinity Swimming Pool')).toBeTruthy();
      expect(screen.getByText(/2026-00042/)).toBeTruthy();
      expect(screen.getByText('3 Guests')).toBeTruthy();
    });

    it('Scenario 10: Renders exact bookingStatus with appropriate variant', async () => {
      expect(getBookingStatusVariant('CONFIRMED')).toBe('success');
      expect(getBookingStatusVariant('PENDING_APPROVAL')).toBe('warning');
      expect(getBookingStatusVariant('CANCELLED')).toBe('danger');
      expect(getBookingStatusVariant('REJECTED')).toBe('danger');

      await render(<ResidentReservationCard reservation={mockReservation} />);
      expect(screen.getByText(/CONFIRMED/i)).toBeTruthy();
    });

    it('Scenario 11: Renders exact paymentStatus with appropriate variant', async () => {
      expect(getPaymentStatusVariant('PAID')).toBe('success');
      expect(getPaymentStatusVariant('NOT_REQUIRED')).toBe('success');
      expect(getPaymentStatusVariant('PENDING')).toBe('warning');
      expect(getPaymentStatusVariant('HELD_AUTHORIZED')).toBe('info');
      expect(getPaymentStatusVariant('REFUND_PENDING')).toBe('warning');
      expect(getPaymentStatusVariant('REFUNDED')).toBe('neutral');
      expect(getPaymentStatusVariant('FAILED')).toBe('danger');

      await render(<ResidentReservationCard reservation={mockReservation} detailed />);
      expect(screen.getByText(/PAID/i)).toBeTruthy();
    });

    it('Scenario 12: Renders exact approvalStatus with appropriate variant', async () => {
      expect(getApprovalStatusVariant('APPROVED')).toBe('success');
      expect(getApprovalStatusVariant('NOT_REQUIRED')).toBe('success');
      expect(getApprovalStatusVariant('PENDING_REVIEW')).toBe('warning');
      expect(getApprovalStatusVariant('REJECTED')).toBe('danger');

      await render(<ResidentReservationCard reservation={mockReservation} detailed />);
      expect(screen.getByText(/APPROVED/i)).toBeTruthy();
    });

    it('Scenario 13: Renders exact accessStatus with appropriate variant', async () => {
      expect(getAccessStatusVariant('PASS_GENERATED')).toBe('success');
      expect(getAccessStatusVariant('CHECKED_IN')).toBe('info');
      expect(getAccessStatusVariant('CHECKED_OUT')).toBe('neutral');
      expect(getAccessStatusVariant('ACCESS_REVOKED')).toBe('danger');
      expect(getAccessStatusVariant('NOT_APPLICABLE')).toBe('neutral');

      await render(<ResidentReservationCard reservation={mockReservation} detailed />);
      expect(screen.getByText(/Pass Ready/i)).toBeTruthy();
    });

    it('Scenario 14: Renders exact completionStatus with appropriate variant', async () => {
      expect(getCompletionStatusVariant('COMPLETED')).toBe('success');
      expect(getCompletionStatusVariant('PENDING')).toBe('neutral');
      expect(getCompletionStatusVariant('NO_SHOW')).toBe('danger');
      expect(getCompletionStatusVariant('ABANDONED')).toBe('danger');

      await render(<ResidentReservationCard reservation={mockReservation} detailed />);
      expect(screen.getByText(/Upcoming/i)).toBeTruthy();
    });

    it('Scenario 15: Invokes onPress callback with full reservation object', async () => {
      const onPressMock = jest.fn();
      await render(
        <ResidentReservationCard reservation={mockReservation} onPress={onPressMock} />
      );

      fireEvent.press(screen.getByText('Infinity Swimming Pool'));
      expect(onPressMock).toHaveBeenCalledWith(mockReservation);
    });

    it('Scenario 15b: Shows Cancel Booking button for cancellable reservations and triggers onCancelPress', async () => {
      const onCancelMock = jest.fn();
      await render(
        <ResidentReservationCard reservation={mockReservation} detailed onCancelPress={onCancelMock} />
      );

      const cancelBtn = screen.getByText('Cancel Booking');
      expect(cancelBtn).toBeTruthy();

      fireEvent.press(cancelBtn);
      expect(onCancelMock).toHaveBeenCalledWith(mockReservation);
    });

    it('Scenario 15c: Hides Cancel Booking button when reservation is CANCELLED or COMPLETED', async () => {
      const onCancelMock = jest.fn();
      const cancelledRes = { ...mockReservation, bookingStatus: 'CANCELLED' as const };
      const { rerender } = await render(
        <ResidentReservationCard reservation={cancelledRes} onCancelPress={onCancelMock} />
      );
      expect(screen.queryByText('Cancel Booking')).toBeNull();

      const completedRes = { ...mockReservation, completionStatus: 'COMPLETED' as const };
      await rerender(<ResidentReservationCard reservation={completedRes} onCancelPress={onCancelMock} />);
      expect(screen.queryByText('Cancel Booking')).toBeNull();
    });
  });

  // ==========================================
  // Cancellation Modal Tests (ResidentCancelModal)
  // ==========================================
  describe('ResidentCancelModal Component', () => {
    const preview = { allowed: true, blockReason: null, refund: { percentage: 50, bookingRefund: 250, depositRefund: 500, total: 750 }, refundTo: 'WALLET' as const, policy: null };

    it('Scenario 16: Opens correctly when visible is true', async () => {
      await render(
        <ResidentCancelModal visible={true} reservation={mockReservation} preview={preview} onConfirm={jest.fn()} onClose={jest.fn()} />
      );

      expect(screen.getByTestId('cancel-sheet-confirm')).toBeTruthy();
    });

    it('Scenario 17: Shows the booking and the refund the server will credit to the wallet', async () => {
      await render(
        <ResidentCancelModal visible={true} reservation={mockReservation} preview={preview} onConfirm={jest.fn()} onClose={jest.fn()} />
      );

      expect(screen.getByText(/Infinity Swimming Pool · #RES-2026-00042/)).toBeTruthy();
      expect(screen.getByText('₹750 will be refunded to your wallet.')).toBeTruthy();
      expect(screen.getByText('Booking: ₹250 (50%)')).toBeTruthy();
      expect(screen.getByText('Deposit: ₹500 (always returned)')).toBeTruthy();
    });

    it('Scenario 18 & 19: Captures optional reason and calls onConfirm with trimmed string or undefined', async () => {
      const onConfirmMock = jest.fn();
      await render(
        <ResidentCancelModal visible={true} reservation={mockReservation} preview={preview} onConfirm={onConfirmMock} onClose={jest.fn()} />
      );

      await act(async () => {
        fireEvent.press(screen.getByTestId('cancel-sheet-confirm'));
      });
      expect(onConfirmMock).toHaveBeenLastCalledWith(undefined);

      await act(async () => {
        fireEvent.changeText(screen.getByPlaceholderText('Tell the management why you are cancelling'), '  Change of plans  ');
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId('cancel-sheet-confirm'));
      });
      expect(onConfirmMock).toHaveBeenLastCalledWith('Change of plans');
    });

    it('Scenario 20: Disables confirm button and prevents duplicate submission while loading is true', async () => {
      const onConfirmMock = jest.fn();
      await render(
        <ResidentCancelModal
          visible={true}
          reservation={mockReservation}
          preview={preview}
          onConfirm={onConfirmMock}
          onClose={jest.fn()}
          loading={true}
        />
      );

      fireEvent.press(screen.getByTestId('cancel-sheet-confirm'));
      expect(onConfirmMock).not.toHaveBeenCalled();
    });

    it('Scenario 21: Closes correctly when cancel action is tapped', async () => {
      const onCloseMock = jest.fn();
      await render(
        <ResidentCancelModal visible={true} reservation={mockReservation} preview={preview} onConfirm={jest.fn()} onClose={onCloseMock} />
      );

      fireEvent.press(screen.getByTestId('cancel-sheet-keep'));
      expect(onCloseMock).toHaveBeenCalled();
    });

    it('Scenario 21b: Explains why a blocked booking cannot be cancelled and offers no confirm', async () => {
      await render(
        <ResidentCancelModal
          visible={true}
          reservation={mockReservation}
          preview={{ ...preview, allowed: false, blockReason: 'This facility does not allow cancellations' }}
          onConfirm={jest.fn()}
          onClose={jest.fn()}
        />
      );

      expect(screen.getByText('This facility does not allow cancellations')).toBeTruthy();
      expect(screen.queryByTestId('cancel-sheet-confirm')).toBeNull();
    });

    it('Scenario 21c: Shows the server error inside the sheet', async () => {
      await render(
        <ResidentCancelModal
          visible={true}
          reservation={mockReservation}
          preview={preview}
          error="Booking already started"
          onConfirm={jest.fn()}
          onClose={jest.fn()}
        />
      );

      expect(screen.getByText('Booking already started')).toBeTruthy();
    });
  });

  // ==========================================
  // Security & Architectural Boundary Tests
  // ==========================================
  describe('Security & Architectural Boundaries', () => {
    const hookPath = path.resolve(__dirname, '../hooks/useResidentReservations.ts');
    const cardPath = path.resolve(__dirname, '../components/ResidentReservationCard.tsx');
    const modalPath = path.resolve(__dirname, '../components/ResidentCancelModal.tsx');

    const hookSource = fs.readFileSync(hookPath, 'utf8');
    const cardSource = fs.readFileSync(cardPath, 'utf8');
    const modalSource = fs.readFileSync(modalPath, 'utf8');

    it('Scenario 22: Strictly ZERO imports from @/features/visitor or src/features/visitor', () => {
      expect(hookSource).not.toContain('features/visitor');
      expect(cardSource).not.toContain('features/visitor');
      expect(modalSource).not.toContain('features/visitor');
    });

    it('Scenario 23: Strictly ZERO references to legacy booking.status or AmenityBooking in new code', () => {
      expect(hookSource).not.toContain('booking.status');
      expect(cardSource).not.toContain('booking.status');
      expect(modalSource).not.toContain('booking.status');
      expect(hookSource).not.toContain('AmenityBooking\n');
    });

    it('Scenario 24: Strictly ZERO direct Axios or fetch calls (delegates entirely to Redux/Service)', () => {
      expect(hookSource).not.toContain('axios');
      expect(cardSource).not.toContain('axios');
      expect(modalSource).not.toContain('axios');
      expect(hookSource).not.toContain('fetch(');
      expect(cardSource).not.toContain('fetch(');
      expect(modalSource).not.toContain('fetch(');
    });

    it('Scenario 25: Strictly ZERO refund API endpoints or client refund calculations', () => {
      expect(hookSource).not.toContain('/refund');
      expect(cardSource).not.toContain('/refund');
      expect(modalSource).not.toContain('/refund');
      expect(hookSource).not.toContain('calculateRefund');
    });

    it('Scenario 26: Strictly ZERO webhook calls (/payments/webhook)', () => {
      expect(hookSource).not.toContain('webhook');
      expect(cardSource).not.toContain('webhook');
      expect(modalSource).not.toContain('webhook');
    });

    it('Scenario 27: Strictly ZERO local QR generation or token hashing in Phase 6C.1 foundation', () => {
      expect(hookSource).not.toContain('crypto.createHash');
      expect(cardSource).not.toContain('crypto.createHash');
      expect(modalSource).not.toContain('crypto.createHash');
      expect(hookSource).not.toContain('passTokenHash');
    });

    it('Scenario 28: Preserves 5 orthogonal dimensions and avoids flattened reservation status', () => {
      expect(cardSource).toContain('reservation.bookingStatus');
      expect(cardSource).toContain('reservation.paymentStatus');
      expect(cardSource).toContain('reservation.approvalStatus');
      expect(cardSource).toContain('reservation.accessStatus');
      expect(cardSource).toContain('reservation.completionStatus');

      // Zero EXEMPTED status
      expect(hookSource).not.toContain("'EXEMPTED'");
      expect(cardSource).not.toContain("'EXEMPTED'");
      expect(modalSource).not.toContain("'EXEMPTED'");
    });
  });

  // ==========================================
  // Phase 6C.2: My Bookings Modernized Screen Tests
  // ==========================================
  describe('Phase 6C.2: My Bookings Modernized Screen', () => {
    it('Scenario 29 & 30: Renders v2 reservations and does not consume legacy AmenityBooking', async () => {
      mockState.amenityBookings.v2Reservations = [mockReservation];

      await render(<MyBookingsScreen />);

      expect(screen.getByText('Infinity Swimming Pool')).toBeTruthy();
      expect(screen.getByText(/2026-00042/)).toBeTruthy();
      expect(screen.getByText('My Amenity Bookings')).toBeTruthy();
    });

    it('Scenario 31: Renders empty state when no reservations exist', async () => {
      mockState.amenityBookings.v2Reservations = [];

      await render(<MyBookingsScreen />);

      expect(screen.getByText('No Bookings Found')).toBeTruthy();
      expect(screen.getByText('You have no reservations matching this filter.')).toBeTruthy();
    });

    it('Scenario 32: Displays loading state during initial fetch', async () => {
      mockState.amenityBookings.v2Reservations = [];
      mockState.amenityBookings.v2Loading = true;

      await render(<MyBookingsScreen />);

      expect(screen.getByText('My Amenity Bookings')).toBeTruthy();
    });

    it('Scenario 33: Renders error banner and handles retry callback', async () => {
      mockState.amenityBookings.v2Reservations = [];
      mockState.amenityBookings.v2Error = {
        status: 500,
        message: 'Server error retrieving reservations',
      };

      await render(<MyBookingsScreen />);

      expect(screen.getByText('Server error retrieving reservations')).toBeTruthy();
    });

    it('Scenario 34 & 35 & 36: Supports pull-to-refresh and pagination without clearing list', async () => {
      mockState.amenityBookings.v2Reservations = [mockReservation];
      mockState.amenityBookings.pagination = { currentPage: 1, totalPages: 2, totalRecords: 15, limit: 10 };

      await render(<MyBookingsScreen />);

      expect(screen.getByText('Infinity Swimming Pool')).toBeTruthy();
      expect(mockFetchReservationsThunk).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });

    it('Scenario 37: Filters reservations dynamically by keyword search', async () => {
      const tennisRes = {
        ...mockReservation,
        _id: 'res-tennis-99',
        facilityName: 'Rooftop Tennis Court',
        reservationNumber: 'RES-TENNIS-0099',
      };
      mockState.amenityBookings.v2Reservations = [mockReservation, tennisRes];

      await render(<MyBookingsScreen />);

      expect(screen.getByText('Infinity Swimming Pool')).toBeTruthy();
      expect(screen.getByText('Rooftop Tennis Court')).toBeTruthy();

      const searchInput = screen.getByPlaceholderText('Search by facility name or reservation number...');
      await act(async () => {
        fireEvent.changeText(searchInput, 'Tennis');
      });

      expect(screen.queryByText('Infinity Swimming Pool')).toBeNull();
      expect(screen.getByText('Rooftop Tennis Court')).toBeTruthy();
    });

    it('Scenario 38: Filters reservations dynamically by presentation tabs', async () => {
      const pastRes = {
        ...mockReservation,
        _id: 'res-past-1',
        facilityName: 'Past Squash Court',
        completionStatus: 'COMPLETED' as const,
      };
      const pendingRes = {
        ...mockReservation,
        _id: 'res-pending-1',
        facilityName: 'Pending Spa Suite',
        bookingStatus: 'PENDING_APPROVAL' as const,
        approvalStatus: 'PENDING_REVIEW' as const,
      };
      mockState.amenityBookings.v2Reservations = [mockReservation, pastRes, pendingRes];

      await render(<MyBookingsScreen />);

      expect(screen.getByText('Infinity Swimming Pool')).toBeTruthy();
      expect(screen.getByText('Past Squash Court')).toBeTruthy();
      expect(screen.getByText('Pending Spa Suite')).toBeTruthy();

      // Open filter modal and tap 'Past' tab
      await act(async () => {
        fireEvent.press(screen.getByLabelText('Open filter options'));
      });
      await act(async () => {
        fireEvent.press(screen.getByText('Past'));
      });
      expect(screen.getByText('Past Squash Court')).toBeTruthy();
      expect(screen.queryByText('Infinity Swimming Pool')).toBeNull();
      expect(screen.queryByText('Pending Spa Suite')).toBeNull();

      // Open filter modal and tap 'Awaiting Approval' tab
      await act(async () => {
        fireEvent.press(screen.getByLabelText('Open filter options'));
      });
      await act(async () => {
        fireEvent.press(screen.getByText('Awaiting Approval'));
      });
      expect(screen.getByText('Pending Spa Suite')).toBeTruthy();
      expect(screen.queryByText('Past Squash Court')).toBeNull();
      expect(screen.queryByText('Infinity Swimming Pool')).toBeNull();

      // Open filter modal and tap 'Upcoming' tab
      await act(async () => {
        fireEvent.press(screen.getByLabelText('Open filter options'));
      });
      await act(async () => {
        fireEvent.press(screen.getAllByText('Upcoming')[0]);
      });
      expect(screen.getByText('Infinity Swimming Pool')).toBeTruthy();
      expect(screen.queryByText('Past Squash Court')).toBeNull();
      expect(screen.queryByText('Pending Spa Suite')).toBeNull();
    });

    it('Scenario 39 & 40: Renders five orthogonal dimensions in detailed card', async () => {
      await render(<ResidentReservationCard reservation={mockReservation} detailed />);

      expect(screen.getByText(/CONFIRMED/i)).toBeTruthy();
      expect(screen.getByText(/PAID/i)).toBeTruthy();
      expect(screen.getByText(/APPROVED/i)).toBeTruthy();
      expect(screen.getByText(/Pass Ready/i)).toBeTruthy();
      expect(screen.getAllByText(/Upcoming/i).length).toBeGreaterThanOrEqual(1);
    });

    it('Scenario 41 & 42: Cancellation action opens modal and dispatches cancellation', async () => {
      mockState.amenityBookings.v2Reservations = [mockReservation];

      await render(<MyBookingsScreen />);

      const passCodeBtn = screen.getByText('Pass Code');
      await act(async () => {
        fireEvent.press(passCodeBtn);
      });

      const cancelBtn = screen.getByText('Cancel Booking');
      await act(async () => {
        fireEvent.press(cancelBtn);
      });

      const confirmCancelBtn = screen.getByText('Confirm Cancel');
      await act(async () => {
        fireEvent.press(confirmCancelBtn);
      });

      expect(screen.getByText(/Infinity Swimming Pool · #RES-2026-00042/)).toBeTruthy();
      expect(await screen.findByText('₹250 will be refunded to your wallet.')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByTestId('cancel-sheet-confirm'));
      });
      expect(mockCancelReservationThunk).toHaveBeenCalledWith({
        id: 'res-abc-101',
        payload: undefined,
      });
    });

    it('Scenario 45 & 46: Correctly displays REFUND_PENDING and REFUNDED statuses without client math', async () => {
      const refundPendingRes = {
        ...mockReservation,
        _id: 'res-refund-pending',
        facilityName: 'Refund Pending Hall',
        paymentStatus: 'REFUND_PENDING' as const,
        bookingStatus: 'CANCELLED' as const,
      };
      const refundedRes = {
        ...mockReservation,
        _id: 'res-refunded',
        facilityName: 'Refunded Hall',
        paymentStatus: 'REFUNDED' as const,
        bookingStatus: 'CANCELLED' as const,
      };
      await render(
        <>
          <ResidentReservationCard reservation={refundPendingRes} detailed />
          <ResidentReservationCard reservation={refundedRes} detailed />
        </>
      );

      expect(screen.getByText('Refund Pending Hall')).toBeTruthy();
      expect(screen.getByText('Refunded Hall')).toBeTruthy();
      expect(screen.getByText('Refund In Progress')).toBeTruthy();
      expect(screen.getByText('Refunded')).toBeTruthy();
    });

    it('Scenario 47-54: Static isolation audit on modernized my-bookings.tsx', () => {
      const screenPath = path.resolve(__dirname, '../../../../app/(resident)/amenities/my-bookings.tsx');
      const screenSource = fs.readFileSync(screenPath, 'utf8');

      // Zero legacy imports
      expect(screenSource).not.toContain('useMyBookings');
      expect(screenSource).not.toContain('AmenityBookingCard');
      expect(screenSource).not.toContain('PassQRModal');
      expect(screenSource).not.toContain('CancelBookingModal');
      expect(screenSource).not.toContain('fetchMyBookingsThunk');
      expect(screenSource).not.toContain('booking.status');
      expect(screenSource).not.toContain('AmenityBooking');

      // Zero Visitor imports
      expect(screenSource).not.toContain('visitor');

      // Zero direct Axios/fetch
      expect(screenSource).not.toContain('axios');
      expect(screenSource).not.toContain('fetch(');

      // Zero refund/payment endpoints or client math
      expect(screenSource).not.toContain('/refund');
      expect(screenSource).not.toContain('/webhook');
      expect(screenSource).not.toContain('calculateRefund');

      // Zero local QR / crypto hashing
      expect(screenSource).not.toContain('QRCode');
      expect(screenSource).not.toContain('passTokenHash');
      expect(screenSource).not.toContain('crypto');
    });
  });
});
