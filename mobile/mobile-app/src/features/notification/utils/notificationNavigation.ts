/**
 * Centralized Notification Deep-Linking and Navigation System.
 * Maps incoming structured push payloads, semantic notification types,
 * and web action URLs to the appropriate mobile Expo Router destination.
 */

export interface StructuredNotificationPayload {
  notificationId?: string;
  type?: string;
  entityId?: string;
  route?: string;
  action?: string;
  actionUrl?: string;
  title?: string;
  body?: string;
  orgId?: string;
  [key: string]: any;
}

// In-memory deduplication state
let lastNotificationId: string | null = null;
let lastNotificationTime = 0;
const DEDUPLICATION_WINDOW_MS = 3000;

/**
 * Checks whether a notification interaction event is a duplicate within the deduplication window.
 * Prevents double navigation loops on cold-start or rapid tap events.
 */
export const isDuplicateNotification = (notificationId?: string | null): boolean => {
  if (!notificationId) return false;
  const now = Date.now();
  if (lastNotificationId === notificationId && now - lastNotificationTime < DEDUPLICATION_WINDOW_MS) {
    console.log(`[NotificationNavigation] Duplicate notification interaction suppressed for ID: ${notificationId}`);
    return true;
  }
  lastNotificationId = notificationId;
  lastNotificationTime = now;
  return false;
};

/**
 * Resets the in-memory deduplication tracker (useful in tests or session reset).
 */
export const resetDeduplicationTracker = () => {
  lastNotificationId = null;
  lastNotificationTime = 0;
};

/**
 * Resolves a notification payload to an Expo Router mobile route.
 * Handles:
 * 1. Explicit destination routes (e.g. route: "VisitorManagement", "ComplaintDetails")
 * 2. Semantic types + entityId (e.g. type: "VISITOR_REQUEST", entityId: "123")
 * 3. Legacy Web action URLs (e.g. "#/visitor-management?tab=walkin")
 * 4. Graceful fallbacks for missing/malformed entities.
 */
