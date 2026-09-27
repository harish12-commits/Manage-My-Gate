/**
 * ResidentReservationDetailView Component - Phase 6C.3
 * Authoritative presentation view for a single AmenityReservation.
 * Renders header, access pass card, reservation details, five orthogonal dimensions,
 * pricing snapshot, and cancellation action.
 */

import React from 'react';
import { View, ScrollView } from 'react-native';
import { Calendar, Users, Clock, Building2, MapPin, AlertCircle, Ban } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import {
  AmenityReservation,
  AmenityAccessPass,
} from '../types/amenityDomain.types';
import {
  getBookingStatusVariant,
  getPaymentStatusVariant,
  getApprovalStatusVariant,
  getAccessStatusVariant,
  getCompletionStatusVariant,
} from './ResidentReservationCard';
import { ResidentAccessPassCard } from './ResidentAccessPassCard';
import { AmenityPassDetailsModal } from './AmenityPassDetailsModal';
import { useTranslation } from '@/src/utils/i18n';
import { QrCode } from 'lucide-react-native';
import {
  formatUtcToLocalDisplay,
  formatTo12Hour,
  formatApprovalStatusLabel,
  formatAccessStatusLabel,
  formatCompletionStatusLabel,
  formatBookingStatusLabel,
  formatPaymentStatusLabel,
} from '../utils/amenityStateHelpers';

export interface ResidentReservationDetailViewProps {
  reservation: AmenityReservation;
  accessPasses: AmenityAccessPass[];
  onCancelPress?: () => void;
  isCancellable?: boolean;
  className?: string;
  testID?: string;
}

