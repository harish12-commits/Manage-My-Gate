import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { cn } from '../../lib/utils';

import { useTranslation } from '../../src/utils/i18n';
import { AppLoader } from '@/components/ui/AppLoader';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSearchDebounced?: (debouncedText: string) => void;
  debounceMs?: number;
  placeholder?: string;
  onClear?: () => void;
  loading?: boolean;
  className?: string;
  containerClassName?: string;
  onSubmitEditing?: () => void;
}

export const SearchBar = ({
  value,
  onChangeText,
  onSearchDebounced,
  debounceMs = 350,
  placeholder = 'Search...',
  onClear,
  loading = false,
  className,
  containerClassName,
  onSubmitEditing,
}: SearchBarProps) => {
  const { translateText, t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimerRef = useRef<any>(null);

  const displayPlaceholder = placeholder ? translateText(placeholder) : t('search', 'Search...');

  useEffect(() => {
    if (onSearchDebounced) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        onSearchDebounced(value);
      }, debounceMs);
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [value, debounceMs, onSearchDebounced]);

  return (
    <View
      className={cn(
        'flex-row items-center rounded-2xl bg-card border px-3.5 min-h-[44px] py-0 shadow-xs',
        'border-border/80',
        isFocused && 'border-primary shadow-sm bg-primary/5',
        containerClassName,
        className
      )}
    >
      <View pointerEvents="none">
        <Search size={18} className="me-2.5 text-muted-foreground shrink-0" />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={displayPlaceholder}
        placeholderTextColor="#737c88"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="flex-1 min-w-0 text-[14px] font-sans text-foreground self-stretch min-h-[42px] py-2"
        style={{ outlineStyle: 'none', includeFontPadding: false, textAlignVertical: 'center' } as any}
        returnKeyType="search"
        numberOfLines={1}
        onSubmitEditing={onSubmitEditing}
        accessibilityRole="search"
        accessibilityLabel={displayPlaceholder}
      />

      {loading && (
        <AppLoader variant="inline" />
      )}

      {!loading && value.length > 0 && (
        <Pressable
          onPress={() => {
            onChangeText('');
            if (onClear) onClear();
            if (onSearchDebounced) onSearchDebounced('');
          }}
          className="ms-2 rounded-full bg-muted-foreground/20 p-1"
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search text"
        >
          <X size={14} className="text-muted-foreground" />
        </Pressable>
      )}
    </View>
  );
};
