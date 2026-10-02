import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { Stack, router, useSegments, useLocalSearchParams } from 'expo-router';
import { ShieldCheck, Mail, Lock, Phone, User } from 'lucide-react-native';
import * as React from 'react';
import { View, ScrollView, Platform, Pressable } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { KeyboardAvoidingShell } from '@/components/layout/KeyboardAvoidingShell';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAuth } from '../../src/features/auth/hooks/useAuth';
import { GoogleSignInButton } from '../../src/features/auth/components/GoogleSignInButton';
import { AppleSignInButton } from '../../src/features/auth/components/AppleSignInButton';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { sessionStore } from '@/src/utils/storage';

// Registration Validation Schema
const registerSchema = yup.object().shape({
  name: yup.string().required('Full Name is required'),
  email: yup.string().required('Email is required').email('Invalid email address'),
  phone: yup
    .string()
    .required('Phone number is required')
    .test('valid-phone', 'Invalid phone number format', function (value) {
      if (!value) return false;
      if (value.startsWith('+91')) {
        const nationalNumber = value.slice(3);
        if (nationalNumber.length !== 10) {
          return this.createError({ message: 'India mobile number must be exactly 10 digits' });
        }
        if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
          return this.createError({ message: 'India mobile number must start with 6, 7, 8, or 9' });
        }
        return true;
      }
      return /^\+[1-9]\d{10,14}$/.test(value);
    }),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters long')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: yup
    .string()
    .required('Please repeat your password')
    .oneOf([yup.ref('password')], 'Passwords do not match'),
});

type RegisterFormValues = yup.InferType<typeof registerSchema>;