export const resolveNotificationRoute = (payload?: StructuredNotificationPayload | null): string => {
  if (!payload) {
    return '/(resident)/notifications';
  }

  const {
    type = '',
    entityId = '',
    route = '',
    actionUrl = '',
    title = '',
    body = '',
  } = payload;

  const normalizedType = String(type || '').toUpperCase().trim();
  const normalizedRoute = String(route || '').trim();
  const cleanUrl = String(actionUrl || '').replace(/^#\/?/, '/').trim();

  // 1. Direct structured route override
  if (normalizedRoute) {
    switch (normalizedRoute) {
      case 'VisitorManagement':
      case 'Visitor':
        return '/(resident)/visitor';
      case 'VisitorWalkIn':
        return '/(resident)/visitor/walk-ins';
      case 'VisitorPasses':
        return '/(resident)/visitor/resident-passes';
      case 'GateConsole':
        return '/(resident)/visitor/gate-console';
      case 'ComplaintDetails':
      case 'Complaints':
      case 'Complaint':
        return entityId
          ? `/(resident)/complaints/my-tickets?ticketId=${encodeURIComponent(entityId)}`
          : '/(resident)/complaints/my-tickets';
      case 'PaymentHistory':
      case 'Billing':
        return entityId
          ? `/(resident)/billing/invoice/${encodeURIComponent(entityId)}`
          : '/(resident)/billing/history';
      case 'Announcements':
      case 'Notices':
      case 'Notice':
        return entityId
          ? `/(resident)/notices/${encodeURIComponent(entityId)}`
          : '/(resident)/notices';
      case 'CommunityDirectory':
      case 'Messaging':
      case 'Directory':
        return entityId
          ? `/(resident)/directory/conversation/${encodeURIComponent(entityId)}`
          : '/(resident)/directory';
      case 'CommunityNotes':
      case 'Notes':
        return '/(resident)/notes';
      default:
        if (normalizedRoute.startsWith('/(') || normalizedRoute.startsWith('/')) {
          return normalizedRoute;
        }
    }
  }

  // 2. Exact actionUrl matching with entity extraction
  if (cleanUrl) {
    if (cleanUrl.includes('/directory/conversation/')) {
      const convId = cleanUrl.split('/directory/conversation/')[1]?.split(/[?#]/)[0];
      if (convId) return `/(resident)/directory/conversation/${convId}`;
      return '/(resident)/directory';
    }

    if (cleanUrl.includes('/invite/app/')) {
      const token = cleanUrl.split('/invite/app/')[1]?.split(/[?#]/)[0]?.replace(/\/$/, '');
      if (token) return `/(auth)/accept-invite?token=${token}`;
      return '/(auth)/accept-invite';
    }

    if (cleanUrl.includes('/invite/web/')) {
      const token = cleanUrl.split('/invite/web/')[1]?.split(/[?#]/)[0]?.replace(/\/$/, '');
      if (token) return `/(auth)/accept-invite?token=${token}`;
      return '/(auth)/accept-invite';
    }

    if (cleanUrl.includes('/invite/')) {
      const token = cleanUrl.split('/invite/')[1]?.split(/[?#]/)[0]?.replace(/\/$/, '');
      if (token) return `/(auth)/accept-invite?token=${token}`;
      return '/(auth)/accept-invite';
    }

    if (cleanUrl.includes('accept-invite')) {
      const tokenMatch = cleanUrl.match(/[?&]token=([^&#]+)/);
      return tokenMatch ? `/(auth)/accept-invite?token=${tokenMatch[1]}` : '/(auth)/accept-invite';
    }

    if (cleanUrl.includes('billing/invoice/')) {
      const invId = cleanUrl.split('billing/invoice/')[1]?.split(/[?#]/)[0]?.replace(/\/$/, '');
      if (invId) return `/(resident)/billing/invoice/${invId}`;
      return '/(resident)/billing';
    }

    if (cleanUrl.includes('billing/ledger')) {
      const query = cleanUrl.includes('?') ? '?' + cleanUrl.split('?')[1] : '';
      return `/(resident)/admin/billing/ledger${query}`;
    }

    if (cleanUrl.includes('billing/my-dues') || cleanUrl.includes('my-dues')) {
      return '/(resident)/billing/history';
    }

    if (cleanUrl.includes('billing')) {
      return '/(resident)/billing';
    }

    if (cleanUrl.includes('tab=walkin') || cleanUrl.includes('walk-in')) {
      return '/(resident)/visitor/walk-ins';
    }

    if (cleanUrl.includes('tab=live') || cleanUrl.includes('guard')) {
      return '/(resident)/visitor/gate-console';
    }

    if (cleanUrl.includes('tab=logs') || cleanUrl.includes('passes')) {
      return '/(resident)/visitor/resident-passes';
    }

    if (cleanUrl.includes('visitor-management') || cleanUrl.includes('/visitor')) {
      return '/(resident)/visitor';
    }

    if (cleanUrl.includes('resident/amenities/discover') || cleanUrl === '/amenities/discover') {
      return '/(resident)/amenities/discover';
    }

    // Amenity Management V2: a booking's detail, and the staff Booking Queue.
    if (cleanUrl.includes('amenities/reservations/')) {
      const resId = cleanUrl.split('amenities/reservations/')[1]?.split(/[?#/]/)[0];
      if (resId) return `/(resident)/amenities/reservations/${encodeURIComponent(resId)}`;
      return '/(resident)/amenities/my-bookings';
    }

    if (cleanUrl.includes('amenities/admin-bookings')) {
      return '/(resident)/amenities/admin-bookings';
    }

    // Older pass links carry a pass id, which has no screen of its own.
    if (cleanUrl.includes('amenities/passes')) {
      return '/(resident)/amenities/my-bookings';
    }

    if (cleanUrl.includes('amenities/booking/')) {
      const bkgId = cleanUrl.split('amenities/booking/')[1]?.split(/[?#]/)[0];
      if (bkgId) return `/(resident)/amenities/booking/${bkgId}`;
      return '/(resident)/amenities/my-bookings';
    }

    if (cleanUrl.includes('amenities/calendar') || cleanUrl.includes('my-bookings')) {
      return '/(resident)/amenities/my-bookings';
    }

    if (cleanUrl.includes('amenities/wallet') || cleanUrl.includes('wallet')) {
      return '/(resident)/amenities/wallet';
    }

    if (cleanUrl.includes('admin/complaints/issue-reports') || cleanUrl.includes('issue-reports')) {
      const reportIdMatch = cleanUrl.match(/[?&]reportId=([^&#]+)/);
      if (reportIdMatch && reportIdMatch[1]) {
        return `/(resident)/complaints/issue-reports?reportId=${reportIdMatch[1]}`;
      }
      return '/(resident)/complaints/issue-reports';
    }

    if (cleanUrl.includes('admin/complaints/assignee') || cleanUrl.includes('/assignee')) {
      const ticketIdMatch = cleanUrl.match(/[?&](?:ticketId|id|complaintNumber)=([^&#]+)/);
      const targetId = ticketIdMatch ? ticketIdMatch[1] : entityId;
      return targetId
        ? `/(resident)/complaints/assignee?ticketId=${encodeURIComponent(targetId)}`
        : '/(resident)/complaints/assignee';
    }

    if (cleanUrl.includes('complaints')) {
      return '/(resident)/complaints/my-tickets';
    }

    if (cleanUrl.includes('notices/polls') || cleanUrl.includes('polls')) {
      return '/(resident)/notices/polls';
    }

    if (cleanUrl.includes('notices/board') || cleanUrl.includes('notice-board') || cleanUrl.includes('notices')) {
      return '/(resident)/notices';
    }
  }

  // 3. Semantic Type + Entity ID matching
  switch (normalizedType) {
    case 'VISITOR_REQUEST':
      return '/(resident)/visitor/walk-ins';

    case 'VISITOR':
    case 'VISITOR_LOG':
    case 'VISITOR_CHECKED_IN':
    case 'VISITOR_CHECKED_OUT':
      return '/(resident)/visitor/resident-passes';

    case 'VISITOR_RESOLVED':
      return '/(resident)/visitor/gate-console';

    case 'COMPLAINT_ASSIGNED':
      return entityId
        ? `/(resident)/complaints/assignee?ticketId=${encodeURIComponent(entityId)}`
        : '/(resident)/complaints/assignee';

    case 'COMPLAINT':
    case 'COMPLAINT_UPDATED':
      return entityId
        ? `/(resident)/complaints/my-tickets?ticketId=${encodeURIComponent(entityId)}`
        : '/(resident)/complaints/my-tickets';

    case 'ISSUE_REPORT':
    case 'ISSUE_REPORT_SUBMITTED':
      return entityId
        ? `/(resident)/complaints/issue-reports?reportId=${encodeURIComponent(entityId)}`
        : '/(resident)/complaints/issue-reports';

    case 'MAINTENANCE_PAYMENT':
    case 'BILLING':
    case 'INVOICE':
    case 'FINANCIAL':
      return entityId
        ? `/(resident)/billing/invoice/${encodeURIComponent(entityId)}`
        : '/(resident)/billing/history';

    case 'AMENITY_BOOKING':
    case 'AMENITY':
      // The id is a booking: open its detail (the booking wizard takes a facility id).
      return entityId
        ? `/(resident)/amenities/reservations/${encodeURIComponent(entityId)}`
        : '/(resident)/amenities/my-bookings';

    case 'NOTICE':
    case 'ANNOUNCEMENT':
      return entityId
        ? `/(resident)/notices/${encodeURIComponent(entityId)}`
        : '/(resident)/notices';

    case 'POLL':
      return '/(resident)/notices/polls';

    case 'DIRECTORY_MESSAGE':
    case 'MESSAGE':
      return entityId
        ? `/(resident)/directory/conversation/${encodeURIComponent(entityId)}`
        : '/(resident)/directory';

    case 'COMMUNITY_NOTE':
      return '/(resident)/notes';

    case 'INVITATION': {
      const invId = payload.invitationId || entityId || payload.token;
      return invId
        ? `/(auth)/accept-invite?invitationId=${encodeURIComponent(invId)}`
        : '/(auth)/accept-invite';
    }

    default:
      // Fall back based on title/body keyword inspection
      const contentLower = `${title} ${body}`.toLowerCase();
      if (contentLower.includes('visitor') || contentLower.includes('gate approval')) {
        return '/(resident)/visitor';
      }
      if (contentLower.includes('bill') || contentLower.includes('invoice') || contentLower.includes('payment')) {
        return '/(resident)/billing';
      }
      if (contentLower.includes('complaint') || contentLower.includes('ticket')) {
        return '/(resident)/complaints/my-tickets';
      }
      if (contentLower.includes('notice') || contentLower.includes('announcement')) {
        return '/(resident)/notices';
      }
      if (contentLower.includes('message')) {
        return '/(resident)/directory';
      }
      return '/(resident)/notifications';
  }
};

/**
 * Backward compatibility wrapper matching previous function signature.
 */
export const mapActionUrlToMobileRoute = (
  actionUrl?: string,
  type?: string,
  notificationMeta?: any
): string => {
  return resolveNotificationRoute({
    actionUrl,
    type,
    title: notificationMeta?.title,
    body: notificationMeta?.body,
    ...notificationMeta,
  });
};

export default {
  resolveNotificationRoute,
  mapActionUrlToMobileRoute,
  isDuplicateNotification,
  resetDeduplicationTracker,
};

