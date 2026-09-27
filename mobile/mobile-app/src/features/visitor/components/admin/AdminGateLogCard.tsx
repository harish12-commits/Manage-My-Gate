import React from 'react';
import { View } from 'react-native';
import { ListCard } from '@/components/ui/ListCard';
import { StatusBadge, StatusVariant } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  Car,
  Package,
  Wrench,
  User,
  ShieldAlert,
  Clock,
  LogOut,
  MapPin,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/src/utils/i18n';

export interface AdminGateLogItem {
  _id: string;
  visitorName?: string;
  phone?: string;
  passType?: string;
  category?: string;
  code?: string;
  shortKey?: string;
  vehicleNo?: string;
  villaNumber?: string;
  unitNumber?: string;
  guardName?: string;
  gateName?: string;
  entryTime?: string | Date;
  exitTime?: string | Date;
  status?: string;
  isBlacklisted?: boolean;
  purpose?: string;
  provider?: string;
  rawPass?: any;
}

export interface AdminGateLogCardProps {
  log: AdminGateLogItem;
  onPress?: (log: AdminGateLogItem) => void;
  onForceCheckout?: (log: AdminGateLogItem) => void;
  className?: string;
}

export const AdminGateLogCard: React.FC<AdminGateLogCardProps> = ({
  log,
  onPress,
  onForceCheckout,
  className,
}) => {
  const { t } = useTranslation();
  const visitorName = log.visitorName || log.rawPass?.visitorName || 'Visitor';
  const passType = (log.passType || log.category || log.rawPass?.passType || 'GUEST').toUpperCase();
  const shortKey = log.code || log.shortKey || log.rawPass?.shortKey || log.rawPass?.code || 'N/A';
  const vehicleNo = log.vehicleNo || log.rawPass?.vehicleDetails?.plateNumber || log.rawPass?.vehicleNo;
  const villa = log.villaNumber || log.unitNumber || log.rawPass?.villaNumber || log.rawPass?.unitNumber;
  const guard = log.guardName || log.rawPass?.guardName || '—';
  const gate = log.gateName || log.rawPass?.gateName || '—';
  const status = (log.status || log.rawPass?.status || 'ACTIVE').toUpperCase();
  const isInside = status === 'ACTIVE' || status === 'CHECKED_IN' || status === 'INSIDE';

  // Status variant mapping
  const statusVariant: StatusVariant =
    status === 'ACTIVE' || status === 'CHECKED_IN' || status === 'INSIDE'
      ? 'success'
      : status === 'PENDING'
      ? 'warning'
      : status === 'REVOKED' || status === 'DENIED' || status === 'BLOCKED'
      ? 'danger'
      : 'neutral';

  const statusLabel =
    status === 'ACTIVE' || status === 'CHECKED_IN' || status === 'INSIDE'
      ? 'CHECKED-IN'
      : status;

  // Icon configuration
  const getIconConfig = () => {
    if (log.isBlacklisted || status === 'BLOCKED' || status === 'DENIED') {
      return { icon: ShieldAlert, bg: 'bg-destructive/15' };
    }
    if (passType === 'CAB') return { icon: Car, bg: 'bg-primary/15' };
    if (passType === 'DELIVERY') return { icon: Package, bg: 'bg-status-warning/15' };
    if (passType === 'SERVICE') return { icon: Wrench, bg: 'bg-status-info/15' };
    return { icon: User, bg: 'bg-primary/10' };
  };

  const { icon: LeftIconComponent, bg: iconBgClass } = getIconConfig();

  // Duration calculation
  const formatDuration = () => {
    if (!log.entryTime) return null;
    const start = new Date(log.entryTime).getTime();
    const end = log.exitTime ? new Date(log.exitTime).getTime() : Date.now();
    const diffMins = Math.max(0, Math.floor((end - start) / 60000));
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const durationStr = formatDuration();

  return (
    <ListCard
      title={visitorName}
      subtitle={`Pass #${shortKey} • ${passType}${log.provider ? ` (${log.provider})` : ''}`}
      leftIcon={LeftIconComponent}
      leftIconBgColor={iconBgClass}
      status={{
        label: statusLabel,
        variant: statusVariant,
      }}
      onPress={() => onPress?.(log)}
      className={cn('mb-3', className)}
    >
      <View className="gap-2.5 pt-2 border-t border-border/40">
        {/* Metadata Details Grid */}
        <View className="flex-row flex-wrap items-center justify-between gap-y-1.5 bg-muted/20 p-2.5 rounded-xl border border-border/30">
          <View className="flex-row items-center gap-1.5">
            <ShieldCheck size={13} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">
              {guard} • <Text className="font-semibold text-foreground">{gate}</Text>
            </Text>
          </View>

          {villa ? (
            <View className="flex-row items-center gap-1">
              <MapPin size={13} className="text-muted-foreground" />
              <Text className="text-xs font-semibold text-foreground">Villa {villa}</Text>
            </View>
          ) : null}

          {vehicleNo ? (
            <View className="w-full flex-row items-center justify-between pt-1 border-t border-border/20">
              <Text className="text-[11px] text-muted-foreground">{t('vehicle_plate', 'Vehicle Plate:')}</Text>
              <Text className="text-[11px] font-mono font-bold text-foreground">{vehicleNo}</Text>
            </View>
          ) : null}

          {durationStr && isInside ? (
            <View className="w-full flex-row items-center justify-between pt-1 border-t border-border/20">
              <View className="flex-row items-center gap-1">
                <Clock size={12} className="text-status-success" />
                <Text className="text-[11px] font-medium text-status-success">{t('duration_inside', 'Duration Inside:')}</Text>
              </View>
              <Text className="text-[11px] font-bold text-foreground">{durationStr}</Text>
            </View>
          ) : null}
        </View>

        {/* Action Button Row */}
        <View className="flex-row items-center justify-end gap-2 pt-1">
          {isInside && onForceCheckout ? (
            <Button
              variant="destructive"
              size="sm"
              onPress={() => onForceCheckout(log)}
              className="h-8 px-3 rounded-lg flex-row items-center gap-1"
            >
              <LogOut size={13} color="#fff" />
              <Text className="text-xs font-bold text-destructive-foreground">{t('force_check_out', 'Force Check-Out')}</Text>
            </Button>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onPress={() => onPress?.(log)}
            className="h-8 px-3 rounded-lg flex-row items-center gap-1"
          >
            <Text className="text-xs font-semibold text-foreground">{t('inspect_trail', 'Inspect Trail')}</Text>
            <ChevronRight size={13} className="text-muted-foreground" />
          </Button>
        </View>
      </View>
    </ListCard>
  );
};

export default AdminGateLogCard;