export default function RegisterScreen() {
  const { register: performRegister, loading, error, successMsg, clearStatus, logout, isAuthenticated } = useAuth();
  const params = useLocalSearchParams<{ email?: string; name?: string; isGoogleSso?: string }>();
  
  const segments = useSegments();
  const isFocused = segments[segments.length - 1] === 'register';

  const form = useForm<RegisterFormValues>({
    resolver: yupResolver(registerSchema),
    defaultValues: {
      name: params.name || '',
      email: params.email || '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  React.useEffect(() => {
    if (params.name) {
      form.setValue('name', params.name);
    }
    if (params.email) {
      form.setValue('email', params.email);
    }
  }, [params.name, params.email]);

  React.useEffect(() => {
    clearStatus();
    return () => {
      clearStatus();
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  // Reactively route to OTP verification screen if registration succeeds (successMsg implies OTP was sent)
  React.useEffect(() => {
    if (isFocused && successMsg && successMsg.toLowerCase().includes('otp')) {
      const email = form.getValues('email');
      router.push({
        pathname: '/(auth)/register-otp',
        params: { email },
      });
    }
  }, [successMsg, isFocused]);

    const handleOpenPrivacyPolicy = async () => {
      try {
        await WebBrowser.openBrowserAsync('https://managemygate.e3esg.com/privacy-policy');
      } catch (e) {
        console.warn('Could not open privacy policy in browser:', e);
      }
    };

    const handleOpenTerms = async () => {
      try {
        await WebBrowser.openBrowserAsync('https://managemygate.e3esg.com/terms');
      } catch (e) {
        console.warn('Could not open terms in browser:', e);
      }
    };

    const onSubmit = async (data: RegisterFormValues) => {
      const emailPrefix = data.email
        .trim()
        .split('@')[0]
        .replace(/[^a-zA-Z0-9]/g, '');
      
      let derivedUsername = emailPrefix;
      if (derivedUsername.length < 3) {
        derivedUsername = 'user' + Math.floor(100 + Math.random() * 900);
      } else if (derivedUsername.length > 30) {
        derivedUsername = derivedUsername.substring(0, 30);
      }

      await performRegister({
        name: data.name.trim(),
        username: derivedUsername,
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim().startsWith('+') ? data.phone.trim() : `+${data.phone.trim()}`,
        password: data.password,
        privacyPolicyAccepted: true,
      });
    };

  return (
    <>
      <Stack.Screen options={{ title: 'Create Account', headerBackVisible: true }} />
      <KeyboardAvoidingShell
        className="bg-background"
        scrollViewProps={{
          contentContainerStyle: { paddingHorizontal: 16, paddingVertical: 24, flexGrow: 1, paddingBottom: 80 },
          automaticallyAdjustKeyboardInsets: Platform.OS === 'ios',
        }}
      >
        <View className="gap-5 flex-1 max-w-sm sm:max-w-md mx-auto w-full py-2 sm:py-4 mt-6">
            {/* Brand Header */}
            <View className="items-center mb-1">
              <View className="bg-primary/10 p-3.5 rounded-2xl mb-2.5 items-center justify-center">
                <ShieldCheck className="size-9 text-primary" size={34} />
              </View>
              <Text className="text-2xl font-extrabold text-foreground tracking-tight text-center">
                Register
              </Text>
              <Text className="text-muted-foreground text-sm text-center mt-1 px-2">
                Create your enterprise account to manage your workspace
              </Text>
            </View>

            {/* Form Container */}
            <View className="bg-card border border-border rounded-2xl p-4 sm:p-6 gap-4 shadow-xs">
              <View className="gap-3.5">
                <Controller
                  control={form.control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Full Name"
                      placeholder="John Doe"
                      leftIcon={<User size={18} className="text-muted-foreground me-1" />}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      autoCapitalize="words"
                      error={form.formState.errors.name?.message}
                    />
                  )}
                />

                <Controller
                  control={form.control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Email"
                      placeholder="admin@example.com"
                      leftIcon={<Mail size={18} className="text-muted-foreground me-1" />}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      error={form.formState.errors.email?.message}
                    />
                  )}
                />

                <Controller
                  control={form.control}
                  name="phone"
                  render={({ field: { onChange, value } }) => (
                    <PhoneInput
                      variant="glass"
                      label="Mobile Number"
                      placeholder="99887 76655"
                      onChangeText={onChange}
                      value={value}
                      error={form.formState.errors.phone?.message}
                    />
                  )}
                />

                <Controller
                  control={form.control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View>
                      <Input
                        label="Password"
                        placeholder="••••••••"
                        isPassword
                        leftIcon={<Lock size={18} className="text-muted-foreground me-1" />}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        autoCapitalize="none"
                        autoComplete="new-password"
                        error={form.formState.errors.password?.message}
                      />
                      <PasswordStrengthIndicator password={value} />
                    </View>
                  )}
                />

                <Controller
                  control={form.control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Repeat Password"
                      placeholder="••••••••"
                      isPassword
                      leftIcon={<Lock size={18} className="text-muted-foreground me-1" />}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      error={form.formState.errors.confirmPassword?.message}
                    />
                  )}
                />

                {/* Global Error Banner */}
                {error ? (
                  <View className="gap-2 mt-1">
                    <ErrorBanner message={error} />
                    {error.toLowerCase().includes('already exists') ? (
                      <Button
                        variant="link"
                        onPress={async () => {
                          if (isAuthenticated) {
                            try {
                              await logout();
                            } catch (e) {}
                          }
                          sessionStore.setItem('mobile_auth_intent', 'create-org');
                          router.push({ pathname: '/(auth)/login', params: { intent: 'create-org' } });
                        }}
                      >
                        <Text className="text-primary font-bold text-xs text-center underline">
                          Already have an account? Sign in to create another organization under your account
                        </Text>
                      </Button>
                    ) : null}
                  </View>
                ) : null}

                {/* Legal Consent Notice */}
                <View className="flex-row flex-wrap items-center justify-center px-1 pt-1">
                  <Text className="text-xs text-muted-foreground text-center">
                    By registering, you agree to our{' '}
                  </Text>
                  <Pressable onPress={handleOpenTerms} hitSlop={6}>
                    <Text className="text-xs text-primary font-bold underline">
                      Terms &amp; Conditions
                    </Text>
                  </Pressable>
                  <Text className="text-xs text-muted-foreground text-center">
                    {' '}and{' '}
                  </Text>
                  <Pressable onPress={handleOpenPrivacyPolicy} hitSlop={6}>
                    <Text className="text-xs text-primary font-bold underline">
                      Privacy Policy
                    </Text>
                  </Pressable>
                </View>

                <Button
                  onPress={form.handleSubmit(onSubmit)}
                  loading={loading}
                  textClassName="font-bold text-base"
                  className="mt-2 h-12 bg-primary rounded-xl w-full items-center justify-center"
                >
                  Create Account
                </Button>
              </View>

              {/* SSO Separator */}
              <View className="flex-row items-center my-2">
                <View className="flex-1 h-px bg-border" />
                <Text className="px-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">OR CONTINUE WITH</Text>
                <View className="flex-1 h-px bg-border" />
              </View>

              {/* SSO Buttons */}
              <View className="flex-col gap-2.5 sm:flex-row sm:gap-3">
                <View className="flex-1">
                  <GoogleSignInButton />
                </View>
                {Platform.OS === 'ios' ? (
                  <View className="flex-1">
                    <AppleSignInButton />
                  </View>
                ) : null}
              </View>

              {/* Login Link */}
              <View className="items-center mt-2">
                <Button
                  variant="link"
                  onPress={async () => {
                    if (isAuthenticated) {
                      try {
                        await logout();
                      } catch (e) {}
                    }
                    sessionStore.setItem('mobile_auth_intent', 'create-org');
                    router.push({ pathname: '/(auth)/login', params: { intent: 'create-org' } });
                  }}
                >
                  <Text className="text-primary font-medium text-sm">
                    Already have an account? Sign In
                  </Text>
                </Button>
              </View>
            </View>
          </View>
      </KeyboardAvoidingShell>
    </>
  );
}
