/**
 * P5b — My Bookings and the booking detail (mobile UI → V2 backend): the balance still
 * due is shown and paid from the wallet or online, cancelling shows the server's refund
 * preview before anything changes and refunds that exact amount to the wallet, blocked
 * cancellations explain why, and bookings under staff review say so.
 */
import React from 'react';
import { waitFor, fireEvent } from '@testing-library/react-native';
import ReservationDetailScreen from '@/app/(resident)/amenities/reservations/[id]';
import MyBookingsScreen from '@/app/(resident)/amenities/my-bookings';
import { store } from '@/src/store/store';
import { resetV2BookingState } from '@/src/features/amenities/store/amenityBookingSlice';
import { renderScreen, nav } from '../helpers/render';
import { signInAs } from '../helpers/session';
import { lastCall, resetApiLog } from '../helpers/api';
import { tap, typeInto, expectVisible } from '../helpers/ui';
import { closeDb, oid } from '../helpers/db';
import { bookAs, amenityApiAs, amenityCollection, walletBalance, HoldInput } from '../helpers/amenity';
import { connectAs } from '../helpers/socket';

afterAll(closeDb);

// Checkout runs in a WebView (native); the test replies through the modal's onSuccess,
// exactly as the WebView bridge does after Razorpay's handler fires.
jest.mock('@/src/features/billing/components/RazorpayCheckoutModal', () => {
  const checkout: { props: any } = { props: null };
  (globalThis as any).__e2eCheckout = checkout;
  return {
    RazorpayCheckoutModal: (props: any) => {
      checkout.props = props.visible ? props : checkout.props;
      return null;
    },
  };
});
const checkoutProps = () => (globalThis as any).__e2eCheckout.props;

const hallDay = (daysAhead: number): HoldInput => ({ facilityKey: 'hall', daysAhead, start: '06:00', end: '22:00', headcount: 30 });
const reservationDoc = async (id: string) => (await amenityCollection('reservations')).findOne({ _id: oid(id) });

const openDetail = async (id: string) => {
  store.dispatch(resetV2BookingState());
  resetApiLog();
  nav().params = { id };
  const view = await renderScreen(<ReservationDetailScreen />);
  await waitFor(() => expect(lastCall('GET', `/reservations/${id}`)?.status).toBe(200), { timeout: 15000 });
  return view;
};

const openCancelSheet = async (view: any, id: string) => {
  fireEvent.press(await view.findByLabelText('Cancel Booking'));
  await waitFor(() => expect(lastCall('GET', `/reservations/${id}/cancellation-preview`)?.status).toBe(200), { timeout: 15000 });
};

describe('P5b balance due: advance booking paid off from the wallet', () => {
  let id: string;
  beforeAll(async () => {
    await signInAs('residentA');
    ({ reservation: { _id: id } } = await bookAs('residentA', hallDay(27), { paymentMethod: 'WALLET' }));
  });

  it('flags the balance on the My Bookings card', async () => {
    store.dispatch(resetV2BookingState());
    const view = await renderScreen(<MyBookingsScreen />);
    await expectVisible(view, 'Balance ₹3,750 due');
  });

  it('shows what was paid and what is due, then pays the balance from the wallet', async () => {
    const before = await walletBalance('residentA');
    const view = await openDetail(id);
    await expectVisible(view, 'Balance due: ₹3,750');
    // paid: 25% advance + ₹2,000 deposit (Paid row and the payment in the history)
    expect(view.getAllByText('₹3,250').length).toBe(2);

    await tap(view, 'Pay ₹3,750 from wallet');
    await waitFor(() => expect(lastCall('POST', `/reservations/${id}/pay-balance`)?.status).toBe(200), { timeout: 15000 });

    await waitFor(() => expect(view.queryByText('Balance due: ₹3,750')).toBeNull(), { timeout: 15000 });
    expect(view.getAllByText('Paid').length).toBeGreaterThanOrEqual(1);
    expect(view.getByText('Balance · Wallet')).toBeOnTheScreen();
    const r = await reservationDoc(id);
    expect({ status: r!.paymentStatus, balance: r!.balanceAmount, paid: r!.paidAmount }).toEqual({ status: 'PAID', balance: 0, paid: 7000 });
    expect(before! - (await walletBalance('residentA'))!).toBe(3750);
  });
});

describe('P5b balance due: pay-at-gate booking paid online in advance', () => {
  it('opens checkout for the balance and shows the booking the server settled', async () => {
    await signInAs('residentB');
    const { reservation } = await bookAs('residentB', { facilityKey: 'hallSessions', daysAhead: 13, start: '08:00', end: '13:00', headcount: 20 });
    const view = await openDetail(reservation._id);
    await tap(view, 'Pay ₹3,000 online');
    await waitFor(() => expect(lastCall('POST', '/payments/orders')?.status).toBe(201), { timeout: 15000 });
    expect(lastCall('POST', '/payments/orders')!.requestBody).toEqual({ reservationId: reservation._id });

    const order = lastCall('POST', '/payments/orders')!.responseBody.data;
    await waitFor(() => expect(checkoutProps()?.options?.orderId).toBe(order.orderId));
    await checkoutProps().onSuccess({
      paymentId: order.paymentId,
      orderId: order.orderId,
      razorpayPaymentId: `pay_mock_${Date.now()}`,
      razorpaySignature: `sig_mock_${Date.now()}`,
    });

    await waitFor(() => expect(lastCall('POST', '/payments/verify')?.status).toBe(200), { timeout: 15000 });
    await waitFor(() => expect(view.queryByText('Balance due: ₹3,000')).toBeNull(), { timeout: 15000 });
    expect(view.getByText('Balance · Online')).toBeOnTheScreen();
    const r = await reservationDoc(reservation._id);
    expect({ status: r!.paymentStatus, balance: r!.balanceAmount }).toEqual({ status: 'PAID', balance: 0 });
  });
});

