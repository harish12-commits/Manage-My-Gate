import moment from 'moment-timezone';
import mongoose from 'mongoose';
import paymentService from '../payment/payment.service.js';
import AmenityReservation from '../amenityManagement/reservations/amenityReservation.model.js';
import AmenityFacility from '../amenityManagement/facilities/amenityFacility.model.js';
import AmenityMaintenanceBlock from '../amenityManagement/maintenance/amenityMaintenanceBlock.model.js';
import amenityReservationService from '../amenityManagement/reservations/amenityReservation.service.js';
import amenityMaintenanceBlockService from '../amenityManagement/maintenance/amenityMaintenanceBlock.service.js';
// Web dashboard widgets (occupancy / trends / activity) still read the legacy booking service.
import amenityBookingService from '../amenityBooking/amenityBooking.services.js';
import paymentServiceForActivity from '../payment/payment.service.js';

/**
 * Amenity staff reporting (calendar, booking ledger, dashboard KPIs), from Amenity
 * Management V2 only. Dates and times are shown in the facility's time zone.
 */

const DEFAULT_TZ = 'Asia/Kolkata';
const oid = (id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(String(id)) : id);
const tzOf = (res) => res?.facilityId?.timezone || res?.timezone || DEFAULT_TZ;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Day bounds of `YYYY-MM-DD` dates in the community time zone. */
const dayRange = (startDate, endDate, tz = DEFAULT_TZ) => ({
  start: startDate ? moment.tz(startDate, 'YYYY-MM-DD', tz).startOf('day').toDate() : undefined,
  end: endDate ? moment.tz(endDate, 'YYYY-MM-DD', tz).endOf('day').toDate() : undefined,
});

/** Screen status for a booking (what staff act on). */
const operationalStatus = (res) => {
  if (res.bookingStatus === 'CANCELLED' || res.bookingStatus === 'REJECTED') return 'CANCELLED';
  if (res.bookingStatus === 'PENDING_APPROVAL') return 'PENDING';
  if (res.completionStatus === 'COMPLETED' || res.accessStatus === 'CHECKED_OUT') return 'COMPLETED';
  if (res.accessStatus === 'CHECKED_IN') return 'CHECKED_IN';
  if (res.completionStatus === 'NO_SHOW') return 'NO_SHOW';
  return 'CONFIRMED';
};

const PAYMENT_STATUS = {
  PAID: 'PAID',
  ADVANCE_PAID: 'PARTIALLY_PAID',
  PENDING: 'PENDING',
  REFUND_PENDING: 'REFUNDED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'REFUNDED',
  NOT_REQUIRED: 'NOT_REQUIRED',
  NOT_APPLICABLE: 'NOT_REQUIRED',
  FAILED: 'FAILED',
};

