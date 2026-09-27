import { Text } from './text';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { View } from 'react-native';
import { useTranslation } from '../../src/utils/i18n';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'critical' | 'gold';

export interface StatusBadgeProps extends Omit<React.ComponentPropsWithoutRef<typeof View>, 'children'> {
  label: string;
  variant: StatusVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const STATUS_COLORS: Record<
  StatusVariant,
  {
    light: { bg: string; text: string; dot: string; border: string };
    dark: { bg: string; text: string; dot: string; border: string };
  }
> = {
  success: {
    light: { bg: '#dcfce7', text: '#15803d', dot: '#16a34a', border: '#bbf7d0' }, // Emerald
    dark: { bg: 'rgba(16, 185, 129, 0.15)', text: '#6ee7b7', dot: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  },
  warning: {
    light: { bg: '#fef3c7', text: '#b45309', dot: '#d97706', border: '#fde68a' }, // Amber
    dark: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fde68a', dot: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  },
  danger: {
    light: { bg: '#fee2e2', text: '#b91c1c', dot: '#dc2626', border: '#fecaca' }, // Red
    dark: { bg: 'rgba(244, 63, 94, 0.15)', text: '#fda4af', dot: '#f43f5e', border: 'rgba(244, 63, 94, 0.3)' },
  },
  info: {
    light: { bg: '#dbeafe', text: '#1d4ed8', dot: '#2563eb', border: '#bfdbfe' }, // Blue
    dark: { bg: 'rgba(59, 130, 246, 0.15)', text: '#93c5fd', dot: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
  },
  neutral: {
    light: { bg: '#f3f4f6', text: '#374151', dot: '#6b7280', border: '#e5e7eb' }, // Zinc
    dark: { bg: 'rgba(113, 113, 122, 0.15)', text: '#d4d4d8', dot: '#a1a1aa', border: 'rgba(113, 113, 122, 0.3)' },
  },
  critical: {
    light: { bg: '#f3e8ff', text: '#7e22ce', dot: '#9333ea', border: '#e9d5ff' }, // Violet
    dark: { bg: 'rgba(139, 92, 246, 0.15)', text: '#c4b5fd', dot: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
  },
  gold: {
    light: { bg: '#fbf7ee', text: '#997328', dot: '#c5a059', border: '#f0e3c5' }, // Champagne Gold
    dark: { bg: 'rgba(197, 160, 89, 0.15)', text: '#f3e8cb', dot: '#c5a059', border: 'rgba(197, 160, 89, 0.3)' },
  },
};

export const STATUS_VARIANT_MAP: Record<string, StatusVariant> = {
  // Visitor
  ACTIVE: 'success',
  PENDING: 'warning',
  REVOKED: 'danger',
  EXPIRED: 'neutral',
  REJECTED: 'danger',
  Rejected: 'danger',
  // Billing & Payment
  PAID: 'success',
  UNPAID: 'danger',
  OVERDUE: 'critical',
  VERIFICATION_PENDING: 'warning',
  CASH_PENDING: 'warning',
  PAY_AT_GATE: 'warning',
  CHECKING: 'info',
  PAYMENT_CHECKING: 'info',
  PARTIALLY_PAID: 'warning',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  REFUNDED: 'info',
  // Complaints status
  Open: 'info',
  Assigned: 'warning',
  'In Progress': 'warning',
  Resolved: 'success',
  Closed: 'neutral',
  // Priority
  Low: 'neutral',
  Medium: 'info',
  High: 'warning',
  Critical: 'critical',
  // Notification type
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'danger',
  INFO: 'info',
};

export function getStatusVariant(status: string): StatusVariant {
  return STATUS_VARIANT_MAP[status] || 'neutral';
}

const statusBadgeVariants = cva(
  'inline-flex flex-row items-center justify-center rounded-full self-start shadow-2xs',
  {
    variants: {
      size: {
        sm: 'h-[22px] px-2 gap-1',
        md: 'h-[26px] px-2.5 gap-1.5',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const statusBadgeTextVariants = cva('font-bold font-sans', {
  variants: {
    size: {
      sm: 'text-[11px] uppercase tracking-wider',
      md: 'text-[12.5px] tracking-wide',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

function PulsingDot({ color, size }: { color: string; size: 'sm' | 'md' }) {
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const dotSizeClass = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <Animated.View
      className={cn('rounded-full', dotSizeClass)}
      style={[{ backgroundColor: color }, animatedStyle]}
    />
  );
}

const StatusBadge = React.forwardRef<View, StatusBadgeProps>(
  ({ label, variant = 'neutral', size = 'md', dot = false, className, style, ...props }, ref) => {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { t, hasKey, translateText, language } = useTranslation();

    const validVariant = STATUS_COLORS[variant] ? variant : 'neutral';
    const colorConfig = isDark ? STATUS_COLORS[validVariant].dark : STATUS_COLORS[validVariant].light;

    const rawLabel = String(label || '').trim();
    if (!rawLabel) {
      return null;
    }

    const cleanUnder = rawLabel.toLowerCase().replace(/[\s\/-]+/g, '_');
    const normalizedKey = `status_${cleanUnder}`;
    const displayLabel = hasKey(normalizedKey)
      ? t(normalizedKey)
      : hasKey(cleanUnder)
      ? t(cleanUnder)
      : translateText(rawLabel);

    return (
      <View
        ref={ref}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel={props.accessibilityLabel || `Status: ${displayLabel}`}
        className={cn(statusBadgeVariants({ size }), className)}
        style={[{ backgroundColor: colorConfig.bg, borderColor: colorConfig.border, borderWidth: 1 }, style]}
        {...props}
      >
        {dot && <PulsingDot color={colorConfig.dot} size={size} />}
        <Text
          className={cn(statusBadgeTextVariants({ size }))}
          style={{ color: colorConfig.text }}
        >
          {displayLabel}
        </Text>
      </View>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export { StatusBadge, statusBadgeVariants, statusBadgeTextVariants };
