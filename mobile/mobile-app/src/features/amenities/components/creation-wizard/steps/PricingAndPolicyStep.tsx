import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import { Chip } from '@/components/common/Chip';
import { ToggleSwitch } from '@/components/forms/ToggleSwitch';
import { Check, ShieldAlert, CircleDollarSign } from 'lucide-react-native';
import { AmenityArchetype, AmenityPricingType } from '../../../types/amenityDomain.types';
import { PRICING_CHIP_OPTIONS } from '../../../constants/amenityCatalogPresets';
import { useTranslation } from '@/src/utils/i18n';
import type { PaymentCollectionMode } from '../../../utils/mapAmenityCreationPayloadStrategy';

export interface PricingAndPolicyData {
  pricingType: AmenityPricingType;
  baseRate: number | string;
  securityDeposit: number | string;
  isCancellationAllowed: boolean;
  refundCutoffHours: number | string;
  refundPercentage: number | string;
  paymentMode?: PaymentCollectionMode;
  advanceType?: 'FIXED' | 'PERCENT';
  advanceValue?: number | string;
}

export interface PricingAndPolicyStepProps {
  archetype: AmenityArchetype;
  data: PricingAndPolicyData;
  onChange: (data: PricingAndPolicyData) => void;
  errors?: Partial<Record<keyof PricingAndPolicyData, string>>;
}

