/**
 * P7a — Staff booking queue (mobile UI → V2 backend): approve and reject (with a
 * required reason) bookings awaiting approval, decide bookings flagged for review,
 * cancel with the refund shown first, and record a balance paid in cash. Residents
 * never reach the queue.
 */
import React from 'react';
import { waitFor, fireEvent } from '@testing-library/react-native';
import AdminBookingsRoute from '@/app/(resident)/amenities/admin-bookings';
import { store } from '@/src/store/store';
import { setAdminQueueTab, setAdminQueueSearch } from '@/src/features/amenities/store/amenityBookingSlice';
import { renderScreen, nav } from '../helpers/render';
import { signInAs } from '../helpers/session';
import { lastCall, resetApiLog } from '../helpers/api';
import { typeInto, expectVisible } from '../helpers/ui';
import { closeDb, oid } from '../helpers/db';
import { bookAs, amenityApiAs, amenityCollection, walletBalance, HoldInput } from '../helpers/amenity';

afterAll(closeDb);

const hallDay = (daysAhead: number): HoldInput => ({ facilityKey: 'hall', daysAhead, start: '06:00', end: '22:00', headcount: 30 });
const reservationDoc = async (id: string) => (await amenityCollection('reservations')).findOne({ _id: oid(id) });

const openQueue = async (tab: 'APPROVALS' | 'REVIEW' | 'UPCOMING' | 'ALL', search = '') => {
  store.dispatch(setAdminQueueTab(tab));
  store.dispatch(setAdminQueueSearch(search));
  resetApiLog();
  await signInAs('adminA');
  const view = await renderScreen(<AdminBookingsRoute />);
  await waitFor(() => expect(lastCall('GET', '/amenity-management/reservations')?.status).toBe(200), { timeout: 15000 });
  return view;
};

const openBooking = async (view: any, id: string) => {
  fireEvent.press(await view.findByTestId(`admin-booking-${id}`, {}, { timeout: 15000 }));
  await view.findByTestId('admin-booking-sheet');
};

/** The confirm button of the open ConfirmationModal (the last element with that label). */
const confirmModal = async (view: any, label: RegExp) => {
  const buttons = await view.findAllByText(label);
  fireEvent.press(buttons[buttons.length - 1]);
};

describe('P7a approvals', () => {
  it('lists a booking awaiting approval and approves it', async () => {
    const { reservation } = await bookAs('residentA', hallDay(26), { paymentMethod: 'WALLET' });
    const view = await openQueue('APPROVALS');
    expect(lastCall('GET', '/amenity-management/reservations')!.url).toContain('bookingStatus=PENDING_APPROVAL');

    await openBooking(view, reservation._id);
    fireEvent.press(view.getByTestId('admin-booking-approve'));
    await expectVisible(view, 'Approve booking?');
    await confirmModal(view, /^Approve$/i);
    await waitFor(() => expect(lastCall('POST', `/reservations/${reservation._id}/review`)?.status).toBe(200), { timeout: 15000 });
    expect(lastCall('POST', `/reservations/${reservation._id}/review`)!.requestBody).toMatchObject({ action: 'APPROVE' });

    const r = await reservationDoc(reservation._id);
    expect({ booking: r!.bookingStatus, approval: r!.approvalStatus }).toEqual({ booking: 'CONFIRMED', approval: 'APPROVED' });
    await waitFor(() => expect(view.queryByTestId(`admin-booking-${reservation._id}`)).toBeNull(), { timeout: 15000 });
  });

  it('requires a reason to reject, and refunds what was paid', async () => {
    const { reservation } = await bookAs('residentA', hallDay(29), { paymentMethod: 'WALLET' });
    const before = await walletBalance('residentA');
    const view = await openQueue('APPROVALS');
    await openBooking(view, reservation._id);
    fireEvent.press(view.getByTestId('admin-booking-reject'));

    await view.findByTestId('reject-booking-sheet');
    await expectVisible(view, '₹3,250 paid will be refunded to the resident wallet.');
    fireEvent.press(view.getByTestId('reject-booking-confirm')); // disabled without a reason
    expect(lastCall('POST', `/reservations/${reservation._id}/review`)).toBeUndefined();

    await typeInto(view, 'e.g. The hall is reserved for a community event', 'Hall reserved for the society AGM');
    fireEvent.press(view.getByTestId('reject-booking-confirm'));
    await waitFor(() => expect(lastCall('POST', `/reservations/${reservation._id}/review`)?.status).toBe(200), { timeout: 15000 });

    const r = await reservationDoc(reservation._id);
    expect(r!.bookingStatus).toBe('REJECTED');
    expect((await walletBalance('residentA'))! - before!).toBe(3250);

    // The API refuses a rejection without a reason, whatever the client sends.
    const other = await bookAs('residentB', hallDay(24), { paymentMethod: 'WALLET' });
    const bare = await amenityApiAs('adminA', 'POST', `/reservations/${other.reservation._id}/review`, { action: 'REJECT' });
    expect(bare.status).toBe(400);
  });
});

