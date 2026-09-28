import { useState, useEffect } from 'react';
import { Keyboard, KeyboardEvent, Platform } from 'react-native';

export interface KeyboardState {
  keyboardShown: boolean;
  keyboardHeight: number;
}

export function useKeyboard(): KeyboardState {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    keyboardShown: false,
    keyboardHeight: 0,
  });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      setKeyboardState({
        keyboardShown: true,
        keyboardHeight: e.endCoordinates.height,
      });
    };

    const onHide = () => {
      setKeyboardState({
        keyboardShown: false,
        keyboardHeight: 0,
      });
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardState;
}

export default useKeyboard;
