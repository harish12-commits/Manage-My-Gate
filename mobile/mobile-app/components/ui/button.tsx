import React from 'react';
import { Text, TextClassContext } from './text';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Platform, Pressable } from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';

const buttonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 rounded-2xl shadow-none',
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    })
  ),
  {
    variants: {
      variant: {
        default: cn(
          'bg-primary active:opacity-90 shadow-2xs',
          Platform.OS === 'web' ? 'hover:opacity-90' : ''
        ),
        continue: cn(
          'bg-white dark:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-700 rounded-xl',
          Platform.OS === 'web' ? 'hover:bg-gray-50 dark:hover:bg-slate-700' : ''
        ),
        primary: cn(
          'bg-primary active:opacity-90 shadow-2xs',
          Platform.OS === 'web' ? 'hover:opacity-90' : ''
        ),
        destructive: cn(
          'bg-rose-600 active:bg-rose-700 shadow-2xs',
          Platform.OS === 'web'
            ? 'hover:opacity-90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40'
            : ''
        ),
        'destructive-outline': cn(
          'border border-rose-500/30 bg-rose-50/80 dark:bg-rose-950/40 active:bg-rose-100 dark:active:bg-rose-900/60 shadow-2xs',
          Platform.OS === 'web' ? 'hover:bg-rose-100' : ''
        ),
        stop: cn(
          'bg-rose-600 active:bg-rose-700 shadow-2xs',
          Platform.OS === 'web' ? 'hover:bg-rose-700' : ''
        ),
        'stop-outline': cn(
          'border border-rose-500/30 bg-rose-50/80 dark:bg-rose-950/40 active:bg-rose-100 dark:active:bg-rose-900/60 shadow-2xs',
          Platform.OS === 'web' ? 'hover:bg-rose-100' : ''
        ),
        success: cn(
          'bg-emerald-600 active:bg-emerald-700 shadow-2xs',
          Platform.OS === 'web' ? 'hover:bg-emerald-700' : ''
        ),
        edit: cn(
          'border border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/40 active:bg-emerald-100 dark:active:bg-emerald-900/60 shadow-2xs',
          Platform.OS === 'web' ? 'hover:bg-emerald-100' : ''
        ),
        warning: cn(
          'border border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/40 active:bg-amber-100 dark:active:bg-amber-900/60 shadow-2xs',
          Platform.OS === 'web' ? 'hover:bg-amber-100' : ''
        ),
        'warning-solid': cn(
          'bg-amber-600 active:bg-amber-700 shadow-2xs',
          Platform.OS === 'web' ? 'hover:bg-amber-700' : ''
        ),
        info: cn(
          'border border-blue-500/30 bg-blue-50/80 dark:bg-blue-950/40 active:bg-blue-100 dark:active:bg-blue-900/60 shadow-2xs',
          Platform.OS === 'web' ? 'hover:bg-blue-100' : ''
        ),
        'info-solid': cn(
          'bg-blue-600 active:bg-blue-700 shadow-2xs',
          Platform.OS === 'web' ? 'hover:bg-blue-700' : ''
        ),
        purple: cn(
          'border border-purple-500/30 bg-purple-50/80 dark:bg-purple-950/40 active:bg-purple-100 dark:active:bg-purple-900/60 shadow-2xs',
          Platform.OS === 'web' ? 'hover:bg-purple-100' : ''
        ),
        navy: cn(
          'bg-primary active:opacity-90 shadow-2xs',
          Platform.OS === 'web' ? 'hover:opacity-90' : ''
        ),
        outline: cn(
          'border border-primary/30 dark:border-border/80 bg-card active:bg-secondary/70 shadow-2xs',
          Platform.OS === 'web' ? 'hover:bg-secondary/70' : ''
        ),
        secondary: cn(
          'bg-secondary active:opacity-90 shadow-2xs',
          Platform.OS === 'web' ? 'hover:opacity-90' : ''
        ),
        ghost: cn(
          'active:bg-primary/10 active:text-primary',
          Platform.OS === 'web' ? 'hover:bg-primary/10' : ''
        ),
        link: '',
      },
      size: {
        default: cn('h-12 px-5 py-2.5 sm:h-11 rounded-2xl', Platform.select({ web: 'has-[>svg]:px-4' })),
        // Keep every shared compact action at least 44pt on phones. Desktop
        // layouts retain the denser visual treatment at the Tailwind sm breakpoint.
        sm: cn('h-11 gap-1.5 rounded-xl px-4 sm:h-9.5', Platform.select({ web: 'has-[>svg]:px-3' })),
        lg: cn('h-14 rounded-2xl px-7 sm:h-12', Platform.select({ web: 'has-[>svg]:px-5' })),
        icon: 'h-11 w-11 sm:h-10 sm:w-10 rounded-xl shadow-2xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva(
  cn(
    // Buttons are touch targets, not text blocks. Center labels by default so
    // wrapped labels remain visually balanced with their icon and surface.
    'text-foreground text-center leading-tight flex-shrink text-[16px] font-bold tracking-tight font-sans',
    Platform.select({ web: 'pointer-events-none transition-colors' })
  ),
  {
    variants: {
      variant: {
        default: 'text-primary-foreground font-bold',
        continue: 'text-black dark:text-white font-extrabold',
        primary: 'text-primary-foreground font-bold',
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
        outline: 'text-primary dark:text-foreground font-semibold group-active:text-primary',
        secondary: 'text-secondary-foreground font-bold',
        ghost: 'text-primary dark:text-foreground font-semibold group-active:text-primary',
        link: cn(
          'text-primary font-bold group-active:underline',
          Platform.select({ web: 'underline-offset-4 hover:underline group-hover:underline' })
        ),
      },
      size: {
        default: '',
        sm: 'text-[14px]',
        lg: 'text-[17px]',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const SOLID_LOADING_VARIANTS = new Set([
  'default',
  'continue',
  'primary',
  'destructive',
  'stop',
  'success',
  'warning-solid',
  'info-solid',
  'navy',
  'secondary',
]);

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<typeof Pressable> {
  variant?: 
    | 'default' 
    | 'continue'
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
  leftIcon?: React.ComponentType<{ size?: number; className?: string; color?: string }>;
  rightIcon?: React.ComponentType<{ size?: number; className?: string; color?: string }>;
  loading?: boolean;
  isLoading?: boolean;
  textClassName?: string;
}

const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      loading: loadingProp,
      isLoading,
      disabled = false,
      textClassName,
      children,
      ...props
    },
    ref
  ) => {
    const loading = loadingProp || isLoading || false;
    const isDisabled = disabled || loading;
    const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;
    const loadingColor = variant === 'continue' ? '#000000' : SOLID_LOADING_VARIANTS.has(variant || 'default') ? '#FFFFFF' : '#F45A0A';
    const minimumTouchTarget = variant === 'link'
      ? ''
      : size === 'icon'
        ? 'min-h-11 min-w-11'
        : 'min-h-11';

    return (
      <TextClassContext.Provider value={cn(buttonTextVariants({ variant: variant as any, size }), textClassName)}>
        <Pressable
          ref={ref}
          disabled={isDisabled}
          className={cn(
            isDisabled && 'opacity-50',
            buttonVariants({ variant: variant as any, size }),
            'min-w-0',
            className,
            minimumTouchTarget
          )}
          role="button"
          {...props}
        >
          {(state) => (
            <>
              {loading ? (
                <AppLoader variant="inline" />
              ) : (
                LeftIcon && <LeftIcon size={iconSize} className={cn(buttonTextVariants({ variant }))} />
              )}
              {typeof children === 'function'
                ? children(state)
                : React.Children.map(children, (child) => {
                    if (typeof child === 'string') {
                      if (!child.trim()) return null;
                      return (
                        <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                          {child}
                        </Text>
                      );
                    }
                    if (typeof child === 'number') {
                      return (
                        <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                          {child}
                        </Text>
                      );
                    }
                    return child;
                  })}
              {!loading && RightIcon && (
                <RightIcon size={iconSize} className={cn(buttonTextVariants({ variant }))} />
              )}
            </>
          )}
        </Pressable>
      </TextClassContext.Provider>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonTextVariants, buttonVariants };
export default Button;
