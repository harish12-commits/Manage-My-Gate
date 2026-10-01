import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/manage_my_gate_dev';

export async function seedAmenitiesCatalog(shouldDisconnect = false) {
  if (mongoose.connection.readyState !== 1) {
    console.log(`[SEED] Connecting to MongoDB at ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('[SEED] Connected successfully.');
  }

  const db = mongoose.connection.db;

  // Find all residential/commercial organizations to seed (excluding system platform)
  const orgs = await db.collection('organizations').find({ isPlatform: { $ne: true } }).toArray();
  if (!orgs || orgs.length === 0) {
    console.error('[SEED] No organizations found in database!');
    process.exit(1);
  }

  console.log(`[SEED] Seeding comprehensive amenities catalog for ${orgs.length} organizations.`);

  for (const org of orgs) {
    const orgId = org._id;
    console.log(`\n--------------------------------------------------`);
    console.log(`[SEED] Seeding amenities for: "${org.name}" (${orgId})`);

    // Clean existing v2 facilities, resources, and maintenance blocks for this org to prevent duplicate codes
    await db.collection('amenity_management_facilities').deleteMany({ orgId });
    await db.collection('amenity_management_resources').deleteMany({ orgId });
    await db.collection('amenity_management_maintenance_blocks').deleteMany({ orgId });
    await db.collection('amenities').deleteMany({ orgId });

    // 1. SHARED CAPACITY (Case 1: Active, Free, Headcount Quota)
    const poolFacilityId = new mongoose.Types.ObjectId();
    const poolFacility = {
      _id: poolFacilityId,
      orgId,
      name: 'Olympic Swimming Pool & Splash Deck',
      code: 'POOL-OLYMPIC-01',
      archetype: 'SHARED_CAPACITY',
      description: 'Full Olympic-sized 50m temperature-controlled pool with 8 swim lanes and dedicated toddler splash area.',
      location: 'Clubhouse Ground Floor',
      timezone: 'UTC',
      operatingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        dayOfWeek: day,
        openTime: '06:00',
        closeTime: '22:00',
        isOpen: true,
      })),
      slotDurationMinutes: 60,
      maxCapacity: 40,
      pricingConfig: {
        pricingType: 'FREE',
        baseRate: 0,
        currency: 'INR',
        securityDeposit: 0,
        taxPercentage: 0,
        cancellationFee: 0,
      },
      requiresApproval: false,
      cancellationPolicy: {
        isAllowed: true,
        refundCutoffHours: 2,
        refundPercentage: 100,
      },
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      concurrencyVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 2. SHARED CAPACITY (Case 2: Active, Free, Gym & Cardio)
    const gymFacilityId = new mongoose.Types.ObjectId();
    const gymFacility = {
      _id: gymFacilityId,
      orgId,
      name: 'High-Altitude Fitness Gym & Cardio Studio',
      code: 'GYM-CARDIO-02',
      archetype: 'SHARED_CAPACITY',
      description: 'Equipped with Technogym cardio machines, free weights up to 50kg, and crossfit functional training rigs.',
      location: 'Clubhouse 2nd Floor',
      timezone: 'UTC',
      operatingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        dayOfWeek: day,
        openTime: '05:00',
        closeTime: '23:00',
        isOpen: true,
      })),
      slotDurationMinutes: 60,
      maxCapacity: 35,
      pricingConfig: {
        pricingType: 'FREE',
        baseRate: 0,
        currency: 'INR',
        securityDeposit: 0,
        taxPercentage: 0,
        cancellationFee: 0,
      },
      requiresApproval: false,
      cancellationPolicy: {
        isAllowed: true,
        refundCutoffHours: 2,
        refundPercentage: 100,
      },
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      concurrencyVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 3. EXCLUSIVE HOURLY (Case 3: Active, Hourly Paid, Discrete Slots & Buffers)
    const tennisFacilityId = new mongoose.Types.ObjectId();
    const tennisFacility = {
      _id: tennisFacilityId,
      orgId,
      name: 'Championship Tennis Court (Synthetic Turf)',
      code: 'TENNIS-SYNTH-01',
      archetype: 'EXCLUSIVE_HOURLY',
      description: 'Professional floodlit synthetic turf court with automated ball machine, courtside spectator seating, and player lounge.',
      location: 'Sports Complex Court 1',
      timezone: 'UTC',
      operatingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        dayOfWeek: day,
        openTime: '06:00',
        closeTime: '22:00',
        isOpen: true,
      })),
      slotDurationMinutes: 60,
      maxCapacity: 4,
      pricingConfig: {
        pricingType: 'HOURLY',
        baseRate: 200,
        currency: 'INR',
        securityDeposit: 100,
        taxPercentage: 18,
        cancellationFee: 50,
      },
      requiresApproval: false,
      cancellationPolicy: {
        isAllowed: true,
        refundCutoffHours: 24,
        refundPercentage: 100,
      },
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      concurrencyVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 4. EXCLUSIVE HOURLY (Case 4: Under Maintenance Case)
    const badmintonFacilityId = new mongoose.Types.ObjectId();
    const badmintonFacility = {
      _id: badmintonFacilityId,
      orgId,
      name: 'Indoor Wooden Badminton Court A',
      code: 'BADMINTON-WOOD-01',
      archetype: 'EXCLUSIVE_HOURLY',
      description: 'BWF-standard teak-wood cushioned court. Currently undergoing annual polyurethane varnishing and line restriping.',
      location: 'Indoor Sports Pavilion',
      timezone: 'UTC',
      operatingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        dayOfWeek: day,
        openTime: '06:00',
        closeTime: '22:00',
        isOpen: false, // Closed during maintenance
      })),
      slotDurationMinutes: 45,
      maxCapacity: 4,
      pricingConfig: {
        pricingType: 'HOURLY',
        baseRate: 150,
        currency: 'INR',
        securityDeposit: 50,
        taxPercentage: 18,
        cancellationFee: 30,
      },
      requiresApproval: false,
      cancellationPolicy: {
        isAllowed: true,
        refundCutoffHours: 12,
        refundPercentage: 100,
      },
      isActive: false, // Inactive / Under maintenance
      isDeleted: false,
      deletedAt: null,
      concurrencyVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Maintenance block for Badminton Court
    const maintenanceBlock = {
      _id: new mongoose.Types.ObjectId(),
      orgId,
      facilityId: badmintonFacilityId,
      resourceId: null,
      startDateTime: new Date(Date.now() - 3600000), // Started 1h ago
      endDateTime: new Date(Date.now() + 3 * 86400000), // Ends in 3 days
      isCompleteClosure: true,
      degradedCapacity: 0,
      reason: 'Polyurethane Floor Refinishing & Anti-Slip Recoating',
      status: 'IN_PROGRESS',
      concurrencyVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection('amenity_management_maintenance_blocks').insertOne(maintenanceBlock);

    // 5. EVENT SPACE (Case 5: Active, Daily Rate, Mandatory Admin Approval, Advance Notice)
    const ballroomFacilityId = new mongoose.Types.ObjectId();
    const ballroomFacility = {
      _id: ballroomFacilityId,
      orgId,
      name: 'Grand Royal Ballroom & Banquet Lawn',
      code: 'HALL-BALLROOM-01',
      archetype: 'EVENT_SPACE',
      description: 'Palatial banquet hall with private landscaped party lawn, theatrical acoustic staging, and commercial catering pantry.',
      location: 'Community Cultural Center Ground Floor',
      timezone: 'UTC',
      operatingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        dayOfWeek: day,
        openTime: '08:00',
        closeTime: '23:59',
        isOpen: true,
      })),
      slotDurationMinutes: 1440, // 24-hour daily block
      maxCapacity: 250,
      pricingConfig: {
        pricingType: 'DAILY',
        baseRate: 5000,
        currency: 'INR',
        securityDeposit: 2000,
        taxPercentage: 18,
        cancellationFee: 500,
      },
      requiresApproval: true, // Mandatory Admin Approval
      cancellationPolicy: {
        isAllowed: true,
        refundCutoffHours: 72, // 3 days notice
        refundPercentage: 80,
      },
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      concurrencyVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 6. EVENT SPACE (Case 6: Inactive / Draft Case)
    const amphitheaterFacilityId = new mongoose.Types.ObjectId();
    const amphitheaterFacility = {
      _id: amphitheaterFacilityId,
      orgId,
      name: 'Sunset Open-Air Amphitheater',
      code: 'AMPHI-SUNSET-02',
      archetype: 'EVENT_SPACE',
      description: 'Tiered semi-circular amphitheater for musical concerts, drama, and community open-mic cultural nights.',
      location: 'South Lake Park',
      timezone: 'UTC',
      operatingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        dayOfWeek: day,
        openTime: '16:00',
        closeTime: '22:00',
        isOpen: true,
      })),
      slotDurationMinutes: 360,
      maxCapacity: 300,
      pricingConfig: {
        pricingType: 'DAILY',
        baseRate: 2500,
        currency: 'INR',
        securityDeposit: 1000,
        taxPercentage: 18,
        cancellationFee: 250,
      },
      requiresApproval: true,
      cancellationPolicy: {
        isAllowed: true,
        refundCutoffHours: 48,
        refundPercentage: 90,
      },
      isActive: false, // Inactive / Draft
      isDeleted: false,
      deletedAt: null,
      concurrencyVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 7. ROOM RESOURCE (Case 7: Active, Discrete Sub-Rooms with AV Equipment)
    const coworkingFacilityId = new mongoose.Types.ObjectId();
    const coworkingFacility = {
      _id: coworkingFacilityId,
      orgId,
      name: 'Smart Co-Working Hub & Meeting Suites',
      code: 'COWORK-HUB-01',
      archetype: 'ROOM_RESOURCE',
      description: 'Executive workspace featuring discrete private boardroom suites, soundproof focus pods, and high-speed Wi-Fi.',
      location: 'Clubhouse 3rd Floor - Wing B',
      timezone: 'UTC',
      operatingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        dayOfWeek: day,
        openTime: '08:00',
        closeTime: '21:00',
        isOpen: true,
      })),
      slotDurationMinutes: 60,
      maxCapacity: 20,
      pricingConfig: {
        pricingType: 'HOURLY',
        baseRate: 150,
        currency: 'INR',
        securityDeposit: 0,
        taxPercentage: 18,
        cancellationFee: 0,
      },
      requiresApproval: false,
      cancellationPolicy: {
        isAllowed: true,
        refundCutoffHours: 4,
        refundPercentage: 100,
      },
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      concurrencyVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Sub-Rooms for Room Resource
    const boardroomResource = {
      _id: new mongoose.Types.ObjectId(),
      orgId,
      facilityId: coworkingFacilityId,
      name: 'Executive Boardroom Alpha',
      identifier: 'ROOM-ALPHA-01',
      setupBufferMinutes: 10,
      teardownBufferMinutes: 10,
      isSerializedAsset: false,
      serialNumber: null,
      assetState: 'AVAILABLE',
      totalBulkStock: 1,
      concurrencyVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const focusPodResource = {
      _id: new mongoose.Types.ObjectId(),
      orgId,
      facilityId: coworkingFacilityId,
      name: 'Private Focus Pod 1',
      identifier: 'POD-BETA-02',
      setupBufferMinutes: 5,
      teardownBufferMinutes: 5,
      isSerializedAsset: false,
      serialNumber: null,
      assetState: 'AVAILABLE',
      totalBulkStock: 1,
      concurrencyVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('amenity_management_resources').insertMany([boardroomResource, focusPodResource]);

    // 8. INVENTORY & TOOLS (Case 8: Active, Free Asset Loan, Serialized Stock, Return Inspection)
    const toolFacilityId = new mongoose.Types.ObjectId();
    const toolFacility = {
      _id: toolFacilityId,
      orgId,
      name: 'Community Power Toolkit & Asset Library',
      code: 'TOOL-LIBRARY-01',
      archetype: 'INVENTORY_TOOLS',
      description: 'Borrow high-grade cordless drills, pressure washers, and telescopic aluminum ladders for home maintenance.',
      location: 'Estate Maintenance Facility - Gate 3',
      timezone: 'UTC',
      operatingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        dayOfWeek: day,
        openTime: '08:00',
        closeTime: '18:00',
        isOpen: true,
      })),
      slotDurationMinutes: 1440, // 24-hour checkout window
      maxCapacity: 10,
      pricingConfig: {
        pricingType: 'FREE',
        baseRate: 0,
        currency: 'INR',
        securityDeposit: 100, // Refundable deposit
        taxPercentage: 0,
        cancellationFee: 0,
      },
      requiresApproval: false,
      cancellationPolicy: {
        isAllowed: true,
        refundCutoffHours: 2,
        refundPercentage: 100,
      },
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      concurrencyVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Serialized physical assets for Inventory & Tools
    const toolAssets = [
      {
        _id: new mongoose.Types.ObjectId(),
        orgId,
        facilityId: toolFacilityId,
        name: 'Bosch Professional 18V Cordless Impact Drill Kit',
        identifier: 'TOOL-BOSCH-01',
        setupBufferMinutes: 15,
        teardownBufferMinutes: 15,
        isSerializedAsset: true,
        serialNumber: 'BSH-98421-IMP',
        assetState: 'AVAILABLE',
        totalBulkStock: 1,
        concurrencyVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        orgId,
        facilityId: toolFacilityId,
        name: 'Kärcher K5 High-Pressure Surface Cleaner',
        identifier: 'TOOL-KARCHER-02',
        setupBufferMinutes: 15,
        teardownBufferMinutes: 15,
        isSerializedAsset: true,
        serialNumber: 'KRC-55219-HPC',
        assetState: 'AVAILABLE',
        totalBulkStock: 1,
        concurrencyVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        orgId,
        facilityId: toolFacilityId,
        name: 'Werner 12ft Multi-Position Aluminum Ladder',
        identifier: 'TOOL-LADDER-03',
        setupBufferMinutes: 10,
        teardownBufferMinutes: 10,
        isSerializedAsset: true,
        serialNumber: 'WRN-12003-LAD',
        assetState: 'AVAILABLE',
        totalBulkStock: 1,
        concurrencyVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await db.collection('amenity_management_resources').insertMany(toolAssets);

    // Insert all 8 facilities into amenity_management_facilities (v2)
    const allFacilities = [
      poolFacility,
      gymFacility,
      tennisFacility,
      badmintonFacility,
      ballroomFacility,
      amphitheaterFacility,
      coworkingFacility,
      toolFacility,
    ];
    await db.collection('amenity_management_facilities').insertMany(allFacilities);

    // Also populate legacy amenities collection with matching records for backward compatibility
    const legacyRecords = allFacilities.map((f) => ({
      _id: f._id,
      orgId: f.orgId,
      name: f.name,
      description: f.description,
      type: f.archetype === 'EXCLUSIVE_HOURLY' ? 'sports' : f.archetype === 'SHARED_CAPACITY' ? 'pool' : f.archetype === 'EVENT_SPACE' ? 'hall' : 'general',
      category: f.archetype === 'SHARED_CAPACITY' ? 'Pool' : f.archetype === 'EXCLUSIVE_HOURLY' ? 'Sports' : f.archetype === 'EVENT_SPACE' ? 'Event Space' : f.archetype === 'ROOM_RESOURCE' ? 'Workspace' : 'Utility',
      archetype: f.archetype,
      code: f.code,
      location: f.location,
      pricing: {
        baseRate: f.pricingConfig.baseRate,
        pricingType: f.pricingConfig.pricingType.toLowerCase(),
        peakRateMultiplier: 1,
        weekendRateMultiplier: 1,
        holidayRateMultiplier: 1,
        securityDeposit: f.pricingConfig.securityDeposit,
        securityDepositDescription: f.pricingConfig.securityDeposit > 0 ? 'Refundable deposit against equipment damages.' : null,
        taxPercentage: f.pricingConfig.taxPercentage,
        cancellationChargePercentage: 0,
        dynamicPricingEnabled: false,
      },
      openDays: [0, 1, 2, 3, 4, 5, 6],
      capacity: f.maxCapacity,
      bookingRules: {
        slotDurationMinutes: f.slotDurationMinutes,
        bufferTimeMinutes: 15,
        openTime: '06:00',
        closeTime: '22:00',
        maxBookingsPerUserPerSlot: 2,
        advanceBookingDays: 7,
        minAdvanceBookingHours: 2,
        isCancellationEnabled: true,
        holidayCalendarIds: [],
        weeklyOffDays: [],
        cancellationRefundRules: [],
      },
      status: f.code === 'BADMINTON-WOOD-01' ? 'MAINTENANCE' : f.isActive ? 'active' : 'inactive',
      isDeleted: false,
      maintenanceSchedules: f.code === 'BADMINTON-WOOD-01' ? [
        {
          _id: maintenanceBlock._id,
          title: maintenanceBlock.reason,
          description: 'Polyurethane coating and floor restoration.',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          startTime: '08:00',
          endTime: '18:00',
          status: 'in_progress',
          type: 'preventive',
          priority: 'high',
        }
      ] : [],
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
    await db.collection('amenities').insertMany(legacyRecords);

    console.log(`[SEED] Successfully seeded 8 facilities covering all 5 archetypes & cases for "${org.name}"!`);
  }

  console.log('\n==================================================');
  console.log('[SEED] All organizations successfully seeded with complete amenity catalogs.');
  if (shouldDisconnect) {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedAmenitiesCatalog(true).catch((err) => {
    console.error('[SEED] Fatal error seeding amenities catalog:', err);
    process.exit(1);
  });
}
