/**
 * P9 — Full amenity journeys across roles. Each step is one actor on their own screen
 * (resident, amenity staff, gate guard), picking up only what the previous step left in
 * the system. Money is checked at every step against the wallets and the booking.
 *
 *  1. Party hall: advance paid → staff approve → resident pays the balance online →
 *     guard admits → guard records the exit → deposit back in the wallet.
 *  2. Tool loan: deposit paid → guard lends → returned damaged, part of the deposit kept
 *     → resident sees the settlement.
 *  3. Lawn, pay at the gate: guard collects the cash and admits → it shows in the
 *     staff ledger and today's collections.
 */
import React from 'react';
import { waitFor, fireEvent } from '@testing-library/react-native';
import AdminBookingsRoute from '@/app/(resident)/amenities/admin-bookings';
import ReservationDetailScreen from '@/app/(resident)/amenities/reservations/[id]';
import ScannerScreen from '@/app/(resident)/amenities/scanner';
import { store } from '@/src/store/store';
import {
  resetV2BookingState,
  setAdminQueueTab,
  setAdminQueueSearch,
  clearV2PassResults,
} from '@/src/features/amenities/store/amenityBookingSlice';
import { renderScreen, nav } from '../helpers/render';
import { signInAs } from '../helpers/session';
import { apiAs } from '../helpers/backend';
import { lastCall, resetApiLog } from '../helpers/api';
import { tap, typeInto, expectVisible } from '../helpers/ui';
import { closeDb, oid } from '../helpers/db';
import { bookAs, amenityCollection, walletBalance, HoldInput } from '../helpers/amenity';

afterAll(closeDb);

// Checkout runs in a WebView (native): the test answers through the modal's onSuccess.
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

const reservationDoc = async (id: string) => (await amenityCollection('reservations')).findOne({ _id: oid(id) });

/** The booking (and its passes) starts `startMin` and ends `endMin` minutes from now. */
const shiftTo = async (id: string, startMin: number, endMin: number) => {
  const start = new Date(Date.now() + startMin * 60000);
  const end = new Date(Date.now() + endMin * 60000);
  await (await amenityCollection('reservations')).updateOne(
    { _id: oid(id) },
    { $set: { requestedStartDateTime: start, effectiveStartDateTime: start, requestedEndDateTime: end, effectiveEndDateTime: end } }
  );
  await (await amenityCollection('access_passes')).updateMany({ reservationId: oid(id) }, { $set: { validFrom: start, validUntil: end } });
};

/** Resident opens their booking. */
const openDetail = async (id: string) => {
  store.dispatch(resetV2BookingState());
  resetApiLog();
  nav().params = { id };
  const view = await renderScreen(<ReservationDetailScreen />);
  await waitFor(() => expect(lastCall('GET', `/reservations/${id}`)?.status).toBe(200), { timeout: 15000 });
  return view;
};

/** Guard types the booking number at the gate console. */
const guardScans = async (reservationNumber: string) => {
  store.dispatch(clearV2PassResults());
  resetApiLog();
  await signInAs('guardA');
  const view = await renderScreen(<ScannerScreen />);
  await typeInto(view, 'Enter Pass Token or QR Code...', reservationNumber);
  await fireEvent.press(view.getByLabelText('Search Pass Code'));
  await waitFor(() => expect(lastCall('POST', '/passes/check-in')).toBeTruthy(), { timeout: 15000 });
  return view;
};

describe('Journey 1: party hall with an advance, approval, balance online and a deposit', () => {
  const hall: HoldInput = { facilityKey: 'hall', daysAhead: 15, start: '06:00', end: '22:00', headcount: 40 };
  let booking: any;
  let walletStart: number;

  it('1. resident books: pays the ₹1,250 advance + ₹2,000 deposit, awaiting approval', async () => {
    walletStart = (await walletBalance('residentA'))!;
    ({ reservation: booking } = await bookAs('residentA', hall, { paymentMethod: 'WALLET' }));
    const r = await reservationDoc(booking._id);
    expect({ status: r!.bookingStatus, pay: r!.paymentStatus, paid: r!.paidAmount, balance: r!.balanceAmount }).toEqual({
      status: 'PENDING_APPROVAL',
      pay: 'ADVANCE_PAID',
      paid: 3250,
      balance: 3750,
    });
    expect(walletStart - (await walletBalance('residentA'))!).toBe(3250);
  });

  it('2. staff approve it from the Booking Queue', async () => {
    store.dispatch(setAdminQueueTab('APPROVALS'));
    store.dispatch(setAdminQueueSearch(booking.reservationNumber));
    resetApiLog();
    await signInAs('adminA');
    const view = await renderScreen(<AdminBookingsRoute />);
    await fireEvent.press(await view.findByTestId(`admin-booking-${booking._id}`, {}, { timeout: 15000 }));
    await fireEvent.press(await view.findByTestId('admin-booking-approve'));
    await expectVisible(view, 'Approve booking?');
    const buttons = await view.findAllByText(/^Approve$/i);
    await fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() => expect(lastCall('POST', `/reservations/${booking._id}/review`)?.status).toBe(200), { timeout: 15000 });
    expect((await reservationDoc(booking._id))!.bookingStatus).toBe('CONFIRMED');
  });

  it('3. resident pays the ₹3,750 balance online from the booking', async () => {
    await signInAs('residentA');
    const view = await openDetail(booking._id);
    await expectVisible(view, 'Balance due: ₹3,750');
    await tap(view, 'Pay ₹3,750 online');
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
    const r = await reservationDoc(booking._id);
    expect({ pay: r!.paymentStatus, paid: r!.paidAmount, balance: r!.balanceAmount }).toEqual({ pay: 'PAID', paid: 7000, balance: 0 });
  });

  it('4. guard admits the party on the day', async () => {
    await shiftTo(booking._id, 5, 600);
    const view = await guardScans(booking.reservationNumber);
    expect(lastCall('POST', '/passes/check-in')!.status).toBe(200);
    await expectVisible(view, 'Facility Entry Verified');
    expect((await reservationDoc(booking._id))!.accessStatus).toBe('CHECKED_IN');
  });

  it('5. guard records the exit; the ₹2,000 deposit goes back to the wallet', async () => {
    const before = (await walletBalance('residentA'))!;
    const view = await guardScans(booking.reservationNumber);
    await tap(view, 'Record exit');
    await waitFor(() => expect(lastCall('POST', '/passes/check-out')?.status).toBe(200), { timeout: 15000 });
    await expectVisible(view, 'The booking is complete.');
    const r = await reservationDoc(booking._id);
    expect({ done: r!.completionStatus, refunded: r!.depositSettlement.refunded, kept: r!.depositSettlement.retained }).toEqual({
      done: 'COMPLETED',
      refunded: 2000,
      kept: 0,
    });
    expect((await walletBalance('residentA'))! - before).toBe(2000);
    // Overall the resident paid the ₹5,000 hall fee: ₹3,250 wallet + ₹3,750 online − ₹2,000 deposit back.
    expect(walletStart - (await walletBalance('residentA'))!).toBe(3250 - 2000);
  });

  it('6. resident sees the booking paid and the deposit returned', async () => {
    await signInAs('residentA');
    const view = await openDetail(booking._id);
    await expectVisible(view, '₹2,000 returned');
    expect(view.getByText('Balance · Online')).toBeOnTheScreen();
    expect(view.queryByText(/Balance due/)).toBeNull();
  });
});

