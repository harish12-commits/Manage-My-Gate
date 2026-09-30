import { useState, useCallback, useEffect } from 'react';
import { useColorScheme } from 'nativewind';
import { Alert, Platform, useColorScheme as useRNColorScheme } from 'react-native';
import storage from '../../../utils/storage';
import i18n, { LanguageCode, LANGUAGE_OPTIONS, useTranslation } from '../../../utils/i18n';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppPreferences {
  gateAlerts: boolean;
  maintenanceNotices: boolean;
  communityPolls: boolean;
  emergencyBroadcasts: boolean;
  biometricUnlock: boolean;
  requireGateApprovalPin: boolean;
}

let globalThemeMode: ThemeMode = 'light';
const themeListeners = new Set<(mode: ThemeMode) => void>();

export const useSettings = () => {
  const systemRNTheme = useRNColorScheme();
  const { colorScheme, setColorScheme } = useColorScheme();
  const { t, languageCode, setLanguage } = useTranslation();

  const [themeMode, setThemeModeState] = useState<ThemeMode>(globalThemeMode);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);

  // Sync with global theme updates
  useEffect(() => {
    const listener = (mode: ThemeMode) => {
      setThemeModeState(mode);
    };
    themeListeners.add(listener);
    return () => {
      themeListeners.delete(listener);
    };
  }, []);

  const [preferences, setPreferences] = useState<AppPreferences>({
    gateAlerts: true,
    maintenanceNotices: true,
    communityPolls: true,
    emergencyBroadcasts: true,
    biometricUnlock: true,
    requireGateApprovalPin: false,
  });

  // Restore saved theme mode & language on mount
  useEffect(() => {
    const restoreSettings = async () => {
      try {
        const savedTheme = await storage.getItem('theme_preference');
        if (savedTheme === 'dark' || savedTheme === 'light') {
          globalThemeMode = savedTheme as ThemeMode;
          setThemeModeState(savedTheme as ThemeMode);
          setColorScheme(savedTheme as 'light' | 'dark');
        } else if (savedTheme === 'system') {
          globalThemeMode = 'system';
          setThemeModeState('system');
          setColorScheme('system');
        } else {
          // Default to system theme on fresh install
          globalThemeMode = 'system';
          setThemeModeState('system');
          setColorScheme('system');
          await storage.setItem('theme_preference', 'system');
        }

        await i18n.initLanguage();
      } catch (err) {
        console.warn('Failed to restore settings:', err);
      }
    };
    restoreSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setThemeMode = useCallback(
    async (nextMode: ThemeMode) => {
      globalThemeMode = nextMode;
      setThemeModeState(nextMode);
      themeListeners.forEach((fn) => fn(nextMode));

      setColorScheme(nextMode);
      try {
        await storage.setItem('theme_preference', nextMode);
      } catch (err) {
        console.warn('Failed to save theme preference:', err);
      }
    },
    [setColorScheme, systemRNTheme]
  );

  const setLanguageCode = useCallback(async (code: LanguageCode) => {
    await setLanguage(code);
  }, [setLanguage]);

  const isDark = colorScheme === 'dark';

  const updatePreference = useCallback((key: keyof AppPreferences, value: boolean) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      storage.setItem(`setting_${key}`, JSON.stringify(value)).catch(() => {});
      return next;
    });
  }, []);

  const handleClearCache = useCallback(() => {
    const doClear = async () => {
      try {
        await storage.removeItem('community_pulse_mock_list');
        await storage.removeItem('community_pulse_mood');
        await storage.removeItem('community_pulse_question');
        if (Platform.OS === 'web') {
          window.alert(t('cache_cleared', 'Application cache cleared successfully.'));
        } else {
          Alert.alert(
            t('success', 'Success'),
            t('cache_cleared', 'Application cache cleared successfully.')
          );
        }
      } catch (e) {
        if (Platform.OS === 'web') {
          window.alert('Application cache cleared.');
        } else {
          Alert.alert('Notice', 'Application cache cleared.');
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to clear application cache and temporary storage?'
      );
      if (confirmed) {
        doClear();
      }
    } else {
      Alert.alert(
        t('clear_cache', 'Clear Application Cache'),
        'Are you sure you want to clear application cache and temporary storage?',
        [
          { text: t('cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('clear_cache', 'Clear Cache'),
            style: 'destructive',
            onPress: doClear,
          },
        ]
      );
    }
  }, [t]);

  const selectedLanguageOption =
    LANGUAGE_OPTIONS.find((opt) => opt.code === languageCode) || LANGUAGE_OPTIONS[0];

  return {
    isDark,
    themeMode,
    setThemeMode,
    languageCode,
    setLanguageCode,
    currentLanguageLabel: selectedLanguageOption.label,
    languageModalOpen,
    setLanguageModalOpen,
    preferences,
    updatePreference,
    handleClearCache,
    t,
  };
};

export default useSettings;
