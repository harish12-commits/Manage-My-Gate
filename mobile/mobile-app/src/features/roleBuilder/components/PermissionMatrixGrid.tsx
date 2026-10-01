import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {
  Shield,
  Users,
  Settings,
  CreditCard,
  Briefcase,
  FileText,
  MessageSquare,
  Home,
  MapPin,
  Calendar,
  Layers,
  Link2,
} from 'lucide-react-native';
import { Checkbox } from '@/components/forms/Checkbox';

const formatPermissionLabel = (permissionString: string) => {
  if (!permissionString) return '';
  let label = permissionString;
  if (label.includes(':')) {
    const parts = label.split(':');
    label = parts[parts.length - 1];
  }
  label = label.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const isPermissionSelected = (perm: any, selectedIds: string[] = []) => {
  if (!perm || !selectedIds || selectedIds.length === 0) return false;
  const permValue = String(perm?.name || perm?.code || perm?._id || perm);

  if (permValue.endsWith(':full_access')) {
    const category = permValue.split(':')[0];
    return selectedIds.some((p) => String(p).startsWith(`${category}:`));
  }

  if (selectedIds.includes(permValue)) return true;
  if (perm?._id && selectedIds.includes(String(perm._id))) return true;

  if (typeof permValue === 'string') {
    const dot = permValue.replace(/:/g, '.');
    const colon = permValue.replace(/\./g, ':');
    if (selectedIds.includes(dot) || selectedIds.includes(colon)) return true;
  }
  return false;
};

const getCategoryDisplayName = (category: string) => {
  const map: Record<string, string> = {
    visitor: 'Visitor Management',
    amenities: 'Amenities & Booking',
    complaints: 'Complaints & Maintenance',
    notices: 'Notice Board & Polls',
    billing: 'Billing & Invoicing',
    villas: 'Unit Management',
    users: 'User Management',
    integrations: 'Integration Hub',
    roles: 'Roles & Permissions',
    workspaces: 'Workspaces',
  };
  return map[category] || category.charAt(0).toUpperCase() + category.slice(1);
};

const getCategoryIcon = (category: string) => {
  const map: Record<string, any> = {
    visitor: Users,
    amenities: Calendar,
    complaints: Settings,
    notices: MessageSquare,
    billing: CreditCard,
    villas: Home,
    users: Briefcase,
    integrations: Link2,
    roles: Shield,
    workspaces: Layers,
  };
  return map[category] || Shield;
};

const CATEGORY_ORDER: Record<string, number> = {
  visitor: 1,
  amenities: 2,
  complaints: 3,
  notices: 4,
  billing: 6,
  villas: 7,
  users: 8,
  roles: 9,
  workspaces: 10,
  integrations: 11,
};

interface PermissionMatrixGridProps {
  groupedPermissions: Record<string, any[]>;
  selectedIds: string[];
  onSelectAllGroup: (groupCodes: string[], checked: boolean) => void;
  onTogglePermission: (permValue: string, checked: boolean) => void;
}

const PermissionMatrixGrid = ({
  groupedPermissions,
  selectedIds,
  onSelectAllGroup,
  onTogglePermission,
}: PermissionMatrixGridProps) => {
  const normalizedGroupedPermissions = React.useMemo(() => {
    if (!groupedPermissions) return {};
    const result: Record<string, any[]> = {};
    Object.entries(groupedPermissions).forEach(([categoryKey, perms]) => {
      const lowerKey = categoryKey.toLowerCase();
      if (lowerKey === 'polls') return; // Merged into notices
      result[lowerKey] = perms || [];
    });
    return result;
  }, [groupedPermissions]);

  const categories = React.useMemo(() => {
    return Object.keys(normalizedGroupedPermissions).sort((a, b) => {
      const orderA = CATEGORY_ORDER[a] || 99;
      const orderB = CATEGORY_ORDER[b] || 99;
      if (orderA === orderB) return a.localeCompare(b);
      return orderA - orderB;
    });
  }, [normalizedGroupedPermissions]);

  if (categories.length === 0) {
    return (
      <View className="p-4 items-center justify-center">
        <Text className="text-muted-foreground">No permissions found in the system matrix.</Text>
      </View>
    );
  }

  return (
    <View className="flex-col gap-4">
      {categories.map((category) => {
        let perms = [...(normalizedGroupedPermissions[category] || [])];

        if (category === 'complaints') {
          const allowed = [
            'dashboard',
            'raise_ticket',
            'complaint_management',
            'track_requests',
            'staff',
            'assignee',
          ];
          perms = perms.filter((p) => {
            const permName = p.name || p.code || p._id || '';
            const action = permName.includes(':')
              ? permName.split(':')[1]
              : permName.includes('.')
                ? permName.split('.')[1]
                : permName;
            return allowed.includes(action.toLowerCase());
          });
        }

        if (['users', 'villas', 'roles', 'workspaces', 'integrations'].includes(category)) {
          perms = [
            {
              _id: `${category}:full_access`,
              name: `${category}:full_access`,
              description: 'Full Access',
            }
          ];
        }
        const groupCodes = perms.map((p) => p.name || p.code || p._id || '');
        const selectedGroupCount = perms.filter((p) => isPermissionSelected(p, selectedIds)).length;
        const isAllGroupSelected = groupCodes.length > 0 && selectedGroupCount === groupCodes.length;

        const CategoryIcon = getCategoryIcon(category);

        return (
          <View key={category} className="gap-2">
            {/* Category Header */}
            <View className="flex-row items-center justify-between px-1">
              <View className="flex-row items-center gap-2">
                <View className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 items-center justify-center">
                  <CategoryIcon size={13} className="text-primary" />
                </View>
                <Text className="text-xs font-bold text-foreground">
                  {getCategoryDisplayName(category)}
                </Text>
                <View className="px-1.5 py-0.2 rounded-full bg-primary/15">
                  <Text className="text-xs font-extrabold text-primary">
                    {selectedGroupCount}/{groupCodes.length}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => onSelectAllGroup(groupCodes, !isAllGroupSelected)}
                activeOpacity={0.7}
                className="px-2.5 py-1 bg-primary/10 rounded-full border border-primary/20"
              >
                <Text className="text-xs font-bold text-primary">
                  {isAllGroupSelected ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Permission Group Container */}
            <View className="flex-row flex-wrap gap-2">
              {perms.map((perm, idx) => {
                const permValue = perm.name || perm.code || perm._id || '';
                const isChecked = isPermissionSelected(perm, selectedIds);
                const label = formatPermissionLabel(perm.name || String(permValue));

                return (
                  <TouchableOpacity
                    key={permValue}
                    onPress={() => onTogglePermission(permValue, !isChecked)}
                    activeOpacity={0.7}
                    className={`self-start flex-row items-center p-2.5 rounded-xl border ${
                      isChecked
                        ? 'bg-primary/10 border-primary/40 shadow-xs'
                        : 'bg-card border-border/80 shadow-2xs'
                    }`}
                  >
                    <View className="me-2.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(val) => onTogglePermission(permValue, !!val)}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-[11px] text-start ${
                          isChecked ? 'text-primary font-bold' : 'text-foreground font-semibold'
                        }`}
                      >
                        {label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default PermissionMatrixGrid;
