/**
 * P5a — Resident booking wizard (mobile UI → V2 backend only): windows come from the
 * server for each facility type, the payment step shows what is due now vs later, and
 * wallet / online / nothing-due-now bookings are confirmed through V2. The legacy
 * /amenity-bookings endpoint is never used.
 */
import React from 'react';
import { waitFor, fireEvent } from '@testing-library/react-native';
import AmenityBookingRoute from '@/app/(resident)/amenities/booking/[id]';
import { store } from '@/src/store/store';
import { resetV2BookingState } from '@/src/features/amenities/store/amenityBookingSlice';
import { renderScreen, nav } from '../helpers/render';
import { signInAs } from '../helpers/session';
import { findCalls, lastCall, resetApiLog } from '../helpers/api';
import { tap, expectVisible, visibleTexts } from '../helpers/ui';
import { closeDb, oid } from '../helpers/db';
import { facility, istDate, amenityCollection, walletBalance, FacilityKey } from '../helpers/amenity';

afterAll(closeDb);

// The checkout page runs in a WebView (native). The test stands in for it: it reads the
// order the app opened checkout with and replies through the modal's onSuccess, exactly
// as the WebView bridge does after Razorpay's handler fires.
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

const openBooking = async (key: FacilityKey, daysAhead: number) => {
  store.dispatch(resetV2BookingState());
  resetApiLog();
  nav().params = { id: facility(key).id, date: istDate(daysAhead) };
  const view = await renderScreen(<AmenityBookingRoute />);
  await waitFor(() => expect(lastCall('GET', '/availability/daily-slots')?.status).toBe(200), { timeout: 15000 });
  return view;
};

/** Presses the footer's primary action and waits for the step indicator to move on. */
/** Wizard progress as shown in the step indicator ("20%", "40%", …). */
const currentStep = (view: any) => {
  const label = visibleTexts(view).find((text) => /^\d+%$/.test(text));
  return label ? Number(label.replace('%', '')) : 0;
};
const next = async (view: any) => {
  const from = await waitFor(() => {
    const n = currentStep(view);
    if (!n) throw new Error('no step indicator: ' + JSON.stringify(visibleTexts(view)));
    return n;
  }, { timeout: 15000 });
  await tap(view, /^(Continue|Create Hold & Proceed)$/);
  await waitFor(() => expect(currentStep(view)).toBeGreaterThan(from), { timeout: 15000 });
};
const createHold = async (view: any) => {
  await next(view);
  await waitFor(() => expect(lastCall('POST', '/amenity-management/holds')?.status).toBe(201), { timeout: 15000 });
};
const reservationFromConfirm = () => lastCall('POST', '/reservations/confirm')!.responseBody.data.reservation;
const noLegacyBooking = () => expect(findCalls('POST', '/amenity-bookings')).toHaveLength(0);

describe('P5a booking wizard: pay from the wallet (court, full payment)', () => {
  it('books the first offered slot and pays the amount due from the wallet', async () => {
    await signInAs('residentB');
    const before = await walletBalance('residentB');
    const view = await openBooking('court', 7);

    await next(view); // schedule → players
    await next(view); // players → review
    await expectVisible(view, 'Review Booking Details');
    await createHold(view);

    await expectVisible(view, 'Pay ₹300 from wallet');
    expect(view.getByText('Due now')).toBeOnTheScreen();
    await tap(view, 'Pay ₹300 from wallet');

    await waitFor(() => expect(lastCall('POST', '/reservations/confirm')?.status).toBe(201), { timeout: 15000 });
    expect(lastCall('POST', '/reservations/confirm')!.requestBody).toMatchObject({ paymentMethod: 'WALLET' });
    await expectVisible(view, 'Reservation Confirmed!');
    const r = await (await amenityCollection('reservations')).findOne({ _id: oid(reservationFromConfirm()._id) });
    expect({ status: r!.paymentStatus, method: r!.paymentMethod, paid: r!.paidAmount }).toEqual({ status: 'PAID', method: 'WALLET', paid: 300 });
    expect(before! - (await walletBalance('residentB'))!).toBe(300);
    noLegacyBooking();
  });
});

describe('P5a booking wizard: advance + balance (party hall)', () => {
  it('asks only for the advance and deposit now and shows the balance for later', async () => {
    await signInAs('residentA');
    const view = await openBooking('hall', 25);
    await expectVisible(view, 'Full Day');
    await next(view);
    await next(view);
    await createHold(view);

    await expectVisible(view, 'Pay ₹3,250 from wallet');
    expect(view.getByText('₹3,750')).toBeOnTheScreen(); // balance
    expect(view.getByText('₹2,000')).toBeOnTheScreen(); // deposit
    await tap(view, 'Pay ₹3,250 from wallet');
    await waitFor(() => expect(lastCall('POST', '/reservations/confirm')?.status).toBe(201), { timeout: 15000 });
    const r = reservationFromConfirm();
    expect({ status: r.paymentStatus, balance: r.balanceAmount }).toEqual({ status: 'ADVANCE_PAID', balance: 3750 });
    noLegacyBooking();
  });
});

