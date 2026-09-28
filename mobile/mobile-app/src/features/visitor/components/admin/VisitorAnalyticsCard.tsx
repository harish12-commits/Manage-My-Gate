import React from 'react';
import { View } from 'react-native';
import { KPIRow } from '@/components/ui/KPIRow';
import { KPICardProps } from '@/components/ui/KPICard';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { VisitorAnalyticsData } from '../../store/adminVisitorThunks';
import { TrendingUp, Clock, AlertTriangle } from 'lucide-react-native';
import { cn } from '@/lib/utils';

export interface VisitorAnalyticsCardProps {
  analytics: VisitorAnalyticsData | null;
  loading?: boolean;
  className?: string;
}

export const VisitorAnalyticsCard: React.FC<VisitorAnalyticsCardProps> = ({
  analytics,
  loading = false,
  className,
}) => {
  const totalEntries = analytics?.totalEntriesToday ?? 0;
  const activeInside = analytics?.activeInsideCount ?? 0;
  const pending = analytics?.pendingApprovalsCount ?? 0;
  const blacklisted = analytics?.totalBlacklistedCount ?? 0;
  const peakHour = analytics?.peakHour || '—';

  const kpiCards: KPICardProps[] = [
    {
      title: 'Total Entries',
      value: totalEntries,
      variant: 'default',
      iconName: 'Users',
    },
    {
      title: 'Inside Now',
      value: activeInside,
      variant: 'success',
      iconName: 'DoorOpen',
    },
    {
      title: 'Pending Approvals',
      value: pending,
      variant: 'warning',
      iconName: 'Clock',
    },
    {
      title: 'Blacklisted Flags',
      value: blacklisted,
      variant: 'destructive',
      iconName: 'ShieldAlert',
    },
  ];

  return (
    <View className={cn('bg-card border border-border rounded-2xl p-4 gap-3.5 shadow-xs', className)}>
      {/* Header Row */}
      <View className="flex-row items-center justify-between border-b border-border/60 pb-3">
        <View className="flex-row items-center gap-2">
          <View className="size-8 rounded-full bg-primary/10 items-center justify-center border border-primary/20">
            <TrendingUp size={16} className="text-primary" />
          </View>
          <Text className="text-sm font-bold text-foreground">Gate Entry Traffic Summary</Text>
        </View>
        <StatusBadge label="Today" variant="success" size="sm" dot />
      </View>

      {/* 2x2 Normalized KPI Grid */}
      <KPIRow
        layout="grid"
        cards={kpiCards}
        loading={loading}
        className="px-0"
      />

      {/* Footer Telemetry Information */}
      <View className="flex-row items-center justify-between pt-2 border-t border-border/40">
        <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
          <Clock size={13} className="text-muted-foreground shrink-0" />
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            Peak Window: <Text className="font-bold text-foreground">{peakHour}</Text>
          </Text>
        </View>

        {blacklisted > 0 && (
          <View className="flex-row items-center gap-1 shrink-0 bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
            <AlertTriangle size={11} className="text-destructive" />
            <Text className="text-[11px] text-destructive font-bold">
              {blacklisted} Blocked
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default VisitorAnalyticsCard;
