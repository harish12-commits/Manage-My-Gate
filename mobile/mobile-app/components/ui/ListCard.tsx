import * as React from 'react';
import { View, Pressable, Platform, Image } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { cva } from 'class-variance-authority';
import { Text } from './text';
import { Icon } from './icon';
import { StatusBadge, type StatusVariant } from './StatusBadge';
import { cn } from '../../lib/utils';

export interface ListCardProps extends Omit<React.ComponentPropsWithoutRef<typeof Pressable>, 'title'> {
  title: string;
  subtitle?: string;
  variant?: string;
  leftIcon?: string | React.ComponentType<any>; // Lucide icon name or component
  leftImage?: string;              // Image URL for left square
  leftAvatar?: string;             // Avatar image URL
  leftAvatarFallback?: string;      // Fallback text avatar initials
  showChevron?: boolean;           // Toggle chevron right icon
  isLastItem?: boolean;
  disableRelativeTime?: boolean;
  backgroundImage?: string;        // Full card background image URL
  leftIconBgColor?: string;        // icon container bg hex
  leftIconColor?: string;          // icon color hex
  status?: { label: string; variant: StatusVariant };
  secondaryBadge?: { label: string; variant: StatusVariant };
  timestamp?: string | Date;       // shows relative time (e.g., '2h ago')
  rightContent?: React.ReactNode;  // custom right slot (amount, chevron)
  titleLines?: number;             // maximum lines for title (default: 1)
  subtitleLines?: number;          // maximum lines for subtitle (default: 1)
  onPress?: () => void;
  onLongPress?: () => void;
  className?: string;
}

import { useTranslation, i18n } from '../../src/utils/i18n';

export function formatDate(date: string | Date): string {
  if (!date) return '';
  const past = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(past.getTime())) return typeof date === 'string' ? date : '';

  return past.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date);
}

