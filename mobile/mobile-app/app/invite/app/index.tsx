import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';

export default function AppInviteIndexRedirectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();

  useEffect(() => {
    const inviteToken = params.token;
    if (inviteToken) {
      router.replace({
        pathname: '/(auth)/accept-invite',
        params: { ...params, token: inviteToken },
      });
    } else {
      router.replace({
        pathname: '/(auth)/accept-invite',
        params: params,
      });
    }
  }, [params, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8EF' }}>
      <AppLoader variant="block" />
    </View>
  );
}