describe('P7a flagged bookings', () => {
  it('refunds a stated share of a no-show booking with a reason', async () => {
    const { reservation } = await bookAs(
      'residentA',
      { facilityKey: 'pool', daysAhead: 6, start: '16:00', end: '17:00', headcount: 2 },
      { paymentMethod: 'WALLET' }
    );
    await (await amenityCollection('reservations')).updateOne(
      { _id: oid(reservation._id) },
      { $set: { adminReview: { status: 'PENDING', reason: 'NO_SHOW', flaggedAt: new Date() } } }
    );
    const before = await walletBalance('residentA');

    const view = await openQueue('REVIEW');
    expect(lastCall('GET', '/amenity-management/reservations')!.url).toContain('adminReviewStatus=PENDING');
    await openBooking(view, reservation._id);
    fireEvent.press(view.getByTestId('admin-booking-decide'));
    await view.findByTestId('review-decision-sheet');

    fireEvent.press(await view.findByText('Refund a different share'));
    await typeInto(view, '50', '25');
    fireEvent.press(view.getByTestId('review-decision-confirm')); // reason still missing
    expect(lastCall('POST', `/reservations/${reservation._id}/resolve-review`)).toBeUndefined();
    await typeInto(view, 'Visible to amenity staff', 'Resident was unwell');
    fireEvent.press(view.getByTestId('review-decision-confirm'));

    await waitFor(() => expect(lastCall('POST', `/reservations/${reservation._id}/resolve-review`)?.status).toBe(200), { timeout: 15000 });
    expect(lastCall('POST', `/reservations/${reservation._id}/resolve-review`)!.requestBody).toEqual({
      action: 'REFUND_CUSTOM',
      refundPercentage: 25,
      notes: 'Resident was unwell',
    });
    const r = await reservationDoc(reservation._id);
    expect({ review: r!.adminReview.status, resolution: r!.adminReview.resolution }).toEqual({ review: 'RESOLVED', resolution: 'REFUND_CUSTOM' });
    expect((await walletBalance('residentA'))! - before!).toBe(50); // 25% of ₹200
  });
});

describe('P7a cancel and cash', () => {
  it('cancels a booking for the resident with the full refund shown first', async () => {
    const { reservation } = await bookAs('residentB', { facilityKey: 'court', daysAhead: 3, start: '18:50', end: '19:50' }, { paymentMethod: 'WALLET' });
    const before = await walletBalance('residentB');
    const view = await openQueue('UPCOMING', reservation.reservationNumber);
    expect(lastCall('GET', '/amenity-management/reservations')!.url).toContain(`search=${reservation.reservationNumber}`);
    await openBooking(view, reservation._id);
    fireEvent.press(view.getByTestId('admin-booking-cancel'));

    await waitFor(() => expect(lastCall('GET', `/reservations/${reservation._id}/cancellation-preview`)?.status).toBe(200), { timeout: 15000 });
    await expectVisible(view, '₹300 will be refunded to the resident wallet.');
    await typeInto(view, 'Shown to the resident, e.g. Court resurfacing', 'Court resurfacing');
    fireEvent.press(view.getByTestId('cancel-sheet-confirm'));

    await waitFor(() => expect(lastCall('POST', `/reservations/${reservation._id}/cancel`)?.status).toBe(200), { timeout: 15000 });
    const r = await reservationDoc(reservation._id);
    expect({ status: r!.bookingStatus, reason: r!.cancellationReason, refund: r!.refundAmount }).toEqual({
      status: 'CANCELLED',
      reason: 'Court resurfacing',
      refund: 300,
    });
    expect((await walletBalance('residentB'))! - before!).toBe(300);
  });

  it('records a pay-at-gate balance received in cash', async () => {
    const { reservation } = await bookAs('residentB', { facilityKey: 'hallSessions', daysAhead: 17, start: '08:00', end: '13:00', headcount: 20 });
    const view = await openQueue('UPCOMING', reservation.reservationNumber);
    await openBooking(view, reservation._id);
    fireEvent.press(view.getByTestId('admin-booking-collect'));
    await expectVisible(view, 'Record cash payment?');
    await confirmModal(view, /^Record payment$/i);

    await waitFor(() => expect(lastCall('POST', `/reservations/${reservation._id}/collect-payment`)?.status).toBe(200), { timeout: 15000 });
    const r = await reservationDoc(reservation._id);
    expect({ status: r!.paymentStatus, balance: r!.balanceAmount, method: r!.payments.at(-1).method }).toEqual({
      status: 'PAID',
      balance: 0,
      method: 'CASH',
    });
  });
});

describe('P7a access', () => {
  it('sends residents away from the queue', async () => {
    await signInAs('residentA');
    nav().redirects.length = 0;
    await renderScreen(<AdminBookingsRoute />);
    expect(nav().redirects).toContain('/(resident)/dashboard');
  });
});
