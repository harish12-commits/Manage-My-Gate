/**
 * P7e — Staff reporting on V2 (mobile UI → /amenity-dashboard): the dashboard KPIs,
 * booking ledger and staff calendar come from Amenity Management V2 only (never the
 * legacy /amenity-bookings), in the community time zone, and add up to what is stored.
 */
import React from 'react';
import { waitFor } from '@testing-library/react-native';
import DashboardScreen from '@/app/(resident)/amenities/dashboard';
import LedgersScreen from '@/app/(resident)/amenities/ledgers';
import AdminCalendarScreen from '@/app/(resident)/amenities/admin-calendar';
import { renderScreen } from '../helpers/render';
import { signInAs, actor } from '../helpers/session';
import { apiAs } from '../helpers/backend';
import { findCalls, lastCall, resetApiLog } from '../helpers/api';
import { expectVisible } from '../helpers/ui';
import { closeDb, oid } from '../helpers/db';
import { bookAs, amenityCollection, istDate } from '../helpers/amenity';

afterAll(closeDb);

const noLegacy = () => expect(findCalls('GET', '/amenity-bookings')).toHaveLength(0);

describe('P7e reporting API (V2)', () => {
  let booking: any;
  beforeAll(async () => {
    ({ reservation: booking } = await bookAs(
      'residentA',
      { facilityKey: 'court', daysAhead: 3, start: '07:10', end: '08:10' },
      { paymentMethod: 'WALLET' }
    ));
  });

  it('shows a 07:10 IST booking at 07:10 on the right day in the calendar', async () => {
    const res = await apiAs('adminA', 'GET', `/amenity-dashboard/calendar-events?startDate=${istDate(3)}&endDate=${istDate(3)}`);
    expect(res.status).toBe(200);
    const row = res.body.data.find((e: any) => e.id === String(booking._id));
    expect(row).toMatchObject({
      date: istDate(3),
      start: '07:10',
      end: '08:10',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      paidAmount: 300,
      residentName: actor('residentA').name,
      version: 'v2',
    });
    expect(res.body.data.every((e: any) => e.version === 'v2')).toBe(true);
  });

  it('lists the booking in the ledger with a matching summary', async () => {
    const res = await apiAs('adminA', 'GET', `/amenity-dashboard/ledger?search=${booking.reservationNumber}&limit=50`);
    expect(res.status).toBe(200);
    const rows = res.body.data.data;
    expect(rows.some((r: any) => r.id === String(booking._id))).toBe(true);
    const docs = await (await amenityCollection('reservations'))
      .find({ _id: { $in: rows.map((r: any) => oid(r.id)) } })
      .toArray();
    const net = docs.reduce((sum: number, d: any) => sum + (d.paidAmount || 0) - (d.refundAmount || 0), 0);
    expect(res.body.data.summary).toMatchObject({ totalBookings: rows.length, totalRevenue: net });
  });

  it('reports KPIs that match what is stored', async () => {
    const res = await apiAs('adminA', 'GET', '/amenity-dashboard/kpi');
    expect(res.status).toBe(200);
    const k = res.body.data;
    const orgId = oid(actor('adminA').orgId);
    const reservations = await amenityCollection('reservations');
    expect(k.bookingKpis.pendingApprovals).toBe(await reservations.countDocuments({ orgId, bookingStatus: 'PENDING_APPROVAL' }));
    expect(k.bookingKpis.needsDecision).toBe(await reservations.countDocuments({ orgId, 'adminReview.status': 'PENDING' }));
    const facilities = await amenityCollection('facilities');
    expect(k.amenityKpis.totalAmenities).toBe(
      await facilities.countDocuments({ orgId, isDeleted: { $ne: true }, status: { $ne: 'DRAFT' } })
    );
    expect(k.revenue.monthlyRevenue).toBeGreaterThanOrEqual(300);
  });

  it('keeps residents out of staff reporting', async () => {
    expect((await apiAs('residentA', 'GET', '/amenity-dashboard/ledger')).status).toBe(403);
    expect((await apiAs('residentA', 'GET', '/amenity-dashboard/kpi')).status).toBe(403);
  });
});

describe('P7e staff screens read V2 only', () => {
  it('dashboard shows the V2 KPIs', async () => {
    resetApiLog();
    await signInAs('adminA');
    const view = await renderScreen(<DashboardScreen />);
    await waitFor(() => expect(lastCall('GET', '/amenity-dashboard/kpi')?.status).toBe(200), { timeout: 15000 });
    const k = lastCall('GET', '/amenity-dashboard/kpi')!.responseBody.data;
    await waitFor(() => expect(view.getAllByText(`₹${k.revenue.monthlyRevenue.toLocaleString('en-IN')}`).length).toBeGreaterThanOrEqual(1), { timeout: 15000 });
    expect(view.queryByText(/\+14%/)).toBeNull();
    noLegacy();
  });

  it('ledger lists V2 bookings with the V2 summary', async () => {
    resetApiLog();
    await signInAs('adminA');
    const view = await renderScreen(<LedgersScreen />);
    await waitFor(() => expect(lastCall('GET', '/amenity-dashboard/ledger')?.status).toBe(200), { timeout: 15000 });
    const first = lastCall('GET', '/amenity-dashboard/ledger')!.responseBody.data.data[0];
    await expectVisible(view, new RegExp(`#${first.bookingId}`));
    noLegacy();
  });

  it('calendar loads V2 events', async () => {
    resetApiLog();
    await signInAs('adminA');
    await renderScreen(<AdminCalendarScreen />);
    await waitFor(() => expect(lastCall('GET', '/amenity-dashboard/calendar-events')?.status).toBe(200), { timeout: 15000 });
    noLegacy();
  });
});
