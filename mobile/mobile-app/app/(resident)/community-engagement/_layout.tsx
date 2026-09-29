import React from 'react';
import { Stack } from 'expo-router';
import { premiumScreenTransition } from '@/src/utils/screenTransitions';

export default function CommunityEngagementLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...premiumScreenTransition }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="ledger" />
      <Stack.Screen name="create" />
      <Stack.Screen name="edit" />
    </Stack>
  );
}
