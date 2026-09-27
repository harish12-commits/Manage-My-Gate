/**
 * Amenity Management Phase 6B.2 - Step: Hold & Payment Confirmation
 * Displays live countdown derived from server expiresAt, locks actions on expiration,
 * and handles payment via existing Digital Wallet / Razorpay before confirmation.
 */

import React from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AmenityHoldState } from '../../../types/amenityDomain.types';
import { Clock, Wallet, CreditCard, Banknote, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react-native';

export interface BookingHoldPaymentStepProps {
  activeHold: AmenityHoldState | null;
  holdRemainingSeconds: number;
  isHoldExpired: boolean;
  totalAmount: number;
  currency?: string;
  paymentMethod: 'WALLET' | 'RAZORPAY' | 'PAY_AT_GATE';
  onPaymentMethodChange: (method: 'WALLET' | 'RAZORPAY' | 'PAY_AT_GATE') => void;
  balance: number;
  onOpenTopUp: () => void;
  onLaunchRazorpay: () => void;
  onConfirmReservation: () => void;
  onRestartBooking: () => void;
  confirming?: boolean;
  error?: string | null;
}

export function BookingHoldPaymentStep({
  activeHold,
  holdRemainingSeconds,
  isHoldExpired,
  totalAmount,
  currency = 'INR',
  paymentMethod,
  onPaymentMethodChange,
  balance,
  onOpenTopUp,
  onLaunchRazorpay,
  onConfirmReservation,
  onRestartBooking,
  confirming = false,
  error,
}: BookingHoldPaymentStepProps) {
  const isPaymentRequired = totalAmount > 0;
  const isBalanceSufficient = balance >= totalAmount;

  // Format countdown minutes and seconds
  const minutes = Math.floor(holdRemainingSeconds / 60);
  const seconds = holdRemainingSeconds % 60;
  const countdownFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <View className="gap-4">
      {/* Header Description */}
      <View>
        <Text variant="large" className="font-bold text-foreground">
          {isPaymentRequired ? 'Payment & Final Confirmation' : 'Confirm Your Reservation'}
        </Text>
        <Text variant="muted" className="text-xs text-muted-foreground mt-0.5">
          {isPaymentRequired
            ? 'Complete payment before your temporary hold expires.'
            : 'Review hold confirmation and activate your booking.'}
        </Text>
      </View>

      {/* Active Hold Countdown Banner */}
      {activeHold ? (
        <View
          className={`p-4 rounded-2xl border ${
            isHoldExpired
              ? 'bg-destructive/10 border-destructive/30'
              : holdRemainingSeconds < 60
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-primary/10 border-primary/30'
          }`}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Clock
                size={18}
                className={
                  isHoldExpired
                    ? 'text-destructive'
                    : holdRemainingSeconds < 60
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-primary'
                }
              />
              <Text
                className={`font-bold text-xs ${
                  isHoldExpired
                    ? 'text-destructive'
                    : holdRemainingSeconds < 60
                    ? 'text-amber-800 dark:text-amber-200'
                    : 'text-primary'
                }`}
              >
                {isHoldExpired ? 'Hold Expired' : 'Temporary Hold Active'}
              </Text>
            </View>

            <Text
              className={`font-mono font-bold text-sm ${
                isHoldExpired
                  ? 'text-destructive'
                  : holdRemainingSeconds < 60
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-primary'
              }`}
            >
              {isHoldExpired ? '00:00' : countdownFormatted}
            </Text>
          </View>

          {isHoldExpired ? (
            <View className="mt-2 pt-2 border-t border-destructive/20 gap-2">
              <Text className="text-xs text-destructive">
                Your reservation hold has expired. The selected slot has been returned to inventory.
              </Text>
              <Button
                variant="outline"
                onPress={onRestartBooking}
                className="self-start h-9 px-3 rounded-xl flex-row items-center gap-1.5"
              >
                <RotateCcw size={14} className="text-foreground" />
                <Text className="text-xs font-semibold text-foreground">Select New Slot</Text>
              </Button>
            </View>
          ) : (
            <Text variant="muted" className="text-[11px] mt-1 text-muted-foreground">
              Slot is securely locked for your account. Please complete confirmation within the time remaining.
            </Text>
          )}
        </View>
      ) : null}

      {/* Payment Options (When Total > 0) */}
      {isPaymentRequired && !isHoldExpired && (
        <View className="bg-card p-4 rounded-2xl border border-border gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-semibold text-sm text-foreground">Select Payment Method</Text>
            <Text className="font-bold text-sm text-primary">
              {totalAmount} {currency}
            </Text>
          </View>

          {/* Wallet Option */}
          <TouchableOpacity
            onPress={() => onPaymentMethodChange('WALLET')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Select digital wallet payment"
            className={`p-3.5 rounded-xl border transition-all ${
              paymentMethod === 'WALLET'
                ? 'bg-primary/5 border-primary'
                : 'bg-muted/30 border-border'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <Wallet size={18} className="text-primary" />
                <View>
                  <Text className="font-semibold text-xs text-foreground">Digital Wallet Balance</Text>
                  <Text variant="muted" className="text-[11px]">
                    Available: {balance} {currency}
                  </Text>
                </View>
              </View>

              <StatusBadge
                label={isBalanceSufficient ? 'Sufficient' : 'Low Balance'}
                variant={isBalanceSufficient ? 'success' : 'warning'}
              />
            </View>

            {/* Top Up CTA if balance insufficient */}
            {!isBalanceSufficient && paymentMethod === 'WALLET' ? (
              <View className="mt-2.5 pt-2 border-t border-border/50 flex-row items-center justify-between">
                <Text className="text-xs text-destructive font-medium">
                  Need {(totalAmount - balance).toFixed(2)} {currency} more
                </Text>
                <TouchableOpacity
                  onPress={onOpenTopUp}
                  className="px-3 py-1 bg-primary rounded-lg"
                >
                  <Text className="text-white text-xs font-bold">Top-Up</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* Razorpay Option */}
          <TouchableOpacity
            onPress={() => onPaymentMethodChange('RAZORPAY')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Select Razorpay online gateway payment"
            className={`p-3.5 rounded-xl border transition-all ${
              paymentMethod === 'RAZORPAY'
                ? 'bg-primary/5 border-primary'
                : 'bg-muted/30 border-border'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <CreditCard size={18} className="text-primary" />
                <View>
                  <Text className="font-semibold text-xs text-foreground">
                    Online Payment (Cards, UPI, NetBanking)
                  </Text>
                  <Text variant="muted" className="text-[11px]">
                    Secured by Razorpay Payment Gateway
                  </Text>
                </View>
              </View>

              <StatusBadge label="Instant" variant="info" />
            </View>
          </TouchableOpacity>

          {/* Pay-at-Gate / Cash Option */}
          <TouchableOpacity
            onPress={() => onPaymentMethodChange('PAY_AT_GATE')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Select Pay at Gate cash collection"
            className={`p-3.5 rounded-xl border transition-all ${
              paymentMethod === 'PAY_AT_GATE'
                ? 'bg-primary/5 border-primary'
                : 'bg-muted/30 border-border'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <Banknote size={18} className="text-primary" />
                <View>
                  <Text className="font-semibold text-xs text-foreground">
                    Pay at Gate (Cash Collection)
                  </Text>
                  <Text variant="muted" className="text-[11px]">
                    Pay cash at counter or gate before entry
                  </Text>
                </View>
              </View>

              <StatusBadge label="Pay Later" variant="warning" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Zero Cost Notice */}
      {!isPaymentRequired && !isHoldExpired && (
        <View className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex-row items-center gap-3">
          <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
          <View className="flex-1">
            <Text className="font-bold text-xs text-emerald-800 dark:text-emerald-200">
              Zero Payment Required
            </Text>
            <Text className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
              This facility is free of charge. Your reservation will be confirmed without any financial deduction.
            </Text>
          </View>
        </View>
      )}

      {/* Error Banner */}
      {error ? (
        <View className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 flex-row items-center gap-2">
          <AlertTriangle size={16} className="text-destructive" />
          <Text className="text-xs text-destructive font-medium flex-1">{error}</Text>
        </View>
      ) : null}

      {/* Confirmation CTA */}
      <Button
        variant="default"
        onPress={
          paymentMethod === 'RAZORPAY' && isPaymentRequired ? onLaunchRazorpay : onConfirmReservation
        }
        disabled={isHoldExpired || confirming || (isPaymentRequired && paymentMethod === 'WALLET' && !isBalanceSufficient)}
        loading={confirming}
        className="w-full h-12 rounded-xl mt-2"
        accessibilityLabel="Confirm Reservation Button"
      >
        <Text className="font-bold text-base text-primary-foreground">
          {confirming
            ? 'Confirming Reservation...'
            : isHoldExpired
            ? 'Hold Expired'
            : isPaymentRequired
            ? paymentMethod === 'PAY_AT_GATE'
              ? `Confirm Booking • Pay at Gate (${totalAmount} ${currency})`
              : `Pay & Confirm Booking (${totalAmount} ${currency})`
            : 'Confirm Free Reservation'}
        </Text>
      </Button>
    </View>
  );
}

export default BookingHoldPaymentStep;
