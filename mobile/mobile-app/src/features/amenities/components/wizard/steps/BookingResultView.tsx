import React from 'react';
import { View, ScrollView, Share } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { QRCodeView } from '@/components/ui/QRCodeView';
import {
  AmenityFacility,
  AmenityReservation,
  AmenityAccessPass,
} from '../../../types/amenityDomain.types';
import {
  formatApprovalStatusLabel,
  formatAccessStatusLabel,
  formatCompletionStatusLabel,
  formatBookingStatusLabel,
  formatPaymentStatusLabel,
  formatReservationDate,
  formatReservationTimeRange,
} from '../../../utils/amenityStateHelpers';
import { CheckCircle2, AlertCircle, Clock, QrCode, Share2 } from 'lucide-react-native';

export interface BookingResultViewProps {
  facility: AmenityFacility;
  reservation: AmenityReservation | null;
  accessPasses: AmenityAccessPass[];
  isPassEligible: boolean;
  onDone: () => void;
  onViewBookings: () => void;
}

export function BookingResultView({
  facility,
  reservation,
  accessPasses,
  isPassEligible,
  onDone,
  onViewBookings,
}: BookingResultViewProps) {
  if (!reservation) {
    return (
      <View className="items-center justify-center p-6">
        <Text variant="muted">No reservation details available.</Text>
      </View>
    );
  }

  const rawBookingStatus = String(reservation.bookingStatus || (reservation as any).status || 'CONFIRMED');
  const rawPaymentStatus = String(reservation.paymentStatus || 'PENDING').toUpperCase();
  const rawPaymentMethod = String((reservation as any).paymentMethod || '').toUpperCase();
  const isPendingApproval = rawBookingStatus === 'PENDING_APPROVAL' || rawBookingStatus === 'PENDING';
  const isConfirmed = rawBookingStatus === 'CONFIRMED' || rawBookingStatus === 'APPROVED';
  const isRejected = rawBookingStatus === 'REJECTED' || rawBookingStatus === 'CANCELLED';
  const isPayAtGatePending = isConfirmed && (rawPaymentStatus === 'PENDING' || rawPaymentStatus === 'PAYMENT_DUE') && (rawPaymentMethod === 'PAY_AT_GATE' || rawPaymentMethod === 'CASH');

  const primaryPass = accessPasses?.[0];

  const handleSharePass = async () => {
    try {
      const passCode = primaryPass?.passCode || reservation.reservationNumber || reservation._id;
      const facilityName = facility?.name || 'Amenity Pass';
      const validUntilStr = primaryPass?.validUntil ? new Date(primaryPass.validUntil).toLocaleString() : 'As scheduled';
      const message = `Gate Access Pass for ${facilityName}\nPass Code: ${passCode}\nValid Until: ${validUntilStr}\nPresent this code or QR scanner at community entry gate.`;
      await Share.share({
        title: `Amenity Pass - ${facilityName}`,
        message,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
      {/* Hero Status Card */}
      <View
        className={`items-center rounded-3xl border p-6 text-center ${
          isPayAtGatePending
            ? 'border-amber-500/30 bg-amber-500/10'
            : isConfirmed
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : isPendingApproval
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-destructive/30 bg-destructive/10'
        }`}>
        <View
          className={`mb-3 h-14 w-14 items-center justify-center rounded-full ${
            isPayAtGatePending
              ? 'bg-amber-500/20'
              : isConfirmed
              ? 'bg-emerald-500/20'
              : isPendingApproval
                ? 'bg-amber-500/20'
                : 'bg-destructive/20'
          }`}>
          {isPayAtGatePending ? (
            <Clock size={32} className="text-amber-600 dark:text-amber-400" />
          ) : isConfirmed ? (
            <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
          ) : isPendingApproval ? (
            <Clock size={32} className="text-amber-600 dark:text-amber-400" />
          ) : (
            <AlertCircle size={32} className="text-destructive" />
          )}
        </View>

        <Text variant="h2" className="text-center font-bold text-foreground">
          {isPayAtGatePending
            ? 'Booking Confirmed — Cash Collection Pending'
            : isConfirmed
            ? 'Reservation Confirmed!'
            : isPendingApproval
              ? 'Booking Pending Review'
              : 'Reservation Rejected'}
        </Text>

        <Text variant="muted" className="mt-1 max-w-xs text-center text-xs text-muted-foreground">
          {isPayAtGatePending
            ? 'Present the booking pass at the designated facility/gate and complete the cash payment according to the facility process.'
            : isConfirmed
            ? 'Your facility reservation is active. Keep your pass ready for gate access.'
            : isPendingApproval
              ? 'Your request requires administrative approval. You will be notified once reviewed.'
              : reservation.rejectionReason || 'Your booking request could not be approved.'}
        </Text>
      </View>

      {/* Access Pass QR Presentation (When Eligible & Returned) */}
      {isPassEligible && (primaryPass?.qrData || reservation._id) ? (
        <View className="items-center gap-3 rounded-3xl border border-border bg-card p-6">
          <View className="flex-row items-center justify-between w-full">
            <View className="flex-row items-center gap-2">
              <QrCode size={18} className="text-primary" />
              <Text className="font-bold text-sm text-foreground">Digital Access Pass</Text>
            </View>
            <Button
              variant="outline"
              size="sm"
              onPress={handleSharePass}
              className="flex-row items-center gap-1.5 h-8 px-3 rounded-full border-primary/40 bg-primary/5 active:bg-primary/10">
              <Share2 size={13} className="text-primary" />
              <Text className="text-xs font-bold text-primary">Share</Text>
            </Button>
          </View>

          {(() => {
            const raw = primaryPass?.qrData || primaryPass?.passCode || reservation.reservationNumber || reservation._id;
            const qrValue = raw && String(raw).startsWith('MMG:AMENITY:') ? String(raw) : `MMG:AMENITY:${raw}`;
            return (
              <QRCodeView
                value={qrValue}
                size={180}
                caption={`Pass Code: ${primaryPass?.passCode || reservation.reservationNumber || reservation._id}`}
              />
            );
          })()}

          <View className="mt-1 flex-row items-center gap-2">
            <StatusBadge label={primaryPass?.status || 'ACTIVE'} variant="success" dot />
            {primaryPass?.validUntil ? (
              <Text variant="muted" className="text-[11px]">
                Valid until: {new Date(primaryPass.validUntil).toLocaleTimeString()}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Five Orthogonal Reservation Dimensions */}
      <DetailSection
        title="Authoritative Reservation States"
        className="border border-border bg-card">
        <DetailRow
          label="Booking Status"
          value={
            <StatusBadge
              label={formatBookingStatusLabel(reservation.bookingStatus)}
              variant={isConfirmed ? 'success' : isPendingApproval ? 'warning' : 'danger'}
            />
          }
        />
        <DetailRow
          label="Payment Status"
          value={
            <StatusBadge
              label={formatPaymentStatusLabel(reservation.paymentStatus)}
              variant={
                reservation.paymentStatus === 'PAID' || reservation.paymentStatus === 'NOT_REQUIRED'
                  ? 'success'
                  : reservation.paymentStatus === 'FAILED'
                    ? 'danger'
                    : 'warning'
              }
            />
          }
        />
        <DetailRow
          label="Approval Status"
          value={
            <StatusBadge
              label={formatApprovalStatusLabel(reservation.approvalStatus)}
              variant={
                reservation.approvalStatus === 'APPROVED' ||
                reservation.approvalStatus === 'NOT_REQUIRED'
                  ? 'success'
                  : reservation.approvalStatus === 'REJECTED'
                    ? 'danger'
                    : 'warning'
              }
            />
          }
        />
        <DetailRow
          label="Access Status"
          value={
            <StatusBadge
              label={formatAccessStatusLabel(reservation.accessStatus)}
              variant={
                reservation.accessStatus === 'PASS_GENERATED' ||
                reservation.accessStatus === 'CHECKED_IN'
                  ? 'success'
                  : reservation.accessStatus === 'ACCESS_REVOKED'
                    ? 'danger'
                    : 'neutral'
              }
            />
          }
        />
        <DetailRow
          label="Completion Status"
          value={
            <StatusBadge
              label={formatCompletionStatusLabel(reservation.completionStatus)}
              variant={
                reservation.completionStatus === 'COMPLETED'
                  ? 'success'
                  : reservation.completionStatus === 'NO_SHOW' ||
                      reservation.completionStatus === 'ABANDONED'
                    ? 'danger'
                    : 'neutral'
              }
            />
          }
          isLast
        />
      </DetailSection>

      {/* Booking Summary */}
      <DetailSection title="Booking Details" className="border border-border bg-card">
        <DetailRow label="Facility" value={facility.name} />
        {reservation.reservationNumber ? (
          <DetailRow label="Reservation #" value={reservation.reservationNumber} />
        ) : null}
        {formatReservationDate(
          reservation.startDateTime || (reservation as any).effectiveStartDateTime,
          facility.timezone || reservation.facilityTimezone || 'Asia/Kolkata'
        ) ? (
          <DetailRow
            label="Date"
            value={formatReservationDate(
              reservation.startDateTime || (reservation as any).effectiveStartDateTime,
              facility.timezone || reservation.facilityTimezone || 'Asia/Kolkata'
            )}
          />
        ) : null}
        {formatReservationTimeRange(
          reservation.startDateTime || (reservation as any).effectiveStartDateTime,
          reservation.endDateTime || (reservation as any).effectiveEndDateTime,
          facility.timezone || reservation.facilityTimezone || 'Asia/Kolkata'
        ) ? (
          <DetailRow
            label="Time"
            value={formatReservationTimeRange(
              reservation.startDateTime || (reservation as any).effectiveStartDateTime,
              reservation.endDateTime || (reservation as any).effectiveEndDateTime,
              facility.timezone || reservation.facilityTimezone || 'Asia/Kolkata'
            )}
          />
        ) : null}
        <DetailRow label="Headcount" value={String(reservation.headcount || 1)} />
        {reservation.paymentReference ? (
          <DetailRow label="Payment Ref" value={reservation.paymentReference} isLast />
        ) : null}
      </DetailSection>

      {/* Action Buttons */}
      <View className="gap-2.5 pt-2">
        <Button variant="default" onPress={onViewBookings} className="h-12 w-full rounded-xl">
          <Text className="font-bold text-base text-primary-foreground">View My Bookings</Text>
        </Button>

        <Button
          variant="outline"
          onPress={onDone}
          className="h-12 w-full rounded-xl"
          accessibilityRole="button"
          accessibilityLabel="Close and return to front page"
        >
          <Text className="font-semibold text-foreground">Close</Text>
        </Button>
      </View>
    </ScrollView>
  );
}

export default BookingResultView;
