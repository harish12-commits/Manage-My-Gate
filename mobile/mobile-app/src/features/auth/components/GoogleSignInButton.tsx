import '../../../utils/cryptoPolyfill';
import * as React from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Button } from '@/components/ui/button';
import { Text, View, Alert, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../hooks/useAuth';
import { router } from 'expo-router';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const DEFAULT_GOOGLE_CLIENT_ID = '610778456829-edvpd6gcav2u31jo0p2aeligfopvqfbo.apps.googleusercontent.com';
const DEFAULT_GOOGLE_ANDROID_CLIENT_ID = '610778456829-6g1bvqtplfrgva93sbdsvgbuqmkpr203.apps.googleusercontent.com';
const DEFAULT_GOOGLE_IOS_CLIENT_ID = '512495714957-ppgtahfr70hmjclhmq7n3c7822aacd41.apps.googleusercontent.com';

export interface GoogleSignInButtonProps {
  inviteToken?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export function GoogleSignInButton({ inviteToken, onSuccess, onError }: GoogleSignInButtonProps = {}) {
  const { loginWithGoogle, acceptSsoInvite } = useAuth();
  const [submitting, setSubmitting] = React.useState(false);
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

  const handlePayload = React.useCallback(
    async (payload: any) => {
      setSubmitting(true);
      try {
        if (inviteToken) {
          const invitePayload = {
            inviteToken,
            provider: 'google' as const,
            ...(payload.token ? { ssoCredential: payload.token } : payload),
          };
          const res: any = await acceptSsoInvite(invitePayload);
          if (res?.meta?.requestStatus === 'rejected' || res?.error) {
            const errMsg = (res.payload as string) || res.error?.message || 'Failed to accept invitation via Google';
            if (onError) onError(errMsg);
            else Alert.alert('Google Sign-In Failed', errMsg);
            return;
          }
          if (onSuccess) {
            onSuccess(res?.payload || res);
          } else {
            router.replace('/(resident)/dashboard');
          }
        } else {
          const res: any = await loginWithGoogle(payload);
          if (res?.meta?.requestStatus === 'rejected' || res?.error) {
            const errMsg = (res.payload as string) || res.error?.message || 'Google sign in failed';
            if (onError) onError(errMsg);
            else Alert.alert('Google Sign-In Failed', errMsg);
            return;
          }
          if (res?.payload?.isNewUser) {
            const googleData = res.payload.googleData || {};
            router.navigate({
              pathname: '/(auth)/register',
              params: {
                email: googleData.email || '',
                name: googleData.name || '',
                isGoogleSso: 'true',
              },
            });
          } else {
            if (onSuccess) {
              onSuccess(res?.payload || res);
            } else {
              router.replace('/(resident)/dashboard');
            }
          }
        }
      } catch (err: any) {
        const errMsg = err?.response?.data?.message || err?.message || 'Failed to complete Google Sign-In';
        if (onError) onError(errMsg);
        else Alert.alert('Google Sign-In Failed', errMsg);
      } finally {
        setSubmitting(false);
      }
    },
    [inviteToken, acceptSsoInvite, loginWithGoogle, onSuccess, onError]
  );

  const processAuthResult = React.useCallback(
    async (authResult: AuthSession.AuthSessionResult | null) => {
      if (!authResult || authResult.type !== 'success') {
        if (authResult?.type === 'error') {
          console.error('[GoogleSignInButton] Auth Session Error:', authResult.error);
          const errMsg = authResult.error?.message || 'Google authentication failed';
          if (onError) onError(errMsg);
          else Alert.alert('Google Sign-In Error', errMsg);
        }
        return;
      }

      // 1. Check for directly available ID token
      const idToken = authResult.params?.id_token || (authResult as any).authentication?.idToken;
      if (idToken) {
        if (processedRef.current.has(idToken)) return;
        processedRef.current.add(idToken);
        await handlePayload({ token: idToken });
        return;
      }

      // 2. Handle Authorization Code from Native Android/iOS
      const code = authResult.params?.code;
      if (code) {
        if (processedRef.current.has(code)) return;
        processedRef.current.add(code);

        setSubmitting(true);

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
            console.warn('[GoogleSignInButton] Client code exchange failed, falling back to server exchange:', exchangeErr?.message);
          }
        }

        if (resolvedIdToken) {
          await handlePayload({ token: resolvedIdToken });
        } else {
          await handlePayload({
            code,
            codeVerifier: request?.codeVerifier,
            redirectUri: request?.redirectUri,
            clientId: activeClientId,
          });
        }
      }
    },
    [request, activeClientId, handlePayload, onError]
  );

  React.useEffect(() => {
    if (response) {
      processAuthResult(response);
    }
  }, [response, processAuthResult]);

  const handlePress = React.useCallback(async () => {
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
      console.error('[GoogleSignInButton] Prompt error:', err);
      const errMsg = err?.message || 'Could not start Google Sign-In.';
      if (onError) onError(errMsg);
      else Alert.alert('Google Sign-In Error', errMsg);
    }
  }, [request, promptAsync, processAuthResult, onError]);

  // The shared auth loading flag also covers password, OTP, and registration
  // requests. This control should only indicate work started by Google SSO.
  const isLoading = submitting;

  return (
    <Button
      variant="outline"
      className="h-12 w-full rounded-xl flex-row items-center justify-center bg-card border border-border px-3"
      onPress={handlePress}
      disabled={!request || isLoading}
      loading={isLoading}
    >
      <View className="me-2 shrink-0">
        <Svg width="18" height="18" viewBox="0 0 48 48">
          <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          <Path fill="none" d="M0 0h48v48H0z"/>
        </Svg>
      </View>
      <Text className="text-foreground font-semibold text-sm">Google</Text>
    </Button>
  );
}

export default GoogleSignInButton;