describe('P5a booking wizard: pay at the gate (lawn sessions)', () => {
  it('offers the published sessions and confirms with nothing to pay now', async () => {
    await signInAs('residentB');
    const view = await openBooking('hallSessions', 9);
    await expectVisible(view, 'Available sessions');
    await tap(view, 'Evening');
    await next(view);
    await next(view);
    await createHold(view);

    await expectVisible(view, 'Nothing now');
    await expectVisible(view, 'Pay ₹4,500 at the gate before entry.');
    await tap(view, 'Confirm booking');
    await waitFor(() => expect(lastCall('POST', '/reservations/confirm')?.status).toBe(201), { timeout: 15000 });
    expect(lastCall('POST', '/reservations/confirm')!.requestBody.paymentMethod).toBeUndefined();
    await expectVisible(view, 'Booking confirmed — balance due');
    const r = reservationFromConfirm();
    expect({ status: r.paymentStatus, balance: r.balanceAmount }).toEqual({ status: 'PENDING', balance: 4500 });
  });
});

describe('P5a booking wizard: overnight stay and multi-day loan', () => {
  it('books a two-night stay from check-in to check-out', async () => {
    await signInAs('residentA');
    const view = await openBooking('guestRoom', 2);
    await next(view); // suite (single suite auto-selected) → check-in
    await expectVisible(view, 'Nights');
    fireEvent.press(view.getByLabelText('Increase count'));
    await next(view);
    await next(view);
    await createHold(view);

    const hold = lastCall('POST', '/amenity-management/holds')!;
    const start = new Date(hold.requestBody.requestedStartDateTime).getTime();
    const end = new Date(hold.requestBody.requestedEndDateTime).getTime();
    expect((end - start) / 3600000).toBe(45); // 14:00 → 11:00 two days later
    expect(hold.responseBody.data.pricingSnapshot.totalAmount).toBe(3000);
  });

  it('lends tools for several days with the deposit due now', async () => {
    await signInAs('residentB');
    const view = await openBooking('tools', 5);
    await next(view); // equipment (single kit auto-selected) → schedule
    await expectVisible(view, 'Return');
    await tap(view, 'After 2 day(s)');
    await next(view);
    await next(view);
    await createHold(view);

    const hold = lastCall('POST', '/amenity-management/holds')!;
    const hours = (new Date(hold.requestBody.requestedEndDateTime).getTime() - new Date(hold.requestBody.requestedStartDateTime).getTime()) / 3600000;
    expect(hours).toBe(48);
    await expectVisible(view, 'Pay ₹500 from wallet');
  });
});

describe('P5a booking wizard: online payment and leaving', () => {
  it('pays online and shows the booking the server created from the verified payment', async () => {
    await signInAs('residentA');
    const view = await openBooking('court', 7);
    await next(view);
    await next(view);
    await createHold(view);
    await tap(view, 'Pay online');
    await tap(view, 'Pay ₹300 online');
    await waitFor(() => expect(lastCall('POST', '/payments/orders')?.status).toBe(201), { timeout: 15000 });

    const order = lastCall('POST', '/payments/orders')!.responseBody.data;
    await waitFor(() => expect(checkoutProps()?.options?.orderId).toBe(order.orderId));
    await checkoutProps().onSuccess({
      paymentId: order.paymentId,
      orderId: order.orderId,
      razorpayPaymentId: `pay_mock_${Date.now()}`,
      razorpaySignature: `sig_mock_${Date.now()}`,
    });

    await waitFor(() => expect(lastCall('POST', '/payments/verify')?.status).toBe(200), { timeout: 15000 });
    await expectVisible(view, 'Reservation Confirmed!');
    const reservation = lastCall('POST', '/payments/verify')!.responseBody.data.reservation;
    expect({ status: reservation.paymentStatus, method: reservation.paymentMethod }).toEqual({ status: 'PAID', method: 'RAZORPAY' });
    expect(findCalls('POST', '/reservations/confirm')).toHaveLength(0);
    noLegacyBooking();
  });

  it('releases the held time when the resident leaves the payment step', async () => {
    await signInAs('residentB');
    const view = await openBooking('court', 7);
    await next(view);
    await next(view);
    await createHold(view);
    const holdId = lastCall('POST', '/amenity-management/holds')!.responseBody.data.hold._id;

    fireEvent.press(view.getByLabelText('Go back to previous step'));
    await tap(view, 'Leave & Release Hold');
    await waitFor(() => expect(lastCall('POST', `/holds/${holdId}/expire`)?.status).toBe(200), { timeout: 15000 });
    const hold = await (await amenityCollection('reservation_holds')).findOne({ _id: oid(holdId) });
    expect(hold!.status).toBe('EXPIRED');
  });
});
