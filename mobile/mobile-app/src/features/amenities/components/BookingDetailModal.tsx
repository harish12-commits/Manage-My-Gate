import React from 'react';
import { View, ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { DetailRow } from '@/components/ui/DetailRow';
import { StatusBadge, StatusVariant } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityBooking } from '../store/amenityBookingSlice';
import { formatTimeRange12Hour } from '../utils/amenityStateHelpers';

export interface BookingDetailModalProps {
  visible: boolean;
  onClose: () => void;
  booking: AmenityBooking | null;
  onCancelClick?: (booking: AmenityBooking) => void;
}

export function BookingDetailModal({
  visible,
  onClose,
  booking,
  onCancelClick,
}: BookingDetailModalProps) {
  const { user } = useSelector((state: RootState) => state.auth || {});
  const { t } = useTranslation();

  if (!visible || !booking) return null;

  const amenityName =
    typeof booking.amenityId === 'object' && booking.amenityId
      ? booking.amenityId.name
      : booking.amenityName || 'Amenity Slot';

  const amenityLocation =
    typeof booking.amenityId === 'object' && booking.amenityId
      ? booking.amenityId.location || 'Community Facilities'
      : booking.amenityLocation || 'Community Facilities';

  const userObj = typeof booking.userId === 'object' && booking.userId ? booking.userId : null;
  const residentName = booking.residentName || userObj?.name || userObj?.username || (booking as any).userName || 'Community Resident';
  const villaNumber = (booking as any).villaNumber || (booking as any).flatNumber || userObj?.villaNumber || userObj?.flatNumber || userObj?.unit || '—';

  const isConfirmed = booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED';
  const statusLabel = isConfirmed ? 'CONFIRMED' : booking.status;
  const statusVariant: StatusVariant = isConfirmed ? 'success' : booking.status === 'COMPLETED' ? 'neutral' : 'danger';

  const isPaid = booking.paymentStatus !== 'REFUNDED';
  const paymentStatusLabel = isPaid ? 'PAID' : booking.paymentStatus || 'PAID';
  const paymentVariant: StatusVariant = isPaid ? 'success' : 'neutral';

  const bookingIdDisplay = booking.bookingId || booking._id;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('reservation_details', 'Reservation Details')}>
      <View className="py-1">
        <View className="flex-row items-center justify-between mb-3 bg-card p-3 rounded-xl border border-border">
          <View>
            <Text className="text-base font-bold text-foreground">{amenityName}</Text>
            <Text variant="muted" className="text-xs text-muted-foreground">
              {amenityLocation}
            </Text>
          </View>
          <StatusBadge label={statusLabel} variant={statusVariant} />
        </View>

        {/* Complete Information Section */}
        <View className="bg-muted/20 p-3.5 rounded-2xl border border-border/40 mb-4">
          <DetailRow
            label={t('resident_name', 'Resident Name')}
            value={residentName}
            iconName="User"
          />
          <DetailRow
            label={t('villa_flat_number', 'Villa / Flat Number')}
            value={villaNumber}
            iconName="Home"
          />
          <DetailRow label={t('booking_code', 'Booking Code')} value={bookingIdDisplay} copyable={true} iconName="Hash" />
          <DetailRow label={t('reservation_date', 'Reservation Date')} value={booking.date || booking.bookingDate || ''} iconName="Calendar" />
          <DetailRow
            label={t('time_window', 'Time Window')}
            value={
              booking.startTime && booking.endTime
                ? formatTimeRange12Hour(booking.startTime, booking.endTime)
                : booking.startTime || booking.endTime
                ? formatTimeRange12Hour(booking.startTime || booking.endTime)
                : 'Full Day'
            }
            iconName="Clock"
          />
          <DetailRow
            label={t('attendees', 'Attendees')}
            value={`${booking.numberOfPersons || booking.guestsCount || 1} Person(s)`}
            iconName="Users"
          />
          <DetailRow
            label={t('total_amount', 'Total Amount')}
            value={booking.totalFee ? `₹${booking.totalFee.toFixed(2)}` : 'Free'}
            iconName="CreditCard"
          />
          <DetailRow label={t('payment_method', 'Payment Method')} value={booking.paymentMethod || 'ONLINE'} iconName="Wallet" />
          <DetailRow
            label={t('payment_status', 'Payment Status')}
            value={<StatusBadge label={paymentStatusLabel} variant={paymentVariant} size="sm" />}
          />
          {(booking as any).notes ? (
            <DetailRow label="Admin Notes" value={(booking as any).notes} iconName="FileText" />
          ) : null}
          {(booking as any).cancellationReason ? (
            <DetailRow
              label="Cancel Reason"
              value={(booking as any).cancellationReason}
              iconName="AlertTriangle"
              isLast={true}
            />
          ) : (
            <DetailRow label={t('pass_code', 'Pass Code')} value={booking.qrCode || bookingIdDisplay} copyable={true} iconName="QrCode" isLast={true} />
          )}
        </View>

        {/* Footer CTAs */}
        <View className="mt-1 mb-2">
          <Button variant="default" onPress={onClose} className="w-full bg-primary py-3">
            <Text className="text-white font-bold text-sm">Close</Text>
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
}

export default BookingDetailModal;
