/**
 * NAHOM / Connect Harmony - Mobile Phase 3: FinancialHistoryDetailModal
 * Rich bottom sheet displaying authoritative details per domain.
 * Strictly presentation-only: never modifies underlying records.
 */

import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { StatusBadge, getStatusVariant } from '@/components/ui/StatusBadge';
import { FinancialHistoryItem } from '../types/financialHistory.types';
import { Receipt, ExternalLink } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

export interface FinancialHistoryDetailModalProps {
  visible: boolean;
  item: FinancialHistoryItem | null;
  onClose: () => void;
  onOpenReceipt?: (invoice: any) => void;
}

export function FinancialHistoryDetailModal({
  visible,
  item,
  onClose,
  onOpenReceipt,
}: FinancialHistoryDetailModalProps) {
  const router = useRouter();
  const { t } = useTranslation();

  if (!item) return null;

  const dateFormatted = item.createdAt
    ? new Date(item.createdAt).toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Recent';

  const statusVariant = getStatusVariant(item.status);
  const statusLabel = item.status.replace(/_/g, ' ');
  const absAmount = Math.abs(item.amount || 0);

  const handleNavigateToDomain = () => {
    onClose();
    if (item.type === 'INVOICE') {
      router.navigate(`/(resident)/billing/invoice/${item.invoiceId}` as any);
    } else if (item.type === 'AMENITY') {
      router.navigate('/(resident)/amenities/my-bookings' as any);
    } else if (item.type === 'WALLET_TRANSACTION' || item.type === 'REFUND') {
      router.navigate('/(resident)/billing/wallet' as any);
    }
  };

  const handleViewReceipt = () => {
    if (item.type === 'INVOICE' && onOpenReceipt) {
      onOpenReceipt(item.rawInvoice);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={item.title}>
      <ScrollView className="py-2 pb-4">
        {/* Header Hero Amount Card */}
        <View className="bg-muted/30 border border-border rounded-2xl p-5 items-center justify-center mb-4">
          <Text className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">
            {item.isCredit ? t('credit_amount', 'Credit Amount') : t('transaction_amount', 'Transaction Amount')}
          </Text>
          <Text
            className={`text-3xl font-black ${
              item.isCredit ? 'text-status-success' : 'text-foreground'
            }`}
          >
            {item.isCredit ? '+' : ''}₹{absAmount.toLocaleString('en-IN')}
          </Text>
          <View className="mt-2.5">
            <StatusBadge label={statusLabel} variant={statusVariant} dot />
          </View>
        </View>

        {/* Domain-Specific Details Grid */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-3 mb-4">
          {/* Common Date Row */}
          <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
            <Text className="text-xs text-muted-foreground shrink-0">{t('date_and_time', 'Date & Time')}</Text>
            <Text className="text-xs font-semibold text-foreground text-right flex-1 min-w-0 truncate">{dateFormatted}</Text>
          </View>

          {/* Common ID Row */}
          <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
            <Text className="text-xs text-muted-foreground shrink-0">{t('reference_id', 'Reference ID')}</Text>
            <Text className="text-xs font-mono font-bold text-foreground text-right flex-1 min-w-0 truncate">{item.id}</Text>
          </View>

          {/* Invoice Domain Fields */}
          {item.type === 'INVOICE' && (
            <>
              <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                <Text className="text-xs text-muted-foreground shrink-0">{t('invoice_number', 'Invoice Number')}</Text>
                <Text className="text-xs font-bold text-foreground text-right flex-1 min-w-0 truncate">#{item.invoiceNumber}</Text>
              </View>

              {item.unitNumber && (
                <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                  <Text className="text-xs text-muted-foreground shrink-0">{t('unit_villa', 'Unit / Villa')}</Text>
                  <Text className="text-xs font-semibold text-foreground text-right flex-1 min-w-0 truncate">Villa {item.unitNumber}</Text>
                </View>
              )}

              <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                <Text className="text-xs text-muted-foreground shrink-0">{t('amount_paid', 'Amount Paid')}</Text>
                <Text className="text-xs font-bold text-status-success text-right flex-1 min-w-0 truncate">
                  ₹{item.paidAmount.toLocaleString('en-IN')}
                </Text>
              </View>

              <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                <Text className="text-xs text-muted-foreground shrink-0">{t('remaining_balance', 'Remaining Balance')}</Text>
                <Text className="text-xs font-bold text-foreground text-right flex-1 min-w-0 truncate">
                  ₹{item.outstandingAmount.toLocaleString('en-IN')}
                </Text>
              </View>

              {item.paymentMethod && (
                <View className="flex-row justify-between items-center gap-2">
                  <Text className="text-xs text-muted-foreground shrink-0">{t('payment_method', 'Payment Method')}</Text>
                  <Text className="text-xs font-semibold text-foreground text-right flex-1 min-w-0 truncate">{item.paymentMethod}</Text>
                </View>
              )}

              {item.status === 'VERIFICATION_PENDING' ? (
                <View className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <Text className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    {t('offline_payment_submitted_pending', 'Offline payment submitted. Pending management verification.')}
                  </Text>
                </View>
              ) : null}
            </>
          )}

          {/* Amenity Domain Fields */}
          {item.type === 'AMENITY' && (
            <>
              <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                <Text className="text-xs text-muted-foreground shrink-0">{t('facility', 'Facility')}</Text>
                <Text className="text-xs font-bold text-foreground text-right flex-1 min-w-0 truncate">{item.facilityName}</Text>
              </View>

              <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                <Text className="text-xs text-muted-foreground shrink-0">{t('booking_id', 'Booking ID')}</Text>
                <Text className="text-xs font-mono font-bold text-foreground text-right flex-1 min-w-0 truncate">#{item.bookingId}</Text>
              </View>

              {item.bookingDate && (
                <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                  <Text className="text-xs text-muted-foreground shrink-0">{t('reserved_date', 'Reserved Date')}</Text>
                  <Text className="text-xs font-semibold text-foreground text-right flex-1 min-w-0 truncate">{item.bookingDate}</Text>
                </View>
              )}

              {item.timeSlot && (
                <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                  <Text className="text-xs text-muted-foreground shrink-0">{t('time_window', 'Time Window')}</Text>
                  <Text className="text-xs font-semibold text-foreground text-right flex-1 min-w-0 truncate">{item.timeSlot}</Text>
                </View>
              )}

              <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                <Text className="text-xs text-muted-foreground shrink-0">{t('booking_status', 'Booking Status')}</Text>
                <StatusBadge label={item.bookingStatus} variant={getStatusVariant(item.bookingStatus)} />
              </View>

              <View className="flex-row justify-between items-center gap-2">
                <Text className="text-xs text-muted-foreground shrink-0">{t('payment_status', 'Payment Status')}</Text>
                <StatusBadge label={item.paymentStatus} variant={getStatusVariant(item.paymentStatus)} />
              </View>

              {item.paymentMethod && (
                <View className="flex-row justify-between items-center pt-2 border-t border-border/50 gap-2">
                  <Text className="text-xs text-muted-foreground shrink-0">{t('payment_method', 'Payment Method')}</Text>
                  <Text className="text-xs font-semibold text-foreground text-right flex-1 min-w-0 truncate">
                    {item.paymentMethod === 'PAY_AT_GATE' ? `${t('status_pay_at_gate', 'Pay at Gate')} (${t('cash', 'Cash')})` : item.paymentMethod}
                  </Text>
                </View>
              )}

              {item.paymentMethod === 'PAY_AT_GATE' && item.paymentStatus === 'PENDING' ? (
                <View className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <Text className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    {t('cash_collection_pending_notice', 'Cash collection pending. Present your access pass at the gate or counter to pay.')}
                  </Text>
                </View>
              ) : null}
            </>
          )}

          {/* Wallet Domain Fields */}
          {item.type === 'WALLET_TRANSACTION' && (
            <>
              <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                <Text className="text-xs text-muted-foreground shrink-0">{t('transaction_type', 'Transaction Type')}</Text>
                <Text className="text-xs font-bold text-foreground text-right flex-1 min-w-0 truncate">{item.direction}</Text>
              </View>

              <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                <Text className="text-xs text-muted-foreground shrink-0">{t('category', 'Category')}</Text>
                <Text className="text-xs font-semibold text-foreground text-right flex-1 min-w-0 truncate">{item.referenceType}</Text>
              </View>

              {item.referenceId && (
                <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                  <Text className="text-xs text-muted-foreground shrink-0">{t('associated_reference', 'Associated Reference')}</Text>
                  <Text className="text-xs font-mono text-foreground text-right flex-1 min-w-0 truncate">#{item.referenceId.slice(-8)}</Text>
                </View>
              )}

              {item.paymentMethod && (
                <View className="flex-row justify-between items-center gap-2">
                  <Text className="text-xs text-muted-foreground shrink-0">{t('payment_method', 'Payment Method')}</Text>
                  <Text className="text-xs font-semibold text-foreground text-right flex-1 min-w-0 truncate">{item.paymentMethod}</Text>
                </View>
              )}
            </>
          )}

          {/* Refund Domain Fields */}
          {item.type === 'REFUND' && (
            <>
              <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                <Text className="text-xs text-muted-foreground shrink-0">{t('refund_source', 'Refund Source')}</Text>
                <Text className="text-xs font-bold text-foreground text-right flex-1 min-w-0 truncate">{item.sourceDomain}</Text>
              </View>

              <View className="flex-row justify-between items-center pb-2 border-b border-border/50 gap-2">
                <Text className="text-xs text-muted-foreground shrink-0">{t('refunded_amount', 'Refunded Amount')}</Text>
                <Text className="text-xs font-bold text-status-success text-right flex-1 min-w-0 truncate">
                  +₹{item.refundAmount.toLocaleString('en-IN')}
                </Text>
              </View>

              {item.referenceId && (
                <View className="flex-row justify-between items-center gap-2">
                  <Text className="text-xs text-muted-foreground shrink-0">{t('original_transaction', 'Original Transaction')}</Text>
                  <Text className="text-xs font-mono text-foreground text-right flex-1 min-w-0 truncate">#{item.referenceId.slice(-8)}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Action Buttons */}
        <View className="gap-2.5">
          {item.type === 'INVOICE' && (
            <Button
              variant="default"
              onPress={handleViewReceipt}
              className="flex-row items-center justify-center gap-2"
              accessibilityRole="button"
              accessibilityLabel={t('view_in_app_receipt', 'View In-App Receipt')}
            >
              <Receipt size={16} color="#ffffff" />
              <Text className="font-bold text-primary-foreground">{t('view_in_app_receipt', 'View In-App Receipt')}</Text>
            </Button>
          )}

          <Button
            variant="outline"
            onPress={handleNavigateToDomain}
            className="flex-row items-center justify-center gap-2"
            accessibilityRole="button"
            accessibilityLabel={t('open_details_screen', 'Open Details Screen')}
          >
            <ExternalLink size={16} className="text-foreground" />
            <Text className="font-bold text-foreground">
              {item.type === 'INVOICE'
                ? t('open_invoice_details', 'Open Invoice Details')
                : item.type === 'AMENITY'
                ? t('open_amenity_bookings', 'Open Amenity Bookings')
                : t('open_wallet_statement', 'Open Wallet Statement')}
            </Text>
          </Button>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

export default FinancialHistoryDetailModal;
