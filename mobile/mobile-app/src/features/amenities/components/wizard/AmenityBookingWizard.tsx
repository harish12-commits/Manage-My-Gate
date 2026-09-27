/**
 * Amenity Management Phase 6B.2 - Master Booking Wizard Component
 * Orchestrates controlled multi-step booking, availability validation, server pricing,
 * hold lifecycle, digital wallet/Razorpay payment, and confirmation.
 */

import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { AmenityFacility } from '../../types/amenityDomain.types';
import { useAmenityBookingWizard } from '../../hooks/useAmenityBookingWizard';
import { AmenityBookingFlowHeader } from './AmenityBookingFlowHeader';
import { AmenityBookingStepIndicator } from './AmenityBookingStepIndicator';
import { AmenityBookingFlowFooter } from './AmenityBookingFlowFooter';

// Steps
import { FacilityResourceStep } from './steps/FacilityResourceStep';
import { DateTimeStep } from './steps/DateTimeStep';
import { GuestQuantityStep } from './steps/GuestQuantityStep';
import { BookingReviewStep } from './steps/BookingReviewStep';
import { BookingHoldPaymentStep } from './steps/BookingHoldPaymentStep';
import { BookingResultView } from './steps/BookingResultView';

// Modals
import { WalletTopUpModal } from '../WalletTopUpModal';
import { RazorpayCheckoutModal } from '../../../billing/components/RazorpayCheckoutModal';

export interface AmenityBookingWizardProps {
  facility: AmenityFacility;
  onClose?: () => void;
}

