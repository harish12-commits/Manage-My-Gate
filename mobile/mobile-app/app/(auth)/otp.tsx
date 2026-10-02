import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { KeyRoundIcon } from 'lucide-react-native';
import * as React from 'react';
import { View, ScrollView, ActivityIndicator, TextInput, ImageBackground, Platform, Keyboard, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAuth } from '../../src/features/auth/hooks/useAuth';
import { useTranslation } from '@/src/utils/i18n';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';

const otpSchema = yup.object().shape({
  code: yup
    .string()
    .required('Verification code is required')
    .matches(/^\d{4,8}$/, 'Code must be between 4 and 8 digits'),
});

interface OtpFormValues {
  code: string;
}

export default function OtpScreen() {
  const { t } = useTranslation();
  const { phone, email } = useLocalSearchParams<{ phone?: string; email?: string }>();
  const { verifyOtp, requestOtp, loading, error, successMsg, isAuthenticated, clearStatus } = useAuth();
  const [resendCooldown, setResendCooldown] = React.useState(30);

  // Fix URL decoding issue where '+' might have been converted to a space
  const fixedPhone = phone ? phone.replace(/\s/g, '+') : undefined;
  const fixedEmail = email ? email.replace(/\s/g, '+') : undefined;

  const identifier = fixedEmail || fixedPhone || '';
  const isEmail = !!fixedEmail;

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

  React.useEffect(() => {
    if (successMsg) {
      Alert.alert(t('verification', 'Verification'), successMsg);
    }
  }, [successMsg]);

  // Cooldown countdown timer for resending OTP
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const onSubmit = async (data: OtpFormValues) => {
    if (!identifier) return;
    await verifyOtp(identifier, data.code, isEmail);
  };

  const handleResend = async () => {
    if (!identifier || resendCooldown > 0) return;
    await requestOtp(identifier, isEmail);
    setResendCooldown(30);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('verify_identity', 'Verify Identity') }} />
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
          <View className="gap-6 flex-1 mt-12 max-w-sm mx-auto w-full">
            {/* Header */}
            <View className="items-center mb-6">
              <View className="bg-primary/10 p-4 rounded-full mb-3">
                <KeyRoundIcon className="size-8 text-primary" />
              </View>
              <Text className="text-2xl font-extrabold text-foreground tracking-tight">
                {t('enter_verification_code', 'Enter Verification Code')}
              </Text>
              <Text className="text-muted-foreground text-sm text-center mt-1.5 px-4">
                {isEmail ? t('sent_code_email', 'We sent a verification code to your email:') : t('sent_code_phone', 'We sent a verification code to your phone number:')}{'\n'}
                <Text className="font-semibold text-foreground">{identifier}</Text>
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
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      placeholder="123456"
                      placeholderTextColor="#78716C"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      keyboardType="number-pad"
                      maxLength={8}
                      className="bg-white/75 dark:bg-[#292524]/75 text-[#1C1917] dark:text-white border border-white/80 dark:border-white/20 rounded-xl px-4 py-3.5 text-center text-lg font-bold tracking-[6px] shadow-2xs"
                    />
                  )}
                />

                {errors.code && (
                  <Text className="text-destructive text-xs font-semibold mt-1">
                    {errors.code.message}
                  </Text>
                )}
              </View>

              {error && (
                <View className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                  <Text className="text-destructive text-xs text-center font-medium">{error}</Text>
                </View>
              )}

              <Button onPress={handleSubmit(onSubmit)} disabled={loading} className="mt-2 h-12">
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-bold text-primary-foreground">{t('verify_and_sign_in', 'Verify & Sign In')}</Text>
                )}
              </Button>

              {/* Resend Helper */}
              <View className="items-center mt-2">
                {resendCooldown > 0 ? (
                  <Text className="text-muted-foreground text-xs font-medium">
                    {`${t('resend_code_in', 'Resend code in')} ${resendCooldown}s`}
                  </Text>
                ) : (
                  <Button onPress={handleResend} variant="ghost" className="h-8">
                    <Text className="text-primary text-xs font-semibold">{t('resend_verification_code', 'Resend verification code')}</Text>
                  </Button>
                )}
              </View>
            </View>
          </View>
        </KeyboardAwareScrollView>
    </ImageBackground>
  </>
);
}
