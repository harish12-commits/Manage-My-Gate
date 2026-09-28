/**
 * Amenity ledger screen (layout of the visitor Admin Gate Audit Logs): status pills and
 * search are answered by the server, pages append, a row opens its money in full, and
 * export covers every matching booking — not just the rows on screen.
 */
import React from 'react';
import { waitFor, fireEvent, within } from '@testing-library/react-native';
import LedgersScreen from '@/app/(resident)/amenities/ledgers';
import { store } from '@/src/store/store';
import { setLedgerView, setLedgerSearch, fetchAmenityLedgerThunk } from '@/src/features/amenities/store/amenityBookingSlice';
import { renderScreen, nav } from '../helpers/render';
import { signInAs } from '../helpers/session';
import { findCalls, lastCall, resetApiLog } from '../helpers/api';
import { typeInto } from '../helpers/ui';
import { closeDb } from '../helpers/db';
import { bookAs } from '../helpers/amenity';

afterAll(closeDb);

const ledgerCalls = () => findCalls('GET', '/amenity-dashboard/ledger');

const openLedger = async () => {
  store.dispatch(setLedgerView('ALL'));
  store.dispatch(setLedgerSearch(''));
  resetApiLog();
  await signInAs('adminA');
  const view = await renderScreen(<LedgersScreen />);
  await waitFor(() => expect(lastCall('GET', '/amenity-dashboard/ledger')?.status).toBe(200), { timeout: 15000 });
  return view;
};

describe('Amenity ledger screen', () => {
  let dueBooking: any;
  beforeAll(async () => {
    // A pay-at-gate lawn evening session: ₹4,500 still owed.
    ({ reservation: dueBooking } = await bookAs('residentB', { facilityKey: 'hallSessions', daysAhead: 19, start: '16:00', end: '22:00', headcount: 20 }));
  });

  it('shows the summary for everything matching, not just the loaded rows', async () => {
    const view = await openLedger();
    const body = lastCall('GET', '/amenity-dashboard/ledger')!.responseBody.data;
    await waitFor(() => expect(view.getByTestId('ledger-summary')).toHaveTextContent(new RegExp(`^${body.summary.totalBookings} bookings`)), { timeout: 15000 });
    expect(body.pagination.totalRecords).toBe(body.summary.totalBookings);
  });

  it('"Balance due" asks the server for bookings with money still owed', async () => {
    const view = await openLedger();
    // The pills live in the filter sheet; cards below also say "Balance due", so pick inside the sheet.
    await fireEvent.press(await view.findByLabelText('Open filter options'));
    const sheets = await view.findAllByTestId('mock-modal');
    await fireEvent.press(within(sheets[sheets.length - 1]).getByText('Balance due'));
    await waitFor(() => expect(lastCall('GET', '/amenity-dashboard/ledger')!.url).toContain('balanceDue=true'), { timeout: 15000 });
    await waitFor(() => expect(lastCall('GET', '/amenity-dashboard/ledger')?.status).toBe(200));
    const rows = lastCall('GET', '/amenity-dashboard/ledger')!.responseBody.data.data;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: any) => r.remainingAmount > 0 && r.status !== 'CANCELLED')).toBe(true);
  });

  it('searches on the server and opens a row with its money in full', async () => {
    const view = await openLedger();
    await typeInto(view, 'Search booking # or resident...', dueBooking.reservationNumber);
    await waitFor(() => expect(lastCall('GET', '/amenity-dashboard/ledger')!.url).toContain(`search=${dueBooking.reservationNumber}`), {
      timeout: 15000,
    });
    await fireEvent.press(await view.findByTestId(`ledger-row-${dueBooking._id}`, {}, { timeout: 15000 }));
    const sheet = await view.findByTestId('ledger-detail-sheet');
    expect(within(sheet).getAllByText('₹4,500').length).toBeGreaterThanOrEqual(2); // total and balance due
    expect(within(sheet).getAllByText(dueBooking.reservationNumber).length).toBeGreaterThanOrEqual(1);
  });

  it('loads the next page and keeps the first (Load more)', async () => {
    await openLedger();
    const first = store.getState().amenityBookings.ledger;
    if (first.pagination.totalPages < 2) return; // not enough bookings to page
    await store.dispatch(fetchAmenityLedgerThunk({ page: 2 }) as any);
    const after = store.getState().amenityBookings.ledger;
    expect(after.pagination.currentPage).toBe(2);
    expect(after.items.slice(0, first.items.length).map((r: any) => r._id)).toEqual(first.items.map((r: any) => r._id));
    expect(after.items.length).toBeGreaterThan(first.items.length);
  });

  it('exports every matching booking, page by page', async () => {
    const view = await openLedger();
    await fireEvent.press(await view.findByText('Export CSV'));
    await waitFor(() => expect(ledgerCalls().some((c) => c.url.includes('limit=100'))).toBe(true), { timeout: 15000 });
    const exportCalls = ledgerCalls().filter((c) => c.url.includes('limit=100'));
    const total = exportCalls[0].responseBody.data.pagination.totalPages;
    expect(exportCalls.length).toBe(total);
  });

  it('sends residents away', async () => {
    await signInAs('residentA');
    nav().redirects.length = 0;
    await renderScreen(<LedgersScreen />);
    expect(nav().redirects).toContain('/(resident)/dashboard');
  });
});