export function ResidentReservationDetailView({
  reservation,
  accessPasses,
  onCancelPress,
  isCancellable = false,
  className = '',
  testID = 'resident-reservation-detail-view',
}: ResidentReservationDetailViewProps) {
  const { t } = useTranslation();
  const [passModalOpen, setPassModalOpen] = React.useState(false);

  const facilityName = reservation.facilityName || 'Amenity Facility';
  const reservationNumber = reservation.reservationNumber || reservation._id;
  const pricing = reservation.pricingSnapshot;

  const tz = reservation.facilityTimezone || 'Asia/Kolkata';
  const rawStart =
    reservation.startDateTime ||
    (reservation as any).effectiveStartDateTime ||
    (reservation as any).requestedStartDateTime;
  const rawEnd =
    reservation.endDateTime ||
    (reservation as any).effectiveEndDateTime ||
    (reservation as any).requestedEndDateTime;

  const startDisplayObj = formatUtcToLocalDisplay(rawStart, tz);
  const endDisplayObj = formatUtcToLocalDisplay(rawEnd, tz);

  const startFormatted = startDisplayObj.dateStr
    ? `${startDisplayObj.humanDate || startDisplayObj.dateStr} at ${formatTo12Hour(startDisplayObj.timeStr)}`
    : '';

  const endFormatted = endDisplayObj.dateStr
    ? `${endDisplayObj.humanDate || endDisplayObj.dateStr} at ${formatTo12Hour(endDisplayObj.timeStr)}`
    : '';

  // Calculate duration display
  const durationText = React.useMemo(() => {
    try {
      const start = new Date(reservation.startDateTime).getTime();
      const end = new Date(reservation.endDateTime).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        const diffMinutes = Math.round((end - start) / (1000 * 60));
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        if (hours > 0 && mins > 0) return `${hours} hr ${mins} mins`;
        if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
        return `${mins} mins`;
      }
    } catch {
      // Presentation only fallback
    }
    return null;
  }, [reservation.startDateTime, reservation.endDateTime]);

  const canCancel =
    Boolean(isCancellable) &&
    Boolean(onCancelPress) &&
    reservation.bookingStatus !== 'CANCELLED' &&
    reservation.bookingStatus !== 'REJECTED' &&
    reservation.completionStatus !== 'COMPLETED' &&
    reservation.completionStatus !== 'NO_SHOW' &&
    reservation.accessStatus !== 'CHECKED_OUT';

  return (
    <ScrollView
      testID={testID}
      className={`flex-1 bg-background ${className}`}
      contentContainerClassName="px-4 pt-4 pb-28 gap-4"
    >
      {/* 1. Hero Header Card */}
      <View className="bg-card p-5 rounded-3xl border border-border gap-2 shadow-xs">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 gap-1">
            <Text className="font-bold text-xl text-foreground" numberOfLines={2}>
              {facilityName}
            </Text>
            {reservation.resourceName ? (
              <View className="flex-row items-center gap-1.5">
                <Building2 size={13} className="text-primary" />
                <Text variant="muted" className="text-xs font-semibold text-primary">
                  {reservation.resourceName}
                </Text>
              </View>
            ) : null}
            <Text variant="muted" className="text-xs text-muted-foreground font-mono">
              Ref: {reservationNumber}
            </Text>
          </View>
          <StatusBadge
            label={formatBookingStatusLabel(reservation.bookingStatus)}
            variant={getBookingStatusVariant(reservation.bookingStatus)}
          />
        </View>
      </View>

      {/* Pay-at-Gate / Cash Collection Pending Notice */}
      {reservation.bookingStatus === 'CONFIRMED' &&
      reservation.paymentStatus === 'PENDING' &&
      (pricing?.totalAmount ?? 0) > 0 ? (
        <View
          testID="pay-at-gate-pending-notice"
          className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex-row items-start gap-3"
        >
          <AlertCircle size={20} className="text-amber-500 mt-0.5" />
          <View className="flex-1 gap-1">
            <Text className="font-semibold text-sm text-foreground">
              Cash Collection Pending at Gate
            </Text>
            <Text variant="muted" className="text-xs text-muted-foreground leading-relaxed">
              Your booking is confirmed. Please present your digital access pass at the gate or amenity counter to complete your cash payment before entering.
            </Text>
          </View>
        </View>
      ) : null}

      {/* 2. Digital Access Pass Section */}
      <View className="gap-2.5">
        <ResidentAccessPassCard
          passes={accessPasses}
          reservation={reservation}
          testID="detail-access-pass-card"
        />
        {accessPasses?.length > 0 || reservation.accessStatus === 'PASS_GENERATED' ? (
          <Button
            variant="outline"
            onPress={() => setPassModalOpen(true)}
            className="w-full h-11 rounded-2xl border-primary/30 bg-primary/5 active:bg-primary/10 flex-row items-center justify-center gap-2"
            accessibilityRole="button"
            accessibilityLabel="Open Pass Details and Share"
          >
            <QrCode size={16} className="text-primary" />
            <Text className="font-bold text-primary text-xs">
              {t('view_full_pass_share', 'Open Pass & Share on WhatsApp')}
            </Text>
          </Button>
        ) : null}
      </View>

      {/* 3. Authoritative Lifecycle States (Five Orthogonal Dimensions) */}
      <DetailSection
        title="Authoritative Lifecycle States"
        iconName="ShieldCheck"
        className="bg-card border border-border"
      >
        <DetailRow
          label="Booking Status"
          value={
            <StatusBadge
              label={formatBookingStatusLabel(reservation.bookingStatus)}
              variant={getBookingStatusVariant(reservation.bookingStatus)}
            />
          }
        />
        <DetailRow
          label="Payment Status"
          value={
            <StatusBadge
              label={formatPaymentStatusLabel(reservation.paymentStatus)}
              variant={getPaymentStatusVariant(reservation.paymentStatus)}
            />
          }
        />
        <DetailRow
          label="Approval Status"
          value={
            <StatusBadge
              label={formatApprovalStatusLabel(reservation.approvalStatus)}
              variant={getApprovalStatusVariant(reservation.approvalStatus)}
            />
          }
        />
        <DetailRow
          label="Access Status"
          value={
            <StatusBadge
              label={formatAccessStatusLabel(reservation.accessStatus)}
              variant={getAccessStatusVariant(reservation.accessStatus)}
            />
          }
        />
        <DetailRow
          label="Completion Status"
          value={
            <StatusBadge
              label={formatCompletionStatusLabel(reservation.completionStatus)}
              variant={getCompletionStatusVariant(reservation.completionStatus)}
            />
          }
          isLast={!reservation.rejectionReason && !reservation.cancellationReason}
        />
        {reservation.rejectionReason ? (
          <DetailRow
            label="Rejection Reason"
            value={reservation.rejectionReason}
            isLast={!reservation.cancellationReason}
          />
        ) : null}
        {reservation.cancellationReason ? (
          <DetailRow
            label="Cancellation Reason"
            value={reservation.cancellationReason}
            isLast={true}
          />
        ) : null}
      </DetailSection>

      {/* 4. Reservation Details */}
      <DetailSection
        title="Reservation Details"
        iconName="Calendar"
        className="bg-card border border-border"
      >
        <DetailRow label="Start Time" value={startFormatted} />
        <DetailRow label="End Time" value={endFormatted} />
        {durationText ? <DetailRow label="Duration" value={durationText} /> : null}
        <DetailRow label="Headcount" value={`${reservation.headcount} Guests`} />
        <DetailRow label="Quantity" value={`${reservation.quantity} Units`} />
        {reservation.userName ? (
          <DetailRow label="Reserved For" value={reservation.userName} />
        ) : null}
        {reservation.unitId ? (
          <DetailRow label="Unit / Villa" value={reservation.unitId} />
        ) : null}
        {reservation.notes ? (
          <DetailRow label="Notes" value={reservation.notes} isLast={!reservation.guests || reservation.guests.length === 0} />
        ) : null}

        {/* Guest Information */}
        {reservation.guests && reservation.guests.length > 0 ? (
          <View className="mt-2 pt-2 border-t border-border/50 gap-1.5">
            <Text variant="muted" className="text-xs font-semibold text-foreground">
              Registered Guests ({reservation.guests.length}):
            </Text>
            {reservation.guests.map((guest, idx) => (
              <View key={idx} className="flex-row items-center justify-between py-1">
                <Text className="text-xs font-medium text-foreground">{guest.name}</Text>
                {guest.phone ? (
                  <Text variant="muted" className="text-xs text-muted-foreground">{guest.phone}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </DetailSection>

      {/* 5. Server-Authoritative Pricing & Payment */}
      <DetailSection
        title="Pricing & Payment"
        iconName="CreditCard"
        className="bg-card border border-border"
      >
        <DetailRow
          label="Base Amount"
          value={`${pricing.baseAmount} ${pricing.currency}`}
        />
        {pricing.taxAmount > 0 ? (
          <DetailRow
            label="Taxes & Fees"
            value={`${pricing.taxAmount} ${pricing.currency}`}
          />
        ) : null}
        {pricing.depositAmount > 0 ? (
          <DetailRow
            label="Refundable Deposit"
            value={`${pricing.depositAmount} ${pricing.currency}`}
          />
        ) : null}
        <DetailRow
          label="Total Amount"
          value={
            <Text className="font-bold text-base text-foreground">
              {pricing.totalAmount} {pricing.currency}
            </Text>
          }
        />
        <DetailRow
          label="Payment Status"
          value={
            <StatusBadge
              label={reservation.paymentStatus}
              variant={getPaymentStatusVariant(reservation.paymentStatus)}
            />
          }
          isLast={!reservation.paymentReference}
        />
        {reservation.paymentReference ? (
          <DetailRow
            label="Payment Reference"
            value={reservation.paymentReference}
            copyable={true}
            isLast={true}
          />
        ) : null}
      </DetailSection>

      {/* 6. Cancellation Action */}
      {canCancel ? (
        <View className="mt-2">
          <Button
            variant="destructive"
            onPress={onCancelPress}
            className="w-full flex-row items-center justify-center gap-2 py-3.5 rounded-2xl"
            accessibilityRole="button"
            accessibilityLabel="Cancel Booking"
          >
            <Ban size={16} color="#ffffff" />
            <Text className="font-bold text-sm text-destructive-foreground">Cancel Booking</Text>
          </Button>
        </View>
      ) : null}

      {/* Visitor-Management-Aligned Pass Details Modal */}
      <AmenityPassDetailsModal
        visible={passModalOpen}
        reservation={reservation}
        accessPass={accessPasses?.[0] || null}
        onClose={() => setPassModalOpen(false)}
        onCancelPress={onCancelPress}
      />
    </ScrollView>
  );
}

export default ResidentReservationDetailView;
