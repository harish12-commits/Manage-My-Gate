import {
  resolveNotificationRoute,
  mapActionUrlToMobileRoute,
  isDuplicateNotification,
  resetDeduplicationTracker,
} from '../utils/notificationNavigation';

describe('Notification Deep-Linking & Route Resolution', () => {
  beforeEach(() => {
    resetDeduplicationTracker();
  });

  describe('Structured Payload Routing', () => {
    it('routes VISITOR_REQUEST to walk-in approvals screen', () => {
      const payload = {
        notificationId: 'notif-1',
        type: 'VISITOR_REQUEST',
        title: 'Gate Approval Required',
        body: 'Visitor John is at the gate',
      };
      expect(resolveNotificationRoute(payload)).toBe('/(resident)/visitor/walk-ins');
    });

    it('routes VISITOR and VISITOR_LOG to resident passes screen', () => {
      const payload = {
        notificationId: 'notif-2',
        type: 'VISITOR',
        title: 'Visitor Checked In',
      };
      expect(resolveNotificationRoute(payload)).toBe('/(resident)/visitor/resident-passes');
    });

    it('routes COMPLAINT with entityId to tickets screen with query param', () => {
      const payload = {
        notificationId: 'notif-3',
        type: 'COMPLAINT',
        entityId: 'CMP-1002',
        title: 'Complaint Assigned',
      };
      expect(resolveNotificationRoute(payload)).toBe('/(resident)/complaints/my-tickets?ticketId=CMP-1002');
    });

    it('routes COMPLAINT without entityId safely to complaints list', () => {
      const payload = {
        notificationId: 'notif-4',
        type: 'COMPLAINT',
        title: 'Complaint Update',
      };
      expect(resolveNotificationRoute(payload)).toBe('/(resident)/complaints/my-tickets');
    });

    it('routes BILLING with entityId to specific invoice screen', () => {
      const payload = {
        notificationId: 'notif-5',
        type: 'BILLING',
        entityId: 'inv-9876',
        title: 'New Bill Generated',
      };
      expect(resolveNotificationRoute(payload)).toBe('/(resident)/billing/invoice/inv-9876');
    });

    it('routes BILLING without entityId to billing history', () => {
      const payload = {
        notificationId: 'notif-6',
        type: 'BILLING',
        title: 'Payment Received',
      };
      expect(resolveNotificationRoute(payload)).toBe('/(resident)/billing/history');
    });

    it('routes AMENITY_BOOKING with entityId to booking detail', () => {
      const payload = {
        notificationId: 'notif-7',
        type: 'AMENITY_BOOKING',
        entityId: 'bkg-55',
        title: 'Booking Confirmed',
      };
      expect(resolveNotificationRoute(payload)).toBe('/(resident)/amenities/reservations/bkg-55');
    });

    it('routes NOTICE with entityId to notice detail', () => {
      const payload = {
        notificationId: 'notif-8',
        type: 'NOTICE',
        entityId: 'not-441',
        title: 'Community Announcement',
      };
      expect(resolveNotificationRoute(payload)).toBe('/(resident)/notices/not-441');
    });

    it('routes POLL to polls screen', () => {
      const payload = {
        notificationId: 'notif-9',
        type: 'POLL',
        title: 'New Community Poll',
      };
      expect(resolveNotificationRoute(payload)).toBe('/(resident)/notices/polls');
    });

    it('routes DIRECTORY_MESSAGE with conversation ID', () => {
      const payload = {
        notificationId: 'notif-10',
        type: 'DIRECTORY_MESSAGE',
        entityId: 'conv-abc-123',
        title: 'New message from Alice',
      };
      expect(resolveNotificationRoute(payload)).toBe('/(resident)/directory/conversation/conv-abc-123');
    });

    it('routes INVITATION with invitationId or entityId to accept invite route', () => {
      const payloadWithInvId = {
        notificationId: 'notif-11a',
        type: 'INVITATION',
        invitationId: '650f1a90c1234567890abcde',
        title: 'Invitation to Green Meadows',
      };
      expect(resolveNotificationRoute(payloadWithInvId)).toBe('/(auth)/accept-invite?invitationId=650f1a90c1234567890abcde');

      const payloadWithEntityId = {
        notificationId: 'notif-11b',
        type: 'INVITATION',
        entityId: 'inv-entity-7788',
        title: 'Invitation to Green Meadows',
      };
      expect(resolveNotificationRoute(payloadWithEntityId)).toBe('/(auth)/accept-invite?invitationId=inv-entity-7788');
    });
  });

  describe('Explicit Route Overrides', () => {
    it('honors route: "VisitorManagement"', () => {
      expect(resolveNotificationRoute({ route: 'VisitorManagement' })).toBe('/(resident)/visitor');
    });

    it('honors route: "ComplaintDetails" with entityId', () => {
      expect(resolveNotificationRoute({ route: 'ComplaintDetails', entityId: 'TK-12' })).toBe(
        '/(resident)/complaints/my-tickets?ticketId=TK-12'
      );
    });

    it('honors route: "PaymentHistory"', () => {
      expect(resolveNotificationRoute({ route: 'PaymentHistory' })).toBe('/(resident)/billing/history');
    });
  });

  describe('Web Action URL Mapping & Hash Compatibility', () => {
    it('maps hash URLs to mobile routes', () => {
      expect(
        mapActionUrlToMobileRoute('#/visitor-management?tab=walkin')
      ).toBe('/(resident)/visitor/walk-ins');
    });

    it('extracts conversation ID from directory URL', () => {
      expect(
        mapActionUrlToMobileRoute('/directory/conversation/conv-8899?focus=true')
      ).toBe('/(resident)/directory/conversation/conv-8899');
    });

    it('extracts invoice ID from billing URL', () => {
      expect(
        mapActionUrlToMobileRoute('/billing/invoice/inv-443322')
      ).toBe('/(resident)/billing/invoice/inv-443322');
    });
  });

  describe('Deduplication Prevention', () => {
    it('identifies duplicate taps within 3 seconds', () => {
      expect(isDuplicateNotification('notif-unique-1')).toBe(false);
      // Immediately subsequent call with same ID is duplicate
      expect(isDuplicateNotification('notif-unique-1')).toBe(true);
      // Different ID is not duplicate
      expect(isDuplicateNotification('notif-unique-2')).toBe(false);
    });
  });

  describe('Fallback Handling', () => {
    it('returns notifications screen when payload is null or empty', () => {
      expect(resolveNotificationRoute(null)).toBe('/(resident)/notifications');
      expect(resolveNotificationRoute({})).toBe('/(resident)/notifications');
    });

    it('falls back to keyword content inspection if type is unrecognized', () => {
      expect(
        resolveNotificationRoute({ title: 'Important Bill due', body: 'Please check your dues' })
      ).toBe('/(resident)/billing');
    });
  });
});
