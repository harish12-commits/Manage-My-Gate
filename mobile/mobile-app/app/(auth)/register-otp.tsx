import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { KeyRoundIcon } from 'lucide-react-native';
import * as React from 'react';
import { View, ScrollView, Alert, ImageBackground, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAuth } from '../../src/features/auth/hooks/useAuth';
import { OtpInputField } from '@/components/auth/OtpInputField';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';
import { useTranslation } from '@/src/utils/i18n';

const otpSchema = yup.object().shape({
  code: yup
    .string()
    .required('Verification code is required')
    .matches(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

interface OtpFormValues {
  code: string;
}

export default function RegisterOtpScreen() {
  const { t } = useTranslation();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyRegistration, loading, error, successMsg, clearStatus } = useAuth();
  
  // Fix URL decoding issue where '+' might have been converted to a space
  const fixedEmail = email ? email.replace(/\s/g, '+') : '';

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpFormValues>({
    resolver: yupResolver(otpSchema),
    defaultValues: {
      code: '',
    },
  });

  React.useEffect(() => {
    return () => clearStatus();
  }, []);

  const onSubmit = async (data: OtpFormValues) => {
    if (!fixedEmail) return;
    const action = await verifyRegistration(fixedEmail, data.code);
    if (action && (action.type?.endsWith('/fulfilled') || (action.meta && action.meta.requestStatus === 'fulfilled'))) {
      const resUser = action.payload?.user || action.payload?.data?.user;
      const hasOrg = !!(
        resUser && (
          resUser.orgId ||
          resUser.activeOrgId ||
          resUser.organizationId ||
          (Array.isArray(resUser.availableWorkspaces) && resUser.availableWorkspaces.length > 0)
        )
      );
      if (hasOrg) {
        router.replace('/(resident)/dashboard');
      } else {
        router.replace('/(auth)/setup-organization');
      }
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('verify_email', 'Verify Email') }} />
      <ImageBackground
        source={require('../../assets/images/auth-bg.jpg')}
        style={{ flex: 1 }}
        blurRadius={Platform.OS === 'ios' ? 3 : 2}
        resizeMode="cover"
      >
        <View className="absolute inset-0 bg-white/40 dark:bg-[#0B0E14]/55" />
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          className="p-6"
        >
          <View className="gap-6 flex-1 justify-center max-w-sm mx-auto w-full py-8">
            {/* Header */}
            <View className="items-center mb-6">
              <View className="bg-primary/10 p-4 rounded-full mb-3">
                <KeyRoundIcon className="size-8 text-primary" />
              </View>
              <Text className="text-2xl font-extrabold text-[#1C1917] dark:text-white tracking-tight text-center">
                {t('enter_verification_code', 'Enter Verification Code')}
              </Text>
              <Text className="text-muted-foreground text-sm text-center mt-1.5 px-4">
                {t('sent_code_email', 'We sent a verification code to your email:')}{'\n'}
                <Text className="font-semibold text-[#1C1917] dark:text-white">{fixedEmail || t('your_email', 'your email')}</Text>
              </Text>
            </View>

            {/* Form Card */}
            <View
              style={{
                shadowColor: '#1C1917',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 16,
                elevation: 4,
              }}
              className="bg-white/75 dark:bg-[#1C1917]/75 backdrop-blur-xl border border-white/70 dark:border-white/15 rounded-3xl p-5 gap-4 shadow-xl shadow-black/5"
            >
              <View className="gap-2">
                <Text className="text-[#1C1917] dark:text-white font-semibold text-sm">{t('security_code', 'Security Code')}</Text>
                
                <Controller
                  control={control}
                  name="code"
                  render={({ field: { onChange, value } }) => (
                    <OtpInputField
                      length={6}
                      value={value}
                      onValueChange={onChange}
                      error={!!errors.code}
                      className="py-2"
                    />
                  )}
                />

                {errors.code && (
                  <Text className="text-destructive text-xs font-semibold mt-1">
                    {errors.code.message}
                  </Text>
                )}
              </View>

              {/* Error Banner */}
              {error && (
                <View className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                  <Text className="text-destructive text-xs text-center font-medium">{error}</Text>
                </View>
              )}

              <Button
                onPress={handleSubmit(onSubmit)}
                loading={loading}
                textClassName="font-bold text-base"
                className="mt-2 h-12"
              >
                {t('verify_and_continue', 'Verify & Continue')}
              </Button>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </ImageBackground>
    </>
  );
}
