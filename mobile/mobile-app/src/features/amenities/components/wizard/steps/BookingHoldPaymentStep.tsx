/**
 * Booking wizard step: hold countdown and payment. Amounts come from the server's
 * payment schedule: what is due now (advance + deposit, or the full price), and any
 * balance that is paid later online or collected at the gate. Residents never enter
 * an amount; when nothing is due online the booking is simply confirmed.
 */

import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { RadioGroup } from '@/components/forms/RadioGroup';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Clock, RotateCcw } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityHoldState, AmenityAmountSchedule } from '../../../types/amenityDomain.types';
import type { BookingPaymentMethod } from '../../../hooks/useAmenityBookingWizard';

export interface BookingHoldPaymentStepProps {
  activeHold: AmenityHoldState | null;
  holdRemainingSeconds: number;
  isHoldExpired: boolean;
  schedule: AmenityAmountSchedule | null;
  currency?: string;
  paymentMethod: BookingPaymentMethod;
  onPaymentMethodChange: (method: BookingPaymentMethod) => void;
  balance: number;
  isRazorpayConfigured?: boolean;
  onOpenTopUp: () => void;
  onConfirm: () => void;
  onRestartBooking: () => void;
  confirming?: boolean;
  error?: string | null;
  /** Staff booking for this resident: no charge, no payment options. */
  staffBookingFor?: string | null;
}

const money = (n: number, currency: string) => `₹${Number(n || 0).toLocaleString('en-IN')}${currency && currency !== 'INR' ? ` ${currency}` : ''}`;

