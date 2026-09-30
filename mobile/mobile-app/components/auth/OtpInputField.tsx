import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { cn } from '../../lib/utils';

export interface OtpInputFieldProps {
  length?: number;
  value: string;
  onValueChange: (value: string) => void;
  error?: boolean;
  className?: string;
}

export const OtpInputField = ({
  length = 6,
  value = '',
  onValueChange,
  error = false,
  className,
}: OtpInputFieldProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  const renderCells = () => {
    const cells = [];
    const safeValue = value || '';

    for (let i = 0; i < length; i++) {
      const char = safeValue[i] || '';
      const isCurrentFocus = safeValue.length === i && isFocused;

      cells.push(
        <View
          key={i}
          className={cn(
            'h-14 w-12 items-center justify-center rounded-xl border border-border bg-card shadow-xs',
            isCurrentFocus && 'border-primary shadow-sm bg-primary/5',
            error && 'border-destructive bg-destructive/10'
          )}
        >
          <Text className="text-2xl font-bold font-sans text-foreground text-center leading-none">
            {char}
          </Text>
        </View>
      );
    }
    return cells;
  };

  return (
    <Pressable
      className={cn('flex-row items-center justify-between relative w-full', className)}
      onPress={handlePress}
    >
      {renderCells()}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onValueChange}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0,
          zIndex: 10,
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </Pressable>
  );
};

export default OtpInputField;
