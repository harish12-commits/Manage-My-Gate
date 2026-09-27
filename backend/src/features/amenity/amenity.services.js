import amenityRepository from './amenity.repository.js';
import { amenityEventEmitter, AMENITY_CREATED, AMENITY_UPDATED, AMENITY_DELETED } from './amenity.events.js';
import HttpError from '../../utils/httpError.utils.js';

export class AmenityService {
  async getAllAmenities(orgId, filters = {}) {
    if (!orgId) throw new HttpError(400, 'Organization ID is required to fetch amenities.');
    
    const dbFilter = { isDeleted: false };
    if (filters.status) dbFilter.status = filters.status;
    if (filters.category && filters.category !== 'All') dbFilter.type = { $regex: new RegExp(filters.category, 'i') };
    if (filters.capacity) {
      const cap = parseInt(filters.capacity, 10);
      if (!isNaN(cap)) dbFilter.capacity = { $gte: cap };
    }
    if (filters.search) {
      dbFilter.$or = [
        { name: { $regex: new RegExp(filters.search, 'i') } },
        { location: { $regex: new RegExp(filters.search, 'i') } },
        { type: { $regex: new RegExp(filters.search, 'i') } }
      ];
    }
    
    try {
      const mongoose = (await import('mongoose')).default;
      const targetOrgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;
      const v2Facilities = await mongoose.connection.db
        .collection('amenity_management_facilities')
        .find({ orgId: targetOrgId, isDeleted: false })
        .toArray();

      if (v2Facilities && v2Facilities.length > 0) {
        const existingAmenities = await amenityRepository.findAllByOrg(orgId, { isDeleted: false });
        const existingIds = new Set(existingAmenities.map((a) => a._id.toString()));

        for (const f of v2Facilities) {
          if (!existingIds.has(f._id.toString())) {
            const pConfig = f.pricingConfig || {};
            const legacyDoc = {
              _id: f._id,
              orgId: f.orgId,
              name: f.name,
              description: f.description || '',
              type:
                f.archetype === 'EXCLUSIVE_HOURLY'
                  ? 'sports'
                  : f.archetype === 'SHARED_CAPACITY'
                    ? 'pool'
                    : f.archetype === 'EVENT_SPACE'
                      ? 'hall'
                      : 'general',
              category: f.category || 'General',
              archetype: f.archetype,
              code: f.code,
              location: f.location || '',
              pricing: {
                baseRate: pConfig.baseRate || 0,
                pricingType: (pConfig.pricingType || 'FREE').toLowerCase(),
                peakRateMultiplier: 1,
                weekendRateMultiplier: 1,
                holidayRateMultiplier: 1,
                securityDeposit: pConfig.securityDeposit || 0,
                securityDepositDescription:
                  (pConfig.securityDeposit || 0) > 0 ? 'Refundable deposit against equipment damages.' : null,
                taxPercentage: pConfig.taxPercentage || 0,
                cancellationChargePercentage: 0,
                dynamicPricingEnabled: false,
              },
              openDays: [0, 1, 2, 3, 4, 5, 6],
              capacity: f.maxCapacity || 1,
              bookingRules: {
                slotDurationMinutes: f.slotDurationMinutes || 60,
                bufferTimeMinutes: f.setupBufferMinutes || 10,
                openTime: f.operatingHours?.[0]?.openTime || '06:00',
                closeTime: f.operatingHours?.[0]?.closeTime || '22:00',
                maxBookingsPerUserPerSlot: f.maxHeadcountPerReservation || 2,
                advanceBookingDays: f.advanceBookingDays || 7,
                minAdvanceBookingHours: 1,
                isCancellationEnabled: f.cancellationPolicy?.isAllowed !== false,
                holidayCalendarIds: [],
                weeklyOffDays: [],
                cancellationRefundRules: [],
              },
              status: (f.status || 'ACTIVE').toLowerCase(),
              isDeleted: false,
              maintenanceSchedules: [],
              createdAt: f.createdAt || new Date(),
              updatedAt: f.updatedAt || new Date(),
            };
            await mongoose.connection.db.collection('amenities').updateOne(
              { _id: f._id },
              { $set: legacyDoc },
              { upsert: true }
            );
          }
        }
      }
    } catch (syncErr) {
      // Non-blocking sync error logging
    }

    let amenities = await amenityRepository.findAllByOrg(orgId, dbFilter);
    
    if (filters.priceRange) {
      const [min, max] = filters.priceRange.split('-').map(Number);
      amenities = amenities.filter(a => {
        const rate = a.ratePerHour || a.pricing?.baseRate || 0;
        if (max) return rate >= min && rate <= max;
        return rate >= min;
      });
    }

    const moment = (await import('moment-timezone')).default;
    const TIMEZONE = 'Asia/Kolkata';
    const now = moment().tz(TIMEZONE);
    const today = now.format('YYYY-MM-DD');
    const currentTime = now.format('HH:mm');
    const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;
    
    amenities = await Promise.all(amenities.map(async (amenity) => {
      const a = amenity.toObject ? amenity.toObject() : amenity;
      
      if (a.status === 'active') {
        a.currentStatus = 'Available';
        const dayOfWeek = now.day();
        if (a.bookingRules?.weeklyOffDays?.includes(dayOfWeek)) {
          a.currentStatus = 'Closed';
        } else {
          const openTime = a.bookingRules?.openTime || '00:00';
          const closeTime = a.bookingRules?.closeTime || '23:59';
          
          let isOpen = false;
          if (closeTime < openTime) {
             // Operates past midnight
             isOpen = currentTime >= openTime || currentTime <= closeTime;
          } else {
             isOpen = currentTime >= openTime && currentTime <= closeTime;
          }
          
          if (!isOpen) {
            a.currentStatus = 'Closed';
          }
        }
        
        if (a.maintenanceSchedules && a.maintenanceSchedules.length > 0) {
          const hasActiveMaintenance = a.maintenanceSchedules.some(maint => {
            const mStart = moment.tz(`${maint.startDate}T${maint.startTime || '00:00'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
            let mEnd = moment.tz(`${maint.endDate}T${maint.endTime || '23:59'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
            if (mEnd < mStart) mEnd = moment(mEnd).add(1, 'days').toDate();
            const nowDt = now.toDate();
            return nowDt >= mStart && nowDt <= mEnd;
          });
          if (hasActiveMaintenance) {
            a.currentStatus = 'Under Maintenance';
          }
        }

        // Authoritative v2 maintenance check
        if (a.currentStatus !== 'Closed') {
          try {
            const amenityMaintenanceBlockService = (await import('../amenityManagement/maintenance/amenityMaintenanceBlock.service.js')).default;
            const activeV2Blocks = await amenityMaintenanceBlockService.getOverlappingBlocks({
              orgId,
              facilityId: a._id,
              startDateTime: now.toDate(),
              endDateTime: now.toDate()
            });
            if (activeV2Blocks && activeV2Blocks.length > 0) {
              a.currentStatus = 'Under Maintenance';
            }
          } catch (maintErr) {}
        }
        
        if (a.currentStatus === 'Available') {
          const conflicts = await amenityBookingService.findConflicts(orgId, a._id, today, currentTime, currentTime);
          const occupied = conflicts.reduce((sum, b) => sum + parseInt(b.numberOfPersons || 1, 10), 0);
          if (occupied >= a.capacity) {
            a.currentStatus = 'Fully Booked';
          }
        }
      } else {
        a.currentStatus = 'Unavailable';
      }
      return a;
    }));

    if (filters.sort) {
      amenities.sort((a, b) => {
        if (filters.sort === 'name') return a.name.localeCompare(b.name);
        if (filters.sort === 'price') return (a.ratePerHour || a.pricing?.baseRate || 0) - (b.ratePerHour || b.pricing?.baseRate || 0);
        if (filters.sort === 'capacity') return b.capacity - a.capacity;
        if (filters.sort === 'availability') return a.currentStatus.localeCompare(b.currentStatus);
        return 0;
      });
    }

    return amenities;
  }

  async getAmenityById(id, orgId) {
    const amenity = await amenityRepository.findById(id, orgId);
    if (!amenity) {
      throw new HttpError(404, `Amenity with ID ${id} not found.`);
    }
    return amenity;
  }

  async createAmenity(orgId, amenityData) {
    if (amenityData.name) amenityData.name = amenityData.name.trim();
    if (amenityData.description) amenityData.description = amenityData.description.trim();
    if (amenityData.status && typeof amenityData.status === 'string') {
      amenityData.status = amenityData.status.toLowerCase();
    }
    
    // Duplicate Name Validation
    if (amenityData.name) {
      const existing = await amenityRepository.findByName(amenityData.name, orgId);
      if (existing) {
        throw new HttpError(400, 'An amenity with this name already exists.');
      }
    }
    
    amenityData.orgId = orgId; // override/set just to be safe
    const created = await amenityRepository.create(amenityData);
    
    try {
      const mongoose = (await import('mongoose')).default;
      const archetype =
        created.archetype ||
        (created.type === 'sports'
          ? 'EXCLUSIVE_HOURLY'
          : created.type === 'pool'
            ? 'SHARED_CAPACITY'
            : created.type === 'hall'
              ? 'EVENT_SPACE'
              : 'SHARED_CAPACITY');
      const v2Doc = {
        _id: created._id,
        orgId: created.orgId,
        name: created.name,
        code:
          created.code ||
          `FAC-${created.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)}-${Math.floor(100 + Math.random() * 900)}`,
        archetype,
        description: created.description || '',
        location: created.location || 'Main Campus',
        category: created.category || created.type || 'General',
        timezone: 'Asia/Kolkata',
        operatingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          dayOfWeek,
          openTime: created.bookingRules?.openTime || '06:00',
          closeTime: created.bookingRules?.closeTime || '22:00',
          isOpen: true,
        })),
        slotDurationMinutes: created.bookingRules?.slotDurationMinutes || 60,
        maxCapacity: created.capacity || 1,
        maxHeadcountPerReservation: created.bookingRules?.maxBookingsPerUserPerSlot || 2,
        pricingConfig: {
          pricingType: (created.pricing?.pricingType || 'FREE').toUpperCase(),
          baseRate: created.pricing?.baseRate || created.ratePerHour || 0,
          currency: 'INR',
          securityDeposit: created.pricing?.securityDeposit || 0,
          taxPercentage: created.pricing?.taxPercentage || 0,
          cancellationFee: 0,
        },
        requiresApproval: false,
        cancellationPolicy: {
          isAllowed: created.bookingRules?.isCancellationEnabled !== false,
          refundCutoffHours: 2,
          refundPercentage: 100,
        },
        status: (created.status || 'ACTIVE').toUpperCase(),
        isDraft: false,
        isActive: created.status !== 'inactive',
        isDeleted: false,
        deletedAt: null,
        concurrencyVersion: 0,
        createdAt: created.createdAt || new Date(),
        updatedAt: created.updatedAt || new Date(),
      };
      await mongoose.connection.db.collection('amenity_management_facilities').updateOne(
        { _id: created._id },
        { $set: v2Doc },
        { upsert: true }
      );
    } catch (syncV2Err) {
      // Non-blocking sync
    }

