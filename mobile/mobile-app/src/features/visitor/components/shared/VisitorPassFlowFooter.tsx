import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

export interface VisitorPassFlowFooterProps {
  onBack?: () => void;
  onNext: () => void;
  canGoBack?: boolean;
  nextLabel?: string;
  isLastStep?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

export const VisitorPassFlowFooter: React.FC<VisitorPassFlowFooterProps> = ({
  onBack,
  onNext,
  canGoBack = true,
  nextLabel,
  isLastStep = false,
  loading = false,
  disabled = false,
}) => {
  const insets = useSafeAreaInsets();
  const { t, translateText } = useTranslation();
  const defaultNextLabel = isLastStep ? t('generate_visitor_pass', 'Generate Visitor Pass') : t('continue', 'Continue');
  const labelText = nextLabel ? translateText(nextLabel) : defaultNextLabel;

  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
      className="bg-card border-t border-border p-4 flex-row items-center gap-3 z-30"
    >
      {canGoBack && onBack ? (
        <Button
          variant="outline"
          onPress={onBack}
          disabled={loading}
          className="h-11 sm:h-12 px-3.5 rounded-xl flex-row items-center gap-1.5"
        >
          <ArrowLeft size={16} className="text-foreground shrink-0" />
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={1}
            className="font-semibold text-foreground text-sm"
          >
            {t('back', 'Back')}
          </Text>
        </Button>
      ) : null}

      <Button
        variant="default"
        onPress={onNext}
        disabled={disabled || loading}
        loading={loading}
        className="flex-1 h-11 sm:h-12 rounded-xl flex-row items-center justify-center gap-1.5 px-3"
      >
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          numberOfLines={1}
          className="font-bold text-primary-foreground text-sm sm:text-base flex-1 text-center"
        >
          {labelText}
        </Text>
        {isLastStep ? (
          <CheckCircle2 size={16} className="text-primary-foreground shrink-0" />
        ) : (
          <ArrowRight size={16} className="text-primary-foreground shrink-0" />
        )}
      </Button>
    </View>
  );
};

export default VisitorPassFlowFooter;
