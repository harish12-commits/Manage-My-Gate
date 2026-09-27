import mongoose from 'mongoose';
import Amenity from './amenity.model.js';

export class AmenityRepository {
  async findAllByOrg(orgId, filter = {}) {
    return await Amenity.find({ orgId, isDeleted: false, ...filter }).sort({ createdAt: -1 });
  }

  async findById(id, orgId) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const filter = { _id: id, isDeleted: false };
    if (orgId) filter.orgId = orgId;
    let amenity = await Amenity.findOne(filter);
    if (!amenity) {
      try {
        const AmenityFacility = (await import('../amenityManagement/facilities/amenityFacility.model.js')).default;
        const query = { _id: id, isDeleted: false };
        if (orgId) query.orgId = orgId;
        const facility = await AmenityFacility.findOne(query);
        if (facility) {
          const f = facility.toObject ? facility.toObject() : facility;
          const pConfig = f.pricingConfig || {};
          const baseRate = Number(pConfig.baseRate) || 0;
          amenity = {
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
              baseRate,
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
            pricingConfig: f.pricingConfig,
            ratePerHour: baseRate,
            status: (f.status || 'ACTIVE').toLowerCase(),
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
            },
          };
        }
      } catch (e) {
        // Fallback gracefully
      }
    }
    return amenity;
  }

  async findByName(name, orgId) {
    // case-insensitive exact match
    return await Amenity.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, orgId, isDeleted: false });
  }

  async create(amenityData) {
    const amenity = new Amenity(amenityData);
    return await amenity.save();
  }

  async update(id, orgId, updateData, options = {}) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return await Amenity.findOneAndUpdate(
      { _id: id, orgId, isDeleted: false }, 
      updateData, 
      { returnDocument: 'after', runValidators: true, ...options }
    );
  }

  async softDelete(id, orgId) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return await Amenity.findOneAndUpdate({ _id: id, orgId }, { isDeleted: true, status: 'inactive' }, { returnDocument: 'after' });
  }
  async getAmenityStats(orgId) {
    const targetOrgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;
    const stats = await Amenity.aggregate([
      { $match: { orgId: targetOrgId, isDeleted: false } },
      {
        $facet: {
          total: [{ $count: "count" }],
          active: [{ $match: { status: 'active' } }, { $count: "count" }],
          inactive: [{ $match: { status: 'inactive' } }, { $count: "count" }],
          maintenance: [{ $match: { status: 'maintenance' } }, { $count: "count" }],
        }
      }
    ]);
    
    return {
      total: stats[0]?.total[0]?.count || 0,
      active: stats[0]?.active[0]?.count || 0,
      inactive: stats[0]?.inactive[0]?.count || 0,
      maintenance: stats[0]?.maintenance[0]?.count || 0,
    };
  }

  async getMaintenanceStats(orgId) {
    const targetOrgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;
    const stats = await Amenity.aggregate([
      { $match: { orgId: targetOrgId, isDeleted: false } },
      { $unwind: "$maintenanceSchedules" },
      {
        $facet: {
          scheduled: [{ $match: { "maintenanceSchedules.status": "scheduled" } }, { $count: "count" }],
          in_progress: [{ $match: { "maintenanceSchedules.status": "in_progress" } }, { $count: "count" }],
          completed: [{ $match: { "maintenanceSchedules.status": "completed" } }, { $count: "count" }]
        }
      }
    ]);

    if (!stats || stats.length === 0) return { scheduled: 0, in_progress: 0, completed: 0 };
    return {
      scheduled: stats[0].scheduled[0]?.count || 0,
      in_progress: stats[0].in_progress[0]?.count || 0,
      completed: stats[0].completed[0]?.count || 0
    };
  }

  async getAllMaintenance(orgId) {
    const amenities = await Amenity.find({ orgId, isDeleted: false }, 'name location type maintenanceSchedules');
    let maintenanceList = [];
    amenities.forEach(amenity => {
      if (amenity.maintenanceSchedules && amenity.maintenanceSchedules.length > 0) {
        amenity.maintenanceSchedules.forEach(schedule => {
          maintenanceList.push({
            ...schedule.toObject(),
            amenityId: amenity._id,
            amenityName: amenity.name,
            amenityLocation: amenity.location,
            amenityType: amenity.type
          });
        });
      }
    });
    // Sort by startDate descending
    maintenanceList.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return maintenanceList;
  }
}

export default new AmenityRepository();
