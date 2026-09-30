import * as React from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Button } from '@/components/ui/button';
import { Text, Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { router } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

// Microsoft Entra ID Discovery
const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`,
};

export interface MicrosoftSignInButtonProps {
  inviteToken?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export function MicrosoftSignInButton({ inviteToken, onSuccess, onError }: MicrosoftSignInButtonProps = {}) {
  const { loginWithMicrosoft, acceptSsoInvite } = useAuth();
  const [submitting, setSubmitting] = React.useState(false);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'managemygate',
    path: 'auth-spa'
  });
  
  React.useEffect(() => {
    console.log('[MicrosoftSignIn] Redirect URI:', redirectUri);
  }, [redirectUri]);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || 'your-client-id',
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri: redirectUri,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery
  );

  React.useEffect(() => {
    console.log("--- MICROSOFT AUTH RESPONSE ---", response);
    if (response?.type === 'success') {
      const { code } = response.params;
      if (code && request?.codeVerifier) {
        AuthSession.exchangeCodeAsync(
          {
            clientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || 'your-client-id',
            code,
            redirectUri: redirectUri,
            extraParams: {
              code_verifier: request.codeVerifier,
            },
          },
          discovery
        )
          .then((tokenResponse: any) => {
            const tokenToUse = tokenResponse.idToken || tokenResponse.accessToken;
            console.log("Extracted Token:", tokenToUse ? "Token Found!" : "No Token Found!");
            
            if (tokenToUse) {
              setSubmitting(true);
              if (inviteToken) {
                acceptSsoInvite({
                  inviteToken,
                  ssoCredential: tokenToUse,
                  provider: 'microsoft',
                })
                  .then((res: any) => {
                    if (res?.meta?.requestStatus === 'rejected' || res?.error) {
                      const errMsg = (res.payload as string) || res.error?.message || 'Failed to accept invitation via Microsoft';
                      if (onError) onError(errMsg);
                      else Alert.alert('Microsoft Sign-In Failed', errMsg);
                      return;
                    }
                    if (onSuccess) {
                      onSuccess(res?.payload || res);
                    } else {
                      router.replace('/(resident)/dashboard');
                    }
                  })
                  .catch((err: any) => {
                    console.error("Backend Error:", err);
                    const errMsg = err?.response?.data?.message || err?.message || 'Failed to accept invitation via Microsoft';
                    if (onError) onError(errMsg);
                    else Alert.alert('Microsoft Sign-In Failed', errMsg);
                  })
                  .finally(() => setSubmitting(false));
              } else {
                loginWithMicrosoft(tokenToUse)
                  .then((res: any) => {
                    if (res?.meta?.requestStatus === 'rejected' || res?.error) {
                      const errMsg = (res.payload as string) || res.error?.message || 'Microsoft login failed';
                      if (onError) onError(errMsg);
                      else Alert.alert('Microsoft Login Failed', errMsg);
                      return;
                    }
                    if (res?.payload?.isNewUser) {
                      const msData = res.payload.googleData || {};
                      router.navigate({
                        pathname: '/(auth)/register',
                        params: {
                          email: msData.email || '',
                          name: msData.name || '',
                          isMicrosoftSso: 'true',
                        },
                      });
                    } else {
                      if (onSuccess) {
                        onSuccess(res?.payload || res);
                      } else {
                        router.replace('/(resident)/dashboard');
                      }
                    }
                  })
                  .catch((err: any) => {
                    console.error("Backend Error:", err);
                    const errMsg = typeof err === 'string' ? err : (err.message || 'Unknown error occurred.');
                    if (onError) onError(errMsg);
                    else Alert.alert('Microsoft Login Failed', errMsg);
                  })
                  .finally(() => setSubmitting(false));
              }
            } else {
              console.warn("Token exchange succeeded but no token was returned:", tokenResponse);
            }
          })
          .catch((err: any) => {
            console.error("Token Exchange Error:", err);
            const errMsg = 'Failed to exchange authorization code for token.';
            if (onError) onError(errMsg);
            else Alert.alert('Microsoft Login Error', errMsg);
          });
      } else {
        console.warn("Login success but no code or codeVerifier was found:", response.params);
      }
    } else if (response?.type === 'error') {
      console.error("Auth Session Error:", response.error);
      const errMsg = response.error?.message || 'Authentication session failed.';
      if (onError) onError(errMsg);
      else Alert.alert('Microsoft Login Error', errMsg);
    }
  }, [response, request, inviteToken, acceptSsoInvite, loginWithMicrosoft, onSuccess, onError, redirectUri]);

  // Keep the loading indicator scoped to Microsoft. A separate authentication
  // request must not make this provider look active.
  const isLoading = submitting;

  return (
    <Button
      className="h-12 w-full rounded-xl flex-row items-center justify-center bg-[#2f2f2f] dark:bg-[#1f1f1f] border border-border px-3"
      onPress={() => promptAsync()}
      disabled={!request || isLoading}
      loading={isLoading}
    >
      <Text className="text-white text-base me-2 shrink-0">❖</Text>
      <Text className="text-white font-semibold text-sm">Microsoft</Text>
    </Button>
  );
}
