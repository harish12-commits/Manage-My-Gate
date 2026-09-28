import React, { forwardRef } from 'react';
import { Pressable, View, PressableProps } from 'react-native';
import { Text, TextClassContext } from '../ui/text';
import { LucideIcon } from 'lucide-react-native';
import { cn } from '../../lib/utils';

export interface ButtonProps extends PressableProps {
  children: React.ReactNode;
  variant?: 
    | 'default' 
    | 'primary' 
    | 'destructive' 
    | 'destructive-outline'
    | 'stop'
    | 'stop-outline'
    | 'success'
    | 'edit'
    | 'warning'
    | 'warning-solid'
    | 'info'
    | 'info-solid'
    | 'purple'
    | 'navy'
    | 'outline' 
    | 'secondary' 
    | 'ghost' 
    | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  textClassName?: string;
}

export const Button = forwardRef<View, ButtonProps>(
  (
    {
      children,
      variant = 'default',
      size = 'default',
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      loading = false,
      disabled = false,
      className,
      textClassName,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      default: 'bg-primary border border-primary/90 shadow-xs',
      primary: 'bg-primary border border-primary/90 shadow-xs',
      destructive: 'bg-rose-600 active:bg-rose-700 shadow-xs',
      'destructive-outline': 'border border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 shadow-xs',
      stop: 'bg-rose-600 active:bg-rose-700 shadow-xs',
      'stop-outline': 'border border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 shadow-xs',
      success: 'bg-emerald-600 active:bg-emerald-700 shadow-xs',
      edit: 'border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs',
      warning: 'border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 shadow-xs',
      'warning-solid': 'bg-amber-600 active:bg-amber-700 shadow-xs',
      info: 'border border-blue-500/40 bg-blue-50 dark:bg-blue-950/40 shadow-xs',
      'info-solid': 'bg-blue-600 active:bg-blue-700 shadow-xs',
      purple: 'border border-purple-500/40 bg-purple-50 dark:bg-purple-950/40 shadow-xs',
      navy: 'bg-[#172B70] dark:bg-[#1E3A8A] active:opacity-90 shadow-xs',
      outline: 'border border-[#172B70]/30 dark:border-border/80 bg-card shadow-xs',
      secondary: 'bg-[#172B70] dark:bg-[#1E3A8A] active:opacity-90 shadow-xs',
      ghost: 'bg-transparent active:bg-primary/10',
      link: 'bg-transparent underline-offset-4',
    };

    const textClasses = {
      default: 'text-primary-foreground',
      primary: 'text-primary-foreground',
      destructive: 'text-white font-bold',
      'destructive-outline': 'text-rose-600 dark:text-rose-400 font-bold',
      stop: 'text-white font-bold',
      'stop-outline': 'text-rose-600 dark:text-rose-400 font-bold',
      success: 'text-white font-bold',
      edit: 'text-emerald-700 dark:text-emerald-400 font-bold',
      warning: 'text-amber-700 dark:text-amber-400 font-bold',
      'warning-solid': 'text-white font-bold',
      info: 'text-blue-700 dark:text-blue-400 font-bold',
      'info-solid': 'text-white font-bold',
      purple: 'text-purple-700 dark:text-purple-400 font-bold',
      navy: 'text-white font-bold',
      outline: 'text-[#172B70] dark:text-foreground font-semibold',
      secondary: 'text-white font-bold',
      ghost: 'text-[#172B70] dark:text-foreground font-semibold',
      link: 'text-primary underline',
    };

    const sizeClasses = {
      // Every mobile action keeps the 44pt minimum touch target. Visual density
      // is preserved through padding and typography, not undersized press areas.
      default: 'h-11 px-4 py-2 rounded-xl',
      sm: 'h-11 rounded-lg px-3',
      lg: 'h-12 rounded-xl px-6',
      icon: 'h-11 w-11 rounded-xl',
    };

    const isDisabled = disabled || loading;
    const minimumTouchTarget = variant === 'link'
      ? ''
      : size === 'icon'
        ? 'min-h-11 min-w-11'
        : 'min-h-11';

    const foregroundClass = cn(
      'text-center leading-tight flex-shrink',
      textClasses[variant],
      textClassName
    );

    return (
      <TextClassContext.Provider value={foregroundClass}>
        <Pressable
          ref={ref}
          disabled={isDisabled}
          className={cn(
            'flex-row items-center justify-center min-w-0',
            variantClasses[variant],
            sizeClasses[size],
            isDisabled && 'opacity-50',
            className,
            minimumTouchTarget
          )}
          {...props}
        >
          {({ pressed }) => (
            <View className={cn('flex-row items-center justify-center min-w-0', pressed && variant !== 'link' && 'opacity-80')}>
              {LeftIcon && !loading && (
                <LeftIcon size={16} className={cn('me-1.5', textClasses[variant])} />
              )}
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                numberOfLines={1}
                className={cn('text-center leading-tight flex-shrink text-sm font-semibold', foregroundClass)}
              >
                {loading ? 'Loading...' : children}
              </Text>
              {RightIcon && !loading && (
                <RightIcon size={16} className={cn('ms-1.5', textClasses[variant])} />
              )}
            </View>
          )}
        </Pressable>
      </TextClassContext.Provider>
    );
  }
);
Button.displayName = 'Button';
