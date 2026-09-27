export const isWithinTimeWindow = (currentTime, start, end) => {
  if (!start || !end) return false;
  return start <= end
    ? currentTime >= start && currentTime <= end
    : currentTime >= start || currentTime <= end;
};

/**
 * Returns a user-safe reason when a pass cannot be used at the supplied instant.
 * Date-only end dates are normalized at creation time; explicit end times remain exact.
 */
export const getPassEntryFailure = (pass, now = new Date()) => {
  if (!['PENDING', 'ACTIVE'].includes(pass?.status)) {
    return `Visitor pass status is ${String(pass?.status || 'unknown').toLowerCase()}.`;
  }

  const start = new Date(pass?.validity?.startDate);
  const end = new Date(pass?.validity?.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || now < start || now > end) {
    return 'Visitor pass validity date range is not currently active.';
  }

  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const windows = pass?.validity?.timeWindows;
  if (Array.isArray(windows) && windows.length > 0) {
    if (!windows.some((window) => isWithinTimeWindow(currentTime, window?.start, window?.end))) {
      return 'Visitor pass is not valid during the current access window.';
    }
  } else if (pass?.validity?.timeWindowStart && pass?.validity?.timeWindowEnd &&
    !isWithinTimeWindow(currentTime, pass.validity.timeWindowStart, pass.validity.timeWindowEnd)) {
    return 'Visitor pass is not valid during the current access window.';
  }

  if (Array.isArray(pass?.validity?.allowedDays) && pass.validity.allowedDays.length > 0 &&
    !pass.validity.allowedDays.includes(now.getDay())) {
    return 'Visitor pass is not authorized for use on this day of the week.';
  }

  if ((pass?.usageLimit?.currentUses || 0) >= (pass?.usageLimit?.maxUses || 1)) {
    return 'Visitor pass has already reached its maximum usage limit.';
  }

  return null;
};
