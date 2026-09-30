import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Smartphone, Wifi } from 'lucide-react-native';
import Animated, { useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { cn } from '../../lib/utils';

export interface NFCScanIndicatorProps {
  status: 'scanning' | 'success' | 'error' | 'idle';
  className?: string;
}

export const NFCScanIndicator = ({
  status,
  className,
}: NFCScanIndicatorProps) => {
  // Simple pulse animation for scanning state
  const animatedStyle = useAnimatedStyle(() => {
    if (status !== 'scanning') return { opacity: 1 };
    
    return {
      opacity: withRepeat(
        withSequence(
          withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) })
        ),
        -1, // infinite
        true
      ),
    };
  });

  const getStatusConfig = () => {
    switch (status) {
      case 'scanning':
        return { color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'Hold device near reader...' };
      case 'success':
        return { color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'Tag read successfully' };
      case 'error':
        return { color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30', text: 'Error reading tag' };
      case 'idle':
      default:
        return { color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900', text: 'Ready to scan' };
    }
  };

  const config = getStatusConfig();

  return (
    <View className={cn('items-center justify-center p-6', className)}>
      <Animated.View 
        style={animatedStyle}
        className={cn('mb-4 h-24 w-24 items-center justify-center rounded-full', config.bg)}
      >
        <Smartphone size={32} className={cn('absolute -ml-6', config.color)} />
        <Wifi size={40} className={cn('absolute ml-6 rotate-90', config.color)} />
      </Animated.View>
      <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
        NFC Scanner
      </Text>
      <Text className={cn('mt-1 text-sm font-medium', config.color)}>
        {config.text}
      </Text>
    </View>
  );
};
