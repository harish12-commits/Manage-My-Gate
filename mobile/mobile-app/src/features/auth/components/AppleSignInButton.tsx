import * as React from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform, View } from 'react-native';
import { useAppleAuthSession } from '../hooks/useAppleAuthSession';
import { AppLoader } from '@/components/ui/AppLoader';

export interface AppleSignInButtonProps {
  inviteToken?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  variant?: 'full' | 'compact' | 'glass';
  className?: string;
  style?: any;
}

export function AppleSignInButton(props: AppleSignInButtonProps = {}) {
  const { disabled = false, variant = 'glass', className = '', style, ...authOptions } = props;
  const { handleAppleSignIn, loading, isAvailable } = useAppleAuthSession(authOptions);
  const buttonHeight = variant === 'compact' ? 44 : 50;
  const isDisabled = disabled || loading;

  // expo-apple-authentication is a native iOS API. Keep Apple Sign-In out of
  // Android/web UI and render only after the device confirms availability.
  if (Platform.OS !== 'ios' || !isAvailable) return null;

  return (
    <View
      pointerEvents={isDisabled ? 'none' : 'auto'}
      style={[{ height: buttonHeight }, style]}
      className={`w-full flex-1 overflow-hidden rounded-xl ${isDisabled ? 'opacity-60' : ''} ${className}`}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
        cornerRadius={12}
        style={{ width: '100%', height: buttonHeight, opacity: loading ? 0.6 : 1 }}
        onPress={() => {
          if (!isDisabled) void handleAppleSignIn();
        }}
      />
      {loading ? (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <AppLoader variant="inline" />
        </View>
      ) : null}
    </View>
  );
}

export default AppleSignInButton;
