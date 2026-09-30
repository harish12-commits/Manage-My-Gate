import * as React from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform, View } from 'react-native';
import { SocialAuthButton } from '@/components/auth/SocialAuthButton';
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

  // If glass variant requested or on non-iOS/unavailable, render the custom glass button
  if (variant === 'glass' || Platform.OS !== 'ios' || !isAvailable) {
    return (
      <SocialAuthButton
        provider="apple"
        variant={variant}
        onPress={handleAppleSignIn}
        loading={loading}
        disabled={disabled || loading}
        className={className}
      />
    );
  }

  return (
    <View
      pointerEvents={disabled ? 'none' : 'auto'}
      style={style}
      className={`h-12 flex-1 overflow-hidden rounded-xl ${disabled ? 'opacity-60' : ''} ${className}`}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
        cornerRadius={12}
        style={{ width: '100%', height: 48, opacity: loading ? 0.6 : 1 }}
        onPress={() => {
          if (!disabled) void handleAppleSignIn();
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