export const PricingAndPolicyStep: React.FC<PricingAndPolicyStepProps> = ({
  archetype,
  data,
  onChange,
  errors = {},
}) => {
  const { t } = useTranslation();
  const currentPricingType = data.pricingType || 'FREE';
  const paymentMode: PaymentCollectionMode = data.paymentMode || 'FULL';
  const advanceType = data.advanceType || 'PERCENT';
  // How the rate is charged (matches the server's pricing for each facility type).
  const rateUnit =
    currentPricingType === 'DAILY'
      ? archetype === 'ROOM_RESOURCE'
        ? t('amenity_create_rate_night', 'per night')
        : t('amenity_create_rate_day', 'per day')
      : currentPricingType === 'FIXED_EVENT'
      ? t('amenity_create_rate_booking', 'per booking')
      : archetype === 'SHARED_CAPACITY'
      ? t('amenity_create_rate_person_hour', 'per person per hour')
      : archetype === 'INVENTORY_TOOLS'
      ? t('amenity_create_rate_item_hour', 'per item per hour')
      : t('amenity_create_rate_hour', 'per hour');

  const applyRefundPreset = (cutoff: number, pct: number) => {
    onChange({
      ...data,
      refundCutoffHours: cutoff,
      refundPercentage: pct,
    });
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 gap-4 pb-8"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-1">
        <Text variant="large" className="font-bold text-foreground">
          Pricing Model & Cancellation Policy
        </Text>
        <Text variant="muted" className="text-xs">
          Set resident access fees, security deposits, and cancellation refund tiers.
        </Text>
      </View>

      {/* Pricing Model Chips */}
      <View className="bg-card p-4 rounded-3xl border border-border gap-3">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-2xl bg-primary/10 items-center justify-center">
            <CircleDollarSign size={20} className="text-primary" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-foreground">
              Billing Model
            </Text>
            <Text variant="muted" className="text-xs">
              Choose how residents are charged for this facility.
            </Text>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2">
          {PRICING_CHIP_OPTIONS.map((p) => {
            const isSelected = currentPricingType === p.value;
            return (
              <Chip
                key={p.value}
                label={p.label}
                selected={isSelected}
                onPress={() => {
                  if (p.value === 'FREE') {
                    // A free facility can still take a refundable deposit (e.g. borrowed tools).
                    onChange({ ...data, pricingType: p.value, baseRate: 0, paymentMode: 'FULL' });
                  } else {
                    onChange({
                      ...data,
                      pricingType: p.value,
                      baseRate: Number(data.baseRate) > 0 ? data.baseRate : '',
                    });
                  }
                }}
              />
            );
          })}
        </View>

        {currentPricingType === 'FREE' ? (
          <View className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 flex-row items-center gap-2 mt-1">
            <Check size={16} className="text-emerald-600" />
            <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex-1">
              Free Access — Residents can book without payment transactions.
            </Text>
          </View>
        ) : (
          <View className="gap-3 mt-1">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextInput
                  label={`${t('amenity_create_rate', 'Rate (₹)')} ${rateUnit} *`}
                  placeholder="250"
                  keyboardType="numeric"
                  required
                  value={
                    data.baseRate === undefined ||
                    data.baseRate === null ||
                    (data.baseRate === 0 && (currentPricingType as string) !== 'FREE')
                      ? ''
                      : String(data.baseRate)
                  }
                  onChangeText={(val) => onChange({ ...data, baseRate: val })}
                  error={errors.baseRate}
                />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Refundable deposit (allowed on free facilities too) */}
      <View className="bg-card p-4 rounded-3xl border border-border gap-2">
        <TextInput
          label={t('amenity_create_deposit', 'Refundable deposit (₹)')}
          helperText={t('amenity_create_deposit_sub', 'Collected when booking and returned after use (minus any damage).')}
          placeholder="0"
          keyboardType="numeric"
          value={data.securityDeposit === undefined || data.securityDeposit === null ? '' : String(data.securityDeposit)}
          onChangeText={(val) => onChange({ ...data, securityDeposit: val })}
          error={errors.securityDeposit}
          testID="create-deposit"
        />
      </View>

      {/* When the price is paid */}
      {currentPricingType !== 'FREE' ? (
        <View className="bg-card p-4 rounded-3xl border border-border gap-3">
          <Text className="text-sm font-bold text-foreground">{t('amenity_create_pay_title', 'When is it paid?')}</Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t('amenity_create_pay_full', 'In full when booking')}
              selected={paymentMode === 'FULL'}
              onPress={() => onChange({ ...data, paymentMode: 'FULL' })}
              testID="pay-mode-FULL"
            />
            <Chip
              label={t('amenity_create_pay_advance', 'Advance, balance later')}
              selected={paymentMode === 'ADVANCE'}
              onPress={() => onChange({ ...data, paymentMode: 'ADVANCE' })}
              testID="pay-mode-ADVANCE"
            />
            <Chip
              label={t('amenity_create_pay_gate', 'At the gate')}
              selected={paymentMode === 'PAY_AT_GATE'}
              onPress={() => onChange({ ...data, paymentMode: 'PAY_AT_GATE' })}
              testID="pay-mode-PAY_AT_GATE"
            />
          </View>
          {paymentMode === 'ADVANCE' ? (
            <View className="gap-2">
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label={t('amenity_create_adv_percent', '% of the price')}
                  selected={advanceType === 'PERCENT'}
                  onPress={() => onChange({ ...data, advanceType: 'PERCENT' })}
                  testID="adv-type-PERCENT"
                />
                <Chip
                  label={t('amenity_create_adv_fixed', 'Fixed ₹')}
                  selected={advanceType === 'FIXED'}
                  onPress={() => onChange({ ...data, advanceType: 'FIXED' })}
                  testID="adv-type-FIXED"
                />
              </View>
              <TextInput
                label={
                  advanceType === 'PERCENT'
                    ? t('amenity_create_adv_value_pct', 'Advance (%)')
                    : t('amenity_create_adv_value_fixed', 'Advance (₹)')
                }
                placeholder={advanceType === 'PERCENT' ? '25' : '1000'}
                keyboardType="numeric"
                value={String(data.advanceValue ?? '')}
                onChangeText={(val) => onChange({ ...data, advanceValue: val })}
                error={errors.advanceValue}
                testID="create-advance-value"
              />
            </View>
          ) : null}
          <Text variant="muted" className="text-xs">
            {paymentMode === 'FULL'
              ? t('amenity_create_pay_full_sub', 'Residents pay the full price (and any deposit) to confirm.')
              : paymentMode === 'ADVANCE'
              ? t(
                  'amenity_create_pay_advance_sub',
                  'Residents pay the advance and deposit to confirm; the balance is paid online later or at the gate before entry.'
                )
              : t('amenity_create_pay_gate_sub', 'Residents confirm without paying; the gate collects the price before entry.')}
          </Text>
        </View>
      ) : null}

      {/* Cancellation & Refund Policies */}
      <View className="bg-card p-4 rounded-3xl border border-border gap-3.5">
        <ToggleSwitch
          label="Allow Resident Cancellation"
          description="Enables residents to cancel active bookings within the cutoff window"
          value={data.isCancellationAllowed ?? true}
          onValueChange={(val) => onChange({ ...data, isCancellationAllowed: val })}
        />

        {data.isCancellationAllowed && (
          <View className="gap-3 pt-2 border-t border-border/60">
            <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Refund Tier Presets
            </Text>

            <View className="flex-row flex-wrap gap-2">
              <Chip
                label="Flexible (100% refund up to 2h)"
                selected={
                  Number(data.refundCutoffHours) === 2 &&
                  Number(data.refundPercentage) === 100
                }
                onPress={() => applyRefundPreset(2, 100)}
              />
              <Chip
                label="Moderate (50% refund up to 24h)"
                selected={
                  Number(data.refundCutoffHours) === 24 &&
                  Number(data.refundPercentage) === 50
                }
                onPress={() => applyRefundPreset(24, 50)}
              />
              <Chip
                label="Strict (No Refund / 0%)"
                selected={Number(data.refundPercentage) === 0}
                onPress={() => applyRefundPreset(0, 0)}
              />
            </View>

            <View className="flex-row gap-3 mt-1">
              <View className="flex-1">
                <TextInput
                  label="Cutoff Window (Hours)"
                  placeholder="24"
                  keyboardType="numeric"
                  value={String(data.refundCutoffHours ?? '24')}
                  onChangeText={(val) => onChange({ ...data, refundCutoffHours: val })}
                />
              </View>
              <View className="flex-1">
                <TextInput
                  label="Refund Percentage (%)"
                  placeholder="100"
                  keyboardType="numeric"
                  value={String(data.refundPercentage ?? '100')}
                  onChangeText={(val) => onChange({ ...data, refundPercentage: val })}
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default PricingAndPolicyStep;
