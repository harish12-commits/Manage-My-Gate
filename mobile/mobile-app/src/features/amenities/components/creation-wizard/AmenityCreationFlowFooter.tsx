import React from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ArrowRight, ArrowLeft, CheckCircle2, Bookmark } from 'lucide-react-native';

export interface AmenityCreationFlowFooterProps {
  onBack: () => void;
  onNext: () => void;
  onSaveDraft?: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  loading?: boolean;
  savingDraft?: boolean;
  disabled?: boolean;
  isEditing?: boolean;
  allowSaveDraft?: boolean;
}

export const AmenityCreationFlowFooter: React.FC<AmenityCreationFlowFooterProps> = ({
  onBack,
  onNext,
  onSaveDraft,
  isFirstStep,
  isLastStep,
  loading = false,
  savingDraft = false,
  disabled = false,
  isEditing = false,
  allowSaveDraft,
}) => {
  return (
    <View className="bg-card border-t border-border px-3 py-2.5 pb-6 flex-row items-center gap-1.5">
      {/* Previous / Back CTA */}
      {!isFirstStep && (
        <Button
          variant="outline"
          onPress={onBack}
          disabled={loading || savingDraft}
          className="flex-1 h-11 sm:h-12 rounded-2xl flex-row items-center justify-center gap-1 px-2 border-border"
          accessibilityRole="button"
          accessibilityLabel="Back to previous step"
        >
          <ArrowLeft size={14} className="text-foreground shrink-0" />
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={1}
            className="font-bold text-foreground text-xs sm:text-sm"
          >
            Previous
          </Text>
        </Button>
      )}

      {/* Save Draft CTA */}
      {onSaveDraft && (allowSaveDraft !== undefined ? allowSaveDraft : true) && (
        <Button
          variant="secondary"
          onPress={onSaveDraft}
          disabled={loading || savingDraft || disabled}
          className="h-11 sm:h-12 px-2.5 rounded-2xl flex-row items-center justify-center gap-1 border border-border"
          accessibilityRole="button"
          accessibilityLabel="Save Facility as Draft"
        >
          <Bookmark size={14} className="text-foreground shrink-0" />
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={1}
            className="font-bold text-foreground text-xs"
          >
            {savingDraft ? 'Saving...' : 'Save Draft'}
          </Text>
        </Button>
      )}

      {/* Next / Submit CTA */}
      <Button
        variant="default"
        onPress={onNext}
        disabled={loading || savingDraft || disabled}
        className="flex-1 h-11 sm:h-12 rounded-2xl flex-row items-center justify-center gap-1 px-2 shadow-sm"
        accessibilityRole="button"
        accessibilityLabel={
          isLastStep
            ? isEditing
              ? 'Save Facility Updates'
              : 'Publish Facility to Catalog'
            : 'Continue to next step'
        }
      >
        {isLastStep ? (
          <>
            <CheckCircle2 size={16} className="text-primary-foreground shrink-0" />
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              numberOfLines={1}
              className="font-bold text-primary-foreground text-xs sm:text-sm"
            >
              {loading
                ? 'Saving...'
                : isEditing
                ? 'Update Facility'
                : 'Publish Facility'}
            </Text>
          </>
        ) : (
          <>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              numberOfLines={1}
              className="font-bold text-primary-foreground text-xs sm:text-sm"
            >
              Continue
            </Text>
            <ArrowRight size={14} className="text-primary-foreground shrink-0" />
          </>
        )}
      </Button>
    </View>
  );
};

export default AmenityCreationFlowFooter;
