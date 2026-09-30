import React from 'react';
import { View, Linking, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { ListCard } from '@/components/ui/ListCard';
import { StatusVariant } from '@/components/ui/StatusBadge';
import { useTranslation, i18n } from '@/src/utils/i18n';
import { DirectoryMember } from '../types/directoryTypes';
import { Phone, Mail } from 'lucide-react-native';
import { cn } from '@/lib/utils';

export interface DirectoryContactCardProps {
  member: DirectoryMember;
  currentUserId?: string;
  onCall?: (phone: string) => void;
  className?: string;
}

export const DirectoryContactCard = ({
  member,
  currentUserId,
  onCall,
  className,
}: DirectoryContactCardProps) => {
  const { t } = useTranslation();

  const getRoleVariant = (role: string): StatusVariant => {
    switch (role?.toLowerCase()) {
      case 'guard':
      case 'security':
        return 'warning';
      case 'staff':
      case 'maintenance':
        return 'info';
      case 'admin':
      case 'management':
        return 'critical';
      case 'resident':
      default:
        return 'success';
    }
  };

  const handlePhonePress = () => {
    if (onCall && member.phone) {
      onCall(member.phone);
    } else if (member.phone) {
      Linking.openURL(`tel:${member.phone.replace(/[^\d+]/g, '')}`).catch(() => {});
    }
  };

  const hasUnit = Boolean(member.unitNumber && member.unitNumber.trim());
  const cleanDesignation =
    member.designation && member.designation.trim().toLowerCase() !== 'none'
      ? member.designation.trim()
      : '';
  const subtitleText = hasUnit
    ? cleanDesignation
      ? `${member.unitNumber} • ${cleanDesignation}`
      : member.unitNumber
    : cleanDesignation;

  return (
    <ListCard
      title={member.name}
      subtitle={subtitleText}
      leftAvatar={member.avatarUrl || undefined}
      leftAvatarFallback={
        !member.avatarUrl ? (member.name ? member.name.charAt(0).toUpperCase() : 'M') : undefined
      }
      status={{
        label: i18n.tRole(member.role, member.role ? member.role.toUpperCase() : 'RESIDENT'),
        variant: getRoleVariant(member.role),
      }}
      showChevron={false}
      className={cn('mb-3.5 p-4 rounded-2xl border border-border/80 shadow-xs', className)}
    >
      {/* Contact Details Section */}
      {(member.phone || member.email) && (
        <View className="gap-1.5 pt-2.5 mt-2.5 border-t border-border/30">
          {member.phone ? (
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-2 flex-1 min-w-0">
                <Phone size={13} className="text-muted-foreground shrink-0" />
                <Text className="text-xs font-semibold text-foreground tracking-wide" numberOfLines={1}>
                  {member.phone}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handlePhonePress}
                activeOpacity={0.75}
                className="h-9 px-3 rounded-xl border border-primary/30 bg-primary/10 flex-row items-center justify-center gap-1.5"
                accessibilityRole="button"
                accessibilityLabel={`${t('action_call', 'Call')} ${member.name}`}
              >
                <Phone size={14} className="text-primary" />
                <Text className="text-xs font-bold text-primary">{t('action_call', 'Call')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {member.email ? (
            <View className="flex-row items-center gap-2">
              <Mail size={13} className="text-muted-foreground shrink-0" />
              <Text className="text-xs font-medium text-muted-foreground flex-1" numberOfLines={1}>
                {member.email}
              </Text>
            </View>
          ) : null}
        </View>
      )}

    </ListCard>
  );
};

export default DirectoryContactCard;
