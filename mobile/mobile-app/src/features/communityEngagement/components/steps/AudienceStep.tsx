import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import {
  AudienceTargetType,
  EngagementContentType,
} from '../../types/communityEngagement.types';
import { fetchRoles } from '@/src/features/roleBuilder/services/roleService';
import { fetchUsers } from '@/src/features/userManagement/services/userService';
import { cn } from '@/lib/utils';
import {
  Users,
  Shield,
  KeyRound,
  UserCheck,
  Building2,
  Check,
  AlertCircle,
} from 'lucide-react-native';

interface AudienceStepProps {
  contentType: EngagementContentType;
  targetType: AudienceTargetType;
  selectedRoleId?: string;
  selectedUserId?: string;
  onChangeField: (field: any, value: any) => void;
  error?: string;
}

const AUDIENCE_PRESETS = [
  {
    type: 'ALL' as AudienceTargetType,
    label: 'All Community Residents',
    subtitle: 'Broadcasts to every active owner, tenant, and verified resident.',
    icon: Users,
  },
  {
    type: 'OWNERS_ONLY' as AudienceTargetType,
    label: 'Property Owners Only',
    subtitle: 'Restricts content to registered unit owners and landlords.',
    icon: KeyRound,
  },
  {
    type: 'STAFF_ONLY' as AudienceTargetType,
    label: 'Staff & Security Only',
    subtitle: 'Internal communications for guards, technicians, and managers.',
    icon: Shield,
  },
  {
    type: 'SPECIFIC_ROLE' as AudienceTargetType,
    label: 'Specific Role',
    subtitle: 'Target members belonging to an explicit security or administrative role.',
    icon: Building2,
  },
  {
    type: 'SPECIFIC_RESIDENT' as AudienceTargetType,
    label: 'Specific Resident',
    subtitle: 'Send tailored communications to a single resident account.',
    icon: UserCheck,
  },
];

export const AudienceStep: React.FC<AudienceStepProps> = ({
  contentType,
  targetType,
  selectedRoleId,
  selectedUserId,
  onChangeField,
  error,
}) => {
  const [roles, setRoles] = useState<{ label: string; value: string }[]>([]);
  const [users, setUsers] = useState<{ label: string; value: string }[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingRoles(true);
        const res = await fetchRoles({ page: 1, limit: 100 });
        const items = res?.data?.data || res?.data || [];
        if (mounted && Array.isArray(items)) {
          setRoles(
            items.map((r: any) => ({
              label: r.name || r.roleName || 'Unnamed Role',
              value: r._id || r.id,
            }))
          );
        }
      } catch (e) {
        console.warn('Could not load roles for audience:', e);
      } finally {
        if (mounted) setLoadingRoles(false);
      }

      try {
        setLoadingUsers(true);
        const res = await fetchUsers({ page: 1, limit: 100 });
        const items = res?.data || res || [];
        if (mounted && Array.isArray(items)) {
          setUsers(
            items.map((u: any) => ({
              label: `${u.name || u.username || 'User'} (${u.unitNumber || u.role || 'Resident'})`,
              value: u._id || u.id,
            }))
          );
        }
      } catch (e) {
        console.warn('Could not load users for audience:', e);
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView
      className="flex-1 px-4 py-3"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      contentContainerStyle={{ paddingBottom: 132 }}
    >
      <View className="gap-4">
        {/* Error banner */}
        {error ? (
          <View className="flex-row items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
            <AlertCircle size={18} className="text-destructive" />
            <Text className="text-xs text-destructive flex-1 font-medium">{error}</Text>
          </View>
        ) : null}

        <View>
          <Text className="text-base font-bold text-foreground">
            Who should receive this {contentType === 'NOTICE' ? 'notice' : 'poll'}?
          </Text>
          <Text variant="muted" className="text-xs mt-0.5">
            Select the target audience to ensure content reaches the right residents without unnecessary notification noise.
          </Text>
        </View>

        {/* Audience preset cards */}
        <View className="gap-2.5">
          {AUDIENCE_PRESETS.map((preset) => {
            const IconComp = preset.icon;
            const isSelected = targetType === preset.type;

            return (
              <TouchableOpacity
                key={preset.type}
                onPress={() => onChangeField('targetType', preset.type)}
                activeOpacity={0.7}
                className={cn(
                  'flex-row items-center bg-card border rounded-2xl p-3.5 gap-3 transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-xs'
                    : 'border-border active:bg-muted/40'
                )}
                accessibilityRole="button"
                accessibilityLabel={`Audience ${preset.label}`}
              >
                <View
                  className={cn(
                    'w-10 h-10 rounded-xl items-center justify-center shrink-0',
                    isSelected ? 'bg-primary' : 'bg-primary/10'
                  )}
                >
                  <IconComp
                    size={20}
                    className={isSelected ? 'text-primary-foreground' : 'text-primary'}
                  />
                </View>

                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-bold text-foreground">{preset.label}</Text>
                  <Text variant="muted" className="text-xs leading-4 mt-0.5">
                    {preset.subtitle}
                  </Text>
                </View>

                {isSelected ? (
                  <View className="w-5 h-5 rounded-full bg-primary items-center justify-center ms-1 shrink-0">
                    <Check size={12} className="text-primary-foreground" />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Role Selector when SPECIFIC_ROLE is selected */}
        {targetType === 'SPECIFIC_ROLE' && (
          <View className="mt-2 p-4 bg-muted/20 border border-border rounded-2xl gap-2">
            <Text className="text-xs font-bold text-foreground">Select Target Role</Text>
            <DropdownSelect
              label="Role"
              placeholder={loadingRoles ? 'Loading roles...' : 'Choose a role'}
              options={roles}
              value={selectedRoleId || null}
              onValueChange={(val: string) => onChangeField('selectedRoleId', val || undefined)}
            />
          </View>
        )}

        {/* User Selector when SPECIFIC_RESIDENT is selected */}
        {targetType === 'SPECIFIC_RESIDENT' && (
          <View className="mt-2 p-4 bg-muted/20 border border-border rounded-2xl gap-2">
            <Text className="text-xs font-bold text-foreground">Select Resident</Text>
            <DropdownSelect
              label="Resident Account"
              placeholder={loadingUsers ? 'Loading residents...' : 'Choose a resident'}
              options={users}
              value={selectedUserId || null}
              onValueChange={(val: string) => onChangeField('selectedUserId', val || undefined)}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default AudienceStep;
