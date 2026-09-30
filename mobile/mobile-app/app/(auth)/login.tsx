import { Text } from '@/components/ui/text';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  Mail,
  Lock,
  Smartphone,
  User,
  Eye,
  EyeOff,
  Check,
  Shield,
  ArrowRight,
  Sparkles,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput as RNTextInput,
  Platform,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
  AccessibilityInfo,
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
import { Checkbox } from '@/components/forms/Checkbox';
import { parseBackendError } from '@/src/utils/validation';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { storage, sessionStore } from '@/src/utils/storage';
import { useDispatch, useSelector } from 'react-redux';
import { clearPendingRoute } from '@/src/features/notification/store/notificationSlice';
import { useTranslation } from '@/src/utils/i18n';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

// 1. Basic Auth Validation Schema
const basicAuthSchema = yup.object().shape({
  login: yup
    .string()
    .required('Email or Username is required')
    .min(3, 'Must be at least 3 characters'),
  password: yup
    .string()
    .required('Password is required')
    .min(4, 'Password must be at least 4 characters'),
});

// 2. Phone OTP Validation Schema
const phoneSchema = yup.object().shape({
  phone: yup
    .string()
    .required('Phone number is required')
    .test('valid-phone', 'Please enter a valid mobile number with country code', (value) => {
      if (!value) return false;
      return /^\+[1-9]\d{7,14}$/.test(value.trim());
    }),
});

interface BasicAuthFormValues {
  login: string;
  password: string;
}

interface PhoneFormValues {
  phone: string;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  
  const { user, login: performLogin, requestOtp, error, isAuthenticated, otpSent, clearStatus } = useAuth();
  const { handleGoogleSignIn, loading: googleLoading } = useGoogleAuthSession();
  const params = useLocalSearchParams<{
    intent?: string;
    email?: string;
    inviteToken?: string;
    token?: string;
    switchType?: 'community' | 'villa' | 'role';
    targetName?: string;
    targetCommunity?: string;
    targetRole?: string;
  }>();
  const isCreateOrgIntent =
    params.intent === 'create-org' ||
    params.intent === 'create' ||
    (typeof window !== 'undefined' && typeof window.location !== 'undefined' && window.location?.href && (
      window.location.href.includes('intent=create-org') ||
      window.location.href.includes('intent=create')
    )) ||
    sessionStore.getItem('mobile_auth_intent') === 'create-org';

  React.useEffect(() => {
    if (params.intent === 'create-org' || params.intent === 'create') {
      sessionStore.setItem('mobile_auth_intent', params.intent);
    }
  }, [params.intent]);

  const [authMode, setAuthMode] = React.useState<'basic' | 'phone'>('basic');
  const [submittedPhone, setSubmittedPhone] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [keepSignedIn, setKeepSignedIn] = React.useState(true);
  const [isSubmittingBasic, setIsSubmittingBasic] = React.useState(false);
  const [isSubmittingPhone, setIsSubmittingPhone] = React.useState(false);
  const hasNavigatedRef = React.useRef(false);
  const [switchDismissed, setSwitchDismissed] = React.useState(false);
  const passwordInputRef = React.useRef<RNTextInput>(null);

  React.useEffect(() => {
    const loadSavedPreferences = async () => {
      try {
        const savedKeep = await storage.getItem('keep_signed_in');
        if (savedKeep !== null) {
          setKeepSignedIn(savedKeep === 'true');
        }
      } catch (e) {
        console.warn('Failed to load saved login preferences', e);
      }
    };
    loadSavedPreferences();
  }, []);

  // Accessibility: Reduced Motion Support
  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  // 1. Background Cinematic Parallax Drivers (Subtle slow breathing drift)
  const bgTranslateX = React.useRef(new Animated.Value(0)).current;
  const bgScale = React.useRef(new Animated.Value(1.04)).current;

  // 2. Nahom Logo Luxury Entrance Drivers (Initial: opacity 0, scale 0.95, translateY 8)
  const logoOpacity = React.useRef(new Animated.Value(0)).current;
  const logoScale = React.useRef(new Animated.Value(0.95)).current;
  const logoTranslateY = React.useRef(new Animated.Value(8)).current;

