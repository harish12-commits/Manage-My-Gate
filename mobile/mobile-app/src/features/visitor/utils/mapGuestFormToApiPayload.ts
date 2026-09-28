import { GuestDetailsData } from '../components/guest/GuestDetailsStep';
import { GuestScheduleData } from '../components/guest/GuestScheduleStep';
import { GuestPassOptionsData } from '../components/guest/GuestPassOptionsStep';

export interface UserAuthContext {
  orgId?: string;
  createdById?: string;
  villaId?: string;
  roleId?: string;
}

export interface ApiVisitorPassPayload {
  orgId?: string;
  createdById?: string;
  villaId?: string;
  roleId?: string;
  passType: 'GUEST';
  isIdProofPass?: boolean;
  visitorDetails: {
    name: string;
    phone?: string;
    idProofType?: string;
    idProofNumber?: string;
  };
  purpose?: string;
  validity: {
    startDate: string;
    endDate: string;
    timeWindowStart?: string;
    timeWindowEnd?: string;
  };
  vehicleDetails?: {
    number?: string;
  };
  usageLimit: {
    maxUses: number;
  };
}

const NOW_PASS_VALIDITY_MS = 4 * 60 * 60 * 1000;

export const mapGuestFormToApiPayload = (
  details: GuestDetailsData,
  schedule: GuestScheduleData,
  options: GuestPassOptionsData,
  context: UserAuthContext = {}
): ApiVisitorPassPayload => {
  const now = new Date();
  
  let startDateObj = now;
  if (schedule.visitDate && schedule.visitDate.trim() !== '') {
    const parsedDate = new Date(schedule.visitDate);
    if (!isNaN(parsedDate.getTime())) {
      startDateObj = parsedDate;
    }
  }

  // Set start date to beginning of day
  const startDate = new Date(startDateObj);
  startDate.setHours(0, 0, 0, 0);

  // Set end date to end of day
  let endDate = new Date(startDateObj);
  endDate.setHours(23, 59, 59, 999);

  // "Arriving Now" is promised as valid for 4 hours from issue, not until midnight.
  if (schedule.timeSlot === 'NOW') {
    endDate = new Date(now.getTime() + NOW_PASS_VALIDITY_MS);
  }

  let timeWindowStart: string | undefined = undefined;
  let timeWindowEnd: string | undefined = undefined;

  const convertTo24 = (t?: string, defaultVal: string = '08:00'): string => {
    if (!t || !t.trim()) return defaultVal;
    const clean = t.trim();
    if (/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(clean)) return clean;
    const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/i);
    if (!match) return defaultVal;
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const modifier = match[3] ? match[3].toUpperCase() : null;
    if (modifier === 'PM' && hours < 12) hours += 12;
    else if (modifier === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  };

  if (schedule.timeSlot === 'TODAY_EVENING') {
    timeWindowStart = '17:00';
    timeWindowEnd = '23:00';
  } else if (schedule.timeSlot === 'TOMORROW') {
    timeWindowStart = '08:00';
    timeWindowEnd = '22:00';
  } else if (schedule.timeSlot === 'CUSTOM') {
    timeWindowStart = convertTo24(schedule.customStartTime, '14:00');
    timeWindowEnd = convertTo24(schedule.customEndTime, '18:00');
  }

  // Combine purpose and gate instructions into single string if present
  const purposeParts = [];
  if (details.purpose && details.purpose.trim()) {
    purposeParts.push(details.purpose.trim());
  }
  if (options.gateInstructions && options.gateInstructions.trim()) {
    purposeParts.push(`Instructions: ${options.gateInstructions.trim()}`);
  }
  const purpose = purposeParts.length > 0 ? purposeParts.join(' | ') : undefined;
  const isIdProofPass = !!options.isIdProofPass;

  const payload: ApiVisitorPassPayload = {
    passType: 'GUEST',
    isIdProofPass,
    visitorDetails: {
      name: details.visitorName.trim(),
      phone: details.phone ? details.phone.trim() : undefined,
      idProofType: isIdProofPass ? (options.idProofType || 'Aadhaar Card') : undefined,
      idProofNumber: isIdProofPass && options.idProofNumber ? options.idProofNumber.trim() : undefined,
    },
    purpose,
    validity: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...(timeWindowStart ? { timeWindowStart } : {}),
      ...(timeWindowEnd ? { timeWindowEnd } : {}),
    },
    usageLimit: {
      maxUses: options.entryMode === 'SINGLE' ? 1 : 99,
    },
  };

  if (options.vehicleNo && options.vehicleNo.trim()) {
    payload.vehicleDetails = {
      number: options.vehicleNo.trim().toUpperCase(),
    };
  }

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
