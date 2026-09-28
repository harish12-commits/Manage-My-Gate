/**
 * ResidentReservationCard Component
 * Modern Phase 6C.1 card representing an AmenityReservation.
 * Renders facility details, timing, reservation number, and all five orthogonal status dimensions.
 * Built strictly on top of the catalog's <ListCard> and <StatusBadge>.
 */

import React from 'react';
import { View, Pressable } from 'react-native';
import { Calendar, Clock, Users, ShieldAlert, Sparkles, ShieldCheck, QrCode, Hourglass } from 'lucide-react-native';
import { ListCard } from '@/components/ui/ListCard';
import { StatusBadge, type StatusVariant } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { useTranslation } from '@/src/utils/i18n';
import {
  AmenityReservation,
  AmenityBookingStatus,
  AmenityPaymentStatus,
  AmenityApprovalStatus,
  AmenityAccessStatus,
  AmenityCompletionStatus,
} from '../types/amenityDomain.types';
import {
  formatUtcToLocalDisplay,
  formatTimeRange12Hour,
  formatReservationDate,
  formatReservationTimeRange,
  formatApprovalStatusLabel,
  formatAccessStatusLabel,
  formatCompletionStatusLabel,
  formatBookingStatusLabel,
  formatPaymentStatusLabel,
  formatAmenityPassCode,
  formatAmenityAmount,
} from '../utils/amenityStateHelpers';

export interface ResidentReservationCardProps {
  reservation: AmenityReservation;
  onPress?: (reservation: AmenityReservation) => void;
  onShowQR?: (reservation: AmenityReservation) => void;
  onCancelPress?: (reservation: AmenityReservation) => void;
  detailed?: boolean;
  testID?: string;
}

