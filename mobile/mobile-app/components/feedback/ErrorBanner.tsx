import React from 'react';
import { View, Pressable, Linking, Platform } from 'react-native';
import { Text } from '../ui/text';
import { AlertTriangle, X, Mail } from 'lucide-react-native';
import { cn } from '../../lib/utils';

export interface ErrorBannerProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const ErrorBanner = ({
  title = 'Error',
  message,
  onDismiss,
  onRetry,
  className,
}: ErrorBannerProps) => {
  const handleContactDev = () => {
    const subject = encodeURIComponent(`Nahom App Error: ${title}`);
    const body = encodeURIComponent(`Error message: ${message}\nPlatform: ${Platform.OS}\nTimestamp: ${new Date().toISOString()}`);
    Linking.openURL(`mailto:developer@managemygate.com?subject=${subject}&body=${body}`);
  };

  return (
    <View
      className={cn(
        'flex-row items-start rounded-xl border border-destructive/20 bg-destructive/10 p-3.5',
        className
      )}
    >
      <AlertTriangle size={18} className="me-2.5 mt-0.5 text-destructive" />
      <View className="flex-1">
        <Text className="text-sm font-bold font-sans text-destructive">
          {title}
        </Text>
        <Text className="mt-0.5 text-xs font-sans text-destructive/90">
          {message}
        </Text>
        <View className="mt-2.5 flex-row items-center gap-2">
          {onRetry && (
            <Pressable onPress={onRetry} className="rounded-lg bg-destructive px-3 py-1">
              <Text className="text-xs font-bold font-sans text-white">Retry</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleContactDev}
            className="flex-row items-center gap-1 rounded-lg bg-destructive/15 border border-destructive/30 px-2.5 py-1 active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel="Email App Developer"
          >
            <Mail size={12} className="text-destructive" />
            <Text className="text-xs font-semibold font-sans text-destructive">Contact Dev</Text>
          </Pressable>
        </View>
      </View>
      {onDismiss && (
        <Pressable onPress={onDismiss} className="ms-2 p-1">
          <X size={16} className="text-destructive" />
        </Pressable>
      )}
    </View>
  );
};
