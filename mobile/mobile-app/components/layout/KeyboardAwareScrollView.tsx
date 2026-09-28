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

    // Scroll focused input into view
    const scrollFocusedInputIntoView = () => {
      if (!enableAutoScroll || !scrollViewRef.current) return;

      // On Web, findNodeHandle and UIManager.measureLayout are unsupported and throw errors
      if (Platform.OS === 'web') {
        const currentlyFocusedInput = TextInput.State.currentlyFocusedInput
          ? TextInput.State.currentlyFocusedInput()
          : (TextInput as any).State?.currentlyFocusedField
          ? (TextInput as any).State.currentlyFocusedField()
          : null;

        if (currentlyFocusedInput && typeof (currentlyFocusedInput as any).scrollIntoView === 'function') {
          (currentlyFocusedInput as any).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        return;
      }

      const currentlyFocusedInput = TextInput.State.currentlyFocusedInput
        ? TextInput.State.currentlyFocusedInput()
        : (TextInput as any).State?.currentlyFocusedField
        ? (TextInput as any).State.currentlyFocusedField()
        : null;

      if (!currentlyFocusedInput) return;

      const inputHandle = typeof findNodeHandle === 'function' ? findNodeHandle(currentlyFocusedInput) : null;
      const scrollHandle = typeof findNodeHandle === 'function' ? findNodeHandle(scrollViewRef.current) : null;

      if (!inputHandle || !scrollHandle) return;

      if (UIManager && typeof UIManager.measureLayout === 'function') {
        UIManager.measureLayout(
          inputHandle,
          scrollHandle,
          () => {}, // error callback
          (left, top, width, height) => {
            const inputBottom = top + height + extraScrollHeight;
            // Scroll if input bottom is obscured or close to keyboard
            scrollViewRef.current?.scrollTo({
              y: Math.max(0, top - 60),
              animated: true,
            });
          }
        );
      }
    };

    useEffect(() => {
      if (keyboardShown) {
        // Small timeout to allow input focus layout calculation
        const timer = setTimeout(scrollFocusedInputIntoView, Platform.OS === 'ios' ? 50 : 120);
        return () => clearTimeout(timer);
      }
    }, [keyboardShown, keyboardHeight]);

    // Extra dynamic padding when keyboard is open so bottom inputs have space to scroll above keyboard
    const dynamicBottomPadding = keyboardShown ? Math.max(keyboardHeight + 20, 120) : 24;

    return (
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={[
          { flexGrow: 1, paddingBottom: dynamicBottomPadding },
          contentContainerStyle,
        ]}
        {...props}
      >
        <View ref={containerRef} style={{ flexGrow: 1 }} onLayout={scrollFocusedInputIntoView}>
          {children}
        </View>
      </ScrollView>
    );
  }
);

KeyboardAwareScrollView.displayName = 'KeyboardAwareScrollView';
export default KeyboardAwareScrollView;
