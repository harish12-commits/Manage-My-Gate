import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Plus, RotateCcw } from 'lucide-react-native';

export interface WalletHeroCardProps {
  balance: number;
  onTopUpPress?: () => void;
  onRefundPress?: () => void;
  isVerified?: boolean;
  topUpLabel?: string;
  refundLabel?: string;
  refundDisabled?: boolean;
  className?: string;
  loading?: boolean;
}

export function WalletHeroCard({
  balance = 0,
  onTopUpPress,
  onRefundPress,
  isVerified = true,
  topUpLabel = 'Add Money',
  refundLabel = 'Refund',
  refundDisabled = false,
  className = '',
  loading = false,
}: WalletHeroCardProps) {
  const formattedBalance = `₹${balance.toLocaleString('en-IN')}`;

  return (
    <View
      className={`bg-card border border-border rounded-2xl p-5 shadow-xs mb-4 ${className}`}
    >
      {/* Header Row: Label & Verified Badge */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Available Wallet Balance
        </Text>

        {isVerified ? (
          <View className="flex-row items-center bg-status-success/15 px-2.5 py-1 rounded-full">
            <Icon as={ShieldCheck} size={12} className="text-status-success me-1 shrink-0" />
            <Text className="text-xs font-semibold text-status-success">Verified Ledger</Text>
          </View>
        ) : null}
      </View>

      {/* Main Balance Display */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        className="text-3xl font-extrabold text-foreground tracking-tight mb-4"
      >
        {formattedBalance}
      </Text>

      {/* Wallet actions use the app's orange and dark-navy controls. */}
      {onTopUpPress || onRefundPress ? (
        <View className="flex-row gap-3">
          {onTopUpPress ? (
            <Button
              variant="default"
              size="lg"
              className="flex-1"
              onPress={onTopUpPress}
              loading={loading}
              leftIcon={Plus}
              accessibilityRole="button"
              accessibilityLabel={topUpLabel}
            >
              <Text className="font-bold text-base text-primary-foreground">{topUpLabel}</Text>
            </Button>
          ) : null}
          {onRefundPress ? (
            <Button
              variant="navy"
              size="lg"
              className="flex-1"
              onPress={onRefundPress}
              disabled={refundDisabled || loading}
              leftIcon={RotateCcw}
              accessibilityRole="button"
              accessibilityLabel={refundLabel}
            >
              <Text className="font-bold text-base text-white">{refundLabel}</Text>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default WalletHeroCard;
