import React, { useState, useEffect, useMemo } from 'react';
import { View, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmenityArchetype } from '../../types/amenityDomain.types';
import {
  CREATION_STEP_DEFINITIONS,
  CreationStepMeta,
  DEFAULT_ARCHETYPE_CATEGORIES,
} from '../../constants/amenityCatalogPresets';
import {
  AmenityCreationFormState,
  mapAmenityCreationPayloadStrategy,
} from '../../utils/mapAmenityCreationPayloadStrategy';
import { generateFacilityCode } from '../../services/amenityManagementService';
import { mapAmenityApiError } from '../../utils/amenityErrorMapper';
import { stepErrorsFor, firstInvalidStep } from '../../utils/amenityCreationValidation';
import { showCrossPlatformAlert } from '../../../../utils/alertUtils';

// Flow Controls
import { AmenityCreationFlowHeader } from './AmenityCreationFlowHeader';
import { AmenityCreationStepIndicator } from './AmenityCreationStepIndicator';
import { AmenityCreationFlowFooter } from './AmenityCreationFlowFooter';

// Steps
import {
  BasicFacilityInfoStep,
  OperatingScheduleStep,
  SharedCapacityConfigStep,
  ExclusiveHourlyConfigStep,
  EventSpaceConfigStep,
  RoomResourceConfigStep,
  InventoryToolsConfigStep,
  PricingAndPolicyStep,
  AmenityCreationReviewStep,
} from './steps';

export interface AmenityCreationWizardProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<any> | void;
  onSaveDraft?: (payload: any) => Promise<any> | void;
  amenity?: any;
  loading?: boolean;
  savingDraft?: boolean;
  initialArchetype?: AmenityArchetype;
}

