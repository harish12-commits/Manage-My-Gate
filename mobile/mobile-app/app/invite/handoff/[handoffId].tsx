import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { AlertCircle, CheckCircle2, Smartphone } from 'lucide-react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Text } from '@/components/ui/text';
import authService from '../../../src/features/auth/services/authService';
import { updateTokenAndUser } from '../../../src/features/auth/store/authSlice';
import storage from '../../../src/utils/storage';
import { AppLoader } from '@/components/ui/AppLoader';

export default function MobileHandoffScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { handoffId } = useLocalSearchParams<{ handoffId: string }>();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    async function performHandoff() {
      if (!handoffId || typeof handoffId !== 'string' || handoffId.trim().length === 0) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Invalid or missing mobile handoff identifier.');
        }
        return;
      }

      try {
        const response: any = await authService.exchangeHandoff(handoffId.trim());
        const body = response && response.success !== undefined ? response : response?.data;
        const innerData = body?.data || body;

        const token = innerData?.token;
        const refreshToken = innerData?.refreshToken;
        const rawUser = innerData?.user;
        const availableWorkspaces =
          innerData?.availableWorkspaces || rawUser?.availableWorkspaces || [];
        const user = rawUser ? { ...rawUser, availableWorkspaces } : null;

        if (token && user) {
          await storage.setItem('token', token);
          if (refreshToken) await storage.setItem('refreshToken', refreshToken);
          await storage.setItem('user', JSON.stringify(user));

          dispatch(updateTokenAndUser({ token, refreshToken, user }));

          if (isMounted) {
            setStatus('success');
            router.replace('/(resident)/dashboard');
          }
        } else {
          throw new Error('Invalid handoff response from server.');
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          const msg =
            err.response?.data?.message || err.message || 'Mobile handoff failed or has expired.';
          setErrorMessage(msg);
        }
      }
    }

    performHandoff();

    return () => {
      isMounted = false;
    };
  }, [handoffId, dispatch, router]);

  return (
    <ScreenShell title="Workspace Handoff" showBackButton={false}>
      <View className="flex-1 items-center justify-center p-6">
        {status === 'loading' && (
          <View className="items-center justify-center py-12">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-primary/10">
              <Smartphone size={32} className="text-primary" />
            </View>
            <AppLoader variant="block" />
            <Text className="mb-1 text-center font-bold font-sans text-lg text-foreground">
              Connecting Your Session
            </Text>
            <Text className="max-w-xs text-center font-sans text-sm text-muted-foreground">
              Securely syncing your accepted workspace invitation to this device...
            </Text>
          </View>
        )}

        {status === 'success' && (
          <View className="items-center justify-center py-12">
            <View className="bg-success/10 mb-4 h-16 w-16 items-center justify-center rounded-3xl">
              <CheckCircle2 size={32} className="text-success" />
            </View>
            <Text className="mb-1 text-center font-bold font-sans text-lg text-foreground">
              Welcome to Nahom!
            </Text>
            <Text className="max-w-xs text-center font-sans text-sm text-muted-foreground">
              Handoff complete. Opening your community dashboard...
            </Text>
          </View>
        )}

        {status === 'error' && (
          <EmptyState
            icon={AlertCircle}
            title="Handoff Link Expired or Invalid"
            description={
              errorMessage ||
              'This mobile handoff link has already been used or has expired. Please sign in or initiate a new handoff from your browser.'
            }
            actionLabel="Go to Sign In"
            onAction={() => router.replace('/(auth)/login')}
          />
        )}
      </View>
    </ScreenShell>
  );
}
