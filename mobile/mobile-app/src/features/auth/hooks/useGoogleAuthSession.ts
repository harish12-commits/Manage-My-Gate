import '../../../utils/cryptoPolyfill';
import * as React from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from './useAuth';
import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const DEFAULT_GOOGLE_CLIENT_ID = '610778456829-edvpd6gcav2u31jo0p2aeligfopvqfbo.apps.googleusercontent.com';
const DEFAULT_GOOGLE_ANDROID_CLIENT_ID = '610778456829-6g1bvqtplfrgva93sbdsvgbuqmkpr203.apps.googleusercontent.com';
const DEFAULT_GOOGLE_IOS_CLIENT_ID = '512495714957-ppgtahfr70hmjclhmq7n3c7822aacd41.apps.googleusercontent.com';

export function useGoogleAuthSession() {
  const { loginWithGoogle } = useAuth();
  const [authInProgress, setAuthInProgress] = React.useState(false);
  const processedRef = React.useRef<Set<string>>(new Set());

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || DEFAULT_GOOGLE_ANDROID_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || DEFAULT_GOOGLE_IOS_CLIENT_ID;

  const iosRedirectUri = `com.googleusercontent.apps.${iosClientId.split('.apps')[0]}:/oauthredirect`;
  const redirectUri = Platform.select({
    ios: iosRedirectUri,
    default: AuthSession.makeRedirectUri({
      native: 'com.atominosconsulting.nahom:/oauthredirect',
    }),
  });

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleClientId,
    webClientId: googleClientId,
    iosClientId,
    androidClientId,
    redirectUri,
  });

  const activeClientId = Platform.select({
    ios: iosClientId,
    android: androidClientId,
    default: googleClientId,
  });

  const handleAuthPayload = React.useCallback(
    async (payload: any) => {
      setAuthInProgress(true);
      try {
        const res: any = await loginWithGoogle(payload);
        if (res?.meta?.requestStatus === 'rejected' || res?.error) {
          let errMsg = res?.payload || res?.error?.message || 'Google sign in failed';
          try {
            if (typeof errMsg === 'string') {
              const parsed = JSON.parse(errMsg);
              if (parsed && parsed.message) errMsg = parsed.message;
            } else if (errMsg?.message) {
              errMsg = errMsg.message;
            }
          } catch (e) {}
          Alert.alert('Google Sign-In Failed', typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
          return;
        }
        if (res?.payload?.isNewUser) {
          const googleData = res.payload.googleData || {};
          router.push({
            pathname: '/(auth)/register',
            params: {
              email: googleData.email || '',
              name: googleData.name || '',
              isGoogleSso: 'true',
            },
          });
        }
      } catch (err: any) {
        console.error('[GoogleSignIn] Backend login error:', err);
        Alert.alert(
          'Google Sign-In Failed',
          typeof err === 'string' ? err : err?.message || 'Login failed'
        );
      } finally {
        setAuthInProgress(false);
      }
    },
    [loginWithGoogle]
  );

  const processAuthResult = React.useCallback(
    async (authResult: AuthSession.AuthSessionResult | null) => {
      if (!authResult || authResult.type !== 'success') {
        if (authResult?.type === 'error') {
          console.error('[GoogleSignIn] Auth Session Error:', authResult.error);
          Alert.alert(
            'Google Sign-In Error',
            authResult.error?.message || 'Authentication session failed.'
          );
        }
        return;
      }

      // 1. Check for directly available ID token
      const idToken = authResult.params?.id_token || (authResult as any).authentication?.idToken;
      if (idToken) {
        if (processedRef.current.has(idToken)) return;
        processedRef.current.add(idToken);
        await handleAuthPayload({ token: idToken });
        return;
      }

      // 2. Handle Authorization Code from Native Android/iOS
      const code = authResult.params?.code;
      if (code) {
        if (processedRef.current.has(code)) return;
        processedRef.current.add(code);

        setAuthInProgress(true);

        // Attempt client-side code exchange via PKCE
        let resolvedIdToken: string | null = null;
        if (request?.codeVerifier) {
          try {
            const tokenResponse = await AuthSession.exchangeCodeAsync(
              {
                clientId: activeClientId,
                code,
                redirectUri: request.redirectUri,
                extraParams: {
                  code_verifier: request.codeVerifier,
                },
              },
              {
                tokenEndpoint: 'https://oauth2.googleapis.com/token',
              }
            );
            if (tokenResponse?.idToken) {
              resolvedIdToken = tokenResponse.idToken;
            }
          } catch (exchangeErr: any) {
            console.warn('[GoogleSignIn] Client code exchange failed, falling back to server exchange:', exchangeErr?.message);
          }
        }

        if (resolvedIdToken) {
          await handleAuthPayload({ token: resolvedIdToken });
        } else {
          // Fallback to server-side code exchange
          await handleAuthPayload({
            code,
            codeVerifier: request?.codeVerifier,
            redirectUri: request?.redirectUri,
            clientId: activeClientId,
          });
        }
      }
    },
    [request, activeClientId, handleAuthPayload]
  );

  React.useEffect(() => {
    if (response) {
      processAuthResult(response);
    }
  }, [response, processAuthResult]);

  const handleGoogleSignIn = React.useCallback(async () => {
    try {
      if (!request) {
        Alert.alert(
          'Google Sign-In',
          'Google Sign-In is initializing. Please try again in a moment.'
        );
        return;
      }
      const result = await promptAsync();
      if (result) {
        await processAuthResult(result);
      }
    } catch (err: any) {
      console.error('[GoogleSignIn] Prompt error:', err);
      Alert.alert('Google Sign-In Error', err?.message || 'Could not start Google Sign-In.');
    }
  }, [request, promptAsync, processAuthResult]);

  return {
    handleGoogleSignIn,
    // `auth.loading` represents every authentication request (including a
    // password or OTP submission). Restrict the social control to its own
    // in-flight flow so a password sign-in cannot turn this into a spinner.
    loading: authInProgress,
    disabled: !request || authInProgress,
  };
}

export default useGoogleAuthSession;