export function formatRelativeTime(date: string | Date, tFunc?: (key: string, fb?: string) => string): string {
  if (!date) return '';
  const past = new Date(date);
  if (isNaN(past.getTime())) return typeof date === 'string' ? date : '';

  const now = new Date();
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  const t = tFunc || i18n.t;

  if (diffMins < 1) return t('just_now', 'Just now');
  if (diffMins < 60) return `${diffMins} ${t('mins_ago_unit', 'm ago')}`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ${t('hours_ago_unit', 'h ago')}`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return `1 ${t('day_ago_unit', '1d ago')}`;
  if (diffDays < 7) return `${diffDays} ${t('days_ago_unit', `${diffDays}d ago`)}`;

  // When past 7 days, display the exact date when created (no time)
  return formatDate(past);
}

const listCardVariants = cva(
  cn(
    'bg-card rounded-2xl border border-border/70 mb-3 p-3.5 flex-row items-center active:bg-secondary/70 shadow-2xs',
    Platform.select({
      web: 'transition-all cursor-pointer select-none hover:border-border',
    })
  ),
  {
    variants: {},
    defaultVariants: {},
  }
);

const ListCard = React.forwardRef<View, ListCardProps>(
  (
    {
      title,
      subtitle,
      leftIcon,
      leftImage,
      leftAvatar,
      leftAvatarFallback,
      showChevron,
      backgroundImage,
      leftIconBgColor = 'rgba(234, 88, 12, 0.08)',
      leftIconColor = '#EA580C',
      status,
      secondaryBadge,
      timestamp,
      disableRelativeTime = false,
      rightContent,
      titleLines = 1,
      subtitleLines = 1,
      children,
      onPress,
      onLongPress,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const { translateText, t } = useTranslation();
    const DynamicIcon = typeof leftIcon === 'string' ? (LucideIcons as Record<string, any>)[leftIcon] : leftIcon;
    const showDefaultChevron = showChevron && rightContent === undefined;

    const renderHeaderMainContent = () => (
      <View className="flex-1 flex-row items-center shrink min-w-0">
        {/* Left Avatar / Image / Icon Container */}
        {leftAvatar ? (
          <Image
            source={{ uri: leftAvatar }}
            className="w-11 h-11 rounded-full shrink-0 me-3.5 border border-border/60 shadow-2xs"
            resizeMode="cover"
          />
        ) : leftAvatarFallback ? (
          <View className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 items-center justify-center me-3.5 shrink-0 shadow-2xs">
            <Text className="text-xs font-bold text-primary">{leftAvatarFallback}</Text>
          </View>
        ) : leftImage ? (
          <Image
            source={{ uri: leftImage }}
            className="w-11 h-11 rounded-2xl shrink-0 me-3.5 border border-border/40 shadow-2xs"
            resizeMode="cover"
          />
        ) : DynamicIcon ? (
          <View
            className="w-11 h-11 rounded-2xl items-center justify-center shrink-0 me-3.5 border border-border/40 shadow-2xs"
            style={{ backgroundColor: leftIconBgColor }}
          >
            <Icon as={DynamicIcon} size={20} color={leftIconColor} />
          </View>
        ) : null}

        {/* Middle Details */}
        <View className="flex-1 shrink min-w-0 justify-center">
          <Text variant="default" className={cn("font-bold text-[16px] font-sans tracking-tight shrink truncate", backgroundImage ? "text-white" : "text-foreground")} numberOfLines={titleLines}>
            {translateText(title)}
          </Text>
          {subtitle ? (
            <Text variant="muted" numberOfLines={subtitleLines} className={cn("mt-1 text-[13px] font-sans font-normal shrink truncate", backgroundImage ? "text-white/80" : "text-muted-foreground")}>
              {translateText(subtitle)}
            </Text>
          ) : null}
          {timestamp ? (
            <Text
              variant="muted"
              className={cn("text-[11.5px] font-sans mt-0.5 shrink truncate", backgroundImage ? "text-white/60" : "text-muted-foreground/80")}
              numberOfLines={1}
            >
              {disableRelativeTime
                ? (typeof timestamp === 'string' && isNaN(new Date(timestamp).getTime())
                    ? timestamp
                    : formatDate(timestamp))
                : formatRelativeTime(timestamp, t)}
            </Text>
          ) : null}
        </View>

        {/* Badges */}
        {(status || secondaryBadge) && (
          <View className="items-end justify-center gap-1 ms-2 shrink-0">
            {status ? (
              <StatusBadge label={status.label} variant={status.variant} size="sm" />
            ) : null}
            {secondaryBadge ? (
              <StatusBadge label={secondaryBadge.label} variant={secondaryBadge.variant} size="sm" />
            ) : null}
          </View>
        )}
      </View>
    );

    const renderCardHeaderRow = () => {
      if (rightContent !== undefined) {
        return (
          <View className="flex-row items-center w-full">
            {onPress ? (
              <Pressable
                onPress={onPress}
                onLongPress={onLongPress}
                className="flex-1 flex-row items-center shrink min-w-0"
                accessibilityRole="button"
                accessibilityLabel={props.accessibilityLabel || title}
              >
                {renderHeaderMainContent()}
              </Pressable>
            ) : (
              renderHeaderMainContent()
            )}
            <View className="items-end justify-center ms-2 shrink-0">
              {rightContent}
            </View>
          </View>
        );
      }

      return (
        <View className="flex-row items-center w-full">
          {renderHeaderMainContent()}
          {showDefaultChevron ? (
            <View className="items-end justify-center ms-2 shrink-0">
              <Icon as={ChevronRight} size={16} className={backgroundImage ? "text-white/70" : "text-muted-foreground"} />
            </View>
          ) : null}
        </View>
      );
    };

    if (children || rightContent !== undefined) {
      return (
        <View
          ref={ref}
          className={cn("bg-card rounded-2xl border border-border/70 mb-3 p-3.5 overflow-hidden shadow-2xs", className)}
          style={style as any}
          // Keep the card's test id and accessibility props on this layout too.
          testID={(props as any).testID}
          accessibilityLabel={(props as any).accessibilityLabel}
          accessibilityHint={(props as any).accessibilityHint}
        >
          {renderCardHeaderRow()}
          {typeof children === 'function' ? (children as any)({ pressed: false }) : children}
        </View>
      );
    }

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        onLongPress={onLongPress}
        className={cn(listCardVariants(), 'overflow-hidden', className)}
        style={style}
        accessibilityRole="button"
        {...props}
      >
        {/* Background Image & Overlay */}
        {backgroundImage ? (
          <>
            <Image
              source={{ uri: backgroundImage }}
              className="absolute inset-0 w-full h-full"
              resizeMode="cover"
            />
            <View className="absolute inset-0 bg-black/60" />
          </>
        ) : null}

        {renderCardHeaderRow()}
      </Pressable>
    );
  }
);

ListCard.displayName = 'ListCard';

export { ListCard, listCardVariants };