export function getBookingStatusVariant(status: AmenityBookingStatus): StatusVariant {
  switch (status) {
    case 'CONFIRMED':
      return 'success';
    case 'PENDING_APPROVAL':
      return 'warning';
    case 'CANCELLED':
    case 'REJECTED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getPaymentStatusVariant(status: AmenityPaymentStatus): StatusVariant {
  switch (status) {
    case 'PAID':
    case 'NOT_REQUIRED':
      return 'success';
    case 'HELD_AUTHORIZED':
      return 'info';
    case 'PENDING':
    case 'REFUND_PENDING':
      return 'warning';
    case 'REFUNDED':
      return 'neutral';
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getApprovalStatusVariant(status: AmenityApprovalStatus): StatusVariant {
  switch (status) {
    case 'APPROVED':
    case 'NOT_REQUIRED':
      return 'success';
    case 'PENDING_REVIEW':
      return 'warning';
    case 'REJECTED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getAccessStatusVariant(status: AmenityAccessStatus): StatusVariant {
  switch (status) {
    case 'PASS_GENERATED':
      return 'success';
    case 'CHECKED_IN':
      return 'info';
    case 'CHECKED_OUT':
    case 'NOT_APPLICABLE':
      return 'neutral';
    case 'ACCESS_REVOKED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getCompletionStatusVariant(status: AmenityCompletionStatus): StatusVariant {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'PENDING':
      return 'neutral';
    case 'NO_SHOW':
    case 'ABANDONED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function ResidentReservationCard({
  reservation,
  onPress,
  onShowQR,
  onCancelPress,
  detailed = false,
  testID,
}: ResidentReservationCardProps) {
  const { t } = useTranslation();
  const facilityName = reservation.facilityName || 'Amenity Facility';
  const resourceName = reservation.resourceName;
  const reservationNumber = reservation.reservationNumber || reservation._id;
  const passCode = formatAmenityPassCode(reservationNumber, facilityName);

  const unitNum =
    (reservation as any).unitNumber ||
    (reservation as any).villaNumber ||
    (reservation as any).unitId?.unitNumber ||
    (reservation as any).unitId?.name;
  const resolvedVilla = unitNum ? `${t('villa_label', 'Villa')} ${unitNum}` : '';
  const displayContext = resourceName || resolvedVilla;

  const subtitle = displayContext
    ? `${displayContext} • ${t('code_label', 'Code:')} ${passCode}`
    : `${t('code_label', 'Code:')} ${passCode}`;

  // Format date & time components with Indian timezone fallback
  const tz = reservation.facilityTimezone || 'Asia/Kolkata';
  const rawStart =
    reservation.startDateTime ||
    (reservation as any).effectiveStartDateTime ||
    (reservation as any).requestedStartDateTime;
  const rawEnd =
    reservation.endDateTime ||
    (reservation as any).effectiveEndDateTime ||
    (reservation as any).requestedEndDateTime;

  const formattedDate = formatReservationDate(rawStart, tz) || 'Scheduled Date';
  const formattedTimeRange = formatReservationTimeRange(rawStart, rawEnd, tz) || 'Time Scheduled';

  // Determine cancellation eligibility
  const isCancellable =
    reservation.bookingStatus !== 'CANCELLED' &&
    reservation.bookingStatus !== 'REJECTED' &&
    reservation.completionStatus !== 'COMPLETED' &&
    reservation.accessStatus !== 'CHECKED_OUT';

  const balanceDue =
    ['CONFIRMED', 'PENDING_APPROVAL'].includes(reservation.bookingStatus) &&
    reservation.completionStatus !== 'NO_SHOW'
      ? Number(reservation.balanceAmount || 0)
      : 0;

  const canShowQR =
    reservation.bookingStatus !== 'CANCELLED' &&
    reservation.bookingStatus !== 'REJECTED' &&
    reservation.completionStatus !== 'ABANDONED';

  const handleCardPress = () => {
    if (onPress) {
      onPress(reservation);
    }
  };

  const handleCancelPress = (e: any) => {
    e?.stopPropagation?.();
    if (onCancelPress) {
      onCancelPress(reservation);
    }
  };

  return (
    <ListCard
      testID={testID}
      title={facilityName}
      subtitle={subtitle}
      leftIcon="QrCode"
      leftIconBgColor="rgba(23, 43, 112, 0.12)"
      leftIconColor="#172B70"
      status={{
        label: formatBookingStatusLabel(reservation.bookingStatus),
        variant: getBookingStatusVariant(reservation.bookingStatus),
      }}
      secondaryBadge={
        balanceDue > 0
          ? {
              label: t('amenity_card_balance_due', 'Balance {amount} due', { amount: formatAmenityAmount(balanceDue) }),
              variant: 'warning',
            }
          : detailed
          ? {
              label: formatPaymentStatusLabel(reservation.paymentStatus),
              variant: getPaymentStatusVariant(reservation.paymentStatus),
            }
          : undefined
      }
      rightContent={
        onShowQR && canShowQR ? (
          <Button
            variant="info"
            size="sm"
            onPress={(e: any) => {
              e?.stopPropagation?.();
              onShowQR(reservation);
            }}
            className="flex-row items-center gap-1.5 h-8 px-2.5 rounded-lg"
            accessibilityRole="button"
            accessibilityLabel={`View Pass Code for ${facilityName}`}
          >
            <QrCode size={14} color="#245fa8" />
            <Text>{t('pass_code', 'Pass Code')}</Text>
          </Button>
        ) : undefined
      }
      onPress={handleCardPress}
      accessibilityRole="button"
      accessibilityLabel={`Reservation for ${facilityName}, Code ${passCode}`}
    >
      {detailed && (
        <View className="pt-2.5 mt-1 border-t border-border/50 gap-2.5">
          {/* Schedule & Headcount Row */}
          <View className="flex-row items-center flex-wrap gap-x-4 gap-y-2">
          <View className="flex-row items-center gap-1.5">
            <Icon as={Calendar} size={14} className="text-muted-foreground" />
            <Text variant="muted" className="text-xs font-medium">
              {formattedDate}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Icon as={Clock} size={14} className="text-muted-foreground" />
            <Text variant="muted" className="text-xs font-medium">
              {formattedTimeRange}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Icon as={Users} size={14} className="text-muted-foreground" />
            <Text variant="muted" className="text-xs font-medium">
              {reservation.headcount || 1} {reservation.headcount === 1 ? 'Guest' : 'Guests'}
            </Text>
          </View>
        </View>

        {/* Status Lifecycle Summary Box */}
        <View className="bg-muted/40 p-3 rounded-2xl border border-border/50 gap-2">
          {/* Approval Dimension */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Icon as={ShieldCheck} size={13} className="text-muted-foreground" />
              <Text variant="muted" className="text-xs font-medium text-muted-foreground">
                Approval
              </Text>
            </View>
            <StatusBadge
              label={formatApprovalStatusLabel(reservation.approvalStatus)}
              variant={getApprovalStatusVariant(reservation.approvalStatus)}
              size="sm"
            />
          </View>

          {/* Access Dimension */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Icon as={QrCode} size={13} className="text-muted-foreground" />
              <Text variant="muted" className="text-xs font-medium text-muted-foreground">
                Gate Pass
              </Text>
            </View>
            <StatusBadge
              label={formatAccessStatusLabel(reservation.accessStatus)}
              variant={getAccessStatusVariant(reservation.accessStatus)}
              size="sm"
            />
          </View>

          {/* Session / Completion Dimension */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Icon as={Hourglass} size={13} className="text-muted-foreground" />
              <Text variant="muted" className="text-xs font-medium text-muted-foreground">
                Session
              </Text>
            </View>
            <StatusBadge
              label={formatCompletionStatusLabel(reservation.completionStatus)}
              variant={getCompletionStatusVariant(reservation.completionStatus)}
              size="sm"
            />
          </View>
        </View>

        {/* Action Row */}
        {onCancelPress && isCancellable ? (
          <View className="flex-row justify-end pt-1">
            <Button
              variant="outline"
              size="sm"
              onPress={handleCancelPress}
              className="border-destructive/40 active:bg-destructive/10 px-3 py-1.5 rounded-xl"
              accessibilityRole="button"
              accessibilityLabel={`Cancel reservation ${reservationNumber}`}
            >
              <Text className="text-destructive font-semibold text-xs">Cancel Booking</Text>
            </Button>
          </View>
        ) : null}
      </View>
      )}
    </ListCard>
  );
}

export default ResidentReservationCard;
