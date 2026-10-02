import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { KeyboardAvoidingShell } from '@/components/layout/KeyboardAvoidingShell';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { sessionStore } from '@/src/utils/storage';
import { useTranslation } from '@/src/utils/i18n';
import { CreateOrganizationForm } from '../components/CreateOrganizationForm';

export interface CreateOrganizationScreenProps {
  onSuccess?: (createdOrg: any) => void;
  showCancel?: boolean;
}

export const CreateOrganizationScreen: React.FC<CreateOrganizationScreenProps> = ({
  onSuccess,
  showCancel = false,
}) => {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();
  const { t } = useTranslation();

  const handleSignInRedirect = async () => {
    if (isAuthenticated) {
      try {
        await logout();
      } catch (e) {}
    }
    sessionStore.setItem('mobile_auth_intent', 'create-org');
    router.navigate({ pathname: '/(auth)/login', params: { intent: 'create-org' } });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('create_community', 'Create Community'),
          headerBackVisible: showCancel,
        }}
      />
      <KeyboardAvoidingShell 
        className="bg-background"
        scrollViewProps={{
          contentContainerStyle: {
            paddingHorizontal: 16,
            paddingVertical: 24,
            flexGrow: 1,
            
          },
          keyboardShouldPersistTaps: 'handled'
        }}
      >
          <View className="gap-5 flex-1 max-w-sm sm:max-w-md mx-auto w-full py-2 sm:py-4 mt-6">
            {/* Header / Hero Brand Section */}
            <View className="items-center mb-1">
              <View className="bg-primary/10 p-3.5 rounded-2xl mb-2.5 items-center justify-center">
                <Building2 className="size-9 text-primary" size={34} color="#03A9F4" />
              </View>
              <Text className="text-2xl font-extrabold text-foreground tracking-tight text-center">
                {t('create_community', 'Create Community')}
              </Text>
              <Text className="text-muted-foreground text-sm text-center mt-1 px-2">
                {t('create_community_subtitle', 'Establish your community or enterprise workspace environment')}
              </Text>
            </View>

            {/* Modular Form Canvas */}
            <CreateOrganizationForm
              options={{ onSuccess }}
              showCancelButton={showCancel}
              onCancel={() => router.back()}
            />

            {/* Sign In Alternate Link */}
            <View className="flex-row items-center justify-center pt-2">
              <Text className="text-xs text-muted-foreground font-medium">
                {t('already_have_account', 'Already have an account?')}{' '}
              </Text>
              <TouchableOpacity onPress={handleSignInRedirect} activeOpacity={0.8}>
                <Text className="text-xs font-bold text-primary underline">
                  {t('sign_in', 'Sign In')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingShell>
    </>
  );
};

export default CreateOrganizationScreen;