export function AmenityBookingWizard({ facility, onClose }: AmenityBookingWizardProps) {
  const router = useRouter();
  const wizard = useAmenityBookingWizard(facility);

  const isPaymentStep = wizard.currentStep.key === 'payment';
  const isResultStep = wizard.currentStep.key === 'result';
  const isReviewStep = wizard.currentStep.key === 'review';

  const handleCloseToMyBookings = () => {
    wizard.handleRestartBooking();
    router.replace('/(resident)/amenities/my-bookings');
  };

  const handleCancelPress = () => {
    // After booking completion (result step or confirmed reservation), close button navigates directly to My Bookings page
    if (isResultStep || wizard.v2CurrentReservation) {
      handleCloseToMyBookings();
      return;
    }

    if (wizard.activeHold && !wizard.isHoldExpired) {
      wizard.setIsCancelModalOpen(true);
    } else {
      if (onClose) onClose();
      else if (router.canGoBack()) router.back();
      else router.replace('/(resident)/amenities/my-bookings');
    }
  };

  const handleDonePress = () => {
    handleCloseToMyBookings();
  };

  const handleViewBookingsPress = () => {
    handleCloseToMyBookings();
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <AmenityBookingFlowHeader
        archetype={facility.archetype}
        stepTitle={wizard.currentStep.title}
        stepSubtitle={wizard.currentStep.subtitle}
        onBack={wizard.isFirstStep ? undefined : wizard.handleBack}
        onCancel={handleCancelPress}
        canGoBack={!wizard.isFirstStep && !isResultStep}
      />

      {/* Segmented Step Indicator (Hidden on Result View) */}
      {!isResultStep && (
        <AmenityBookingStepIndicator
          steps={wizard.steps}
          currentStepIndex={wizard.currentStepIndex}
        />
      )}

      {/* Main Scrollable Step Canvas */}
      <ScrollView
        className="flex-1 px-4 pt-3"
        contentContainerClassName="pb-6"
        keyboardShouldPersistTaps="handled"
      >
        {wizard.currentStep.key === 'resource' && (
          <FacilityResourceStep
            facility={facility}
            availableResources={wizard.availableResources}
            selectedResource={wizard.selectedResource}
            onSelectResource={wizard.setSelectedResource}
            loading={wizard.resourcesLoading}
          />
        )}

        {wizard.currentStep.key === 'datetime' && (
          <DateTimeStep
            facility={facility}
            selectedDate={wizard.selectedDate}
            startTime={wizard.startTime}
            endTime={wizard.endTime}
            onDateChange={wizard.setSelectedDate}
            onTimeChange={(start, end) => {
              wizard.setStartTime(start);
              wizard.setEndTime(end);
            }}
            checkingAvailability={wizard.checkingAvailability}
            availabilityResult={wizard.availabilityResult}
            onCheckAvailability={wizard.handleEvaluateAvailability}
            availableSlots={wizard.availableDailySlots}
            slotsLoading={wizard.loadingDailySlots}
            error={wizard.stepError}
          />
        )}

        {wizard.currentStep.key === 'quantity' && (
          <GuestQuantityStep
            facility={facility}
            headcount={wizard.headcount}
            quantity={wizard.quantity}
            guests={wizard.guests}
            notes={wizard.bookingNotes}
            onHeadcountChange={wizard.setHeadcount}
            onQuantityChange={wizard.setQuantity}
            onGuestsChange={wizard.setGuests}
            onNotesChange={wizard.setBookingNotes}
            error={wizard.stepError}
          />
        )}

        {wizard.currentStep.key === 'review' && (
          <BookingReviewStep
            facility={facility}
            selectedResource={wizard.selectedResource}
            selectedDate={wizard.selectedDate}
            startTime={wizard.startTime}
            endTime={wizard.endTime}
            headcount={wizard.headcount}
            quantity={wizard.quantity}
            pricingSnapshot={wizard.pricingSnapshot ?? wizard.activeHold?.pricingSnapshot ?? null}
            calculatingPricing={wizard.calculatingPricing}
            notes={wizard.bookingNotes}
            error={wizard.stepError}
          />
        )}

        {wizard.currentStep.key === 'payment' && (
          <BookingHoldPaymentStep
            activeHold={wizard.activeHold}
            holdRemainingSeconds={wizard.holdRemainingSeconds}
            isHoldExpired={wizard.isHoldExpired}
            totalAmount={wizard.pricingSnapshot?.totalAmount ?? wizard.activeHold?.pricingSnapshot?.totalAmount ?? 0}
            currency={wizard.pricingSnapshot?.currency ?? wizard.activeHold?.pricingSnapshot?.currency ?? 'INR'}
            paymentMethod={wizard.paymentMethod}
            onPaymentMethodChange={wizard.setPaymentMethod}
            balance={wizard.balance}
            isRazorpayConfigured={wizard.isRazorpayConfigured}
            onOpenTopUp={() => wizard.setIsTopUpOpen(true)}
            onLaunchRazorpay={wizard.handleLaunchRazorpay}
            onConfirmReservation={wizard.handleConfirmReservation}
            onRestartBooking={wizard.handleRestartBooking}
            confirming={wizard.v2Confirming}
            error={wizard.stepError}
          />
        )}

        {wizard.currentStep.key === 'result' && (
          <BookingResultView
            facility={facility}
            reservation={wizard.v2CurrentReservation}
            accessPasses={wizard.v2AccessPasses}
            isPassEligible={wizard.isPassEligible}
            onDone={handleDonePress}
            onViewBookings={handleViewBookingsPress}
          />
        )}
      </ScrollView>

      {/* Bottom Sticky Action Footer (Hidden on Payment and Result views) */}
      {!isPaymentStep && !isResultStep && (
        <AmenityBookingFlowFooter
          onBack={wizard.isFirstStep ? undefined : wizard.handleBack}
          onNext={wizard.handleNext}
          canGoBack={!wizard.isFirstStep}
          isLastStep={wizard.isLastStep}
          isHoldStep={isReviewStep}
          priceTotal={wizard.pricingSnapshot?.totalAmount ?? wizard.activeHold?.pricingSnapshot?.totalAmount}
          currency={wizard.pricingSnapshot?.currency ?? wizard.activeHold?.pricingSnapshot?.currency ?? 'INR'}
          loading={wizard.checkingAvailability || wizard.calculatingPricing || wizard.v2Holding}
          disabled={
            (wizard.currentStep.key === 'datetime' && wizard.availabilityResult?.available === false) ||
            (wizard.currentStep.key === 'resource' && !wizard.selectedResource)
          }
        />
      )}

      {/* Hold Abandonment Confirmation Modal */}
      <ConfirmationModal
        visible={wizard.isCancelModalOpen}
        title="Abandon Reservation Hold?"
        message="You have an active temporary hold on this facility. If you leave now, your hold will be released and returned to inventory."
        confirmLabel="Leave & Release Hold"
        cancelLabel="Stay in Booking"
        variant="warning"
        onConfirm={wizard.handleReleaseHoldAndExit}
        onCancel={() => wizard.setIsCancelModalOpen(false)}
      />

      {/* Digital Wallet Top-Up Modal */}
      <WalletTopUpModal
        visible={wizard.isTopUpOpen}
        onClose={() => wizard.setIsTopUpOpen(false)}
        onSubmit={wizard.handleTopUpSubmit}
        loading={wizard.walletLoading}
      />

      {/* Razorpay Checkout Modal */}
      {wizard.razorpayOptions && (
        <RazorpayCheckoutModal
          visible={wizard.isRazorpayOpen}
          options={wizard.razorpayOptions}
          onSuccess={wizard.handleRazorpaySuccess}
          onDismiss={wizard.handleRazorpayDismiss}
          onError={(err) => {
            wizard.handleRazorpayDismiss();
            wizard.setStepError(err?.description || 'Payment was cancelled or failed.');
          }}
        />
      )}
    </View>
  );
}

export default AmenityBookingWizard;
