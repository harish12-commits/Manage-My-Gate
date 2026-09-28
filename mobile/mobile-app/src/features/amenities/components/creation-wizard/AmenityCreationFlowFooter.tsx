import React from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompactWidth = width < 360;

  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      className="bg-card border-t border-border px-3.5 pt-3 flex-row items-center gap-2"
    >
      {/* Previous / Back CTA */}
      {!isFirstStep && (
        <Button
          variant="outline"
          onPress={onBack}
          disabled={loading || savingDraft}
          className="flex-1 min-w-0 h-12 rounded-2xl flex-row items-center justify-center gap-1 border-border"
          accessibilityRole="button"
          accessibilityLabel="Back to previous step"
        >
          <ArrowLeft size={16} className="text-foreground" />
          <Text className="font-bold text-foreground text-xs">Previous</Text>
        </Button>
      )}

      {/* Save Draft CTA */}
      {onSaveDraft && (allowSaveDraft !== undefined ? allowSaveDraft : true) && (
        <Button
          variant="outline"
          onPress={onSaveDraft}
          disabled={loading || savingDraft || disabled}
          className="flex-1 min-w-0 h-12 px-2 rounded-2xl flex-row items-center justify-center gap-1 border-border"
          accessibilityRole="button"
          accessibilityLabel="Save Facility as Draft"
        >
          <Bookmark size={15} className="text-primary" />
          <Text className="font-bold text-primary text-xs">
            {savingDraft ? 'Saving...' : 'Save Draft'}
          </Text>
        </Button>
      )}

      {/* Next / Submit CTA */}
      <Button
        variant="default"
        onPress={onNext}
        disabled={loading || savingDraft || disabled}
        className="flex-1 min-w-0 h-12 px-2 rounded-2xl flex-row items-center justify-center gap-1 shadow-sm"
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
            {!isCompactWidth && <CheckCircle2 size={17} className="text-primary-foreground" />}
            <Text numberOfLines={1} className="font-bold text-primary-foreground text-xs">
              {loading
                ? 'Saving...'
                : isEditing
                ? 'Update Facility'
                : 'Publish Facility'}
            </Text>
          </>
        ) : (
          <>
            <Text numberOfLines={1} className="font-bold text-primary-foreground text-xs">Continue</Text>
            {!isCompactWidth && <ArrowRight size={15} className="text-primary-foreground" />}
        )}
      </Button>
    </View>
  );
};

export default AmenityCreationFlowFooter;
