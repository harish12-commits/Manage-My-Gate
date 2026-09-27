import React from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ArrowRight, ArrowLeft, CheckCircle2, Bookmark } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

export interface CommunityEngagementFlowFooterProps {
  onBack: () => void;
  onNext: () => void;
  onSaveDraft?: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  isEditMode?: boolean;
  loading?: boolean;
  savingDraft?: boolean;
  disabled?: boolean;
  publishNow?: boolean;
}

export const CommunityEngagementFlowFooter: React.FC<CommunityEngagementFlowFooterProps> = ({
  onBack,
  onNext,
  onSaveDraft,
  isFirstStep,
  isLastStep,
  isEditMode = false,
  loading = false,
  savingDraft = false,
  disabled = false,
  publishNow = true,
}) => {
  const { t } = useTranslation();
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
          <Text className="font-bold text-foreground text-xs" numberOfLines={1}>{t('previous', 'Previous')}</Text>
        </Button>
      )}

      {/* Save Draft CTA */}
      {onSaveDraft && (
        <Button
          variant="outline"
          onPress={onSaveDraft}
          disabled={loading || savingDraft || disabled}
          className="flex-1 min-w-0 h-12 px-2 rounded-2xl flex-row items-center justify-center gap-1 border-border"
          accessibilityRole="button"
          accessibilityLabel="Save as Draft"
        >
          <Bookmark size={15} className="text-primary" />
          <Text className="font-bold text-primary text-xs" numberOfLines={1}>
            {savingDraft ? t('saving', 'Saving...') : t('save_draft', 'Save Draft')}
          </Text>
        </Button>
      )}

      {/* Next / Publish CTA */}
      <Button
        variant="default"
        onPress={onNext}
        disabled={loading || savingDraft || disabled}
        className="flex-1 min-w-0 h-12 px-2 rounded-2xl flex-row items-center justify-center gap-1 shadow-sm"
        accessibilityRole="button"
        accessibilityLabel={
          isLastStep
            ? isEditMode
              ? 'Save Changes'
              : publishNow
              ? 'Publish Announcement Now'
              : 'Schedule Announcement'
            : 'Continue to next step'
        }
      >
        {isLastStep ? (
          <>
            {!isCompactWidth && <CheckCircle2 size={17} className="text-primary-foreground shrink-0" />}
            <Text numberOfLines={1} className="font-bold text-primary-foreground text-xs">
              {loading
                ? t('saving', 'Saving...')
                : isEditMode
                ? t('save_changes', 'Save Changes')
                : publishNow
                ? t('publish_now', 'Publish Now')
                : t('schedule_for_later', 'Schedule Content')}
            </Text>
          </>
        ) : (
          <>
            <Text numberOfLines={1} className="font-bold text-primary-foreground text-xs">{t('continue', 'Continue')}</Text>
            {!isCompactWidth && <ArrowRight size={15} className="text-primary-foreground shrink-0" />}
          </>
        )}
      </Button>
    </View>
  );
};

export default CommunityEngagementFlowFooter;
