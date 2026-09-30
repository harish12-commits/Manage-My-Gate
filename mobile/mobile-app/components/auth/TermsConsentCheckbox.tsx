import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Check } from 'lucide-react-native';
import { cn } from '../../lib/utils';

export interface TermsConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onPressTerms: () => void;
  onPressPrivacy: () => void;
  className?: string;
}

export const TermsConsentCheckbox = ({
  checked,
  onCheckedChange,
  onPressTerms,
  onPressPrivacy,
  className,
}: TermsConsentCheckboxProps) => {
  return (
    <View className={cn('flex-row items-start', className)}>
      <Pressable
        onPress={() => onCheckedChange(!checked)}
        className={cn(
          'me-3 mt-0.5 h-5 w-5 items-center justify-center rounded-md border',
          checked 
            ? 'border-primary bg-primary' 
            : 'border-border bg-card'
        )}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        {checked && <Check size={13} className="text-primary-foreground" />}
      </Pressable>
      
      <Text className="flex-1 text-sm font-sans text-muted-foreground leading-5">
        I agree to the{' '}
        <Text 
          onPress={onPressTerms}
          className="font-semibold text-primary underline"
        >
          Terms of Service
        </Text>
        {' '}and{' '}
        <Text 
          onPress={onPressPrivacy}
          className="font-semibold text-primary underline"
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
};
