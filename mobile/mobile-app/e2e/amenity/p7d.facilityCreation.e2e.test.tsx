/**
 * P7d — Facility creation (mobile payload → V2 backend): facilities built by the app's
 * creation wizard publish and book exactly as configured — event sessions with their own
 * prices, overnight rooms, an advance with the balance later, and a deposit on a free
 * item. Re-opening a facility in the wizard and saving without changes keeps its open
 * days, booking window, sessions, payment policy and a 0% refund.
 */
import React from 'react';
import { waitFor, fireEvent } from '@testing-library/react-native';
import { AmenityCreationWizard } from '@/src/features/amenities/components/creation-wizard';
import {
  mapAmenityCreationPayloadStrategy,
  AmenityCreationFormState,
} from '@/src/features/amenities/utils/mapAmenityCreationPayloadStrategy';
import { normalizeFacilityFromApi } from '@/src/features/amenities/utils/amenityPayloadMappers';
import { renderScreen } from '../helpers/render';
import { signInAs } from '../helpers/session';
import { closeDb } from '../helpers/db';
import { amenityApiAs, idemKey, istAt, istDate } from '../helpers/amenity';

afterAll(closeDb);

const run = Date.now().toString(36).slice(-5).toUpperCase();

const base: AmenityCreationFormState = {
  name: '',
  code: '',
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
  advanceNoticeHours: 0,
  requiresApproval: false,
  isMultiResourceFacility: false,
  pricingType: 'FIXED_EVENT',
  baseRate: 5000,
  securityDeposit: 2000,
  isCancellationAllowed: true,
  refundCutoffHours: 24,
  refundPercentage: 100,
};

