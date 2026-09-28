/**
 * Gate return inspection for borrowed items: the guard records the item's condition,
 * and for damage a description and the amount to keep from the refundable deposit.
 * The server settles the deposit (the rest goes back to the resident's wallet).
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/forms/TextInput';
import { RadioGroup } from '@/components/forms/RadioGroup';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useTranslation } from '@/src/utils/i18n';
import { formatAmenityAmount } from '../utils/amenityStateHelpers';

export interface ReturnInspection {
  isDamaged: boolean;
  damageNotes?: string;
  damageCharge?: number;
}

export interface ReturnInspectionSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (inspection: ReturnInspection) => void;
  depositAmount?: number;
  reservationNumber?: string | null;
  loading?: boolean;
  error?: string | null;
}

export function ReturnInspectionSheet({
  visible,
  onClose,
  onConfirm,
  depositAmount = 0,
  reservationNumber,
  loading = false,
  error = null,
}: ReturnInspectionSheetProps) {
  const { t } = useTranslation();
  const [condition, setCondition] = useState<'GOOD' | 'DAMAGED'>('GOOD');
  const [notes, setNotes] = useState('');
  const [charge, setCharge] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setCondition('GOOD');
      setNotes('');
      setCharge('');
      setLocalError(null);
    }
  }, [visible]);

  if (!visible) return null;

  const handleConfirm = () => {
    if (loading) return;
    if (condition === 'GOOD') {
      onConfirm({ isDamaged: false });
      return;
    }
    const amount = Number(charge || 0);
    if (!notes.trim()) {
      setLocalError(t('amenity_inspection_err_notes', 'Describe the damage.'));
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setLocalError(t('amenity_inspection_err_amount', 'Enter a valid amount.'));
      return;
    }
    setLocalError(null);
    onConfirm({ isDamaged: true, damageNotes: notes.trim(), damageCharge: amount });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('amenity_inspection_title', 'Return inspection')}>
      <View testID="return-inspection-sheet" className="py-2 gap-3">
        <Text variant="muted" className="text-xs">
          {reservationNumber
            ? t('amenity_inspection_subtitle_ref', 'Booking #{number} · Deposit {amount}', {
                number: reservationNumber,
                amount: formatAmenityAmount(depositAmount),
              })
            : t('amenity_inspection_subtitle', 'Deposit {amount}', { amount: formatAmenityAmount(depositAmount) })}
        </Text>

        <RadioGroup
          value={condition}
          onValueChange={(value) => setCondition(value as 'GOOD' | 'DAMAGED')}
          options={[
            {
              value: 'GOOD',
              label: t('amenity_inspection_good', 'Returned in good condition'),
              description: t('amenity_inspection_good_sub', 'The full deposit goes back to the resident.'),
            },
            {
              value: 'DAMAGED',
              label: t('amenity_inspection_damaged', 'Damaged or incomplete'),
              description: t('amenity_inspection_damaged_sub', 'Keep part or all of the deposit.'),
            },
          ]}
        />

        {condition === 'DAMAGED' ? (
          <View className="gap-3">
            <TextInput
              label={t('amenity_inspection_notes_label', 'What is damaged or missing')}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('amenity_inspection_notes_placeholder', 'e.g. Drill bit set missing')}
              multiline
              numberOfLines={3}
            />
            <TextInput
              label={t('amenity_inspection_charge_label', 'Amount to keep (₹)')}
              value={charge}
              onChangeText={setCharge}
              placeholder="0"
              keyboardType="numeric"
            />
            <Text variant="muted" className="text-xs">
              {t('amenity_inspection_charge_hint', 'At most the deposit ({amount}) is kept; the rest is refunded to the wallet.', {
                amount: formatAmenityAmount(depositAmount),
              })}
            </Text>
          </View>
        ) : null}

        {localError || error ? (
          <ErrorBanner title={t('amenity_inspection_err_title', 'Exit not recorded')} message={(localError || error) as string} />
        ) : null}

        <View className="flex-row gap-3 mt-1">
          <Button variant="outline" disabled={loading} onPress={onClose} className="flex-1" testID="return-inspection-cancel">
            <Text className="font-semibold text-sm">{t('amenity_inspection_back', 'Back')}</Text>
          </Button>
          <Button disabled={loading} onPress={handleConfirm} className="flex-1" testID="return-inspection-confirm">
            <Text className="font-bold text-sm text-primary-foreground">
              {loading ? t('amenity_inspection_saving', 'Recording…') : t('amenity_inspection_confirm', 'Record return')}
            </Text>
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
}

export default ReturnInspectionSheet;
