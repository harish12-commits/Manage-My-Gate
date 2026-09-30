import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { ArrowLeft, X, Sliders } from 'lucide-react-native';

interface AssessmentFlowHeaderProps {
  stepTitle: string;
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onCancel: () => void;
}

export const AssessmentFlowHeader: React.FC<AssessmentFlowHeaderProps> = ({
  stepTitle,
  currentStep,
  totalSteps,
  onBack,
  onCancel,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-row items-center justify-between px-5 py-4 border-b border-border bg-card">
      <View className="flex-row items-center">
        {currentStep > 0 ? (
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            className="w-9 h-9 rounded-xl bg-muted/60 items-center justify-center me-3"
            accessibilityRole="button"
            accessibilityLabel="Go back to previous step"
          >
            <Icon as={ArrowLeft} size={18} className="text-foreground" />
          </TouchableOpacity>
        ) : (
          <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center me-3">
            <Icon as={Sliders} size={18} className="text-primary" />
          </View>
        )}

        <View>
          <Text className="text-base font-extrabold text-foreground">{stepTitle}</Text>
          <Text className="text-xs font-semibold text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onCancel}
        activeOpacity={0.7}
        className="w-8 h-8 rounded-full bg-muted/60 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Cancel assessment wizard"
      >
        <Icon as={X} size={18} className="text-muted-foreground" />
      </TouchableOpacity>
    </View>
  );
};

export default AssessmentFlowHeader;
