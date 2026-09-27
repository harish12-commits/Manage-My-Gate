/**
 * Amenity v2 — Frontend Quick Action Go-Live Cutover Test Suite
 *
 * Verifies:
 * 1. Resident Quick Actions contain exactly one Amenity action: amenities_discover
 * 2. amenities_discover routes directly to /(resident)/amenities/discover
 * 3. No duplicate or legacy Amenity actions exist in Resident Quick Actions
 * 4. Role-based isolation holds (Resident vs Guard vs Admin)
 * 5. All resident amenity features point to valid v2 resident routes
 */

import {
  ALL_AVAILABLE_FEATURES,
  DEFAULT_5_QUICK_ACTIONS,
  ROLE_DEFAULT_QUICK_ACTIONS,
  getRoleDefaultQuickActions,
  isFeatureAllowedForUser as catalogIsFeatureAllowed,
} from '../../dashboard/dashboardCatalog';
import {
  getDefaultQuickActionsForUser,
  isFeatureAllowedForUser,
  checkIsAdmin,
  checkIsSecurityRole,
} from '../../../utils/rbac';

describe('Amenity v2 — Frontend Quick Action Go-Live Cutover', () => {
  const residentUser = {
    role: 'Tenant/Owner',
    permissions: ['visitor:resident', 'amenities:discover', 'amenities:my_booking', 'amenities:wallet'],
  };

  const guardUser = {
    role: 'Security',
    permissions: ['visitor:guard', 'visitor:admin', 'amenities:scanner', 'amenities:security_logs'],
  };

  const adminUser = {
    role: 'Admin',
    permissions: [
      'visitor:admin',
      'amenities:amenities',
      'amenities:admin_calander',
      'amenities:maintenance',
      'amenities:settings',
      'amenities:dashboard',
      'amenities:ledgers',
    ],
  };

  describe('1. Quick Action Catalog Configuration', () => {
    it('defines amenities_discover with the exact v2 target route', () => {
      const discoverFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'amenities_discover');
      expect(discoverFeature).toBeDefined();
      expect(discoverFeature?.route).toBe('/(resident)/amenities/discover');
      expect(discoverFeature?.permission).toBe('amenities:discover');
      expect(discoverFeature?.name).toBe('Discover Amenities');
    });

    it('contains no legacy resident amenity routes in the feature catalog', () => {
      const legacyCalendar = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'amenities_calendar');
      expect(legacyCalendar).toBeUndefined();

      const residentAmenityFeatures = ALL_AVAILABLE_FEATURES.filter((f) =>
        isFeatureAllowedForUser(f, residentUser) && f.categoryKey === 'amenities_facilities'
      );

      // Resident must only have discover and my_booking under amenities (wallet is consolidated in billing)
      expect(residentAmenityFeatures.map((f) => f.id)).toEqual([
        'amenities_discover',
        'amenities_my_booking',
      ]);
      expect(ALL_AVAILABLE_FEATURES.find((f) => f.id === 'amenities_wallet')).toBeUndefined();

      // None of the resident amenity features should point to the old dashboard
      residentAmenityFeatures.forEach((f) => {
        expect(f.route).not.toBe('/(resident)/amenities/dashboard');
        expect(f.route).toMatch(/^\/\(resident\)\/amenities\//);
      });
    });
  });

  describe('2. Resident Default Quick Actions', () => {
    it('includes amenities_discover as the sole Amenity action in default quick actions', () => {
      const residentDefaults = getDefaultQuickActionsForUser(residentUser);

      expect(residentDefaults).toContain('amenities_discover');

      // Filter all amenity-related action IDs
      const amenityActions = residentDefaults.filter((id) => id.startsWith('amenities_'));
      expect(amenityActions).toEqual(['amenities_discover']);
      expect(amenityActions).toHaveLength(1);
    });

    it('does not contain any legacy or duplicate amenity actions in resident defaults', () => {
      const residentDefaults = getDefaultQuickActionsForUser(residentUser);

      expect(residentDefaults).not.toContain('amenities_dashboard');
      expect(residentDefaults).not.toContain('amenities_calendar');
      expect(residentDefaults).not.toContain('amenities_scanner');
      expect(residentDefaults).not.toContain('amenities_master');
    });

    it('matches DEFAULT_5_QUICK_ACTIONS in dashboardCatalog', () => {
      expect(DEFAULT_5_QUICK_ACTIONS).toContain('amenities_discover');
      const amenityDefaults = DEFAULT_5_QUICK_ACTIONS.filter((id) => id.startsWith('amenities_'));
      expect(amenityDefaults).toEqual(['amenities_discover']);
    });
  });

  describe('3. Role Access Isolation (Resident vs Guard vs Admin)', () => {
    it('prohibits amenities_discover from Guard default quick actions', () => {
      const guardDefaults = getDefaultQuickActionsForUser(guardUser);
      expect(guardDefaults).not.toContain('amenities_discover');
      expect(guardDefaults).toContain('amenities_scanner');
      expect(guardDefaults).toContain('amenities_security_logs');
    });

    it('prohibits amenities_discover from Admin default quick actions', () => {
      const adminDefaults = ROLE_DEFAULT_QUICK_ACTIONS.admin;
      expect(adminDefaults).not.toContain('amenities_discover');
      expect(adminDefaults).toContain('amenities_dashboard');
    });

    it('denies Guard access to amenities_discover', () => {
      const discoverFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'amenities_discover')!;
      expect(isFeatureAllowedForUser(discoverFeature, guardUser)).toBe(false);
      expect(catalogIsFeatureAllowed(discoverFeature, guardUser)).toBe(false);
    });

    it('denies Resident access to Guard scanner and Admin dashboard', () => {
      const scannerFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'amenities_scanner')!;
      const dashboardFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'amenities_dashboard')!;

      expect(isFeatureAllowedForUser(scannerFeature, residentUser)).toBe(false);
      expect(isFeatureAllowedForUser(dashboardFeature, residentUser)).toBe(false);

      expect(catalogIsFeatureAllowed(scannerFeature, residentUser)).toBe(false);
      expect(catalogIsFeatureAllowed(dashboardFeature, residentUser)).toBe(false);
    });
  });

  describe('4. getRoleDefaultQuickActions Helper', () => {
    it('returns resident quick actions containing amenities_discover for resident personas', () => {
      const actions = getRoleDefaultQuickActions({ role: 'Resident' });
      expect(actions).toContain('amenities_discover');
      expect(actions.filter((id) => id.startsWith('amenities_'))).toEqual(['amenities_discover']);
    });

    it('returns guard quick actions containing amenities_scanner for guard personas', () => {
      const actions = getRoleDefaultQuickActions({ role: 'Security Guard' });
      expect(actions).toContain('amenities_scanner');
      expect(actions).not.toContain('amenities_discover');
    });

    it('returns admin quick actions containing amenities_dashboard for admin personas', () => {
      const actions = getRoleDefaultQuickActions({ role: 'Community Admin' });
      expect(actions).toContain('amenities_dashboard');
      expect(actions).not.toContain('amenities_discover');
    });
  });

  describe('5. Comprehensive Navigation Convergence & Role Isolation', () => {
    const noneUser = {
      role: 'Tenant/Owner',
      permissions: ['notices:read'],
    };

    it('asserts Resident navigation strictly targets /(resident)/amenities/discover and never legacy dashboard', () => {
      const discoverFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'amenities_discover')!;
      expect(discoverFeature.route).toBe('/(resident)/amenities/discover');
      expect(discoverFeature.route).not.toBe('/(resident)/amenities/dashboard');

      const residentPermitted = ALL_AVAILABLE_FEATURES.filter((f) =>
        f.id.startsWith('amenities_') && isFeatureAllowedForUser(f, residentUser)
      );
      residentPermitted.forEach((f) => {
        expect(f.route).not.toBe('/(resident)/amenities/dashboard');
      });
    });

    it('asserts Guard navigation strictly targets scanner and security logs', () => {
      const guardPermitted = ALL_AVAILABLE_FEATURES.filter((f) =>
        f.id.startsWith('amenities_') && isFeatureAllowedForUser(f, guardUser)
      );
      expect(guardPermitted.map((f) => f.id).sort()).toEqual(['amenities_scanner', 'amenities_security_logs'].sort());
      expect(guardPermitted.find((f) => f.id === 'amenities_scanner')?.route).toBe('/(resident)/amenities/scanner');
      expect(guardPermitted.find((f) => f.id === 'amenities_security_logs')?.route).toBe('/(resident)/amenities/security-logs');
    });

    it('asserts None persona has zero permitted amenity features', () => {
      const nonePermitted = ALL_AVAILABLE_FEATURES.filter((f) =>
        f.id.startsWith('amenities_') && isFeatureAllowedForUser(f, noneUser)
      );
      expect(nonePermitted).toHaveLength(0);
    });

    it('verifies all 5 default quick actions have valid defined routes', () => {
      DEFAULT_5_QUICK_ACTIONS.forEach((actionId) => {
        const feature = ALL_AVAILABLE_FEATURES.find((f) => f.id === actionId);
        expect(feature).toBeDefined();
        expect(feature?.route).toBeDefined();
        expect(typeof feature?.route).toBe('string');
        expect(feature?.route?.length).toBeGreaterThan(0);
      });
    });

    it('verifies Complaints and Notices features now possess valid routes', () => {
      const complaintsTrack = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'complaints_track_requests');
      expect(complaintsTrack?.route).toBe('/(resident)/complaints/my-tickets');

      const complaintsRaise = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'complaints_raise_ticket');
      expect(complaintsRaise?.route).toBe('/(resident)/complaints/raise-ticket');

      const communityEngagement = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'community_engagement');
      expect(communityEngagement?.route).toBe('/(resident)/community-engagement');
    });
  });
});
