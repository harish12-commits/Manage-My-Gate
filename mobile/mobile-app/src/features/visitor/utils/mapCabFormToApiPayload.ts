import { CabVehicleData } from '../components/cab/CabVehicleStep';
import { CabScheduleData } from '../components/cab/CabScheduleStep';
import { UserAuthContext } from './mapGuestFormToApiPayload';
import { toLocalDateKey } from './localDate';

export interface ApiCabVisitorPassPayload {
  orgId?: string;
  createdById?: string;
  villaId?: string;
  roleId?: string;
  passType: 'CAB';
  visitorDetails: {
    name: string;
    phone?: string;
  };
  vehicleDetails: {
    vendor: string;
    number: string;
    vehicleType: string;
  };
  purpose?: string;
  validity: {
    startDate: string;
    endDate: string;
    allowedDays?: number[];
    timeWindows?: Array<{ start: string; end: string }>;
  };
  usageLimit: {
    maxUses: number;
  };
}

const WEEKDAY_MAP: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

const convertTo24Hr = (timeStr: string): string => {
  if (!timeStr || !timeStr.trim()) return '08:00';
  const clean = timeStr.trim();
  if (/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(clean)) return clean;
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/i);
  if (!match) return '08:00';
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const modifier = match[3] ? match[3].toUpperCase() : null;
  if (modifier === 'PM' && hours < 12) hours += 12;
  else if (modifier === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
};

export const mapCabFormToApiPayload = (
  provider: string,
  vehicle: CabVehicleData,
  schedule: CabScheduleData,
  context: UserAuthContext = {},
  customProviderName?: string
): ApiCabVisitorPassPayload => {
  const now = new Date();
  const isMultiUse = schedule.usageType === 'MULTI_USE';

  let startDate = new Date(now);
  let endDate = new Date(now);
  let allowedDays: number[] | undefined = undefined;
  let timeWindows: Array<{ start: string; end: string }> | undefined = undefined;

  if (isMultiUse) {
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days default
    endDate.setHours(23, 59, 59, 999);

    const mapped = (schedule.selectedWeekdays || [])
      .map((d) => WEEKDAY_MAP[d.toUpperCase()])
      .filter((n) => n !== undefined)
      .sort((a, b) => a - b);

    allowedDays = mapped.length > 0 ? mapped : [1, 2, 3, 4, 5];

    if (Array.isArray(schedule.timeSlots) && schedule.timeSlots.length > 0) {
      timeWindows = schedule.timeSlots.map((ts) => ({
        start: convertTo24Hr(ts.startTime),
        end: convertTo24Hr(ts.endTime),
      }));
    }
  } else {
    if (schedule.arrivalWindow === 'IMMEDIATE') {
      endDate = new Date(now.getTime() + 30 * 60 * 1000); // 30 mins
    } else if (schedule.arrivalWindow === 'THIRTY_MINS') {
      endDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
    } else if (schedule.arrivalWindow === 'ONE_HOUR') {
      endDate = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    } else if (schedule.arrivalWindow === 'TODAY_LATER') {
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (schedule.arrivalWindow === 'CUSTOM') {
      const visitDateStr = schedule.customVisitDate && schedule.customVisitDate.trim()
        ? schedule.customVisitDate.trim()
        : toLocalDateKey(now);
      const baseDate = new Date(visitDateStr);
      
      if (schedule.customStartTime) {
        const [h, m] = convertTo24Hr(schedule.customStartTime).split(':');
        startDate = new Date(baseDate);
        startDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
      }
      if (schedule.customEndTime) {
        const [h, m] = convertTo24Hr(schedule.customEndTime).split(':');
        endDate = new Date(baseDate);
        endDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
      } else {
        endDate = new Date(startDate.getTime() + 2 * 60 * 60000); // 2 hrs default
      }
    }
  }

  const rawVendor =
    provider === 'other' && customProviderName && customProviderName.trim()
      ? customProviderName.trim()
      : provider;

  const vendorName = (rawVendor || 'CAB').toUpperCase();
  const vehicleType = (vehicle.vehicleType || 'CAB').toUpperCase();
  const visitorName = `${vendorName} Driver`;

  const purpose = isMultiUse
    ? `${vehicleType} Multi-Use Pre-Approval via ${vendorName} (${(allowedDays || []).length} Days/wk)`
    : `${vehicleType} Pre-Approval via ${vendorName}`;

  const payload: ApiCabVisitorPassPayload = {
    passType: 'CAB',
    visitorDetails: {
      name: visitorName,
      phone: vehicle.driverPhone && vehicle.driverPhone.trim() !== '' ? vehicle.driverPhone.trim() : undefined,
    },
    vehicleDetails: {
      vendor: vendorName,
      number: vehicle.vehicleNo ? vehicle.vehicleNo.trim().toUpperCase() : 'UNKNOWN',
      vehicleType,
    },
    purpose,
    validity: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...(allowedDays ? { allowedDays } : {}),
      ...(timeWindows ? { timeWindows } : {}),
    },
    usageLimit: {
      maxUses: isMultiUse ? 100 : 1,
    },
  };

  if (context.orgId) {
    payload.orgId = context.orgId;
  }
  if (context.createdById) {
    payload.createdById = context.createdById;
  }
  if (context.villaId) {
    payload.villaId = context.villaId;
  }
  if (context.roleId) {
    payload.roleId = context.roleId;
  }

  return payload;
};

