import * as React from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { AppleIcon } from '@/components/auth/SocialAuthButton';
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
  const buttonHeight = variant === 'compact' ? 44 : 48;
  const isDisabled = disabled || loading;

  // Keep the entry point visible on every platform. Only supported iOS
  // devices render Apple's native control; other devices receive a notice.
  if (Platform.OS !== 'ios' || !isAvailable) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Sign in with Apple"
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={() => void handleAppleSignIn()}
        style={[{ height: buttonHeight, backgroundColor: '#FFFFFF', borderColor: '#000000', borderWidth: 1 }, style]}
        className={`flex-1 flex-row items-center justify-center gap-2 rounded-full px-2 ${isDisabled ? 'opacity-60' : ''} ${className}`}
      >
        <AppleIcon size={19} color="#000000" />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{ color: '#000000', flexShrink: 1, lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center' }}
          className="text-sm font-semibold text-center"
        >
          Sign in with Apple
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      pointerEvents={isDisabled ? 'none' : 'auto'}
      style={[{ height: buttonHeight }, style]}
      className={`w-full flex-1 overflow-hidden rounded-full ${isDisabled ? 'opacity-60' : ''} ${className}`}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
        cornerRadius={buttonHeight / 2}
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
