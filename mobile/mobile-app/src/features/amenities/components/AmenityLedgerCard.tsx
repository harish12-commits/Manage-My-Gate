import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { ListCard } from '@/components/ui/ListCard';
import { StatusBadge, StatusVariant } from '@/components/ui/StatusBadge';
import { AmenityBooking } from '../store/amenityBookingSlice';

export interface AmenityLedgerCardProps {
  booking: AmenityBooking;
  onPress: () => void;
  className?: string;
}

export function AmenityLedgerCard({ booking, onPress, className }: AmenityLedgerCardProps) {
  const amenityObj = typeof booking.amenityId === 'object' && booking.amenityId ? booking.amenityId : null;
  const amenityName = amenityObj?.name || booking.amenityName || (booking as any).amenity?.name || 'Amenity Facility';

  const userObj = typeof booking.userId === 'object' && booking.userId ? booking.userId : null;
  const residentName =
    booking.residentName ||
    userObj?.name ||
    userObj?.username ||
    (booking as any).userName ||
    'Resident';

  const villaNum =
    (booking as any).villaNumber ||
    (booking as any).flatNumber ||
    userObj?.villaNumber ||
    userObj?.flatNumber ||
    userObj?.unit ||
    '—';

  const bookingCode = booking.bookingId ? `#${booking.bookingId}` : `#${booking._id.slice(-6).toUpperCase()}`;
  const personsCount = booking.numberOfPersons || (booking as any).guestsCount || 1;
  const subtitle = `${residentName} (${villaNum}) • ${booking.date || booking.bookingDate || 'Recent'} • ${personsCount} P`;

  const rawStatus = (booking.status || '').toUpperCase();
  const isCancelled = rawStatus === 'CANCELLED' || rawStatus === 'REJECTED';
  const statusLabel = isCancelled ? 'CANCELLED' : rawStatus === 'COMPLETED' ? 'COMPLETED' : rawStatus === 'CHECKED_IN' || rawStatus === 'CHECKED-IN' ? 'CHECKED IN' : 'CONFIRMED';
  const statusVariant: StatusVariant = isCancelled ? 'danger' : rawStatus === 'COMPLETED' ? 'neutral' : rawStatus.includes('CHECK') ? 'info' : 'success';

  const rawPaymentStatus = String(booking.paymentStatus || (isCancelled ? 'REFUNDED' : 'PAID')).toUpperCase();
  const paymentStatus = rawPaymentStatus === 'CAPTURED' || rawPaymentStatus === 'SUCCESS' ? 'PAID' : rawPaymentStatus;
  const paymentVariant: StatusVariant =
    paymentStatus === 'PAID' || paymentStatus === 'COMPLETED'
      ? 'success'
      : paymentStatus === 'REFUNDED'
      ? 'neutral'
      : 'warning';

  const feeAmount = Number(
    booking.bookingAmount ??
    booking.totalFee ??
    (booking as any).totalPrice ??
    (booking as any).pricingDetails?.totalAmount ??
    (booking as any).totalAmount ??
    (booking as any).amount ??
    0
  );
  const formattedFee = feeAmount > 0 ? `₹${feeAmount.toLocaleString('en-IN')}` : 'Free';

  // Dynamic status icon
  let leftIcon = 'Receipt';
  if (isCancelled) {
    leftIcon = 'CircleX';
  } else if (booking.status === 'COMPLETED') {
    leftIcon = 'CircleCheck';
  } else if (booking.status === 'CHECKED_IN') {
    leftIcon = 'Clock';
  }

  return (
    <ListCard
      title={`${bookingCode} • ${amenityName}`}
      subtitle={subtitle}
      leftIcon={leftIcon}
      status={{
        label: statusLabel,
        variant: statusVariant,
      }}
      timestamp={
        booking?.startTime && booking?.endTime
          ? `${booking.startTime} - ${booking.endTime}`
          : booking?.startTime || booking?.endTime || ''
      }
      onPress={onPress}
      className={className}
      rightContent={
        <View className="items-end justify-center ms-2 gap-1 shrink-0">
          <Text className="text-foreground font-bold text-base">{formattedFee}</Text>
          <StatusBadge label={paymentStatus} variant={paymentVariant} size="sm" />
        </View>
      }
    />
  );
}

export default AmenityLedgerCard;
