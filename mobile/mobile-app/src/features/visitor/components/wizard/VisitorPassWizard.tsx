import React, { useState, useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { VisitorPassFlowHeader } from '../shared/VisitorPassFlowHeader';
import { VisitorPassStepIndicator } from '../shared/VisitorPassStepIndicator';
import { VisitorPassFlowFooter } from '../shared/VisitorPassFlowFooter';
import { VisitorInvitationTypeSheet } from '../shared/VisitorInvitationTypeSheet';
import { GeneratedPassView, GeneratedPassData } from '../shared/GeneratedPassView';
import { PassTypeKey } from '../../mocks/visitorMocks';
import { mapFormToApiPayloadStrategy, PassPayloadContext } from '../../utils/mapFormToApiPayloadStrategy';
import { AdminPassSetupStep, AdminPassSetupData } from '../admin/AdminPassSetupStep';
import { AlertCircle } from 'lucide-react-native';
import { useBottomNavScroll } from '@/components/navigation/BottomNavScrollContext';

// Step components
import { GuestDetailsStep, GuestDetailsData } from '../guest/GuestDetailsStep';
import { GuestScheduleStep, GuestScheduleData } from '../guest/GuestScheduleStep';
import { GuestPassOptionsStep, GuestPassOptionsData } from '../guest/GuestPassOptionsStep';
import { GuestPassReviewStep } from '../guest/GuestPassReviewStep';

import { GroupVisitDetailsStep, GroupVisitDetailsData } from '../group/GroupVisitDetailsStep';
import { GroupScheduleStep } from '../group/GroupScheduleStep';
import { AddGroupGuestsStep, GroupGuestItem } from '../group/AddGroupGuestsStep';
import { GroupPassReviewStep } from '../group/GroupPassReviewStep';

import { CabProviderStep } from '../cab/CabProviderStep';
import { CabVehicleStep, CabVehicleData } from '../cab/CabVehicleStep';
import { CabScheduleStep, CabScheduleData } from '../cab/CabScheduleStep';
import { CabPassReviewStep } from '../cab/CabPassReviewStep';

import { DeliveryPartnerStep } from '../delivery/DeliveryPartnerStep';
import { DeliveryDetailsStep, DeliveryDetailsData } from '../delivery/DeliveryDetailsStep';
import { DeliveryValidityStep, DeliveryValidityData } from '../delivery/DeliveryValidityStep';
import { DeliveryPassReviewStep } from '../delivery/DeliveryPassReviewStep';

import { StaffDetailsStep, StaffDetailsData } from '../service/StaffDetailsStep';
import { ServiceTypeStep } from '../service/ServiceTypeStep';
import { ServiceDateRangeStep, ServiceDateRangeData } from '../service/ServiceDateRangeStep';
import { ServiceWeekdayStep } from '../service/ServiceWeekdayStep';
import { ServiceTimeWindowStep, ServiceTimeWindowData } from '../service/ServiceTimeWindowStep';
import { ServicePassReviewStep } from '../service/ServicePassReviewStep';
import { toLocalDateKey } from '../../utils/localDate';

const STEP_DEFINITIONS: Record<PassTypeKey, { key: string; title: string }[]> = {
  GUEST: [
    { key: 'details', title: 'Guest Details' },
    { key: 'schedule', title: 'Visit Schedule' },
    { key: 'options', title: 'Pass Options' },
    { key: 'review', title: 'Review Pass' },
  ],
  GROUP: [
    { key: 'event', title: 'Event Details' },
    { key: 'schedule', title: 'Event Schedule' },
    { key: 'guests', title: 'Add Guests' },
    { key: 'review', title: 'Review Group Pass' },
  ],
  CAB: [
    { key: 'provider', title: 'Select Provider' },
    { key: 'vehicle', title: 'Vehicle Plate' },
    { key: 'schedule', title: 'Arrival Window' },
    { key: 'review', title: 'Review Cab Pass' },
  ],
  DELIVERY: [
    { key: 'partner', title: 'Delivery Partner' },
    { key: 'details', title: 'Order Details' },
    { key: 'validity', title: 'Pass Validity' },
    { key: 'review', title: 'Review Delivery Pass' },
  ],
  SERVICE: [
    { key: 'staff', title: 'Staff Details' },
    { key: 'category', title: 'Service Category' },
    { key: 'date-range', title: 'Date Range' },
    { key: 'weekdays', title: 'Allowed Days' },
    { key: 'time-slot', title: 'Daily Slot' },
    { key: 'review', title: 'Review Service Pass' },
  ],
};

// Mirrors the backend rule for visitorDetails.phone: optional, but exactly 10 digits when given.
const INVALID_PHONE_MESSAGE = 'Please enter a valid 10-digit phone number.';
const isValidOptionalPhone = (phone?: string) => !phone?.trim() || /^\d{10}$/.test(phone.trim());

interface VisitorPassWizardProps {
  initialType?: PassTypeKey;
  roleContext: PassPayloadContext;
  onSubmitPass: (payload: any) => Promise<any>;
  onClose: () => void;
  renderExtraStepHeader?: () => React.ReactNode;
  /** Admin pass target, when the screen shows it outside the wizard (controlled). */
  adminScope?: AdminPassSetupData;
  onAdminScopeChange?: (scope: AdminPassSetupData) => void;
}

export const VisitorPassWizard: React.FC<VisitorPassWizardProps> = ({
  initialType = 'GUEST',
  roleContext,
  onSubmitPass,
  onClose,
  renderExtraStepHeader,
  adminScope: controlledAdminScope,
  onAdminScopeChange,
}) => {
  const [selectedPassType, setSelectedPassType] = useState<PassTypeKey>(initialType);
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generatedPass, setGeneratedPass] = useState<GeneratedPassData | null>(null);
  const { scrollHandlerProps } = useBottomNavScroll();

  const isAdmin = roleContext.role === 'ADMIN';

  const steps = useMemo(() => {
    const base = STEP_DEFINITIONS[selectedPassType];
    return isAdmin ? [{ key: 'admin-setup', title: 'Target Scope' }, ...base] : base;
  }, [selectedPassType, isAdmin]);

  const isLastStep = currentStepIndex === steps.length - 1;
  const baseStepIndex = isAdmin ? currentStepIndex - 1 : currentStepIndex;

  // Form states
  const [internalAdminScope, setInternalAdminScope] = useState<AdminPassSetupData>({
    scope: 'COMMUNITY',
    villaId: roleContext.villaId,
  });
  const adminScope = controlledAdminScope ?? internalAdminScope;
  const setAdminScope = onAdminScopeChange ?? setInternalAdminScope;
  const [guestDetails, setGuestDetails] = useState<GuestDetailsData>({ visitorName: '', phone: '', purpose: '' });
  const [guestSchedule, setGuestSchedule] = useState<GuestScheduleData>({
    visitDate: toLocalDateKey(),
    timeSlot: 'NOW',
    customStartTime: '02:00 PM',
    customEndTime: '06:00 PM',
  });
  const [guestOptions, setGuestOptions] = useState<GuestPassOptionsData>({ entryMode: 'SINGLE', vehicleNo: '', gateInstructions: '' });

  const [groupDetails, setGroupDetails] = useState<GroupVisitDetailsData>({
    eventTitle: '',
    purpose: '',
    visitDate: toLocalDateKey(),
    timePreset: 'FULL_DAY',
    startTime: '07:00 AM',
    endTime: '11:59 PM',
    numberOfPasses: '10',
  });
  const [groupGuests, setGroupGuests] = useState<GroupGuestItem[]>([]);

  const [cabProvider, setCabProvider] = useState<string>('uber');
  const [customCabProvider, setCustomCabProvider] = useState<string>('');
  const [cabVehicle, setCabVehicle] = useState<CabVehicleData>({ vehicleNo: '', vehicleType: 'CAB', driverPhone: '' });
  const [cabSchedule, setCabSchedule] = useState<CabScheduleData>({
    usageType: 'ONE_TIME',
    arrivalWindow: 'IMMEDIATE',
    customVisitDate: toLocalDateKey(),
    customStartTime: '02:00 PM',
    customEndTime: '06:00 PM',
    selectedWeekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    timeSlots: [{ startTime: '07:30 AM', endTime: '09:00 AM' }],
  });

  const [deliveryPartner, setDeliveryPartner] = useState<string>('swiggy');
  const [customDeliveryPartner, setCustomDeliveryPartner] = useState<string>('');
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetailsData>({ orderId: '', packageCount: '1', deliveryAction: 'DOORSTEP', instructions: '' });
  const [deliveryValidity, setDeliveryValidity] = useState<DeliveryValidityData>({
    usageType: 'ONE_TIME',
    validityDuration: 'ONE_HOUR',
    customVisitDate: toLocalDateKey(),
    customStartTime: '02:00 PM',
    customEndTime: '06:00 PM',
  });

  const [staffDetails, setStaffDetails] = useState<StaffDetailsData>({ staffName: '', phone: '', notes: '' });
  const [serviceCategory, setServiceCategory] = useState<string>('cleaning');
  const [serviceDateRange, setServiceDateRange] = useState<ServiceDateRangeData>({
    startDate: toLocalDateKey(),
    endDate: toLocalDateKey(new Date(Date.now() + 30 * 86400000)),
  });
  const [serviceWeekdays, setServiceWeekdays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
  const [serviceTimeWindow, setServiceTimeWindow] = useState<ServiceTimeWindowData>({
    preset: 'FULL_DAY',
    startTime: '07:00 AM',
    endTime: '08:00 PM',
  });

  const handleNext = () => {
    setSubmitError(null);

    // If Admin on Step 0 (Pass Scope Setup)
    if (isAdmin && currentStepIndex === 0) {
      if (adminScope.scope === 'VILLA' && !adminScope.villaId) {
        setSubmitError('Please select a target villa unit and host resident.');
        return;
      }
      setCurrentStepIndex((prev) => prev + 1);
      return;
    }

    // Pass details Step 0 validation per pass type
    if (baseStepIndex === 0) {
      if (selectedPassType === 'GUEST') {
        if (!guestDetails.visitorName.trim()) {
          setSubmitError('Please enter the guest name.');
          return;
        }
        if (!isValidOptionalPhone(guestDetails.phone)) {
          setSubmitError(INVALID_PHONE_MESSAGE);
          return;
        }
      } else if (selectedPassType === 'GROUP') {
        if (!groupDetails.eventTitle.trim()) {
          setSubmitError('Please enter the event / gathering title.');
          return;
        }
      } else if (selectedPassType === 'SERVICE') {
        if (!staffDetails.staffName.trim()) {
          setSubmitError('Please enter the service staff / contractor name.');
          return;
        }
        if (!isValidOptionalPhone(staffDetails.phone)) {
          setSubmitError(INVALID_PHONE_MESSAGE);
          return;
        }
      }
    }

    // Group Guests Step validation
    if (selectedPassType === 'GROUP' && baseStepIndex === 2) {
      if (groupGuests.length === 0) {
        setSubmitError('Please add at least one guest to the group list.');
        return;
      }
    }

    // Service Date Range validation
    if (selectedPassType === 'SERVICE' && baseStepIndex === 2) {
      if (serviceDateRange.startDate && serviceDateRange.endDate && serviceDateRange.startDate > serviceDateRange.endDate) {
        setSubmitError('Pass start date cannot be after end date.');
        return;
      }
    }

    if (isLastStep) {
      handleFinalSubmit();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setSubmitError(null);
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    } else {
      onClose();
    }
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    setSubmitError(null);
    try {
      const formData = {
        guestDetails, guestSchedule, guestOptions,
        groupDetails, groupGuests,
        cabProvider, customCabProvider, cabVehicle, cabSchedule,
        deliveryPartner, customDeliveryPartner, deliveryDetails, deliveryValidity,
        staffDetails, serviceCategory, serviceDateRange, serviceWeekdays, serviceTimeWindow,
      };

      // Admins choose the pass scope; residents always issue passes for their active unit.
      const enrichedRoleContext: PassPayloadContext = {
        ...roleContext,
        villaId: isAdmin
          ? (adminScope.scope === 'VILLA' ? adminScope.villaId : undefined)
          : roleContext.villaId,
      };

      const payload = mapFormToApiPayloadStrategy(selectedPassType, formData, enrichedRoleContext);
      const res = await onSubmitPass(payload);
      
      // Check if it's a Redux rejection
      if (res?.meta?.requestStatus === 'rejected') {
        throw new Error(res.payload || 'Backend validation failed');
      }
      
      let createdPass: any = res;
      if (res?.payload) {
        createdPass = res.payload.data || res.payload;
      } else if (res?.data) {
        createdPass = res.data.data || res.data;
      }

      const code =
        createdPass?.shortKey ||
        createdPass?.code ||
        createdPass?.passCode ||
        createdPass?.data?.shortKey ||
        createdPass?.data?.code;

      if (!code) {
        throw new Error('Pass was created but failed to retrieve pass entry code.');
      }

      setGeneratedPass({
        id: createdPass?._id || createdPass?.id || 'pass-' + Date.now(),
        code,
        visitorName:
          createdPass?.visitorDetails?.name ||
          guestDetails.visitorName ||
          staffDetails.staffName ||
          groupDetails.eventTitle ||
          'Visitor',
        passType: createdPass?.passType || selectedPassType,
        provider:
          createdPass?.vehicleDetails?.vendor ||
          createdPass?.deliveryDetails?.partner ||
          cabProvider ||
          deliveryPartner,
        vehicleNo:
          createdPass?.vehicleDetails?.number ||
          guestOptions.vehicleNo ||
          cabVehicle.vehicleNo,
        validFrom:
          createdPass?.validity?.startDate || new Date().toISOString(),
        validUntil:
          createdPass?.validity?.endDate || new Date(Date.now() + 86400000).toISOString(),
      });
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to create pass. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (generatedPass) {
    return (
      <View className="flex-1 bg-background">
        <GeneratedPassView
          passData={generatedPass}
          onDone={onClose}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <VisitorPassFlowHeader
        passType={selectedPassType}
        stepTitle={steps[currentStepIndex]?.title || ''}
        onBack={handleBack}
        onCancel={onClose}
      />

      <VisitorPassStepIndicator steps={steps} currentStepIndex={currentStepIndex} />

      {renderExtraStepHeader ? renderExtraStepHeader() : null}

      {submitError && (
        <View className="mx-4 mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex-row items-center gap-2">
          <AlertCircle size={16} className="text-destructive shrink-0" />
          <Text className="text-xs text-destructive flex-1">{submitError}</Text>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-4 pb-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...scrollHandlerProps}
      >
        {isAdmin && currentStepIndex === 0 && (
          <AdminPassSetupStep
            data={adminScope}
            onChange={setAdminScope}
          />
        )}

        {selectedPassType === 'GUEST' && (
          <>
            {baseStepIndex === 0 && <GuestDetailsStep data={guestDetails} onChange={setGuestDetails} />}
            {baseStepIndex === 1 && <GuestScheduleStep data={guestSchedule} onChange={setGuestSchedule} />}
            {baseStepIndex === 2 && <GuestPassOptionsStep data={guestOptions} onChange={setGuestOptions} />}
            {baseStepIndex === 3 && (
              <GuestPassReviewStep
                details={guestDetails}
                schedule={guestSchedule}
                options={guestOptions}
              />
            )}
          </>
        )}

        {selectedPassType === 'GROUP' && (
          <>
            {baseStepIndex === 0 && <GroupVisitDetailsStep data={groupDetails} onChange={setGroupDetails} />}
            {baseStepIndex === 1 && <GroupScheduleStep data={groupDetails} onChange={setGroupDetails} />}
            {baseStepIndex === 2 && (
              <AddGroupGuestsStep
                guests={groupGuests}
                onAddGuest={(g) => setGroupGuests((prev) => [...prev, g])}
                onRemoveGuest={(id) => setGroupGuests((prev) => prev.filter((g) => g.id !== id))}
              />
            )}
            {baseStepIndex === 3 && (
              <GroupPassReviewStep
                details={groupDetails}
                guests={groupGuests}
              />
            )}
          </>
        )}

        {selectedPassType === 'CAB' && (
          <>
            {baseStepIndex === 0 && (
              <CabProviderStep
                selectedProvider={cabProvider}
                onSelectProvider={setCabProvider}
                customProviderName={customCabProvider}
                onCustomProviderChange={setCustomCabProvider}
              />
            )}
            {baseStepIndex === 1 && <CabVehicleStep data={cabVehicle} onChange={setCabVehicle} />}
            {baseStepIndex === 2 && <CabScheduleStep data={cabSchedule} onChange={setCabSchedule} />}
            {baseStepIndex === 3 && (
              <CabPassReviewStep
                provider={cabProvider}
                vehicle={cabVehicle}
                schedule={cabSchedule}
                customProviderName={customCabProvider}
              />
            )}
          </>
        )}

        {selectedPassType === 'DELIVERY' && (
          <>
            {baseStepIndex === 0 && (
              <DeliveryPartnerStep
                selectedPartner={deliveryPartner}
                onSelectPartner={setDeliveryPartner}
                customPartnerName={customDeliveryPartner}
                onCustomPartnerChange={setCustomDeliveryPartner}
              />
            )}
            {baseStepIndex === 1 && <DeliveryDetailsStep data={deliveryDetails} onChange={setDeliveryDetails} />}
            {baseStepIndex === 2 && <DeliveryValidityStep data={deliveryValidity} onChange={setDeliveryValidity} />}
            {baseStepIndex === 3 && (
              <DeliveryPassReviewStep
                partner={deliveryPartner}
                details={deliveryDetails}
                validity={deliveryValidity}
                customPartnerName={customDeliveryPartner}
              />
            )}
          </>
        )}

        {selectedPassType === 'SERVICE' && (
          <>
            {baseStepIndex === 0 && <StaffDetailsStep data={staffDetails} onChange={setStaffDetails} />}
            {baseStepIndex === 1 && <ServiceTypeStep selectedService={serviceCategory} onSelectService={setServiceCategory} />}
            {baseStepIndex === 2 && <ServiceDateRangeStep data={serviceDateRange} onChange={setServiceDateRange} />}
            {baseStepIndex === 3 && (
              <ServiceWeekdayStep
                selectedWeekdays={serviceWeekdays}
                onToggleWeekday={(dayId: string) =>
                  setServiceWeekdays((prev) =>
                    prev.includes(dayId) ? prev.filter((id) => id !== dayId) : [...prev, dayId]
                  )
                }
              />
            )}
            {baseStepIndex === 4 && <ServiceTimeWindowStep data={serviceTimeWindow} onChange={setServiceTimeWindow} />}
            {baseStepIndex === 5 && (
              <ServicePassReviewStep
                staff={staffDetails}
                serviceCategory={serviceCategory}
                dateRange={serviceDateRange}
                weekdays={serviceWeekdays}
                timeWindow={serviceTimeWindow}
              />
            )}
          </>
        )}
      </ScrollView>

      <VisitorPassFlowFooter
        onBack={handleBack}
        onNext={handleNext}
        isLastStep={isLastStep}
        loading={loading}
      />

      <VisitorInvitationTypeSheet
        visible={typeSheetOpen}
        onClose={() => setTypeSheetOpen(false)}
        onSelectType={(type) => {
          setSelectedPassType(type);
          setCurrentStepIndex(0);
          setTypeSheetOpen(false);
        }}
      />
    </View>
  );
};

export default VisitorPassWizard;
