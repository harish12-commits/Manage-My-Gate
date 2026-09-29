import React, { useMemo, useState, useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '../ui/text';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { MapPin } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useAuth } from '../../src/features/auth/hooks/useAuth';
import { getUserRoleName } from '../../src/utils/rbac';
import { useTranslation } from '../../src/utils/i18n';
import { VillaSwitchModal } from '../navigation/VillaSwitchModal';
import { AssignmentSwitchModal } from '../navigation/AssignmentSwitchModal';

export interface RoleBasedGreetingProps {
  unitName?: string | null;
  communityName?: string;
  customRoleName?: string;
}

/**
 * Animated hand emoji that waves repeatedly when user arrives on the dashboard
 */
const WavingHand: React.FC = () => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(18, { duration: 170, easing: Easing.inOut(Easing.quad) }),
        withTiming(-14, { duration: 170, easing: Easing.inOut(Easing.quad) }),
        withTiming(18, { duration: 170, easing: Easing.inOut(Easing.quad) }),
        withTiming(-10, { duration: 170, easing: Easing.inOut(Easing.quad) }),
        withTiming(14, { duration: 170, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 220, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1200 }) // pause before next waving cycle
      ),
      -1,
      false
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle} className="items-center justify-center">
      <Text className="text-[18px] leading-none">{'\uD83D\uDC4B'}</Text>
    </Animated.View>
  );
};

/**
 * Returns appropriate time-of-day greeting
 * 05:00 - 11:59 => Good morning
 * 12:00 - 16:59 => Good afternoon
 * 17:00 - 04:59 => Good evening
 */
export const getTimeOfDayGreeting = (): { key: string; defaultText: string } => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { key: 'good_morning', defaultText: 'Good morning' };
  }
  if (hour >= 12 && hour < 17) {
    return { key: 'good_afternoon', defaultText: 'Good afternoon' };
  }
  return { key: 'good_evening', defaultText: 'Good evening' };
};

/**
 * Formats user role into clean display label
 */