export const AmenityCreationWizard: React.FC<AmenityCreationWizardProps> = ({
  visible,
  onClose,
  onSubmit,
  onSaveDraft,
  amenity,
  loading = false,
  savingDraft = false,
  initialArchetype = 'SHARED_CAPACITY',
}) => {
  const isEditing = Boolean(amenity && (amenity._id || amenity.id));

  // Active Archetype
  const [selectedArchetype, setSelectedArchetype] = useState<AmenityArchetype>(
    amenity?.archetype || initialArchetype
  );
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [publishError, setPublishError] = useState<string | null>(null);

  // Unified Form State
  const [form, setForm] = useState<AmenityCreationFormState>({
    name: '',
    code: generateFacilityCode('FACILITY'),
    archetype: initialArchetype,
    category: DEFAULT_ARCHETYPE_CATEGORIES[initialArchetype] || 'General',
    location: '',
    status: 'active',
    imageUrl: '',
    description: '',
    openTime: '06:00',
    closeTime: '22:00',
    openDays: [0, 1, 2, 3, 4, 5, 6],
    maxCapacity: 50,
    maxHeadcountPerReservation: 2,
    slotDurationMinutes: 60,
    bufferTimeMinutes: 0,
    advanceBookingDays: 7,
    advanceNoticeHours: 72,
    requiresApproval: false,
    isMultiResourceFacility: false,
    subRooms: [{ id: 'room-1', name: 'Conference Suite A', capacity: 10 }],
    roomAmenities: ['wifi', 'projector'],
    availableStock: 5,
    maxLoanHours: 24,
    requiresInspection: true,
    pricingType: 'FREE',
    baseRate: 0,
    securityDeposit: 0,
    securityDepositDescription: '',
    isCancellationAllowed: true,
    refundCutoffHours: 24,
    refundPercentage: 100,
    bookingMode: 'FULL_DAY',
    sessions: [],
    stayMode: 'HOURLY',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    maxNights: 3,
    paymentMode: 'FULL',
    advanceType: 'PERCENT',
    advanceValue: '',
  });

  // Hydrate when editing
  useEffect(() => {
    if (amenity) {
      const rawArchetype: AmenityArchetype =
        amenity.archetype ||
        (amenity.type === 'Sports' ? 'EXCLUSIVE_HOURLY' : 'SHARED_CAPACITY');
      setSelectedArchetype(rawArchetype);

      const rawPricingType =
        amenity.pricingConfig?.type ||
        amenity.pricingConfig?.pricingType ||
        amenity.pricing?.pricingType ||
        (amenity.bookingFee ? 'HOURLY' : 'FREE');

      const img =
        amenity.imageUrl ||
        (Array.isArray(amenity.images) && amenity.images.length > 0
          ? amenity.images[0]
          : '');

      setForm({
        name: amenity.name || '',
        code: amenity.code || generateFacilityCode(amenity.name || 'FACILITY'),
        archetype: rawArchetype,
        category: amenity.category || amenity.type || 'General',
        location: amenity.location || '',
        status: (amenity.status || 'active').toLowerCase() as any,
        imageUrl: img,
        description: amenity.description || '',
        openTime:
          amenity.operatingHours?.[0]?.opensAt ||
          amenity.operatingHours?.[0]?.openTime ||
          amenity.openTime ||
          '06:00',
        closeTime:
          amenity.operatingHours?.[0]?.closesAt ||
          amenity.operatingHours?.[0]?.closeTime ||
          amenity.closeTime ||
          '22:00',
        // Open days come from the facility's weekly hours.
        openDays: Array.isArray(amenity.operatingHours) && amenity.operatingHours.length > 0
          ? amenity.operatingHours.filter((h: any) => h.isOpen !== false).map((h: any) => Number(h.dayOfWeek))
          : amenity.openDays || [0, 1, 2, 3, 4, 5, 6],
        maxCapacity: amenity.maxCapacity || amenity.capacity || 50,
        maxHeadcountPerReservation:
          amenity.maxHeadcountPerReservation ||
          amenity.maxBookingsPerUserPerSlot ||
          2,
        slotDurationMinutes:
          amenity.slotDurationMinutes ||
          amenity.bookingRules?.slotDurationMinutes ||
          60,
        bufferTimeMinutes:
          amenity.setupBufferMinutes ||
          amenity.bufferTimeMinutes ||
          amenity.bookingRules?.bufferTimeMinutes ||
          0,
        advanceBookingDays:
          amenity.advanceBookingDays ||
          amenity.bookingRules?.maxAdvanceBookingDays ||
          amenity.bookingRules?.advanceBookingDays ||
          7,
        advanceNoticeHours:
          amenity.bookingRules?.minNoticeHours ||
          amenity.minNoticeHours ||
          72,
        requiresApproval:
          amenity.bookingRules?.requiresApproval ??
          amenity.requiresApproval ??
          false,
        isMultiResourceFacility: amenity.isMultiResourceFacility || false,
        subRooms: amenity.subRooms || [
          { id: 'room-1', name: 'Conference Suite A', capacity: 10 },
        ],
        roomAmenities: amenity.roomAmenities || ['wifi', 'projector'],
        availableStock: amenity.availableStock || amenity.maxCapacity || 5,
        maxLoanHours: amenity.maxLoanHours || 24,
        requiresInspection: amenity.requiresInspection ?? true,
        pricingType: (rawPricingType.toUpperCase() as any) || 'FREE',
        baseRate:
          amenity.pricingConfig?.baseRate ??
          amenity.pricing?.baseRate ??
          amenity.bookingFee ??
          0,
        securityDeposit:
          amenity.pricingConfig?.securityDeposit ??
          amenity.pricingConfig?.depositAmount ??
          amenity.pricing?.securityDeposit ??
          0,
        securityDepositDescription:
          amenity.pricing?.securityDepositDescription || '',
        isCancellationAllowed:
          amenity.cancellationPolicy?.isAllowed ??
          amenity.bookingRules?.isCancellationEnabled ??
          true,
        refundCutoffHours:
          amenity.cancellationPolicy?.refundCutoffHours ?? 24,
        refundPercentage:
          amenity.cancellationPolicy?.refundPercentage ?? 100,
        bookingMode: amenity.bookingMode || 'FULL_DAY',
        sessions: Array.isArray(amenity.sessions)
          ? amenity.sessions.map((sess: any, i: number) => ({
              id: sess._id || `session-${i}`,
              name: sess.name || '',
              startTime: sess.startTime || '',
              endTime: sess.endTime || '',
              price: sess.price ?? '',
            }))
          : [],
        stayMode: amenity.stayMode || 'HOURLY',
        checkInTime: amenity.checkInTime || '14:00',
        checkOutTime: amenity.checkOutTime || '11:00',
        maxNights: amenity.maxNights || 3,
        paymentMode: amenity.paymentPolicy?.mode || 'FULL',
        advanceType: amenity.paymentPolicy?.advanceType || 'PERCENT',
        advanceValue: amenity.paymentPolicy?.advanceValue ? amenity.paymentPolicy.advanceValue : '',
      });
    } else {
      let defaultPricing: any = 'FREE';
      if (initialArchetype === 'EXCLUSIVE_HOURLY' || initialArchetype === 'ROOM_RESOURCE') {
        defaultPricing = 'HOURLY';
      } else if (initialArchetype === 'EVENT_SPACE') {
        defaultPricing = 'DAILY';
      }

      setSelectedArchetype(initialArchetype);
      setCurrentStepIndex(0);
      setStepErrors({});
      setPublishError(null);
      setForm({
        name: '',
        code: generateFacilityCode(initialArchetype.split('_')[0] || 'FACILITY'),
        archetype: initialArchetype,
        category: DEFAULT_ARCHETYPE_CATEGORIES[initialArchetype] || 'General',
        location: '',
        status: 'active',
        imageUrl: '',
        description: '',
        openTime: '06:00',
        closeTime: '22:00',
        openDays: [0, 1, 2, 3, 4, 5, 6],
        maxCapacity: initialArchetype === 'SHARED_CAPACITY' ? 50 : initialArchetype === 'EVENT_SPACE' ? 100 : 1,
        maxHeadcountPerReservation: 2,
        slotDurationMinutes: initialArchetype === 'EVENT_SPACE' ? 720 : 60,
        bufferTimeMinutes: 0,
        advanceBookingDays: initialArchetype === 'EVENT_SPACE' ? 30 : 7,
        advanceNoticeHours: 72,
        requiresApproval: initialArchetype === 'EVENT_SPACE',
        isMultiResourceFacility: initialArchetype === 'ROOM_RESOURCE',
        subRooms: [{ id: 'room-1', name: 'Conference Suite A', capacity: 10 }],
        roomAmenities: ['wifi', 'projector'],
        availableStock: 5,
        maxLoanHours: 24,
        requiresInspection: true,
        pricingType: defaultPricing,
        baseRate: defaultPricing === 'FREE' ? 0 : '',
        securityDeposit: 0,
        securityDepositDescription: '',
        isCancellationAllowed: true,
        refundCutoffHours: 24,
        refundPercentage: 100,
        bookingMode: 'FULL_DAY',
        sessions: [],
        stayMode: 'HOURLY',
        checkInTime: '14:00',
        checkOutTime: '11:00',
        maxNights: 3,
        paymentMode: 'FULL',
        advanceType: 'PERCENT',
        advanceValue: '',
      });
    }
  }, [amenity, initialArchetype, visible]);

  // Dynamic Step List based on Selected Archetype
  const steps: CreationStepMeta[] = useMemo(() => {
    return (
      CREATION_STEP_DEFINITIONS[selectedArchetype] ||
      CREATION_STEP_DEFINITIONS.SHARED_CAPACITY
    );
  }, [selectedArchetype]);

  const currentStep = steps[currentStepIndex] || steps[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Step validation (same rules as the publish check)
  const validateCurrentStep = (): boolean => {
    const errors = stepErrorsFor(currentStep.key, form);
    setStepErrors(errors);
    const first = Object.values(errors)[0];
    if (first && ['schedule', 'pricing'].includes(currentStep.key)) {
      showCrossPlatformAlert('Validation Error', first);
    }
    return !first;
  };

  // Whole-form validation before publishing: the first step with a problem
  const validateWholeForm = (): {
    isValid: boolean;
    errorStepIndex: number;
    message: string;
    errors: Record<string, string>;
  } => {
    const invalid = firstInvalidStep(
      steps.map((st) => st.key),
      form
    );
    if (!invalid) return { isValid: true, errorStepIndex: -1, message: '', errors: {} };
    return {
      isValid: false,
      errorStepIndex: invalid.index,
      message: Object.values(invalid.errors)[0],
      errors: invalid.errors,
    };
  };

  const handleNext = () => {
    setPublishError(null);
    if (!validateCurrentStep()) return;

    if (isLastStep) {
      const wholeFormCheck = validateWholeForm();
      if (!wholeFormCheck.isValid) {
        setPublishError(wholeFormCheck.message);
        setCurrentStepIndex(wholeFormCheck.errorStepIndex);
        setStepErrors(wholeFormCheck.errors);
        showCrossPlatformAlert('Required Field Missing', wholeFormCheck.message);
        return;
      }
      handleFinalSubmit();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setPublishError(null);
    setStepErrors({});
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    } else {
      onClose();
    }
  };

  const handleFinalSubmit = async () => {
    setPublishError(null);
    try {
      const payload = mapAmenityCreationPayloadStrategy(form, false);
      await onSubmit(payload);
    } catch (err: any) {
      console.error('Wizard submission failed', err);
      const mapped = mapAmenityApiError(err);
      const errorMsg = mapped.message || 'Failed to publish facility. Please check required fields.';
      setPublishError(errorMsg);
      showCrossPlatformAlert('Publish Failed', errorMsg);
    }
  };

  const handleSaveDraft = async () => {
    setPublishError(null);
    if (!form.name.trim()) {
      showCrossPlatformAlert('Facility Name Required', 'Please enter a facility name before saving as draft.');
      return;
    }
    try {
      const payload = mapAmenityCreationPayloadStrategy(form, true);
      if (onSaveDraft) {
        await onSaveDraft(payload);
      } else {
        await onSubmit(payload);
      }
    } catch (err: any) {
      console.error('Wizard draft save failed', err);
      const mapped = mapAmenityApiError(err);
      const errorMsg = mapped.message || 'Failed to save draft. Please verify fields.';
      setPublishError(errorMsg);
      showCrossPlatformAlert('Save Draft Failed', errorMsg);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        {/* Step Header */}
        <AmenityCreationFlowHeader
          archetype={selectedArchetype}
          stepTitle={currentStep.title}
          stepSubtitle={currentStep.subtitle}
          stepIndex={currentStepIndex}
          totalSteps={steps.length}
          isEditing={isEditing}
          onBack={handleBack}
          onCancel={onClose}
        />

        {/* Step Indicator */}
        <AmenityCreationStepIndicator
          steps={steps}
          currentStepIndex={currentStepIndex}
          onStepPress={(idx) => {
            if (idx <= currentStepIndex) setCurrentStepIndex(idx);
          }}
        />

        {/* Dynamic Step Content */}
        <View className="flex-1">
          {currentStep.key === 'info' && (
            <BasicFacilityInfoStep
              data={{
                name: form.name,
                code: form.code,
                category: form.category,
                location: form.location,
                status: form.status,
                imageUrl: form.imageUrl,
                description: form.description,
              }}
              onChange={(updated) => setForm((prev) => ({ ...prev, ...updated }))}
              errors={stepErrors as any}
            />
          )}

          {currentStep.key === 'schedule' && (
            <OperatingScheduleStep
              data={{
                openTime: form.openTime,
                closeTime: form.closeTime,
                openDays: form.openDays,
              }}
              onChange={(updated) => setForm((prev) => ({ ...prev, ...updated }))}
              errors={stepErrors as any}
            />
          )}

          {currentStep.key === 'capacity-rules' && (
            <SharedCapacityConfigStep
              data={{
                maxCapacity: form.maxCapacity,
                maxHeadcountPerReservation: form.maxHeadcountPerReservation,
              }}
              onChange={(updated) => setForm((prev) => ({ ...prev, ...updated }))}
              errors={stepErrors as any}
            />
          )}

          {currentStep.key === 'court-slots' && (
            <ExclusiveHourlyConfigStep
              data={{
                slotDurationMinutes: form.slotDurationMinutes,
                bufferTimeMinutes: form.bufferTimeMinutes,
                advanceBookingDays: form.advanceBookingDays,
              }}
              onChange={(updated) => setForm((prev) => ({ ...prev, ...updated }))}
              errors={stepErrors as any}
            />
          )}

          {currentStep.key === 'event-rules' && (
            <EventSpaceConfigStep
              data={{
                maxCapacity: form.maxCapacity,
                requiresApproval: form.requiresApproval,
                advanceNoticeHours: form.advanceNoticeHours,
                advanceBookingDays: form.advanceBookingDays,
                bookingMode: form.bookingMode,
                sessions: form.sessions,
                slotDurationMinutes: form.slotDurationMinutes,
              }}
              onChange={(updated) => setForm((prev) => ({ ...prev, ...updated }))}
              errors={stepErrors as any}
            />
          )}

          {currentStep.key === 'room-setup' && (
            <RoomResourceConfigStep
              data={{
                isMultiResourceFacility: form.isMultiResourceFacility,
                slotDurationMinutes: form.slotDurationMinutes,
                subRooms: form.subRooms,
                roomAmenities: form.roomAmenities,
                stayMode: form.stayMode,
                checkInTime: form.checkInTime,
                checkOutTime: form.checkOutTime,
                maxNights: form.maxNights,
              }}
              onChange={(updated) => setForm((prev) => ({ ...prev, ...updated }))}
              errors={stepErrors as any}
            />
          )}

          {currentStep.key === 'inventory-stock' && (
            <InventoryToolsConfigStep
              data={{
                availableStock: form.availableStock ?? 5,
                maxLoanHours: form.maxLoanHours ?? 24,
                requiresInspection: form.requiresInspection ?? true,
              }}
              onChange={(updated) => setForm((prev) => ({ ...prev, ...updated }))}
              errors={stepErrors as any}
            />
          )}

          {currentStep.key === 'pricing' && (
            <PricingAndPolicyStep
              archetype={selectedArchetype}
              data={{
                pricingType: form.pricingType,
                baseRate: form.baseRate,
                securityDeposit: form.securityDeposit,
                isCancellationAllowed: form.isCancellationAllowed,
                refundCutoffHours: form.refundCutoffHours,
                refundPercentage: form.refundPercentage,
                paymentMode: form.paymentMode,
                advanceType: form.advanceType,
                advanceValue: form.advanceValue,
              }}
              onChange={(updated) => setForm((prev) => ({ ...prev, ...updated }))}
              errors={stepErrors as any}
            />
          )}

          {currentStep.key === 'review' && (
            <AmenityCreationReviewStep
              form={form}
              isEditing={isEditing}
              publishError={publishError}
            />
          )}
        </View>

        {/* Sticky Action Footer */}
        <AmenityCreationFlowFooter
          onBack={handleBack}
          onNext={handleNext}
          onSaveDraft={handleSaveDraft}
          allowSaveDraft={!isEditing || amenity?.status === 'DRAFT' || Boolean((amenity as any)?.isDraft)}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          loading={loading}
          savingDraft={savingDraft}
          isEditing={isEditing}
        />
      </SafeAreaView>
    </Modal>
  );
};

export default AmenityCreationWizard;
