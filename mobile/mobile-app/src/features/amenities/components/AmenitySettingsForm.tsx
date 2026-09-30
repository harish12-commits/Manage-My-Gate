/**
 * Community amenity rules, edited in the units staff think in (hours per month, days,
 * minutes at the gate) and saved in the API's units (minutes).
 */

import React, { useEffect } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import { ToggleSwitch } from '@/components/forms/ToggleSwitch';
import { SettingsCard } from '@/components/settings';
import { ActionBar } from '@/components/ui/ActionBar';
import { useTranslation } from '@/src/utils/i18n';
import type { AmenityCommunitySettings, AmenitySettingsUpdate } from '../store/amenitySettingsSlice';

const whole = (min: number, max: number, message: string) =>
  yup
    .number()
    .transform((value, original) => (String(original ?? '').trim() === '' ? undefined : Number(original)))
    .typeError(message)
    .required(message)
    .integer(message)
    .min(min, message)
    .max(max, message);

const schema = yup.object({
  quotaEnabled: yup.boolean().required(),
  quotaHours: whole(1, 744, 'Enter 1–744 hours'),
  longStayDays: whole(1, 31, 'Enter 1–31 days'),
  approvalTimeoutHours: whole(1, 720, 'Enter 1–720 hours'),
  checkInEarlyMinutes: whole(0, 240, 'Enter 0–240 minutes'),
  noShowGraceMinutes: whole(0, 1440, 'Enter 0–1440 minutes'),
});

type FormValues = yup.InferType<typeof schema>;

const toForm = (s: AmenityCommunitySettings): FormValues => ({
  quotaEnabled: s.quota.enabled,
  quotaHours: Math.round(s.quota.limitMinutes / 60),
  longStayDays: Math.round(s.quota.longDurationLimitMinutes / 1440),
  approvalTimeoutHours: s.approvalTimeoutHours,
  checkInEarlyMinutes: s.checkInEarlyMinutes,
  noShowGraceMinutes: s.noShowGraceMinutes,
});

export interface AmenitySettingsFormProps {
  settings: AmenityCommunitySettings;
  saving?: boolean;
  onSave: (update: AmenitySettingsUpdate) => Promise<boolean>;
  /** Saved / error notices, rendered inside the scroll area so they share the card gutters. */
  banner?: React.ReactNode;
}

export function AmenitySettingsForm({ settings, saving = false, onSave, banner }: AmenitySettingsFormProps) {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: yupResolver(schema), defaultValues: toForm(settings) });

  useEffect(() => {
    reset(toForm(settings));
  }, [settings, reset]);

  const quotaEnabled = watch('quotaEnabled');

  const submit = handleSubmit(async (v) => {
    await onSave({
      quota: {
        enabled: v.quotaEnabled,
        limitMinutes: v.quotaHours * 60,
        longDurationLimitMinutes: v.longStayDays * 1440,
      },
      approvalTimeoutHours: v.approvalTimeoutHours,
      checkInEarlyMinutes: v.checkInEarlyMinutes,
      noShowGraceMinutes: v.noShowGraceMinutes,
    });
  });

  const numberField = (name: Exclude<keyof FormValues, 'quotaEnabled'>, label: string, helper: string, disabled = false) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur } }) => (
        <TextInput
          label={label}
          helperText={helper}
          value={value === undefined || value === null ? '' : String(value)}
          onChangeText={onChange}
          onBlur={onBlur}
          keyboardType="number-pad"
          editable={!disabled}
          error={errors[name]?.message ? t(`amenity_settings_err_${name}`, errors[name]!.message as string) : undefined}
          testID={`amenity-settings-${name}`}
        />
      )}
    />
  );

  return (
    <View className="flex-1">
      <KeyboardAwareScrollView extraScrollHeight={48} contentContainerStyle={{ paddingBottom: 112 }}>
        {banner}
        <SettingsCard title={t('amenity_settings_quota_title', 'Booking quota per unit')} className="p-4 gap-4">
          <Controller
            control={control}
            name="quotaEnabled"
            render={({ field: { value, onChange } }) => (
              <ToggleSwitch
                label={t('amenity_settings_quota_enabled', 'Limit bookings per unit')}
                description={t('amenity_settings_quota_enabled_sub', 'Each household can book up to the hours below every month.')}
                value={Boolean(value)}
                onValueChange={onChange}
              />
            )}
          />
          {numberField(
            'quotaHours',
            t('amenity_settings_quota_hours', 'Hours per month'),
            t('amenity_settings_quota_hours_sub', 'Hourly and session bookings (courts, rooms, halls).'),
            !quotaEnabled
          )}
          {numberField(
            'longStayDays',
            t('amenity_settings_long_days', 'Days per month for stays and loans'),
            t('amenity_settings_long_days_sub', 'Overnight rooms and borrowed items.'),
            !quotaEnabled
          )}
        </SettingsCard>

        <SettingsCard title={t('amenity_settings_approval_title', 'Approvals')} className="p-4 gap-4">
          {numberField(
            'approvalTimeoutHours',
            t('amenity_settings_approval_hours', 'Decide within (hours)'),
            t('amenity_settings_approval_hours_sub', 'Requests not decided in time are closed and refunded to the wallet.')
          )}
        </SettingsCard>

        <SettingsCard title={t('amenity_settings_gate_title', 'At the gate')} className="p-4 gap-4">
          {numberField(
            'checkInEarlyMinutes',
            t('amenity_settings_early_minutes', 'Early entry (minutes)'),
            t('amenity_settings_early_minutes_sub', 'How long before the booking starts a pass is accepted.')
          )}
          {numberField(
            'noShowGraceMinutes',
            t('amenity_settings_grace_minutes', 'No-show grace (minutes)'),
            t('amenity_settings_grace_minutes_sub', 'After this long without a check-in, the booking goes to the staff queue.')
          )}
        </SettingsCard>

        {settings.updatedAt ? (
          <Text variant="muted" className="text-xs text-center mt-4">
            {t('amenity_settings_updated', 'Last changed {date}', { date: new Date(settings.updatedAt).toLocaleString() })}
          </Text>
        ) : null}
      </KeyboardAwareScrollView>

      {isDirty ? (
        <ActionBar
          primaryAction={{ label: t('amenity_settings_save', 'Save changes'), onPress: submit, loading: saving }}
          secondaryAction={{ label: t('amenity_settings_discard', 'Discard'), onPress: () => reset(toForm(settings)) }}
        />
      ) : null}
    </View>
  );
}

export default AmenitySettingsForm;
