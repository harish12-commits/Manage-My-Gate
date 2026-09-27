/**
 * Amenity Management — 3-Role Feature Access Test Suite
 * Validates role-specific feature exposure for Resident, Admin, and Guard
 * following the established Visitor Management reference pattern.
 */

import {
  ALL_AVAILABLE_FEATURES,
  isFeatureAllowedForUser as catalogIsFeatureAllowed,
} from '../../dashboard/dashboardCatalog';
import {
  isFeatureAllowedForUser,
  getDefaultQuickActionsForUser,
  checkIsAdmin,
  checkIsSecurityRole,
} from '../../../utils/rbac';

describe('Amenity Management — 3-Role Feature Access (Visitor Pattern Parity)', () => {
  // Feature Lookups
  const feat = (id: string) => ALL_AVAILABLE_FEATURES.find((f) => f.id === id)!;

  const residentFeatures = [
    feat('amenities_discover'),
    feat('amenities_my_booking'),
  ];

  const adminFeatures = [
    feat('amenities_master'),
    feat('amenities_admin_calendar'),
    feat('amenities_maintenance'),
    feat('amenities_dashboard'),
    feat('amenities_ledgers'),
  ];

  const guardFeatures = [
    feat('amenities_scanner'),
    feat('amenities_security_logs'),
  ];

  describe('1. Resident Role Access', () => {
    const residentUser = {
      role: 'Tenant/Owner',
      permissions: ['visitor:resident', 'amenities:discover', 'amenities:my_booking', 'amenities:wallet'],
    };

    it('identifies as non-admin and non-security', () => {
      expect(checkIsAdmin(residentUser)).toBe(false);
      expect(checkIsSecurityRole(residentUser)).toBe(false);
    });

    it('allows both Resident Amenity features and confirms single wallet cutover', () => {
      expect(isFeatureAllowedForUser(feat('amenities_discover'), residentUser)).toBe(true);
      expect(isFeatureAllowedForUser(feat('amenities_my_booking'), residentUser)).toBe(true);
      expect(ALL_AVAILABLE_FEATURES.find((f) => f.id === 'amenities_wallet')).toBeUndefined();
    });

    it('strictly denies all 6 Admin Amenity features to Resident', () => {
      adminFeatures.forEach((item) => {
        expect(isFeatureAllowedForUser(item, residentUser)).toBe(false);
      });
    });

    it('strictly denies Guard Amenity features to Resident', () => {
      guardFeatures.forEach((item) => {
        expect(isFeatureAllowedForUser(item, residentUser)).toBe(false);
      });
    });

    it('provides Resident quick actions matching Visitor pattern', () => {
      const quickActions = getDefaultQuickActionsForUser(residentUser);
      expect(quickActions).toContain('amenities_discover');
      expect(quickActions).toContain('visitor_resident_passes');
      expect(quickActions).not.toContain('amenities_scanner');
      expect(quickActions).not.toContain('visitor_gate_console');
    });
  });

  describe('2. Guard Role Access', () => {
    const guardUser = {
      role: 'Security',
      permissions: ['visitor:guard', 'visitor:admin', 'amenities:scanner', 'amenities:security_logs'],
    };

    it('identifies as security role and non-admin', () => {
      expect(checkIsSecurityRole(guardUser)).toBe(true);
      expect(checkIsAdmin(guardUser)).toBe(false);
    });

    it('allows Guard Amenity features (Scanner & Security Logs)', () => {
      expect(isFeatureAllowedForUser(feat('amenities_scanner'), guardUser)).toBe(true);
      expect(isFeatureAllowedForUser(feat('amenities_security_logs'), guardUser)).toBe(true);
    });

    it('strictly denies Resident Amenity features to Guard', () => {
      residentFeatures.forEach((item) => {
        expect(isFeatureAllowedForUser(item, guardUser)).toBe(false);
      });
    });

    it('strictly denies Admin Amenity features to Guard', () => {
      adminFeatures.forEach((item) => {
        expect(isFeatureAllowedForUser(item, guardUser)).toBe(false);
      });
    });

    it('provides Guard quick actions matching Visitor pattern', () => {
      const quickActions = getDefaultQuickActionsForUser(guardUser);
      expect(quickActions).toContain('amenities_scanner');
      expect(quickActions).toContain('amenities_security_logs');
      expect(quickActions).toContain('visitor_gate_console');
      expect(quickActions).not.toContain('amenities_discover');
      expect(quickActions).not.toContain('visitor_resident_passes');
    });
  });

  describe('3. Admin Role Access', () => {
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

    it('identifies as admin role', () => {
      expect(checkIsAdmin(adminUser)).toBe(true);
    });

    it('allows Admin Amenity features', () => {
      adminFeatures.forEach((item) => {
        expect(isFeatureAllowedForUser(item, adminUser)).toBe(true);
      });
    });

    it('allows Super Admin full access to platform', () => {
      const superAdminUser = {
        role: 'Super Admin',
        isPlatform: true,
        permissions: ['platform:super_admin'],
      };
      expect(checkIsAdmin(superAdminUser)).toBe(true);
      expect(isFeatureAllowedForUser(feat('amenities_dashboard'), superAdminUser)).toBe(true);
      expect(isFeatureAllowedForUser(feat('amenities_discover'), superAdminUser)).toBe(true);
      expect(isFeatureAllowedForUser(feat('amenities_scanner'), superAdminUser)).toBe(true);
    });
  });

  describe('4. Catalog Fallback Evaluation (catalogIsFeatureAllowed)', () => {
    it('evaluates resident fallback correctly for resident personas', () => {
      const residentUser = { role: 'resident' };
      expect(catalogIsFeatureAllowed(feat('amenities_discover'), residentUser)).toBe(true);
      expect(catalogIsFeatureAllowed(feat('amenities_my_booking'), residentUser)).toBe(true);
      expect(ALL_AVAILABLE_FEATURES.find((f) => f.id === 'amenities_wallet')).toBeUndefined();
      expect(catalogIsFeatureAllowed(feat('amenities_scanner'), residentUser)).toBe(false);
      expect(catalogIsFeatureAllowed(feat('amenities_dashboard'), residentUser)).toBe(false);
    });

    it('evaluates guard fallback correctly for guard personas', () => {
      const guardUser = { role: 'guard' };
      expect(catalogIsFeatureAllowed(feat('amenities_scanner'), guardUser)).toBe(true);
      expect(catalogIsFeatureAllowed(feat('amenities_security_logs'), guardUser)).toBe(true);
      expect(catalogIsFeatureAllowed(feat('visitor_gate_console'), guardUser)).toBe(true);
      expect(catalogIsFeatureAllowed(feat('amenities_discover'), guardUser)).toBe(false);
      expect(catalogIsFeatureAllowed(feat('amenities_dashboard'), guardUser)).toBe(false);
    });
  });

  describe('5. None Role Preset Access (Zero Amenities Permissions)', () => {
    const noneUser = {
      role: 'Staff/Other',
      permissions: ['visitor:resident'],
    };

    it('strictly denies all Resident Amenity features', () => {
      residentFeatures.forEach((item) => {
        expect(isFeatureAllowedForUser(item, noneUser)).toBe(false);
      });
    });

    it('strictly denies all Guard Amenity features', () => {
      guardFeatures.forEach((item) => {
        expect(isFeatureAllowedForUser(item, noneUser)).toBe(false);
      });
    });

    it('strictly denies all Admin Amenity features', () => {
      adminFeatures.forEach((item) => {
        expect(isFeatureAllowedForUser(item, noneUser)).toBe(false);
      });
    });

    it('filters out any amenity quick actions for None user', () => {
      const allowedAmenityActions = ALL_AVAILABLE_FEATURES
        .filter((item) => item.categoryKey === 'amenities_facilities')
        .filter((item) => isFeatureAllowedForUser(item, noneUser));
      expect(allowedAmenityActions).toHaveLength(0);
    });
  });
});
