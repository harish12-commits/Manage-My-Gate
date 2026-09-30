/**
 * Amenity Management Phase 6B.2 - Flow Footer
 * Bottom sticky action bar with Back, Next / Proceed CTAs, and total quote preview chip.
 */

import React from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock } from 'lucide-react-native';

export interface AmenityBookingFlowFooterProps {
  onBack?: () => void;
  onNext: () => void;
  canGoBack?: boolean;
  nextLabel?: string;
  isLastStep?: boolean;
  isHoldStep?: boolean;
  priceTotal?: number;
  currency?: string;
  loading?: boolean;
  disabled?: boolean;
}

export const AmenityBookingFlowFooter: React.FC<AmenityBookingFlowFooterProps> = ({
  onBack,
  onNext,
  canGoBack = true,
  nextLabel,
  isLastStep = false,
  isHoldStep = false,
  priceTotal,
  currency = 'INR',
  loading = false,
  disabled = false,
}) => {
  const defaultLabel = isLastStep
    ? 'Done'
    : isHoldStep
    ? 'Create Hold & Proceed'
    : 'Continue';
  const labelText = nextLabel || defaultLabel;

  return (
    <View className="bg-card border-t border-border p-4 pb-6 gap-3">
      {/* Optional Price Preview Row */}
      {priceTotal !== undefined && !isLastStep ? (
        <View className="flex-row items-center justify-between pb-1">
          <Text variant="muted" className="text-xs">
            Estimated Quote:
          </Text>
          <Text className="font-bold text-sm text-primary">
            {priceTotal === 0 ? 'Free Access' : `${priceTotal} ${currency}`}
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center gap-3">
        {canGoBack && onBack ? (
          <Button
            variant="outline"
            onPress={onBack}
            disabled={loading}
            className="h-12 px-4 rounded-xl flex-row items-center gap-1.5"
            accessibilityLabel="Back button"
          >
            <ArrowLeft size={16} className="text-foreground" />
            <Text className="font-semibold text-foreground">Back</Text>
          </Button>
        ) : null}

        <Button
          variant={labelText === 'Continue' ? "continue" : "default"}
          onPress={onNext}
          disabled={disabled || loading}
          loading={loading}
          className="flex-1 h-12 rounded-xl flex-row items-center justify-center gap-2"
          accessibilityLabel={labelText}
        >
          <Text className={`font-extrabold text-base ${labelText === 'Continue' ? 'text-foreground' : 'text-primary-foreground'}`}>
            {labelText}
          </Text>
          {isHoldStep ? (
            <Lock size={16} className={labelText === 'Continue' ? 'text-foreground' : 'text-primary-foreground'} />
          ) : isLastStep ? (
            <CheckCircle2 size={18} className={labelText === 'Continue' ? 'text-foreground' : 'text-primary-foreground'} />
          ) : (
            <ArrowRight size={18} className={labelText === 'Continue' ? 'text-foreground' : 'text-primary-foreground'} />
          )}
        </Button>
      </View>
    </View>
  );
};

export default AmenityBookingFlowFooter;
