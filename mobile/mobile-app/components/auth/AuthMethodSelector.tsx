import * as React from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';

type AuthMode = 'basic' | 'phone';

export function AuthMethodSelector({ value, onChange, emailLabel, otpLabel, reduceMotion, disabled = false }: {
  value: AuthMode;
  onChange: (value: AuthMode) => void;
  emailLabel: string;
  otpLabel: string;
  reduceMotion: boolean;
  disabled?: boolean;
}) {
  const [width, setWidth] = React.useState(0);
  const position = React.useRef(new Animated.Value(value === 'basic' ? 0 : 1)).current;
  const segmentWidth = Math.max(0, (width - 8) / 2);
  const animateTo = React.useCallback((mode: AuthMode) => {
    Animated.spring(position, {
      toValue: mode === 'basic' ? 0 : 1,
      stiffness: 260,
      damping: 28,
      mass: 1,
      useNativeDriver: true,
      ...(reduceMotion ? { overshootClamping: true } : {}),
    }).start();
  }, [position, reduceMotion]);

  React.useEffect(() => {
    if (reduceMotion) position.setValue(value === 'basic' ? 0 : 1);
    else animateTo(value);
  }, [value, reduceMotion, position, animateTo]);

  const responder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => !disabled && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => {
      if (segmentWidth) position.setValue(Math.max(0, Math.min(1, (value === 'basic' ? 0 : 1) + gesture.dx / segmentWidth)));
    },
    onPanResponderRelease: (_, gesture) => {
      const next = gesture.dx > 20 ? 'phone' : gesture.dx < -20 ? 'basic' : value;
      onChange(next);
      if (reduceMotion) position.setValue(next === 'basic' ? 0 : 1);
      else animateTo(next);
    },
    onPanResponderTerminate: () => {
      if (reduceMotion) position.setValue(value === 'basic' ? 0 : 1);
      else animateTo(value);
    },
  }), [disabled, segmentWidth, value, position, onChange, animateTo, reduceMotion]);

  return (
    <View
      {...responder.panHandlers}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: '#E9E9EE', opacity: disabled ? 0.6 : 1 }}
    >
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', left: 4, top: 4, bottom: 4, width: segmentWidth,
        borderRadius: 999, backgroundColor: '#FFFFFF',
        shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
        transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, segmentWidth] }) }],
      }} />
      {(['basic', 'phone'] as const).map((mode) => (
        <Pressable key={mode} disabled={disabled} onPress={() => onChange(mode)}
          accessibilityRole="tab" accessibilityState={{ selected: value === mode, disabled }}
          accessibilityLabel={mode === 'basic' ? emailLabel : otpLabel}
          style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text numberOfLines={1} style={{ color: value === mode ? '#1C1C1E' : '#636366', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
            {mode === 'basic' ? emailLabel : otpLabel}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