  // 3. NAHOM Wordmark Entrance Drivers
  const wordmarkOpacity = React.useRef(new Animated.Value(0)).current;
  const wordmarkTranslateY = React.useRef(new Animated.Value(6)).current;

  // 4. Emblem Weightless Float Driver (0 -> -4px -> 0, calm 3800ms cycle)
  const emblemFloat = React.useRef(new Animated.Value(0)).current;

  // 5. Logo Light Sweep Active State (revealed after entrance)
  const [enableLogoSweep, setEnableLogoSweep] = React.useState(false);

  // 6. Login Card Floating Entrance Drivers (Initial: opacity 0, scale 0.97, translateY 20)
  const cardOpacity = React.useRef(new Animated.Value(0)).current;
  const cardScale = React.useRef(new Animated.Value(0.97)).current;
  const cardTranslateY = React.useRef(new Animated.Value(20)).current;

  // 7. Sign In Button Reflection Sweep Drivers (4.8s cycle)
  const buttonSweepX = React.useRef(new Animated.Value(-120)).current;
  const buttonSweepOpacity = React.useRef(new Animated.Value(0)).current;

  // 8. Tactile Micro-Interaction Drivers
  const buttonPressScale = React.useRef(new Animated.Value(1)).current;
  const arrowShiftX = React.useRef(new Animated.Value(0)).current;
  const createAccountPressScale = React.useRef(new Animated.Value(1)).current;

  // 9. Input Focus Micro-Interaction Drivers
  const [isLoginFocused, setIsLoginFocused] = React.useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = React.useState(false);
  const loginIconScale = React.useRef(new Animated.Value(1)).current;
  const passwordIconScale = React.useRef(new Animated.Value(1)).current;

