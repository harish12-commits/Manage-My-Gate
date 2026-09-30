import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  Keyboard,
  Platform,
  TextInput,
  findNodeHandle,
  UIManager,
  NativeModules,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import { useKeyboard } from './useKeyboard';

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
  extraScrollHeight?: number;
  enableAutoScroll?: boolean;
}

export const KeyboardAwareScrollView = forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  (
    {
      children,
      extraScrollHeight = 40,
      enableAutoScroll = true,
      contentContainerStyle,
      keyboardShouldPersistTaps = 'handled',
      keyboardDismissMode = 'on-drag',
      showsVerticalScrollIndicator = false,
      ...props
    },
    ref
  ) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const containerRef = useRef<View>(null);
    const { keyboardShown, keyboardHeight } = useKeyboard();

    useImperativeHandle(ref, () => scrollViewRef.current as ScrollView);

    // Native scroll behaviors are relied upon instead of manual scrolling.

    // Manual scrolling is disabled on iOS and Android.
    // - iOS: Natively handled by automaticallyAdjustKeyboardInsets={true}.
    // - Android: Natively handled by softwareKeyboardLayoutMode="resize" in app.json.
    // - Web: Handled by the browser.

    const scrollView = (
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        automaticallyAdjustKeyboardInsets={false}
        contentContainerStyle={[
          { flexGrow: 1 },
          contentContainerStyle,
          { paddingBottom: dynamicBottomPadding },
        ]}
        {...props}
      >
        <View ref={containerRef} style={{ flexGrow: 1 }}>
          {children}
        </View>
      </ScrollView>
    );

    if (Platform.OS === 'ios') {
      return (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          {scrollView}
        </KeyboardAvoidingView>
      );
    }

    return scrollView;
  }
);

KeyboardAwareScrollView.displayName = 'KeyboardAwareScrollView';
export default KeyboardAwareScrollView;
