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
      router.push(`/(resident)/billing/invoice/${item.invoiceId}` as any);
    } else if (item.type === 'AMENITY') {
      router.push('/(resident)/amenities/my-bookings' as any);
    } else if (item.type === 'WALLET_TRANSACTION' || item.type === 'REFUND') {
      router.push('/(resident)/billing/wallet' as any);
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
            {item.isCredit ? 'Credit Amount' : 'Transaction Amount'}
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
          <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
            <Text className="text-xs text-muted-foreground">Date & Time</Text>
            <Text className="text-xs font-semibold text-foreground">{dateFormatted}</Text>
          </View>

          {/* Common ID Row */}
          <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
            <Text className="text-xs text-muted-foreground">Reference ID</Text>
            <Text className="text-xs font-mono font-bold text-foreground">{item.id}</Text>
          </View>

          {/* Invoice Domain Fields */}
          {item.type === 'INVOICE' && (
            <>
              <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                <Text className="text-xs text-muted-foreground">Invoice Number</Text>
                <Text className="text-xs font-bold text-foreground">#{item.invoiceNumber}</Text>
              </View>

              {item.unitNumber && (
                <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                  <Text className="text-xs text-muted-foreground">Unit / Villa</Text>
                  <Text className="text-xs font-semibold text-foreground">Villa {item.unitNumber}</Text>
                </View>
              )}

              <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                <Text className="text-xs text-muted-foreground">Amount Paid</Text>
                <Text className="text-xs font-bold text-status-success">
                  ₹{item.paidAmount.toLocaleString('en-IN')}
                </Text>
              </View>

              <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                <Text className="text-xs text-muted-foreground">Remaining Balance</Text>
                <Text className="text-xs font-bold text-foreground">
                  ₹{item.outstandingAmount.toLocaleString('en-IN')}
                </Text>
              </View>

              {item.paymentMethod && (
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">Payment Method</Text>
                  <Text className="text-xs font-semibold text-foreground">{item.paymentMethod}</Text>
                </View>
              )}

              {item.status === 'VERIFICATION_PENDING' ? (
                <View className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <Text className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Offline payment submitted. Pending management verification.
                  </Text>
                </View>
              ) : null}
            </>
          )}

          {/* Amenity Domain Fields */}
          {item.type === 'AMENITY' && (
            <>
              <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                <Text className="text-xs text-muted-foreground">Facility</Text>
                <Text className="text-xs font-bold text-foreground">{item.facilityName}</Text>
              </View>

              <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                <Text className="text-xs text-muted-foreground">Booking ID</Text>
                <Text className="text-xs font-mono font-bold text-foreground">#{item.bookingId}</Text>
              </View>

              {item.bookingDate && (
                <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                  <Text className="text-xs text-muted-foreground">Reserved Date</Text>
                  <Text className="text-xs font-semibold text-foreground">{item.bookingDate}</Text>
                </View>
              )}

              {item.timeSlot && (
                <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                  <Text className="text-xs text-muted-foreground">Time Window</Text>
                  <Text className="text-xs font-semibold text-foreground">{item.timeSlot}</Text>
                </View>
              )}

              <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                <Text className="text-xs text-muted-foreground">Booking Status</Text>
                <StatusBadge label={item.bookingStatus} variant={getStatusVariant(item.bookingStatus)} />
              </View>

              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Payment Status</Text>
                <StatusBadge label={item.paymentStatus} variant={getStatusVariant(item.paymentStatus)} />
              </View>

              {item.paymentMethod && (
                <View className="flex-row justify-between items-center pt-2 border-t border-border/50">
                  <Text className="text-xs text-muted-foreground">Payment Method</Text>
                  <Text className="text-xs font-semibold text-foreground">
                    {item.paymentMethod === 'PAY_AT_GATE' ? 'Pay at Gate (Cash)' : item.paymentMethod}
                  </Text>
                </View>
              )}

              {item.paymentMethod === 'PAY_AT_GATE' && item.paymentStatus === 'PENDING' ? (
                <View className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <Text className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Cash collection pending. Present your access pass at the gate or counter to pay.
                  </Text>
                </View>
              ) : null}
            </>
          )}

          {/* Wallet Domain Fields */}
          {item.type === 'WALLET_TRANSACTION' && (
            <>
              <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                <Text className="text-xs text-muted-foreground">Transaction Type</Text>
                <Text className="text-xs font-bold text-foreground">{item.direction}</Text>
              </View>

              <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                <Text className="text-xs text-muted-foreground">Category</Text>
                <Text className="text-xs font-semibold text-foreground">{item.referenceType}</Text>
              </View>

              {item.referenceId && (
                <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                  <Text className="text-xs text-muted-foreground">Associated Reference</Text>
                  <Text className="text-xs font-mono text-foreground">#{item.referenceId.slice(-8)}</Text>
                </View>
              )}

              {item.paymentMethod && (
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">Payment Method</Text>
                  <Text className="text-xs font-semibold text-foreground">{item.paymentMethod}</Text>
                </View>
              )}
            </>
          )}

          {/* Refund Domain Fields */}
          {item.type === 'REFUND' && (
            <>
              <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                <Text className="text-xs text-muted-foreground">Refund Source</Text>
                <Text className="text-xs font-bold text-foreground">{item.sourceDomain}</Text>
              </View>

              <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
                <Text className="text-xs text-muted-foreground">Refunded Amount</Text>
                <Text className="text-xs font-bold text-status-success">
                  +₹{item.refundAmount.toLocaleString('en-IN')}
                </Text>
              </View>

              {item.referenceId && (
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">Original Transaction</Text>
                  <Text className="text-xs font-mono text-foreground">#{item.referenceId.slice(-8)}</Text>
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
              accessibilityLabel="View In-App Receipt"
            >
              <Receipt size={16} color="#ffffff" />
              <Text className="font-bold text-primary-foreground">View In-App Receipt</Text>
            </Button>
          )}

          <Button
            variant="outline"
            onPress={handleNavigateToDomain}
            className="flex-row items-center justify-center gap-2"
            accessibilityRole="button"
            accessibilityLabel="Open Details Screen"
          >
            <ExternalLink size={16} className="text-foreground" />
            <Text className="font-bold text-foreground">
              {item.type === 'INVOICE'
                ? 'Open Invoice Details'
                : item.type === 'AMENITY'
                ? 'Open Amenity Bookings'
                : 'Open Wallet Statement'}
            </Text>
          </Button>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

export default FinancialHistoryDetailModal;
