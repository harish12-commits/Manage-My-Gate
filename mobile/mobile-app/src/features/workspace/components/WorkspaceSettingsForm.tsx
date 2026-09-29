import React, { useEffect } from 'react';
import { View, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/forms/TextInput';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { Text } from '@/components/ui/text';
import { useWorkspace } from '../hooks/useWorkspace';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { Mail, Phone, Clock, Globe, Building2 } from 'lucide-react-native';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { getPhoneCountries, setDefaultPhoneCountry } from '@/src/utils/phone';
import { validatePhone } from '@/src/utils/validation';

const COUNTRY_OPTIONS = getPhoneCountries().map((c) => ({
  label: `${c.flag} ${c.name} (${c.dialCode})`,
  value: c.code,
}));

import { TIMEZONE_OPTIONS, LANGUAGE_OPTIONS } from '@/src/utils/dropdownConstants';

const workspaceSchema = yup.object({
  workspaceName: yup.string().required('Workspace name is required').min(2, 'Workspace name must be at least 2 characters'),
  contactEmail: yup.string().email('Invalid email address').optional().default(''),
  contactPhone: yup.string()
    .test('valid-phone', 'Enter a valid phone number', (v) => !v || validatePhone(v).isValid)
    .optional()
    .default(''),
  countryCode: yup.string().optional().default(''),
  timeZone: yup.string().optional().default(''),
  language: yup.string().optional().default(''),
});

type WorkspaceFormValues = yup.InferType<typeof workspaceSchema>;

export const WorkspaceSettingsForm = () => {
  const { loadWorkspaceDetails, saveWorkspaceDetails, settings, loading, saving } = useWorkspace();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkspaceFormValues>({
    resolver: yupResolver(workspaceSchema),
    defaultValues: {
      workspaceName: '',
      contactEmail: '',
      contactPhone: '',
      countryCode: '',
      timeZone: '',
      language: '',
    },
  });

  useEffect(() => {
    loadWorkspaceDetails('current');
  }, [loadWorkspaceDetails]);

  useEffect(() => {
    if (settings) {
      reset({
        workspaceName: settings.workspaceName || settings.name || '',
        contactEmail: settings.contactEmail || '',
        contactPhone: settings.contactPhone || '',
        countryCode: settings.countryCode || '',
        timeZone: settings.timeZone || '',
        language: settings.language || '',
      });
    }
  }, [settings, reset]);

  const onSubmit = async (data: WorkspaceFormValues) => {
    try {
      await saveWorkspaceDetails('current', data).unwrap();
      if (data.countryCode) setDefaultPhoneCountry(data.countryCode);
      Alert.alert('Success', 'Workspace settings updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err || 'Failed to save settings');
    }
  };

  if (loading && !settings) {
    return (
      <View className="p-4 items-center justify-center min-h-[200px]">
        <Text className="text-muted-foreground">Loading workspace settings...</Text>
      </View>
    );
  }

  return (
    <View className="gap-5">
      <View className="mb-2">
        <Text className="text-lg font-bold text-foreground mb-1">General Information</Text>
        <Text className="text-sm text-muted-foreground">Update your community's primary details and branding.</Text>
      </View>

      <Controller
        control={control}
        name="workspaceName"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label="Workspace Name"
            placeholder="e.g. Green Valley Estates"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={errors.workspaceName?.message}
            leftIcon={Building2}
            required
          />
        )}
      />

      <Controller
        control={control}
        name="contactEmail"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label="Contact Email"
            placeholder="admin@community.com"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={errors.contactEmail?.message}
            leftIcon={Mail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        )}
      />

      <Controller
        control={control}
        name="contactPhone"
        render={({ field: { onChange, onBlur, value } }) => (
          <PhoneInput
            label="Contact Phone"
            onChangeText={onChange}
            value={value}
            error={errors.contactPhone?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="countryCode"
        render={({ field: { onChange, value } }) => (
          <DropdownSelect
            label="Country"
            placeholder="Select the community country"
            options={COUNTRY_OPTIONS}
            value={value || ''}
            onValueChange={onChange}
            error={errors.countryCode?.message}
          />
        )}
      />
      <Text className="text-xs text-muted-foreground -mt-3 ms-1">
        Phone numbers entered without a country code are treated as this country.
      </Text>

      <Controller
        control={control}
        name="timeZone"
        render={({ field: { onChange, value } }) => (
          <DropdownSelect
            label="Timezone"
            placeholder="Select a timezone"
            options={TIMEZONE_OPTIONS}
            value={value || ''}
            onValueChange={onChange}
            error={errors.timeZone?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="language"
        render={({ field: { onChange, value } }) => (
          <DropdownSelect
            label="Primary Language"
            placeholder="Select a language"
            options={LANGUAGE_OPTIONS}
            value={value || ''}
            onValueChange={onChange}
            error={errors.language?.message}
          />
        )}
      />

      <View className="mt-4">
        <Button
          onPress={handleSubmit(onSubmit)}
          loading={saving}
          disabled={loading || saving}
        >
          Save Changes
        </Button>
      </View>
    </View>
  );
};
