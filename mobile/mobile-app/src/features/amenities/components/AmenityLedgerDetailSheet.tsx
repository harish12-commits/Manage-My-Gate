/**
 * A ledger row in full: the booking and its money (total, deposit, paid and how,
 * balance still owed, refunded).
 */

import React from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityBooking } from '../store/amenityBookingSlice';
import { formatAmenityAmount, formatTimeRange12Hour } from '../utils/amenityStateHelpers';
import { formatLedgerDate, ledgerState } from './AmenityLedgerCard';

export interface AmenityLedgerDetailSheetProps {
  booking: AmenityBooking | null;
  visible: boolean;
  onClose: () => void;
}

const METHOD_KEYS: Record<string, [string, string]> = {
  WALLET: ['amenity_pay_method_wallet', 'Wallet'],
  RAZORPAY: ['amenity_pay_method_online', 'Online'],
  CASH: ['amenity_pay_method_cash', 'Cash at gate'],
  WAIVED: ['amenity_ledger_method_waived', 'Staff booking'],
};

export function AmenityLedgerDetailSheet({ booking, visible, onClose }: AmenityLedgerDetailSheetProps) {
  const { t } = useTranslation();
  if (!visible || !booking) return null;

  const b = booking as any;
  const state = ledgerState(booking);
  const ref = booking.reservationNumber || booking.bookingId || booking._id;
  const unit = b.villaNumber || b.flatNumber;
  const [methodKey, methodLabel] = METHOD_KEYS[String(b.paymentMethod || '').toUpperCase()] || ['', ''];
  const endDate = b.endDate && b.endDate !== booking.date ? ` → ${formatLedgerDate(b.endDate)}` : '';
  const deposit = Number(b.depositAmount || 0);
  const due = Number(b.remainingAmount || 0);
  const refunded = Number(b.refundAmount || 0);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('amenity_ledger_detail_title', 'Ledger entry')}>
      <View testID="ledger-detail-sheet" className="gap-3 pb-2">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-base font-bold text-foreground flex-1" numberOfLines={2}>
            {[booking.amenityName, b.resourceName].filter(Boolean).join(' · ')}
          </Text>
          <StatusBadge label={t(`amenity_ledger_state_${state.key.toLowerCase()}`, state.label)} variant={state.variant} />
        </View>

        <DetailSection title={t('amenity_admin_booking_section', 'Booking')} iconName="CalendarCheck">
          <DetailRow label={t('amenity_admin_booking_ref', 'Booking #')} value={ref} copyable />
          <DetailRow label={t('amenity_admin_resident', 'Resident')} value={booking.residentName} />
          {unit ? <DetailRow label={t('amenity_admin_unit', 'Unit')} value={String(unit)} /> : null}
          <DetailRow label={t('amenity_ledger_date', 'Date')} value={`${formatLedgerDate(booking.date)}${endDate}`} />
          <DetailRow label={t('amenity_ledger_time', 'Time')} value={formatTimeRange12Hour(booking.startTime, booking.endTime)} />
          <DetailRow label={t('amenity_admin_party', 'Party size')} value={String(booking.numberOfPersons || 1)} isLast={!b.cancellationReason} />
          {b.cancellationReason ? (
            <DetailRow label={t('amenity_admin_cancel_reason', 'Cancellation reason')} value={b.cancellationReason} isLast />
          ) : null}
        </DetailSection>

        <DetailSection title={t('amenity_payment_title', 'Payment')} iconName="CreditCard">
          <DetailRow label={t('amenity_payment_total', 'Total')} value={formatAmenityAmount(b.bookingAmount ?? booking.totalFee)} />
          {deposit > 0 ? <DetailRow label={t('amenity_payment_deposit', 'Refundable deposit')} value={formatAmenityAmount(deposit)} /> : null}
          <DetailRow label={t('amenity_payment_paid', 'Paid')} value={formatAmenityAmount(b.paidAmount)} />
          {methodKey ? <DetailRow label={t('amenity_ledger_method', 'Paid by')} value={t(methodKey, methodLabel)} /> : null}
          {due > 0 ? <DetailRow label={t('amenity_payment_balance', 'Balance due')} value={formatAmenityAmount(due)} /> : null}
          <DetailRow
            label={t('amenity_payment_refunded', 'Refunded to wallet')}
            value={formatAmenityAmount(refunded)}
            isLast
          />
        </DetailSection>

        <Button variant="outline" onPress={onClose}>
          <Text className="font-semibold text-sm">{t('amenity_ledger_close', 'Close')}</Text>
        </Button>
      </View>
    </BottomSheet>
  );
}

export default AmenityLedgerDetailSheet;
