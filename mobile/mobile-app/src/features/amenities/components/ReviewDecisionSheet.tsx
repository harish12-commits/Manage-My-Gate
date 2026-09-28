/**
 * Staff decide a booking flagged for review. What can be decided depends on why it was
 * flagged:
 *  - no-show: keep the payment, refund per the facility policy, or refund a stated share;
 *  - unpaid balance: the same, or let the booking go ahead;
 *  - item not returned: extend the loan (the return itself is recorded at the gate).
 * The deposit is always returned when the booking is closed.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/forms/TextInput';
import { RadioGroup } from '@/components/forms/RadioGroup';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityReservation } from '../types/amenityDomain.types';
import type { ReviewResolution } from '../hooks/useAdminBookingQueue';

export interface ReviewDecisionSheetProps {
  reservation: AmenityReservation | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (action: ReviewResolution, options: { refundPercentage?: number; notes?: string }) => void;
  loading?: boolean;
  error?: string | null;
}

export function ReviewDecisionSheet({ reservation, visible, onClose, onConfirm, loading = false, error = null }: ReviewDecisionSheetProps) {
  const { t } = useTranslation();
  const reason = reservation?.adminReview?.reason || 'NO_SHOW';
  const policyPct = reservation?.policySnapshot?.cancellation?.refundPercentage;

  const options = useMemo(() => {
    const refundOptions = [
      {
        value: 'FORFEIT',
        label: t('amenity_review_forfeit', 'Keep the payment'),
        description: t('amenity_review_forfeit_sub', 'No refund of the booking amount.'),
      },
      {
        value: 'REFUND_POLICY',
        label: t('amenity_review_policy', 'Refund per policy'),
        description:
          policyPct != null
            ? t('amenity_review_policy_sub', '{percent}% of the booking amount.', { percent: policyPct })
            : t('amenity_review_policy_sub_na', 'As set in the facility cancellation policy.'),
      },
      {
        value: 'REFUND_CUSTOM',
        label: t('amenity_review_custom', 'Refund a different share'),
        description: t('amenity_review_custom_sub', 'Enter a percentage and the reason.'),
      },
    ];
    const extend = {
      value: 'EXTEND',
      label: reason === 'OVERDUE_RETURN' ? t('amenity_review_extend_loan', 'Extend the loan') : t('amenity_review_extend', 'Let the booking go ahead'),
      description:
        reason === 'OVERDUE_RETURN'
          ? t('amenity_review_extend_loan_sub', 'Record the return at the gate when the item comes back.')
          : t('amenity_review_extend_sub', 'The balance can still be paid online or at the gate.'),
    };
    if (reason === 'OVERDUE_RETURN') return [extend];
    if (reason === 'UNPAID_BALANCE') return [extend, ...refundOptions];
    return refundOptions;
  }, [reason, policyPct, t]);

  const [action, setAction] = useState<ReviewResolution>(options[0].value as ReviewResolution);
  const [percent, setPercent] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setAction(options[0].value as ReviewResolution);
      setPercent('');
      setNotes('');
    }
  }, [visible, options]);

  if (!visible || !reservation) return null;

  const pct = Number(percent);
  const customInvalid = action === 'REFUND_CUSTOM' && (!percent.trim() || !Number.isFinite(pct) || pct < 0 || pct > 100 || !notes.trim());

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('amenity_review_sheet_title', 'Decide flagged booking')}>
      <View testID="review-decision-sheet" className="py-2 gap-3">
        <RadioGroup value={action} onValueChange={(v) => setAction(v as ReviewResolution)} options={options} />

        {action === 'REFUND_CUSTOM' ? (
          <TextInput
            label={t('amenity_review_percent_label', 'Refund (%)')}
            value={percent}
            onChangeText={setPercent}
            placeholder="50"
            keyboardType="numeric"
          />
        ) : null}
        <TextInput
          label={
            action === 'REFUND_CUSTOM'
              ? t('amenity_review_notes_required', 'Reason (required)')
              : t('amenity_review_notes', 'Note (optional)')
          }
          value={notes}
          onChangeText={setNotes}
          placeholder={t('amenity_review_notes_placeholder', 'Visible to amenity staff')}
          multiline
          numberOfLines={2}
        />
        {action !== 'EXTEND' ? (
          <Text variant="muted" className="text-xs">
            {t('amenity_review_deposit_note', 'Any deposit is returned to the resident wallet.')}
          </Text>
        ) : null}

        {error ? <ErrorBanner title={t('amenity_admin_action_failed', 'Not completed')} message={error} /> : null}

        <View className="flex-row gap-3 mt-1">
          <Button variant="outline" className="flex-1" disabled={loading} onPress={onClose}>
            <Text className="font-semibold text-sm">{t('amenity_inspection_back', 'Back')}</Text>
          </Button>
          <Button
            className="flex-1"
            disabled={loading || customInvalid}
            onPress={() =>
              onConfirm(action, {
                ...(action === 'REFUND_CUSTOM' ? { refundPercentage: pct } : {}),
                ...(notes.trim() ? { notes: notes.trim() } : {}),
              })
            }
            testID="review-decision-confirm"
          >
            <Text className="font-bold text-sm text-primary-foreground">{t('amenity_review_confirm', 'Confirm decision')}</Text>
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
}

export default ReviewDecisionSheet;
