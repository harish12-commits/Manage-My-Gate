/**
 * Staff reject a booking that needs approval. A reason is required: the resident sees it,
 * and anything paid is refunded to their wallet.
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/forms/TextInput';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityReservation } from '../types/amenityDomain.types';
import { formatAmenityAmount } from '../utils/amenityStateHelpers';

export interface RejectBookingSheetProps {
  reservation: AmenityReservation | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
  error?: string | null;
}

export function RejectBookingSheet({ reservation, visible, onClose, onConfirm, loading = false, error = null }: RejectBookingSheetProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!visible) setReason('');
  }, [visible]);

  if (!visible || !reservation) return null;
  const paid = Number(reservation.paidAmount || 0);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('amenity_admin_reject_title', 'Reject booking')}>
      <View testID="reject-booking-sheet" className="py-2 gap-3">
        <Text variant="muted" className="text-xs">
          {paid > 0
            ? t('amenity_admin_reject_refund', '{amount} paid will be refunded to the resident wallet.', { amount: formatAmenityAmount(paid) })
            : t('amenity_admin_reject_no_refund', 'Nothing was paid for this booking.')}
        </Text>
        <TextInput
          label={t('amenity_admin_reject_reason', 'Reason (shown to the resident)')}
          value={reason}
          onChangeText={setReason}
          placeholder={t('amenity_admin_reject_placeholder', 'e.g. The hall is reserved for a community event')}
          multiline
          numberOfLines={3}
        />
        {error ? <ErrorBanner title={t('amenity_admin_action_failed', 'Not completed')} message={error} /> : null}
        <View className="flex-row gap-3 mt-1">
          <Button variant="outline" className="flex-1" disabled={loading} onPress={onClose}>
            <Text className="font-semibold text-sm">{t('amenity_inspection_back', 'Back')}</Text>
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={loading || !reason.trim()}
            onPress={() => onConfirm(reason.trim())}
            testID="reject-booking-confirm"
          >
            <Text className="font-bold text-sm text-destructive-foreground">{t('amenity_admin_reject', 'Reject')}</Text>
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
}

export default RejectBookingSheet;
