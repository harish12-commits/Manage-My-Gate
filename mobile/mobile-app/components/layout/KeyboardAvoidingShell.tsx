import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  KeyboardAvoidingViewProps,
  ScrollViewProps,
  View,
} from 'react-native';
import { cn } from '../../lib/utils';
import { KeyboardAwareScrollView } from './KeyboardAwareScrollView';

export interface KeyboardAvoidingShellProps extends KeyboardAvoidingViewProps {
  children: React.ReactNode;
  scrollable?: boolean;
  scrollViewProps?: ScrollViewProps;
  contentContainerClassName?: string;
  extraScrollHeight?: number;
}

export const KeyboardAvoidingShell = ({
  children,
  scrollable = true,
  scrollViewProps,
  className,
  contentContainerClassName,
  extraScrollHeight = 40,
  ...props
}: KeyboardAvoidingShellProps) => {
  // Android is configured with adjustResize. iOS needs an explicit padding
  // response so the focused field and submit action remain above the keyboard.
  const defaultBehavior = Platform.OS === 'ios' ? 'padding' : undefined;
  const activeBehavior = props.behavior ?? defaultBehavior;

  const content = scrollable ? (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
      extraScrollHeight={extraScrollHeight}
      {...scrollViewProps}
      contentContainerStyle={[
        { flexGrow: 1, paddingBottom: 96 },
        scrollViewProps?.contentContainerStyle,
      ]}
      className={contentContainerClassName}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View className={cn('flex-1', contentContainerClassName)}>
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={activeBehavior}
      keyboardVerticalOffset={props.keyboardVerticalOffset ?? 0}
      className={cn('flex-1 bg-background', className)}
      {...props}
    >
      {content}
    </KeyboardAvoidingView>
  );
};

export default KeyboardAvoidingShell;
