import amenityBookingRepository from './amenityBooking.repository.js';
import { amenityBookingEventEmitter, AMENITY_BOOKING_CREATED, AMENITY_BOOKING_CANCELLED, AMENITY_BOOKING_CHECKED_IN, AMENITY_BOOKING_DENIED } from './amenityBooking.events.js';
import HttpError from '../../utils/httpError.utils.js';
import AmenityFacility from '../amenityManagement/facilities/amenityFacility.model.js';

/**
 * Facilities managed by Amenity Management (V2) are booked only through
 * /api/v2/amenity-management, so V2 availability, payments and passes see every booking.
 * Their legacy catalog copies share the same _id.
 */
const assertNotManagedFacility = async (amenityId) => {
  if (await AmenityFacility.exists({ _id: amenityId })) {
    throw new HttpError(410, 'This facility is booked through Amenity Management. Please update the app.');
  }
};
import paymentService from '../payment/payment.service.js';

export class AmenityBookingService {
  async getBookingsQueue(orgId, page = 1, limit = 10, filters = {}) {
    const skip = (page - 1) * limit;
    const { data, totalRecords, summary, amenitySummary } = await amenityBookingRepository.findByOrgPaginated(orgId, filters, skip, limit);
    const totalPages = Math.ceil(totalRecords / limit);
    return {
      data,
      pagination: {
        totalRecords,
        currentPage: page,
        totalPages: totalPages || 1,
        limit,
      },
      summary: summary || {
        totalRevenue: 0,
        todayRevenue: 0,
        totalBookings: 0,
        paidBookings: 0,
        pendingPayments: 0,
        refundedAmount: 0,
        cancelledBookings: 0,
      },
      amenitySummary: amenitySummary || [],
    };
  }

  async getBookingById(bookingId, orgId, session = null) {
    return await amenityBookingRepository.findById(bookingId, orgId, session);
  }

  async findConflicts(orgId, amenityId, date, startTime, endTime, session = null) {
    return await amenityBookingRepository.findConflicts(orgId, amenityId, date, startTime, endTime, session);
  }

  async findByOrgPaginated(orgId, filters = {}, skip = 0, limit = 10) {
    return await amenityBookingRepository.findByOrgPaginated(orgId, filters, skip, limit);
  }

  async findOverlappingBookingsForWindow({ orgId, amenityId, startDateTime, endDateTime }, session = null) {
    return await amenityBookingRepository.findOverlappingBookingsForWindow({ orgId, amenityId, startDateTime, endDateTime }, session);
  }

  async getMyBookings(userId, orgId, filters = {}) {
    return await amenityBookingRepository.findByUser(userId, orgId, filters);
  }

  async findEventsForCalendar(orgId, startDate, endDate, filters = {}) {
    return await amenityBookingRepository.findEventsForCalendar(orgId, startDate, endDate, filters);
  }

  async getAdminCalendar(orgId, startDate, endDate, filters = {}) {
    const dashboardService = (await import('../amenityDashboard/amenityDashboard.service.js')).default;
    return await dashboardService.getCalendarEvents(orgId, startDate, endDate, filters);
  }

  async getAggregatedCalendarBookings(orgId, startDate, endDate) {
    return await amenityBookingRepository.getAggregatedCalendarBookings(orgId, startDate, endDate);
  }

