/**
 * P7d — Facility creation: the payload for each facility type's booking model
 * (event sessions / hourly, overnight rooms), how the price is collected (full, advance,
 * at the gate), deposits on free facilities, and 0 values that must stay 0.
 */
import {
  mapAmenityCreationPayloadStrategy,
  AmenityCreationFormState,
} from '../utils/mapAmenityCreationPayloadStrategy';
import { stepErrorsFor, firstInvalidStep } from '../utils/amenityCreationValidation';

const base: AmenityCreationFormState = {
  name: 'Party Lawn',
  code: 'FAC-LAWN',
  archetype: 'EVENT_SPACE',
  category: 'Event Space',
  location: 'North Lawn',
  status: 'active',
  openTime: '06:00',
  closeTime: '23:00',
  openDays: [0, 1, 2, 3, 4, 5, 6],
  maxCapacity: 150,
  maxHeadcountPerReservation: 2,
  slotDurationMinutes: 60,
  bufferTimeMinutes: 0,
  advanceBookingDays: 30,
  advanceNoticeHours: 24,
  requiresApproval: false,
  isMultiResourceFacility: false,
  pricingType: 'FIXED_EVENT',
  baseRate: 5000,
  securityDeposit: 2000,
  isCancellationAllowed: true,
  refundCutoffHours: 24,
  refundPercentage: 100,
};

describe('P7d payload: cancellation values', () => {
  it('keeps a 0% refund and a 0h cutoff (they used to become 100% and 24h)', () => {
    const p = mapAmenityCreationPayloadStrategy({ ...base, refundPercentage: 0, refundCutoffHours: 0 });
    expect(p.cancellationPolicy).toEqual({ isAllowed: true, refundCutoffHours: 0, refundPercentage: 0 });
  });

  it('still falls back when the fields are left blank', () => {
    const p = mapAmenityCreationPayloadStrategy({ ...base, refundPercentage: '', refundCutoffHours: '' });
    expect(p.cancellationPolicy).toMatchObject({ refundCutoffHours: 24, refundPercentage: 100 });
  });
});

describe('P7d payload: event booking modes', () => {
  it('publishes sessions with their own prices', () => {
    const p = mapAmenityCreationPayloadStrategy({
      ...base,
      bookingMode: 'SESSION',
      sessions: [
        { id: 'a', name: ' Morning ', startTime: '8:00', endTime: '13:00', price: '3000' },
        { id: 'b', name: 'Evening', startTime: '16:00', endTime: '22:00', price: '' },
      ],
    });
    expect(p.bookingMode).toBe('SESSION');
    expect(p.sessions).toEqual([
      { name: 'Morning', startTime: '08:00', endTime: '13:00', price: 3000 },
      { name: 'Evening', startTime: '16:00', endTime: '22:00', price: null },
    ]);
  });

  it('books by the hour on the chosen slot length, and drops sessions', () => {
    const p = mapAmenityCreationPayloadStrategy({
      ...base,
      bookingMode: 'HOURLY',
      slotDurationMinutes: 120,
      sessions: [{ id: 'x', name: 'X', startTime: '08:00', endTime: '09:00', price: 1 }],
    });
    expect({ mode: p.bookingMode, slot: p.slotDurationMinutes, sessions: p.sessions }).toEqual({
      mode: 'HOURLY',
      slot: 120,
      sessions: [],
    });
  });

  it('defaults to whole-day bookings', () => {
    expect(mapAmenityCreationPayloadStrategy(base).bookingMode).toBe('FULL_DAY');
  });
});

describe('P7d payload: rooms', () => {
  const room: AmenityCreationFormState = { ...base, archetype: 'ROOM_RESOURCE', pricingType: 'DAILY', baseRate: 1500 };

  it('sends check-in, check-out and max nights for overnight stays', () => {
    const p = mapAmenityCreationPayloadStrategy({
      ...room,
      stayMode: 'OVERNIGHT',
      checkInTime: '14:00',
      checkOutTime: '11:00',
      maxNights: '3',
    });
    expect(p).toMatchObject({ stayMode: 'OVERNIGHT', checkInTime: '14:00', checkOutTime: '11:00', maxNights: 3 });
  });

  it('sends no stay times for hourly rooms', () => {
    const p = mapAmenityCreationPayloadStrategy({ ...room, stayMode: 'HOURLY' });
    expect(p.stayMode).toBe('HOURLY');
    expect(p.checkInTime).toBeUndefined();
  });
});

