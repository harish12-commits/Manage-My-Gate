import * as React from 'react';
import { TextInput, View, Text, TouchableOpacity, TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { cn } from '../../lib/utils';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  isPassword?: boolean;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  ({ label, error, isPassword = false, leftIcon, className = '', ...props }, ref) => {
    const [secureTextEntry, setSecureTextEntry] = React.useState(isPassword);
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const iconColor = isDark ? '#9ca3af' : '#6b7280';

    return (
      <View className="w-full gap-1">
        {Boolean(label) && (
          <Text className="text-foreground font-bold font-sans text-[15px] ms-1">
            {label}
          </Text>
        )}

        <View className={cn(
          "relative flex-row items-center border border-border/80 bg-card rounded-2xl px-3.5 shadow-2xs focus:border-primary",
          error ? "border-destructive bg-destructive/5" : ""
        )}>
          {leftIcon && <View className="me-2" pointerEvents="none">{leftIcon}</View>}

          <TextInput
            ref={ref}
            placeholderTextColor={props.placeholderTextColor || (isDark ? '#737c88' : '#9ca3af')}
            className={cn(`flex-1 text-foreground py-3.5 text-[16px] font-sans`, className)}
            style={[
              { includeFontPadding: false, textAlignVertical: props.multiline ? 'top' : 'center' },
              props.style,
            ]}
            {...props}
          />

          {isPassword && (
            <TouchableOpacity
              onPress={() => setSecureTextEntry((prev) => !prev)}
              activeOpacity={0.7}
              className="p-1 ms-1"
            >
              {secureTextEntry ? (
                <EyeOff size={16} color={iconColor} />
              ) : (
                <Eye size={16} color={iconColor} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {error ? (
          <Text className="text-destructive text-xs font-semibold ms-1">
            {error}
          </Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = 'Input';
export default Input;
