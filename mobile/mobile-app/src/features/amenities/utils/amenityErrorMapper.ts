/**
 * Amenity Management v2 - Error Mapper
 * Normalizes Axios and backend HTTP errors into structured AmenityErrorDetails.
 * Properly parses Express-Validator HTTP 400 structures, HTTP 409 conflicts, and HTTP 410 hold expiries.
 */

import { AmenityErrorDetails } from '../types/amenityDomain.types';

export const mapAmenityApiError = (error: any): AmenityErrorDetails => {
  if (!error) {
    return { message: 'An unexpected error occurred.' };
  }

  // Handle network / timeout errors without HTTP response
  if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
    return {
      message: 'The request timed out. Please check your network connection and try again.',
      isTimeout: true,
    };
  }

  if (error.message?.toLowerCase().includes('network error') || !error.response) {
    return {
      message: 'Network connection failed. Please check your internet connectivity.',
      isNetworkError: true,
    };
  }

  const status = error.response?.status;
  const responseData = error.response?.data;
  const baseMessage = responseData?.message || error.message || 'Operation failed';
  const errorCode = responseData?.code || responseData?.errorCode;
  const errorReason = responseData?.reason;

  // 1. HTTP 400 - Bad Request / Validation Failure (Express-Validator)
  if (status === 400) {
    const fieldErrors: Record<string, string> = {};
    const detailList: string[] = [];

    if (Array.isArray(responseData?.details)) {
      responseData.details.forEach((item: any) => {
        if (typeof item === 'object' && item !== null) {
          if (item.field && item.message) {
            fieldErrors[item.field] = item.message;
            detailList.push(`${item.field}: ${item.message}`);
          } else if (item.message) {
            detailList.push(item.message);
          }
        } else if (typeof item === 'string') {
          detailList.push(item);
        }
      });
    }

    let detailedMessage = baseMessage;
    if (detailList.length > 0) {
      detailedMessage = `${baseMessage}\n\n• ${detailList.join('\n• ')}`;
    }

    return {
      statusCode: 400,
      code: errorCode,
      reason: errorReason,
      message: detailedMessage || 'Validation failed. Please check the entered details.',
      fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
      details: responseData?.details,
    };
  }

  // 2. HTTP 401 - Unauthorized
  if (status === 401) {
    return {
      statusCode: 401,
      message: 'Session expired or unauthenticated. Please sign in again.',
    };
  }

  // 3. HTTP 403 - Forbidden / Tenant Boundary Violation
  if (status === 403) {
    return {
      statusCode: 403,
      code: errorCode,
      reason: errorReason,
      details: responseData?.details,
      message:
        baseMessage === 'Operation failed'
          ? 'You do not have permission to perform this action in this community.'
          : baseMessage,
    };
  }

  // HTTP 402 - Payment Required (e.g. a booking balance to collect at the gate)
  if (status === 402) {
    return {
      statusCode: 402,
      code: errorCode,
      message: baseMessage,
      details: responseData?.details,
    };
  }

  // 4. HTTP 404 - Not Found
  if (status === 404) {
    return {
      statusCode: 404,
      message: baseMessage || 'The requested facility or reservation could not be found.',
    };
  }

  // 5. HTTP 409 - Conflict (Concurrency, Idempotency, Slot collision, Policy T1/T2/T3)
  if (status === 409) {
    const lower = String(baseMessage).toLowerCase();
    let conflictType: 'SLOT_CAPACITY' | 'IDEMPOTENCY_MISMATCH' | 'OPERATION_IN_PROGRESS' | 'CONCURRENCY_VERSION' | 'GENERIC' = 'GENERIC';

    if (lower.includes('idempotency') && lower.includes('payload')) {
      conflictType = 'IDEMPOTENCY_MISMATCH';
    } else if (lower.includes('in progress') || lower.includes('operation in progress')) {
      conflictType = 'OPERATION_IN_PROGRESS';
    } else if (lower.includes('version') || lower.includes('concurrency') || lower.includes('modified')) {
      conflictType = 'CONCURRENCY_VERSION';
    } else if (lower.includes('slot') || lower.includes('capacity') || lower.includes('conflict') || lower.includes('overlap')) {
      conflictType = 'SLOT_CAPACITY';
    }

    const detailsObj = responseData?.details;
    const requiresBookingAction = Boolean(
      responseData?.requiresBookingAction ||
      detailsObj?.requiresBookingAction ||
      lower.includes('requiresbookingaction') ||
      lower.includes('bookingaction')
    );
    let upcomingBookingsCount =
      responseData?.upcomingBookingsCount ||
      detailsObj?.upcomingBookingsCount ||
      detailsObj?.activeBookingsCount ||
      0;

    if (!upcomingBookingsCount && typeof baseMessage === 'string') {
      const match = baseMessage.match(/(\d+)\s+upcoming/i);
      if (match && match[1]) {
        upcomingBookingsCount = parseInt(match[1], 10);
      }
    }

    const requiresConflictAction = Boolean(
      responseData?.requiresConflictAction ||
      detailsObj?.requiresConflictAction ||
      lower.includes('requiresconflictaction') ||
      lower.includes('conflictaction')
    );
    const requiresResolution = Boolean(
      responseData?.requiresResolution ||
      detailsObj?.requiresResolution ||
      lower.includes('future confirmed bookings exist')
    );

    return {
      statusCode: 409,
      code: errorCode,
      isConflict: true,
      conflictType,
      message: baseMessage || 'A scheduling or inventory conflict occurred.',
      details: detailsObj,
      requiresBookingAction,
      upcomingBookingsCount,
      requiresConflictAction,
      requiresResolution,
    };
  }

  // 6. HTTP 410 - Gone (Hold Expired)
  if (status === 410) {
    return {
      statusCode: 410,
      isHoldExpired: true,
      message: baseMessage || 'The reservation hold has expired. Please select a time slot again.',
    };
  }

  // 7. HTTP 5xx - Server Errors
  if (status >= 500) {
    return {
      statusCode: status,
      message: 'A server error occurred. Please try again later.',
    };
  }

  return {
    statusCode: status,
    message: baseMessage,
  };
};