/** One booking as a calendar / ledger row. */
export const toBookingRow = (res) => {
  const tz = tzOf(res);
  // The booked time (the effective window adds turnaround buffers staff don't book).
  const start = moment.tz(res.requestedStartDateTime || res.effectiveStartDateTime, tz);
  const end = moment.tz(res.requestedEndDateTime || res.effectiveEndDateTime, tz);
  const total = round2(res.totalAmount ?? res.pricingSnapshot?.totalAmount ?? 0);
  const paid = round2(res.paidAmount || 0);
  const balance = round2(res.balanceAmount || 0);
  const resident = res.residentId && typeof res.residentId === 'object' ? res.residentId : null;
  const unit = res.unitId && typeof res.unitId === 'object' ? res.unitId : null;
  const facility = res.facilityId && typeof res.facilityId === 'object' ? res.facilityId : null;
  const resource = res.resourceId && typeof res.resourceId === 'object' ? res.resourceId : null;

  return {
    id: String(res._id),
    _id: String(res._id),
    bookingId: res.reservationNumber || String(res._id),
    reservationNumber: res.reservationNumber,
    type: 'booking',
    title: `${facility?.name || 'Amenity'}${resource?.name ? ` - ${resource.name}` : ''}`,
    subtitle: resident?.name || resident?.username || 'Resident',
    date: start.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD'),
    start: start.format('HH:mm'),
    end: end.format('HH:mm'),
    startDateTime: start.toDate(),
    endDateTime: end.toDate(),
    duration: Math.max(0, end.diff(start, 'minutes')),
    timezone: tz,

    amenityId: facility?._id ? String(facility._id) : String(res.facilityId || ''),
    amenityName: facility?.name || 'Amenity',
    amenityImage: facility?.images?.[0] || null,
    resourceId: resource?._id ? String(resource._id) : res.resourceId ? String(res.resourceId) : null,
    resourceName: resource?.name || null,
    numberOfPersons: res.headcount || res.quantity || 1,

    residentId: resident?._id ? String(resident._id) : res.residentId ? String(res.residentId) : null,
    residentName: resident?.name || resident?.username || 'Resident',
    residentPhoto: resident?.profilePicture || null,
    flatNumber: unit?.unitNumber || unit?.villaNumber || resident?.villaNumber || '',
    building: unit?.block || '',
    phoneNumber: resident?.phone || '',

    status: operationalStatus(res),
    bookingStatus: res.bookingStatus,
    approvalStatus: res.approvalStatus,
    needsDecision: res.adminReview?.status === 'PENDING',
    paymentStatus: PAYMENT_STATUS[res.paymentStatus] || res.paymentStatus || 'PENDING',
    paymentMethod: res.paymentMethod || null,
    bookingAmount: total,
    paidAmount: paid,
    remainingAmount: balance,
    refundAmount: round2(res.refundAmount || 0),
    depositAmount: round2(res.amountSchedule?.depositAmount ?? res.depositAmount ?? 0),
    pricingDetails: {
      totalAmount: total,
      paidAmount: paid,
      remainingAmount: balance,
      refundAmount: round2(res.refundAmount || 0),
      depositAmount: round2(res.amountSchedule?.depositAmount ?? res.depositAmount ?? 0),
    },

    qrStatus: res.accessStatus === 'PASS_GENERATED' ? 'active' : (res.accessStatus || 'pending').toLowerCase(),
    checkInStatus: res.accessStatus === 'CHECKED_IN' ? 'entered' : res.accessStatus === 'CHECKED_OUT' ? 'exited' : 'pending',
    checkInTime: res.checkedInAt || null,
    checkOutTime: res.checkedOutAt || null,
    cancellationReason: res.cancellationReason || null,
    createdAt: res.createdAt,
    version: 'v2',
  };
};

const POPULATE = [
  ['facilityId', 'name images timezone'],
  ['resourceId', 'name'],
  ['residentId', 'name username phone profilePicture villaNumber'],
  ['unitId', 'unitNumber villaNumber block'],
];
const populated = (query) => POPULATE.reduce((q, [path, select]) => q.populate(path, select), query);

/** Screen status filter -> booking query. */
const statusFilter = (status) => {
  switch (String(status || '').toUpperCase()) {
    case 'PENDING':
      return { bookingStatus: 'PENDING_APPROVAL' };
    case 'CONFIRMED':
      return { bookingStatus: 'CONFIRMED', accessStatus: { $nin: ['CHECKED_IN', 'CHECKED_OUT'] }, completionStatus: { $nin: ['COMPLETED', 'NO_SHOW'] } };
    case 'CHECKED_IN':
      return { accessStatus: 'CHECKED_IN' };
    case 'COMPLETED':
      return { $or: [{ completionStatus: 'COMPLETED' }, { accessStatus: 'CHECKED_OUT' }] };
    case 'CANCELLED':
      return { bookingStatus: { $in: ['CANCELLED', 'REJECTED'] } };
    default:
      return {};
  }
};

const paymentFilter = (paymentStatus) => {
  const wanted = String(paymentStatus || '').toUpperCase();
  if (!wanted || wanted === 'ALL') return {};
  const raw = Object.entries(PAYMENT_STATUS)
    .filter(([, shown]) => shown === wanted)
    .map(([stored]) => stored);
  return { paymentStatus: { $in: raw.length ? raw : [wanted] } };
};

