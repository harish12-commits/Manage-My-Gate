import React, { useState } from 'react';
import { View, TouchableOpacity, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Shield, Phone, Home, MoreVertical, Edit2 } from 'lucide-react-native';
import { StatusBadge, StatusVariant } from '@/components/ui/StatusBadge';
import { useTranslation, i18n } from '@/src/utils/i18n';
import { UserData, AssignedUnit } from '../services/userService';
import { UserOverflowMenu } from './UserOverflowMenu';
import { Button } from '@/components/common/Button';

export interface UserCardProps {
  user: UserData;
  currentUserId?: string;
  onManageRoles: (user: UserData, unit?: AssignedUnit | null) => void;
  onResendInvite?: (user: UserData) => void;
  onDeleteUser: (user: UserData) => void;
  onOpenMenu?: (user: UserData) => void;
  onViewDetails?: (user: UserData) => void;
  onToggleStatus?: (user: UserData) => void;
  className?: string;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  currentUserId,
  onManageRoles,
  onResendInvite,
  onDeleteUser,
  onOpenMenu,
  onViewDetails,
  onToggleStatus,
  className = '',
}) => {
  const { t } = useTranslation();
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);

  const isPending = user.status === 'Pending' || user.status === 'Pending Verification';
  const isRejected = user.status === 'Rejected';
  const displayStatus = isRejected ? 'Rejected' : isPending ? 'Pending' : user.status || 'Active';

  const mapStatusVariant = (status: string): StatusVariant => {
    if (status === 'Rejected') return 'danger';
    if (status === 'Pending' || status === 'Pending Verification') return 'warning';
    switch (status) {
      case 'Active':
        return 'success';
      case 'Inactive':
        return 'danger';
      default:
        return 'warning';
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'US';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const globalRolesList = typeof user.role === 'string'
    ? user.role.split(',').map((r) => r.trim()).filter(Boolean)
    : Array.isArray(user.role)
    ? user.role
    : [];

  const handleMenuPress = () => {
    if (onOpenMenu) {
      onOpenMenu(user);
    } else {
      setInternalMenuOpen(true);
    }
  };

  return (
    <>
      <View
        className={`mb-4 p-4 bg-card border border-border/40 rounded-3xl shadow-sm ${className}`}
      >
        {/* Top Section: Avatar + Details (Left) and Status + Menu Button (Right) */}
        <View className="flex-row items-start justify-between">
          {/* Left: Avatar + Identity */}
          <View className="flex-row items-start flex-1 me-2">
            {/* Premium Circular Avatar */}
            <View className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 items-center justify-center me-3.5 shrink-0 shadow-sm">
              <Text className="text-sm font-extrabold text-primary font-sans">
                {getInitials(user.name)}
              </Text>
            </View>

            {/* Name, Email, Phone, Role */}
            <View className="flex-1 mt-0.5">
              <Text
                className="text-[15px] font-bold text-foreground font-sans tracking-tight"
                numberOfLines={1}
              >
                {user.name}
              </Text>

              <Text
                className="text-[13px] text-muted-foreground font-sans mt-0.5"
                numberOfLines={1}
              >
                {user.email}
              </Text>

              {/* Phone & Role Row */}
              <View className="flex-row items-center flex-wrap gap-2 mt-2">
                {user.phone ? (
                  <View className="flex-row items-center me-1.5">
                    <Phone size={12} className="text-muted-foreground me-1" />
                    <Text className="text-[12px] font-medium text-muted-foreground font-sans">
                      {user.phone}
                    </Text>
                  </View>
                ) : null}

                {globalRolesList.map((roleStr, idx) => (
                  <View
                    key={idx}
                    className="bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full flex-row items-center gap-1"
                  >
                    <Shield size={10} className="text-primary" />
                    <Text className="text-[10px] font-bold text-primary font-sans">
                      {i18n.tRole(roleStr)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Right: Status Badge & Overflow Menu Button */}
          <View className="flex-row items-center gap-2 shrink-0">
            <StatusBadge
              label={displayStatus}
              variant={mapStatusVariant(user.status)}
              className="py-1 px-2.5 rounded-full shadow-sm"
            />

            <TouchableOpacity
              onPress={handleMenuPress}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="w-9 h-9 rounded-full items-center justify-center bg-secondary/80 border border-border/60 active:bg-secondary transition-colors"
              accessibilityRole="button"
              accessibilityLabel={`More options for ${user.name}`}
            >
              <MoreVertical size={18} className="text-foreground" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Section: Assigned Villa Units Box */}
        {user.assignedUnits && user.assignedUnits.length > 0 ? (
          <View className="mt-3.5 pt-3.5 border-t border-border/40 gap-2">
            {user.assignedUnits.map((unit, idx) => (
              <View
                key={idx}
                className="flex-row items-center justify-between p-2.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-900/20 border border-emerald-500/20 shadow-sm"
              >
                <View className="flex-row items-center flex-1 shrink me-2">
                  <View className="w-6 h-6 rounded-full bg-emerald-500/20 items-center justify-center shrink-0 me-2">
                    <Home size={12} color="#10b981" />
                  </View>
                  <View className="flex-row items-center flex-1 shrink">
                    <Text 
                      className="text-xs font-bold text-emerald-800 dark:text-emerald-300 font-sans shrink"
                      numberOfLines={1}
                    >
                      {t('unit_label', 'Unit')} {unit.villaNumber} {unit.villaBlock ? `(${unit.villaBlock})` : ''}
                    </Text>
                    {unit.residentType && unit.residentType !== 'None' ? (
                      <Text 
                        className="text-[11px] text-muted-foreground font-sans font-medium shrink-0 ms-1"
                      >
                        | {i18n.tRole(unit.residentType)}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {unit.role ? (
                  <View className="bg-card border border-border/60 px-2 py-1 rounded-lg shadow-sm shrink">
                    <Text 
                      className="text-[10px] font-bold text-foreground font-sans tracking-wide text-center"
                      numberOfLines={2}
                    >
                      {i18n.tRole(unit.role)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Premium Inline Action Buttons */}
        <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-border/40">
          <TouchableOpacity 
            onPress={() => onViewDetails?.(user)} 
            activeOpacity={0.7}
            className="flex-1 py-3.5 rounded-2xl bg-secondary/80 border border-border/50 active:bg-secondary flex-row items-center justify-center transition-all me-1.5"
          >
            <View className="w-6 h-6 rounded-full bg-foreground/5 items-center justify-center shrink-0 me-2">
              <Edit2 size={13} className="text-foreground" />
            </View>
            <Text className="text-[13px] font-extrabold text-foreground tracking-wide shrink" numberOfLines={1}>Edit Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => onManageRoles(user)} 
            activeOpacity={0.7}
            className="flex-1 py-3.5 rounded-2xl bg-primary/10 border border-primary/20 active:bg-primary/20 flex-row items-center justify-center transition-all ms-1.5"
          >
            <View className="w-6 h-6 rounded-full bg-primary/10 items-center justify-center shrink-0 me-2">
              <Shield size={13} className="text-primary" />
            </View>
            <Text className="text-[13px] font-extrabold text-primary tracking-wide shrink" numberOfLines={1}>Permissions</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Internal Overflow Menu fallback if not controlled externally */}
      {!onOpenMenu && (
        <UserOverflowMenu
          visible={internalMenuOpen}
          onClose={() => setInternalMenuOpen(false)}
          user={user}
          currentUserId={currentUserId}
          onManageRoles={(u) => onManageRoles(u)}
          onViewDetails={onViewDetails}
          onResendInvite={onResendInvite}
          onToggleStatus={onToggleStatus}
          onDeleteUser={onDeleteUser}
        />
      )}
    </>
  );
};

export default UserCard;
