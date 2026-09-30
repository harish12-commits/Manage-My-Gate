import React from 'react';
import { ActivityIndicator, Pressable, PressableProps } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { Text } from './text';
import { cn } from '@/lib/utils';

interface HeaderActionButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  icon: LucideIcon;
  loading?: boolean;
  className?: string;
}

export function HeaderActionButton({
  label,
  icon: ActionIcon,
  loading = false,
  className,
  disabled,
  ...props
}: HeaderActionButtonProps) {
  return (
    <Pressable
      hitSlop={4}
      disabled={disabled || loading}
      className={cn(
        'h-10 min-w-[88px] flex-row items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-4 shadow-xs active:bg-neutral-100',
        (disabled || loading) && 'opacity-70',
        className
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#000000" />
      ) : (
        <ActionIcon size={16} color="#000000" strokeWidth={2.5} />
      )}
      <Text className="text-[13px] font-extrabold text-black" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default HeaderActionButton;