const searchFilter = async (search) => {
  const term = String(search || '').trim();
  if (!term) return {};
  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const User = mongoose.models.User || (await import('../user/user.model.js')).default;
  const users = await User.find({ $or: [{ name: rx }, { username: rx }] }).select('_id').limit(200).lean();
  return { $or: [{ reservationNumber: rx }, { residentId: { $in: users.map((u) => u._id) } }] };
};

/** Date preset (today / week / month) or explicit dates -> start window, community time. */
const periodFilter = ({ datePreset, startDate, endDate }) => {
  const now = moment.tz(DEFAULT_TZ);
  let range = null;
  if (datePreset === 'today') range = { start: now.clone().startOf('day'), end: now.clone().endOf('day') };
  else if (datePreset === 'week') range = { start: now.clone().startOf('isoWeek'), end: now.clone().endOf('isoWeek') };
  else if (datePreset === 'month') range = { start: now.clone().startOf('month'), end: now.clone().endOf('month') };
  else if (startDate || endDate) {
    const r = dayRange(startDate, endDate);
    range = { start: r.start ? moment(r.start) : null, end: r.end ? moment(r.end) : null };
  }
  if (!range) return {};
  const cond = {};
  if (range.start) cond.$gte = range.start.toDate();
  if (range.end) cond.$lte = range.end.toDate();
  return { requestedStartDateTime: cond };
};

