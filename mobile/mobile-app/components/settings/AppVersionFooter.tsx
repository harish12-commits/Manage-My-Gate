import React from 'react';
import { View, Pressable, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/src/utils/i18n';

export interface AppVersionFooterProps {
  onPressPrivacy?: () => void;
  onPressTerms?: () => void;
  className?: string;
}

export const AppVersionFooter = ({
  onPressPrivacy,
  onPressTerms,
  className,
}: AppVersionFooterProps) => {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version || '1.0.1';
  const buildNumber =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber || '17'
      : Constants.expoConfig?.android?.versionCode?.toString() || '22';

  return (
    <View className={cn('pt-6 pb-4 items-center justify-center gap-2', className)}>
      <Text className="text-xs font-bold text-muted-foreground tracking-wider uppercase font-sans">
        {t('nahom_enterprise', 'Nahom Enterprise')}
      </Text>

      {onPressPrivacy || onPressTerms ? (
        <View className="flex-row items-center gap-3">
          {onPressPrivacy && (
            <Pressable onPress={onPressPrivacy} hitSlop={6} className="active:opacity-75">
              <Text className="text-[11px] font-semibold text-primary font-sans underline">
                {t('privacy_policy', 'Privacy Policy')}
              </Text>
            </Pressable>
          )}
          {onPressPrivacy && onPressTerms && (
            <Text className="text-[11px] text-muted-foreground">•</Text>
          )}
          {onPressTerms && (
            <Pressable onPress={onPressTerms} hitSlop={6} className="active:opacity-75">
              <Text className="text-[11px] font-semibold text-primary font-sans underline">
                {t('terms_conditions', 'Terms & Conditions')}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}

      <Text className="text-[11px] text-muted-foreground/70 font-mono">
        v{version} ({t('build', 'Build')} {buildNumber}) • {t('smart_gate_os', 'Smart Gate OS')}
      </Text>
    </View>
  );
};

export default AppVersionFooter;