describe('P7d payload: collecting the price', () => {
  it('sends an advance as a percentage or a fixed amount', () => {
    expect(
      mapAmenityCreationPayloadStrategy({ ...base, paymentMode: 'ADVANCE', advanceType: 'PERCENT', advanceValue: '25' }).paymentPolicy
    ).toEqual({ mode: 'ADVANCE', advanceType: 'PERCENT', advanceValue: 25 });
    expect(
      mapAmenityCreationPayloadStrategy({ ...base, paymentMode: 'ADVANCE', advanceType: 'FIXED', advanceValue: '1000' }).paymentPolicy
    ).toEqual({ mode: 'ADVANCE', advanceType: 'FIXED', advanceValue: 1000 });
  });

  it('pays at the gate without an advance', () => {
    expect(mapAmenityCreationPayloadStrategy({ ...base, paymentMode: 'PAY_AT_GATE', advanceValue: '25' }).paymentPolicy).toMatchObject({
      mode: 'PAY_AT_GATE',
      advanceValue: 0,
    });
  });

  it('keeps a deposit on a free facility, collected in full', () => {
    const p = mapAmenityCreationPayloadStrategy({
      ...base,
      archetype: 'INVENTORY_TOOLS',
      pricingType: 'FREE',
      baseRate: 0,
      securityDeposit: '500',
      paymentMode: 'ADVANCE',
      availableStock: 3,
      maxLoanHours: 72,
    });
    expect(p.pricingConfig).toMatchObject({ pricingType: 'FREE', baseRate: 0, securityDeposit: 500 });
    expect(p.paymentPolicy.mode).toBe('FULL');
  });
});

describe('P7d validation', () => {
  it('requires valid sessions for session bookings', () => {
    expect(stepErrorsFor('event-rules', { ...base, bookingMode: 'SESSION', sessions: [] }).sessions).toBe('Add at least one session');
    expect(
      stepErrorsFor('event-rules', {
        ...base,
        bookingMode: 'SESSION',
        sessions: [{ id: 'a', name: 'Eve', startTime: '22:00', endTime: '16:00', price: '' }],
      }).sessions
    ).toBe('Each session must end after it starts');
    expect(
      stepErrorsFor('event-rules', {
        ...base,
        bookingMode: 'SESSION',
        sessions: [{ id: 'a', name: 'Eve', startTime: '16:00', endTime: '22:00', price: '4500' }],
      })
    ).toEqual({});
  });

  it('requires stay times for overnight rooms', () => {
    const errors = stepErrorsFor('room-setup', {
      ...base,
      archetype: 'ROOM_RESOURCE',
      stayMode: 'OVERNIGHT',
      checkInTime: '2pm',
      checkOutTime: '11:00',
      maxNights: 0,
    });
    expect(errors).toMatchObject({ checkInTime: 'Check-in must be HH:MM', maxNights: 'At least 1 night' });
  });

  it('needs an advance below 100% and allows a deposit on a free facility', () => {
    expect(
      stepErrorsFor('pricing', { ...base, paymentMode: 'ADVANCE', advanceType: 'PERCENT', advanceValue: '100' }).advanceValue
    ).toBe('An advance is less than 100%');
    expect(stepErrorsFor('pricing', { ...base, pricingType: 'FREE', baseRate: 0, securityDeposit: 500 })).toEqual({});
  });

  it('does not need a base rate when every session has a price', () => {
    const form: AmenityCreationFormState = {
      ...base,
      baseRate: '',
      bookingMode: 'SESSION',
      sessions: [{ id: 'a', name: 'Eve', startTime: '16:00', endTime: '22:00', price: '4500' }],
    };
    expect(stepErrorsFor('pricing', form).baseRate).toBeUndefined();
    expect(stepErrorsFor('pricing', { ...form, sessions: [{ ...form.sessions![0], price: '' }] }).baseRate).toBeDefined();
  });

  it('reports the first step with a problem before publishing', () => {
    const invalid = firstInvalidStep(['info', 'schedule', 'event-rules', 'pricing', 'review'], {
      ...base,
      bookingMode: 'SESSION',
      sessions: [],
    });
    expect(invalid).toEqual({ index: 2, errors: { sessions: 'Add at least one session' } });
  });
});