class AmenityDashboardService {
  /** Headline numbers for the amenity dashboard. */
  async getKpis(orgId) {
    const org = oid(orgId);
    const now = moment.tz(DEFAULT_TZ);
    const todayStart = now.clone().startOf('day').toDate();
    const todayEnd = now.clone().endOf('day').toDate();
    const monthStart = now.clone().startOf('month').toDate();
    const live = { orgId: org, bookingStatus: { $in: ['CONFIRMED', 'PENDING_APPROVAL'] } };

    const [facilities, maintenanceFacilities, todayBookings, upcomingBookings, totalBookings, checkInsToday, pendingApprovals, needsDecision, money, recent] =
      await Promise.all([
        AmenityFacility.aggregate([
          { $match: { orgId: org, isDeleted: { $ne: true }, status: { $ne: 'DRAFT' } } },
          { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } } } },
        ]),
        AmenityMaintenanceBlock.distinct('facilityId', {
          orgId: org,
          $or: [
            { status: 'IN_PROGRESS' },
            { status: 'SCHEDULED', startDateTime: { $lte: now.toDate() }, endDateTime: { $gte: now.toDate() } },
          ],
        }),
        AmenityReservation.countDocuments({ ...live, requestedStartDateTime: { $gte: todayStart, $lte: todayEnd } }),
        AmenityReservation.countDocuments({ ...live, requestedStartDateTime: { $gt: now.toDate() } }),
        AmenityReservation.countDocuments({ orgId: org, bookingStatus: { $nin: ['CANCELLED', 'REJECTED'] } }),
        AmenityReservation.countDocuments({ orgId: org, checkedInAt: { $gte: todayStart, $lte: todayEnd } }),
        AmenityReservation.countDocuments({ orgId: org, bookingStatus: 'PENDING_APPROVAL' }),
        AmenityReservation.countDocuments({ orgId: org, 'adminReview.status': 'PENDING' }),
        // Money received for bookings (wallet, online and cash at the gate)
        AmenityReservation.aggregate([
          { $match: { orgId: org, 'payments.paidAt': { $gte: monthStart } } },
          { $unwind: '$payments' },
          { $match: { 'payments.paidAt': { $gte: monthStart } } },
          {
            $group: {
              _id: null,
              month: { $sum: '$payments.amount' },
              today: { $sum: { $cond: [{ $gte: ['$payments.paidAt', todayStart] }, '$payments.amount', 0] } },
            },
          },
        ]),
        populated(AmenityReservation.find({ orgId: org }).sort({ updatedAt: -1 }).limit(10)).lean(),
      ]);

    const f = facilities[0] || { total: 0, active: 0 };
    const m = money[0] || { month: 0, today: 0 };
    return {
      // Web dashboard (legacy fields)
      checkIns: checkInsToday,
      revenue: { monthlyRevenue: round2(m.month), dailyRevenue: round2(m.today) },
      occupancy: todayBookings > 0 ? Math.round((checkInsToday / todayBookings) * 100) : 0,
      activeMaintenance: maintenanceFacilities.length,
      maintenanceTasks: `${maintenanceFacilities.length} under maintenance`,
      // V2 dashboard
      amenityKpis: {
        totalAmenities: f.total,
        activeAmenities: f.active,
        underMaintenance: maintenanceFacilities.length,
      },
      bookingKpis: {
        todayBookings,
        upcomingBookings,
        totalBookings,
        checkInsToday,
        pendingApprovals,
        needsDecision,
      },
      recentActivities: recent.map((r) => {
        const row = toBookingRow(r);
        return {
          id: row.id,
          type: 'booking',
          title: `${row.amenityName} · ${row.status.replace('_', ' ').toLowerCase()}`,
          subtitle: `${row.residentName} • ${row.date} ${row.start}`,
          timestamp: r.updatedAt,
          status: row.status,
        };
      }),
    };
  }

  async getRevenue(orgId) {
    return paymentService.getRevenueTrend(orgId);
  }

  async getOccupancy(orgId) {
    return amenityBookingService.getOccupancyStats(orgId);
  }

  async getTrends(orgId) {
    return amenityBookingService.getTrendsStats(orgId);
  }

  async getRecentActivity(orgId) {
    const [kpis, recentPayments] = await Promise.all([this.getKpis(orgId), paymentServiceForActivity.getRecentActivity(orgId, 5)]);
    const activity = [...kpis.recentActivities];
    (recentPayments || []).forEach((p) => {
      activity.push({
        id: p._id,
        type: 'payment',
        title: `Payment ${p.status === 'success' ? 'Success' : p.status === 'failed' ? 'Failed' : 'Pending'}`,
        subtitle: `₹${p.amount} • ${p.referenceType || 'Booking'}`,
        timestamp: p.updatedAt,
        status: p.status,
      });
    });
    return activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
  }

  /** Booking ledger: one row per booking with its money, filtered and paginated. */
  async getLedger(orgId, query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const conditions = [
      { orgId: oid(orgId) },
      statusFilter(query.status),
      paymentFilter(query.paymentStatus),
      periodFilter(query),
      await searchFilter(query.search),
    ];
    const facilityId = query.facilityId || query.amenityId;
    if (facilityId && facilityId !== 'All') conditions.push({ facilityId: oid(facilityId) });
    const match = { $and: conditions.filter((c) => Object.keys(c).length > 0) };

    const todayStart = moment.tz(DEFAULT_TZ).startOf('day').toDate();
    const [rows, total, sums, today] = await Promise.all([
      populated(AmenityReservation.find(match).sort({ requestedStartDateTime: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)).lean(),
      AmenityReservation.countDocuments(match),
      AmenityReservation.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            paid: { $sum: { $ifNull: ['$paidAmount', 0] } },
            refunded: { $sum: { $ifNull: ['$refundAmount', 0] } },
            outstanding: {
              $sum: { $cond: [{ $in: ['$bookingStatus', ['CONFIRMED', 'PENDING_APPROVAL']] }, { $ifNull: ['$balanceAmount', 0] }, 0] },
            },
            paidBookings: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $in: ['$bookingStatus', ['CANCELLED', 'REJECTED']] }, 1, 0] } },
          },
        },
      ]),
      AmenityReservation.aggregate([
        { $match: { ...match, 'payments.paidAt': { $gte: todayStart } } },
        { $unwind: '$payments' },
        { $match: { 'payments.paidAt': { $gte: todayStart } } },
        { $group: { _id: null, amount: { $sum: '$payments.amount' } } },
      ]),
    ]);

    const s = sums[0] || { paid: 0, refunded: 0, outstanding: 0, paidBookings: 0, cancelled: 0 };
    return {
      data: rows.map(toBookingRow),
      pagination: { currentPage: page, totalPages: Math.max(1, Math.ceil(total / limit)), totalRecords: total, limit },
      summary: {
        // Net money kept for these bookings: received minus refunded (deposits included).
        totalRevenue: round2(s.paid - s.refunded),
        todayRevenue: round2(today[0]?.amount || 0),
        totalBookings: total,
        paidBookings: s.paidBookings,
        pendingPayments: round2(s.outstanding),
        refundedAmount: round2(s.refunded),
        cancelledBookings: s.cancelled,
      },
    };
  }

  /** Staff calendar: bookings and maintenance in a date range (community time). */
  async getCalendarEvents(orgId, startDate, endDate, filters = {}) {
    const facilityId = filters.facilityId || filters.amenityId;
    const resourceId = filters.resourceId;
    const range = dayRange(startDate, endDate);

    const [reservations, blocks] = await Promise.all([
      amenityReservationService.findEventsForCalendar({
        orgId,
        startDate: range.start?.toISOString(),
        endDate: range.end?.toISOString(),
        facilityId,
        resourceId,
      }),
      amenityMaintenanceBlockService
        .findBlocksForCalendar({ orgId, startDate: range.start, endDate: range.end, facilityId, resourceId })
        .catch(() => []),
    ]);

    const wantedStatus = String(filters.status || '').toUpperCase();
    const wantedPayment = String(filters.paymentStatus || '').toUpperCase();
    let events = (reservations || [])
      .map(toBookingRow)
      .filter((e) => !wantedStatus || wantedStatus === 'ALL' || e.status === wantedStatus)
      .filter((e) => !wantedPayment || wantedPayment === 'ALL' || e.paymentStatus === wantedPayment);

    (blocks || []).forEach((block) => {
      const tz = block.facilityId?.timezone || DEFAULT_TZ;
      const start = moment.tz(block.startDateTime, tz);
      const end = moment.tz(block.endDateTime, tz);
      events.push({
        id: `maint_${block._id}`,
        bookingId: String(block._id),
        type: 'maintenance',
        title: `${block.facilityId?.name || 'Amenity'}: ${block.title}`,
        subtitle: `${block.maintenanceType || 'MAINTENANCE'} • ${block.isCompleteClosure ? 'Full Closure' : 'Partial Closure'}`,
        date: start.format('YYYY-MM-DD'),
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD'),
        start: start.format('HH:mm'),
        end: end.format('HH:mm'),
        startDateTime: start.toDate(),
        endDateTime: end.toDate(),
        duration: Math.max(1, end.diff(start, 'minutes')),
        amenityId: block.facilityId?._id ? String(block.facilityId._id) : String(block.facilityId || ''),
        amenityName: block.facilityId?.name || 'Amenity',
        resourceId: block.resourceId?._id ? String(block.resourceId._id) : block.resourceId ? String(block.resourceId) : null,
        resourceName: block.resourceId?.name || null,
        resourceIds: block.resourceIds || [],
        status: block.status || 'SCHEDULED',
        isCompleteClosure: block.isCompleteClosure !== false,
        isEmergency: Boolean(block.isEmergency),
        reason: block.reason || '',
        version: 'v2',
      });
    });

    const term = String(filters.search || '').trim().toLowerCase();
    if (term) {
      events = events.filter((e) =>
        [e.title, e.subtitle, e.residentName, e.flatNumber, e.bookingId].some((v) => String(v || '').toLowerCase().includes(term))
      );
    }
    return events.sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
  }

  /** Days of a month that have bookings or maintenance (calendar dots). */
  async getCalendarIndicators(orgId, year, month) {
    const start = moment.tz({ year: Number(year), month: Number(month) - 1, day: 1 }, DEFAULT_TZ);
    const events = await this.getCalendarEvents(orgId, start.format('YYYY-MM-DD'), start.clone().endOf('month').format('YYYY-MM-DD'));
    const days = {};
    events.forEach((e) => {
      const day = days[e.date] || (days[e.date] = { date: e.date, bookings: 0, maintenance: 0 });
      if (e.type === 'maintenance') day.maintenance += 1;
      else if (e.status !== 'CANCELLED') day.bookings += 1;
    });
    return Object.values(days);
  }
}

export default new AmenityDashboardService();