  // Coordinated Luxury Entrance & Ambient Sequence
  React.useEffect(() => {
    if (reduceMotion) {
      // Immediate calm static state for accessibility
      logoOpacity.setValue(1);
      logoScale.setValue(1);
      logoTranslateY.setValue(0);
      wordmarkOpacity.setValue(1);
      wordmarkTranslateY.setValue(0);
      cardOpacity.setValue(1);
      cardScale.setValue(1);
      cardTranslateY.setValue(0);
      return;
    }

    let isMounted = true;
    let bgDriftLoop: Animated.CompositeAnimation | null = null;
    let emblemFloatLoop: Animated.CompositeAnimation | null = null;
    let buttonSweepLoop: Animated.CompositeAnimation | null = null;

    // Background slow cinematic breathing drift (16s cycle)
    bgDriftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bgTranslateX, {
          toValue: 5,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bgTranslateX, {
          toValue: -5,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    bgDriftLoop.start();

    // Coordinated Staged Entrance Sequence:
    // 0.1s - 1.1s: Nahom logo gently revealed (900-1200ms duration, cubic ease-out)
    // 0.35s - 0.95s: Wordmark unfurls gracefully
    // 0.55s - 1.25s: Login card floats into position (650ms duration, cubic ease-out)
    Animated.parallel([
      // Logo Entrance
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 1050,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 1050,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoTranslateY, {
        toValue: 0,
        duration: 1050,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),

      // Stage 2: Wordmark Reveal
      Animated.sequence([
        Animated.delay(250),
        Animated.parallel([
          Animated.timing(wordmarkOpacity, {
            toValue: 1,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(wordmarkTranslateY, {
            toValue: 0,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Login Card Floating Entrance
      Animated.sequence([
        Animated.delay(550),
        Animated.parallel([
          Animated.timing(cardOpacity, {
            toValue: 1,
            duration: 680,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(cardScale, {
            toValue: 1,
            duration: 680,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(cardTranslateY, {
            toValue: 0,
            duration: 680,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start(() => {
      if (!isMounted) return;

      // 1.5s+: Ambient subtle animations begin
      setEnableLogoSweep(true);

      // Section 3: Orange orb / emblem subtle floating effect (3800ms cycle, 0 -> -4px -> 0, weightless)
      emblemFloatLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(emblemFloat, {
            toValue: -4,
            duration: 1900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(emblemFloat, {
            toValue: 0,
            duration: 1900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      emblemFloatLoop.start();

      // Section 9: Sign In button subtle light sweep (repeats every ~4.8 seconds)
      buttonSweepLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(buttonSweepX, {
              toValue: 360,
              duration: 950,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(buttonSweepOpacity, {
                toValue: 0.22,
                duration: 250,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.delay(450),
              Animated.timing(buttonSweepOpacity, {
                toValue: 0,
                duration: 250,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.timing(buttonSweepX, {
            toValue: -120,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(3800),
        ])
      );
      buttonSweepLoop.start();
    });

    return () => {
      isMounted = false;
      bgDriftLoop?.stop();
      emblemFloatLoop?.stop();
      buttonSweepLoop?.stop();
    };
  }, [reduceMotion]);

  // Tactile Micro-Interactions: Sign In CTA
  const handleBasicSignIn = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(buttonPressScale, {
          toValue: 0.98,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(arrowShiftX, {
          toValue: 4,
          duration: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(buttonPressScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(arrowShiftX, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    basicForm.handleSubmit(onBasicSubmit)();
  };

  const handlePhoneSignIn = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(buttonPressScale, {
          toValue: 0.98,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(arrowShiftX, {
          toValue: 4,
          duration: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(buttonPressScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(arrowShiftX, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    phoneForm.handleSubmit(onPhoneSubmit)();
  };

  // Tactile Micro-Interactions: Input Focus
  const handleLoginFieldFocus = () => {
    setIsLoginFocused(true);
    Animated.sequence([
      Animated.timing(loginIconScale, { toValue: 1.08, duration: 90, useNativeDriver: true }),
      Animated.timing(loginIconScale, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
  };

  const handlePasswordFieldFocus = () => {
    setIsPasswordFocused(true);
    Animated.sequence([
      Animated.timing(passwordIconScale, { toValue: 1.08, duration: 90, useNativeDriver: true }),
      Animated.timing(passwordIconScale, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
  };

  // Tactile Micro-Interactions: Create Account Button
  const handleCreateAccountPressIn = () => {
    Animated.timing(createAccountPressScale, {
      toValue: 0.98,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const handleCreateAccountPressOut = () => {
    Animated.timing(createAccountPressScale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  // Basic Auth Form Hook
  const basicForm = useForm<BasicAuthFormValues>({
    resolver: yupResolver(basicAuthSchema),
    mode: 'onTouched',
    defaultValues: {
      login: params.email ? decodeURIComponent(params.email) : '',
      password: '',
    },
  });

  // Phone Form Hook
  const phoneForm = useForm<PhoneFormValues>({
    resolver: yupResolver(phoneSchema),
    mode: 'onTouched',
    defaultValues: {
      phone: '',
    },
  });

  React.useEffect(() => {
    if (params.email) {
      basicForm.setValue('login', decodeURIComponent(params.email));
    }
  }, [params.email, basicForm]);

  React.useEffect(() => {
    clearStatus();
    return () => {
      clearStatus();
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      Keyboard.dismiss();
    };
  }, [authMode]);

  React.useEffect(() => {
    if (isAuthenticated && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      Keyboard.dismiss();

      const uAny = user as any;
      const hasOrg = !!(
        user && (
          uAny.orgId ||
          uAny.activeOrgId ||
          uAny.organizationId ||
          (Array.isArray(uAny.availableWorkspaces) && uAny.availableWorkspaces.length > 0)
        )
      );

      dispatch(clearPendingRoute());
        if (isCreateOrgIntent || !hasOrg) {
        sessionStore.removeItem('mobile_auth_intent');
        router.replace({ pathname: '/(auth)/setup-organization', params: { intent: 'create-org' } });
        } else {
        router.replace('/(resident)');
      }
    } else if (!isAuthenticated) {
      hasNavigatedRef.current = false;
    }
  }, [isAuthenticated, user, isCreateOrgIntent, dispatch]);

  // Reactively route to OTP screen if Phone OTP sent
  React.useEffect(() => {
    if (otpSent && submittedPhone) {
      router.push({
        pathname: '/(auth)/otp',
        params: { phone: submittedPhone },
      });
    }
  }, [otpSent, submittedPhone]);

  const savePreferences = async () => {
    try {
      await storage.setItem('keep_signed_in', keepSignedIn ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to save login preferences', e);
    }
  };

  // Handle Basic Auth Submit
  const onBasicSubmit = async (data: BasicAuthFormValues) => {
    const activeInviteToken = params.inviteToken || params.token || (
      typeof window !== 'undefined' && window.location?.href
        ? (window.location.href.match(/[\/?&](?:inviteToken|token|code)=([^&#]+)/i)?.[1] || undefined)
        : undefined
    );

    setIsSubmittingBasic(true);
    try {
      await savePreferences();
      const resultAction: any = await performLogin({
        login: data.login.trim(),
        password: data.password,
        ...(activeInviteToken ? { inviteToken: activeInviteToken } : {}),
      });

      // Invoke Google / Browser Credential Management API only upon successful login on Web
      if (resultAction && (resultAction.meta?.requestStatus === 'fulfilled' || (!resultAction.error && !resultAction.payload?.error))) {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && 'PasswordCredential' in window && (navigator as any)?.credentials?.store) {
          try {
            // @ts-ignore
            const cred = new window.PasswordCredential({
              id: data.login.trim(),
              password: data.password,
              name: data.login.trim(),
            });
            await (navigator as any).credentials.store(cred);
          } catch (e) {
            // Safe fallback if dismissed or unsupported
          }
        }
      }
    } finally {
      setIsSubmittingBasic(false);
    }
  };

  // Handle Phone OTP Submit
  const onPhoneSubmit = async (data: PhoneFormValues) => {
    setSubmittedPhone(data.phone);
    setIsSubmittingPhone(true);
    try {
      await savePreferences();
      await requestOtp(data.phone, false);
    } finally {
      setIsSubmittingPhone(false);
    }
  };

  return (
    <>
      <View className="flex-1 bg-background overflow-hidden relative">
        {/* Section 7: Cinematic Parallax Background Depth Layer */}
        <Animated.View
          style={{
            position: 'absolute',
            top: -12,
            bottom: -12,
            left: -24,
            right: -24,
            transform: [
              { scale: bgScale },
              { translateX: bgTranslateX },
            ],
          }}
          pointerEvents="none"
          >
          <Image
            source={require('../../assets/images/auth-bg.jpg')}
            style={{ width: '100%', height: '100%' }}
            blurRadius={Platform.OS === 'ios' ? 3 : 2}
            resizeMode="cover"
          />
        </Animated.View>
        <View className="absolute inset-0 bg-black/20 dark:bg-black/45" pointerEvents="none" />

        <KeyboardAvoidingView
          // On iOS, padding pushes the form up. On Android, adjustResize automatically handles it,
          // so behavior should be undefined to avoid native conflicts that squash the UI.
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
          style={{ flex: 1 }}
        >
          <KeyboardAwareScrollView
            extraScrollHeight={56}
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: Math.max(insets.top, 24) + 12,
              paddingBottom: Math.max(insets.bottom, 20) + 24,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            className="px-5"
          >
            <View className="max-w-sm mx-auto w-full gap-3.5">
            {/* Step 1, 2, 3: Top Brand Identity Section (Logo → App Name → Nexus Around Home → Slogan) */}
            <View className="items-center justify-center">
              {/* Step 1: Logo Emblem with Luxury Reveal & Weightless Float */}
              <Animated.View
                style={{
                  opacity: logoOpacity,
                  transform: [
                    { scale: logoScale },
                    { translateY: Animated.add(logoTranslateY, emblemFloat) },
                  ],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <NahomEmblem size={106} />
              </Animated.View>

              {/* Step 2 & 3: NAHOM Wordmark Reveal */}
              <Animated.View
                style={{
                  opacity: wordmarkOpacity,
                  transform: [
                    { translateY: wordmarkTranslateY },
                  ],
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: -2,
                }}
              >
                <NahomWordmark />
              </Animated.View>
            </View>

            {/* Section 6: Luxury Floating Login Card Entrance */}
            <Animated.View
              style={{
                opacity: cardOpacity,
                transform: [
                  { scale: cardScale },
                  { translateY: cardTranslateY },
                ],
              }}
              className="gap-3.5 w-full"
            >
              {/* Step 4: Login Method Selection (Frosted Glass Segmented Pill Buttons) */}
              <View className="bg-white/20 dark:bg-black/25 backdrop-blur-md p-1 rounded-full flex-row border border-white/35 shadow-xs">
                <TouchableOpacity
                  onPress={() => setAuthMode('basic')}
                  activeOpacity={0.85}
                  style={
                    authMode === 'basic'
                      ? {
                          backgroundColor: '#FFFFFF',
                          shadowColor: '#000000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 6,
                          elevation: 2,
                        }
                      : {
                          backgroundColor: 'transparent',
                        }
                  }
                  className="flex-1 py-2.5 rounded-full flex-row items-center justify-center gap-2"
                >
                  <User
                    size={16}
                    color={authMode === 'basic' ? '#EA580C' : 'rgba(255, 255, 255, 0.85)'}
                    strokeWidth={2.4}
                  />
                  <Text
                    style={{ color: authMode === 'basic' ? '#EA580C' : 'rgba(255, 255, 255, 0.85)' }}
                    className={`text-xs ${authMode === 'basic' ? 'font-bold' : 'font-medium'}`}
                  >
                    {t('email_password', 'Email / Password')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setAuthMode('phone')}
                  activeOpacity={0.85}
                  style={
                    authMode === 'phone'
                      ? {
                          backgroundColor: '#FFFFFF',
                          shadowColor: '#000000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 6,
                          elevation: 2,
                        }
                      : {
                          backgroundColor: 'transparent',
                        }
                  }
                  className="flex-1 py-2.5 rounded-full flex-row items-center justify-center gap-2"
                >
                  <Smartphone
                    size={16}
                    color={authMode === 'phone' ? '#EA580C' : 'rgba(255, 255, 255, 0.85)'}
                    strokeWidth={2.4}
                  />
                  <Text
                    style={{ color: authMode === 'phone' ? '#EA580C' : 'rgba(255, 255, 255, 0.85)' }}
                    className={`text-xs ${authMode === 'phone' ? 'font-bold' : 'font-medium'}`}
                  >
                    {t('sign_in_with_otp', 'Sign in with OTP')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Form Container (Translucent Glass layout with Welcome Back Header) */}
              <View className="w-full gap-3.5 mt-1">
                {/* Welcome Back Header Section */}
                <Text className="text-xl sm:text-2xl font-bold text-white text-center pb-0.5 font-sans">
                  {t('welcome_back', 'Welcome Back')}
                </Text>

                {/* Context Switch Auth Requirement Banner */}
                {params.switchType && params.targetName && !switchDismissed && (
                  <View className="bg-white/20 dark:bg-black/35 border border-white/35 rounded-2xl p-3.5 gap-2.5 shadow-2xs backdrop-blur-md">
                    {/* Header Row: Lock Icon, Title & Close Button */}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <View className="w-7 h-7 rounded-lg bg-[#EA580C]/25 items-center justify-center">
                          <Lock size={14} color="#FF7A00" strokeWidth={2.4} />
                        </View>
                        <Text className="text-[13px] font-bold text-white tracking-tight">
                          {t('authentication_required', 'Authentication Required')}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => setSwitchDismissed(true)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="w-6 h-6 rounded-full bg-white/20 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel={t('dismiss_notice', 'Dismiss notice')}
                      >
                        <X size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>

                    {/* Target Context Capsule Pill */}
                    <View className="flex-row items-center bg-black/25 border border-white/20 rounded-xl px-3 py-2 gap-2 shadow-2xs">
                      <View className="bg-[#EA580C]/30 px-2 py-0.5 rounded-md shrink-0">
                        <Text className="text-[9.5px] font-bold text-[#FF7A00] uppercase">
                          {params.switchType === 'villa' ? t('unit', 'Unit') : params.switchType === 'community' ? t('community', 'Community') : t('role', 'Role')}
                        </Text>
                      </View>
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        className="text-xs font-bold text-white flex-1"
                      >
                        {params.targetName}
                      </Text>
                    </View>
                  </View>
                )}

                {authMode === 'basic' ? (
                  /* Email / Password Form */
                  <View className="gap-3.5">
                    {/* Step 5: Email or Username Input */}
                    <View>
                      <Text className="text-xs font-semibold text-white mb-1.5 font-sans">
                        {t('email_or_username', 'Email or Username')} <Text className="text-[#EA580C] font-bold">*</Text>
                      </Text>
                      <Controller
                        control={basicForm.control}
                        name="login"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextInput
                            required
                            value={value}
                            onChangeText={onChange}
                            onFocus={handleLoginFieldFocus}
                            onBlur={() => {
                              setIsLoginFocused(false);
                              onBlur();
                            }}
                            placeholder={t('enter_email_or_username', 'Enter your email or username')}
                            placeholderTextColor="rgba(255, 255, 255, 0.65)"
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            className="bg-white/20 dark:bg-black/25 border-white/35 rounded-2xl h-[50px] py-0 shadow-none backdrop-blur-md"
                            inputClassName="text-white text-[16px] font-bold"
                            style={{ fontSize: 16, fontWeight: '700', fontFamily: 'HankenGrotesk_700Bold', color: '#FFFFFF' }}
                            leftIcon={
                              <Animated.View style={{ transform: [{ scale: loginIconScale }] }}>
                                <Mail size={18} color="rgba(255, 255, 255, 0.85)" />
                              </Animated.View>
                            }
                            error={basicForm.formState.errors.login?.message}
                            returnKeyType="next"
                            onSubmitEditing={() => passwordInputRef.current?.focus()}
                            blurOnSubmit={false}
                          />
                        )}
                      />
                    </View>

                    {/* Step 6: Password Input */}
                    <View>
                      <View className="flex-row items-center justify-between mb-1.5">
                        <Text className="text-xs font-semibold text-white font-sans">
                          {t('password', 'Password')} <Text className="text-[#EA580C] font-bold">*</Text>
                        </Text>
                        <TouchableOpacity
                          onPress={() => router.push('/(auth)/forgot-password')}
                          activeOpacity={0.8}
                          hitSlop={8}
                        >
                          <Text className="text-xs font-bold text-[#FF6A00]">
                            {t('forgot_password', 'Forgot?')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <Controller
                        control={basicForm.control}
                        name="password"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <PasswordInput
                            ref={passwordInputRef}
                            value={value}
                            onChangeText={onChange}
                            onFocus={handlePasswordFieldFocus}
                            onBlur={() => {
                              setIsPasswordFocused(false);
                              onBlur();
                            }}
                            placeholder={t('enter_password', 'Enter your password')}
                            placeholderTextColor="rgba(255, 255, 255, 0.65)"
                            className="bg-white/20 dark:bg-black/25 border-white/35 rounded-2xl h-[50px] py-0 shadow-none backdrop-blur-md"
                            inputClassName="text-white text-[16px] font-bold"
                            style={{ fontSize: 16, fontWeight: '700', fontFamily: 'HankenGrotesk_700Bold', color: '#FFFFFF' }}
                            leftIcon={
                              <Animated.View style={{ transform: [{ scale: passwordIconScale }] }}>
                                <Lock size={18} color="rgba(255, 255, 255, 0.85)" />
                              </Animated.View>
                            }
                            rightIconColor="rgba(255, 255, 255, 0.85)"
                            error={basicForm.formState.errors.password?.message}
                            returnKeyType="go"
                            onSubmitEditing={handleBasicSignIn}
                          />
                        )}
                      />
                    </View>

                    {/* Stay signed in Checkbox */}
                    <View className="flex-row items-center pt-0.5">
                      <Checkbox
                        checked={keepSignedIn}
                        onCheckedChange={setKeepSignedIn}
                        label={t('stay_signed_in', 'Stay signed in')}
                        labelClassName="text-xs text-white font-medium"
                        className="items-center"
                      />
                    </View>

                    {/* Global Error Banner */}
                    {error ? (
                      <View className="bg-rose-500/20 border border-rose-500/40 rounded-xl p-2.5 gap-2 backdrop-blur-md">
                        <Text className="text-rose-200 text-xs text-center font-medium">
                          {error}
                        </Text>
                        {(error.toLowerCase().includes('pending verification') ||
                          error.toLowerCase().includes('invitation') ||
                          error.toLowerCase().includes('password is not set') ||
                          error.toLowerCase().includes('active membership')) && (
                          <TouchableOpacity
                            onPress={() => {
                              const currentLogin = basicForm.getValues('login');
                              router.push({
                                pathname: '/(auth)/accept-invite',
                                params: currentLogin ? { email: currentLogin } : {},
                              });
                            }}
                            className="bg-primary/25 border border-primary/40 rounded-lg py-1.5 px-3 self-center flex-row items-center gap-1.5"
                          >
                            <Sparkles size={13} color="#FF7A00" />
                            <Text className="text-xs font-bold text-white">
                              {t('accept_invitation_cta', 'Accept Workspace Invitation')}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : null}

                    {/* Step 7: Sign In CTA Button */}
                    <Animated.View style={{ transform: [{ scale: buttonPressScale }] }}>
                      <TouchableOpacity
                        onPress={handleBasicSignIn}
                        disabled={isSubmittingBasic || isSubmittingPhone || googleLoading}
                        activeOpacity={0.9}
                        style={{
                          shadowColor: '#EA580C',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.35,
                          shadowRadius: 14,
                          elevation: 4,
                        }}
                        className="mt-1 h-[50px] rounded-2xl flex-row items-center justify-center gap-2 overflow-hidden relative"
                      >
                        <View className="absolute inset-0">
                          <Svg width="100%" height="100%" preserveAspectRatio="none">
                            <Defs>
                              <LinearGradient id="signInGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <Stop offset="0%" stopColor="#1E232E" />
                                <Stop offset="42%" stopColor="#252D3D" />
                                <Stop offset="75%" stopColor="#EA580C" />
                                <Stop offset="100%" stopColor="#FF7A00" />
                              </LinearGradient>
                            </Defs>
                            <Rect width="100%" height="100%" rx="16" fill="url(#signInGrad)" />
                          </Svg>
                        </View>

                        {/* Section 9: Subtle Light Reflection Sweep */}
                        <Animated.View
                          style={{
                            position: 'absolute',
                            top: -10,
                            bottom: -10,
                            width: 55,
                            transform: [{ translateX: buttonSweepX }, { skewX: '-24deg' }],
                            opacity: buttonSweepOpacity,
                            backgroundColor: 'rgba(255, 255, 255, 0.28)', }}
                          pointerEvents="none"
                        />

                        {isSubmittingBasic ? (
                          <View className="flex-row items-center gap-2 z-10">
                            <ActivityIndicator color="#FFFFFF" size="small" />
                            <Text className="font-bold text-white text-sm font-sans">
                              {t('signing_in', 'Signing In...')}
                            </Text>
                          </View>
                        ) : (
                          <View className="flex-row items-center justify-center gap-2 z-10">
                            <Text className="font-bold text-white text-base font-sans">
                              {t('sign_in', 'Sign In')}
                            </Text>
                            <Animated.View style={{ transform: [{ translateX: arrowShiftX }] }}>
                              <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.5} />
                            </Animated.View>
                          </View>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                ) : (
                  /* Phone OTP Form */
                  <View className="gap-3.5">
                    <Controller
                      control={phoneForm.control}
                      name="phone"
                      render={({ field: { onChange, value } }) => (
                        <PhoneInput
                          variant="glass"
                          label={t('phone_number', 'Mobile Number')}
                          placeholder="98765 43210"
                          placeholderTextColor="rgba(255, 255, 255, 0.65)"
                          labelClassName="text-xs font-semibold text-white mb-1.5"
                          className="bg-white/20 dark:bg-black/25 border-white/35 rounded-2xl h-[50px] py-0 shadow-none backdrop-blur-md"
                          inputClassName="text-white text-[16px] font-bold"
                          codeClassName="text-white font-bold"
                          dividerClassName="border-white/30"
                          chevronColor="rgba(255, 255, 255, 0.85)"
                          showCount={false}
                          helperContainerClassName="bg-black/40 border border-white/25 px-2.5 py-1 rounded-lg self-start mt-1.5 backdrop-blur-md"
                          helperClassName="text-xs font-bold text-white"
                          style={{ fontSize: 16, fontWeight: '700', fontFamily: 'HankenGrotesk_700Bold', color: '#FFFFFF' }}
                          value={value}
                          onChangeText={onChange}
                          error={phoneForm.formState.errors.phone?.message}
                        />
                      )}
                    />

                    {/* Stay signed in Checkbox */}
                    <View className="flex-row items-center pt-0.5">
                      <Checkbox
                        checked={keepSignedIn}
                        onCheckedChange={setKeepSignedIn}
                        label={t('stay_signed_in', 'Stay signed in')}
                        labelClassName="text-xs text-white font-medium"
                        className="items-center"
                      />
                    </View>

                    {/* Global Error Banner */}
                    {error ? (
                      <View className="bg-rose-500/20 border border-rose-500/40 rounded-xl p-2.5 backdrop-blur-md">
                        <Text className="text-rose-200 text-xs text-center font-medium">
                          {error}
                        </Text>
                      </View>
                    ) : null}

                    {/* Sign in with OTP Button */}
                    <Animated.View style={{ transform: [{ scale: buttonPressScale }] }}>
                      <TouchableOpacity
                        onPress={handlePhoneSignIn}
                        disabled={isSubmittingBasic || isSubmittingPhone || googleLoading}
                        activeOpacity={0.9}
                        style={{
                          shadowColor: '#EA580C',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.35,
                          shadowRadius: 14,
                          elevation: 4,
                        }}
                        className="mt-1 h-[50px] rounded-2xl flex-row items-center justify-center gap-2 overflow-hidden relative"
                      >
                        <View className="absolute inset-0">
                          <Svg width="100%" height="100%" preserveAspectRatio="none">
                            <Defs>
                              <LinearGradient id="otpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <Stop offset="0%" stopColor="#1E232E" />
                                <Stop offset="42%" stopColor="#252D3D" />
                                <Stop offset="75%" stopColor="#EA580C" />
                                <Stop offset="100%" stopColor="#FF7A00" />
                              </LinearGradient>
                            </Defs>
                            <Rect width="100%" height="100%" rx="16" fill="url(#otpGrad)" />
                          </Svg>
                        </View>

                        {/* Subtle Light Reflection Sweep */}
                        <Animated.View
                          style={{
                            position: 'absolute',
                            top: -10,
                            bottom: -10,
                            width: 55,
                            transform: [{ translateX: buttonSweepX }, { skewX: '-24deg' }],
                            opacity: buttonSweepOpacity,
                            backgroundColor: 'rgba(255, 255, 255, 0.28)', }}
                          pointerEvents="none"
                        />

                        {isSubmittingPhone ? (
                          <View className="flex-row items-center gap-2 z-10">
                            <ActivityIndicator color="#FFFFFF" size="small" />
                            <Text className="font-bold text-white text-sm font-sans">
                              {t('sending_otp', 'Sending OTP Code...')}
                            </Text>
                          </View>
                        ) : (
                          <View className="flex-row items-center justify-center gap-2 z-10">
                            <Text className="font-bold text-white text-base font-sans">
                              {t('sign_in_with_otp', 'Sign in with OTP')}
                            </Text>
                            <Animated.View style={{ transform: [{ translateX: arrowShiftX }] }}>
                              <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.5} />
                            </Animated.View>
                          </View>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                )}
              </View>

              {/* OR CONTINUE WITH Divider */}
              <View className="flex-row items-center my-3 gap-3">
                <View className="flex-1 h-[1px] bg-white/30" />
                <Text className="text-[10.5px] font-bold text-white/80 tracking-widest uppercase font-sans">
                  {t('or_continue_with', 'Or Continue With')}
                </Text>
                <View className="flex-1 h-[1px] bg-white/30" />
              </View>

              {/* Social Authentication: Google ID & Apple ID */}
              <View className="flex-row items-center gap-3.5 w-full">
                <SocialAuthButton
                  provider="google"
                  variant="glass"
                  onPress={handleGoogleSignIn}
                  loading={googleLoading}
                  disabled={isSubmittingBasic || isSubmittingPhone}
                />
                <AppleSignInButton
                  variant="glass"
                  disabled={isSubmittingBasic || isSubmittingPhone || googleLoading}
                />
              </View>

              {/* Create Organisation Prompt */}
              <View className="items-center justify-center pt-2.5 pb-2">
                <Animated.View style={{ transform: [{ scale: createAccountPressScale }] }}>
                  <View className="bg-transparent flex-row items-center justify-center">
                    <Text className="text-xs text-white font-medium">
                      {t('dont_have_organisation', "Don't have an Organisation?")}{' '}
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push('/(auth)/signup')}
                      onPressIn={handleCreateAccountPressIn}
                      onPressOut={handleCreateAccountPressOut}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Create Organisation"
                    >
                      <Text className="text-xs font-bold text-[#FF6A00]">
                        {t('create_organisation', 'Create Organisation')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </View>

            </Animated.View>
          </View>
          </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
    </View>
    </>
  );
}

// Utility helper for classnames
function cnText(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

