/**
 * Standalone Reservation Detail Route: /(resident)/amenities/reservations/[id]
 * Phase 6C.3 - Resident Reservation Detail & Digital Access Pass Screen.
 * Uses server-authoritative state via useResidentReservationDetail and v2 thunks.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { EmptyState } from '@/components/feedback/EmptyState';
import { CalendarX } from 'lucide-react-native';
import { useResidentReservationDetail } from '@/src/features/amenities/hooks/useResidentReservationDetail';
import { ResidentReservationDetailView } from '@/src/features/amenities/components/ResidentReservationDetailView';
import { ResidentCancelModal } from '@/src/features/amenities/components/ResidentCancelModal';
import { useCancellationPreview } from '@/src/features/amenities/hooks/useCancellationPreview';
import { useReservationBalancePayment } from '@/src/features/amenities/hooks/useReservationBalancePayment';
import { RazorpayCheckoutModal } from '@/src/features/billing/components/RazorpayCheckoutModal';
import { useTranslation } from '@/src/utils/i18n';

export default function ReservationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();

  const {
    reservation,
    accessPasses,
    loading,
    isRefreshing,
    isCancelling,
    cancelModalOpen,
    setCancelModalOpen,
    cancelError,
    error,
    isCancellable,
    refresh,
    cancelReservation,
    clearError,
  } = useResidentReservationDetail(id);

  const cancelPreview = useCancellationPreview(cancelModalOpen ? reservation?._id : null);
  const balancePayment = useReservationBalancePayment(reservation);

  const handleConfirmCancel = useCallback(
    async (reason?: string) => {
      try {
        await cancelReservation(reason);
      } catch {
        // Shown inside the cancel sheet (cancelError)
      }
    },
    [cancelReservation]
  );

  const handleRetry = useCallback(() => {
    clearError();
    refresh();
  }, [clearError, refresh]);

  return (
    <ScreenShell
      title={t('amenity_reservation_detail_title', 'Reservation Details')}
      subtitle={reservation?.facilityName || t('amenity_booking_label', 'Amenity Booking')}
      iconName="CalendarCheck"
      loading={loading && !reservation}
      error={error?.message || null}
      onRetry={handleRetry}
      scrollable={false}
    >
      {!reservation && !loading ? (
        <View className="flex-1 items-center justify-center p-4">
          <EmptyState
            icon={CalendarX}
            title={t('amenity_reservation_not_found', 'Reservation Not Found')}
            description={t('amenity_reservation_not_found_body', 'The requested reservation could not be found or you do not have permission to view it.')}
            actionLabel={t('amenity_back_to_bookings', 'Back to My Bookings')}
            onAction={() => router.back()}
          />
        </View>
      ) : reservation ? (
        <View className="flex-1 bg-background">
          <ResidentReservationDetailView
            reservation={reservation}
            accessPasses={accessPasses}
            isCancellable={isCancellable}
            onCancelPress={() => setCancelModalOpen(true)}
            payment={{
              canPayBalance: balancePayment.canPay,
              walletBalance: balancePayment.walletBalance,
              isRazorpayConfigured: balancePayment.isRazorpayConfigured,
              paying: balancePayment.paying,
              error: balancePayment.error,
              onPayFromWallet: balancePayment.payFromWallet,
              onPayOnline: balancePayment.payOnline,
            }}
            testID="reservation-detail-view"
          />

          <ResidentCancelModal
            visible={cancelModalOpen}
            reservation={reservation}
            onClose={() => setCancelModalOpen(false)}
            onConfirm={handleConfirmCancel}
            loading={isCancelling}
            preview={cancelPreview.preview}
            previewLoading={cancelPreview.loading}
            error={cancelError}
            testID="resident-detail-cancel-modal"
          />

          {balancePayment.razorpayOptions ? (
            <RazorpayCheckoutModal
              visible={balancePayment.isRazorpayOpen}
              options={balancePayment.razorpayOptions}
              onSuccess={balancePayment.onRazorpaySuccess}
              onDismiss={balancePayment.onRazorpayDismiss}
              onError={balancePayment.onRazorpayError}
            />
          ) : null}
        </View>
      ) : null}
    </ScreenShell>
  );
}
