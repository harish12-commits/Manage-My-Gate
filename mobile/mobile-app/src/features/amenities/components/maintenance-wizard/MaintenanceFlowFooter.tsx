import React from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react-native';

export interface MaintenanceFlowFooterProps {
  onBack?: () => void;
  onNext: () => void;
  canGoBack?: boolean;
  nextLabel?: string;
  isLastStep?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

export const MaintenanceFlowFooter: React.FC<MaintenanceFlowFooterProps> = ({
  onBack,
  onNext,
  canGoBack = true,
  nextLabel,
  isLastStep = false,
  loading = false,
  disabled = false,
}) => {
  const defaultLabel = isLastStep ? 'Confirm & Schedule Upkeep' : 'Continue';
  const labelText = nextLabel || defaultLabel;

  return (
    <View className="bg-card border-t border-border p-4 pb-6 gap-3">
      <View className="flex-row items-center gap-3">
        {canGoBack && onBack ? (
          <Button
            variant="outline"
            onPress={onBack}
            disabled={loading}
            className="h-12 px-4 rounded-xl flex-row items-center gap-1.5 border-border"
            accessibilityLabel="Back button"
          >
            <ArrowLeft size={16} className="text-foreground" />
            <Text className="font-semibold text-foreground">Back</Text>
          </Button>
        ) : null}

        <Button
          variant={labelText === 'Continue' ? 'continue' : 'default'}
          onPress={onNext}
          disabled={disabled || loading}
          loading={loading}
          className="flex-1 h-12 rounded-xl flex-row items-center justify-center gap-2"
          accessibilityLabel={labelText}
        >
          <Text className={`font-extrabold text-base ${labelText === 'Continue' ? 'text-foreground' : 'text-white'}`}>
            {labelText}
          </Text>
          {isLastStep ? (
            <CheckCircle2 size={18} className={labelText === 'Continue' ? 'text-foreground' : 'text-white'} />
          ) : (
            <ArrowRight size={18} className={labelText === 'Continue' ? 'text-foreground' : 'text-white'} />
          )}
        </Button>
      </View>
    </View>
  );
};

export default MaintenanceFlowFooter;
