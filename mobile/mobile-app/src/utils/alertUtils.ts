import { Alert, Platform } from 'react-native';
import { translateText } from './i18n';

export interface AlertButtonOption {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

type LocalizedAlertState = {
  installed: boolean;
  originalAlert: typeof Alert.alert;
  translate: typeof translateText;
};

const ALERT_STATE_KEY = Symbol.for('nahom.localizedAlert');
const alertGlobal = globalThis as typeof globalThis & {
  [ALERT_STATE_KEY]?: LocalizedAlertState;
};

/**
 * Localizes React Native alerts created anywhere in the app, including older
 * screens that call Alert.alert directly.
 */
export const installLocalizedAlertTranslation = () => {
  const existingState = alertGlobal[ALERT_STATE_KEY];
  if (existingState) {
    existingState.translate = translateText;
    return;
  }

  const state: LocalizedAlertState = {
    installed: true,
    originalAlert: Alert.alert.bind(Alert),
    translate: translateText,
  };
  alertGlobal[ALERT_STATE_KEY] = state;

  Alert.alert = ((title, message, buttons, options) => {
    const localizedButtons = buttons?.map((button) => ({
      ...button,
      text: state.translate(button.text),
    }));
    state.originalAlert(
      state.translate(title),
      message ? state.translate(message) : message,
      localizedButtons,
      options
    );
  }) as typeof Alert.alert;
};

/**
 * Cross-platform alert utility.
 * In React Native Web, Alert.alert is an empty no-op.
 * This utility bridges Alert.alert to window.alert / window.confirm on Web,
 * while utilizing native Alert.alert on iOS and Android.
 */
export const showCrossPlatformAlert = (
  title: string,
  message?: string,
  buttons?: AlertButtonOption[]
) => {
  const localizedTitle = translateText(title);
  const localizedMessage = message ? translateText(message) : message;
  const localizedButtons = buttons?.map((button) => ({
    ...button,
    text: translateText(button.text),
  }));
  const combinedText = [localizedTitle, localizedMessage].filter(Boolean).join('\n\n');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (!localizedButtons || localizedButtons.length <= 1) {
      window.alert(combinedText);
      if (localizedButtons && localizedButtons.length === 1 && localizedButtons[0].onPress) {
        localizedButtons[0].onPress();
      }
      return;
    }

    // Multiple buttons on Web -> use window.confirm
    const confirmed = window.confirm(combinedText);
    if (confirmed) {
      const confirmBtn = localizedButtons.find((b) => b.style !== 'cancel') || localizedButtons[0];
      if (confirmBtn?.onPress) confirmBtn.onPress();
    } else {
      const cancelBtn = localizedButtons.find((b) => b.style === 'cancel');
      if (cancelBtn?.onPress) cancelBtn.onPress();
    }
    return;
  }

  Alert.alert(localizedTitle, localizedMessage, localizedButtons as any);
};

export default showCrossPlatformAlert;