  async getActivePasses(userId, orgId) {
    const activeBookings = await amenityBookingRepository.getActivePasses(userId, orgId);
    
    const moment = (await import('moment-timezone')).default;
    const TIMEZONE = 'Asia/Kolkata';
    const now = moment().tz(TIMEZONE);
    const validPasses = [];
    
    for (const booking of activeBookings) {
      if (booking.bookingDate && booking.endTime) {
        let bookingEnd = moment.tz(`${booking.bookingDate}T${booking.endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE);
        const bookingStart = moment.tz(`${booking.bookingDate}T${booking.startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE);
        
        if (bookingEnd.isBefore(bookingStart)) {
           bookingEnd.add(1, 'days');
        }
        
        if (now.isAfter(bookingEnd)) {
          // Expire it
          await amenityBookingRepository.updateStatus(booking._id, orgId, booking.status, { qrStatus: 'expired' });
          continue; // skip returning it
        }
      }
      validPasses.push(booking);
    }
    
    return validPasses;
  }

  async createBooking(bookingData) {
    const mongoose = (await import('mongoose')).default;
    const isReplicaSet = ['ReplicaSetNoPrimary', 'ReplicaSetWithPrimary', 'Sharded'].includes(
      mongoose.connection.client?.topology?.description?.type
    );
    let session = null;
    let sessionOpt = undefined;
    if (isReplicaSet) {
      session = await mongoose.startSession();
      session.startTransaction();
      sessionOpt = session;
    }

    try {
      let { orgId, amenityId, userId, bookingDate, startTime, endTime } = bookingData;
      await assertNotManagedFacility(amenityId);
      
      // 3. Amenity Validation
      const amenityService = (await import('../amenity/amenity.services.js')).default;
      const amenity = await amenityService.getAmenityById(amenityId, orgId);
      if (!amenity) throw new HttpError(404, 'Amenity not found');
      
      // 4. Amenity Status Validation
      if (amenity.status !== 'active') {
        throw new HttpError(400, `Cannot book this amenity as its status is ${amenity.status}`);
      }

      if (amenity.pricing?.pricingType === 'daily') {
        startTime = amenity.bookingRules?.openTime || '00:00';
        endTime = amenity.bookingRules?.closeTime || '23:59';
        bookingData.startTime = startTime;
        bookingData.endTime = endTime;
      }

      const moment = (await import('moment-timezone')).default;
      const TIMEZONE = 'Asia/Kolkata';

      const bookingDateTimeStart = moment.tz(`${bookingDate}T${startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      let bookingDateTimeEnd = moment.tz(`${bookingDate}T${endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      
      if (bookingDateTimeEnd < bookingDateTimeStart) {
        bookingDateTimeEnd = moment(bookingDateTimeEnd).add(1, 'days').toDate();
      }

      const now = moment().tz(TIMEZONE).toDate();
      const GRACE_PERIOD_MS = 2 * 60 * 1000;

      if (bookingDateTimeStart.getTime() + GRACE_PERIOD_MS < now.getTime()) {
        if (amenity.pricing?.pricingType === 'daily' && bookingDateTimeEnd > now) {
          // Allow booking for today if it's a daily amenity and hasn't closed yet
        } else {
          throw new HttpError(400, 'Cannot book in the past');
        }
      }

      // 5. Maintenance Validation (Authoritative v2 AmenityMaintenanceBlock + Legacy schedules)
      try {
        const { amenityMaintenanceBlockService } = await import(
          '../amenityManagement/maintenance/amenityMaintenanceBlock.service.js'
        );
        const maintenanceBlocks = await amenityMaintenanceBlockService.getOverlappingBlocks({
          orgId: user.orgId || amenity.orgId,
          facilityId: amenity._id,
          startDateTime: bookingDateTimeStart,
          endDateTime: bookingDateTimeEnd,
        });

        const activeBlock = maintenanceBlocks.find((b) => b.isCompleteClosure !== false);
        if (activeBlock) {
          const bufBefore = (activeBlock.bufferBeforeMinutes || 0) * 60000;
          const bufAfter = (activeBlock.bufferAfterMinutes || 0) * 60000;
          const unavailableFrom = new Date(new Date(activeBlock.startDateTime).getTime() - bufBefore).toISOString();
          const unavailableUntil = new Date(new Date(activeBlock.endDateTime).getTime() + bufAfter).toISOString();
          const errorDetails = {
            code: 'AMENITY_UNAVAILABLE',
            reason: 'UNDER_MAINTENANCE',
            unavailableFrom,
            unavailableUntil,
            expectedReopeningAt: unavailableUntil,
            facilityId: String(amenity._id),
            resourceId: activeBlock.resourceId ? String(activeBlock.resourceId) : null,
          };
          const err = new HttpError(
            400,
            `Amenity is under maintenance: ${activeBlock.title || activeBlock.reason}`,
            errorDetails
          );
          err.code = 'AMENITY_UNAVAILABLE';
          err.reason = 'UNDER_MAINTENANCE';
          throw err;
        }
      } catch (err) {
        if (err.code === 'AMENITY_UNAVAILABLE' || err.statusCode === 400) {
          throw err;
        }
      }

      if (amenity.maintenanceSchedules && amenity.maintenanceSchedules.length > 0) {
        for (const maint of amenity.maintenanceSchedules) {
          const maintStart = new Date(`${maint.startDate}T${maint.startTime || '00:00'}`);
          const maintEnd = new Date(`${maint.endDate}T${maint.endTime || '23:59'}`);
          if (bookingDateTimeStart < maintEnd && bookingDateTimeEnd > maintStart) {
            const errorDetails = {
              code: 'AMENITY_UNAVAILABLE',
              reason: 'UNDER_MAINTENANCE',
              unavailableFrom: maintStart.toISOString(),
              unavailableUntil: maintEnd.toISOString(),
              expectedReopeningAt: maintEnd.toISOString(),
              facilityId: String(amenity._id),
              resourceId: null,
            };
            const err = new HttpError(
              400,
              `Amenity is under maintenance: ${maint.description || 'Scheduled Maintenance'}`,
              errorDetails
            );
            err.code = 'AMENITY_UNAVAILABLE';
            err.reason = 'UNDER_MAINTENANCE';
            throw err;
          }
        }
      }

      // 6. Holiday / Weekly Off Validation
      const dayOfWeek = bookingDateTimeStart.getDay();
      if (amenity.bookingRules?.weeklyOffDays?.includes(dayOfWeek)) {
        throw new HttpError(400, 'Amenity is closed on this day of the week');
      }

      // 7. Operating Hours Validation
      if (amenity.pricing?.pricingType !== 'daily') {
        const openTime = amenity.bookingRules?.openTime || '00:00';
        const closeTime = amenity.bookingRules?.closeTime || '23:59';
        const openTimeParsed = moment.tz(`${bookingDate}T${openTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
        let closeTimeParsed = moment.tz(`${bookingDate}T${closeTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
        
        if (closeTimeParsed < openTimeParsed) {
          closeTimeParsed = moment(closeTimeParsed).add(1, 'days').toDate();
        }

        if (bookingDateTimeStart < openTimeParsed || bookingDateTimeEnd > closeTimeParsed) {
          throw new HttpError(400, `Booking must be within operating hours (${openTime} to ${closeTime})`);
        }
      }

      // 12. Booking Window Validation
      const diffTime = Math.abs(bookingDateTimeStart - now);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const advanceBookingDays = amenity.bookingRules?.advanceBookingDays ?? 30;
      if (diffDays > advanceBookingDays) {
        throw new HttpError(400, `Cannot book more than ${advanceBookingDays} days in advance`);
      }

      // 8, 10 & 11. Overlapping Slot, Buffer Time, and Capacity Validation
      const sessionOpt = session?.inTransaction() ? session : undefined;
      const conflicts = await amenityBookingRepository.findConflicts(orgId, amenityId, bookingDate, startTime, endTime, sessionOpt);
      
      // Daily pricing is exclusive per day regardless of capacity
      if (amenity.pricing?.pricingType === 'daily' && conflicts.length > 0) {
        throw new HttpError(409, 'This amenity is already booked for the selected day');
      }
      const currentlyBookedSpots = conflicts.reduce((sum, b) => sum + parseInt(b.numberOfPersons || 1, 10), 0);
      const requestedSpots = parseInt(bookingData.numberOfPersons || 1, 10);
      const remainingCapacity = amenity.capacity - currentlyBookedSpots;
      
      if (requestedSpots > remainingCapacity) {
        if (remainingCapacity <= 0) {
          throw new HttpError(400, 'The amenity is at full capacity for the selected time slot.');
        } else {
          throw new HttpError(400, `The amenity remaining capacity for the selected time slot is ${remainingCapacity}.`);
        }
      }
      
      // Validate if the same user has already booked an overlapping slot (duplicate booking)
      const overlappingOtherSlot = conflicts.find(b => 
        b.userId.toString() === userId.toString() && 
        (b.startTime !== startTime || b.endTime !== endTime)
      );
      if (overlappingOtherSlot) {
        throw new HttpError(400, 'You already have a booking that overlaps with this time slot');
      }

      // Per-user slot limit validation
      const maxLimit = amenity.maxBookingsPerUserPerSlot || amenity.bookingRules?.maxBookingsPerUserPerSlot || 2;
      const userBookingsInSlot = conflicts.filter(b => 
        b.userId.toString() === userId.toString() && 
        b.startTime === startTime && 
        b.endTime === endTime
      );
      
      const exclusiveTypes = ['hall', 'clubhouse', 'Event Space', 'court'];
      const isExclusive = exclusiveTypes.includes(amenity.type) || amenity.pricing?.pricingType === 'daily' || amenity.capacity === requestedSpots;

      const existingUserSpots = isExclusive 
        ? userBookingsInSlot.length 
        : userBookingsInSlot.reduce((sum, b) => sum + parseInt(b.numberOfPersons || 1, 10), 0);
      const newUserSpots = isExclusive ? 1 : requestedSpots;

      if (existingUserSpots + newUserSpots > maxLimit) {
        const errorMsg = isExclusive 
          ? `Booking limit exceeded. You can only make a maximum of ${maxLimit} bookings per slot.`
          : `Slot limit exceeded. You can only book a maximum of ${maxLimit} spots per slot.`;
        throw new HttpError(400, errorMsg);
      }

      // 13. Pricing Calculation
      // The price is always computed server-side; a client-supplied pricingDetails is ignored.
      const pricingDetails = this._calculatePricing(amenity, bookingDateTimeStart, bookingDateTimeEnd, bookingData.numberOfPersons || 1);
      const totalAmount = pricingDetails.totalAmount;
      const deposit = pricingDetails.securityDeposit;

      // 14. Determine status based on payment method
      const finalPaymentMethod = (bookingData.paymentMethod || 'WALLET').toUpperCase();
      const isOnline = finalPaymentMethod === 'ONLINE' && totalAmount > 0;
      const isCash = ['PAY_AT_GATE', 'CASH'].includes(finalPaymentMethod) && totalAmount > 0;
      const isWallet = finalPaymentMethod === 'WALLET' && totalAmount > 0;

      let finalStatus = 'confirmed';
      let finalPaymentStatus = 'success';
      if (isOnline) {
        finalStatus = 'pending';
        finalPaymentStatus = 'pending';
      } else if (isCash) {
        finalStatus = 'confirmed';
        finalPaymentStatus = 'pending';
      } else if (totalAmount === 0) {
        finalStatus = 'confirmed';
        finalPaymentStatus = 'success';
      }

      let walletToUse = null;
      let walletPayerId = userId;

      if (isWallet) {
        const walletService = (await import('../wallet/wallet.service.js')).default;
        walletToUse = await walletService.getWallet(userId, orgId, sessionOpt);

        // If personal wallet does not have enough balance, check household/primary resident wallet
        if (!walletToUse || walletToUse.balance < totalAmount) {
          try {
            const User = (await import('../user/user.model.js')).default;
            const userDoc = await User.findById(userId).session(sessionOpt);
            if (userDoc && userDoc.villaId) {
              const Villa = (await import('../villa/villa.model.js')).default;
              const villaDoc = await Villa.findById(userDoc.villaId).session(sessionOpt);
              if (villaDoc && villaDoc.primaryResidentId && String(villaDoc.primaryResidentId) !== String(userId)) {
                const primaryWallet = await walletService.getWallet(villaDoc.primaryResidentId, orgId, sessionOpt);
                if (primaryWallet && primaryWallet.balance >= totalAmount) {
                  walletToUse = primaryWallet;
                  walletPayerId = villaDoc.primaryResidentId;
                }
              }
            }
          } catch (err) {
            logger.warn('Failed checking primary resident wallet for family amenity booking:', err);
          }
        }

        if (!walletToUse || walletToUse.balance < totalAmount) {
          throw new HttpError(400, `Insufficient wallet balance. Total due is ₹${totalAmount}, but current available balance is ₹${walletToUse ? walletToUse.balance : 0}.`);
        }
      }

      const crypto = (await import('crypto')).default;
      const passToken = crypto.randomBytes(32).toString('hex');
      const passTokenHash = crypto.createHash('sha256').update(passToken).digest('hex');
      const bookingIdStr = bookingData.bookingId || `BKG-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      let qrCodeUrl = null;
      try {
        const QRCode = (await import('qrcode')).default;
        qrCodeUrl = await QRCode.toDataURL(`MMG:AMENITY:${passToken}`);
      } catch (e) {
        logger.warn('Failed to pre-generate QR in createBooking, listener will retry:', e);
      }

      const newBookingData = {
        ...bookingData,
        bookingId: bookingIdStr,
        passToken,
        passTokenHash,
        qrCode: qrCodeUrl,
        qrStatus: 'active',
        qrGeneratedAt: new Date(),
        status: finalStatus,
        paymentStatus: finalPaymentStatus,
        pricingDetails,
        totalPrice: totalAmount,
        deposit,
        paymentMethod: finalPaymentMethod
      };

      const booking = await amenityBookingRepository.create(newBookingData, sessionOpt);

      let updatedWallet = null;
      let walletTxn = null;
      let paymentDoc = null;
      let paymentIntent = null;

      if (isWallet) {
        const walletService = (await import('../wallet/wallet.service.js')).default;
        
        updatedWallet = await walletService.updateBalance(walletPayerId, orgId, -totalAmount, sessionOpt);
        
        const isFamilyMember = String(walletPayerId) !== String(userId);
        walletTxn = await walletService.createTransaction({
          orgId,
          userId: walletPayerId,
          type: 'Debit',
          amount: totalAmount,
          paymentMethod: 'WALLET',
          paymentStatus: 'success',
          referenceType: 'AmenityBooking',
          referenceId: booking._id,
          description: `Payment for Amenity Booking${isFamilyMember ? ' (Booked by family member)' : ''}`
        }, sessionOpt);

        // 1. Create Canonical Payment Record
        const Payment = (await import('../payment/payment.model.js')).default;
        const createdPayments = await Payment.create([{
          orgId,
          userId: walletPayerId,
          payerUserId: walletPayerId,
          domain: 'AMENITY',
          referenceType: 'AmenityBooking',
          referenceId: booking._id,
          amount: totalAmount,
          currency: 'INR',
          paymentCategory: 'ONLINE',
          paymentMethod: 'WALLET',
          status: 'success',
          paidAt: new Date(),
          idempotencyKey: `amenity-wallet-${booking._id.toString()}`,
          description: `Wallet payment for Amenity Booking ${booking.bookingId || booking._id}`,
          metadata: {
            amenityId: booking.amenityId,
            bookingDate: booking.bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            walletTransactionId: walletTxn?._id,
          }
        }], { session: sessionOpt });
        paymentDoc = createdPayments[0];

        // 2. Link paymentId to booking
        booking.paymentId = paymentDoc._id.toString();
        await booking.save({ session: sessionOpt });

        // 3. Post Double-Entry Financial Ledger Entry
        const financialLedgerService = (await import('../ledger/financialLedger.service.js')).default;
        await financialLedgerService.recordWalletDebitEntry({
          userId: walletPayerId,
          orgId,
          amount: totalAmount,
          referenceType: 'AmenityBooking',
          referenceId: booking._id,
          paymentId: paymentDoc._id,
          idempotencyKey: `amenity-wallet-ledger-${booking._id.toString()}`,
          description: `Wallet payment for Amenity Booking ${booking.bookingId || booking._id}`,
          session: sessionOpt,
        });
      } else if (isCash) {
        // Create canonical Payment record for offline / pay-at-gate
        const Payment = (await import('../payment/payment.model.js')).default;
        const createdPayments = await Payment.create([{
          orgId,
          userId,
          payerUserId: userId,
          domain: 'AMENITY',
          referenceType: 'AmenityBooking',
          referenceId: booking._id,
          amount: totalAmount,
          currency: 'INR',
          paymentCategory: 'OFFLINE',
          paymentMethod: 'CASH',
          status: 'pending',
          idempotencyKey: `amenity-cash-init-${booking._id.toString()}`,
          description: `Pay at gate cash payment for Amenity Booking ${booking.bookingId || booking._id}`,
          metadata: {
            amenityId: booking.amenityId,
            bookingDate: booking.bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
          }
        }], { session: sessionOpt });
        paymentDoc = createdPayments[0];
        booking.paymentId = paymentDoc._id.toString();
        await booking.save({ session: sessionOpt });
      } else if (isOnline) {
        try {
          const PaymentContextFactory = (await import('../payment/paymentContext.factory.js')).default;
          const unifiedPaymentService = (await import('../payment/unifiedPayment.service.js')).default;
          const context = PaymentContextFactory.fromAmenityBooking(booking, {
            amount: totalAmount,
            userId,
            orgId,
            paymentMethod: 'ONLINE',
          });
          paymentIntent = await unifiedPaymentService.createPaymentOrder(context, { session: sessionOpt });
          if (paymentIntent?.payment?._id) {
            booking.paymentId = paymentIntent.payment._id.toString();
            await booking.save({ session: sessionOpt });
          }
        } catch (orderErr) {
          logger.warn('Failed auto-creating payment order during online amenity booking:', orderErr.message);
        }
      }

      if (session && session.inTransaction()) {
        await session.commitTransaction();
        session.endSession();
      }

      if (isWallet) {
         const { walletEventEmitter, WALLET_UPDATED, WALLET_TRANSACTION_CREATED } = await import('../wallet/wallet.events.js');
         walletEventEmitter.emit(WALLET_UPDATED, { userId: walletPayerId, orgId, balance: updatedWallet?.balance });
         if (String(walletPayerId) !== String(userId)) {
           walletEventEmitter.emit(WALLET_UPDATED, { userId, orgId, balance: updatedWallet?.balance });
         }
         if (walletTxn) {
           walletEventEmitter.emit(WALLET_TRANSACTION_CREATED, walletTxn);
         }
      }

      amenityBookingEventEmitter.emit(AMENITY_BOOKING_CREATED, booking);
      
      return {
        booking,
        paymentIntent,
        payment: paymentDoc,
      };
    } catch (error) {
      if (session && session.inTransaction()) {
        await session.abortTransaction();
        session.endSession();
      }
      throw error;
    }
  }

  async generateAccessQRCode(bookingOrId, session = null, shouldSave = true) {
    const AmenityBooking = (await import('./amenityBooking.model.js')).default;
    let booking;
    if (bookingOrId && typeof bookingOrId === 'object' && typeof bookingOrId.save === 'function') {
      booking = bookingOrId;
    } else {
      booking = await AmenityBooking.findById(bookingOrId).session(session);
    }
    if (!booking) {
      const HttpError = (await import('../../utils/httpError.utils.js')).default;
      throw new HttpError(404, 'Booking not found');
    }
    const crypto = (await import('crypto')).default;
    const QRCode = (await import('qrcode')).default;
    const bookingIdStr = booking.bookingId || `BKG-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const passToken = booking.passToken || crypto.randomBytes(32).toString('hex');
    const passTokenHash = booking.passTokenHash || crypto.createHash('sha256').update(passToken).digest('hex');
    let qrCodeUrl = booking.qrCode;
    if (!qrCodeUrl) {
      try {
        qrCodeUrl = await QRCode.toDataURL(`MMG:AMENITY:${passToken}`);
      } catch (err) {
        logger.warn('Failed generating QR image in generateAccessQRCode:', err.message);
      }
    }
    booking.passToken = passToken;
    booking.passTokenHash = passTokenHash;
    booking.qrCode = qrCodeUrl;
    booking.bookingId = bookingIdStr;

    if (shouldSave) {
      await booking.save(session ? { session } : undefined);
    }
    return { qrCodeUrl, bookingIdStr, passToken, passTokenHash };
  }

  async settleBookingPayment(bookingId, paymentData, session) {
    const AmenityBooking = (await import('./amenityBooking.model.js')).default;
    const booking = await AmenityBooking.findById(bookingId).session(session);
    if (!booking) {
      const HttpError = (await import('../../utils/httpError.utils.js')).default;
      throw new HttpError(404, 'Booking not found');
    }

    if (booking.paymentStatus === 'success') {
      return booking;
    }

    const { qrCodeUrl, bookingIdStr, passToken, passTokenHash } = await this.generateAccessQRCode(booking, session, false);
    const qrExpiresAt = new Date(`${booking.bookingDate}T${booking.endTime}`);

    // Robust extraction: support both standard paymentData object and raw Razorpay payload
    const paymentEntity = paymentData?.payment?.entity || paymentData?.order?.entity || {};
    const gatewayTransactionId = paymentData.gatewayTransactionId || paymentEntity.id || paymentData.id || 'unknown_txn';
    const paymentMethod = paymentData.paymentMethod || paymentEntity.method || paymentData.method || 'RAZORPAY';
    const paymentId = paymentData.paymentId || (paymentData._id ? String(paymentData._id) : null);

    booking.paymentStatus = 'success';
    booking.status = 'confirmed';
    
    booking.razorpayTransactionId = gatewayTransactionId;
    booking.paymentMethod = paymentMethod;
    if (paymentId) {
      booking.paymentId = String(paymentId);
    }
    booking.passToken = passToken;
    booking.passTokenHash = passTokenHash;
    booking.qrCode = qrCodeUrl;
    booking.qrStatus = 'active';
    booking.qrGeneratedAt = booking.qrGeneratedAt || new Date();
    booking.qrExpiresAt = qrExpiresAt;
    if (!booking.bookingId) {
      booking.bookingId = bookingIdStr;
    }

    await booking.save({ session });
    return booking;
  }

  _calculatePricing(amenity, startDateTime, endDateTime, numberOfPersons = 1) {
    if (!amenity) {
      return { baseAmount: 0, taxAmount: 0, discountAmount: 0, securityDeposit: 0, totalAmount: 0, refundAmount: 0, cancellationCharge: 0 };
    }

    const pConfig = amenity.pricingConfig || amenity.pricing || {};
    const pricingType = (pConfig.pricingType || (amenity.pricing?.pricingType === 'daily' ? 'DAILY' : 'HOURLY')).toUpperCase();
    const isDaily = pricingType === 'DAILY' || pricingType === 'DAILY_PRICING';
    const durationHours = Math.max(1 / 60, (endDateTime - startDateTime) / (1000 * 60 * 60));
    const durationDays = Math.max(1, Math.ceil(durationHours / 24));

    const baseRate = Number(pConfig.baseRate !== undefined ? pConfig.baseRate : amenity.ratePerHour) || 0;
    
    const dayOfWeek = startDateTime.getDay();
    let multiplier = 1.0;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      multiplier = Number(pConfig.weekendRateMultiplier) || 1.0;
    }
    
    const personMultiplier = isDaily ? 1 : (Number(numberOfPersons) || 1);
    let baseAmount = 0;
    if (pricingType === 'FREE') {
      baseAmount = 0;
    } else if (pricingType === 'DAILY') {
      baseAmount = Math.round(durationDays * baseRate * multiplier * 100) / 100;
    } else if (pricingType === 'FIXED_EVENT') {
      baseAmount = Math.round(baseRate * multiplier * 100) / 100;
    } else {
      // HOURLY / default
      baseAmount = Math.round(durationHours * baseRate * multiplier * personMultiplier * 100) / 100;
    }

    const taxPercentage = Number(pConfig.taxPercentage) || 0;
    const taxAmount = Math.round(((baseAmount * taxPercentage) / 100) * 100) / 100;
    const securityDeposit = pricingType === 'FREE' ? 0 : (Number(pConfig.securityDeposit) || 0);
    const totalAmount = pricingType === 'FREE' ? 0 : Math.round((baseAmount + taxAmount + securityDeposit) * 100) / 100;

    return {
      baseAmount,
      taxAmount,
      discountAmount: 0,
      securityDeposit,
      totalAmount,
      refundAmount: 0,
      cancellationCharge: 0
    };
  }

  async createManualBooking(bookingData) {
    const mongoose = (await import('mongoose')).default;
    const isReplicaSet = ['ReplicaSetNoPrimary', 'ReplicaSetWithPrimary', 'Sharded'].includes(
      mongoose.connection.client?.topology?.description?.type
    );
    let session = null;
    let sessionOpt = undefined;
    if (isReplicaSet) {
      session = await mongoose.startSession();
      session.startTransaction();
      sessionOpt = session;
    }

    try {
      let { orgId, amenityId, userId, residentId, villaNumber, bookingDate, startTime, endTime, paymentStatus = 'success' } = bookingData;
      await assertNotManagedFacility(amenityId);
      
      let effectiveUserId = userId || residentId;
      const userService = (await import('../user/user.services.js')).default;
      let user = null;
      
      if (effectiveUserId) {
        user = await userService.getUserById(effectiveUserId, sessionOpt);
      } else if (villaNumber) {
        // If residentId is missing but we have villaNumber, find user by villaNumber
        user = await userService.getUserByVillaNumber(villaNumber, orgId, sessionOpt);
      }

      if (!user || user.orgId.toString() !== orgId.toString()) {
        throw new HttpError(400, 'Resident not found in this organization for the given villa or ID.');
      }
      
      bookingData.userId = user._id;
      
      const amenityService = (await import('../amenity/amenity.services.js')).default;
      const amenity = await amenityService.getAmenityById(amenityId, orgId, sessionOpt);
      if (!amenity) throw new HttpError(404, 'Amenity not found');
      
      if (amenity.pricing?.pricingType === 'daily') {
        startTime = amenity.bookingRules?.openTime || '00:00';
        endTime = amenity.bookingRules?.closeTime || '23:59';
        bookingData.startTime = startTime;
        bookingData.endTime = endTime;
      }

      const moment = (await import('moment-timezone')).default;
      const TIMEZONE = 'Asia/Kolkata';

      const bookingDateTimeStart = moment.tz(`${bookingDate}T${startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      let bookingDateTimeEnd = moment.tz(`${bookingDate}T${endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      
      if (bookingDateTimeEnd < bookingDateTimeStart) {
        bookingDateTimeEnd = moment(bookingDateTimeEnd).add(1, 'days').toDate();
      }
      
      const now = moment().tz(TIMEZONE).toDate();
      if (bookingDateTimeStart < now) {
        if (amenity.pricing?.pricingType === 'daily' && bookingDateTimeEnd > now) {
          // Allow booking for today if it's a daily amenity and hasn't closed yet
        } else {
          throw new HttpError(400, 'Cannot book in the past');
        }
      }
      
      // Amenity availability check
      const conflicts = await amenityBookingRepository.findConflicts(orgId, amenityId, bookingDate, startTime, endTime, sessionOpt);
      
      // Daily pricing is exclusive per day regardless of capacity
      if (amenity.pricing?.pricingType === 'daily' && conflicts.length > 0) {
        throw new HttpError(409, 'This amenity is already booked for the selected day');
      }
      const currentlyBookedSpots = conflicts.reduce((sum, b) => sum + (b.numberOfPersons || 1), 0);
      const requestedSpots = parseInt(bookingData.numberOfPersons || 1, 10);
      const remainingCapacity = amenity.capacity - currentlyBookedSpots;
      
      if (requestedSpots > remainingCapacity) {
        if (remainingCapacity <= 0) {
          throw new HttpError(400, 'The amenity is at full capacity for the selected time slot.');
        } else {
          throw new HttpError(400, `The amenity remaining capacity for the selected time slot is ${remainingCapacity}.`);
        }
      }
      
      const pricingDetails = this._calculatePricing(amenity, bookingDateTimeStart, bookingDateTimeEnd, bookingData.numberOfPersons || 1);
      
      const newBookingData = {
        ...bookingData,
        status: 'confirmed',
        paymentStatus: paymentStatus,
        pricingDetails,
        totalPrice: pricingDetails.totalAmount,
        deposit: pricingDetails.securityDeposit,
        isManual: true,
        amenityName: amenity.name
      };

      const booking = await amenityBookingRepository.create(newBookingData, sessionOpt);
      
      if (session && session.inTransaction()) {
        await session.commitTransaction();
        session.endSession();
      }
      
      // Generate QR automatically since it's confirmed
      amenityBookingEventEmitter.emit(AMENITY_BOOKING_CREATED, booking);
      
      return booking;
    } catch (error) {
      if (session && session.inTransaction()) {
        await session.abortTransaction();
        session.endSession();
      }
      throw error;
    }
  }


  /**
   * Credits a cancellation refund to the unified digital wallet via the canonical wallet credit path, which
   * atomically updates the balance, records the WalletTransaction and posts the double-entry ledger entry.
   * The deterministic idempotency key guarantees a booking can never be refunded to the wallet twice.
   */
  async _refundToWallet({ targetUserId, orgId, refundAmount, refundPercentage, booking, paymentMethod = 'WALLET' }) {
    const walletService = (await import('../wallet/wallet.service.js')).default;
    return walletService.creditWallet({
      userId: targetUserId,
      orgId,
      amount: refundAmount,
      referenceType: 'Refund',
      referenceId: booking._id,
      idempotencyKey: `AMENITY-REFUND-${booking._id.toString()}`,
      paymentMethod,
      description: `Refund for Cancelled Amenity Booking (${refundPercentage}% refund)`,
    });
  }

  async cancelBooking(bookingId, userId, orgId, reason = '', isAdmin = false, options = {}) {
    const mongoose = (await import('mongoose')).default;
    // Removed transaction to support standalone local MongoDB
    
    try {
      const booking = await amenityBookingRepository.findById(bookingId, orgId);
      if (!booking) throw new HttpError(404, 'Booking not found');
      
      const bookingUserId = booking.userId ? (booking.userId._id ? booking.userId._id.toString() : booking.userId.toString()) : '';
      const currentUserId = userId ? userId.toString() : '';

      if (bookingUserId && currentUserId && bookingUserId !== currentUserId && !isAdmin) {
        throw new HttpError(403, 'Only the resident who booked this slot can cancel this reservation.');
      }
      
      if (['rejected', 'cancelled', 'checked-in', 'completed'].includes(booking.status)) {
        throw new HttpError(400, 'Booking cannot be cancelled in its current state');
      }

      // 1. Load the Amenity bookingRules
      const amenityService = (await import('../amenity/amenity.services.js')).default;
      const amenity = await amenityService.getAmenityById(booking.amenityId, orgId);
      
      let rawBookingAmount = Number(
        booking.pricingDetails?.totalAmount !== undefined
          ? booking.pricingDetails.totalAmount
          : booking.pricingDetails?.baseAmount !== undefined
          ? booking.pricingDetails.baseAmount
          : booking.totalPrice !== undefined
          ? booking.totalPrice
          : booking.amount
      ) || 0;

      const isPaidStatus = ['success', 'paid', 'captured', 'completed'].includes(String(booking.paymentStatus || '').toLowerCase());

      if (rawBookingAmount <= 0 && isPaidStatus) {
        try {
          const Payment = (await import('../payment/payment.model.js')).default;
          let paymentDoc = null;
          if (booking.paymentId) {
            paymentDoc = await Payment.findById(booking.paymentId);
          }
          if (!paymentDoc) {
            paymentDoc = await Payment.findOne({
              domain: 'AMENITY',
              referenceId: booking._id,
              status: 'success',
            });
          }
          if (paymentDoc && Number(paymentDoc.amount) > 0) {
            rawBookingAmount = Number(paymentDoc.amount);
          }
        } catch (pErr) {
          logger.warn('Failed finding Payment record during cancelBooking:', pErr);
        }

        if (rawBookingAmount <= 0 && amenity) {
          try {
            const moment = (await import('moment-timezone')).default;
            const TIMEZONE = 'Asia/Kolkata';
            const bStart = moment.tz(`${booking.bookingDate}T${booking.startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
            let bEnd = moment.tz(`${booking.bookingDate}T${booking.endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
            if (bEnd < bStart) bEnd = moment(bEnd).add(1, 'days').toDate();
            const calcPricing = this._calculatePricing(amenity, bStart, bEnd, booking.numberOfPersons || 1);
            if (calcPricing.totalAmount > 0) {
              rawBookingAmount = calcPricing.totalAmount;
            }
          } catch (cErr) {
            logger.warn('Failed recalculating pricing snapshot during cancelBooking:', cErr);
          }
        }
      }

      let refundPercentage = 100; // default to full refund if no rules
      let refundAmount = rawBookingAmount;

      // 2. Read cancellationRefundRules or administrative refund override
      const rawOverride = typeof options === 'number'
        ? options
        : (options && typeof options.refundOverridePercentage === 'number' ? options.refundOverridePercentage : null);
      const refundOverride = (rawOverride !== null && Number.isFinite(rawOverride)) ? rawOverride : null;

      if (refundOverride !== null && isAdmin) {
        refundPercentage = Math.max(0, Math.min(100, refundOverride));
        refundAmount = (refundAmount * refundPercentage) / 100;
      } else if (amenity?.bookingRules?.isCancellationEnabled && amenity.bookingRules.cancellationRefundRules?.length > 0) {
        const rules = [...amenity.bookingRules.cancellationRefundRules].sort((a, b) => b.cancelBeforeHours - a.cancelBeforeHours);
        
        const moment = (await import('moment-timezone')).default;
        const TIMEZONE = 'Asia/Kolkata';
        
        const bookingStartDateTime = moment.tz(`${booking.bookingDate}T${booking.startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE);
        const now = moment().tz(TIMEZONE);
        const remainingHours = moment.duration(bookingStartDateTime.diff(now)).asHours();

        // Find the applicable rule
        const applicableRule = rules.find(rule => remainingHours >= rule.cancelBeforeHours);
        
        if (applicableRule) {
          refundPercentage = applicableRule.refundPercentage;
        } else {
          // If remaining hours is less than the smallest rule, refund is 0%
          refundPercentage = 0;
        }
        
        refundAmount = (refundAmount * refundPercentage) / 100;
      }

      // 3. Process Refund logic if payment was success
      let newPaymentStatus = booking.paymentStatus;
      if (isPaidStatus) {
        const isWallet = booking.paymentMethod && booking.paymentMethod.toUpperCase() === 'WALLET';
        const targetUserId = booking.userId?._id || booking.userId;

        if (isWallet && refundAmount > 0) {
          try {
            await this._refundToWallet({ targetUserId, orgId, refundAmount, refundPercentage, booking });
            newPaymentStatus = refundPercentage === 100 ? 'refunded' : 'partial_refund';
          } catch (walletErr) {
            logger.error(`[CANCEL BOOKING] Wallet refund failed for booking ${bookingId}`, { error: walletErr.message });
            // Refund is still owed — surface it instead of leaving the booking marked as paid
            newPaymentStatus = 'refund_pending';
          }
        } else if (booking.paymentId && refundAmount > 0) {
          const paymentService = (await import('../payment/payment.service.js')).default;
          try {
            const isValidObjectId = mongoose.Types.ObjectId.isValid(booking.paymentId);
            if (!isValidObjectId) {
              console.warn(`[CANCEL BOOKING] Warning: booking.paymentId '${booking.paymentId}' is not a valid ObjectId. Refund may fail.`);
            }
            await paymentService.processRefund(booking.paymentId, refundAmount);
            newPaymentStatus = refundPercentage === 100 ? 'refunded' : 'partial_refund';
          } catch (refundError) {
             console.error(`[CANCEL BOOKING] Refund failed for booking ${bookingId}, crediting to digital wallet:`, refundError.message);
             try {
               await this._refundToWallet({ targetUserId, orgId, refundAmount, refundPercentage, booking, paymentMethod: booking.paymentMethod || 'ONLINE' });
               newPaymentStatus = refundPercentage === 100 ? 'refunded' : 'partial_refund';
             } catch (fallbackErr) {
               console.error(`[CANCEL BOOKING] Fallback wallet refund failed:`, fallbackErr.message);
               newPaymentStatus = 'failed';
             }
          }
        } else if (refundAmount > 0) {
          // ONLINE or other digital payment method without direct gateway ID: Credit to resident's digital wallet
          try {
            await this._refundToWallet({ targetUserId, orgId, refundAmount, refundPercentage, booking, paymentMethod: booking.paymentMethod || 'ONLINE' });
            newPaymentStatus = refundPercentage === 100 ? 'refunded' : 'partial_refund';
          } catch (walletErr) {
            logger.error(`[CANCEL BOOKING] Digital wallet refund credit failed for booking ${bookingId}`, { error: walletErr.message });
            newPaymentStatus = 'refund_pending';
          }
        }
      } else if (['pending', 'payment_due'].includes(String(booking.paymentStatus || '').toLowerCase())) {
         newPaymentStatus = 'failed';
         refundAmount = 0;
         refundPercentage = 0;
      }

      // 4. Update the AmenityBooking status
      const cancelUpdateData = {
        status: 'cancelled',
        paymentStatus: newPaymentStatus,
        qrStatus: 'expired',
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledBy: userId,
        refundPercentage,
        refundAmount
      };

      const updated = await amenityBookingRepository.updateStatus(bookingId, orgId, 'cancelled', cancelUpdateData);

      amenityBookingEventEmitter.emit(AMENITY_BOOKING_CANCELLED, updated);
      
      return updated;
    } catch (error) {
      throw error;
    }
  }

  async rescheduleBooking(bookingId, orgId, { bookingDate, startTime, endTime, rescheduledBy, reason = '' }, session = null) {
    const booking = await amenityBookingRepository.findById(bookingId, orgId, session);
    if (!booking) {
      const HttpError = (await import('../../utils/httpError.utils.js')).default;
      throw new HttpError(404, 'Booking not found');
    }

    if (['rejected', 'cancelled', 'completed'].includes(booking.status)) {
      const HttpError = (await import('../../utils/httpError.utils.js')).default;
      throw new HttpError(400, `Booking cannot be rescheduled in its current state: ${booking.status}`);
    }

    const amenityId = booking.amenityId?._id || booking.amenityId;
    const conflicts = await amenityBookingRepository.findConflicts(orgId, amenityId, bookingDate, startTime, endTime, session);
    const otherConflicts = conflicts.filter((c) => c._id.toString() !== booking._id.toString());
    if (otherConflicts.length > 0) {
      const HttpError = (await import('../../utils/httpError.utils.js')).default;
      throw new HttpError(409, 'The proposed alternative slot conflicts with an existing booking');
    }

    const moment = (await import('moment-timezone')).default;
    const TIMEZONE = 'Asia/Kolkata';
    const newStart = moment.tz(`${bookingDate}T${startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
    let newEnd = moment.tz(`${bookingDate}T${endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
    if (newEnd < newStart) {
      newEnd = moment(newEnd).add(1, 'days').toDate();
    }

    const updateData = {
      bookingDate,
      startTime,
      endTime,
      qrExpiresAt: newEnd,
      rescheduledAt: new Date(),
      rescheduledBy: rescheduledBy || null,
      rescheduleReason: reason,
    };

    const updated = await amenityBookingRepository.updateStatus(bookingId, orgId, booking.status, updateData, session);
    return updated;
  }


  async cancelBookingAndRefund(bookingId, userId) {
    const mongoose = (await import('mongoose')).default;
    let session = await mongoose.startSession();
    
    let bookingToRefund = null;
    let refundAmountPaise = 0;
    let refundPercentage = 100;
    let newPaymentStatus = 'pending';

    try {
      // --- TRANSACTION 1: Lock the Booking & Calculate Refund ---
      session.startTransaction();
      
      const booking = await amenityBookingRepository.findById(bookingId).session(session);
      if (!booking) throw new HttpError(404, 'Booking not found');
      
      if (booking.userId.toString() !== userId.toString()) {
        throw new HttpError(403, 'Unauthorized: You can only cancel your own bookings.');
      }
      
      if (['rejected', 'cancelled', 'completed'].includes(booking.status)) {
        throw new HttpError(400, 'Booking cannot be cancelled in its current state.');
      }

      const amenityService = (await import('../amenity/amenity.services.js')).default;
      const amenity = await amenityService.getAmenityById(booking.amenityId, booking.orgId, session);
      
      // FIX GAP 2: Convert base amount to smallest integer unit (paise) FIRST
      const totalAmountRupees = booking.pricingDetails?.totalAmount || booking.totalPrice || 0;
      const totalAmountPaise = Math.round(totalAmountRupees * 100);

      if (amenity?.bookingRules?.isCancellationEnabled && amenity.bookingRules.cancellationRefundRules?.length > 0) {
        const rules = [...amenity.bookingRules.cancellationRefundRules].sort((a, b) => b.cancelBeforeHours - a.cancelBeforeHours);
        const moment = (await import('moment-timezone')).default;
        const TIMEZONE = 'Asia/Kolkata';
        const bookingStartDateTime = moment.tz(`${booking.bookingDate}T${booking.startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE);
        const remainingHours = moment.duration(bookingStartDateTime.diff(moment().tz(TIMEZONE))).asHours();

        const applicableRule = rules.find(rule => remainingHours >= rule.cancelBeforeHours);
        refundPercentage = applicableRule ? applicableRule.refundPercentage : 0;
      }
      
      // Integer multiplication and division prevents microscopic floating-point errors
      refundAmountPaise = Math.floor((totalAmountPaise * refundPercentage) / 100);
      const refundAmountRupees = refundAmountPaise / 100;

      newPaymentStatus = booking.paymentStatus;
      let requiresRazorpayCall = false;

      if (booking.paymentStatus === 'captured' || booking.paymentStatus === 'success') {
        const isWallet = booking.paymentMethod && booking.paymentMethod.toUpperCase() === 'WALLET';
        if (isWallet && refundAmountRupees > 0) {
          const walletService = (await import('../wallet/wallet.service.js')).default;
          await walletService.updateBalance(userId, booking.orgId, refundAmountRupees);
          await walletService.createTransaction({
            orgId: booking.orgId,
            userId,
            type: 'Credit',
            amount: refundAmountRupees,
            paymentMethod: 'WALLET',
            paymentStatus: 'success',
            referenceType: 'AmenityBooking',
            referenceId: booking._id,
            description: `Refund for Cancelled Amenity Booking (${refundPercentage}% refund)`
          });
          const { walletEventEmitter, WALLET_UPDATED } = await import('../wallet/wallet.events.js');
          walletEventEmitter.emit(WALLET_UPDATED, { userId, orgId: booking.orgId });
          newPaymentStatus = refundPercentage === 100 ? 'refunded' : 'partial_refund';
        } else if (refundAmountPaise > 0 && booking.razorpayTransactionId) {
          requiresRazorpayCall = true;
          newPaymentStatus = 'refund_pending'; // Mark as pending while we hit the network
        } else if (refundAmountPaise === 0) {
           newPaymentStatus = 'success'; // No refund due
        }
      }

      const cancelUpdateData = {
        status: 'cancelled',
        paymentStatus: newPaymentStatus,
        qrStatus: 'expired',
        cancellationReason: 'Resident self-cancellation',
        cancelledAt: new Date(),
        cancelledBy: userId,
        refundPercentage,
        refundAmount: refundAmountRupees
      };

      bookingToRefund = await amenityBookingRepository.updateStatus(bookingId, booking.orgId, 'cancelled', cancelUpdateData, session);
      
      await session.commitTransaction();
      session.endSession();

      // --- TRANSACTION 1 END ---

      // FIX GAP 1: Network Call Outside the Database Transaction
      if (requiresRazorpayCall) {
        try {
          const Razorpay = (await import('razorpay')).default;
          const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
          });

          // Execute external API call without holding any DB locks
          await razorpay.payments.refund(bookingToRefund.razorpayTransactionId, {
            amount: refundAmountPaise,
            notes: {
              reason: 'Resident initiated cancellation',
              bookingId: bookingId.toString()
            }
          });

          // --- TRANSACTION 2: Mark as Success ---
          session = await mongoose.startSession();
          session.startTransaction();
          bookingToRefund.paymentStatus = refundPercentage === 100 ? 'refunded' : 'partial_refund';
          await bookingToRefund.save({ session });
          await session.commitTransaction();
          session.endSession();

        } catch (networkError) {
          // --- TRANSACTION 2 (Fallback): Mark as Failed ---
          console.error('Razorpay Refund Network Failure:', networkError);
          session = await mongoose.startSession();
          session.startTransaction();
          bookingToRefund.paymentStatus = 'refund_failed';
          await bookingToRefund.save({ session });
          await session.commitTransaction();
          session.endSession();
          
          throw new HttpError(502, 'Payment gateway error during refund. Please contact support.');
        }
      }

      amenityBookingEventEmitter.emit(AMENITY_BOOKING_CANCELLED, bookingToRefund);
      return bookingToRefund;
      
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      throw error;
    }
  }

  async hasPendingOrApprovedFutureBookings(amenityId, orgId) {
    const active = await amenityBookingRepository.findActiveBookingsByAmenity(amenityId, orgId);
    return active.length > 0;
  }

  async findActiveBookingsByAmenity(amenityId, orgId) {
    return await amenityBookingRepository.findActiveBookingsByAmenity(amenityId, orgId);
  }

  async getBookingById(bookingId, orgId) { return await amenityBookingRepository.findById(bookingId, orgId); }
  async getKpiStats(orgId) { return await amenityBookingRepository.getKpiStats(orgId); }
  async getRevenueStats(orgId) { return await amenityBookingRepository.getRevenueStats(orgId); }
  async getOccupancyStats(orgId) { return await amenityBookingRepository.getOccupancyStats(orgId); }
  async getTrendsStats(orgId) { return await amenityBookingRepository.getTrendsStats(orgId); }
  async getRecentActivity(orgId) { return await amenityBookingRepository.getRecentActivity(orgId); }

  /**
   * Consolidated dashboard aggregation.
   * Calls: own repository for booking metrics, amenityService for amenity counts, Payment model for payment stats.
   * Returns a single DTO with all dashboard data.
   */
  async getDashboardData(orgId, scopedFacilityId = null, scopedFacilityName = null) {
    // 1. Get all booking metrics in one $facet pipeline
    const bookingAgg = await amenityBookingRepository.getDashboardAggregation(orgId);

    // 2. Get amenity counts by status (cross-feature service call)
    const amenityService = (await import('../amenity/amenity.services.js')).default;
    let allAmenities = await amenityService.getAllAmenities(orgId);
    if (scopedFacilityName) {
      const filtered = allAmenities.filter(a => a.name.toLowerCase() === scopedFacilityName.toLowerCase());
      if (filtered.length > 0) {
        allAmenities = filtered;
      }
    } else if (scopedFacilityId) {
      const filtered = allAmenities.filter(a => a._id.toString() === scopedFacilityId.toString());
      if (filtered.length > 0) {
        allAmenities = filtered;
      }
    }
    
    const amenityKpis = {
      totalAmenities: allAmenities.length,
      activeAmenities: allAmenities.filter(a => a.status === 'active').length,
      inactiveAmenities: allAmenities.filter(a => a.status === 'inactive').length,
      underMaintenance: allAmenities.filter(a => a.status === 'maintenance').length,
    };

    // 3. Maintenance summary from amenity data
    const maintenanceSummary = [];
    for (const amenity of allAmenities) {
      if (amenity.maintenanceSchedules && amenity.maintenanceSchedules.length > 0) {
        for (const maint of amenity.maintenanceSchedules) {
          if (['scheduled', 'in_progress'].includes(maint.status)) {
            maintenanceSummary.push({
              amenityName: amenity.name,
              title: maint.title,
              description: maint.description,
              startDate: maint.startDate,
              endDate: maint.endDate,
              status: maint.status
            });
          }
        }
      }
    }

    // 4. Payment stats from Payment model (single aggregation)
    const Payment = (await import('../payment/payment.model.js')).default;
    const mongoose = (await import('mongoose')).default;
    const paymentAgg = await Payment.aggregate([
      { $match: { orgId: new mongoose.Types.ObjectId(orgId) } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        total: { $sum: '$amount' }
      }}
    ]);

    const paymentStats = { pending: 0, success: 0, failed: 0, refunded: 0 };
    const paymentAmounts = { pending: 0, success: 0, failed: 0, refunded: 0 };
    for (const p of paymentAgg) {
      if (paymentStats.hasOwnProperty(p._id)) {
        paymentStats[p._id] = p.count;
        paymentAmounts[p._id] = p.total;
      }
    }

    // 5. Flatten booking status counts
    const statusMap = {};
    for (const s of (bookingAgg.statusCounts || [])) {
      statusMap[s._id] = s.count;
    }

    const todayData = bookingAgg.todayStats?.[0] || { totalBookings: 0, revenue: 0, checkIns: 0, checkOuts: 0, confirmed: 0, pending: 0 };

    // 6. Calculate total capacity and occupancy
    const totalCapacity = allAmenities.reduce((sum, a) => sum + (a.status === 'active' ? (a.capacity || 0) : 0), 0);
    const occupancyPercentage = totalCapacity > 0 ? Math.round((todayData.totalBookings / totalCapacity) * 100) : 0;

    // 7. Build the consolidated response
    return {
      amenityKpis,

      bookingKpis: {
        totalBookings: Object.values(statusMap).reduce((s, v) => s + v, 0),
        todayBookings: todayData.totalBookings,
        upcomingBookings: bookingAgg.upcomingCount?.[0]?.count || 0,
        completedBookings: statusMap['completed'] || 0,
        cancelledBookings: statusMap['cancelled'] || 0,
        pendingBookings: statusMap['pending'] || 0,
        confirmedBookings: statusMap['confirmed'] || 0,
        checkedInBookings: statusMap['checked-in'] || 0,
        approvedBookings: statusMap['approved'] || 0,
        rejectedBookings: statusMap['rejected'] || 0,
      },

      revenue: {
        dailyRevenue: bookingAgg.dailyRevenue?.[0]?.total || 0,
        weeklyRevenue: bookingAgg.weeklyRevenue?.[0]?.total || 0,
        monthlyRevenue: bookingAgg.monthlyRevenue?.[0]?.total || 0,
      },

      occupancy: {
        occupancyPercentage,
        capacityUtilization: totalCapacity,
        todayCheckIns: todayData.checkIns,
        todayCheckOuts: todayData.checkOuts,
      },

      paymentStats,
      paymentAmounts,

      charts: {
        revenueTrend: (bookingAgg.revenueTrend || []).reverse(),
        bookingTrend: (bookingAgg.bookingTrend || []).reverse(),
        bookingStatusDist: bookingAgg.statusCounts || [],
        paymentStatusDist: bookingAgg.paymentStatusDist || [],
        peakHours: bookingAgg.peakHours || [],
        amenityUsage: bookingAgg.amenityUsage || [],
        monthlyComparison: {
          current: bookingAgg.currentMonthBookings?.[0] || { count: 0, revenue: 0 },
          previous: bookingAgg.previousMonthBookings?.[0] || { count: 0, revenue: 0 },
        },
      },

      maintenanceSummary,

      recentActivity: bookingAgg.recentActivity || [],
    };
  }

  async checkInBooking(bookingId, orgId, userId) {
    const { amenityAccessPassService } = await import('../amenityManagement/passes/amenityAccessPass.service.js');
    return await amenityAccessPassService.validateAndRecordCheckIn({
      orgId,
      rawToken: bookingId,
      guardId: userId,
    });
  }

  async getCalendarIndicators(orgId, year, month) {
    return await amenityBookingRepository.getMonthlyIndicators(orgId, year, month);
  }

  async getRecentScans(orgId) {
    const moment = (await import('moment-timezone')).default;
    const TIMEZONE = 'Asia/Kolkata';
    const startOfDay = moment().tz(TIMEZONE).startOf('day').toDate();
    
    const scans = await amenityBookingRepository.getRecentScans(orgId, startOfDay);

    return scans.map(scan => {
      // Determine if it was entry or exit that was most recent
      // Or just return the record and let frontend decide based on status
      const scanType = scan.status === 'completed' ? 'Exit' : 'Entry';
      const scanTime = scan.status === 'completed' ? scan.checkOutTime : scan.checkInTime;

      return {
        _id: scan._id,
        bookingId: scan.bookingId || scan._id,
        residentName: scan.userId?.name || 'Unknown',
        residentPhoto: scan.userId?.profilePicture,
        amenityName: scan.amenityId?.name || 'Unknown',
        scanType: scanType,
        entryTime: scan.checkInTime,
        exitTime: scan.checkOutTime,
        scanTime: scanTime,
        result: 'Success',
        guardName: scan.checkedInBy?.name || 'Security'
      };
    }).sort((a, b) => b.scanTime - a.scanTime);
  }

  async recordCashPayment(bookingId, amount, collectedBy, options = {}) {
    const mongoose = (await import('mongoose')).default;
    const HttpError = (await import('../../utils/httpError.utils.js')).default;
    const isReplicaSet = ['ReplicaSetNoPrimary', 'ReplicaSetWithPrimary', 'Sharded'].includes(
      mongoose.connection.client?.topology?.description?.type
    );
    let session = null;
    let sessionOpt = undefined;
    if (isReplicaSet) {
      session = await mongoose.startSession();
      session.startTransaction();
      sessionOpt = session;
    }

    try {
      const AmenityBooking = (await import('./amenityBooking.model.js')).default;
      const booking = await AmenityBooking.findById(bookingId).session(sessionOpt);
      if (!booking) {
        throw new HttpError(404, 'Booking not found');
      }

      const orgId = booking.orgId;
      if (options.orgId && String(options.orgId) !== String(orgId)) {
        throw new HttpError(403, 'Cross-tenant cash payment forbidden');
      }

      if (booking.paymentStatus === 'success') {
        throw new HttpError(400, 'Booking has already been paid');
      }

      const totalExpected = Number(
        booking.pricingDetails?.totalAmount !== undefined
          ? booking.pricingDetails.totalAmount
          : booking.pricing?.totalPrice !== undefined
          ? booking.pricing.totalPrice
          : booking.totalPrice || booking.amount
      ) || 0;

      const numericAmount = Number(amount !== undefined ? amount : totalExpected);
      if (Math.abs(numericAmount - totalExpected) > 0.01) {
        throw new HttpError(400, `Cash amount (₹${numericAmount}) does not match booking total of ₹${totalExpected}`);
      }

      const receiptNumber = options.receiptNumber || `RCP-AMN-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

      // Update or create canonical Payment record
      const Payment = (await import('../payment/payment.model.js')).default;
      let payment = null;
      if (booking.paymentId) {
        payment = await Payment.findById(booking.paymentId).session(sessionOpt);
      }
      if (!payment) {
        payment = await Payment.findOne({
          domain: 'AMENITY',
          referenceId: booking._id,
          orgId,
        }).session(sessionOpt);
      }

      if (payment) {
        payment.status = 'success';
        payment.paymentMethod = 'CASH';
        payment.paymentCategory = 'OFFLINE';
        payment.paidAt = new Date();
        payment.amount = numericAmount;
        payment.receiptNumber = receiptNumber;
        payment.collectedBy = collectedBy || null;
        payment.offlinePaymentDetails = {
          collectedBy,
          receiptNumber,
          notes: options.notes || 'Counter cash collection',
        };
        await payment.save({ session: sessionOpt });
      } else {
        const createdPayments = await Payment.create([{
          orgId,
          userId: booking.userId,
          payerUserId: booking.userId,
          domain: 'AMENITY',
          referenceType: 'AmenityBooking',
          referenceId: booking._id,
          amount: numericAmount,
          currency: 'INR',
          paymentCategory: 'OFFLINE',
          paymentMethod: 'CASH',
          status: 'success',
          paidAt: new Date(),
          receiptNumber,
          idempotencyKey: `cash-amn-${booking._id.toString()}-${Date.now()}`,
          description: `Cash collection for Amenity Booking ${booking.bookingId || booking._id}`,
          offlinePaymentDetails: {
            collectedBy,
            receiptNumber,
            notes: options.notes || 'Counter cash collection',
          },
        }], { session: sessionOpt });
        payment = createdPayments[0];
      }

      // Update booking
      booking.paymentStatus = 'success';
      booking.status = 'confirmed';
      booking.paymentMethod = 'CASH';
      booking.paymentId = payment._id.toString();
      if (!booking.qrCode || !booking.passToken) {
        const { qrCodeUrl, bookingIdStr, passToken, passTokenHash } = await this.generateAccessQRCode(booking, sessionOpt, false);
        booking.qrCode = qrCodeUrl;
        booking.passToken = passToken;
        booking.passTokenHash = passTokenHash;
        booking.qrStatus = 'active';
        booking.qrGeneratedAt = booking.qrGeneratedAt || new Date();
        if (!booking.bookingId) booking.bookingId = bookingIdStr;
      }
      await booking.save({ session: sessionOpt });

      // Post double-entry ledger entry inside the same session
      const financialLedgerService = (await import('../ledger/financialLedger.service.js')).default;
      const ledgerEntry = await financialLedgerService.recordSettlementLedgerEntry(payment, 'AMENITY', sessionOpt);

      if (session && session.inTransaction()) {
        await session.commitTransaction();
        session.endSession();
      }

      return {
        booking,
        payment,
        ledgerEntry,
        receiptNumber,
      };
    } catch (error) {
      if (session && session.inTransaction()) {
        await session.abortTransaction();
        session.endSession();
      }
      throw error;
    }
  }
}

export const amenityBookingService = new AmenityBookingService();
export default amenityBookingService;
