import AmenityBooking from './amenityBooking.model.js';
import mongoose from 'mongoose';
import '../amenity/amenity.model.js';
import '../user/user.model.js';

export class AmenityBookingRepository {
  async findConflicts(orgId, amenityId, date, startTime, endTime, session = null) {
    return await AmenityBooking.find({
      orgId,
      amenityId,
      bookingDate: date,
      status: { $in: ['pending', 'approved', 'confirmed', 'checked-in'] },
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
      ]
    }).session(session);
  }

  async findOverlappingBookingsForWindow({ orgId, amenityId, startDateTime, endDateTime }, session = null) {
    const moment = (await import('moment-timezone')).default;
    const TIMEZONE = 'Asia/Kolkata';
    const startM = moment.tz(startDateTime, TIMEZONE);
    const endM = moment.tz(endDateTime, TIMEZONE);
    const startDateStr = startM.format('YYYY-MM-DD');
    const endDateStr = endM.format('YYYY-MM-DD');

    const filter = {
      orgId,
      status: { $in: ['pending', 'approved', 'confirmed', 'checked-in'] },
      bookingDate: { $gte: startDateStr, $lte: endDateStr },
    };
    if (amenityId) {
      filter.amenityId = amenityId;
    }

    const candidateBookings = await AmenityBooking.find(filter)
      .populate({ path: 'amenityId', select: 'name' })
      .populate({ path: 'userId', select: 'name email phone flatNumber' })
      .session(session);

    const qStart = new Date(startDateTime).getTime();
    const qEnd = new Date(endDateTime).getTime();

    return candidateBookings.filter((b) => {
      if (!b.bookingDate || !b.startTime || !b.endTime) return false;
      const bStart = moment.tz(`${b.bookingDate}T${b.startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate().getTime();
      let bEnd = moment.tz(`${b.bookingDate}T${b.endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate().getTime();
      if (bEnd < bStart) {
        bEnd += 24 * 60 * 60 * 1000;
      }
      return bStart < qEnd && bEnd > qStart;
    });
  }

  async countUserBookingsOnDate(userId, orgId, amenityId, date, session = null) {
    const bookings = await AmenityBooking.find({
      userId,
      orgId,
      amenityId,
      bookingDate: date,
      status: { $nin: ['cancelled', 'rejected'] }
    }).session(session);
    const uniqueSlots = new Set(bookings.map(b => `${b.startTime}-${b.endTime}`));
    return uniqueSlots.size;
  }

  async isExistingSlot(userId, orgId, amenityId, date, startTime, endTime, session = null) {
    const count = await AmenityBooking.countDocuments({
      userId,
      orgId,
      amenityId,
      bookingDate: date,
      startTime,
      endTime,
      status: { $nin: ['cancelled', 'rejected'] }
    }).session(session);
    return count > 0;
  }

  async findByOrgPaginated(orgId, filters = {}, skip = 0, limit = 10) {
    const targetOrgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;
    const matchStage = { orgId: targetOrgId };

    const kNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayStr = `${kNow.getFullYear()}-${String(kNow.getMonth() + 1).padStart(2, '0')}-${String(kNow.getDate()).padStart(2, '0')}`;

    if (filters.status && filters.status !== 'All' && filters.status !== 'ALL') {
      if (typeof filters.status === 'object') {
        matchStage.status = filters.status;
      } else if (typeof filters.status === 'string') {
        const s = filters.status.toLowerCase();
        if (s === 'checked_in' || s === 'checked-in') {
          matchStage.status = { $in: ['checked-in', 'checked_in', 'CHECKED_IN'] };
        } else {
          matchStage.status = { $in: [s, s.toUpperCase()] };
        }
      } else {
        matchStage.status = filters.status;
      }
    }

    if (filters.paymentStatus && filters.paymentStatus !== 'All' && filters.paymentStatus !== 'ALL') {
      const ps = filters.paymentStatus.toLowerCase();
      if (ps === 'paid') {
        matchStage.paymentStatus = { $in: ['captured', 'success', 'paid', 'completed', 'PAID', 'CAPTURED', 'SUCCESS'] };
      } else if (ps === 'pending') {
        matchStage.paymentStatus = { $in: ['pending', 'PENDING', 'unpaid', 'UNPAID'] };
      } else if (ps === 'refunded') {
        matchStage.paymentStatus = { $in: ['refunded', 'REFUNDED', 'partial_refund'] };
      } else if (ps === 'failed') {
        matchStage.paymentStatus = { $in: ['failed', 'FAILED'] };
      } else {
        matchStage.paymentStatus = ps;
      }
    }

    if (filters.amenityId && filters.amenityId !== 'All' && filters.amenityId !== 'ALL') {
      if (typeof filters.amenityId === 'object' && !mongoose.Types.ObjectId.isValid(filters.amenityId)) {
        matchStage.amenityId = filters.amenityId;
      } else if (mongoose.Types.ObjectId.isValid(filters.amenityId)) {
        matchStage.amenityId = new mongoose.Types.ObjectId(filters.amenityId);
      }
    }

    if (filters.startDate && filters.endDate) {
      matchStage.bookingDate = { $gte: filters.startDate, $lte: filters.endDate };
    } else if (filters.startDate) {
      matchStage.bookingDate = { $gte: filters.startDate };
    } else if (filters.endDate) {
      matchStage.bookingDate = { $lte: filters.endDate };
    } else if (filters.datePreset) {
      if (filters.datePreset === 'today') {
        matchStage.bookingDate = todayStr;
      } else if (filters.datePreset === 'yesterday') {
        const yest = new Date(kNow);
        yest.setDate(kNow.getDate() - 1);
        const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
        matchStage.bookingDate = yestStr;
      } else if (filters.datePreset === 'this_week') {
        const startOfWeek = new Date(kNow);
        startOfWeek.setDate(kNow.getDate() - kNow.getDay());
        const weekStartStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
        matchStage.bookingDate = { $gte: weekStartStr, $lte: todayStr };
      } else if (filters.datePreset === 'this_month') {
        const monthStartStr = `${kNow.getFullYear()}-${String(kNow.getMonth() + 1).padStart(2, '0')}-01`;
        matchStage.bookingDate = { $gte: monthStartStr, $lte: todayStr };
      }
    } else if (filters.date || filters.bookingDate) {
      matchStage.bookingDate = filters.date || filters.bookingDate;
    }

    if (filters.userId && mongoose.Types.ObjectId.isValid(filters.userId)) {
      matchStage.userId = new mongoose.Types.ObjectId(filters.userId);
    }
    if (filters.checkedInBy && mongoose.Types.ObjectId.isValid(filters.checkedInBy)) {
      matchStage.checkedInBy = new mongoose.Types.ObjectId(filters.checkedInBy);
    }

    const pipeline = [
      { $match: { orgId: targetOrgId } },
      {
        $unionWith: {
          coll: 'amenity_management_reservations',
          pipeline: [
            { $match: { orgId: targetOrgId } },
            {
              $project: {
                _id: 1,
                orgId: 1,
                bookingId: '$reservationNumber',
                amenityId: '$facilityId',
                userId: '$residentId',
                status: { $toLower: '$bookingStatus' },
                paymentStatus: { $toLower: '$paymentStatus' },
                numberOfPersons: { $ifNull: ['$headcount', '$quantity', 1] },
                pricingDetails: '$pricingSnapshot',
                totalPrice: { $ifNull: ['$pricingSnapshot.totalAmount', '$totalAmount', 0] },
                totalFee: { $ifNull: ['$pricingSnapshot.totalAmount', '$totalAmount', 0] },
                bookingDate: {
                  $dateToString: {
                    date: { $ifNull: ['$effectiveStartDateTime', '$requestedStartDateTime'] },
                    format: '%Y-%m-%d',
                    timezone: 'Asia/Kolkata'
                  }
                },
                startTime: {
                  $dateToString: {
                    date: { $ifNull: ['$effectiveStartDateTime', '$requestedStartDateTime'] },
                    format: '%H:%M',
                    timezone: 'Asia/Kolkata'
                  }
                },
                endTime: {
                  $dateToString: {
                    date: { $ifNull: ['$effectiveEndDateTime', '$requestedEndDateTime'] },
                    format: '%H:%M',
                    timezone: 'Asia/Kolkata'
                  }
                },
                deposit: { $ifNull: ['$pricingSnapshot.depositAmount', '$depositAmount', 0] },
                refundAmount: { $ifNull: ['$refundAmount', 0] },
                cancellationReason: 1,
                cancelledAt: 1,
                createdAt: 1,
                updatedAt: 1
              }
            }
          ]
        }
      },
      {
        $group: {
          _id: '$_id',
          doc: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$doc' }
      },
      { $match: matchStage },
      {
        $lookup: {
          from: 'amenities',
          localField: 'amenityId',
          foreignField: '_id',
          as: 'amenityV1'
        }
      },
      { $unwind: { path: '$amenityV1', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'amenity_management_facilities',
          localField: 'amenityId',
          foreignField: '_id',
          as: 'amenityV2'
        }
      },
      { $unwind: { path: '$amenityV2', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          resolvedAmenityName: {
            $ifNull: ['$amenityV1.name', '$amenityV2.name', '$amenityName', 'Amenity']
          },
          resolvedAmenityCategory: {
            $ifNull: ['$amenityV1.category', '$amenityV2.category', '$amenityV2.archetype', 'General']
          },
          resolvedAmenityLocation: {
            $ifNull: ['$amenityV1.location', '$amenityV2.location', 'Community Facility']
          },
          resolvedAmenityImages: {
            $ifNull: ['$amenityV1.images', '$amenityV2.images', []]
          }
        }
      }
    ];

    if (filters.search && String(filters.search).trim()) {
      const searchStr = String(filters.search).trim();
      const searchRegex = new RegExp(searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      pipeline.push({
        $match: {
          $or: [
            { bookingId: searchRegex },
            { _id: mongoose.Types.ObjectId.isValid(searchStr) ? new mongoose.Types.ObjectId(searchStr) : searchRegex },
            { paymentId: searchRegex },
            { razorpayTransactionId: searchRegex },
            { resolvedAmenityName: searchRegex },
            { 'user.name': searchRegex },
            { 'user.username': searchRegex },
            { 'user.email': searchRegex },
            { 'user.villaNumber': searchRegex },
            { 'user.flatNumber': searchRegex },
            { 'user.unit': searchRegex },
            { 'user.building': searchRegex }
          ]
        }
      });
    }

    pipeline.push(
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalRecords' }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                bookingId: 1,
                bookingDate: 1,
                startTime: 1,
                endTime: 1,
                status: 1,
                numberOfPersons: 1,
                pricingDetails: 1,
                totalFee: { $ifNull: ['$pricingDetails.totalAmount', 0] },
                totalPrice: { $ifNull: ['$pricingDetails.totalAmount', 0] },
                bookingAmount: { $ifNull: ['$pricingDetails.totalAmount', 0] },
                paidAmount: {
                  $cond: [
                    {
                      $or: [
                        { $in: ['$paymentStatus', ['captured', 'success', 'paid', 'completed', 'PAID', 'CAPTURED', 'SUCCESS']] },
                        { $in: ['$status', ['confirmed', 'checked-in', 'completed', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED']] }
                      ]
                    },
                    { $ifNull: ['$pricingDetails.totalAmount', 0] },
                    0
                  ]
                },
                refundAmount: { $ifNull: ['$pricingDetails.refundAmount', '$refundAmount', 0] },
                netRevenue: {
                  $subtract: [
                    {
                      $cond: [
                        {
                          $or: [
                            { $in: ['$paymentStatus', ['captured', 'success', 'paid', 'completed', 'PAID', 'CAPTURED', 'SUCCESS']] },
                            { $in: ['$status', ['confirmed', 'checked-in', 'completed', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED']] }
                          ]
                        },
                        { $ifNull: ['$pricingDetails.totalAmount', 0] },
                        0
                      ]
                    },
                    { $ifNull: ['$pricingDetails.refundAmount', '$refundAmount', 0] }
                  ]
                },
                paymentStatus: 1,
                paymentMethod: 1,
                paymentId: 1,
                razorpayTransactionId: 1,
                qrCode: 1,
                qrStatus: 1,
                rejectionReason: 1,
                cancellationReason: 1,
                cancelledAt: 1,
                createdAt: 1,
                villaNumber: { $ifNull: ['$user.villaNumber', '$user.flatNumber', '$user.unit'] },
                userName: '$user.name',
                userId: {
                  _id: '$user._id',
                  name: '$user.name',
                  username: '$user.username',
                  email: '$user.email',
                  villaNumber: '$user.villaNumber',
                  flatNumber: '$user.flatNumber',
                  unit: '$user.unit',
                  phoneNumber: '$user.phoneNumber',
                  building: '$user.building',
                  tower: '$user.tower'
                },
                amenityId: {
                  _id: { $ifNull: ['$amenityV1._id', '$amenityV2._id', '$amenityId'] },
                  name: '$resolvedAmenityName',
                  category: '$resolvedAmenityCategory',
                  location: '$resolvedAmenityLocation',
                  images: '$resolvedAmenityImages',
                  type: { $ifNull: ['$amenityV1.type', '$amenityV2.archetype'] }
                }
              }
            }
          ],
          summary: [
            {
              $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                paidBookings: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $in: ['$paymentStatus', ['captured', 'success', 'paid', 'completed', 'PAID', 'CAPTURED', 'SUCCESS']] },
                          { $in: ['$status', ['confirmed', 'checked-in', 'completed', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED']] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                },
                pendingPayments: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $not: [{ $in: ['$paymentStatus', ['captured', 'success', 'paid', 'completed', 'refunded', 'PAID', 'CAPTURED', 'SUCCESS', 'REFUNDED']] }] },
                          { $not: [{ $in: ['$status', ['confirmed', 'checked-in', 'completed', 'cancelled', 'rejected', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'REJECTED']] }] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                },
                cancelledBookings: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', ['cancelled', 'rejected', 'CANCELLED', 'REJECTED']] },
                      1,
                      0
                    ]
                  }
                },
                grossRevenue: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $in: ['$paymentStatus', ['captured', 'success', 'paid', 'completed', 'PAID', 'CAPTURED', 'SUCCESS']] },
                          { $in: ['$status', ['confirmed', 'checked-in', 'completed', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED']] }
                        ]
                      },
                      { $ifNull: ['$pricingDetails.totalAmount', 0] },
                      0
                    ]
                  }
                },
                refundedAmount: {
                  $sum: { $ifNull: ['$pricingDetails.refundAmount', '$refundAmount', 0] }
                },
                todayRevenue: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$bookingDate', todayStr] },
                          {
                            $or: [
                              { $in: ['$paymentStatus', ['captured', 'success', 'paid', 'completed', 'PAID', 'CAPTURED', 'SUCCESS']] },
                              { $in: ['$status', ['confirmed', 'checked-in', 'completed', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED']] }
                            ]
                          }
                        ]
                      },
                      { $ifNull: ['$pricingDetails.totalAmount', 0] },
                      0
                    ]
                  }
                }
              }
            },
            {
              $project: {
                _id: 0,
                totalBookings: 1,
                paidBookings: 1,
                pendingPayments: 1,
                cancelledBookings: 1,
                grossRevenue: 1,
                refundedAmount: 1,
                todayRevenue: 1,
                totalRevenue: { $subtract: ['$grossRevenue', '$refundedAmount'] }
              }
            }
          ],
          amenitySummary: [
            {
              $group: {
                _id: '$resolvedAmenityName',
                amenityId: { $first: { $ifNull: ['$amenityV1._id', '$amenityV2._id', '$amenityId'] } },
                amenityName: { $first: '$resolvedAmenityName' },
                bookingsCount: { $sum: 1 },
                grossRevenue: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $in: ['$paymentStatus', ['captured', 'success', 'paid', 'completed', 'PAID', 'CAPTURED', 'SUCCESS']] },
                          { $in: ['$status', ['confirmed', 'checked-in', 'completed', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED']] }
                        ]
                      },
                      { $ifNull: ['$pricingDetails.totalAmount', 0] },
                      0
                    ]
                  }
                },
                refundedAmount: {
                  $sum: { $ifNull: ['$pricingDetails.refundAmount', '$refundAmount', 0] }
                }
              }
            },
            {
              $project: {
                _id: 0,
                amenityId: 1,
                amenityName: 1,
                bookingsCount: 1,
                grossRevenue: 1,
                refundedAmount: 1,
                netRevenue: { $subtract: ['$grossRevenue', '$refundedAmount'] }
              }
            },
            { $sort: { netRevenue: -1, bookingsCount: -1 } }
          ]
        }
      }
    );

    const result = await AmenityBooking.aggregate(pipeline);
    const facetRes = result[0] || {};
    const data = facetRes.data || [];
    const totalRecords = facetRes.metadata?.[0]?.totalRecords || 0;
    const summary = facetRes.summary?.[0] || {
      totalRevenue: 0,
      todayRevenue: 0,
      totalBookings: 0,
      paidBookings: 0,
      pendingPayments: 0,
      refundedAmount: 0,
      cancelledBookings: 0
    };
    const amenitySummary = facetRes.amenitySummary || [];

    return { data, totalRecords, summary, amenitySummary };
  }

  async findByUser(userId, orgId, filters = {}) {
    const targetOrgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;
    const targetUserId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const orgFilter = { $or: [{ orgId: targetOrgId }, { orgId: String(orgId) }] };
    const userFilter = { $or: [{ userId: targetUserId }, { userId: String(userId) }] };

    const query = { $and: [orgFilter, userFilter] };
    if (filters.startDate && filters.endDate) {
      query.bookingDate = { $gte: filters.startDate, $lte: filters.endDate };
    } else if (filters.startDate) {
      query.bookingDate = { $gte: filters.startDate };
    } else if (filters.endDate) {
      query.bookingDate = { $lte: filters.endDate };
    }
    if (filters.status && filters.status !== 'All' && filters.status !== 'ALL') {
      query.status = filters.status.toLowerCase();
    }

    const v1Bookings = await AmenityBooking.find(query)
      .sort({ bookingDate: -1, startTime: -1 })
      .populate('amenityId', 'name type images location bookingRules pricing')
      .exec();

    try {
      const AmenityReservation = (await import('../amenityManagement/reservations/amenityReservation.model.js')).default;
      const resvOrgFilter = { $or: [{ orgId: targetOrgId }, { orgId: String(orgId) }] };
      const resvUserFilter = { $or: [{ residentId: targetUserId }, { residentId: String(userId) }] };
      const resvQuery = { $and: [resvOrgFilter, resvUserFilter] };

      if (filters.status && filters.status !== 'All' && filters.status !== 'ALL') {
        const s = filters.status.toUpperCase();
        resvQuery.bookingStatus = s;
      }

      const v2Reservations = await AmenityReservation.find(resvQuery)
        .populate('facilityId', 'name type images category location pricingConfig operatingHours')
        .populate('resourceId', 'name identifier')
        .sort({ createdAt: -1 })
        .exec();

      const moment = (await import('moment-timezone')).default;
      const TIMEZONE = 'Asia/Kolkata';

      const adaptedV2 = v2Reservations.map((r) => {
        const fac = r.facilityId || {};
        const startDt = r.effectiveStartDateTime || r.requestedStartDateTime;
        const endDt = r.effectiveEndDateTime || r.requestedEndDateTime;
        const startM = startDt ? moment.tz(startDt, TIMEZONE) : null;
        const endM = endDt ? moment.tz(endDt, TIMEZONE) : null;

        const pConfig = fac.pricingConfig || {};

        return {
          _id: r._id,
          bookingNumber: r.reservationNumber || String(r._id),
          orgId: r.orgId,
          userId: r.residentId,
          amenityId: {
            _id: fac._id || r.facilityId,
            name: fac.name || 'Amenity Facility',
            type: (fac.category || fac.archetype || 'general').toLowerCase(),
            images: fac.images || (fac.imageUrl ? [fac.imageUrl] : []),
            location: fac.location || '',
            pricing: {
              baseRate: pConfig.baseRate || 0,
              pricingType: (pConfig.pricingType || 'FREE').toLowerCase(),
            },
          },
          bookingDate: startM ? startM.format('YYYY-MM-DD') : '',
          startTime: startM ? startM.format('HH:mm') : '',
          endTime: endM ? endM.format('HH:mm') : '',
          status: (r.bookingStatus || 'CONFIRMED').toLowerCase(),
          paymentStatus: (r.paymentStatus || 'NOT_REQUIRED').toLowerCase(),
          numberOfPersons: r.headcount || r.quantity || 1,
          totalPrice: r.totalAmount || r.pricingSnapshot?.totalAmount || 0,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      });

      const existingIds = new Set(v1Bookings.map((b) => b._id.toString()));
      const merged = [...v1Bookings];

      for (const item of adaptedV2) {
        if (!existingIds.has(item._id.toString())) {
          merged.push(item);
        }
      }

      merged.sort((a, b) => {
        const dateA = a.bookingDate || a.createdAt || '';
        const dateB = b.bookingDate || b.createdAt || '';
        return String(dateB).localeCompare(String(dateA));
      });

      return merged;
    } catch (err) {
      console.error('[findByUser] Failed to fetch v2 reservations:', err);
      return v1Bookings;
    }
  }

  async findEventsForCalendar(orgId, startDate, endDate, filters = {}) {
    const query = { orgId: new mongoose.Types.ObjectId(orgId) };
    if (startDate && endDate) {
      query.bookingDate = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.bookingDate = { $gte: startDate };
    } else if (endDate) {
      query.bookingDate = { $lte: endDate };
    }
    const targetAmenityId = filters.facilityId || filters.amenityId;
    if (targetAmenityId && targetAmenityId !== 'All') {
      query.amenityId = new mongoose.Types.ObjectId(targetAmenityId);
    }
    if (filters.status && filters.status !== 'All') {
      query.status = filters.status.toLowerCase();
    }
    if (filters.paymentStatus && filters.paymentStatus !== 'All') {
      query.paymentStatus = filters.paymentStatus.toLowerCase();
    }
    const bookings = await AmenityBooking.find(query)
      .populate('userId', 'name email profilePicture flatNumber building tower phoneNumber villaNumber username')
      .populate('amenityId', 'name type images location bookingRules pricing')
      .sort({ bookingDate: 1, startTime: 1 })
      .lean();

    // If amenityId is null (e.g. references AmenityFacility in V2), populate from AmenityFacility
    const unpopulated = bookings.filter((b) => !b.amenityId);
    if (unpopulated.length > 0) {
      const rawDocs = await AmenityBooking.find(
        { _id: { $in: unpopulated.map((u) => u._id) } },
        { amenityId: 1 }
      ).lean();
      const rawMap = new Map(rawDocs.map((r) => [String(r._id), r.amenityId]));
      const facilityIds = [...new Set(rawDocs.map((r) => r.amenityId).filter(Boolean))];

      if (facilityIds.length > 0) {
        const AmenityFacility = mongoose.models.AmenityFacility || (await import('../amenityManagement/facilities/amenityFacility.model.js')).default;
        const facilities = await AmenityFacility.find({ _id: { $in: facilityIds } }).lean();
        const facMap = new Map(facilities.map((f) => [String(f._id), f]));

        for (const b of unpopulated) {
          const rawAmenityId = rawMap.get(String(b._id));
          if (rawAmenityId) {
            const fac = facMap.get(String(rawAmenityId));
            if (fac) {
              b.amenityId = fac;
            } else {
              b.amenityId = { _id: rawAmenityId, name: 'Amenity' };
            }
          }
        }
      }
    }

    return bookings;
  }

  async getAggregatedCalendarBookings(orgId, startDate, endDate) {
    return await AmenityBooking.aggregate([
      {
        $match: {
          orgId: new mongoose.Types.ObjectId(orgId),
          bookingDate: { $gte: startDate, $lte: endDate },
          status: { $in: ['approved', 'confirmed', 'checked-in'] }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            amenityId: '$amenityId',
            bookingDate: '$bookingDate',
            startTime: '$startTime',
            endTime: '$endTime'
          },
          totalAttendees: {
            $sum: { $ifNull: ['$numberOfPersons', 1] }
          },
          attendeeDetails: {
            $push: {
              userId: '$userId',
              userName: { $ifNull: ['$user.name', '$user.username'] },
              numberOfPersons: { $ifNull: ['$numberOfPersons', 1] }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'amenities',
          localField: '_id.amenityId',
          foreignField: '_id',
          as: 'amenity'
        }
      },
      { $unwind: '$amenity' },
      {
        $project: {
          _id: 0,
          amenityId: '$_id.amenityId',
          amenityName: '$amenity.name',
          bookingDate: '$_id.bookingDate',
          startTime: '$_id.startTime',
          endTime: '$_id.endTime',
          totalAttendees: 1,
          attendeeDetails: 1
        }
      }
    ]);
  }

  async countAllUpcomingBookings(orgId) {
    return await AmenityBooking.countDocuments({
      orgId: new mongoose.Types.ObjectId(orgId),
      status: { $in: ['confirmed', 'checked-in'] },
      bookingDate: { $gte: new Date().toISOString().split('T')[0] }
    });
  }

  async getRecentScans(orgId, startOfDay) {
    return await AmenityBooking.find({
      orgId: new mongoose.Types.ObjectId(orgId),
      status: { $in: ['checked-in', 'completed'] },
      $or: [
        { checkInTime: { $gte: startOfDay } },
        { checkOutTime: { $gte: startOfDay } }
      ]
    })
    .sort({ checkInTime: -1 })
    .populate('userId', 'name username email profilePicture')
    .populate('amenityId', 'name images')
    .populate('checkedInBy', 'name username')
    .limit(20)
    .lean();
  }

  async getActivePasses(userId, orgId) {
    return await AmenityBooking.find({
      userId,
      orgId,
      status: { $in: ['confirmed', 'checked-in'] },
      qrStatus: 'active'
    })
    .populate('amenityId', 'name type images location bookingRules pricing')
    .populate('userId', 'name')
    .sort({ bookingDate: 1, startTime: 1 })
    .exec();
  }

  async findById(id, orgId, session = null) {
    const query = { orgId };
    const cleanId = String(id || '').trim();
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      query.$or = [{ _id: new mongoose.Types.ObjectId(cleanId) }, { bookingId: cleanId }];
    } else {
      query.bookingId = cleanId;
    }
    return await AmenityBooking.findOne(query).session(session).populate('amenityId userId');
  }

  async create(bookingData, session = null) {
    const booking = new AmenityBooking(bookingData);
    return await booking.save(session ? { session } : undefined);
  }

  async updateStatus(id, orgId, status, reviewData = {}, session = null) {
    const query = { orgId };
    const cleanId = String(id || '').trim();
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      query.$or = [{ _id: new mongoose.Types.ObjectId(cleanId) }, { bookingId: cleanId }];
    } else {
      query.bookingId = cleanId;
    }
    const updated = await AmenityBooking.findOneAndUpdate(
      query,
      { $set: { status, ...reviewData } },
      { returnDocument: 'after', session }
    ).populate('amenityId userId');

    try {
      const AmenityReservation = (await import('../amenityManagement/reservations/amenityReservation.model.js')).default;
      const targetId = updated?._id || (mongoose.Types.ObjectId.isValid(cleanId) ? new mongoose.Types.ObjectId(cleanId) : null);
      if (targetId) {
        const resvUpdate = {
          bookingStatus: (status || 'CONFIRMED').toUpperCase(),
          updatedAt: new Date(),
        };
        if (reviewData.paymentStatus) {
          resvUpdate.paymentStatus = String(reviewData.paymentStatus).toUpperCase();
        }
        if (reviewData.cancellationReason) {
          resvUpdate.cancellationReason = reviewData.cancellationReason;
        }
        if (reviewData.refundAmount !== undefined) {
          resvUpdate.refundAmount = reviewData.refundAmount;
        }
        if (reviewData.refundPercentage !== undefined) {
          resvUpdate.refundPercentage = reviewData.refundPercentage;
        }
        await AmenityReservation.updateOne(
          { _id: targetId },
          { $set: resvUpdate },
          session ? { session } : undefined
        );
      }
    } catch (rErr) {
      // Non-blocking sync warning
    }

    return updated;
  }

  async findActiveBookingsByAmenity(amenityId, orgId) {
    const today = new Date().toISOString().split('T')[0];
    return await AmenityBooking.find({
      amenityId,
      orgId,
      status: { $in: ['pending', 'approved', 'confirmed', 'checked-in', 'PENDING', 'APPROVED', 'CONFIRMED', 'CHECKED_IN'] },
      $or: [
        { date: { $gte: today } },
        { bookingDate: { $gte: today } }
      ]
    });
  }

  async getKpiStats(orgId) {
    const kNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const today = `${kNow.getFullYear()}-${String(kNow.getMonth() + 1).padStart(2, '0')}-${String(kNow.getDate()).padStart(2, '0')}`;
    const matchOrg = { orgId: new mongoose.Types.ObjectId(orgId) };
    const kpis = await AmenityBooking.aggregate([
      { $match: { ...matchOrg, bookingDate: today, status: { $ne: 'cancelled' } } },
      { $group: {
          _id: null,
          checkIns: { $sum: { $cond: [ { $in: ['$status', ['checked-in', 'completed']] }, 1, 0 ] } },
          revenue: { $sum: '$pricingDetails.totalAmount' },
          totalBookings: { $sum: 1 }
      }}
    ]);
    return kpis[0] || { checkIns: 0, revenue: 0, totalBookings: 0 };
  }

  async getRevenueStats(orgId) {
    return await AmenityBooking.aggregate([
      { $match: { orgId: new mongoose.Types.ObjectId(orgId), status: { $ne: 'cancelled' } } },
      { $group: { _id: '$bookingDate', revenue: { $sum: '$pricingDetails.totalAmount' } } },
      { $sort: { _id: -1 } },
      { $limit: 7 }
    ]);
  }

  async getMonthlyIndicators(orgId, year, month) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const bookingDates = await AmenityBooking.distinct('bookingDate', {
      orgId: new mongoose.Types.ObjectId(orgId),
      bookingDate: { $regex: `^${monthStr}` },
      status: { $in: ['pending', 'approved', 'confirmed', 'checked-in'] }
    });

    const Amenity = mongoose.model('Amenity');
    const amenities = await Amenity.find(
      { orgId: new mongoose.Types.ObjectId(orgId), isDeleted: false },
      'maintenanceSchedules'
    );

    const datesSet = new Set(bookingDates || []);
    (amenities || []).forEach(amenity => {
      if (amenity.maintenanceSchedules && amenity.maintenanceSchedules.length > 0) {
        amenity.maintenanceSchedules.forEach(m => {
          if (m.startDate && m.startDate.startsWith(monthStr)) {
            datesSet.add(m.startDate);
          }
        });
      }
    });

    return Array.from(datesSet);
  }

  async getOccupancyStats(orgId) {
    return await AmenityBooking.aggregate([
      { $match: { orgId: new mongoose.Types.ObjectId(orgId), status: { $ne: 'cancelled' } } },
      { $group: { _id: '$bookingDate', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 7 }
    ]);
  }

  async getTrendsStats(orgId) {
    return await AmenityBooking.aggregate([
      { $match: { orgId: new mongoose.Types.ObjectId(orgId), status: { $ne: 'cancelled' } } },
      { $group: { _id: '$amenityId', count: { $sum: 1 } } },
      { $lookup: { from: 'amenities', localField: '_id', foreignField: '_id', as: 'amenity' } },
      { $unwind: '$amenity' },
      { $project: { name: '$amenity.name', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
  }

  async getRecentActivity(orgId) {
    return await AmenityBooking.find({ orgId: new mongoose.Types.ObjectId(orgId) })
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate('amenityId', 'name')
      .populate('userId', 'name')
      .exec();
  }

  /**
   * Consolidated dashboard aggregation — all booking metrics in a single $facet pipeline.
   * Returns: statusCounts, todayStats, revenueByPeriod, peakHours, monthlyComparison, recentActivity
   */
  async getDashboardAggregation(orgId) {
    const orgObjId = new mongoose.Types.ObjectId(orgId);
    const kNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const today = `${kNow.getFullYear()}-${String(kNow.getMonth() + 1).padStart(2, '0')}-${String(kNow.getDate()).padStart(2, '0')}`;
    
    const startOfWeek = new Date(kNow);
    startOfWeek.setDate(kNow.getDate() - kNow.getDay());
    const weekStart = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
    
    const monthStart = `${kNow.getFullYear()}-${String(kNow.getMonth() + 1).padStart(2, '0')}-01`;
    const prevMonthDate = new Date(kNow.getFullYear(), kNow.getMonth() - 1, 1);
    const prevMonthStart = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const prevMonthEnd = `${kNow.getFullYear()}-${String(kNow.getMonth() + 1).padStart(2, '0')}-01`;

    const result = await AmenityBooking.aggregate([
      { $match: { orgId: orgObjId } },
      {
        $facet: {
          // Booking counts by status
          statusCounts: [
            { $group: {
              _id: '$status',
              count: { $sum: 1 }
            }}
          ],

          // Today's stats
          todayStats: [
            { $match: { bookingDate: today } },
            { $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              revenue: { $sum: { $ifNull: ['$pricingDetails.totalAmount', 0] } },
              checkIns: { $sum: { $cond: [{ $ne: ['$checkInTime', null] }, 1, 0] } },
              checkOuts: { $sum: { $cond: [{ $ne: ['$checkOutTime', null] }, 1, 0] } },
              confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
              pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }
            }}
          ],

          // Upcoming bookings (future, non-cancelled)
          upcomingCount: [
            { $match: { bookingDate: { $gt: today }, status: { $nin: ['cancelled', 'rejected'] } } },
            { $count: 'count' }
          ],

          // Revenue by period
          dailyRevenue: [
            { $match: { bookingDate: today, status: { $nin: ['cancelled', 'rejected'] } } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$pricingDetails.totalAmount', 0] } } } }
          ],
          weeklyRevenue: [
            { $match: { bookingDate: { $gte: weekStart }, status: { $nin: ['cancelled', 'rejected'] } } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$pricingDetails.totalAmount', 0] } } } }
          ],
          monthlyRevenue: [
            { $match: { bookingDate: { $gte: monthStart }, status: { $nin: ['cancelled', 'rejected'] } } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$pricingDetails.totalAmount', 0] } } } }
          ],

          // Revenue trend (last 7 days)
          revenueTrend: [
            { $match: { status: { $nin: ['cancelled', 'rejected'] } } },
            { $group: { _id: '$bookingDate', revenue: { $sum: { $ifNull: ['$pricingDetails.totalAmount', 0] } }, bookings: { $sum: 1 } } },
            { $sort: { _id: -1 } },
            { $limit: 7 }
          ],

          // Booking trend (last 7 days)
          bookingTrend: [
            { $group: { _id: '$bookingDate', count: { $sum: 1 } } },
            { $sort: { _id: -1 } },
            { $limit: 7 }
          ],

          // Peak booking hours
          peakHours: [
            { $match: { status: { $nin: ['cancelled', 'rejected'] } } },
            { $addFields: { hourNum: { $toInt: { $substr: ['$startTime', 0, 2] } } } },
            { $group: { _id: '$hourNum', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
          ],

          // Most booked amenities (top 5)
          amenityUsage: [
            { $match: { status: { $nin: ['cancelled', 'rejected'] } } },
            { $group: { _id: '$amenityId', count: { $sum: 1 } } },
            { $lookup: { from: 'amenities', localField: '_id', foreignField: '_id', as: 'amenity' } },
            { $unwind: '$amenity' },
            { $project: { name: '$amenity.name', count: 1 } },
            { $sort: { count: -1 } },
            { $limit: 5 }
          ],

          // Payment status distribution (from bookings)
          paymentStatusDist: [
            { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
          ],

          // Monthly comparison (current vs previous)
          currentMonthBookings: [
            { $match: { bookingDate: { $gte: monthStart } } },
            { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$pricingDetails.totalAmount', 0] } } } }
          ],
          previousMonthBookings: [
            { $match: { bookingDate: { $gte: prevMonthStart, $lt: prevMonthEnd } } },
            { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$pricingDetails.totalAmount', 0] } } } }
          ],

          // Recent activity (last 15 events)
          recentActivity: [
            { $sort: { updatedAt: -1 } },
            { $limit: 15 },
            { $lookup: { from: 'amenities', localField: 'amenityId', foreignField: '_id', as: 'amenity' } },
            { $unwind: { path: '$amenity', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            { $project: {
              status: 1, bookingDate: 1, startTime: 1, endTime: 1, paymentStatus: 1,
              checkInTime: 1, checkOutTime: 1, updatedAt: 1, createdAt: 1,
              'amenity.name': 1, 'user.name': 1
            }}
          ]
        }
      }
    ]);

    return result[0];
  }
}

export default new AmenityBookingRepository();
