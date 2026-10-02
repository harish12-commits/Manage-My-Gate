import React from 'react';
import { View } from 'react-native';
import { Controller } from 'react-hook-form';
import { Building2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import { Button } from '@/components/common/Button';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useTranslation } from '../../../utils/i18n';
import { useCreateOrganization, UseCreateOrganizationOptions } from '../hooks/useCreateOrganization';
import { AppLoader } from '@/components/ui/AppLoader';

export interface CreateOrganizationFormProps {
  options?: UseCreateOrganizationOptions;
  onCancel?: () => void;
  showCancelButton?: boolean;
}

export const CreateOrganizationForm: React.FC<CreateOrganizationFormProps> = ({
  options,
  onCancel,
  showCancelButton = false,
}) => {
  const { t } = useTranslation();
  const {
    form,
    availability,
    availabilityMessage,
    createLoading,
    createError,
    isSubmitDisabled,
    onSubmit,
  } = useCreateOrganization(options);

  const {
    control,
    formState: { errors },
  } = form;

  // Resolve TextInput validation status
  const nameStatus = React.useMemo(() => {
    if (availability === 'checking') return 'validating';
    if (availability === 'available') return 'valid';
    if (availability === 'taken' || availability === 'error') return 'invalid';
    return 'idle';
  }, [availability]);

  return (
    <View className="bg-card border border-border rounded-2xl p-4 sm:p-6 gap-4 shadow-xs">
      {/* 1. Community Name Field */}
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <View className="gap-1.5">
            <TextInput
              label={t('community_name', 'Community Name')}
              placeholder={t('community_name_placeholder', 'e.g. Nahom Heights Community')}
              required
              leftIcon={<Building2 size={18} className="text-muted-foreground me-1" />}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="words"
              status={nameStatus}
              error={
                errors.name?.message
                  ? t(errors.name.message, 'Invalid community name')
                  : undefined
              }
              accessibilityLabel={t('community_name', 'Community Name')}
              accessibilityHint={t('community_name_hint', 'Enter between 3 and 100 characters')}
            />

            {/* Live Name Availability Status Indicator */}
            {availability !== 'idle' && (
              <View className="mt-1 ms-1 flex-row items-center flex-wrap gap-1.5">
                {availability === 'checking' && (
                  <View className="flex-row items-center gap-2">
                    <AppLoader variant="inline" />
                    <Text className="text-xs text-muted-foreground font-medium">
                      {availabilityMessage || t('checking_availability', 'Checking availability...')}
                    </Text>
                  </View>
                )}

                {availability === 'available' && (
                  <View className="flex-row items-center gap-1.5">
                    <CheckCircle2 size={15} color="#10b981" />
                    <Text className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      {availabilityMessage || t('name_available', 'Name is available')}
                    </Text>
                  </View>
                )}

                {availability === 'taken' && (
                  <View className="flex-row items-center gap-1.5">
                    <XCircle size={15} color="#ef4444" />
                    <Text className="text-xs text-destructive font-semibold">
                      {availabilityMessage || t('name_unavailable', 'Community name is already taken')}
                    </Text>
                  </View>
                )}

                {availability === 'error' && (
                  <View className="flex-row items-center gap-1.5">
                    <AlertCircle size={15} color="#ef4444" />
                    <Text className="text-xs text-destructive font-semibold flex-1">
                      {availabilityMessage}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      />

      {/* 3. Server Submission Error Banner */}
      {Boolean(createError) && (
        <ErrorBanner
          title={t('error', 'Error')}
          message={createError || t('server_error', 'Failed to create community')}
        />
      )}

      {/* 4. Action Buttons */}
      <View className="gap-2.5 mt-2">
        <Button
          variant="primary"
          onPress={onSubmit}
          loading={createLoading}
          disabled={isSubmitDisabled}
          className="h-12 w-full items-center justify-center rounded-xl"
          accessibilityRole="button"
          accessibilityLabel={t('create_community', 'Create Community')}
        >
          <Text className="font-bold text-base text-primary-foreground">
            {createLoading
              ? t('creating', 'Creating...')
              : t('create_community', 'Create Community')}
          </Text>
        </Button>

        {showCancelButton && onCancel && (
          <Button
            variant="secondary"
            onPress={onCancel}
            disabled={createLoading}
            className="h-11 w-full items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel={t('cancel', 'Cancel')}
          >
            <Text className="font-semibold text-sm text-foreground">
              {t('cancel', 'Cancel')}
            </Text>
          </Button>
        )}
      </View>
    </View>
  );
};

export default CreateOrganizationForm;
