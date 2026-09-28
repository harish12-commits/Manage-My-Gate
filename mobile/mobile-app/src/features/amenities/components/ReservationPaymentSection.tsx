/**
 * Booking payment summary for residents: price, deposit, what has been paid (and how),
 * the balance still due with its pay actions, refunds and the deposit settlement.
 * Every amount is the server's; residents never enter one.
 */

import React from 'react';
import { View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityReservation } from '../types/amenityDomain.types';
import { getPaymentStatusVariant } from './ResidentReservationCard';
import { formatAmenityAmount, formatPaymentStatusLabel } from '../utils/amenityStateHelpers';

export interface ReservationPaymentSectionProps {
  reservation: AmenityReservation;
  canPayBalance?: boolean;
  walletBalance?: number;
  isRazorpayConfigured?: boolean;
  paying?: boolean;
  error?: string | null;
  onPayFromWallet?: () => void;
  onPayOnline?: () => void;
}

const METHOD_KEYS: Record<string, [string, string]> = {
  WALLET: ['amenity_pay_method_wallet', 'Wallet'],
  RAZORPAY: ['amenity_pay_method_online', 'Online'],
  CASH: ['amenity_pay_method_cash', 'Cash at gate'],
};

export function ReservationPaymentSection({
  reservation,
  canPayBalance = false,
  walletBalance = 0,
  isRazorpayConfigured = false,
  paying = false,
  error = null,
  onPayFromWallet,
  onPayOnline,
}: ReservationPaymentSectionProps) {
  const { t } = useTranslation();
  const total = Number(reservation.totalAmount ?? reservation.pricingSnapshot?.totalAmount ?? 0);
  const deposit = Number(
    reservation.amountSchedule?.depositAmount ?? reservation.depositAmount ?? reservation.pricingSnapshot?.depositAmount ?? 0
  );
  const price = Number(reservation.amountSchedule?.priceAmount ?? total - deposit);
  const paid = Number(reservation.paidAmount || 0);
  // Older bookings have no balance field: whatever is unpaid on a PENDING booking is due.
  const balance = Number(
    reservation.balanceAmount ?? (reservation.paymentStatus === 'PENDING' ? Math.max(total - paid, 0) : 0)
  );
  const refund = Number(reservation.refundAmount || 0);
  const payments = reservation.payments || [];
  const settlement = reservation.depositSettlement;
  const isActive = ['CONFIRMED', 'PENDING_APPROVAL'].includes(reservation.bookingStatus);

  if (total <= 0 && paid <= 0) {
    return (
      <DetailSection title={t('amenity_payment_title', 'Payment')} iconName="CreditCard">
        <DetailRow label={t('amenity_payment_total', 'Total')} value={t('amenity_payment_free', 'Free')} isLast />
      </DetailSection>
    );
  }

  return (
    <View className="gap-3">
      {isActive && balance > 0 ? (
        <View
          testID="pay-at-gate-pending-notice"
          className="bg-status-warning/10 border border-status-warning/30 p-4 rounded-2xl gap-3"
        >
          <View className="flex-row items-start gap-3">
            <AlertCircle size={20} className="text-status-warning mt-0.5" />
            <View className="flex-1 gap-1">
              <Text className="font-semibold text-sm text-foreground">
                {t('amenity_balance_due_title', 'Balance due: {amount}', { amount: formatAmenityAmount(balance) })}
              </Text>
              <Text variant="muted" className="text-xs leading-relaxed">
                {canPayBalance
                  ? t('amenity_balance_due_body', 'Pay now, or pay at the gate before entry. The gate pass works once the balance is paid.')
                  : t('amenity_balance_due_gate', 'Pay at the gate before entry. The gate pass works once the balance is paid.')}
              </Text>
            </View>
          </View>

          {canPayBalance ? (
            <View className="gap-2">
              <Button
                onPress={onPayFromWallet}
                disabled={paying}
                accessibilityLabel={t('amenity_balance_pay_wallet', 'Pay {amount} from wallet', { amount: formatAmenityAmount(balance) })}
              >
                <Text className="font-bold text-sm text-primary-foreground">
                  {t('amenity_balance_pay_wallet', 'Pay {amount} from wallet', { amount: formatAmenityAmount(balance) })}
                </Text>
              </Button>
              <Text variant="muted" className="text-xs text-center">
                {t('amenity_balance_wallet_available', 'Wallet balance: {amount}', { amount: formatAmenityAmount(walletBalance) })}
              </Text>
              {isRazorpayConfigured ? (
                <Button
                  variant="outline"
                  onPress={onPayOnline}
                  disabled={paying}
                  accessibilityLabel={t('amenity_balance_pay_online', 'Pay {amount} online', { amount: formatAmenityAmount(balance) })}
                >
                  <Text className="font-semibold text-sm">
                    {t('amenity_balance_pay_online', 'Pay {amount} online', { amount: formatAmenityAmount(balance) })}
                  </Text>
                </Button>
              ) : null}
            </View>
          ) : null}
          {error ? <ErrorBanner title={t('amenity_balance_err_title', 'Payment not completed')} message={error} /> : null}
        </View>
      ) : null}

      <DetailSection title={t('amenity_payment_title', 'Payment')} iconName="CreditCard">
        <DetailRow label={t('amenity_payment_price', 'Booking price')} value={formatAmenityAmount(price)} />
        {deposit > 0 ? (
          <DetailRow label={t('amenity_payment_deposit', 'Refundable deposit')} value={formatAmenityAmount(deposit)} />
        ) : null}
        <DetailRow
          label={t('amenity_payment_total', 'Total')}
          value={<Text className="font-bold text-base text-foreground">{formatAmenityAmount(total)}</Text>}
        />
        <DetailRow label={t('amenity_payment_paid', 'Paid')} value={formatAmenityAmount(paid)} />
        {balance > 0 ? (
          <DetailRow label={t('amenity_payment_balance', 'Balance due')} value={formatAmenityAmount(balance)} />
        ) : null}
        {refund > 0 ? (
          <DetailRow
            label={t('amenity_payment_refunded', 'Refunded to wallet')}
            value={
              reservation.refundPercentage != null
                ? `${formatAmenityAmount(refund)} (${reservation.refundPercentage}%)`
                : formatAmenityAmount(refund)
            }
          />
        ) : null}
        {settlement?.settledAt && deposit > 0 ? (
          <DetailRow
            label={t('amenity_payment_deposit_settled', 'Deposit')}
            value={
              Number(settlement.retained || 0) > 0
                ? t('amenity_payment_deposit_retained', '{refunded} returned, {retained} kept', {
                    refunded: formatAmenityAmount(settlement.refunded),
                    retained: formatAmenityAmount(settlement.retained),
                  })
                : t('amenity_payment_deposit_returned', '{amount} returned', { amount: formatAmenityAmount(settlement.refunded) })
            }
          />
        ) : null}
        {settlement?.notes ? (
          <DetailRow label={t('amenity_payment_deposit_notes', 'Inspection notes')} value={settlement.notes} />
        ) : null}
        <DetailRow
          label={t('amenity_payment_status', 'Payment status')}
          value={
            <StatusBadge
              label={formatPaymentStatusLabel(reservation.paymentStatus)}
              variant={getPaymentStatusVariant(reservation.paymentStatus)}
            />
          }
          isLast={payments.length === 0 && !reservation.paymentReference}
        />
        {reservation.paymentReference ? (
          <DetailRow
            label={t('amenity_payment_reference', 'Payment reference')}
            value={reservation.paymentReference}
            copyable
            isLast={payments.length === 0}
          />
        ) : null}

        {payments.length > 0 ? (
          <View className="mt-2 pt-2 border-t border-border/50 gap-1.5">
            <Text variant="muted" className="text-xs font-semibold text-foreground">
              {t('amenity_payment_history', 'Payments')}
            </Text>
            {payments.map((p, idx) => {
              const [key, fallback] = METHOD_KEYS[p.method] || ['', p.method];
              return (
                <View key={`${p.method}-${idx}`} className="flex-row items-center justify-between py-1">
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-foreground">
                      {p.purpose === 'BALANCE'
                        ? t('amenity_payment_purpose_balance', 'Balance')
                        : t('amenity_payment_purpose_booking', 'Booking')}
                      {' · '}
                      {key ? t(key, fallback) : fallback}
                    </Text>
                    {p.receiptNumber ? (
                      <Text variant="muted" className="text-xs">
                        {t('amenity_payment_receipt', 'Receipt {number}', { number: p.receiptNumber })}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="text-xs font-semibold text-foreground">{formatAmenityAmount(p.amount)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </DetailSection>
    </View>
  );
}

export default ReservationPaymentSection;
