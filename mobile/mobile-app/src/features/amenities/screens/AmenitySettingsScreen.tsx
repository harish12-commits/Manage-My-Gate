/**
 * Amenity settings: the community-wide rules every facility follows (booking quota per
 * unit, approval timeout, early entry and no-show grace at the gate). Facility-specific
 * rules (prices, hours, cancellation policy) are edited in the facility catalog.
 */

import React, { useRef } from 'react';
import { View } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Text } from '@/components/ui/text';
import { useTranslation } from '@/src/utils/i18n';
import { useAmenitySettings } from '../hooks/useAmenitySettings';
import { AmenitySettingsForm } from '../components/AmenitySettingsForm';

export function AmenitySettingsScreen() {
  const { t } = useTranslation();
  const { settings, loading, saving, error, savedAt, reload, save, clearError } = useAmenitySettings();
  // Only confirm saves made while this screen is open.
  const openedAt = useRef(Date.now()).current;
  const justSaved = Boolean(savedAt && savedAt >= openedAt);

  return (
    <ScreenShell
      title={t('amenity_settings_title', 'Amenity Settings')}
      subtitle={t('amenity_settings_sub', 'Rules for every facility')}
      iconName="SlidersHorizontal"
      loading={loading && !settings}
      error={!settings && error ? error : null}
      onRetry={reload}
      scrollable={false}
      hideBottomNav
    >
      <View className="flex-1 bg-background">
        {settings ? (
          <AmenitySettingsForm
            settings={settings}
            saving={saving}
            onSave={save}
            banner={
              <>
                {error ? (
                  <View className="mx-4 mt-3">
                    <ErrorBanner title={t('amenity_settings_not_saved', 'Not saved')} message={error} onDismiss={clearError} />
                  </View>
                ) : null}
                {justSaved && !error ? (
                  <View testID="amenity-settings-saved" className="mx-4 mt-3 p-3 rounded-2xl bg-status-success/10 border border-status-success/30">
                    <Text className="text-xs font-semibold text-foreground">
                      {t('amenity_settings_saved', 'Settings saved. New bookings follow these rules.')}
                    </Text>
                  </View>
                ) : null}
              </>
            }
          />
        ) : null}
      </View>
    </ScreenShell>
  );
}

export default AmenitySettingsScreen;