    // Audit log can be handled by events
    amenityEventEmitter.emit(AMENITY_CREATED, created);
    return created;
  }

  async updateAmenity(id, orgId, updateData, force = false) {
    await this.getAmenityById(id, orgId); // Verify existence

    if (updateData.name) updateData.name = updateData.name.trim();
    if (updateData.description) updateData.description = updateData.description.trim();
    if (updateData.status && typeof updateData.status === 'string') {
      updateData.status = updateData.status.toLowerCase();
    }

    // Check if status is being set to inactive
    if (updateData.status === 'inactive') {
      const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;
      const hasPendingBookings = await amenityBookingService.hasPendingOrApprovedFutureBookings(id, orgId);
      if (hasPendingBookings) {
        if (!force) {
          throw new HttpError(400, 'Cannot deactivate amenity: there are pending or approved future bookings.');
        } else {
          const activeBookings = await amenityBookingService.findActiveBookingsByAmenity(id, orgId);
          for (const booking of activeBookings) {
            await amenityBookingService.cancelBooking(booking._id, booking.userId, orgId, 'Cancelled: Amenity facility has been temporarily deactivated.', true);
          }
        }
      }
    }

    const updated = await amenityRepository.update(id, orgId, updateData);

    try {
      const mongoose = (await import('mongoose')).default;
      const v2Updates = {
        updatedAt: new Date(),
      };
      if (updated.name) v2Updates.name = updated.name;
      if (updated.description) v2Updates.description = updated.description;
      if (updated.location) v2Updates.location = updated.location;
      if (updated.capacity) v2Updates.maxCapacity = updated.capacity;
      if (updated.status) {
        v2Updates.status = updated.status.toUpperCase();
        v2Updates.isActive = updated.status.toLowerCase() !== 'inactive';
      }
      await mongoose.connection.db.collection('amenity_management_facilities').updateOne(
        { _id: updated._id },
        { $set: v2Updates }
      );
    } catch (syncV2Err) {
      // Non-blocking sync
    }

    amenityEventEmitter.emit(AMENITY_UPDATED, updated);
    return updated;
  }

  async updateStatus(id, orgId, status, force = false) {
    await this.getAmenityById(id, orgId); // Verify existence

    const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : status;

    if (normalizedStatus === 'inactive') {
      const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;
      const hasPendingBookings = await amenityBookingService.hasPendingOrApprovedFutureBookings(id, orgId);
      if (hasPendingBookings) {
        if (!force) {
          throw new HttpError(400, 'Cannot deactivate amenity: there are pending or approved future bookings.');
        } else {
          const activeBookings = await amenityBookingService.findActiveBookingsByAmenity(id, orgId);
          for (const booking of activeBookings) {
            if (['pending', 'approved', 'confirmed'].includes(booking.status)) {
              try {
                await amenityBookingService.cancelBooking(booking._id, booking.userId, orgId, 'Cancelled: Amenity facility has been temporarily deactivated.', true);
              } catch (cErr) {
                // Ignore if already completed or processed
              }
            }
          }
        }
      }
    }

    const updated = await amenityRepository.update(id, orgId, { status: normalizedStatus });

    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.connection.db.collection('amenity_management_facilities').updateOne(
        { _id: updated._id },
        {
          $set: {
            status: normalizedStatus.toUpperCase(),
            isActive: normalizedStatus !== 'inactive',
            updatedAt: new Date(),
          },
        }
      );
    } catch (syncV2Err) {
      // Non-blocking sync
    }

    amenityEventEmitter.emit(AMENITY_UPDATED, updated);
    return updated;
  }

  async deleteAmenity(id, orgId, force = false) {
    await this.getAmenityById(id, orgId); // Verify existence
    
    // Check if there are active bookings
    const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;
    const hasPendingBookings = await amenityBookingService.hasPendingOrApprovedFutureBookings(id, orgId);
    if (hasPendingBookings) {
      if (!force) {
        throw new HttpError(400, 'Cannot delete amenity: there are pending or approved future bookings.');
      } else {
        const activeBookings = await amenityBookingService.findActiveBookingsByAmenity(id, orgId);
        for (const booking of activeBookings) {
          if (['pending', 'approved', 'confirmed'].includes(booking.status)) {
            try {
              await amenityBookingService.cancelBooking(booking._id, booking.userId, orgId, 'Cancelled: Amenity facility has been permanently deleted.', true);
            } catch (cErr) {
              // Ignore if already completed
            }
          }
        }
      }
    }

    const deleted = await amenityRepository.softDelete(id, orgId);

    try {
      const mongoose = (await import('mongoose')).default;
      const targetId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
      await mongoose.connection.db.collection('amenity_management_facilities').updateOne(
        { _id: targetId },
        { $set: { isDeleted: true, status: 'INACTIVE', isActive: false, deletedAt: new Date() } }
      );
    } catch (syncV2Err) {
      // Non-blocking sync
    }

    amenityEventEmitter.emit(AMENITY_DELETED, deleted);
    return deleted;
  }

  /**
   * Generates available time slots for a specific amenity on a specific date.
   * Considers operating hours, slot duration, weekly offs, maintenance, and existing bookings.
   */
  async getAvailableSlots(id, orgId, dateStr) {
    const amenity = await this.getAmenityById(id, orgId);
    if (amenity.status !== 'active') return [];

    const moment = (await import('moment-timezone')).default;
    const TIMEZONE = 'Asia/Kolkata';
    const targetDate = moment.tz(dateStr, 'YYYY-MM-DD', TIMEZONE).startOf('day');
    const dayOfWeek = targetDate.day();

    // 1. Weekly Off Check
    if (amenity.bookingRules?.weeklyOffDays?.includes(dayOfWeek)) {
      return []; // Closed today
    }

    // 2. Maintenance Check
    if (amenity.maintenanceSchedules && amenity.maintenanceSchedules.length > 0) {
      const dayStart = targetDate.toDate();
      const dayEnd = moment(targetDate).add(1, 'days').toDate();
      for (const maint of amenity.maintenanceSchedules) {
        const mStart = moment.tz(`${maint.startDate}T${maint.startTime || '00:00'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
        let mEnd = moment.tz(`${maint.endDate}T${maint.endTime || '23:59'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
        if (mEnd < mStart) mEnd = moment(mEnd).add(1, 'days').toDate();
        
        if (mStart < dayEnd && mEnd > dayStart) {
          if (amenity.pricing?.pricingType === 'daily') {
            return []; // Full day blocked by maintenance
          }
        }
      }
    }

    // 3. Daily Pricing Bypass
    if (amenity.pricing?.pricingType === 'daily') {
      const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;
      const existingBookings = await amenityBookingService.findByOrgPaginated(orgId, {
        amenityId: id,
        bookingDate: dateStr,
        status: { $in: ['pending', 'approved', 'confirmed', 'checked-in'] }
      }, 0, 1000);
      
      const bookings = existingBookings?.data || [];
      const bookedSpots = bookings.reduce((sum, b) => sum + parseInt(b.numberOfPersons || 1, 10), 0);
      const isBooked = bookedSpots >= amenity.capacity;
      
      let multiplier = 1.0;
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        multiplier = amenity.pricing?.weekendRateMultiplier || 1.0;
      }
      
      return [{
        startTime: amenity.bookingRules?.openTime || '00:00',
        endTime: amenity.bookingRules?.closeTime || '23:59',
        status: isBooked ? 'Booked' : 'Available',
        price: (amenity.pricing?.baseRate || 0) * multiplier
      }];
    }

    // Standard Slot Generation logic
    const openTime = amenity.bookingRules?.openTime || '06:00';
    const closeTime = amenity.bookingRules?.closeTime || '22:00';
    const slotDuration = amenity.slotDuration || 60; // minutes
    const bufferMins = amenity.bookingRules?.bufferTimeBetweenBookings || 0;

    const startDateTime = moment.tz(`${dateStr}T${openTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE);
    let endDateTime = moment.tz(`${dateStr}T${closeTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE);
    if (endDateTime < startDateTime) {
      endDateTime.add(1, 'days');
    }

    const allSlots = [];
    let currentMs = startDateTime.valueOf();
    const endMs = endDateTime.valueOf();

    while (currentMs + (slotDuration * 60000) <= endMs) {
      const startMs = currentMs;
      const slotEndMs = currentMs + (slotDuration * 60000);
      
      const sDate = moment(currentMs).tz(TIMEZONE);
      const eDate = moment(slotEndMs).tz(TIMEZONE);
      
      const formatTime = (m) => m.format('HH:mm');
      
      allSlots.push({
        startTime: formatTime(sDate),
        endTime: formatTime(eDate),
        startMs,
        endMs: slotEndMs
      });
      
      currentMs = slotEndMs + (bufferMins * 60000); // Advance by duration + buffer
    }

    // 4. Fetch existing bookings for that date
    const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;
    const existingBookings = await amenityBookingService.findByOrgPaginated(orgId, {
      amenityId: id,
      bookingDate: dateStr,
      status: { $in: ['pending', 'approved', 'confirmed', 'checked-in'] }
    }, 0, 1000);

    const bookings = existingBookings?.data || [];

    // 4b. Fetch authoritative v2 maintenance blocks for that date
    let v2MaintenanceBlocks = [];
    try {
      const amenityMaintenanceBlockService = (await import('../amenityManagement/maintenance/amenityMaintenanceBlock.service.js')).default;
      const dayStart = targetDate.toDate();
      const dayEnd = moment(targetDate).add(1, 'days').toDate();
      v2MaintenanceBlocks = await amenityMaintenanceBlockService.getOverlappingBlocks({
        orgId,
        facilityId: id,
        startDateTime: dayStart,
        endDateTime: dayEnd
      });
    } catch (e) {}
    
    // 5. Filter out slots that overlap with maintenance or exceed capacity
    const availableSlots = allSlots.filter(slot => {
      const slotStart = moment.tz(`${dateStr}T${slot.startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      const slotEnd = moment.tz(`${dateStr}T${slot.endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();

      // Check maintenance (legacy)
      let inMaintenance = false;
      if (amenity.maintenanceSchedules) {
        for (const maint of amenity.maintenanceSchedules) {
          const mStart = moment.tz(`${maint.startDate}T${maint.startTime || '00:00'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
          let mEnd = moment.tz(`${maint.endDate}T${maint.endTime || '23:59'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
          if (mEnd < mStart) mEnd = moment(mEnd).add(1, 'days').toDate();
          if (slotStart < mEnd && slotEnd > mStart) {
            inMaintenance = true;
            break;
          }
        }
      }

      // Check authoritative v2 maintenance blocks (with effective buffer window)
      if (!inMaintenance && v2MaintenanceBlocks && v2MaintenanceBlocks.length > 0) {
        for (const b of v2MaintenanceBlocks) {
          const bBufBefore = (b.bufferBeforeMinutes || 0) * 60000;
          const bBufAfter = (b.bufferAfterMinutes || 0) * 60000;
          const bStart = new Date(b.startDateTime).getTime() - bBufBefore;
          const bEnd = new Date(b.endDateTime).getTime() + bBufAfter;
          if (slotStart.getTime() < bEnd && slotEnd.getTime() > bStart) {
            inMaintenance = true;
            break;
          }
        }
      }
      if (inMaintenance) return false;

      // Check capacity
      let overlappingBookings = 0;
      for (const b of bookings) {
        const bStart = moment.tz(`${dateStr}T${b.startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
        let bEnd = moment.tz(`${dateStr}T${b.endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
        if (bEnd < bStart) bEnd = moment(bEnd).add(1, 'days').toDate();
        if (slotStart < bEnd && slotEnd > bStart) {
          overlappingBookings += parseInt(b.numberOfPersons || 1, 10);
        }
      }

      if (overlappingBookings >= amenity.capacity) {
        return false; // Fully booked
      }

      // Past time check (don't return slots in the past if date is today)
      if (slotStart < moment().tz(TIMEZONE).toDate()) {
        return false;
      }

      return true;
    });

    // 6. Calculate Price for each slot
    let multiplier = 1.0;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      multiplier = amenity.pricing?.weekendRateMultiplier || 1.0;
    }
    const baseRate = amenity.pricingConfig?.baseRate || amenity.pricing?.baseRate || amenity.ratePerHour || 0;
    const durationHours = durationMins / 60;
    const price = baseRate * durationHours * multiplier;

    return availableSlots.map(s => ({
      startTime: s.startTime,
      endTime: s.endTime,
      price: price
    }));
  }

  async getAllSlots(id, orgId, dateStr, userId) {
    const amenity = await this.getAmenityById(id, orgId);
    
    const moment = (await import('moment-timezone')).default;
    const TIMEZONE = 'Asia/Kolkata';
    const targetDate = moment.tz(dateStr, 'YYYY-MM-DD', TIMEZONE).startOf('day');
    const dayOfWeek = targetDate.day();
    const isWeeklyOff = amenity.bookingRules?.weeklyOffDays?.includes(dayOfWeek);

    if (amenity.pricing?.pricingType === 'daily') {
      const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;
      const existingBookings = await amenityBookingService.findByOrgPaginated(orgId, {
        amenityId: id,
        bookingDate: dateStr,
        status: { $in: ['pending', 'approved', 'confirmed', 'checked-in'] }
      }, 0, 1000);
      
      const bookings = existingBookings?.data || [];
      const bookedSpots = bookings.reduce((sum, b) => sum + parseInt(b.numberOfPersons || 1, 10), 0);
      const isBooked = bookedSpots >= amenity.capacity;
      
      let multiplier = 1.0;
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        multiplier = amenity.pricing?.weekendRateMultiplier || 1.0;
      }
      
      let status = isBooked ? 'Booked' : 'Available';
      
      // Basic maintenance/weekly off check for daily
      if (isWeeklyOff || amenity.status !== 'active') {
        status = 'Closed';
      } else if (amenity.maintenanceSchedules && amenity.maintenanceSchedules.length > 0) {
        for (const maint of amenity.maintenanceSchedules) {
          const mStart = moment.tz(`${maint.startDate}T00:00`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
          const mEnd = moment.tz(`${maint.endDate}T23:59`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
          if (targetDate.toDate() >= mStart && targetDate.toDate() <= mEnd) {
            status = 'Maintenance';
            break;
          }
        }
      }
      
      const today = moment().tz(TIMEZONE).startOf('day');
      if (targetDate.isBefore(today)) {
        status = 'Closed';
      }

      let bookedByMe = false;
      let bookingId = null;
      let bookingStatus = null;
      let myBookingsCount = 0;

      for (const b of bookings) {
        if (userId && b.user && b.user._id && b.user._id.toString() === userId.toString()) {
          bookedByMe = true;
          myBookingsCount += (b.numberOfPersons || 1);
          bookingId = b.bookingId || b._id;
          bookingStatus = b.status;
        } else if (userId && b.userId && b.userId.toString() === userId.toString()) {
          bookedByMe = true;
          myBookingsCount += (b.numberOfPersons || 1);
          bookingId = b.bookingId || b._id;
          bookingStatus = b.status;
        }
      }

      return [{
        startTime: amenity.bookingRules?.openTime || '00:00',
        endTime: amenity.bookingRules?.closeTime || '23:59',
        status,
        price: (amenity.pricing?.baseRate || 0) * multiplier,
        bookedByMe,
        bookingId,
        bookingStatus,
        myBookingsCount
      }];
    }

    const openTime = amenity.bookingRules?.openTime || '06:00';
    const closeTime = amenity.bookingRules?.closeTime || '22:00';
    const durationMins = amenity.bookingRules?.slotDurationMinutes || 60;
    const bufferMins = amenity.bookingRules?.bufferTimeMinutes || 0;

    const startMs = moment.tz(`${dateStr}T${openTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).valueOf();
    let endMs = moment.tz(`${dateStr}T${closeTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).valueOf();
    if (endMs < startMs) {
      endMs = moment.tz(`${dateStr}T${closeTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).add(1, 'days').valueOf();
    }
    
    let currentMs = startMs;
    const allSlots = [];
    
    while (currentMs + (durationMins * 60000) <= endMs) {
      const slotEndMs = currentMs + (durationMins * 60000);
      const sDate = moment(currentMs).tz(TIMEZONE);
      const eDate = moment(slotEndMs).tz(TIMEZONE);
      const formatTime = (m) => m.format('HH:mm');
      
      allSlots.push({
        startTime: formatTime(sDate),
        endTime: formatTime(eDate),
        startMs,
        endMs: slotEndMs
      });
      
      currentMs = slotEndMs + (bufferMins * 60000);
    }

    const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;
    const existingBookings = await amenityBookingService.findByOrgPaginated(orgId, {
      amenityId: id,
      bookingDate: dateStr,
      status: { $in: ['pending', 'approved', 'confirmed', 'checked-in'] }
    }, 0, 1000);
    const bookings = existingBookings?.data || [];

    // Fetch authoritative v2 maintenance blocks for that date
    let v2MaintenanceBlocks = [];
    try {
      const amenityMaintenanceBlockService = (await import('../amenityManagement/maintenance/amenityMaintenanceBlock.service.js')).default;
      const dayStart = targetDate.toDate();
      const dayEnd = moment(targetDate).add(1, 'days').toDate();
      v2MaintenanceBlocks = await amenityMaintenanceBlockService.getOverlappingBlocks({
        orgId,
        facilityId: id,
        startDateTime: dayStart,
        endDateTime: dayEnd
      });
    } catch (e) {}

    let multiplier = 1.0;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      multiplier = amenity.pricing?.weekendRateMultiplier || 1.0;
    }
    const baseRate = amenity.pricingConfig?.baseRate || amenity.pricing?.baseRate || amenity.ratePerHour || 0;
    const durationHours = durationMins / 60;
    const price = baseRate * durationHours * multiplier;

    return allSlots.map(slot => {
      const slotStart = moment.tz(`${dateStr}T${slot.startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      const slotEnd = moment.tz(`${dateStr}T${slot.endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      
      let status = 'Available';
      let bookedByMe = false;
      let bookingId = null;
      let bookingStatus = null;
      let myBookingsCount = 0;

      if (slotStart < moment().tz(TIMEZONE).toDate()) {
        status = 'Closed';
      }

      if (amenity.maintenanceSchedules) {
        for (const maint of amenity.maintenanceSchedules) {
          const mStart = moment.tz(`${maint.startDate}T${maint.startTime || '00:00'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
          let mEnd = moment.tz(`${maint.endDate}T${maint.endTime || '23:59'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
          if (mEnd < mStart) mEnd = moment(mEnd).add(1, 'days').toDate();
          if (slotStart < mEnd && slotEnd > mStart) {
            status = 'Maintenance';
            break;
          }
        }
      }

      if (status !== 'Maintenance' && v2MaintenanceBlocks && v2MaintenanceBlocks.length > 0) {
        for (const b of v2MaintenanceBlocks) {
          const bBufBefore = (b.bufferBeforeMinutes || 0) * 60000;
          const bBufAfter = (b.bufferAfterMinutes || 0) * 60000;
          const bStart = new Date(b.startDateTime).getTime() - bBufBefore;
          const bEnd = new Date(b.endDateTime).getTime() + bBufAfter;
          if (slotStart.getTime() < bEnd && slotEnd.getTime() > bStart) {
            status = 'Maintenance';
            break;
          }
        }
      }

      if (status !== 'Maintenance' && (isWeeklyOff || amenity.status !== 'active')) {
        status = 'Closed';
      }

      if (status === 'Available') {
        let overlappingBookings = 0;
        for (const b of bookings) {
          const bStart = moment.tz(`${dateStr}T${b.startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
          let bEnd = moment.tz(`${dateStr}T${b.endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
          if (bEnd < bStart) bEnd = moment(bEnd).add(1, 'days').toDate();
          if (slotStart < bEnd && slotEnd > bStart) {
            overlappingBookings += (b.numberOfPersons || 1);
            const bUserObj = b.userId || b.user;
            const bUserStr = bUserObj ? (bUserObj._id ? bUserObj._id.toString() : bUserObj.toString()) : '';
            if (userId && bUserStr && bUserStr === userId.toString()) {
              bookedByMe = true;
              myBookingsCount += (b.numberOfPersons || 1);
              bookingId = b.bookingId || b._id;
              bookingStatus = b.status;
            }
          }
        }
        if (overlappingBookings >= amenity.capacity) {
          status = 'Booked';
        }
      }

      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: durationMins,
        price: price,
        status: status,
        bookedByMe,
        myBookingsCount,
        maxBookingsPerUser: amenity.maxBookingsPerUserPerSlot || 2, // It should be maxBookingsPerUserPerSlot but the model might have it as maxBookingsPerUserPerSlot right now based on my previous edit
        bookingId,
        bookingStatus
      };
    });
  }

  async searchAvailableAmenities(orgId, dateStr, startTime, endTime, filters = {}) {
    const dbFilter = { status: 'active' };
    if (filters.category && filters.category !== 'All') dbFilter.type = { $regex: new RegExp(filters.category, 'i') };
    if (filters.capacity) {
      const cap = parseInt(filters.capacity, 10);
      if (!isNaN(cap)) dbFilter.capacity = { $gte: cap };
    }
    if (filters.search) {
      dbFilter.$or = [
        { name: { $regex: new RegExp(filters.search, 'i') } },
        { location: { $regex: new RegExp(filters.search, 'i') } }
      ];
    }
    
    let amenities = await amenityRepository.findAllByOrg(orgId, dbFilter);

    if (filters.priceRange) {
      const [min, max] = filters.priceRange.split('-').map(Number);
      amenities = amenities.filter(a => {
        const rate = a.ratePerHour || a.pricing?.baseRate || 0;
        if (max) return rate >= min && rate <= max;
        return rate >= min;
      });
    }

    const availableAmenities = [];
    const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;

    for (const amenity of amenities) {
      // 1. Weekly Off Check
      const moment = (await import('moment-timezone')).default;
      const TIMEZONE = 'Asia/Kolkata';
      const targetDate = moment.tz(dateStr, 'YYYY-MM-DD', TIMEZONE).startOf('day');
      if (amenity.bookingRules?.weeklyOffDays?.includes(targetDate.day())) {
        continue;
      }

      const slotStart = moment.tz(`${dateStr}T${startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      let slotEnd = moment.tz(`${dateStr}T${endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      if (slotEnd < slotStart) slotEnd = moment(slotEnd).add(1, 'days').toDate();

      // 2. Operating hours check
      const openTimeParsed = moment.tz(`${dateStr}T${amenity.bookingRules?.openTime || '00:00'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      let closeTimeParsed = moment.tz(`${dateStr}T${amenity.bookingRules?.closeTime || '23:59'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      if (closeTimeParsed < openTimeParsed) closeTimeParsed = moment(closeTimeParsed).add(1, 'days').toDate();
      
      if (slotStart < openTimeParsed || slotEnd > closeTimeParsed) {
        continue;
      }

      // 3. Maintenance check (legacy)
      let inMaintenance = false;
      if (amenity.maintenanceSchedules) {
        for (const maint of amenity.maintenanceSchedules) {
          const mStart = moment.tz(`${maint.startDate}T${maint.startTime || '00:00'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
          let mEnd = moment.tz(`${maint.endDate}T${maint.endTime || '23:59'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
          if (mEnd < mStart) mEnd = moment(mEnd).add(1, 'days').toDate();
          
          if (slotStart < mEnd && slotEnd > mStart) {
            inMaintenance = true;
            break;
          }
        }
      }

      // Check authoritative v2 maintenance blocks
      if (!inMaintenance) {
        try {
          const amenityMaintenanceBlockService = (await import('../amenityManagement/maintenance/amenityMaintenanceBlock.service.js')).default;
          const v2Blocks = await amenityMaintenanceBlockService.getOverlappingBlocks({
            orgId,
            facilityId: amenity._id,
            startDateTime: slotStart,
            endDateTime: slotEnd
          });
          if (v2Blocks && v2Blocks.length > 0) {
            inMaintenance = true;
          }
        } catch (e) {}
      }
      if (inMaintenance) continue;

      // 4. Booking conflicts check
      const conflicts = await amenityBookingService.findConflicts(orgId, amenity._id, dateStr, startTime, endTime);
      const occupied = conflicts.reduce((sum, b) => sum + parseInt(b.numberOfPersons || 1, 10), 0);
      
      if (occupied < amenity.capacity) {
        const a = amenity.toObject ? amenity.toObject() : amenity;
        a.currentStatus = 'Available';
        availableAmenities.push(a);
      }
    }

    // Sorting
    if (filters.sort) {
      availableAmenities.sort((a, b) => {
        if (filters.sort === 'name') return a.name.localeCompare(b.name);
        if (filters.sort === 'price') return (a.ratePerHour || a.pricing?.baseRate || 0) - (b.ratePerHour || b.pricing?.baseRate || 0);
        if (filters.sort === 'capacity') return b.capacity - a.capacity;
        if (filters.sort === 'availability') return a.currentStatus.localeCompare(b.currentStatus);
        return 0;
      });
    }

    return availableAmenities;
  }

  async getAmenityStats(orgId) {
    if (!orgId) throw new HttpError(400, 'Organization ID is required');
    return await amenityRepository.getAmenityStats(orgId);
  }

  async getMaintenanceStats(orgId) {
    if (!orgId) throw new HttpError(400, 'Organization ID is required');
    return await amenityRepository.getMaintenanceStats(orgId);
  }

  async getAllMaintenance(orgId) {
    if (!orgId) throw new HttpError(400, 'Organization ID is required');
    return await amenityRepository.getAllMaintenance(orgId);
  }

  async scheduleMaintenance(amenityId, orgId, maintenanceData) {
    const amenity = await this.getAmenityById(amenityId, orgId);
    if (!amenity) throw new HttpError(404, 'Amenity not found');

    const moment = (await import('moment-timezone')).default;
    const TIMEZONE = 'Asia/Kolkata';
    const mStart = moment.tz(`${maintenanceData.startDate}T${maintenanceData.startTime || '00:00'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
    let mEnd = moment.tz(`${maintenanceData.endDate}T${maintenanceData.endTime || '23:59'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
    if (mEnd < mStart) mEnd = moment(mEnd).add(1, 'days').toDate();

    if (amenity.maintenanceSchedules && amenity.maintenanceSchedules.length > 0) {
      for (const maint of amenity.maintenanceSchedules) {
        const existingStart = moment.tz(`${maint.startDate}T${maint.startTime || '00:00'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
        let existingEnd = moment.tz(`${maint.endDate}T${maint.endTime || '23:59'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
        if (existingEnd < existingStart) existingEnd = moment(existingEnd).add(1, 'days').toDate();
        if (mStart < existingEnd && mEnd > existingStart) {
          throw new HttpError(400, 'A maintenance schedule already exists that overlaps with the requested time.');
        }
      }
    }

    const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;
    const activeBookings = await amenityBookingService.findActiveBookingsByAmenity(amenityId, orgId);
    
    const overlappingBookings = [];
    for (const booking of activeBookings) {
      const bStart = moment.tz(`${booking.bookingDate}T${booking.startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      let bEnd = moment.tz(`${booking.bookingDate}T${booking.endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      if (bEnd < bStart) bEnd = moment(bEnd).add(1, 'days').toDate();
      if (mStart < bEnd && mEnd > bStart) {
        if (!maintenanceData.autoCancelBookings) {
          throw new HttpError(400, `Cannot schedule maintenance. An active booking exists on ${booking.bookingDate} (${booking.startTime} - ${booking.endTime}).`);
        } else {
          overlappingBookings.push(booking);
        }
      }
    }

    if (maintenanceData.autoCancelBookings && overlappingBookings.length > 0) {
      const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;
      for (const booking of overlappingBookings) {
         await amenityBookingService.cancelBooking(booking._id, booking.userId, orgId, `Cancelled due to facility maintenance: ${maintenanceData.title}`, true);
      }
    }

    const updated = await amenityRepository.update(amenityId, orgId, {
      $push: { maintenanceSchedules: maintenanceData }
    });
    
    amenityEventEmitter.emit(AMENITY_UPDATED, updated);
    return updated;
  }

  async updateMaintenance(amenityId, maintenanceId, orgId, maintenanceData) {
    const amenity = await this.getAmenityById(amenityId, orgId);
    if (!amenity) throw new HttpError(404, 'Amenity not found');

    const moment = (await import('moment-timezone')).default;
    const TIMEZONE = 'Asia/Kolkata';
    const mStart = moment.tz(`${maintenanceData.startDate}T${maintenanceData.startTime || '00:00'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
    let mEnd = moment.tz(`${maintenanceData.endDate}T${maintenanceData.endTime || '23:59'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
    if (mEnd < mStart) mEnd = moment(mEnd).add(1, 'days').toDate();

    if (amenity.maintenanceSchedules && amenity.maintenanceSchedules.length > 0) {
      for (const maint of amenity.maintenanceSchedules) {
        if (maint._id.toString() === maintenanceId.toString()) continue;
        const existingStart = moment.tz(`${maint.startDate}T${maint.startTime || '00:00'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
        let existingEnd = moment.tz(`${maint.endDate}T${maint.endTime || '23:59'}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
        if (existingEnd < existingStart) existingEnd = moment(existingEnd).add(1, 'days').toDate();
        if (mStart < existingEnd && mEnd > existingStart) {
          throw new HttpError(400, 'A maintenance schedule already exists that overlaps with the requested time.');
        }
      }
    }

    const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;
    const activeBookings = await amenityBookingService.findActiveBookingsByAmenity(amenityId, orgId);
    
    const overlappingBookings = [];
    for (const booking of activeBookings) {
      const bStart = moment.tz(`${booking.bookingDate}T${booking.startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      let bEnd = moment.tz(`${booking.bookingDate}T${booking.endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      if (bEnd < bStart) bEnd = moment(bEnd).add(1, 'days').toDate();
      if (mStart < bEnd && mEnd > bStart) {
        if (!maintenanceData.autoCancelBookings) {
          throw new HttpError(400, `Cannot schedule maintenance. An active booking exists on ${booking.bookingDate} (${booking.startTime} - ${booking.endTime}).`);
        } else {
          overlappingBookings.push(booking);
        }
      }
    }

    if (maintenanceData.autoCancelBookings && overlappingBookings.length > 0) {
      const amenityBookingService = (await import('../amenityBooking/amenityBooking.services.js')).default;
      for (const booking of overlappingBookings) {
         await amenityBookingService.cancelBooking(booking._id, booking.userId, orgId, `Cancelled due to facility maintenance: ${maintenanceData.title}`, true);
      }
    }

    const updated = await amenityRepository.update(amenityId, orgId, {
      $set: { "maintenanceSchedules.$[elem]": { ...maintenanceData, _id: maintenanceId } }
    }, { arrayFilters: [{ "elem._id": maintenanceId }] });
    
    amenityEventEmitter.emit(AMENITY_UPDATED, updated);
    return updated;
  }

  async deleteMaintenance(amenityId, maintenanceId, orgId) {
    const amenity = await this.getAmenityById(amenityId, orgId);
    if (!amenity) throw new HttpError(404, 'Amenity not found');

    const mongoose = (await import('mongoose')).default;
    const matchId = mongoose.Types.ObjectId.isValid(maintenanceId)
      ? new mongoose.Types.ObjectId(maintenanceId)
      : maintenanceId;

    const updated = await amenityRepository.update(amenityId, orgId, {
      $pull: { maintenanceSchedules: { _id: { $in: [matchId, String(maintenanceId)] } } }
    });
    
    amenityEventEmitter.emit(AMENITY_UPDATED, updated);
    return updated;
  }
}

export default new AmenityService();