export const formatRoleDisplay = (rawRole: string): string => {
  if (!rawRole) return 'Resident';
  const roleLower = rawRole.toLowerCase().trim();

  if (roleLower.includes('super admin') || roleLower.includes('superadmin')) {
    return 'Super Admin';
  }
  if (roleLower.includes('admin') || roleLower.includes('community admin')) {
    return 'Admin';
  }
  if (roleLower.includes('guard') || roleLower.includes('security')) {
    return 'Security';
  }
  if (roleLower.includes('manager') || roleLower.includes('community manager')) {
    return 'Community Manager';
  }
  if (roleLower.includes('facility')) {
    return 'Facility Manager';
  }
  if (roleLower.includes('staff') || roleLower.includes('accountant') || roleLower.includes('treasury')) {
    return 'Staff';
  }
  if (roleLower.includes('owner')) {
    return 'Owner';
  }
  if (roleLower.includes('tenant')) {
    return 'Resident';
  }

  // Capitalize words
  return rawRole
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Resolves the personal display name of the user for greeting.
 * Strictly avoids showing generic role labels like "Admin", "Resident", or "Security".
 */
export const getUserDisplayName = (user: any): string => {
  if (!user) return 'Neighbor';

  const nameCandidate =
    user.name ||
    user.fullName ||
    user.displayName ||
    user.username ||
    user.firstName;

  if (typeof nameCandidate === 'string' && nameCandidate.trim() !== '') {
    const trimmed = nameCandidate.trim();
    // Return first name or single-word name
    const firstName = trimmed.split(' ')[0];
    return firstName || trimmed;
  }

  // Derive from email if name is not set
  if (user.email && typeof user.email === 'string') {
    const emailPrefix = user.email.split('@')[0];
    if (emailPrefix) {
      return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    }
  }

  return 'Neighbor';
};

/**
 * Extracts and formats the dynamic unit / villa / house number from user session.
 */
export const formatUnitLocation = (user: any, propUnitName?: string | null): string | null => {
  if (propUnitName && typeof propUnitName === 'string' && propUnitName.trim() !== '') {
    const pTrim = propUnitName.trim();
    const hasPrefix = /^(villa|unit|flat|apt|apartment|tower|block|gate|house|#)/i.test(pTrim);
    if (hasPrefix) return pTrim;
    return `Villa ${pTrim}`;
  }

  // Safe string extractor
  const extractUnitStr = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === 'string') {
      const s = val.trim();
      if (/^[0-9a-fA-F]{24}$/.test(s)) return null; // Ignore raw Mongo ObjectIds
      if (/^(n\/a|none|undefined|null|\[object object\])$/i.test(s)) return null;
      return s;
    }
    if (typeof val === 'number') {
      return String(val);
    }
    if (typeof val === 'object') {
      return (
        extractUnitStr(val.unitNumber) ||
        extractUnitStr(val.villaNumber) ||
        extractUnitStr(val.houseNumber) ||
        extractUnitStr(val.name) ||
        extractUnitStr(val.villaName) ||
        null
      );
    }
    return null;
  };

  const formatUnitDisplay = (unitStr: string, block?: string): string => {
    const hasPrefix = /^(villa|unit|flat|apt|apartment|tower|block|house|#)/i.test(unitStr);
    if (hasPrefix) {
      if (block && !unitStr.toLowerCase().includes(String(block).toLowerCase())) {
        return `${block} • ${unitStr}`;
      }
      return unitStr;
    }
    if (block) {
      return `${block} - #${unitStr}`;
    }
    return `Villa ${unitStr}`;
  };

  if (user) {
    const roleLower = (user.role || (Array.isArray(user.roles) ? user.roles[0] : '') || '').toLowerCase();
    const isResident = /resident|tenant|owner|family/i.test(roleLower);
    const isSecurity = /guard|security/i.test(roleLower);
    const isFacility = /facility|amenity|staff|maintenance/i.test(roleLower);

    // 1. Security / Guard persona check (only if gate is explicitly assigned)
    if (isSecurity) {
      if (user.activeAssignment && user.activeAssignment.type === 'gate' && user.activeAssignment.name) {
        return user.activeAssignment.name.trim();
      }
      const gateVal = user.gate || user.assignedGate || user.gateName;
      if (gateVal && typeof gateVal === 'string' && gateVal.trim() !== '') {
        return gateVal.trim();
      }
      return null;
    }

    // 2. Facility Staff persona check (only if facility is explicitly assigned)
    if (isFacility) {
      if (user.activeAssignment && user.activeAssignment.type === 'facility' && user.activeAssignment.name) {
        return user.activeAssignment.name.trim();
      }
      const facVal = user.assignedFacility || user.facilityName;
      if (facVal && typeof facVal === 'string' && facVal.trim() !== '') {
        return facVal.trim();
      }
      return null;
    }

    // 3. Resident persona check (strictly only for resident roles)
    if (isResident) {
      if (user.activeAssignment && user.activeAssignment.type === 'villa' && user.activeAssignment.name) {
        return user.activeAssignment.name.trim();
      }

      const blockOrTower = user.block || user.blockOrBuilding || user.tower || user.building || user.villaBlock;
      const directCandidates = [
        user.villaNumber,
        user.activeVillaNumber,
        user.unitNumber,
        user.activeUnitNumber,
        user.houseNumber,
        user.activeHouseNumber,
        user.house,
        user.doorNumber,
        user.unitName,
        user.villaName,
      ];

      for (const c of directCandidates) {
        const parsed = extractUnitStr(c);
        if (parsed) {
          return formatUnitDisplay(parsed, blockOrTower);
        }
      }

      if (Array.isArray(user.accessibleUnits) && user.accessibleUnits.length > 0) {
        for (const u of user.accessibleUnits) {
          const parsed =
            extractUnitStr(u.villaNumber) ||
            extractUnitStr(u.unitNumber) ||
            extractUnitStr(u.houseNumber) ||
            extractUnitStr(u.name);
          if (parsed) {
            return formatUnitDisplay(parsed, u.block || u.villaBlock || blockOrTower);
          }
        }
      }
    }
  }

  // Non-resident personas (e.g. Community, Admin) or unassigned accounts have no unit location pill
  return null;
};

export const RoleBasedGreeting: React.FC<RoleBasedGreetingProps> = ({
  unitName,
}) => {
  const { user } = useAuth();
  const { t, translateText, language } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [villaModalVisible, setVillaModalVisible] = React.useState(false);
  const [assignmentModalVisible, setAssignmentModalVisible] = React.useState(false);

  // 1. Time of day calculation
  const timeGreeting = React.useMemo(() => getTimeOfDayGreeting(), [language]);

  // 2. Resolve personal display name (strictly the user's name, not role string)
  const displayName = React.useMemo(() => {
    return getUserDisplayName(user);
  }, [user]);

  // 3. Dynamic unit / location pill: always accurately resolved and localized
  const dynamicLocation = React.useMemo(() => {
    return formatUnitLocation(user, unitName);
  }, [unitName, user]);

  const localizedLocation = React.useMemo(() => {
    return dynamicLocation ? translateText(dynamicLocation) : null;
  }, [dynamicLocation, translateText, language]);

  const roleLower = React.useMemo(() => {
    return ((user?.role || (Array.isArray(user?.roles) ? user?.roles[0] : '') || '') as string).toLowerCase();
  }, [user]);

  const isResident = React.useMemo(() => /resident|tenant|owner|family/i.test(roleLower), [roleLower]);
  const isSecurity = React.useMemo(() => /guard|security/i.test(roleLower), [roleLower]);
  const isFacility = React.useMemo(() => /facility|amenity|staff|maintenance/i.test(roleLower), [roleLower]);

  const userUnits = React.useMemo(() => {
    if (!isResident) return [];
    const unitsMap = new Map<string, any>();
    const userAny = user as any;
    const activeOrgId = userAny?.orgId || userAny?.activeOrgId;

    if (Array.isArray(userAny?.accessibleUnits)) {
      userAny.accessibleUnits.forEach((u: any, idx: number) => {
        const uOrg = u.orgId || u.organizationId;
        if (activeOrgId && uOrg && uOrg !== activeOrgId) return;
        const uId = u.villaId || u.id || String(idx + 1);
        const uNum = u.villaNumber || u.unitNumber;
        if (uNum) unitsMap.set(uId, u);
      });
    }

    const workspaces = userAny?.availableWorkspaces;
    if (Array.isArray(workspaces)) {
      workspaces.forEach((w: any, idx: number) => {
        const matchesOrg = !activeOrgId || w.orgId === activeOrgId || w._id === activeOrgId;
        const wsHasResident =
          (w.roles && Array.isArray(w.roles) && w.roles.some((r: string) => /resident|tenant|owner|family/i.test(r))) ||
          /resident|tenant|owner|family/i.test(w.roleName || '');
        if (matchesOrg && wsHasResident && (w.villaId || w.unitId || w.villaNumber || w.unitNumber)) {
          const uId = w.villaId || w.unitId || `ws-unit-${idx}`;
          if (!unitsMap.has(uId)) unitsMap.set(uId, w);
        }
      });
    }

    return Array.from(unitsMap.values());
  }, [isResident, user]);

  const availAssignments = React.useMemo(() => {
    return (isSecurity || isFacility) && Array.isArray((user as any)?.availableAssignments)
      ? (user as any).availableAssignments
      : [];
  }, [isSecurity, isFacility, user]);

  const canSwitchUnit = isResident && (userUnits.length > 1 || (userUnits.length > 0 && Boolean(dynamicLocation)));
  const canSwitchAssignment = (isSecurity || isFacility) && availAssignments.length > 1;
  const canPressPill = canSwitchAssignment || canSwitchUnit;

  const handlePillPress = () => {
    if (!canPressPill) return;
    if (canSwitchAssignment) {
      setAssignmentModalVisible(true);
    } else if (canSwitchUnit) {
      setVillaModalVisible(true);
    }
  };

  return (
    <>
      <View className="flex-row items-center justify-between pt-1 pb-2.5 px-1">
        {/* Left: Salutation & Subtitle */}
        <View className="flex-1 pr-2">
          <View className="flex-row items-center flex-wrap gap-1.5">
            <Text className="text-[21px] font-bold font-sans text-foreground tracking-tight leading-snug">
              {t(timeGreeting.key, timeGreeting.defaultText)}, {displayName}
            </Text>
            <WavingHand />
          </View>
          <Text className="text-[13px] font-medium font-sans text-muted-foreground mt-0.5 tracking-tight">
            {t('welcome_back_sub', 'Welcome back to your community hub')}
          </Text>
        </View>

        {/* Right: Location / Villa Badge Pill adopting Navy Blue UI color with location symbol */}
        {localizedLocation ? (
          canPressPill ? (
            <TouchableOpacity
              onPress={handlePillPress}
              activeOpacity={0.75}
              style={{
                backgroundColor: isDark ? 'rgba(30, 58, 138, 0.25)' : 'rgba(23, 43, 112, 0.08)',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(23, 43, 112, 0.25)',
              }}
              className="flex-row min-h-11 items-center gap-1.5 border px-3.5 py-1.5 rounded-full shadow-2xs shrink-0"
              accessibilityRole="button"
              accessibilityLabel={`Current location: ${localizedLocation}. Tap to switch.`}
            >
              <MapPin size={13} color={isDark ? '#93C5FD' : '#172B70'} strokeWidth={2.4} />
              <Text className="text-[12px] font-bold font-sans text-[#172B70] dark:text-[#93C5FD]">
                {localizedLocation}
              </Text>
            </TouchableOpacity>
          ) : (
            <View
              style={{
                backgroundColor: isDark ? 'rgba(30, 58, 138, 0.25)' : 'rgba(23, 43, 112, 0.08)',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(23, 43, 112, 0.25)',
              }}
              className="flex-row items-center gap-1.5 border px-3.5 py-1.5 rounded-full shadow-2xs shrink-0"
              accessibilityLabel={`Current location: ${localizedLocation}`}
            >
              <MapPin size={13} color={isDark ? '#93C5FD' : '#172B70'} strokeWidth={2.4} />
              <Text className="text-[12px] font-bold font-sans text-[#172B70] dark:text-[#93C5FD]">
                {localizedLocation}
              </Text>
            </View>
          )
        ) : null}
      </View>

      {/* Villa / Unit Switch Modal */}
      {villaModalVisible && (
        <VillaSwitchModal
          visible={villaModalVisible}
          onClose={() => setVillaModalVisible(false)}
          activeVilla={dynamicLocation || ''}
          onSelectVilla={(_v) => setVillaModalVisible(false)}
        />
      )}

      {/* Assignment / Gate / Facility Switch Modal */}
      {assignmentModalVisible && (
        <AssignmentSwitchModal
          visible={assignmentModalVisible}
          onClose={() => setAssignmentModalVisible(false)}
        />
      )}
    </>
  );
};

export default RoleBasedGreeting;