describe('Journey 2: tool loan returned damaged', () => {
  let booking: any;

  it('1. resident borrows the tool kit and pays the ₹500 deposit', async () => {
    ({ reservation: booking } = await bookAs(
      'residentB',
      { facilityKey: 'tools', daysAhead: 1, endDaysAhead: 2, start: '11:00', end: '11:00', quantity: 1 },
      { paymentMethod: 'WALLET' }
    ));
    expect((await reservationDoc(booking._id))!.paidAmount).toBe(500);
  });

  it('2. guard hands the kit over', async () => {
    await shiftTo(booking._id, 5, 1440);
    await guardScans(booking.reservationNumber);
    expect(lastCall('POST', '/passes/check-in')!.status).toBe(200);
  });

  it('3. guard inspects the return: a bit is missing, ₹300 is kept', async () => {
    const before = (await walletBalance('residentB'))!;
    const view = await guardScans(booking.reservationNumber);
    await tap(view, 'Inspect & record return');
    await tap(view, 'Damaged or incomplete');
    await typeInto(view, 'e.g. Drill bit set missing', 'One drill bit missing');
    await typeInto(view, '0', '300');
    await fireEvent.press(view.getByTestId('return-inspection-confirm'));
    await waitFor(() => expect(lastCall('POST', '/passes/check-out')?.status).toBe(200), { timeout: 15000 });
    expect((await walletBalance('residentB'))! - before).toBe(200);
  });

  it('4. resident sees what was returned, kept and why', async () => {
    await signInAs('residentB');
    const view = await openDetail(booking._id);
    await expectVisible(view, '₹200 returned, ₹300 kept');
    expect(view.getByText('One drill bit missing')).toBeOnTheScreen();
  });
});

describe('Journey 3: lawn session paid at the gate', () => {
  let booking: any;
  let collectedBefore: number;

  it('1. resident books the morning session with nothing to pay now', async () => {
    const kpi = await apiAs('adminA', 'GET', '/amenity-dashboard/kpi');
    collectedBefore = kpi.body.data.revenue.dailyRevenue;
    ({ reservation: booking } = await bookAs('residentA', { facilityKey: 'hallSessions', daysAhead: 18, start: '08:00', end: '13:00', headcount: 20 }));
    expect((await reservationDoc(booking._id))!.balanceAmount).toBe(3000);
  });

  it('2. guard collects ₹3,000 in cash and admits', async () => {
    await shiftTo(booking._id, 5, 300);
    const view = await guardScans(booking.reservationNumber);
    await tap(view, 'Collect ₹3,000 cash & admit');
    await waitFor(() => expect(lastCall('POST', '/passes/check-in')?.status).toBe(200), { timeout: 15000 });
    await expectVisible(view, 'Facility Entry Verified');
  });

  it('3. staff see the cash in the ledger and in today’s collections', async () => {
    const ledger = await apiAs('adminA', 'GET', `/amenity-dashboard/ledger?search=${booking.reservationNumber}`);
    const row = ledger.body.data.data.find((x: any) => x.id === String(booking._id));
    expect({ pay: row.paymentStatus, method: row.paymentMethod, paid: row.paidAmount }).toMatchObject({ pay: 'PAID', paid: 3000 });
    const kpi = await apiAs('adminA', 'GET', '/amenity-dashboard/kpi');
    expect(kpi.body.data.revenue.dailyRevenue - collectedBefore).toBeGreaterThanOrEqual(3000);
  });
});
