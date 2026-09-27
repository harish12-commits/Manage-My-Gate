import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Building2,
} from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { KeyboardAvoidingShell } from '@/components/layout/KeyboardAvoidingShell';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { GoogleSignInButton } from '../../src/features/auth/components/GoogleSignInButton';
import { AppleSignInButton } from '../../src/features/auth/components/AppleSignInButton';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAuth } from '../../src/features/auth/hooks/useAuth';
import { acceptInviteThunk } from '../../src/features/auth/store/authSlice';
import authService from '../../src/features/auth/services/authService';
import apiClient from '../../src/services/apiClient';

// Accept Invite Password Validation Schema - token is managed silently, not by user input
const acceptInviteSchema = yup.object().shape({
  password: yup
    .string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
  confirmPassword: yup
    .string()
    .required('Please repeat your password')
    .oneOf([yup.ref('password')], 'Passwords do not match'),
});

type AcceptInviteFormValues = yup.InferType<typeof acceptInviteSchema>;

export default function AcceptInviteScreen() {
  const {
    isAuthenticated,
    isInitialized,
    user,
    clearStatus,
    acceptInvite,
    logout,
    switchWorkspaceContext,
  } = useAuth();
  const searchParams = useLocalSearchParams<{
    token?: string;
    invitationId?: string;
    code?: string;
    email?: string;
    action?: string;
    mode?: string;
  }>();
  const [submitting, setSubmitting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [inviteMeta, setInviteMeta] = useState<{
    state?: string;
    valid?: boolean;
    orgId?: string;
    orgName?: string;
    villa?: string;
    unit?: string;
    role?: string;
    email?: string;
    invitedEmail?: string;
    authenticatedEmail?: string;
    membershipStatus?: string;
    invitationStatus?: string;
    message?: string;
  } | null>(null);
  const [validating, setValidating] = useState(false);
  const acceptedNavigationRef = useRef(false);

  // Status & Modal visibility states
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [isRejectedState, setIsRejectedState] = useState(false);
  const [isAlreadyRegisteredModalVisible, setIsAlreadyRegisteredModalVisible] = useState(false);
  const [isInvalidTokenModalVisible, setIsInvalidTokenModalVisible] = useState(false);
  const [alreadyRegisteredEmail, setAlreadyRegisteredEmail] = useState('');

  const loggedInEmail = (user?.email || '').trim().toLowerCase();
  const targetInviteEmail = (
    inviteMeta?.invitedEmail ||
    inviteMeta?.email ||
    searchParams.email ||
    alreadyRegisteredEmail ||
    ''
  )
    .trim()
    .toLowerCase();
  const flowState = (inviteMeta?.state || '').toUpperCase();
  const isAlreadyAccepted = flowState === 'ALREADY_ACCEPTED';
  const isResolvingInvite = validating || (isAlreadyAccepted && isAuthenticated && submitting);
  const isAccountMismatch =
    flowState === 'ACCOUNT_MISMATCH' ||
    flowState === 'ALREADY_ACCEPTED_OTHER_ACCOUNT' ||
    Boolean(
      isAuthenticated && loggedInEmail && targetInviteEmail && loggedInEmail !== targetInviteEmail
    );

  const handleSignOutAndSwitch = useCallback(async () => {
    setSubmitting(true);
    setApiError(null);
    try {
      await logout();
      clearStatus();
    } catch (e) {
      console.warn('Logout error during invite account switch', e);
    } finally {
      setSubmitting(false);
    }
  }, [logout, clearStatus]);

  // Extract token or invitationId from route searchParams, query params, or URL path
  const getTokenFromContext = useCallback(() => {
    if (searchParams.token) return searchParams.token;
    if (searchParams.invitationId) return searchParams.invitationId;
    if (searchParams.code) return searchParams.code;
    if (typeof window !== 'undefined' && window.location?.href) {
      const match = window.location.href.match(
        /[\/?&](?:token|code|invitationId)=([^&#]+)|\/invite\/(?:app\/|web\/)?([a-f0-9]{32,64}|[^/?&#]+)/i
      );
      if (match) return match[1] || match[2];
    }
    return '';
  }, [searchParams.token, searchParams.invitationId, searchParams.code]);

  const getActionFromContext = useCallback(() => {
    if (searchParams.action) return searchParams.action;
    if (typeof window !== 'undefined' && window.location?.href) {
      const match = window.location.href.match(/[\/?&]action=([^&#]+)/i);
      if (match) return decodeURIComponent(match[1]);
    }
    return '';
  }, [searchParams.action]);

  const [resolvedToken, setResolvedToken] = useState<string>(getTokenFromContext);
  const [resolvedAction, setResolvedAction] = useState<string>(getActionFromContext);

  useEffect(() => {
    const extracted = getTokenFromContext();
    if (extracted && extracted !== resolvedToken) {
      setResolvedToken(extracted);
    }
  }, [getTokenFromContext, resolvedToken]);

  useEffect(() => {
    const extracted = getActionFromContext();
    if (extracted && extracted !== resolvedAction) {
      setResolvedAction(extracted);
    }
  }, [getActionFromContext, resolvedAction]);

  const form = useForm<AcceptInviteFormValues>({
    resolver: yupResolver(acceptInviteSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const handleNavigateToLogin = useCallback(
    (emailTarget?: string) => {
      const targetEmail = (
        emailTarget ||
        searchParams.email ||
        alreadyRegisteredEmail ||
        inviteMeta?.email ||
        ''
      ).trim();
      const currentToken = (
        resolvedToken ||
        getTokenFromContext() ||
        searchParams.token ||
        searchParams.code ||
        ''
      ).trim();
      const loginParams: Record<string, string> = {};
      if (targetEmail) loginParams.email = targetEmail;
      if (currentToken) loginParams.inviteToken = currentToken;

      try {
        router.replace({
          pathname: '/(auth)/login',
          params: loginParams,
        });
      } catch (e) {}

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const q = new URLSearchParams(loginParams);
        const url = q.toString() ? `/(auth)/login?${q.toString()}` : '/(auth)/login';
        if (!window.location.pathname.includes('login')) {
          window.location.href = url;
        }
      }
    },
    [
      searchParams.email,
      searchParams.token,
      searchParams.code,
      resolvedToken,
      getTokenFromContext,
      alreadyRegisteredEmail,
      inviteMeta?.email,
    ]
  );

  const handleRejectInvitation = useCallback(async () => {
    setIsRejecting(true);
    setApiError(null);
    const targetEmail = (searchParams.email || inviteMeta?.email || '').trim();
    const inviteToken = (
      resolvedToken ||
      getTokenFromContext() ||
      searchParams.token ||
      searchParams.code ||
      ''
    ).trim();
    try {
      await authService.rejectInvite({
        token: inviteToken,
        email: targetEmail || undefined,
      });
      setIsRejectedState(true);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || '';
      if (errMsg.toLowerCase().includes('reject')) {
        setIsRejectedState(true);
      } else {
        setApiError(errMsg || 'Failed to reject invitation.');
      }
    } finally {
      setIsRejecting(false);
    }
  }, [
    searchParams.email,
    searchParams.token,
    searchParams.code,
    inviteMeta?.email,
    resolvedToken,
    getTokenFromContext,
  ]);

  const handleAcceptAuthenticatedInvite = useCallback(async () => {
    setSubmitting(true);
    setApiError(null);
    try {
      const inviteToken = (resolvedToken || getTokenFromContext() || '').trim();
      const actionResult: any = await acceptInvite(inviteToken, undefined, loggedInEmail);
      if (acceptInviteThunk.fulfilled.match(actionResult)) {
        router.replace('/(resident)/dashboard');
        return;
      }
      const errMsg =
        (actionResult?.payload as string) ||
        actionResult?.error?.message ||
        'Failed to accept invitation.';
      setApiError(errMsg);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to accept invitation.');
    } finally {
      setSubmitting(false);
    }
  }, [resolvedToken, getTokenFromContext, user?.email, acceptInvite]);

  // Validate the invitation link on mount / token change
  useEffect(() => {
    if (!isInitialized) return;
    const tokenToValidate = (resolvedToken || getTokenFromContext() || '').trim();
    const emailToValidate = (searchParams.email || '').trim();

    if (!tokenToValidate && !emailToValidate) {
      return;
    }

    let isMounted = true;
    setValidating(true);

    const checkInvite = async () => {
      const actionToPerform = (resolvedAction || getActionFromContext() || '').trim().toLowerCase();

      // If the incoming intent is explicitly to REJECT, execute rejection immediately
      // and do not evaluate registration or auto-login workflows.
      if (actionToPerform === 'reject') {
        await handleRejectInvitation();
        // Best-effort fetch invite metadata for clean community/role presentation
        try {
          const query = new URLSearchParams();
          if (tokenToValidate) query.append('token', tokenToValidate);
          if (emailToValidate) query.append('email', emailToValidate);
          const res: any = await apiClient.get(`/auth/validate-invite?${query.toString()}`);
          const data = res?.data?.data || res?.data || res;
          if (isMounted && data) {
            setInviteMeta(data);
          }
        } catch (_) {}
        if (isMounted) setValidating(false);
        return;
      }

      try {
        const query = new URLSearchParams();
        if (tokenToValidate) query.append('token', tokenToValidate);
        if (emailToValidate) query.append('email', emailToValidate);

        const res: any = await apiClient.get(`/auth/validate-invite?${query.toString()}`);
        const data = res?.data?.data || res?.data || res;

        if (isMounted && data) {
          setInviteMeta(data);
          const state = String(data.state || '').toUpperCase();
          if (state === 'ACCOUNT_MISMATCH' || state === 'ALREADY_ACCEPTED_OTHER_ACCOUNT') {
            setApiError(null);
            setIsAlreadyRegistered(false);
          } else if (state === 'ALREADY_ACCEPTED') {
            const userEmail = data.invitedEmail || data.email || emailToValidate;
            setIsAlreadyRegistered(true);
            setAlreadyRegisteredEmail(userEmail);
            if (!isAuthenticated) setIsAlreadyRegisteredModalVisible(true);
          } else if (data.valid) {
            setApiError(null);
            if (data.membershipStatus === 'Rejected' || data.invitationStatus === 'REJECTED') {
              setIsRejectedState(true);
            } else if (data.isExisting || data.isAlreadyRegistered) {
              const userEmail = data.email || emailToValidate;
              setIsAlreadyRegistered(true);
              setAlreadyRegisteredEmail(userEmail);

              if (!isAuthenticated) {
                setIsAlreadyRegisteredModalVisible(true);

                if (Platform.OS !== 'web') {
                  Alert.alert(
                    'Already Registered',
                    'Your account is already active and your password has been set. Please sign in to access your community workspace.',
                    [
                      {
                        text: 'Sign In',
                        onPress: () => handleNavigateToLogin(userEmail),
                      },
                    ]
                  );
                }
              }
            }
          } else {
            // Handle non-valid status responses returned from backend state matrix
            const invStatus = (
              data.state ||
              data.invitationStatus ||
              data.membershipStatus ||
              ''
            ).toUpperCase();
            if (invStatus === 'REJECTED') {
              setIsRejectedState(true);
            } else if (invStatus === 'ACCEPTED') {
              const userEmail = data.email || emailToValidate;
              setIsAlreadyRegistered(true);
              setAlreadyRegisteredEmail(userEmail);
            } else {
              setIsInvalidTokenModalVisible(true);
              setApiError(data.message || 'This invitation link is invalid or has expired.');
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          const errMsg = err?.response?.data?.message || err?.message || '';
          if (errMsg.toLowerCase().includes('reject')) {
            setIsRejectedState(true);
            setApiError(null);
          } else if (
            errMsg.toLowerCase().includes('already active') ||
            errMsg.toLowerCase().includes('already registered') ||
            (errMsg.toLowerCase().includes('already') &&
              (errMsg.toLowerCase().includes('accepted') ||
                errMsg.toLowerCase().includes('member')))
          ) {
            setIsAlreadyRegistered(true);
            setAlreadyRegisteredEmail(emailToValidate);
            setIsAlreadyRegisteredModalVisible(true);
          } else {
            setIsInvalidTokenModalVisible(true);
            setApiError(errMsg || 'This invitation link is invalid or has expired.');
          }
        }
      } finally {
        if (isMounted) setValidating(false);
      }
    };

    checkInvite();

    return () => {
      isMounted = false;
    };
  }, [
    isInitialized,
    isAuthenticated,
    user?.id,
    resolvedToken,
    getTokenFromContext,
    resolvedAction,
    getActionFromContext,
    searchParams.email,
    handleNavigateToLogin,
    handleRejectInvitation,
  ]);

  useEffect(() => {
    if (
      !isInitialized ||
      !isAuthenticated ||
      !isAlreadyAccepted ||
      !inviteMeta?.orgId ||
      acceptedNavigationRef.current
    )
      return;
    acceptedNavigationRef.current = true;
    setSubmitting(true);
    switchWorkspaceContext({ targetOrgId: inviteMeta.orgId })
      .unwrap()
      .then(() => router.replace('/(resident)/dashboard'))
      .catch((err: any) => {
        acceptedNavigationRef.current = false;
        setApiError(err?.message || 'Unable to activate the invited workspace.');
      })
      .finally(() => setSubmitting(false));
  }, [
    isInitialized,
    isAuthenticated,
    isAlreadyAccepted,
    inviteMeta?.orgId,
    switchWorkspaceContext,
  ]);

  useEffect(() => {
    clearStatus();
    return () => {
      clearStatus();
      if (
        Platform.OS === 'web' &&
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLElement
      ) {
        document.activeElement.blur();
      }
    };
  }, [clearStatus]);

  const onSubmit = async (data: AcceptInviteFormValues) => {
    setSubmitting(true);
    setApiError(null);
    let targetEmail = (searchParams.email || inviteMeta?.email || '').trim();

    try {
      const inviteToken = (resolvedToken || getTokenFromContext() || '').trim();

      // Dispatch acceptInviteThunk via useAuth to activate membership and persist session
      const actionResult: any = await acceptInvite(
        inviteToken,
        data.password,
        targetEmail || undefined
      );

      if (acceptInviteThunk.fulfilled.match(actionResult)) {
        // Session successfully adopted into Redux store and async storage!
        // Immediately navigate to resident dashboard with the accepted community workspace context
        router.replace('/(resident)/dashboard');
        return;
      }

      // If rejected, inspect the error message
      const errMsg =
        (actionResult?.payload as string) ||
        actionResult?.error?.message ||
        'Failed to save password.';

      if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('active')) {
        // User account is already active -> redirect to login page with email prefilled
        handleNavigateToLogin(targetEmail);
      } else {
        setApiError(errMsg);
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to save password.';
      if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('active')) {
        // User account is already active -> directly redirect to login page immediately
        handleNavigateToLogin(targetEmail);
      } else {
        setApiError(errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndConfirm = () => {
    form.handleSubmit(
      (validData) => onSubmit(validData),
      (_errors) => {
        const currentVals = form.getValues();
        onSubmit(currentVals);
      }
    )();
  };

  const handleSsoSuccess = useCallback((_data: any) => {
    router.replace('/(resident)/dashboard');
  }, []);

  const handleSsoError = useCallback((err: any) => {
    const msg =
      typeof err === 'string' ? err : err?.message || 'Failed to accept invitation with SSO';
    setApiError(msg);
  }, []);

  const currentInviteToken = (resolvedToken || getTokenFromContext() || '').trim();

  return (
    <>
      <Stack.Screen options={{ title: 'Accept Workspace Invitation', headerBackVisible: true }} />
      <KeyboardAvoidingShell
        className="bg-background"
        scrollViewProps={{
          contentContainerStyle: {
            paddingHorizontal: 16,
            paddingVertical: 24,
            flexGrow: 1,
            paddingBottom: 80,
          },
          automaticallyAdjustKeyboardInsets: Platform.OS === 'ios',
        }}>
        <View className="mx-auto w-full max-w-sm flex-1 justify-center gap-5 py-2 sm:max-w-md sm:py-4">
          {/* Header / Brand Icon */}
          <View className="mb-1 items-center">
            <View
              className={`${isRejectedState ? 'bg-red-500/10' : 'bg-primary/10'} mb-2.5 items-center justify-center rounded-2xl p-3.5`}>
              {isRejectedState ? (
                <XCircle className="size-9 text-red-600 dark:text-red-400" size={34} />
              ) : (
                <ShieldCheck className="size-9 text-primary" size={34} />
              )}
            </View>
            <Text className="text-center text-2xl font-extrabold tracking-tight text-foreground">
              {isRejectedState ? 'Invitation Declined' : 'Accept Invitation'}
            </Text>
            <Text className="mt-1 px-2 text-center text-sm text-muted-foreground">
              {isRejectedState
                ? 'You have declined this workspace invitation'
                : 'Set up your password to activate your account and join your community workspace'}
            </Text>
          </View>

          {isResolvingInvite ? <ActivityIndicator size={32} /> : null}

          {/* CASE 0: Invitation Rejected State */}
          {!isResolvingInvite && isRejectedState ? (
            <View className="shadow-xs items-center gap-4 rounded-2xl border border-border bg-card p-6">
              <View className="items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 p-4">
                <XCircle size={38} className="text-red-600 dark:text-red-400" />
              </View>
              <View className="items-center gap-1.5">
                <Text className="text-center text-xl font-extrabold text-foreground">
                  Invitation Declined
                </Text>
                <Text className="px-2 text-center text-sm text-muted-foreground">
                  {inviteMeta?.orgName
                    ? `You have declined the invitation to join ${inviteMeta.orgName}.`
                    : 'You have declined this workspace invitation.'}
                </Text>
                {inviteMeta?.role ? (
                  <Text className="mt-1 text-center text-xs text-muted-foreground">
                    Role: <Text className="font-semibold text-foreground">{inviteMeta.role}</Text>
                  </Text>
                ) : null}
                <Text className="mt-1 px-2 text-center text-xs text-muted-foreground">
                  No further action is required. You will not be added to this community.
                </Text>
              </View>
              <Button
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    try {
                      router.replace('/');
                    } catch (_) {}
                  }
                }}
                variant="outline"
                className="mt-3 h-12 w-full items-center justify-center rounded-xl border-border"
                textClassName="font-semibold text-sm text-foreground">
                Close
              </Button>
              <Button
                onPress={() => handleNavigateToLogin()}
                variant="ghost"
                className="h-10 w-full items-center justify-center"
                textClassName="text-xs text-muted-foreground">
                Sign in with an existing account
              </Button>
            </View>
          ) : null}

          {/* CASE 1A: Authenticated Session with Account Mismatch */}
          {!isResolvingInvite && !isRejectedState && isAccountMismatch ? (
            <View className="shadow-xs items-center gap-4 rounded-2xl border border-border bg-card p-6">
              <View className="items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 p-4">
                <AlertCircle size={38} className="text-amber-600 dark:text-amber-400" />
              </View>
              <View className="w-full items-center gap-2">
                <Text className="text-center text-xl font-extrabold text-foreground">
                  Different Account Signed In
                </Text>
                <Text className="px-2 text-center text-xs text-muted-foreground">
                  You are currently signed in to the app as:
                </Text>
                <View className="w-full items-center rounded-xl border border-border bg-muted/70 px-3.5 py-2">
                  <Text className="font-bold text-sm text-foreground">{user?.email}</Text>
                </View>
                <Text className="mt-1 px-2 text-center text-xs text-muted-foreground">
                  This invitation to join{' '}
                  <Text className="font-bold text-foreground">
                    {inviteMeta?.orgName || 'this community'}
                  </Text>
                  {inviteMeta?.role ? ` as ${inviteMeta.role}` : ''} was sent to:
                </Text>
                <View className="w-full items-center rounded-xl border border-primary/20 bg-primary/10 px-3.5 py-2">
                  <Text className="font-bold text-sm text-primary">{targetInviteEmail}</Text>
                </View>
                <Text className="mt-1 px-2 text-center text-xs text-muted-foreground">
                  To accept this invitation, sign out of your current account and accept as{' '}
                  {targetInviteEmail}.
                </Text>
              </View>

              {apiError ? <ErrorBanner message={apiError} /> : null}

              <View className="mt-2 w-full flex-col gap-2.5">
                <Button
                  onPress={handleSignOutAndSwitch}
                  loading={submitting}
                  className="h-12 w-full items-center justify-center rounded-xl bg-primary"
                  textClassName="font-bold text-base">
                  Sign Out & Accept as {targetInviteEmail || 'Invited User'}
                </Button>
                <Button
                  onPress={() => router.replace('/(resident)/dashboard')}
                  variant="outline"
                  className="h-11 w-full items-center justify-center rounded-xl border-border"
                  textClassName="font-semibold text-sm text-foreground">
                  Keep Signed In as {user?.email}
                </Button>
              </View>
            </View>
          ) : null}

          {/* CASE 1B: Authenticated Session with Matching Account (Joining Workspace) */}
          {!isResolvingInvite &&
          !isRejectedState &&
          !isAccountMismatch &&
          !isAlreadyAccepted &&
          isAuthenticated ? (
            <View className="shadow-xs items-center gap-4 rounded-2xl border border-border bg-card p-6">
              <View className="items-center justify-center rounded-full border border-primary/20 bg-primary/10 p-4">
                <Building2 size={38} className="text-primary" />
              </View>
              <View className="items-center gap-1.5">
                <Text className="text-center text-xl font-extrabold text-foreground">
                  Join {inviteMeta?.orgName || 'Community Workspace'}
                </Text>
                <Text className="px-2 text-center text-sm text-muted-foreground">
                  You have been invited to join{' '}
                  <Text className="font-bold text-foreground">
                    {inviteMeta?.orgName || 'this community'}
                  </Text>
                  .
                </Text>
                {inviteMeta?.role ? (
                  <Text className="mt-1 text-center text-xs text-muted-foreground">
                    Role: <Text className="font-semibold text-foreground">{inviteMeta.role}</Text>
                    {inviteMeta.unit || inviteMeta.villa ? (
                      <>
                        {' '}
                        • Unit:{' '}
                        <Text className="font-semibold text-foreground">
                          {inviteMeta.unit || inviteMeta.villa}
                        </Text>
                      </>
                    ) : null}
                  </Text>
                ) : null}
                <Text className="mt-1 px-2 text-center text-xs text-muted-foreground">
                  Accepting will add this community to your available workspaces and switch your
                  active workspace immediately.
                </Text>
              </View>

              {apiError ? <ErrorBanner message={apiError} /> : null}

              {apiError &&
              (apiError.toLowerCase().includes('identity') ||
                apiError.toLowerCase().includes('match')) ? (
                <Button
                  onPress={handleSignOutAndSwitch}
                  loading={submitting}
                  variant="outline"
                  className="mt-1 h-11 w-full items-center justify-center rounded-xl border-primary/40"
                  textClassName="font-semibold text-sm text-primary">
                  Sign Out to Switch Accounts
                </Button>
              ) : null}

              <View className="mt-2 w-full flex-col gap-2.5">
                <Button
                  onPress={handleAcceptAuthenticatedInvite}
                  loading={submitting}
                  disabled={isRejecting}
                  className="h-12 w-full items-center justify-center rounded-xl bg-primary"
                  textClassName="font-bold text-base">
                  Accept & Switch Workspace
                </Button>
                <Button
                  onPress={handleRejectInvitation}
                  loading={isRejecting}
                  disabled={submitting}
                  variant="outline"
                  className="h-11 w-full items-center justify-center rounded-xl border-red-500/30"
                  textClassName="font-semibold text-sm text-red-600">
                  Reject Invitation
                </Button>
              </View>
            </View>
          ) : null}

          {/* CASE 1C: Unauthenticated User - Account Already Registered / Active State */}
          {!isResolvingInvite && !isRejectedState && !isAuthenticated && isAlreadyRegistered ? (
            <View className="shadow-xs items-center gap-4 rounded-2xl border border-border bg-card p-6">
              <View className="items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 p-4">
                <CheckCircle2 size={38} className="text-emerald-600 dark:text-emerald-400" />
              </View>
              <View className="items-center gap-1.5">
                <Text className="text-center text-xl font-extrabold text-foreground">
                  Account Already Active
                </Text>
                <Text className="px-2 text-center text-sm text-muted-foreground">
                  {alreadyRegisteredEmail
                    ? `Your account for ${alreadyRegisteredEmail} has already been registered and your password is configured.`
                    : 'Your account has already been registered and your password is configured.'}
                </Text>
                <Text className="mt-1 text-center text-xs text-muted-foreground">
                  Please sign in with your email and password to enter your workspace.
                </Text>
              </View>
              <Button
                onPress={() => handleNavigateToLogin(alreadyRegisteredEmail)}
                className="mt-3 h-12 w-full items-center justify-center rounded-xl bg-primary"
                textClassName="font-bold text-base">
                Sign In to Workspace
              </Button>
            </View>
          ) : null}

          {/* CASE 2: Invalid or Expired Token State */}
          {!isResolvingInvite &&
          !isRejectedState &&
          !isAlreadyRegistered &&
          isInvalidTokenModalVisible &&
          apiError ? (
            <View className="shadow-xs items-center gap-4 rounded-2xl border border-border bg-card p-6">
              <View className="items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 p-4">
                <AlertCircle size={38} className="text-amber-600 dark:text-amber-400" />
              </View>
              <View className="items-center gap-1.5">
                <Text className="text-center text-xl font-extrabold text-foreground">
                  Invitation Expired or Used
                </Text>
                <Text className="px-2 text-center text-sm text-muted-foreground">{apiError}</Text>
                <Text className="mt-1 text-center text-xs text-muted-foreground">
                  If you already set your password, you can sign in directly to your account.
                </Text>
              </View>
              <Button
                onPress={() => handleNavigateToLogin()}
                className="mt-3 h-12 w-full items-center justify-center rounded-xl bg-primary"
                textClassName="font-bold text-base">
                Go to Sign In
              </Button>
            </View>
          ) : null}

          {/* CASE 3: Normal Form Container (Unauthenticated, Token valid, not yet registered, not rejected) */}
          {!isResolvingInvite &&
          !isRejectedState &&
          !isAuthenticated &&
          !isAlreadyRegistered &&
          (!isInvalidTokenModalVisible || !apiError) ? (
            <View className="shadow-xs gap-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
              <View className="gap-3.5">
                {inviteMeta ? (
                  <View className="mb-1 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <Text className="mb-1 font-bold text-xs text-primary">
                      Community: {inviteMeta.orgName || 'Nahom Community'}
                    </Text>
                    {(() => {
                      const unitValue = (inviteMeta.unit || inviteMeta.villa || '').trim();
                      const isInvalidUnit =
                        !unitValue ||
                        unitValue.toLowerCase() === 'none' ||
                        (inviteMeta.role &&
                          unitValue.toLowerCase() === inviteMeta.role.trim().toLowerCase());
                      if (isInvalidUnit) return null;
                      return (
                        <Text className="text-xs text-muted-foreground">
                          Unit: <Text className="font-semibold text-foreground">{unitValue}</Text>
                        </Text>
                      );
                    })()}
                    {inviteMeta.role ? (
                      <Text className="text-xs text-muted-foreground">
                        Role:{' '}
                        <Text className="font-semibold text-foreground">{inviteMeta.role}</Text>
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Password Form (Wrapped in form on Web to satisfy browser password managers) */}
                {Platform.OS === 'web' ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveAndConfirm();
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
                    {/* New Password Field */}
                    <Controller
                      control={form.control}
                      name="password"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <View>
                          <Input
                            label="New Password"
                            placeholder="••••••••"
                            isPassword
                            leftIcon={<Lock size={18} className="me-1 text-muted-foreground" />}
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

                    {/* Confirm Password Field */}
                    <Controller
                      control={form.control}
                      name="confirmPassword"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          label="Confirm New Password"
                          placeholder="••••••••"
                          isPassword
                          leftIcon={<Lock size={18} className="me-1 text-muted-foreground" />}
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value}
                          autoCapitalize="none"
                          autoComplete="new-password"
                          error={form.formState.errors.confirmPassword?.message}
                        />
                      )}
                    />
                  </form>
                ) : (
                  <>
                    {/* New Password Field */}
                    <Controller
                      control={form.control}
                      name="password"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <View>
                          <Input
                            label="New Password"
                            placeholder="••••••••"
                            isPassword
                            leftIcon={<Lock size={18} className="me-1 text-muted-foreground" />}
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

                    {/* Confirm Password Field */}
                    <Controller
                      control={form.control}
                      name="confirmPassword"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          label="Confirm New Password"
                          placeholder="••••••••"
                          isPassword
                          leftIcon={<Lock size={18} className="me-1 text-muted-foreground" />}
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value}
                          autoCapitalize="none"
                          autoComplete="new-password"
                          error={form.formState.errors.confirmPassword?.message}
                        />
                      )}
                    />
                  </>
                )}

                {/* Global Error Banner */}
                {apiError ? <ErrorBanner message={apiError} /> : null}

                {/* Accept & Reject Action Buttons */}
                <View className="mt-2 flex-col gap-2 sm:flex-row">
                  <Button
                    onPress={handleSaveAndConfirm}
                    loading={submitting}
                    disabled={isRejecting}
                    textClassName="font-bold text-base text-white"
                    className="h-12 flex-1 items-center justify-center rounded-xl bg-emerald-600">
                    Accept Invitation
                  </Button>
                  <Button
                    onPress={handleRejectInvitation}
                    loading={isRejecting}
                    disabled={submitting}
                    variant="outline"
                    className="h-12 items-center justify-center rounded-xl border-red-500/30 px-4"
                    textClassName="font-semibold text-sm text-red-600">
                    Reject
                  </Button>
                </View>
              </View>

              {/* SSO Separator */}
              <View className="my-2 flex-row items-center">
                <View className="h-px flex-1 bg-border" />
                <Text className="px-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                  OR ACCEPT WITH SSO
                </Text>
                <View className="h-px flex-1 bg-border" />
              </View>

              {/* SSO Buttons */}
              <View className="flex-col gap-2.5 sm:flex-row sm:gap-3">
                <View className="flex-1">
                  <GoogleSignInButton
                    inviteToken={currentInviteToken}
                    onSuccess={handleSsoSuccess}
                    onError={handleSsoError}
                  />
                </View>
                <View className="flex-1">
                  <AppleSignInButton
                    inviteToken={currentInviteToken}
                    onSuccess={handleSsoSuccess}
                    onError={handleSsoError}
                  />
                </View>
              </View>

              {/* Return to Login Link */}
              <View className="mt-2 items-center">
                <Button variant="link" onPress={() => router.push({ pathname: '/(auth)/login' })}>
                  <Text className="font-medium text-sm text-primary">
                    Already have an active account? Sign In
                  </Text>
                </Button>
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingShell>

      {/* MODAL 1: Account Already Registered Notification Popup */}
      <ConfirmationModal
        visible={isAlreadyRegisteredModalVisible}
        title="Already Registered"
        message="Your account is already active and your password has been set. Please sign in to access your workspace."
        confirmLabel="Sign In"
        cancelLabel="Dismiss"
        variant="info"
        onConfirm={() => {
          setIsAlreadyRegisteredModalVisible(false);
          handleNavigateToLogin(alreadyRegisteredEmail);
        }}
        onCancel={() => setIsAlreadyRegisteredModalVisible(false)}
      />

      {/* MODAL 2: Invalid or Expired Token Popup */}
      <ConfirmationModal
        visible={isInvalidTokenModalVisible && !isAlreadyRegistered}
        title="Invitation Link Expired"
        message="This invitation link is invalid or has already been used. If you have already set up your password, please sign in."
        confirmLabel="Go to Sign In"
        cancelLabel="Dismiss"
        variant="warning"
        onConfirm={() => {
          setIsInvalidTokenModalVisible(false);
          handleNavigateToLogin();
        }}
        onCancel={() => setIsInvalidTokenModalVisible(false)}
      />
    </>
  );
}
