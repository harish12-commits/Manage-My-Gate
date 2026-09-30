import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, View, TextInput, Pressable } from 'react-native';
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
        'rounded-2xl border border-border/40 bg-card p-2 shadow-sm',
        className
      )}
    >
      <View
        className={cn(
          'min-h-[44px] flex-row items-center rounded-xl border border-border/80 bg-background/70 px-3.5 py-0 shadow-2xs',
          isFocused && 'border-primary ring-2 ring-primary/20',
          containerClassName
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
          className="min-h-[42px] min-w-0 flex-1 self-stretch py-2 font-sans text-[13px] font-medium text-foreground"
          style={{ outlineStyle: 'none', includeFontPadding: false, textAlignVertical: 'center' } as any}
          returnKeyType="search"
          numberOfLines={1}
          onSubmitEditing={onSubmitEditing}
          accessibilityRole="search"
          accessibilityLabel={displayPlaceholder}
        />

        {loading && (
          <ActivityIndicator size="small" color="#FF5E00" className="ms-2" />
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
    </View>
  );
};
