import React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { ChevronRight, ArrowRight, Sparkles } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/src/utils/i18n';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
  icon?: string | React.ComponentType<any>;
  iconBgColor?: string;
  iconColor?: string;
  actionLabel?: string;
  onAction?: () => void;
  isExpanded?: boolean;
  className?: string;
  containerClassName?: string;
  variant?: 'identity' | 'simple' | 'card';
}

const CATEGORY_DEFAULT_META: Record<
  string,
  {
    icon: string;
    subtitle: string;
    lightIconBg: string;
    darkIconBg: string;
    iconColor: string;
  }
> = {
  visitor_management: {
    icon: 'ShieldCheck',
    subtitle: 'Security & Gate Access',
    lightIconBg: 'bg-blue-50',
    darkIconBg: 'bg-blue-950/40',
    iconColor: '#2563EB',
  },
  amenities_facilities: {
    icon: 'Sparkles',
    subtitle: 'Facilities & Reservations',
    lightIconBg: 'bg-emerald-50',
    darkIconBg: 'bg-emerald-950/40',
    iconColor: '#16A34A',
  },
  complaints_helpdesk: {
    icon: 'ListTodo',
    subtitle: 'Issues & SLA Helpdesk',
    lightIconBg: 'bg-purple-50',
    darkIconBg: 'bg-purple-950/40',
    iconColor: '#7C3AED',
  },
  notice_board_polls: {
    icon: 'Megaphone',
    subtitle: 'Broadcasts & Resident Polls',
    lightIconBg: 'bg-pink-50',
    darkIconBg: 'bg-pink-950/40',
    iconColor: '#DB2777',
  },
  digital_wallet: {
    icon: 'WalletCards',
    subtitle: 'Prepaid Balance & Ledger',
    lightIconBg: 'bg-emerald-50',
    darkIconBg: 'bg-emerald-950/40',
    iconColor: '#10B981',
  },
  financial_billing: {
    icon: 'CreditCard',
    subtitle: 'Dues, Invoices & Accounts',
    lightIconBg: 'bg-teal-50',
    darkIconBg: 'bg-teal-950/40',
    iconColor: '#0D9488',
  },
  administration_security: {
    icon: 'UserRoundCog',
    subtitle: 'Staff, RBAC & Settings',
    lightIconBg: 'bg-amber-50',
    darkIconBg: 'bg-amber-950/40',
    iconColor: '#D97706',
  },
};

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  count,
  icon,
  iconBgColor,
  iconColor,
  actionLabel,
  onAction,
  isExpanded,
  className,
  containerClassName,
  variant = 'identity',
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { translateText, language } = useTranslation();

  // Resolve dynamic icon component
  let IconComponent: React.ComponentType<any> | null = null;
  if (typeof icon === 'string') {
    IconComponent = (LucideIcons as Record<string, any>)[icon] || null;
  } else if (icon) {
    IconComponent = icon;
  }

  // Supporting subtitle text logic
  let displaySubtitle = subtitle;
  if (!displaySubtitle && count !== undefined) {
    displaySubtitle = `${count} ${count === 1 ? 'feature' : 'features'}`;
  } else if (displaySubtitle && count !== undefined) {
    displaySubtitle = `${displaySubtitle} · ${count} ${count === 1 ? 'feature' : 'features'}`;
  }

  const localizedTitle = translateText(title);
  const localizedSubtitle = displaySubtitle ? translateText(displaySubtitle) : undefined;
  const localizedActionLabel = actionLabel ? translateText(actionLabel) : undefined;

  // Fallback simple header style if not identity or minimal invocation
  if (variant === 'simple' && !IconComponent && !displaySubtitle) {
    return (
      <View
        className={cn(
          'flex-row items-center justify-between px-1 py-2',
          containerClassName || className
        )}
      >
        <Text className="text-[13px] font-bold font-sans uppercase tracking-wider text-muted-foreground">
          {localizedTitle}
        </Text>
        {actionLabel && onAction && (
          <Pressable
            onPress={onAction}
            className="flex-row items-center gap-1 active:opacity-70 py-1 px-1.5"
            accessibilityRole="button"
            accessibilityLabel={localizedActionLabel}
          >
            <Text className="text-xs font-bold text-primary font-sans">{localizedActionLabel}</Text>
            <ChevronRight size={13} className="text-primary" color={isDark ? '#FF8A3D' : '#C2410C'} />
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View
      className={cn(
        'flex-row items-center justify-between py-2.5 px-1',
        containerClassName || className
      )}
    >
      {/* Left Column: Icon Badge + Title + Subtitle */}
      <View className="flex-row items-center flex-1 min-w-0 me-2">
        {IconComponent ? (
          <View
            className={cn(
              'w-9 h-9 rounded-2xl items-center justify-center me-3 shrink-0 border shadow-2xs',
              isDark
                ? 'bg-secondary/70 border-border/60'
                : iconBgColor || 'bg-primary/10 border-primary/20'
            )}
          >
            <IconComponent
              size={17}
              color={iconColor || (isDark ? '#FF8A3D' : '#C2410C')}
              strokeWidth={2.3}
            />
          </View>
        ) : null}

        <View className="flex-1 min-w-0 justify-center">
          <Text
            numberOfLines={1}
            className="text-[19px] sm:text-[20px] font-bold font-sans text-foreground tracking-tight"
          >
            {localizedTitle}
          </Text>

          {displaySubtitle ? (
            <Text
              numberOfLines={1}
              className="text-[14px] sm:text-[14.5px] font-normal font-sans text-muted-foreground mt-1 tracking-normal"
            >
              {localizedSubtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Right Action CTA Button (e.g. View all → / Show less) */}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="flex-row min-h-11 items-center gap-1.5 bg-primary/10 dark:bg-primary/20 border border-primary/25 dark:border-primary/40 px-3 py-1.5 rounded-full active:scale-95 transition-transform shrink-0 shadow-2xs"
          accessibilityRole="button"
          accessibilityLabel={localizedActionLabel}
        >
          <Text className="text-[13px] font-bold font-sans text-primary">
            {localizedActionLabel}
          </Text>
          {isExpanded !== undefined ? (
            <ChevronRight
              size={12}
              className="text-primary"
              color={isDark ? '#FF8A3D' : '#C2410C'}
              strokeWidth={2.4}
              style={{
                transform: [{ rotate: isExpanded ? '90deg' : '0deg' }],
              }}
            />
          ) : (
            <ArrowRight size={11} className="text-primary" color={isDark ? '#FF8A3D' : '#C2410C'} strokeWidth={2.4} />
          )}
        </Pressable>
      )}
    </View>
  );
};

export default SectionHeader;
