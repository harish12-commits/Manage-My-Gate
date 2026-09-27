import React from 'react';
import { View } from 'react-native';
import { ListCard, formatDate } from '@/components/ui/ListCard';
import { StatusVariant } from '@/components/ui/StatusBadge';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Pin, CheckSquare, Users, Shield, BarChart2, Clock } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

export interface EngagementCardItem {
  id: string;
  type: 'NOTICE' | 'POLL';
  title: string;
  subtitle: string;
  description?: string;
  status: string;
  priority?: string;
  category?: string;
  isPinned?: boolean;
  requiresAcknowledgement?: boolean;
  targetAudience?: any;
  votingMode?: string;
  choiceType?: string;
  votesCount?: number;
  optionsCount?: number;
  createdAt: string;
  expiryDate?: string;
  route: string;
}

export interface EngagementCardProps {
  item: EngagementCardItem;
  onPress: () => void;
  className?: string;
}

const getStatusBadgeVariant = (status: string, priority?: string): StatusVariant => {
  if (priority === 'Critical' || priority === 'High') return 'danger';
  const s = (status || '').toUpperCase();
  if (s === 'PUBLISHED' || s === 'ACTIVE') return 'success';
  if (s === 'DRAFT') return 'warning';
  if (s === 'SCHEDULED') return 'info';
  return 'neutral';
};

export const EngagementCard: React.FC<EngagementCardProps> = ({
  item,
  onPress,
  className = '',
}) => {
  const { t, tCategoryName, translateText } = useTranslation();
  const isNotice = item.type === 'NOTICE';

  const getAudienceLabel = (targetAudience?: any): string => {
    if (!targetAudience) return t('all_community');
    const type = (targetAudience.targetType || 'ALL').toUpperCase();
    if (type === 'OWNERS_ONLY') return t('owners_only');
    if (type === 'STAFF_ONLY') return t('staff_security');
    if (type === 'SPECIFIC_ROLE' || type === 'ROLES') return t('role_targeted');
    if (type === 'SPECIFIC_RESIDENT' || type === 'CUSTOM') return t('direct_resident');
    if (type === 'BLOCKS') return t('block_specific');
    if (type === 'RESIDENCY_TYPES') {
      const res = targetAudience.targetResidencyTypes || [];
      if (res.includes('Owner')) return t('owners_only');
      if (res.includes('Tenant')) return t('tenants_only');
    }
    return t('all_community');
  };

  const getExpiryTimeRemaining = (expiryDate?: string): string | null => {
    if (!expiryDate) return null;
    const exp = new Date(expiryDate);
    if (isNaN(exp.getTime())) return null;

    const diffMs = exp.getTime() - Date.now();
    if (diffMs <= 0) return t('status_expired');

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) return t('expires_in_hours', { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    return t('expires_in_days', { count: diffDays });
  };

  const getSubtitleDisplay = () => {
    if (!isNotice) {
      return t('poll_subtitle_meta', {
        options: item.optionsCount ?? 0,
        votes: item.votesCount ?? 0,
      });
    }
    if (item.category) {
      const cat = tCategoryName(item.category);
      const prioKey = `priority_${(item.priority || 'medium').toLowerCase()}`;
      const prio = t(prioKey, item.priority || 'Medium');
      const prioWord = t('priority', 'Priority');
      return `${cat} • ${prio} ${prioWord}`;
    }
    return t('notice');
  };

  const audienceLabel = getAudienceLabel(item.targetAudience);
  const expiryLabel = getExpiryTimeRemaining(item.expiryDate);

  return (
    <ListCard
      title={translateText(item.title)}
      subtitle={getSubtitleDisplay()}
      titleLines={2}
      leftIcon={isNotice ? 'Megaphone' : 'BarChart3'}
      leftIconBgColor="rgba(234, 88, 12, 0.1)"
      leftIconColor="#EA580C"
      status={{
        label: t(`status_${item.status.toLowerCase()}`, item.status),
        variant: getStatusBadgeVariant(item.status, item.priority),
      }}
      timestamp={formatDate(item.createdAt)}
      disableRelativeTime={true}
      showChevron={true}
      onPress={onPress}
      className={className}
    >
      {/* Enhanced Secondary Meta Row */}
      <View className="flex-row flex-wrap items-center gap-1.5 pt-2 mt-2 border-t border-border/40">
        {/* Content Type Tag (Notice / Poll) */}
        <View
          className={`px-2 py-0.5 rounded-md border ${
            isNotice
              ? 'bg-orange-500/10 border-orange-500/25'
              : 'bg-primary/10 border-primary/25'
          }`}
        >
          <Text
            className={`text-[10px] font-bold ${
              isNotice ? 'text-orange-600 dark:text-orange-400' : 'text-primary'
            }`}
          >
            {isNotice ? t('notice', 'Notice') : t('poll', 'Poll')}
          </Text>
        </View>

        {/* Pinned Pill */}
        {isNotice && item.isPinned ? (
          <View className="flex-row items-center px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30">
            <Icon as={Pin} size={11} className="text-amber-600 dark:text-amber-400 me-1" />
            <Text className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
              {t('pinned')}
            </Text>
          </View>
        ) : null}

        {/* Sign-off Required Pill */}
        {isNotice && item.requiresAcknowledgement ? (
          <View className="flex-row items-center px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30">
            <Icon as={CheckSquare} size={11} className="text-blue-500 me-1" />
            <Text className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
              {t('signoff_req')}
            </Text>
          </View>
        ) : null}

        {/* Target Audience Scope */}
        <View className="flex-row items-center px-2 py-0.5 rounded-md bg-muted/60 border border-border/70">
          <Icon as={Users} size={11} className="text-muted-foreground me-1" />
          <Text className="text-[10px] font-medium text-foreground/80">{audienceLabel}</Text>
        </View>

        {/* Poll Voting Mode */}
        {!isNotice ? (
          <View className="flex-row items-center px-2 py-0.5 rounded-md bg-muted/60 border border-border/70">
            <Icon
              as={item.votingMode === 'ANONYMOUS' ? Shield : BarChart2}
              size={11}
              className="text-muted-foreground me-1"
            />
            <Text className="text-[10px] font-medium text-foreground/80">
              {item.votingMode === 'ANONYMOUS' ? t('anonymous') : t('public')}
            </Text>
          </View>
        ) : null}

        {/* Expiry / Countdown Timer */}
        {expiryLabel ? (
          <View className="flex-row items-center px-2 py-0.5 rounded-md bg-muted/40 ms-auto">
            <Icon as={Clock} size={10} className="text-muted-foreground me-1" />
            <Text className="text-[10px] font-medium text-muted-foreground">{expiryLabel}</Text>
          </View>
        ) : null}
      </View>
    </ListCard>
  );
};

export default EngagementCard;