/** Publishes a facility from wizard form state, exactly as the app does. */
const publish = async (form: AmenityCreationFormState) => {
  const res = await amenityApiAs('adminA', 'POST', '/facilities', mapAmenityCreationPayloadStrategy(form, false), {
    'x-idempotency-key': idemKey('fac'),
  });
  if (res.status !== 201) throw new Error(`Publish failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
};

const slotsFor = async (facilityId: string, date: string, resourceId?: string) =>
  (
    await amenityApiAs(
      'residentA',
      'GET',
      `/availability/daily-slots?facilityId=${facilityId}&date=${date}${resourceId ? `&resourceId=${resourceId}` : ''}`
    )
  ).body.data;

const hold = async (facilityId: string, start: string, end: string, extra: Record<string, any> = {}) => {
  const res = await amenityApiAs(
    'residentA',
    'POST',
    '/holds',
    { facilityId, requestedStartDateTime: start, requestedEndDateTime: end, headcount: 1, quantity: 1, holdType: 'STANDARD', ...extra },
    { 'x-idempotency-key': idemKey('hold') }
  );
  if (res.status !== 201) throw new Error(`Hold failed: ${res.status} ${JSON.stringify(res.body)}`);
  const h = res.body.data.hold;
  await amenityApiAs('residentA', 'POST', `/holds/${h._id}/expire`);
  return h;
};

describe('P7d facilities from the wizard book as configured', () => {
  it('event lawn by session, advance 25% + deposit now, balance later', async () => {
    const lawn = await publish({
      ...base,
      name: `Garden Lawn ${run}`,
      code: `LAWN-${run}`,
      bookingMode: 'SESSION',
      sessions: [
        { id: 'm', name: 'Morning', startTime: '08:00', endTime: '13:00', price: '3000' },
        { id: 'e', name: 'Evening', startTime: '16:00', endTime: '22:00', price: '4500' },
      ],
      paymentMode: 'ADVANCE',
      advanceType: 'PERCENT',
      advanceValue: '25',
    });
    expect(lawn.bookingMode).toBe('SESSION');

    const day = await slotsFor(lawn._id, istDate(10));
    expect(day.slots.map((s: any) => `${s.start}-${s.end}`)).toEqual(['08:00-13:00', '16:00-22:00']);

    const h = await hold(lawn._id, istAt(10, '16:00'), istAt(10, '22:00'));
    expect(h.pricingSnapshot.totalAmount).toBe(6500); // 4500 session + 2000 deposit
    expect(h.amountSchedule).toMatchObject({ mode: 'ADVANCE', dueNowAmount: 3125, balanceAmount: 3375 });
  });

  it('guest room by the night, check-in to check-out', async () => {
    const room = await publish({
      ...base,
      archetype: 'ROOM_RESOURCE',
      category: 'Guest Room',
      name: `Guest Suite ${run}`,
      code: `GST-${run}`,
      pricingType: 'DAILY',
      baseRate: 1200,
      securityDeposit: 0,
      stayMode: 'OVERNIGHT',
      checkInTime: '13:00',
      checkOutTime: '10:00',
      maxNights: '4',
      isMultiResourceFacility: true,
      subRooms: [{ id: 'r1', name: 'Suite 1', capacity: 2 }],
    });
    expect(room).toMatchObject({ stayMode: 'OVERNIGHT', checkInTime: '13:00', checkOutTime: '10:00', maxNights: 4 });

    // Rooms are booked one room at a time (the booking wizard asks which room first).
    const rooms = (await amenityApiAs('adminA', 'GET', `/resources?facilityId=${room._id}`)).body.data.data;
    expect(rooms.map((r: any) => r.name)).toEqual(['Suite 1']);
    const day = await slotsFor(room._id, istDate(3), rooms[0]._id);
    expect(day.slots[0].start).toBe('13:00');

    const h = await hold(room._id, istAt(3, '13:00'), istAt(5, '10:00'), { resourceId: rooms[0]._id });
    expect(h.pricingSnapshot.totalAmount).toBe(2400); // 2 nights
  });

  it('free tool kit with a ₹500 deposit collected on booking', async () => {
    const kit = await publish({
      ...base,
      archetype: 'INVENTORY_TOOLS',
      category: 'Tools',
      name: `Drill Kit ${run}`,
      code: `KIT-${run}`,
      pricingType: 'FREE',
      baseRate: 0,
      securityDeposit: '500',
      availableStock: 2,
      maxLoanHours: 48,
      requiresInspection: true,
    });
    expect(kit.pricingConfig).toMatchObject({ pricingType: 'FREE', securityDeposit: 500 });

    const h = await hold(kit._id, istAt(2, '10:00'), istAt(3, '10:00'));
    expect(h.amountSchedule).toMatchObject({ priceAmount: 0, depositAmount: 500, dueNowAmount: 500 });
  });
});

describe('P7d editing keeps what was configured', () => {
  it('re-saves a facility unchanged: open days, window, sessions, payment policy and 0% refund', async () => {
    const created = await publish({
      ...base,
      name: `Terrace ${run}`,
      code: `TER-${run}`,
      openDays: [1, 2, 3, 4, 5],
      advanceBookingDays: 21,
      refundPercentage: 0,
      refundCutoffHours: 0,
      bookingMode: 'SESSION',
      sessions: [{ id: 'e', name: 'Evening', startTime: '17:00', endTime: '21:00', price: '2500' }],
      paymentMode: 'PAY_AT_GATE',
    });
    const fetched = await amenityApiAs('adminA', 'GET', `/facilities/${created._id}`);
    const facility = normalizeFacilityFromApi(fetched.body.data);

    await signInAs('adminA');
    const onSubmit = jest.fn();
    const view = await renderScreen(
      <AmenityCreationWizard visible amenity={facility} initialArchetype="EVENT_SPACE" onClose={jest.fn()} onSubmit={onSubmit} />
    );
    for (let i = 0; i < 4; i++) {
      await fireEvent.press(view.getByLabelText('Continue to next step'));
    }
    await fireEvent.press(view.getByLabelText('Save Facility Updates'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled(), { timeout: 15000 });

    const payload = onSubmit.mock.calls[0][0];
    expect(payload.operatingHours.filter((h: any) => h.isOpen).map((h: any) => h.dayOfWeek)).toEqual([1, 2, 3, 4, 5]);
    expect(payload.advanceBookingDays).toBe(21);
    expect(payload.cancellationPolicy).toMatchObject({ refundPercentage: 0, refundCutoffHours: 0 });
    expect(payload.bookingMode).toBe('SESSION');
    expect(payload.sessions).toEqual([{ name: 'Evening', startTime: '17:00', endTime: '21:00', price: 2500 }]);
    expect(payload.paymentPolicy.mode).toBe('PAY_AT_GATE');
  });
});
