import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  KeyboardAvoidingViewProps,
  ScrollViewProps,
  View,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { cn } from '../../lib/utils';

export interface KeyboardAvoidingShellProps extends KeyboardAvoidingViewProps {
  children: React.ReactNode;
  scrollable?: boolean;
  scrollViewProps?: ScrollViewProps;
  contentContainerClassName?: string;
}

export const KeyboardAvoidingShell = ({
  children,
  scrollable = true,
  scrollViewProps,
  className,
  contentContainerClassName,
  ...props
}: KeyboardAvoidingShellProps) => {
  // Android is configured with adjustResize. iOS needs an explicit padding
  // response so the focused field and submit action remain above the keyboard.
  const defaultBehavior = Platform.OS === 'ios' ? 'padding' : 'height';
  const activeBehavior = props.behavior ?? defaultBehavior;

  const content = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      {...scrollViewProps}
      contentContainerStyle={[
        { flexGrow: 1, paddingBottom: 96 },
        scrollViewProps?.contentContainerStyle,
      ]}
      className={contentContainerClassName}
    >
      {children}
    </ScrollView>
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
