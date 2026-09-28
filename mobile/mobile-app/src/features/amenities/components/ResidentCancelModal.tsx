/**
 * ResidentCancelModal Component
 * Bottom sheet for cancelling a booking: shows the refund the server will give under the
 * facility's cancellation policy (credited to the wallet), takes an optional reason, and
 * shows why a cancellation is not possible when the policy blocks it.
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { TextInput } from '@/components/forms/TextInput';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityReservation, AmenityCancellationPreview } from '../types/amenityDomain.types';
import { formatAmenityAmount } from '../utils/amenityStateHelpers';

export interface ResidentCancelModalProps {
  reservation: AmenityReservation | null;
  visible: boolean;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
  loading?: boolean;
  preview?: AmenityCancellationPreview | null;
  /** Staff cancelling for a resident: wording addresses staff and the reason is shown to the resident. */
  forStaff?: boolean;
  previewLoading?: boolean;
  error?: string | null;
  testID?: string;
}

export function ResidentCancelModal({
  reservation,
  visible,
  onConfirm,
  onClose,
  loading = false,
  preview = null,
  previewLoading = false,
  error = null,
  testID,
  forStaff = false,
}: ResidentCancelModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (!visible) setReason('');
  }, [visible]);

  if (!visible || !reservation) return null;

  const facilityName = reservation.facilityName || t('amenity_facility', 'Amenity Facility');
  const blocked = Boolean(preview && !preview.allowed);
  const refund = preview?.refund;

  const refundMessage = () => {
    if (previewLoading) return t('amenity_cancel_refund_loading', 'Checking the refund for this booking…');
    if (!preview) return t('amenity_cancel_refund_policy', 'Any refund follows the facility cancellation policy and goes to your wallet.');
    if (blocked) return preview.blockReason || t('amenity_cancel_not_allowed', 'This booking can no longer be cancelled.');
    if (!refund || refund.total <= 0) {
      return Number(reservation.paidAmount || 0) > 0
        ? t('amenity_cancel_no_refund', 'Under the cancellation policy, nothing will be refunded.')
        : t('amenity_cancel_nothing_paid', 'Nothing was paid for this booking, so there is no refund.');
    }
    if (forStaff) {
      return t('amenity_cancel_refund_to_resident', '{amount} will be refunded to the resident wallet.', {
        amount: formatAmenityAmount(refund.total),
      });
    }
    return t('amenity_cancel_refund_to_wallet', '{amount} will be refunded to your wallet.', {
      amount: formatAmenityAmount(refund.total),
    });
  };

  const handleConfirm = () => {
    if (loading || blocked || previewLoading) return;
    onConfirm(reason.trim() || undefined);
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose} title={t('amenity_cancel_title', 'Cancel booking')}>
      <View testID={testID} className="py-2 gap-3">
        <Text className="text-sm font-semibold text-foreground">
          {reservation.reservationNumber
            ? `${facilityName} · #${reservation.reservationNumber}`
            : facilityName}
        </Text>

        <View className="bg-muted/40 p-3 rounded-2xl border border-border/50 gap-1.5">
          <Text className="text-sm font-semibold text-foreground">{refundMessage()}</Text>
          {!blocked && refund && refund.total > 0 ? (
            <>
              {refund.bookingRefund > 0 ? (
                <Text variant="muted" className="text-xs">
                  {t('amenity_cancel_booking_share', 'Booking: {amount} ({percent}%)', {
                    amount: formatAmenityAmount(refund.bookingRefund),
                    percent: refund.percentage,
                  })}
                </Text>
              ) : null}
              {refund.depositRefund > 0 ? (
                <Text variant="muted" className="text-xs">
                  {t('amenity_cancel_deposit_share', 'Deposit: {amount} (always returned)', {
                    amount: formatAmenityAmount(refund.depositRefund),
                  })}
                </Text>
              ) : null}
            </>
          ) : null}
          {!blocked ? (
            <Text variant="muted" className="text-xs">
              {t('amenity_cancel_pass_revoked', 'Your time slot is released and the gate pass stops working.')}
            </Text>
          ) : null}
        </View>

        {!blocked ? (
          <TextInput
            label={t('amenity_cancel_reason_label', 'Reason (optional)')}
            value={reason}
            onChangeText={setReason}
            placeholder={
              forStaff
                ? t('amenity_cancel_reason_placeholder_staff', 'Shown to the resident, e.g. Court resurfacing')
                : t('amenity_cancel_reason_placeholder', 'Tell the management why you are cancelling')
            }
            multiline
            numberOfLines={3}
          />
        ) : null}

        {error ? <ErrorBanner title={t('amenity_cancel_failed', 'Could not cancel')} message={error} /> : null}

        <View className="flex-row gap-3 mt-1">
          <Button variant="outline" disabled={loading} onPress={handleClose} className="flex-1" testID="cancel-sheet-keep">
            <Text className="font-semibold text-sm">{t('amenity_cancel_keep', 'Keep booking')}</Text>
          </Button>
          {!blocked ? (
            <Button
              variant="destructive"
              disabled={loading || previewLoading}
              onPress={handleConfirm}
              testID="cancel-sheet-confirm"
              className="flex-1"
              accessibilityLabel={t('amenity_cancel_confirm', 'Cancel booking')}
            >
              <Text className="font-bold text-sm text-destructive-foreground">
                {loading ? t('amenity_cancel_cancelling', 'Cancelling…') : t('amenity_cancel_confirm', 'Cancel booking')}
              </Text>
            </Button>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

export default ResidentCancelModal;
