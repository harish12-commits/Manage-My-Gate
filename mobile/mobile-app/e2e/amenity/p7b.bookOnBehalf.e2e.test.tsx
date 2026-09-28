/**
 * P7b — Staff book on a resident's behalf (mobile UI → V2 backend): pick the resident and
 * facility from the Booking Queue, then the booking wizard takes the hold in the
 * resident's name and confirms it free of charge. A staff booking is itself the approval.
 * Residents cannot book for someone else or book without paying.
 */
import React from 'react';
import { waitFor, fireEvent } from '@testing-library/react-native';
import AdminBookingsRoute from '@/app/(resident)/amenities/admin-bookings';
import AmenityBookingRoute from '@/app/(resident)/amenities/booking/[id]';
import { store } from '@/src/store/store';
import { resetV2BookingState } from '@/src/features/amenities/store/amenityBookingSlice';
import { renderScreen, nav } from '../helpers/render';
import { signInAs, actor } from '../helpers/session';
import { lastCall, resetApiLog } from '../helpers/api';
import { tap, typeInto, expectVisible, visibleTexts } from '../helpers/ui';
import { closeDb, oid } from '../helpers/db';
import { facility, istDate, amenityApiAs, createHoldAs, confirmHoldAs, amenityCollection, walletBalance } from '../helpers/amenity';

afterAll(closeDb);

const currentStep = (view: any) => {
  const label = visibleTexts(view).find((text) => /^\d+%$/.test(text));
  return label ? Number(label.replace('%', '')) : 0;
};
const next = async (view: any) => {
  const from = await waitFor(() => {
    const n = currentStep(view);
    if (!n) throw new Error('no step indicator');
    return n;
  }, { timeout: 15000 });
  await tap(view, /^(Continue|Create Hold & Proceed)$/);
  await waitFor(() => expect(currentStep(view)).toBeGreaterThan(from), { timeout: 15000 });
};

describe('P7b staff booking from the queue', () => {
  let pushed: any = null;

  it('picks the resident, then the facility, and opens the booking wizard for them', async () => {
    const resident = actor('residentA');

    // 1. Queue → New booking → resident → facility
    resetApiLog();
    await signInAs('adminA');
    const queue = await renderScreen(<AdminBookingsRoute />);
    fireEvent.press(await queue.findByTestId('admin-new-booking'));
    await queue.findByTestId('resident-picker-sheet');
    await typeInto(queue, 'Search name, villa or phone', resident.name.split(' ')[0]);
    fireEvent.press(await queue.findByTestId(`resident-option-${resident.id}`, {}, { timeout: 15000 }));
    await queue.findByTestId('facility-picker-sheet');
    await waitFor(() => expect(lastCall('GET', '/amenity-management/facilities')?.status).toBe(200), { timeout: 15000 });
    fireEvent.press(await queue.findByTestId(`facility-option-${facility('court').id}`, {}, { timeout: 15000 }));

    const push = nav().calls.filter((c) => c.method === 'push').at(-1)!;
    pushed = push.args[0];
    expect(push.args[0]).toMatchObject({
      pathname: '/(resident)/amenities/booking/[id]',
      params: { id: facility('court').id, residentId: resident.id },
    });
  });

  it('books in the resident name at no charge', async () => {
    const resident = actor('residentA');
    const before = await walletBalance('residentA');
    expect(pushed).toBeTruthy();
    await signInAs('adminA');
    store.dispatch(resetV2BookingState());
    resetApiLog();
    nav().params = { ...pushed.params, date: istDate(1) };
    const view = await renderScreen(<AmenityBookingRoute />);
    await waitFor(() => expect(lastCall('GET', '/availability/daily-slots')?.status).toBe(200), { timeout: 15000 });
    await expectVisible(view, /^Selected:/); // the first offered time is picked
    await next(view);
    await next(view);
    await next(view);
    await waitFor(() => expect(lastCall('POST', '/amenity-management/holds')?.status).toBe(201), { timeout: 15000 });
    expect(lastCall('POST', '/amenity-management/holds')!.requestBody.residentId).toBe(resident.id);

    await view.findByTestId('staff-booking-notice');
    await expectVisible(view, 'No charge');
    expect(view.queryByText('Pay with')).toBeNull();
    fireEvent.press(view.getByLabelText('Confirm booking'));

    await waitFor(() => expect(lastCall('POST', '/reservations/confirm')?.status).toBe(201), { timeout: 15000 });
    expect(lastCall('POST', '/reservations/confirm')!.requestBody.paymentMethod).toBe('WAIVED');
    const id = lastCall('POST', '/reservations/confirm')!.responseBody.data.reservation._id;
    const r = await (await amenityCollection('reservations')).findOne({ _id: oid(id) });
    expect({
      resident: String(r!.residentId),
      bookedBy: String(r!.bookedBy),
      status: r!.bookingStatus,
      method: r!.paymentMethod,
      paid: r!.paidAmount,
    }).toEqual({
      resident: resident.id,
      bookedBy: actor('adminA').id,
      status: 'CONFIRMED',
      method: 'WAIVED',
      paid: 0,
    });
    expect(await walletBalance('residentA')).toBe(before);
  });
});

describe('P7b rules', () => {
  it('confirms a staff booking of an approval-only facility straight away', async () => {
    const hold = await createHoldAs('adminA', {
      facilityKey: 'hall',
      daysAhead: 21,
      start: '06:00',
      end: '22:00',
      headcount: 30,
      residentId: actor('residentB').id,
    });
    expect(hold.status).toBe(201);
    const confirm = await confirmHoldAs('adminA', hold.body.data.hold._id, { paymentMethod: 'WAIVED' });
    expect(confirm.status).toBe(201);
    const r = confirm.body.data.reservation;
    expect({ status: r.bookingStatus, approval: r.approvalStatus }).toEqual({ status: 'CONFIRMED', approval: 'APPROVED' });
    expect(confirm.body.data.rawToken).toBeTruthy(); // gate pass issued
  });

  it('keeps residents to their own name and never free of charge', async () => {
    const hold = await createHoldAs('residentB', {
      facilityKey: 'pool',
      daysAhead: 6,
      start: '12:00',
      end: '13:00',
      residentId: actor('residentA').id,
    });
    expect(hold.status).toBe(201);
    expect(String(hold.body.data.hold.residentId?._id || hold.body.data.hold.residentId)).toBe(actor('residentB').id);

    const waived = await confirmHoldAs('residentB', hold.body.data.hold._id, { paymentMethod: 'WAIVED' });
    expect(waived.status).toBe(403);
    await amenityApiAs('residentB', 'POST', `/holds/${hold.body.data.hold._id}/expire`);
  });
});