describe('P5b cancel with refund preview', () => {
  it('shows the policy refund before cancelling and credits exactly that to the wallet', async () => {
    await signInAs('residentA');
    const { reservation } = await bookAs(
      'residentA',
      { facilityKey: 'pool', daysAhead: 4, start: '18:00', end: '19:00', headcount: 2 },
      { paymentMethod: 'WALLET' }
    );
    const before = await walletBalance('residentA');
    const view = await openDetail(reservation._id);
    await openCancelSheet(view, reservation._id);

    // ₹200 paid; the pool refunds 50% when cancelled 24h+ ahead.
    await expectVisible(view, '₹100 will be refunded to your wallet.');
    expect(view.getByText('Booking: ₹100 (50%)')).toBeOnTheScreen();
    expect((await reservationDoc(reservation._id))!.bookingStatus).toBe('CONFIRMED'); // preview changed nothing

    await typeInto(view, 'Tell the management why you are cancelling', 'Travelling that day');
    await fireEvent.press(view.getByTestId('cancel-sheet-confirm'));
    await waitFor(() => expect(lastCall('POST', `/reservations/${reservation._id}/cancel`)?.status).toBe(200), { timeout: 15000 });
    expect(lastCall('POST', `/reservations/${reservation._id}/cancel`)!.requestBody).toEqual({ reason: 'Travelling that day' });

    await expectVisible(view, 'Refunded to wallet');
    const r = await reservationDoc(reservation._id);
    expect({ status: r!.bookingStatus, refund: r!.refundAmount, reason: r!.cancellationReason }).toEqual({
      status: 'CANCELLED',
      refund: 100,
      reason: 'Travelling that day',
    });
    expect((await walletBalance('residentA'))! - before!).toBe(100);
  });

  it('explains why a booking cannot be cancelled and offers no confirm', async () => {
    await signInAs('residentB');
    const { reservation } = await bookAs('residentB', hallDay(28), { paymentMethod: 'WALLET' });
    await (await amenityCollection('reservations')).updateOne(
      { _id: oid(reservation._id) },
      { $set: { 'policySnapshot.cancellation.isAllowed': false, approvalStatus: 'APPROVED', bookingStatus: 'CONFIRMED' } }
    );
    const view = await openDetail(reservation._id);
    await openCancelSheet(view, reservation._id);

    await expectVisible(view, /does not allow/i);
    expect(view.queryByTestId('cancel-sheet-confirm')).toBeNull();
    expect(lastCall('GET', `/reservations/${reservation._id}/cancellation-preview`)!.responseBody.data).toMatchObject({ allowed: false });
  });
});

describe('P5b real-time updates to the resident', () => {
  it("delivers booking and balance-payment events to the resident's own room", async () => {
    await signInAs('residentB');
    const device = await connectAs('residentB');
    try {
      const { reservation } = await bookAs('residentB', { facilityKey: 'hallSessions', daysAhead: 14, start: '08:00', end: '13:00', headcount: 20 });
      const confirmed = await device.waitForEvent('RESERVATION_CONFIRMED', (p) => String(p?._id) === String(reservation._id));
      expect(confirmed.bookingStatus).toBe('CONFIRMED');

      const paid = await amenityApiAs('residentB', 'POST', `/reservations/${reservation._id}/pay-balance`, { paymentMethod: 'WALLET' });
      expect(paid.status).toBe(200);
      const updated = await device.waitForEvent('RESERVATION_UPDATED', (p) => String(p?._id) === String(reservation._id));
      expect({ status: updated.paymentStatus, balance: updated.balanceAmount }).toEqual({ status: 'PAID', balance: 0 });
    } finally {
      device.close();
    }
  });
});

describe('P5b staff review notice', () => {
  it('tells the resident a no-show booking is being reviewed', async () => {
    await signInAs('residentA');
    const { reservation } = await bookAs('residentA', { facilityKey: 'pool', daysAhead: 4, start: '20:00', end: '21:00' }, { paymentMethod: 'WALLET' });
    await (await amenityCollection('reservations')).updateOne(
      { _id: oid(reservation._id) },
      { $set: { adminReview: { status: 'PENDING', reason: 'NO_SHOW', flaggedAt: new Date() } } }
    );
    const view = await openDetail(reservation._id);
    await expectVisible(view, 'Under review by the management');
    expect(view.getByTestId('reservation-review-notice')).toBeOnTheScreen();
  });
});
