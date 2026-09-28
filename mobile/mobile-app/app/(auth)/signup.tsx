import { Text } from '@/components/ui/text';
import { Stack, router } from 'expo-router';
import {
  User,
  Mail,
  Lock,
  ArrowRight,
  Home,
  UserPlus,
  LogIn,
  Smartphone,
} from 'lucide-react-native';
import * as React from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput as RNTextInput,
  Platform,
  KeyboardAvoidingView,
  Image,
  ImageBackground,
  Animated,
  Easing,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAuth } from '../../src/features/auth/hooks/useAuth';
import { useGoogleAuthSession } from '../../src/features/auth/hooks/useGoogleAuthSession';
import { AppleSignInButton } from '../../src/features/auth/components/AppleSignInButton';
import {
  NahomEmblem,
  NahomWordmark,
} from '@/components/auth/NahomBrandLogo';
import { SocialAuthButton } from '@/components/auth/SocialAuthButton';
import { TextInput } from '@/components/forms/TextInput';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { parseBackendError } from '@/src/utils/validation';
import { useTranslation } from '@/src/utils/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

// Sign-Up Schema
const signupSchema = yup.object().shape({
  name: yup.string().required('Full name is required').min(2, 'Must be at least 2 characters'),
  email: yup.string().email('Invalid email address').required('Email is required'),
  phone: yup
    .string()
    .required('Phone number is required')
    .test('valid-phone', 'Invalid phone number format', function (value) {
      if (!value) return false;
      if (value.startsWith('+91')) {
        const n = value.slice(3);
        if (n.length !== 10) return this.createError({ message: 'India mobile number must be exactly 10 digits' });
        if (!/^[6-9]\d{9}$/.test(n)) return this.createError({ message: 'India mobile number must start with 6, 7, 8, or 9' });
        return true;
      }
      if (value.startsWith('+966')) { const n = value.slice(4); if (n.length !== 9) return this.createError({ message: 'Saudi mobile number must be exactly 9 digits' }); return true; }
      if (value.startsWith('+971')) { const n = value.slice(4); if (n.length !== 9) return this.createError({ message: 'UAE mobile number must be exactly 9 digits' }); return true; }
      return /^\+[1-9]\d{7,14}$/.test(value);
    }),
  unitNumber: yup.string().optional(),
  password: yup.string().required('Password is required').min(6, 'Password must be at least 6 characters'),
  confirmPassword: yup.string().oneOf([yup.ref('password')], 'Passwords must match').required('Confirm password is required'),
});

// Sign-In Schema (for existing user tab)
const signInSchema = yup.object().shape({
  login: yup.string().required('Email or Username is required'),
  password: yup.string().required('Password is required'),
});

// Phone OTP Schema (for existing user tab)
const phoneSignInSchema = yup.object().shape({
  phone: yup
    .string()
    .required('Phone number is required')
    .test('valid-phone', 'Please enter a valid phone number with country code', (value) => {
      if (!value) return false;
      return /^\+[1-9]\d{7,14}$/.test(value.trim());
    }),
});

interface SignupFormValues { name: string; email: string; phone: string; unitNumber?: string; password: string; confirmPassword: string; }
interface SignInFormValues { login: string; password: string; }
interface PhoneSignInFormValues { phone: string; }

