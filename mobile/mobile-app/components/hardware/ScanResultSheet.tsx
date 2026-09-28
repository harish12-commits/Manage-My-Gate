import React from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { StatusBadge, type StatusVariant } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/common/Avatar';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { CircleCheck, CircleX, CircleAlert, DoorOpen, RefreshCw, Clock } from 'lucide-react-native';

export interface ScanResultData {
  success: boolean;
  status?: 'VERIFIED' | 'REJECTED' | 'EXPIRED' | 'PENDING' | 'REVOKED';
  title?: string;
  message?: string;
  visitorName?: string;
  visitorPhoto?: string;
  visitorPhone?: string;
  passType?: string;
  unitOrVilla?: string;
  validityWindow?: string;
  bookingReference?: string;
  hostName?: string;
  entryTime?: string;
  amenityName?: string;
  metadata?: Record<string, string>;
  /** Overrides the status badge text (e.g. "BALANCE DUE" for a PENDING result). */
  statusLabel?: string;
  /** Extra rows shown under Pass Details. */
  details?: { label: string; value: string }[];
}

export interface ScanResultSheetProps {
  visible: boolean;
  onClose: () => void;
  result: ScanResultData | null;
  loading?: boolean;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
}

export const ScanResultSheet: React.FC<ScanResultSheetProps> = ({
  visible,
  onClose,
  result,
  loading = false,
  onPrimaryAction,
  primaryActionLabel = 'Confirm Entry',
  onSecondaryAction,
  secondaryActionLabel = 'Scan Next Pass',
}) => {
  if (!result) return null;

  const isSuccess = result.success && result.status !== 'REJECTED' && result.status !== 'REVOKED' && result.status !== 'EXPIRED';
  const isExpired = result.status === 'EXPIRED';
  const requiresServerDecision = result.status === 'PENDING';

  let statusVariant: StatusVariant = 'danger';
  let statusLabel = result.statusLabel || 'ACCESS REJECTED';

  if (isSuccess) {
    statusVariant = 'success';
    statusLabel = result.statusLabel || 'VERIFIED ACCESS';
  } else if (requiresServerDecision) {
    statusVariant = 'warning';
    statusLabel = result.statusLabel || 'SERVER CHECK REQUIRED';
  } else if (isExpired) {
    statusVariant = 'neutral';
    statusLabel = 'PASS EXPIRED';
  }

  const fallbackInitial = (result.visitorName || result.hostName || 'V')[0]?.toUpperCase();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={result.title || (isSuccess ? 'Pass Verification Verified' : 'Pass Verification Refused')}
    >
      <View className="gap-4 pb-2">
        {/* Verification Status Header Banner */}
        <View className="items-center justify-center pt-2 pb-1 gap-2">
          <View
            className={`w-16 h-16 rounded-full items-center justify-center ${
              isSuccess
                ? 'bg-emerald-500/20'
                : isExpired
                ? 'bg-muted'
                : 'bg-destructive/20'
            }`}
          >
            <Icon
              as={isSuccess ? CircleCheck : isExpired ? Clock : CircleX}
              size={36}
              className={
                isSuccess
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : isExpired
                  ? 'text-muted-foreground'
                  : 'text-destructive'
              }
            />
          </View>

          <StatusBadge label={statusLabel} variant={statusVariant} dot={isSuccess} size="md" />

          {Boolean(result.message) && (
            <Text
              className={`text-xs text-center px-4 mt-0.5 ${
                isSuccess
                  ? 'text-muted-foreground'
                  : 'text-destructive font-medium'
              }`}
            >
              {result.message}
            </Text>
          )}
        </View>

        {/* Passholder Summary Card */}
        <View className="bg-card border border-border rounded-2xl p-3.5 flex-row items-center gap-3">
          <Avatar
            source={result.visitorPhoto ? { uri: result.visitorPhoto } : null}
            fallback={fallbackInitial}
            size="lg"
            className="border border-border shrink-0"
          />

          <View className="flex-1">
            <Text className="font-bold text-base text-foreground" numberOfLines={1}>
              {result.visitorName || 'Pass Holder'}
            </Text>
            {Boolean(result.visitorPhone) && (
              <Text className="text-xs text-muted-foreground mt-0.5">
                {result.visitorPhone}
              </Text>
            )}
            <View className="flex-row items-center gap-2 mt-1">
              <StatusBadge
                label={result.passType || 'Standard Pass'}
                variant={isSuccess ? 'info' : 'neutral'}
                size="sm"
              />
              {Boolean(result.unitOrVilla) && (
                <Text className="text-xs font-semibold text-primary">
                  Unit: {result.unitOrVilla}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Detailed Metadata Section */}
        <DetailSection title="Pass Details" iconName="ShieldCheck" defaultExpanded={true}>
          {Boolean(result.amenityName) && (
            <DetailRow label="Facility / Venue" value={result.amenityName!} iconName="Building" />
          )}
          {Boolean(result.hostName) && (
            <DetailRow label="Host / Resident" value={result.hostName!} iconName="User" />
          )}
          {Boolean(result.validityWindow) && (
            <DetailRow label="Validity Window" value={result.validityWindow!} iconName="Clock" />
          )}
          {(result.details || []).map((row) => (
            <DetailRow key={row.label} label={row.label} value={row.value} />
          ))}
          {Boolean(result.bookingReference) && (
            <DetailRow
              label="Pass Code Ref"
              value={result.bookingReference!}
              iconName="QrCode"
              copyable={true}
              isLast={true}
            />
          )}
        </DetailSection>

        {/* Action Button Row */}
        <View className="gap-2.5 pt-1">
          {(isSuccess || requiresServerDecision) && onPrimaryAction ? (
            <Button
              onPress={onPrimaryAction}
              disabled={loading}
              className="w-full h-12 bg-emerald-600 active:bg-emerald-700 flex-row items-center justify-center gap-2"
              accessibilityRole="button"
              accessibilityLabel={primaryActionLabel}
            >
              <Icon as={DoorOpen} size={18} color="#FFFFFF" />
              <Text className="text-sm font-bold text-white">
                {loading ? 'Processing...' : primaryActionLabel}
              </Text>
            </Button>
          ) : null}

          <Button
            variant="outline"
            onPress={onSecondaryAction || onClose}
            disabled={loading}
            className="w-full h-12 flex-row items-center justify-center gap-2 border-border active:bg-secondary/60"
            accessibilityRole="button"
            accessibilityLabel={secondaryActionLabel}
          >
            <Icon as={RefreshCw} size={16} className="text-foreground" />
            <Text className="text-sm font-bold text-foreground">
              {secondaryActionLabel}
            </Text>
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
};

export default ScanResultSheet;
