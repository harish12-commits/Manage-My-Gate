import { DeliveryDetailsData } from '../components/delivery/DeliveryDetailsStep';
import { DeliveryValidityData } from '../components/delivery/DeliveryValidityStep';
import { UserAuthContext } from './mapGuestFormToApiPayload';
import { toLocalDateKey } from './localDate';

export interface ApiDeliveryVisitorPassPayload {
  orgId?: string;
  createdById?: string;
  villaId?: string;
  roleId?: string;
  passType: 'DELIVERY';
  isPrivate: boolean;
  visitorDetails: {
    name: string;
  };
  deliveryDetails: {
    partner: string;
    orderId?: string;
    packageCount: number;
    deliveryAction: 'DOORSTEP' | 'LEAVE_AT_GATE';
    instructions?: string;
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

export const mapDeliveryFormToApiPayload = (
  partner: string,
  details: DeliveryDetailsData,
  validity: DeliveryValidityData,
  context: UserAuthContext = {},
  customPartnerName?: string
): ApiDeliveryVisitorPassPayload => {
  const now = new Date();
  const isMultiUse = validity.usageType === 'MULTI_USE';

  let startDate = new Date(now);
  let endDate = new Date(now);
  let allowedDays: number[] | undefined = undefined;
  let timeWindows: Array<{ start: string; end: string }> | undefined = undefined;

  if (isMultiUse) {
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days default
    endDate.setHours(23, 59, 59, 999);

    const mapped = (validity.selectedWeekdays || [])
      .map((d) => WEEKDAY_MAP[d.toUpperCase()])
      .filter((n) => n !== undefined)
      .sort((a, b) => a - b);

    allowedDays = mapped.length > 0 ? mapped : [0, 1, 2, 3, 4, 5, 6];

    if (Array.isArray(validity.timeSlots) && validity.timeSlots.length > 0) {
      timeWindows = validity.timeSlots.map((ts) => ({
        start: convertTo24Hr(ts.startTime),
        end: convertTo24Hr(ts.endTime),
      }));
    }
  } else {
    if (validity.validityDuration === 'THIRTY_MINS') {
      endDate = new Date(now.getTime() + 30 * 60 * 1000); // 30 mins
    } else if (validity.validityDuration === 'ONE_HOUR') {
      endDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
    } else if (validity.validityDuration === 'TWO_HOURS') {
      endDate = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    } else if (validity.validityDuration === 'END_OF_DAY') {
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (validity.validityDuration === 'CUSTOM') {
      const visitDateStr = validity.customVisitDate && validity.customVisitDate.trim()
        ? validity.customVisitDate.trim()
        : toLocalDateKey(now);
      const start24 = convertTo24Hr(validity.customStartTime || '02:00 PM');
      const end24 = convertTo24Hr(validity.customEndTime || '06:00 PM');

      const [sHours, sMins] = start24.split(':').map(Number);
      const [eHours, eMins] = end24.split(':').map(Number);

      startDate = new Date(visitDateStr);
      if (isNaN(startDate.getTime())) startDate = new Date(now);
      startDate.setHours(sHours || 0, sMins || 0, 0, 0);

      endDate = new Date(visitDateStr);
      if (isNaN(endDate.getTime())) endDate = new Date(now);
      endDate.setHours(eHours || 23, eMins || 59, 59, 999);

      timeWindows = [{ start: start24, end: end24 }];
    }
  }

  const rawPartner =
    partner === 'other' && customPartnerName && customPartnerName.trim()
      ? customPartnerName.trim()
      : partner;

  const partnerName = (rawPartner || 'DELIVERY').toUpperCase();
  const visitorName = `${partnerName} Delivery Agent`;
  const parsedCount = parseInt(details.packageCount, 10);
  const packageCount = !isNaN(parsedCount) && parsedCount > 0 ? parsedCount : 1;

  const isLeaveAtGate = details.deliveryAction === 'LEAVE_AT_GATE';
  const actionLabel = isLeaveAtGate ? 'Leave at Gate' : 'Doorstep Delivery';
  const orderRef = details.orderId && details.orderId.trim() !== '' ? `Order ${details.orderId.trim()}` : 'Parcel Delivery';
  
  const purpose = isMultiUse
    ? `Recurring Delivery Pre-Approval via ${partnerName} (${(allowedDays || []).length} Days/wk)`
    : `${orderRef} (${packageCount} Pkg) | ${actionLabel}`;

  const payload: ApiDeliveryVisitorPassPayload = {
    passType: 'DELIVERY',
    isPrivate: isLeaveAtGate,
    visitorDetails: {
      name: visitorName,
    },
    deliveryDetails: {
      partner: partnerName,
      orderId: details.orderId && details.orderId.trim() !== '' ? details.orderId.trim() : undefined,
      packageCount,
      deliveryAction: details.deliveryAction || 'DOORSTEP',
      instructions: details.instructions && details.instructions.trim() !== '' ? details.instructions.trim() : undefined,
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