function CTAButton({
  onPress,
  loading,
  label,
  loadingLabel,
  disabled,
}: {
  onPress: () => void;
  loading: boolean;
  label: string;
  loadingLabel?: string;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.88}
      style={{
        marginTop: 4,
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#EA580C',
        shadowOpacity: 0.28,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <View className="absolute inset-0">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="ctaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#1E232E" />
              <Stop offset="42%" stopColor="#2A3342" />
              <Stop offset="80%" stopColor="#EA580C" />
              <Stop offset="100%" stopColor="#FF7A00" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx="12" fill="url(#ctaGrad)" />
        </Svg>
      </View>
      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 10 }}>
          <ActivityIndicator color="#FFFFFF" size="small" />
          {loadingLabel ? <Text style={{ fontWeight: '700', color: '#FFFFFF', fontSize: 14 }}>{loadingLabel}</Text> : null}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 10 }}>
          <Text style={{ fontWeight: '700', color: '#FFFFFF', fontSize: 16 }}>{label}</Text>
          <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.5} />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { register: performRegister, login: performLogin, requestOtp, otpSent, loading, error, clearStatus, isAuthenticated } = useAuth();
  const { handleGoogleSignIn, loading: googleLoading } = useGoogleAuthSession();

  const [userType, setUserType] = React.useState<'new' | 'existing'>('new');
  const [existingAuthMode, setExistingAuthMode] = React.useState<'basic' | 'phone'>('basic');
  const [localLoading, setLocalLoading] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [signInLoading, setSignInLoading] = React.useState(false);
  const [signInError, setSignInError] = React.useState<string | null>(null);
  const [submittedPhone, setSubmittedPhone] = React.useState<string | null>(null);
  const [isSubmittingPhone, setIsSubmittingPhone] = React.useState(false);

  const emailInputRef = React.useRef<RNTextInput>(null);
  const unitInputRef = React.useRef<RNTextInput>(null);
  const passwordInputRef = React.useRef<RNTextInput>(null);
  const confirmPasswordInputRef = React.useRef<RNTextInput>(null);
  const signInPasswordRef = React.useRef<RNTextInput>(null);

  const emblemScale = React.useRef(new Animated.Value(0)).current;
  const emblemOpacity = React.useRef(new Animated.Value(0)).current;
  const emblemFloat = React.useRef(new Animated.Value(0)).current;
  const contentOpacity = React.useRef(new Animated.Value(1)).current;
  const contentTranslateY = React.useRef(new Animated.Value(0)).current;

  const { control, handleSubmit, watch, setError, formState: { errors } } = useForm<SignupFormValues>({
    resolver: yupResolver(signupSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', phone: '', unitNumber: '', password: '', confirmPassword: '' },
  });

  const signInForm = useForm<SignInFormValues>({
    resolver: yupResolver(signInSchema),
    mode: 'onTouched',
    defaultValues: { login: '', password: '' },
  });

  const phoneForm = useForm<PhoneSignInFormValues>({
    resolver: yupResolver(phoneSignInSchema),
    mode: 'onTouched',
    defaultValues: { phone: '' },
  });

  React.useEffect(() => {
    clearStatus();
    Animated.parallel([
      Animated.spring(emblemScale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
      Animated.timing(emblemOpacity, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(emblemFloat, { toValue: -5, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(emblemFloat, { toValue: 5, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();
    });
    return () => clearStatus();
  }, []);

  const handleTabSwitch = (tab: 'new' | 'existing') => {
    setUserType(tab);
    setLocalError(null);
    setSignInError(null);
    clearStatus();
  };

  const hasNavigatedRef = React.useRef(false);
  React.useEffect(() => {
    if (isAuthenticated && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      router.replace('/(resident)/dashboard');
    } else if (!isAuthenticated) {
      hasNavigatedRef.current = false;
    }
  }, [isAuthenticated]);

  // Reactively route to OTP screen if Phone OTP sent
  React.useEffect(() => {
    if (otpSent && submittedPhone) {
      router.push({
        pathname: '/(auth)/otp',
        params: { phone: submittedPhone },
      });
    }
  }, [otpSent, submittedPhone]);

  const onSubmit = async (data: SignupFormValues) => {
    try {
      setLocalLoading(true);
      setLocalError(null);
      const emailPrefix = data.email.trim().split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      let derivedUsername = emailPrefix;
      if (derivedUsername.length < 3) derivedUsername = 'user' + Math.floor(100 + Math.random() * 900);
      else if (derivedUsername.length > 30) derivedUsername = derivedUsername.substring(0, 30);
      const formattedPhone = data.phone.trim().startsWith('+') ? data.phone.trim() : `+${data.phone.trim()}`;
      const action = await performRegister({ name: data.name.trim(), username: derivedUsername, email: data.email.trim().toLowerCase(), phone: formattedPhone, password: data.password, unitNumber: data.unitNumber?.trim() || undefined });
      if (action && (action.type?.endsWith('/fulfilled') || action.meta?.requestStatus === 'fulfilled')) {
        router.push({ pathname: '/(auth)/register-otp', params: { email: data.email.trim().toLowerCase() } });
      }
    } catch (err: any) {
      const parsed = parseBackendError(err, 'Registration failed. Please try again.');
      if (parsed.field === 'email') setError('email', { message: parsed.userMessage });
      else if (parsed.field === 'phone') setError('phone', { message: parsed.userMessage });
      else setLocalError(parsed.userMessage);
    } finally {
      setLocalLoading(false);
    }
  };

  const onSignInSubmit = async (data: SignInFormValues) => {
    try {
      setSignInLoading(true);
      setSignInError(null);
      await performLogin({ login: data.login.trim(), password: data.password });
    } catch (err: any) {
      const parsed = parseBackendError(err, 'Sign in failed. Please try again.');
      setSignInError(parsed.userMessage);
    } finally {
      setSignInLoading(false);
    }
  };

  const onPhoneSignInSubmit = async (data: PhoneSignInFormValues) => {
    try {
      setIsSubmittingPhone(true);
      setSignInError(null);
      setSubmittedPhone(data.phone.trim());
      await requestOtp(data.phone.trim(), false);
    } catch (err: any) {
      const parsed = parseBackendError(err, 'Failed to send verification code. Please try again.');
      setSignInError(parsed.userMessage);
    } finally {
      setIsSubmittingPhone(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground source={require('../../assets/images/auth-bg.jpg')} style={{ flex: 1 }} blurRadius={Platform.OS === 'ios' ? 3 : 2} resizeMode="cover">
        <View className="absolute inset-0 bg-white/40 dark:bg-[#0B0E14]/55" />
        <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'height' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: Math.max(insets.top, 24) + 16,
              paddingBottom: Math.max(insets.bottom, 20) + 100,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            className="px-5"
          >
            <View className="max-w-sm mx-auto w-full gap-3.5">

              {/* Brand Header */}
              <Animated.View style={{ opacity: emblemOpacity, transform: [{ scale: emblemScale }, { translateY: emblemFloat }], alignItems: 'center', justifyContent: 'center' }}>
                <NahomEmblem size={106} />
                <View style={{ marginTop: -2, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <NahomWordmark />
                </View>
              </Animated.View>

              {/* Animated Content */}
              <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }} className="gap-3.5 w-full">

                {/* Form Card */}
                <View
                  style={{
                    shadowColor: '#1C1917',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.08,
                    shadowRadius: 16,
                    elevation: 4,
                  }}
                  className="bg-white/75 dark:bg-[#1C1917]/75 backdrop-blur-xl border border-white/70 dark:border-white/15 rounded-3xl p-5 gap-3.5 shadow-xl shadow-black/5"
                >

                  {/* Tab Switcher (New User vs Existing User) */}
                  <View className="bg-white/40 dark:bg-black/30 backdrop-blur-md p-1.5 rounded-2xl flex-row border border-white/60 dark:border-white/15 shadow-2xs">
                    <TouchableOpacity
                      onPress={() => handleTabSwitch('new')}
                      activeOpacity={0.85}
                      accessibilityRole="tab"
                      accessibilityLabel="New User Sign Up"
                      accessibilityState={{ selected: userType === 'new' }}
                      style={
                        userType === 'new'
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
                      className="flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-1.5"
                    >
                      <UserPlus
                        size={14}
                        color={userType === 'new' ? '#EA580C' : '#57534E'}
                        strokeWidth={userType === 'new' ? 2.4 : 2}
                      />
                      <Text
                        style={{ color: userType === 'new' ? '#EA580C' : '#57534E' }}
                        className={`text-xs ${userType === 'new' ? 'font-bold' : 'font-medium'}`}
                      >
                        {t('new_user', 'New User')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleTabSwitch('existing')}
                      activeOpacity={0.85}
                      accessibilityRole="tab"
                      accessibilityLabel={t('existing_user', 'Existing User')}
                      accessibilityState={{ selected: userType === 'existing' }}
                      style={
                        userType === 'existing'
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
                      className="flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-1.5"
                    >
                      <LogIn
                        size={14}
                        color={userType === 'existing' ? '#EA580C' : '#57534E'}
                        strokeWidth={userType === 'existing' ? 2.4 : 2}
                      />
                      <Text
                        style={{ color: userType === 'existing' ? '#EA580C' : '#57534E' }}
                        className={`text-xs ${userType === 'existing' ? 'font-bold' : 'font-medium'}`}
                      >
                        {t('existing_user', 'Existing User')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Tab Content */}
                  {userType === 'new' ? (
                    /* NEW USER: Sign-Up Form */
                    <View className="gap-3.5">
                      <Text className="text-base font-bold text-[#1C1917] dark:text-white text-center font-sans">
                        {t('create_resident_account', 'Create Resident Account')}
                      </Text>
                      <Controller
                        control={control}
                        name="name"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextInput
                            label={t('full_name', 'Full Name')}
                            labelClassName="text-sm font-bold text-[#1C1917] dark:text-white"
                            required
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            placeholder="e.g. John Doe"
                            autoCapitalize="words"
                            leftIcon={User}
                            error={errors.name?.message}
                            returnKeyType="next"
                            onSubmitEditing={() => emailInputRef.current?.focus()}
                            blurOnSubmit={false}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="email"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextInput
                            ref={emailInputRef}
                            label={t('email_address', 'Email Address')}
                            labelClassName="text-sm font-bold text-[#1C1917] dark:text-white"
                            required
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            placeholder="john@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            leftIcon={Mail}
                            error={errors.email?.message}
                            returnKeyType="next"
                            onSubmitEditing={() => unitInputRef.current?.focus()}
                            blurOnSubmit={false}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="phone"
                        render={({ field: { onChange, value } }) => (
                          <PhoneInput
                            label={t('phone_number', 'Phone Number')}
                            required
                            placeholder="98765 43210"
                            value={value}
                            onChangeText={onChange}
                            error={errors.phone?.message}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="unitNumber"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextInput
                            ref={unitInputRef}
                            label={t('villa_unit_optional', 'Villa / Unit No. (Optional)')}
                            labelClassName="text-sm font-bold text-[#1C1917] dark:text-white"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            placeholder="e.g. Villa 104, Block B"
                            leftIcon={Home}
                            returnKeyType="next"
                            onSubmitEditing={() => passwordInputRef.current?.focus()}
                            blurOnSubmit={false}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="password"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <PasswordInput
                            ref={passwordInputRef}
                            label={t('password', 'Password')}
                            required
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            placeholder={t('create_password', 'Create a password')}
                            leftIcon={Lock}
                            showRequirements
                            error={errors.password?.message}
                            returnKeyType="next"
                            onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                            blurOnSubmit={false}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="confirmPassword"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <PasswordInput
                            ref={confirmPasswordInputRef}
                            label={t('confirm_password', 'Confirm Password')}
                            required
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            placeholder={t('re_enter_password', 'Re-enter password')}
                            leftIcon={Lock}
                            confirmValue={watch('password')}
                            error={errors.confirmPassword?.message}
                            returnKeyType="go"
                            onSubmitEditing={handleSubmit(onSubmit)}
                          />
                        )}
                      />
                      {(localError || error) ? (
                        <View className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
                          <Text className="text-rose-500 text-xs text-center font-medium">
                            {localError || error}
                          </Text>
                        </View>
                      ) : null}
                      <CTAButton
                        onPress={handleSubmit(onSubmit)}
                        disabled={loading || localLoading}
                        loading={loading || localLoading}
                        label={t('create_account', 'Create Account')}
                        loadingLabel={t('creating_account', 'Creating...')}
                      />
                    </View>
                  ) : (
                    /* EXISTING USER: Sign-In Form */
                    <View className="gap-3.5">
                      <Text className="text-base font-bold text-[#1C1917] dark:text-white text-center font-sans">
                        {t('welcome_back', 'Welcome Back')}
                      </Text>

                      {/* Sub-tabs: Email/Password vs Phone OTP */}
                      <View className="bg-white/40 dark:bg-black/30 backdrop-blur-md p-1.5 rounded-2xl flex-row border border-white/60 dark:border-white/15 shadow-2xs">
                        <TouchableOpacity
                          onPress={() => setExistingAuthMode('basic')}
                          activeOpacity={0.85}
                          style={
                            existingAuthMode === 'basic'
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
                          <Lock
                            size={14}
                            color={existingAuthMode === 'basic' ? '#EA580C' : '#57534E'}
                            strokeWidth={existingAuthMode === 'basic' ? 2.4 : 2}
                          />
                          <Text
                            style={{ color: existingAuthMode === 'basic' ? '#EA580C' : '#57534E' }}
                            className={`text-xs ${existingAuthMode === 'basic' ? 'font-bold' : 'font-medium'}`}
                          >
                            {t('email_password', 'Email / Password')}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setExistingAuthMode('phone')}
                          activeOpacity={0.85}
                          style={
                            existingAuthMode === 'phone'
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
                          <Smartphone
                            size={14}
                            color={existingAuthMode === 'phone' ? '#EA580C' : '#57534E'}
                            strokeWidth={existingAuthMode === 'phone' ? 2.4 : 2}
                          />
                          <Text
                            style={{ color: existingAuthMode === 'phone' ? '#EA580C' : '#57534E' }}
                            className={`text-xs ${existingAuthMode === 'phone' ? 'font-bold' : 'font-medium'}`}
                          >
                            {t('sign_in_with_otp', 'Sign in with OTP')}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {existingAuthMode === 'basic' ? (
                        <>
                          <Controller
                            control={signInForm.control}
                            name="login"
                            render={({ field: { onChange, onBlur, value } }) => (
                              <TextInput
                                label={t('email_or_username', 'Email or Username')}
                                labelClassName="text-sm font-bold text-[#1C1917] dark:text-white"
                                required
                                value={value}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                placeholder={t('enter_email_or_username', 'Enter your email or username')}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="email-address"
                                leftIcon={Mail}
                                error={signInForm.formState.errors.login?.message}
                                returnKeyType="next"
                                onSubmitEditing={() => signInPasswordRef.current?.focus()}
                                blurOnSubmit={false}
                              />
                            )}
                          />
                          <View>
                            <View className="flex-row items-center justify-between mb-1.5">
                              <Text className="text-sm font-bold text-[#1C1917] dark:text-white">
                                {t('password', 'Password')} <Text className="text-[#EA580C] font-bold">*</Text>
                              </Text>
                              <TouchableOpacity
                                onPress={() => router.push('/(auth)/forgot-password')}
                                activeOpacity={0.8}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={t('forgot_password', 'Forgot password')}
                              >
                                <Text className="text-xs font-bold text-[#EA580C]">{t('forgot_password_short', 'Forgot?')}</Text>
                              </TouchableOpacity>
                            </View>
                            <Controller
                              control={signInForm.control}
                              name="password"
                              render={({ field: { onChange, onBlur, value } }) => (
                                <PasswordInput
                                  ref={signInPasswordRef}
                                  value={value}
                                  onChangeText={onChange}
                                  onBlur={onBlur}
                                  placeholder={t('enter_password', 'Enter your password')}
                                  leftIcon={Lock}
                                  error={signInForm.formState.errors.password?.message}
                                  returnKeyType="go"
                                  onSubmitEditing={signInForm.handleSubmit(onSignInSubmit)}
                                />
                              )}
                            />
                          </View>
                          {(signInError || error) ? (
                            <View className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
                              <Text className="text-rose-500 text-xs text-center font-medium">
                                {signInError || error}
                              </Text>
                            </View>
                          ) : null}
                          <CTAButton
                            onPress={signInForm.handleSubmit(onSignInSubmit)}
                            disabled={signInLoading || googleLoading}
                            loading={signInLoading}
                            label={t('sign_in', 'Sign In')}
                            loadingLabel={t('signing_in', 'Signing In...')}
                          />
                        </>
                      ) : (
                        <>
                          <Controller
                            control={phoneForm.control}
                            name="phone"
                            render={({ field: { onChange, value } }) => (
                              <PhoneInput
                                label={t('phone_number', 'Mobile Number')}
                                required
                                placeholder="98765 43210"
                                value={value}
                                onChangeText={onChange}
                                error={phoneForm.formState.errors.phone?.message}
                              />
                            )}
                          />
                          {(signInError || error) ? (
                            <View className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
                              <Text className="text-rose-500 text-xs text-center font-medium">
                                {signInError || error}
                              </Text>
                            </View>
                          ) : null}
                          <CTAButton
                            onPress={phoneForm.handleSubmit(onPhoneSignInSubmit)}
                            disabled={isSubmittingPhone || googleLoading}
                            loading={isSubmittingPhone}
                            label={t('sign_in_with_otp', 'Sign in with OTP')}
                            loadingLabel={t('sending_code', 'Sending Code...')}
                          />
                        </>
                      )}
                    </View>
                  )}
                </View>

                {/* OR CONTINUE WITH Divider (High-visibility frosted pill) */}
                <View className="flex-row items-center my-2 gap-2.5">
                  <View className="flex-1 h-[1.5px] bg-white/70 dark:bg-white/20" />
                  <View className="bg-white/75 dark:bg-[#1C1917]/75 px-3.5 py-1 rounded-full border border-white/70 dark:border-white/15 shadow-2xs backdrop-blur-md">
                    <Text className="text-[10px] font-bold text-[#1C1917] dark:text-white tracking-widest uppercase font-sans">
                      {t('or_continue_with', 'Or Continue With')}
                    </Text>
                  </View>
                  <View className="flex-1 h-[1.5px] bg-white/70 dark:bg-white/20" />
                </View>

                {/* Social Authentication: Google ID & Apple ID */}
                <View className="flex-row items-center gap-3 w-full">
                  <SocialAuthButton
                  provider="google"
                  onPress={handleGoogleSignIn}
                  loading={googleLoading}
                />
                <AppleSignInButton disabled={googleLoading} />
                </View>

                {/* Bottom Hint (Transparent container without underline) */}
                <View className="items-center justify-center pt-2.5 pb-2">
                  <View className="bg-transparent flex-row items-center justify-center">
                    {userType === 'new' ? (
                      <>
                        <Text className="text-xs text-[#1C1917] dark:text-white font-medium">
                          {t('already_have_account', 'Already have an account?')}{' '}
                        </Text>
                        <TouchableOpacity
                          onPress={() => router.replace('/(auth)/login')}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={t('switch_to_sign_in', 'Switch to sign in')}
                        >
                          <Text className="text-xs font-bold text-[#EA580C]">
                            {t('sign_in', 'Sign In')}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text className="text-xs text-[#1C1917] dark:text-white font-medium">
                          {t('dont_have_account', "Don't have an account?")}{' '}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleTabSwitch('new')}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={t('switch_to_create_account', 'Switch to create account')}
                        >
                          <Text className="text-xs font-bold text-[#EA580C]">
                            {t('create_account', 'Create Account')}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              </Animated.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </>
  );
}
