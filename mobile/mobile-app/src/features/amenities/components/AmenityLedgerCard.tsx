/**
 * One booking in the amenity ledger: what was booked, by whom, when, and its money
 * (total, paid, balance still owed or refunded). Laid out like the visitor gate-log card.
 */

import React from 'react';
import { View } from 'react-native';
import { CalendarClock, Users, Wallet, ChevronRight } from 'lucide-react-native';
import { ListCard } from '@/components/ui/ListCard';
import type { StatusVariant } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityBooking } from '../store/amenityBookingSlice';
import { formatAmenityAmount, formatTimeRange12Hour } from '../utils/amenityStateHelpers';

export interface AmenityLedgerCardProps {
  booking: AmenityBooking;
  onPress: (booking: AmenityBooking) => void;
  className?: string;
}

const METHOD_KEYS: Record<string, [string, string]> = {
  WALLET: ['amenity_pay_method_wallet', 'Wallet'],
  RAZORPAY: ['amenity_pay_method_online', 'Online'],
  CASH: ['amenity_pay_method_cash', 'Cash at gate'],
  WAIVED: ['amenity_ledger_method_waived', 'Staff booking'],
};

/** `2026-10-01` -> `1 Oct 2026` */
export const formatLedgerDate = (date?: string) => {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00`);
  return isNaN(d.getTime()) ? date : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Money state shown on the ledger (booking cancellation wins over payment). */
export const ledgerState = (b: AmenityBooking): { key: string; label: string; variant: StatusVariant; icon: string } => {
  const any = b as any;
  if (b.status === 'CANCELLED') return { key: 'CANCELLED', label: 'Cancelled', variant: 'danger', icon: 'CircleX' };
  if (Number(any.remainingAmount || 0) > 0) return { key: 'DUE', label: 'Balance due', variant: 'warning', icon: 'Hourglass' };
  switch (String(b.paymentStatus || '').toUpperCase()) {
    case 'REFUNDED':
      return { key: 'REFUNDED', label: 'Refunded', variant: 'info', icon: 'Undo2' };
    case 'NOT_REQUIRED':
      return { key: 'FREE', label: 'Free', variant: 'neutral', icon: 'Gift' };
    case 'FAILED':
      return { key: 'FAILED', label: 'Failed', variant: 'danger', icon: 'CircleX' };
    case 'PENDING':
    case 'PARTIALLY_PAID':
      return { key: 'DUE', label: 'Balance due', variant: 'warning', icon: 'Hourglass' };
    default:
      return { key: 'PAID', label: 'Paid', variant: 'success', icon: 'CircleCheck' };
  }
};

export function AmenityLedgerCard({ booking, onPress, className }: AmenityLedgerCardProps) {
  const { t } = useTranslation();
  const b = booking as any;
  const state = ledgerState(booking);
  const ref = booking.reservationNumber || booking.bookingId || booking._id.slice(-6).toUpperCase();
  const facility = [booking.amenityName, b.resourceName].filter(Boolean).join(' · ');
  const unit = b.villaNumber || b.flatNumber;
  const [methodKey, methodLabel] = METHOD_KEYS[String(b.paymentMethod || '').toUpperCase()] || ['', ''];

  const total = Number(b.bookingAmount ?? booking.totalFee ?? 0);
  const paid = Number(b.paidAmount || 0);
  const due = Number(b.remainingAmount || 0);
  const refunded = Number(b.refundAmount || 0);

  const when = [
    formatLedgerDate(booking.date),
    booking.startTime && booking.endTime ? formatTimeRange12Hour(booking.startTime, booking.endTime) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ListCard
      testID={`ledger-row-${booking._id}`}
      title={facility || t('amenity_facility', 'Amenity Facility')}
      subtitle={`#${ref} • ${booking.residentName}${unit ? ` (${unit})` : ''}`}
      leftIcon={state.icon}
      status={{ label: t(`amenity_ledger_state_${state.key.toLowerCase()}`, state.label), variant: state.variant }}
      onPress={() => onPress(booking)}
      className={cn('mb-3', className)}
    >
      <View className="gap-2.5 pt-2 border-t border-border/40">
        {/* Booking details */}
        <View className="gap-1.5 bg-muted/20 p-2.5 rounded-xl border border-border/30">
          <View className="flex-row flex-wrap items-center justify-between gap-y-1.5">
            <View className="flex-row items-center gap-1.5">
              <CalendarClock size={13} className="text-muted-foreground" />
              <Text className="text-xs text-foreground">{when}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Users size={13} className="text-muted-foreground" />
              <Text className="text-xs text-muted-foreground">{booking.numberOfPersons || 1}</Text>
            </View>
          </View>
          {methodKey ? (
            <View className="flex-row items-center gap-1.5">
              <Wallet size={13} className="text-muted-foreground" />
              <Text className="text-xs text-muted-foreground">{t(methodKey, methodLabel)}</Text>
            </View>
          ) : null}
        </View>

        {/* Money */}
        <View className="flex-row items-end justify-between">
          <View className="gap-0.5">
            <Text className="text-[11px] text-muted-foreground">{t('amenity_payment_total', 'Total')}</Text>
            <Text className="text-sm font-semibold text-foreground">{total > 0 ? formatAmenityAmount(total) : t('amenity_payment_free', 'Free')}</Text>
          </View>
          <View className="gap-0.5 items-center">
            <Text className="text-[11px] text-muted-foreground">{t('amenity_payment_paid', 'Paid')}</Text>
            <Text className="text-sm font-semibold text-foreground">{formatAmenityAmount(paid)}</Text>
          </View>
          <View className="gap-0.5 items-end">
            <Text className="text-[11px] text-muted-foreground">
              {refunded > 0 ? t('amenity_ledger_refunded', 'Refunded') : t('amenity_payment_balance', 'Balance due')}
            </Text>
            <Text className={cn('text-sm font-bold', due > 0 ? 'text-status-warning' : 'text-foreground')}>
              {formatAmenityAmount(refunded > 0 ? refunded : due)}
            </Text>
          </View>
        </View>

        {/* Action */}
        <View className="flex-row items-center justify-end pt-1">
          <Button
            variant="outline"
            size="sm"
            onPress={() => onPress(booking)}
            className="h-8 px-3 rounded-lg flex-row items-center gap-1"
            accessibilityLabel={t('amenity_ledger_view', 'View details')}
          >
            <Text className="text-xs font-semibold text-foreground">{t('amenity_ledger_view', 'View details')}</Text>
            <ChevronRight size={13} className="text-muted-foreground" />
          </Button>
        </View>
      </View>
    </ListCard>
  );
}

export default AmenityLedgerCard;
