import React, { useState, useEffect } from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { CommunityEngagementFlowHeader } from './CommunityEngagementFlowHeader';
import { CommunityEngagementStepIndicator } from './CommunityEngagementStepIndicator';
import { CommunityEngagementFlowFooter } from './CommunityEngagementFlowFooter';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { AudienceStep } from './steps/AudienceStep';
import { ScheduleStep } from './steps/ScheduleStep';
import { NoticeConfigStep } from './steps/NoticeConfigStep';
import { PollConfigStep } from './steps/PollConfigStep';
import { ReviewPreviewStep } from './steps/ReviewPreviewStep';
import { useCommunityEngagementWizard } from '../hooks/useCommunityEngagementWizard';
import { EngagementContentType } from '../types/communityEngagement.types';
import { AppLoader } from '@/components/ui/AppLoader';

export interface CommunityEngagementWizardProps {
  initialType?: EngagementContentType;
  initialItem?: any;
  mode?: 'create' | 'edit';
  editId?: string;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

export const CommunityEngagementWizard: React.FC<CommunityEngagementWizardProps> = ({
  initialType = 'NOTICE',
  initialItem,
  mode = 'create',
  editId,
  onClose,
  onSuccess,
}) => {
  const {
    isEditMode,
    contentType,
    formData,
    steps,
    currentStep,
    currentStepIndex,
    isFirstStep,
    isLastStep,
    previewData,
    loadingItem,
    previewLoading,
    submitting,
    error,
    success,
    createdResult,
    selectType,
    initializeForEdit,
    loadAndInitializeForEdit,
    setField,
    goNext,
    goBack,
    goToStepIndex,
    saveDraft,
    publishOrSchedule,
    reset,
    clearError,
  } = useCommunityEngagementWizard();

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  // Initialize with initialType or existing item for edit on mount
  useEffect(() => {
    if (mode === 'edit' || editId || initialItem) {
      if (initialItem) {
        initializeForEdit(initialItem, initialType);
      } else if (editId) {
        loadAndInitializeForEdit(editId, initialType).catch((err: any) => {
          setStepError(err || 'Failed to load content for editing');
        });
      }
    } else {
      selectType(initialType);
    }
  }, [
    mode,
    editId,
    initialItem,
    initialType,
    initializeForEdit,
    loadAndInitializeForEdit,
    selectType,
  ]);

  // Handle successful submission
  useEffect(() => {
    if (success && createdResult) {
      if (onSuccess) {
        onSuccess(createdResult);
      } else {
        onClose();
      }
      reset();
    }
  }, [success, createdResult, onSuccess, onClose, reset]);

  const handleNext = () => {
    setStepError(null);
    clearError();

    if (isLastStep) {
      // Final submit (Publish / Schedule)
      publishOrSchedule().catch((err) => {
        setStepError(err?.message || 'Failed to submit content');
      });
    } else {
      const result = goNext();
      if (!result.isValid && result.errorMessage) {
        setStepError(result.errorMessage);
      }
    }
  };

  const handleSaveDraft = async () => {
    setStepError(null);
    if (!formData.title || formData.title.trim().length < 3) {
      setStepError(
        contentType === 'POLL'
          ? 'Please enter a poll question (at least 3 characters) to save draft.'
          : 'Please enter a title (at least 3 characters) to save draft.'
      );
      return;
    }
    setSavingDraft(true);
    try {
      await saveDraft();
    } catch (err: any) {
      setStepError(err?.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleClose = () => {
    // If user filled in title or description, confirm exit
    if (formData.title.trim() || formData.description.trim()) {
      setCancelModalVisible(true);
    } else {
      reset();
      onClose();
    }
  };

  const handleConfirmCancel = () => {
    setCancelModalVisible(false);
    reset();
    onClose();
  };

  if (loadingItem) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <AppLoader variant="block" />
        <Text className="mt-3 text-sm text-muted-foreground font-medium">
          Loading content for editing...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      className="flex-1 bg-background"
    >
      <View className="flex-1">
        {/* Stage 2 Locked Header (Static read-only type badge) */}
        <CommunityEngagementFlowHeader
          contentType={contentType}
          stepTitle={currentStep?.title || ''}
          stepSubtitle={currentStep?.subtitle}
          stepIndex={currentStepIndex}
          totalSteps={steps.length}
          isEditMode={isEditMode}
          onBack={isFirstStep ? handleClose : goBack}
        />

        {/* Step Indicator Progress Bar */}
        <CommunityEngagementStepIndicator
          steps={steps}
          currentStepIndex={currentStepIndex}
          onStepPress={goToStepIndex}
        />

        {/* Active Step Content */}
        <View className="flex-1">
          {currentStepIndex === 0 && (
            <BasicInfoStep
              contentType={contentType}
              title={formData.title}
              description={formData.description}
              category={formData.category}
              priority={formData.priority}
              onChangeField={setField}
              error={stepError || error || undefined}
            />
          )}

          {currentStepIndex === 1 && (
            <AudienceStep
              contentType={contentType}
              targetType={formData.targetType}
              selectedRoleId={formData.selectedRoleId}
              selectedUserId={formData.selectedUserId}
              onChangeField={setField}
              error={stepError || error || undefined}
            />
          )}

          {currentStepIndex === 2 && (
            <ScheduleStep
              contentType={contentType}
              publishNow={formData.publishNow}
              scheduleDate={formData.scheduleDate}
              expiryDate={formData.expiryDate}
              isPinned={formData.isPinned}
              onChangeField={setField}
              error={stepError || error || undefined}
            />
          )}

          {currentStepIndex === 3 && (
            <>
              {contentType === 'NOTICE' ? (
                <NoticeConfigStep
                  allowComments={formData.allowComments}
                  allowReactions={formData.allowReactions}
                  requiresAcknowledgement={formData.requiresAcknowledgement}
                  acknowledgementDeadline={formData.acknowledgementDeadline}
                  isCritical={formData.isCritical}
                  images={formData.images}
                  onChangeField={setField}
                  error={stepError || error || undefined}
                />
              ) : (
                <PollConfigStep
                  options={formData.options}
                  choiceType={formData.choiceType}
                  maxChoices={formData.maxChoices}
                  votingMode={formData.votingMode}
                  resultsVisibility={formData.resultsVisibility}
                  isAnonymous={formData.isAnonymous}
                  quorumPercentage={formData.quorumPercentage}
                  onChangeField={setField}
                  error={stepError || error || undefined}
                />
              )}
            </>
          )}

          {currentStepIndex === 4 && (
            <ReviewPreviewStep
              formData={formData}
              previewData={previewData}
              previewLoading={previewLoading}
              error={stepError || error || undefined}
            />
          )}
        </View>

        {/* Wizard Footer Actions */}
        <CommunityEngagementFlowFooter
          onBack={goBack}
          onNext={handleNext}
          onSaveDraft={handleSaveDraft}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          isEditMode={isEditMode}
          loading={submitting}
          savingDraft={savingDraft}
          publishNow={formData.publishNow}
        />

        {/* Cancel Confirmation Dialog */}
        <ConfirmationModal
          visible={cancelModalVisible}
          title="Discard Content?"
          message="Are you sure you want to discard this content? Any unsaved inputs will be lost."
          variant="danger"
          confirmLabel="Discard"
          cancelLabel="Continue Editing"
          onConfirm={handleConfirmCancel}
          onCancel={() => setCancelModalVisible(false)}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

export default CommunityEngagementWizard;
