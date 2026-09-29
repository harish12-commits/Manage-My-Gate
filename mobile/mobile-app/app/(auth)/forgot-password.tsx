import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { Stack, router } from 'expo-router';
import {
  KeyRound,
  Mail,
  Lock,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react-native';
import * as React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAuth } from '../../src/features/auth/hooks/useAuth';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';
import { NahomEmblem, NahomWordmark } from '@/components/auth/NahomBrandLogo';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { OtpInputField } from '@/components/auth/OtpInputField';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useTranslation } from '@/src/utils/i18n';

// Step 1: Identifier schema
const identifierEmailSchema = yup.object().shape({
  email: yup.string().email('Invalid email address').required('Email is required'),
});

const identifierPhoneSchema = yup.object().shape({
  phone: yup
    .string()
    .required('Phone number is required')
    .test('valid-phone', 'Please enter a valid phone number with country code', (value) => {
      if (!value) return false;
      return /^\+[1-9]\d{7,14}$/.test(value.trim());
    }),
});

// Step 2: OTP schema
const otpSchema = yup.object().shape({
  code: yup
    .string()
    .required('Verification code is required')
    .matches(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

// Step 3: Password schema - matches backend policy (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol)
const passwordSchema = yup.object().shape({
  newPassword: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=~`[\]{}|\\:";'<>?,./])/,
      'Must contain uppercase, lowercase, number & special character'
    ),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('newPassword')], 'Passwords must match')
    .required('Confirm password is required'),
});

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { forgotPassword, verifyResetOtp, resetPassword, loading, error, successMsg, clearStatus } = useAuth();

  const [step, setStep] = React.useState<0 | 1 | 2 | 3>(0);
  const [method, setMethod] = React.useState<'email' | 'phone'>('email');
  const [identifier, setIdentifier] = React.useState('');
  const [verifiedCode, setVerifiedCode] = React.useState('');
  const [resendCooldown, setResendCooldown] = React.useState(30);

  // Form hooks
  const emailForm = useForm<{ email: string }>({
    resolver: yupResolver(identifierEmailSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  const phoneForm = useForm<{ phone: string }>({
    resolver: yupResolver(identifierPhoneSchema),
    mode: 'onTouched',
    defaultValues: { phone: '' },
  });

  const otpForm = useForm<{ code: string }>({
    resolver: yupResolver(otpSchema),
    mode: 'onTouched',
    defaultValues: { code: '' },
  });

  const passwordForm = useForm<{ newPassword: string; confirmPassword: string }>({
    resolver: yupResolver(passwordSchema),
    mode: 'onTouched',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  React.useEffect(() => {
    clearStatus();
    return () => clearStatus();
  }, [step]);

  // Resend countdown timer
  React.useEffect(() => {
    if (step !== 1 || resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const isFulfilled = (act: any) => {
    return (
      act &&
      !act.error &&
      (act.type?.endsWith('/fulfilled') || act.meta?.requestStatus === 'fulfilled')
    );
  };

  // Handle Step 0: Request OTP
  const onSendOtp = async (data: { email?: string; phone?: string }) => {
    const id = method === 'email' ? data.email?.trim().toLowerCase() : data.phone?.replace(/\s+/g, '').trim();
    if (!id) return;
    setIdentifier(id);
    otpForm.reset({ code: '' });
    const action: any = await forgotPassword(id);
    if (isFulfilled(action)) {
      setResendCooldown(30);
      setStep(1);
    }
  };

  // Handle Resend OTP
  const handleResend = async () => {
    if (!identifier || resendCooldown > 0) return;
    const action: any = await forgotPassword(identifier);
    if (isFulfilled(action)) {
      setResendCooldown(30);
    }
  };

  // Handle Step 1: Verify OTP
  const onVerifyOtp = async (data: { code: string }) => {
    if (!identifier) return;
    const action: any = await verifyResetOtp(identifier, data.code);
    if (isFulfilled(action)) {
      setVerifiedCode(data.code);
      setStep(2);
    }
  };

  // Handle Step 2: Set New Password
  const onResetPassword = async (data: { newPassword: string; confirmPassword: string }) => {
    if (!identifier || !verifiedCode) return;
    const action: any = await resetPassword({
      identifier,
      code: verifiedCode,
      newPassword: data.newPassword,
    });
    if (isFulfilled(action)) {
      setStep(3);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('../../assets/images/auth-bg.jpg')}
        style={{ flex: 1 }}
        blurRadius={Platform.OS === 'ios' ? 3 : 2}
        resizeMode="cover"
      >
        <View className="absolute inset-0 bg-white/45 dark:bg-[#0B0E14]/60" />
        <KeyboardAwareScrollView
            extraScrollHeight={56}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            className="px-5 py-8"
          >
          <View className="max-w-sm mx-auto w-full gap-4">
            {/* Brand Emblem */}
            <View className="items-center justify-center mb-1">
              <NahomEmblem size={96} />
              <NahomWordmark />
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
              {/* Step Indicator & Header */}
              <View className="items-center gap-1">
                <View className="size-11 rounded-2xl bg-primary/10 items-center justify-center mb-1">
                  {step === 3 ? (
                    <CheckCircle2 size={24} color="#10b981" />
                  ) : step === 2 ? (
                    <Lock size={22} color="#FF5E00" />
                  ) : step === 1 ? (
                    <KeyRound size={22} color="#FF5E00" />
                  ) : (
                    <ShieldCheck size={22} color="#FF5E00" />
                  )}
                </View>

                <Text className="text-xl font-extrabold text-foreground text-center">
                  {step === 3
                    ? t('password_reset_success_title', 'Password Reset!')
                    : step === 2
                    ? t('create_new_password', 'Create New Password')
                    : step === 1
                    ? t('enter_security_code', 'Enter Security Code')
                    : t('reset_password', 'Reset Password')}
                </Text>

                <Text className="text-xs text-muted-foreground text-center px-2">
                  {step === 3
                    ? t('password_changed_login_desc', 'Your password has been changed successfully. You can now sign in.')
                    : step === 2
                    ? t('choose_strong_password_desc', 'Your identity has been verified. Choose a strong new password.')
                    : step === 1
                    ? `${t('we_sent_code_to', 'We sent a 6-digit verification code to:')}\n${identifier}`
                    : t('enter_account_recovery_desc', 'Enter your verified account email or phone number to receive a recovery code.')}
                </Text>
              </View>

              {error ? <ErrorBanner message={error} /> : null}

              {/* STEP 0: Request OTP */}
              {step === 0 && (
                <View className="gap-3.5">
                  {/* Method Selector */}
                  <View className="bg-white/40 dark:bg-black/30 backdrop-blur-md p-1.5 rounded-2xl flex-row border border-white/60 dark:border-white/15 shadow-2xs">
                    <TouchableOpacity
                      onPress={() => setMethod('email')}
                      activeOpacity={0.85}
                      style={
                        method === 'email'
                          ? {
                              backgroundColor: 'rgba(255, 255, 255, 0.88)',
                              borderColor: 'rgba(255, 255, 255, 0.7)',
                              borderWidth: 1,
                              shadowColor: '#000000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.08,
                              shadowRadius: 8,
                              elevation: 2,
                            }
                          : {
                              backgroundColor: 'transparent',
                            }
                      }
                      className="flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5"
                    >
                      <Mail size={14} color={method === 'email' ? '#EA580C' : '#57534E'} strokeWidth={method === 'email' ? 2.4 : 2} />
                      <Text
                        style={{ color: method === 'email' ? '#EA580C' : '#57534E' }}
                        className={`text-xs ${method === 'email' ? 'font-bold' : 'font-medium'}`}
                      >
                        {t('email', 'Email')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setMethod('phone')}
                      activeOpacity={0.85}
                      style={
                        method === 'phone'
                          ? {
                              backgroundColor: 'rgba(255, 255, 255, 0.88)',
                              borderColor: 'rgba(255, 255, 255, 0.7)',
                              borderWidth: 1,
                              shadowColor: '#000000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.08,
                              shadowRadius: 8,
                              elevation: 2,
                            }
                          : {
                              backgroundColor: 'transparent',
                            }
                      }
                      className="flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5"
                    >
                      <Smartphone size={14} color={method === 'phone' ? '#EA580C' : '#57534E'} strokeWidth={method === 'phone' ? 2.4 : 2} />
                      <Text
                        style={{ color: method === 'phone' ? '#EA580C' : '#57534E' }}
                        className={`text-xs ${method === 'phone' ? 'font-bold' : 'font-medium'}`}
                      >
                        {t('phone_number', 'Phone Number')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {method === 'email' ? (
                    <Controller
                      control={emailForm.control}
                      name="email"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          label={t('email_address', 'Email Address')}
                          placeholder="name@example.com"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          error={emailForm.formState.errors.email?.message}
                          leftIcon={<Mail size={16} color="#94A3B8" />}
                        />
                      )}
                    />
                  ) : (
                    <Controller
                      control={phoneForm.control}
                      name="phone"
                      render={({ field: { onChange, value } }) => (
                        <PhoneInput
                          variant="glass"
                          label={t('phone_number', 'Phone Number')}
                          placeholder="98765 43210"
                          value={value}
                          onChangeText={onChange}
                          error={phoneForm.formState.errors.phone?.message}
                        />
                      )}
                    />
                  )}

                  <Button
                    onPress={
                      method === 'email'
                        ? emailForm.handleSubmit(onSendOtp)
                        : phoneForm.handleSubmit(onSendOtp)
                    }
                    loading={loading}
                    textClassName="font-bold text-sm"
                    className="mt-2 h-12 bg-primary rounded-xl w-full items-center justify-center"
                  >
                    {t('send_recovery_code', 'Send Recovery Code')}
                  </Button>
                </View>
              )}

              {/* STEP 1: Enter OTP */}
              {step === 1 && (
                <View className="gap-3.5">
                  <Controller
                    control={otpForm.control}
                    name="code"
                    render={({ field: { onChange, value } }) => (
                      <OtpInputField
                        length={6}
                        value={value}
                        onValueChange={onChange}
                        error={!!otpForm.formState.errors.code}
                        className="py-2"
                      />
                    )}
                  />
                  {otpForm.formState.errors.code && (
                    <Text className="text-destructive text-xs font-semibold text-center">
                      {otpForm.formState.errors.code.message}
                    </Text>
                  )}

                  <View className="flex-row items-center justify-between px-1">
                    <TouchableOpacity
                      onPress={() => setStep(0)}
                      activeOpacity={0.7}
                      className="flex-row items-center gap-1"
                    >
                      <ArrowLeft size={13} color="#94A3B8" />
                      <Text className="text-xs text-muted-foreground font-medium">
                        {t('change_id', 'Change ID')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleResend}
                      disabled={resendCooldown > 0 || loading}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          resendCooldown > 0
                            ? 'text-muted-foreground'
                            : 'text-primary'
                        }`}
                      >
                        {resendCooldown > 0 ? `${t('resend_in', 'Resend in')} ${resendCooldown}s` : t('resend_code', 'Resend Code')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Button
                    onPress={otpForm.handleSubmit(onVerifyOtp)}
                    loading={loading}
                    textClassName="font-bold text-sm"
                    className="mt-2 h-12 bg-primary rounded-xl w-full items-center justify-center"
                  >
                    {t('verify_security_code', 'Verify Security Code')}
                  </Button>
                </View>
              )}

              {/* STEP 2: Enter New Password */}
              {step === 2 && (
                <View className="gap-3.5">
                  <Controller
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <PasswordInput
                        label={t('new_password', 'New Password')}
                        required
                        placeholder={t('password_requirements_placeholder', 'Min 8 chars, 1 uppercase, 1 symbol')}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        autoCapitalize="none"
                        showRequirements
                        error={passwordForm.formState.errors.newPassword?.message}
                        leftIcon={<Lock size={16} color="#94A3B8" />}
                      />
                    )}
                  />

                  <Controller
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <PasswordInput
                        label={t('confirm_password', 'Confirm Password')}
                        required
                        placeholder={t('re_enter_new_password', 'Re-enter new password')}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        autoCapitalize="none"
                        confirmValue={passwordForm.watch('newPassword')}
                        error={passwordForm.formState.errors.confirmPassword?.message}
                        leftIcon={<Lock size={16} color="#94A3B8" />}
                      />
                    )}
                  />

                  <Button
                    onPress={passwordForm.handleSubmit(onResetPassword)}
                    loading={loading}
                    textClassName="font-bold text-sm"
                    className="mt-2 h-12 bg-primary rounded-xl w-full items-center justify-center"
                  >
                    {t('update_password', 'Update Password')}
                  </Button>
                </View>
              )}

              {/* STEP 3: Finished */}
              {step === 3 && (
                <View className="gap-3.5">
                  <Button
                    onPress={() => router.replace('/(auth)/login')}
                    textClassName="font-bold text-sm"
                    className="h-12 bg-primary rounded-xl w-full items-center justify-center"
                  >
                    {t('back_to_sign_in', 'Back to Sign In')}
                  </Button>
                </View>
              )}

              {/* Back to Sign In Link (for steps 0, 1, 2) */}
              {step !== 3 && (
                <View className="flex-row items-center justify-center pt-2">
                  <TouchableOpacity
                    onPress={() => router.replace('/(auth)/login')}
                    activeOpacity={0.8}
                  >
                    <Text className="text-xs font-bold text-[#EA580C]">
                      {t('back_to_sign_in', 'Back to Sign In')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          </KeyboardAwareScrollView>
      </ImageBackground>
    </>
  );
}
