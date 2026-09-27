import { ExtendedVisitorPass, PassTypeKey } from '../mocks/visitorMocks';

const WEEKDAY_MAP: { [key: number]: string } = {
  0: 'SUN',
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT',
};

/**
 * Pure mapper function converting raw backend VisitorPass documents
 * into normalized ExtendedVisitorPass objects for history UI rendering.
 */
export const mapBackendPassToHistoryItem = (backendPass: any): ExtendedVisitorPass => {
  if (!backendPass) {
    return {} as ExtendedVisitorPass;
  }

  const rawPassType = backendPass.passType || 'GUEST';
  const isGroupPass = Boolean(backendPass.isGroupPass);

  let passType: PassTypeKey = 'GUEST';
  if (rawPassType === 'GUEST' && isGroupPass) {
    passType = 'GROUP';
  } else if (rawPassType === 'CAB') {
    passType = 'CAB';
  } else if (rawPassType === 'DELIVERY') {
    passType = 'DELIVERY';
  } else if (rawPassType === 'SERVICE') {
    passType = 'SERVICE';
  } else {
    passType = 'GUEST';
  }

  let visitorName = backendPass.visitorDetails?.name || backendPass.visitorName || '';
  let phone = backendPass.visitorDetails?.phone || backendPass.phone || '';
  let provider: string | undefined = undefined;
  let vehicleNo: string | undefined = backendPass.vehicleDetails?.number || undefined;
  let guestCount: number | undefined = undefined;
  let guestList: Array<{ name: string; phone: string }> | undefined = undefined;
  let deliveryInstructions: string | undefined = undefined;
  let orderId: string | undefined = undefined;
  let packageCount: number | undefined = undefined;
  let deliveryAction: string | undefined = undefined;
  let serviceNotes: string | undefined = undefined;
  let allowedWeekdays: string[] | undefined = undefined;
  let timeWindow: { startTime: string; endTime: string } | undefined = undefined;

  switch (passType) {
    case 'GUEST': {
      if (!visitorName) visitorName = 'Guest Visitor';
      break;
    }

    case 'GROUP': {
      const maxPasses = backendPass.usageLimit?.maxUses || backendPass.groupGuests?.length || 0;
      if (!visitorName) {
        visitorName = maxPasses > 0 ? `Group Visit (${maxPasses} passes)` : 'Group Visit';
      }
      if (!phone && backendPass.groupGuests?.[0]?.phone) {
        phone = backendPass.groupGuests[0].phone;
      }
      guestCount = maxPasses;
      guestList = Array.isArray(backendPass.groupGuests) && backendPass.groupGuests.length > 0
        ? backendPass.groupGuests.map((g: any) => ({
            name: g.name || 'Guest',
            phone: g.phone || '',
          }))
        : undefined;
      break;
    }

    case 'CAB': {
      provider = backendPass.vehicleDetails?.vendor || undefined;
      vehicleNo = backendPass.vehicleDetails?.number || undefined;
      if (!visitorName) {
        if (provider) {
          visitorName = `${provider} Cab${vehicleNo ? ` (${vehicleNo})` : ''}`;
        } else {
          visitorName = 'Taxi / Cab Entry';
        }
      }
      break;
    }

    case 'DELIVERY': {
      provider = backendPass.deliveryDetails?.partner || undefined;
      orderId = backendPass.deliveryDetails?.orderId || undefined;
      packageCount = backendPass.deliveryDetails?.packageCount || undefined;
      deliveryAction = backendPass.deliveryDetails?.deliveryAction || undefined;
      deliveryInstructions = backendPass.deliveryDetails?.instructions || undefined;
      if (!visitorName) {
        visitorName = provider ? `${provider} Delivery` : 'Delivery Partner';
      }
      break;
    }

    case 'SERVICE': {
      provider = backendPass.serviceDetails?.category || undefined;
      serviceNotes = backendPass.serviceDetails?.notes || undefined;
      if (!visitorName) {
        visitorName = provider ? `${provider} Service` : 'Service Staff';
      }
      if (Array.isArray(backendPass.validity?.allowedDays)) {
        allowedWeekdays = backendPass.validity.allowedDays.map(
          (dayNum: number) => WEEKDAY_MAP[dayNum] || String(dayNum)
        );
      }
      if (backendPass.validity?.timeWindowStart && backendPass.validity?.timeWindowEnd) {
        timeWindow = {
          startTime: backendPass.validity.timeWindowStart,
          endTime: backendPass.validity.timeWindowEnd,
        };
      }
      break;
    }
  }

  const validFrom = backendPass.validity?.startDate
    ? new Date(backendPass.validity.startDate).toISOString()
    : backendPass.validFrom || undefined;

  const validUntil = backendPass.validity?.endDate
    ? new Date(backendPass.validity.endDate).toISOString()
    : backendPass.validUntil || undefined;

  const code = backendPass.shortKey || backendPass.code || undefined;

  return {
    _id: backendPass._id || String(Math.random()),
    visitorName,
    phone,
    purpose: backendPass.purpose || serviceNotes || deliveryInstructions || undefined,
    validFrom,
    validUntil,
    status: backendPass.status || 'PENDING',
    code,
    passType,
    vehicleNo,
    provider,
    guestCount,
    guestList,
    deliveryInstructions,
    orderId,
    packageCount,
    deliveryAction,
    serviceNotes,
    allowedWeekdays,
    timeWindow,
    rawPass: backendPass,
  };
};

export default mapBackendPassToHistoryItem;