export function BookingHoldPaymentStep({
  activeHold,
  holdRemainingSeconds,
  isHoldExpired,
  schedule,
  currency = 'INR',
  paymentMethod,
  onPaymentMethodChange,
  balance,
  isRazorpayConfigured = false,
  onOpenTopUp,
  onConfirm,
  onRestartBooking,
  confirming = false,
  error,
  staffBookingFor = null,
}: BookingHoldPaymentStepProps) {
  const { t } = useTranslation();
  const dueNow = Number(schedule?.dueNowAmount || 0);
  const isStaffBooking = Boolean(staffBookingFor);
  const balanceLater = isStaffBooking ? 0 : Number(schedule?.balanceAmount || 0);
  const deposit = Number(schedule?.depositAmount || 0);
  const mustPayNow = !isStaffBooking && dueNow > 0;
  const walletShort = mustPayNow && paymentMethod === 'WALLET' && balance < dueNow;

  const minutes = Math.floor(holdRemainingSeconds / 60);
  const seconds = holdRemainingSeconds % 60;
  const countdown = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const methodOptions = [
    {
      value: 'WALLET',
      label: t('amenity_booking_pay_wallet', 'Digital Wallet'),
      description: t('amenity_booking_pay_wallet_balance', 'Balance: {amount}', { amount: money(balance, currency) }),
    },
    ...(isRazorpayConfigured
      ? [
          {
            value: 'RAZORPAY',
            label: t('amenity_booking_pay_online', 'Pay online'),
            description: t('amenity_booking_pay_online_sub', 'Card, UPI or net banking'),
          },
        ]
      : []),
  ];

  const ctaLabel = isHoldExpired
    ? t('amenity_booking_hold_expired', 'Hold expired')
    : !mustPayNow
      ? t('amenity_booking_confirm_cta', 'Confirm booking')
      : paymentMethod === 'RAZORPAY'
        ? t('amenity_booking_pay_online_cta', 'Pay {amount} online', { amount: money(dueNow, currency) })
        : t('amenity_booking_pay_wallet_cta', 'Pay {amount} from wallet', { amount: money(dueNow, currency) });

  return (
    <View className="gap-4">
      {activeHold ? (
        <View
          className={`p-4 rounded-2xl border ${
            isHoldExpired ? 'bg-destructive/10 border-destructive/30' : 'bg-primary/10 border-primary/30'
          }`}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Clock size={18} className={isHoldExpired ? 'text-destructive' : 'text-primary'} />
              <Text className={`font-bold text-xs ${isHoldExpired ? 'text-destructive' : 'text-primary'}`}>
                {isHoldExpired
                  ? t('amenity_booking_hold_expired', 'Hold expired')
                  : t('amenity_booking_hold_active', 'Your time is held')}
              </Text>
            </View>
            <Text
              className={`font-mono font-bold text-sm ${isHoldExpired ? 'text-destructive' : 'text-primary'}`}
              accessibilityLabel={t('amenity_booking_hold_countdown', 'Hold time remaining')}
            >
              {isHoldExpired ? '00:00' : countdown}
            </Text>
          </View>
          {isHoldExpired ? (
            <Button variant="outline" size="sm" onPress={onRestartBooking} className="self-start mt-3 flex-row gap-1.5">
              <RotateCcw size={14} className="text-foreground" />
              <Text className="text-xs font-semibold text-foreground">{t('amenity_booking_pick_again', 'Choose a new time')}</Text>
            </Button>
          ) : null}
        </View>
      ) : null}

      {isStaffBooking ? (
        <View testID="staff-booking-notice" className="bg-status-info/10 border border-status-info/30 p-4 rounded-2xl gap-1">
          <Text className="font-semibold text-sm text-foreground">
            {t('amenity_booking_staff_for', 'Booking for {name}', { name: staffBookingFor })}
          </Text>
          <Text variant="muted" className="text-xs">
            {t('amenity_booking_staff_free', 'Bookings made by amenity staff are free of charge and confirmed straight away.')}
          </Text>
        </View>
      ) : null}

      <DetailSection title={t('amenity_booking_amounts', 'Amounts')} className="bg-card border border-border">
        {schedule ? (
          <>
            <DetailRow label={t('amenity_booking_price', 'Booking price')} value={money(schedule.priceAmount, currency)} />
            {deposit > 0 ? (
              <DetailRow label={t('amenity_booking_deposit', 'Refundable deposit')} value={money(deposit, currency)} />
            ) : null}
            <DetailRow
              label={t('amenity_booking_due_now', 'Due now')}
              value={
                <StatusBadge
                  label={
                    isStaffBooking
                      ? t('amenity_booking_no_charge', 'No charge')
                      : mustPayNow
                        ? money(dueNow, currency)
                        : t('amenity_booking_nothing_now', 'Nothing now')
                  }
                  variant={mustPayNow ? 'info' : 'success'}
                />
              }
            />
            {balanceLater > 0 ? (
              <DetailRow
                label={t('amenity_booking_balance_later', 'Balance')}
                value={money(balanceLater, currency)}
                isLast
              />
            ) : null}
          </>
        ) : null}
      </DetailSection>

      {balanceLater > 0 ? (
        <Text variant="muted" className="text-xs">
          {schedule?.mode === 'PAY_AT_GATE'
            ? t('amenity_booking_balance_gate_note', 'Pay {amount} at the gate before entry.', { amount: money(balanceLater, currency) })
            : t('amenity_booking_balance_note', 'Pay the balance of {amount} online before your booking, or at the gate before entry.', {
                amount: money(balanceLater, currency),
              })}
        </Text>
      ) : null}

      {mustPayNow && !isHoldExpired ? (
        <View className="bg-card p-4 rounded-2xl border border-border gap-3">
          <Text className="font-semibold text-sm text-foreground">{t('amenity_booking_pay_with', 'Pay with')}</Text>
          <RadioGroup
            options={methodOptions}
            value={paymentMethod}
            onValueChange={(v) => onPaymentMethodChange(v as BookingPaymentMethod)}
          />
          {walletShort ? (
            <View className="flex-row items-center justify-between pt-2 border-t border-border/50">
              <Text className="text-xs text-destructive font-medium flex-1 me-2">
                {t('amenity_booking_wallet_short', 'Add {amount} to your wallet to pay.', { amount: money(dueNow - balance, currency) })}
              </Text>
              <Button variant="outline" size="sm" onPress={onOpenTopUp} accessibilityLabel={t('amenity_booking_top_up', 'Top up wallet')}>
                <Text className="text-xs font-semibold text-foreground">{t('amenity_booking_top_up', 'Top up wallet')}</Text>
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

      <Button
        onPress={onConfirm}
        disabled={isHoldExpired || confirming || walletShort}
        loading={confirming}
        className="w-full h-12 rounded-xl"
        accessibilityLabel={t('amenity_booking_confirm_button', 'Confirm booking')}
      >
        <Text className="font-bold text-base text-primary-foreground">{ctaLabel}</Text>
      </Button>
    </View>
  );
}

export default BookingHoldPaymentStep;
