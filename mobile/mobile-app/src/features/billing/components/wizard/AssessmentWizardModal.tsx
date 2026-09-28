import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, Alert, Platform, StatusBar, BackHandler, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { AssessmentFlowHeader } from './AssessmentFlowHeader';
import { AssessmentStepIndicator, AssessmentStepDef } from './AssessmentStepIndicator';
import { AssessmentFlowFooter } from './AssessmentFlowFooter';

// Steps
import { AssessmentTypeStep } from './steps/AssessmentTypeStep';
import { AssessmentScheduleStep } from './steps/AssessmentScheduleStep';
import { AssessmentCalculationStep } from './steps/AssessmentCalculationStep';
import { AssessmentTargetScopeStep } from './steps/AssessmentTargetScopeStep';
import { AssessmentReviewStep } from './steps/AssessmentReviewStep';

import { useAssessmentForm } from '../../hooks/useAssessmentForm';

interface AssessmentWizardModalProps {
  visible: boolean;
  communityId?: string;
  assessment?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const WIZARD_STEPS: AssessmentStepDef[] = [
  { key: 'type', title: 'Rule Identity' },
  { key: 'schedule', title: 'Schedule & Cycle' },
  { key: 'calculation', title: 'Calculation Formula' },
  { key: 'scope', title: 'Target Scope & Roles' },
  { key: 'review', title: 'Review & Activate' },
];

export const AssessmentWizardModal: React.FC<AssessmentWizardModalProps> = ({
  visible,
  communityId,
  assessment,
  onClose,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const {
    name,
    setName,
    type,
    setType,
    billingCycle,
    setBillingCycle,
    selectedDays,
    handleToggleDay,
    genDayOption,
    setGenDayOption,
    customDay,
    setCustomDay,
    triggerMode,
    setTriggerMode,
    scheduledDate,
    setScheduledDate,
    scheduledTime,
    setScheduledTime,
    collectionMethod,
    setCollectionMethod,
    totalInstallments,
    setTotalInstallments,
    calcMethod,
    setCalcMethod,
    flatAmount,
    setFlatAmount,
    ratePerSqFt,
    setRatePerSqFt,
    tieredRates,
    handleTieredRate,
    scopeType,
    setScopeType,
    handleScopeTypeChange,
    checkedRoles,
    handleToggleRole,
    roles,
    roleNamesMap,
    selectedIds,
    handleToggleId,
    handleSelectAll,
    handleDeselectAll,
    selectedUnitTypes,
    handleToggleUnitType,
    scopeRows,
    searchQuery,
    setSearchQuery,
    rawVillas,
    units,
    filteredUnits,
    users,
    filteredUsers,
    availableBlocks,
    availableUnitTypes,
    handleToggleBlockPreset,
    handleToggleTypePreset,
    getBlockSelectionState,
    getTypeSelectionState,
    isBlockFullySelected,
    isBlockPartiallySelected,
    isTypeFullySelected,
    isTypePartiallySelected,
    formError,
    setFormError,
    isSubmitting,
    resetForm,
    submitAssessmentRule,
  } = useAssessmentForm({ communityId, assessment });

  const handleModalClose = useCallback(() => {
    resetForm();
    setCurrentStepIndex(0);
    onClose();
  }, [resetForm, onClose]);

  const handleNextStep = useCallback(async () => {
    if (isSubmitting) return;
    setFormError(null);

    // Step 1 Validation
    if (currentStepIndex === 0) {
      if (!name.trim()) {
        setFormError('Please enter an assessment rule title.');
        return;
      }
    }

    // Step 2 Validation
    if (currentStepIndex === 1) {
      const isCapitalRepair = type === 'CAPITAL_REPAIR';
      const isRecurring = type === 'RECURRING' || (isCapitalRepair && collectionMethod === 'INSTALLMENT');

      if (isRecurring && billingCycle === 'WEEKLY' && selectedDays.length === 0) {
        setFormError('Please select at least one day of the week for weekly billing.');
        return;
      }
      if (isRecurring && billingCycle !== 'WEEKLY' && genDayOption === 'CUSTOM') {
        const num = Number(customDay);
        if (isNaN(num) || num < 1 || num > 28) {
          setFormError('Generation day must be a number between 1 and 28.');
          return;
        }
      }
      if (isCapitalRepair && collectionMethod === 'INSTALLMENT') {
        const num = Number(totalInstallments);
        if (isNaN(num) || num < 2) {
          setFormError('Minimum 2 installments required for installment plan.');
          return;
        }
      }
      if (type === 'ONE_TIME' && triggerMode === 'SCHEDULED') {
        if (!scheduledDate) {
          setFormError('Please select a scheduled date.');
          return;
        }
      }
    }

    // Step 3 Validation
    if (currentStepIndex === 2) {
      const isPositiveNumeric = (val: string) => /^\d+(\.\d+)?$/.test(val.trim());

      if (calcMethod === 'FLAT_RATE') {
        if (!flatAmount || !isPositiveNumeric(flatAmount)) {
          setFormError('Please enter a valid numeric flat amount greater than 0 (words and letters are not allowed).');
          return;
        }
        const num = Number(flatAmount);
        if (num <= 0) {
          setFormError('Please enter a valid flat amount greater than 0.');
          return;
        }
      }

      if (calcMethod === 'PER_SQ_FT') {
        if (!ratePerSqFt || !isPositiveNumeric(ratePerSqFt)) {
          setFormError('Please enter a valid numeric rate per square foot greater than 0 (words and letters are not allowed).');
          return;
        }
        const num = Number(ratePerSqFt);
        if (num <= 0) {
          setFormError('Please enter a valid rate per square foot greater than 0.');
          return;
        }
      }

      if (calcMethod === 'TIERED_BHK') {
        const entries = Object.entries(tieredRates || {});
        let hasAtLeastOnePositiveRate = false;

        for (const [field, rateStr] of entries) {
          const str = String(rateStr || '').trim();
          if (str) {
            if (!isPositiveNumeric(str)) {
              setFormError(`Invalid rate entered for layout "${field}": only numbers are allowed (words and letters are not permitted).`);
              return;
            }
            const val = Number(str);
            if (val < 0) {
              setFormError(`Rate for layout "${field}" cannot be negative.`);
              return;
            }
            if (val > 0) {
              hasAtLeastOnePositiveRate = true;
            }
          }
        }

        if (!hasAtLeastOnePositiveRate) {
          setFormError('Please enter a valid fee amount greater than 0 for at least one building layout type.');
          return;
        }
      }
    }

    // Step 4 Validation
    if (currentStepIndex === 3) {
      if (checkedRoles.length === 0) {
        setFormError('Please select at least one resident role to receive invoices.');
        return;
      }
      if (['VILLA_BLOCK', 'SPECIFIC_UNITS', 'SPECIFIC_USERS'].includes(scopeType) && selectedIds.length === 0) {
        setFormError('Please select at least one item from the target scope checklist.');
        return;
      }
    }

    // Final Step 5 Submission
    if (currentStepIndex === 4) {
      const success = await submitAssessmentRule();
      if (success) {
        handleModalClose();
        onSuccess();
        if (Platform.OS !== 'web') {
          Alert.alert(
            'Assessment Rule Created!',
            `Successfully created maintenance assessment rule '${name.trim()}'.`
          );
        }
      }
      return;
    }

    // Advance to next step
    setCurrentStepIndex((prev) => prev + 1);
  }, [
    currentStepIndex,
    name,
    type,
    billingCycle,
    selectedDays,
    genDayOption,
    customDay,
    collectionMethod,
    totalInstallments,
    triggerMode,
    scheduledDate,
    calcMethod,
    flatAmount,
    ratePerSqFt,
    checkedRoles,
    scopeType,
    selectedIds,
    setFormError,
    submitAssessmentRule,
    name,
    isSubmitting,
    handleModalClose,
    onSuccess,
  ]);

  const handleBackStep = useCallback(() => {
    setFormError(null);
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    } else {
      handleModalClose();
    }
  }, [currentStepIndex, handleModalClose, setFormError]);

  // Reset step to 0 whenever modal opens
  useEffect(() => {
    if (visible) {
      setCurrentStepIndex(0);
      setFormError(null);
    }
  }, [visible, setFormError]);

  // Hardware Back Button Handler for Android / Mobile devices
  useEffect(() => {
    if (!visible) return;

    const onHardwareBack = () => {
      handleBackStep();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => subscription.remove();
  }, [visible, handleBackStep]);

  if (!visible) return null;

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;
  const currentStepTitle = WIZARD_STEPS[currentStepIndex]?.title || '';

  return (
    <View
      className="absolute inset-0 z-50 bg-card flex-col"
      style={{
        paddingTop: Math.max(insets.top, 16),
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colorScheme === 'dark' ? '#09090b' : '#ffffff'}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'android' ? 'height' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <AssessmentFlowHeader
            stepTitle={currentStepTitle}
            currentStep={currentStepIndex}
            totalSteps={WIZARD_STEPS.length}
            onBack={handleBackStep}
            onCancel={handleModalClose}
          />

          {/* Progress Bar Indicator */}
          <AssessmentStepIndicator steps={WIZARD_STEPS} currentStepIndex={currentStepIndex} />

          {/* Form Content Area */}
          <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
            {formError ? (
              <View className="mb-4">
                <ErrorBanner message={formError} onDismiss={() => setFormError(null)} />
              </View>
            ) : null}

            {currentStepIndex === 0 && (
              <AssessmentTypeStep
                name={name}
                onChangeName={setName}
                type={type}
                onChangeType={setType}
              />
            )}

            {currentStepIndex === 1 && (
              <AssessmentScheduleStep
                type={type}
                billingCycle={billingCycle}
                onChangeBillingCycle={setBillingCycle}
                genDayOption={genDayOption}
                onChangeGenDayOption={setGenDayOption}
                customDay={customDay}
                onChangeCustomDay={setCustomDay}
                selectedDays={selectedDays}
                onToggleDay={handleToggleDay}
                triggerMode={triggerMode}
                onChangeTriggerMode={setTriggerMode}
                scheduledDate={scheduledDate}
                onChangeScheduledDate={setScheduledDate}
                scheduledTime={scheduledTime}
                onChangeScheduledTime={setScheduledTime}
                collectionMethod={collectionMethod}
                onChangeCollectionMethod={setCollectionMethod}
                totalInstallments={totalInstallments}
                onChangeTotalInstallments={setTotalInstallments}
              />
            )}

            {currentStepIndex === 2 && (
              <AssessmentCalculationStep
                calcMethod={calcMethod}
                onChangeCalcMethod={setCalcMethod}
                flatAmount={flatAmount}
                onChangeFlatAmount={setFlatAmount}
                ratePerSqFt={ratePerSqFt}
                onChangeRatePerSqFt={setRatePerSqFt}
                tieredRates={tieredRates}
                onChangeTieredRate={handleTieredRate}
              />
            )}

            {currentStepIndex === 3 && (
              <AssessmentTargetScopeStep
                scopeType={scopeType}
                onChangeScopeType={handleScopeTypeChange}
                roles={roles}
                checkedRoles={checkedRoles}
                onToggleRole={handleToggleRole}
                scopeRows={
                  scopeType === 'SPECIFIC_UNITS'
                    ? filteredUnits
                    : scopeType === 'SPECIFIC_USERS'
                    ? filteredUsers
                    : scopeRows
                }
                selectedIds={selectedIds}
                onToggleId={handleToggleId}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                searchQuery={searchQuery}
                onChangeSearchQuery={setSearchQuery}
                availableBlocks={availableBlocks}
                availableUnitTypes={availableUnitTypes}
                onToggleBlockPreset={handleToggleBlockPreset}
                onToggleTypePreset={handleToggleTypePreset}
                isBlockFullySelected={isBlockFullySelected}
                isBlockPartiallySelected={isBlockPartiallySelected}
                isTypeFullySelected={isTypeFullySelected}
                isTypePartiallySelected={isTypePartiallySelected}
                getBlockSelectionState={getBlockSelectionState}
                getTypeSelectionState={getTypeSelectionState}
                totalUnitsCount={units.length}
              />
            )}

            {currentStepIndex === 4 && (
              <AssessmentReviewStep
                name={name}
                type={type}
                billingCycle={billingCycle}
                genDayOption={genDayOption}
                customDay={customDay}
                selectedDays={selectedDays}
                triggerMode={triggerMode}
                scheduledDate={scheduledDate}
                scheduledTime={scheduledTime}
                collectionMethod={collectionMethod}
                totalInstallments={totalInstallments}
                calcMethod={calcMethod}
                flatAmount={flatAmount}
                ratePerSqFt={ratePerSqFt}
                tieredRates={tieredRates}
                scopeType={scopeType}
                checkedRoles={checkedRoles}
                roleNamesMap={roleNamesMap}
                selectedIds={selectedIds}
                selectedUnitTypes={selectedUnitTypes}
              />
            )}

            <View className="h-8" />
          </ScrollView>

          {/* Sticky Footer */}
          <AssessmentFlowFooter
            onBack={handleBackStep}
            onNext={handleNextStep}
            isFirstStep={isFirstStep}
            isLastStep={isLastStep}
            loading={isSubmitting}
          />
      </KeyboardAvoidingView>
    </View>
  );
};

export default AssessmentWizardModal;
