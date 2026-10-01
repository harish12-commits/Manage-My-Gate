import * as React from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from './useAuth';

export interface UseAppleAuthSessionOptions {
  inviteToken?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

const createNonce = () => {
  try {
    return Crypto.randomUUID();
  } catch {
    // This fallback is only reached in unsupported test runtimes. iOS devices
    // use Expo Crypto's native CSPRNG-backed UUID implementation above.
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

const formatFullName = (fullName: AppleAuthentication.AppleAuthenticationFullName | null) =>
  [fullName?.namePrefix, fullName?.givenName, fullName?.middleName, fullName?.familyName, fullName?.nameSuffix]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .trim();

/** Native Sign in with Apple flow for iOS, with an unsupported-platform notice. */
export function useAppleAuthSession(options: UseAppleAuthSessionOptions = {}) {
  const { inviteToken, onSuccess, onError } = options;
  const { loginWithApple, acceptSsoInvite } = useAuth();
  const [isAvailable, setIsAvailable] = React.useState(false);
  const [authInProgress, setAuthInProgress] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    if (Platform.OS !== 'ios') {
      setIsAvailable(false);
      return () => {
        mounted = false;
      };
    }

    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) setIsAvailable(available);
      })
      .catch(() => {
        if (mounted) setIsAvailable(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const reportError = React.useCallback(
    (message: string) => {
      if (onError) onError(message);
      else Alert.alert('Apple Sign-In Failed', message);
    },
    [onError]
  );

  const handleAppleSignIn = React.useCallback(async () => {
    if (Platform.OS !== 'ios') {
      const message = Platform.OS === 'android'
        ? 'Sorry, Android users cannot use Sign in with Apple. Please sign in using Google, email, or phone OTP.'
        : 'Sign in with Apple is available in the iOS app. Please sign in using Google, email, or phone OTP here.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Sign in with Apple', message, [{ text: 'OK' }]);
      }
      return;
    }

    if (!isAvailable) {
      reportError('Sign in with Apple is unavailable on this device. Please use a supported iPhone or iPad, or another sign-in method.');
      return;
    }

    setAuthInProgress(true);
    try {
      const nonce = createNonce();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return a valid identity token. Please try again.');
      }

      const fullName = formatFullName(credential.fullName);
      const payload = {
        token: credential.identityToken,
        nonce,
        ...(fullName ? { fullName } : {}),
      };

      const result: any = inviteToken
        ? await acceptSsoInvite({
            inviteToken,
            ssoCredential: credential.identityToken,
            nonce,
            ...(fullName ? { fullName } : {}),
            provider: 'apple',
          })
        : await loginWithApple(payload);

      if (result?.meta?.requestStatus === 'rejected' || result?.error) {
        reportError((result?.payload as string) || result?.error?.message || 'Apple sign-in could not be completed.');
        return;
      }

      const resultPayload = result?.payload || result;
      if (resultPayload?.isNewUser) {
        const appleData = resultPayload.appleData || {};
        router.push({
          pathname: '/(auth)/register',
          params: {
            email: appleData.email || '',
            name: appleData.name || '',
            isAppleSso: 'true',
          },
        });
        return;
      }

      if (onSuccess) onSuccess(resultPayload);
      else router.replace('/(resident)/dashboard');
    } catch (error: any) {
      // Dismissing Apple's system sheet is an expected user action, not an error.
      if (error?.code === 'ERR_REQUEST_CANCELED') return;
      reportError(error?.message || 'Apple sign-in could not be started.');
    } finally {
      setAuthInProgress(false);
    }
  }, [acceptSsoInvite, inviteToken, isAvailable, loginWithApple, onSuccess, reportError]);

  return {
    handleAppleSignIn,
    // Do not couple this button to the shared auth loading flag. That flag is
    // also set by email/password and OTP requests, which must not make Apple
    // look as though it is signing in.
    loading: authInProgress,
    isAvailable,
    disabled: !isAvailable || authInProgress,
  };
}

export default useAppleAuthSession;
