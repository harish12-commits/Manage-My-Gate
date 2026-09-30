import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { DropdownSelect, DropdownOption } from './DropdownSelect';
import { cn } from '../../lib/utils';

export interface DayOfMonthPickerProps {
  label?: string;
  value: string | number | null;
  onChange: (day: string) => void;
  /** Max day limit. Default is 28 to enforce safe monthly billing generation across all 12 calendar months. */
  maxDay?: number;
  /** Min day limit. Default is 1. */
  minDay?: number;
  placeholder?: string;
  error?: string;
  className?: string;
  showDropdownSelect?: boolean;
  showChipGrid?: boolean;
}

export const DayOfMonthPicker: React.FC<DayOfMonthPickerProps> = ({
  label = 'Select Day of Month',
  value,
  onChange,
  maxDay = 28,
  minDay = 1,
  placeholder = 'Select day of month',
  error,
  className,
  showDropdownSelect = true,
  showChipGrid = true,
}) => {
  const selectedDayStr = value ? String(value) : '1';

  // Build options for maxDay limit (e.g. 1 to 28)
  const options: DropdownOption[] = Array.from(
    { length: Math.max(1, maxDay - minDay + 1) },
    (_, i) => {
      const dayNum = minDay + i;
      const ordinalSuffix =
        dayNum === 1 || dayNum === 21
          ? 'st'
          : dayNum === 2 || dayNum === 22
          ? 'nd'
          : dayNum === 3 || dayNum === 23
          ? 'rd'
          : 'th';
      return {
        label: `${dayNum}${ordinalSuffix} of the month`,
        value: String(dayNum),
      };
    }
  );

  const dayNumbers = Array.from(
    { length: Math.max(1, maxDay - minDay + 1) },
    (_, i) => String(minDay + i)
  );

  return (
    <View className={cn('w-full gap-3', className)}>
      {showDropdownSelect && (
        <DropdownSelect
          label={label}
          options={options}
          value={selectedDayStr}
          onValueChange={onChange}
          placeholder={placeholder}
          error={error}
        />
      )}

      {showChipGrid && (
        <View className="gap-1.5 mt-1">
          <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 ms-0.5">
            Quick Pick Date (1 - {maxDay}):
          </Text>
          <View className="flex-row flex-wrap gap-1.5 justify-start">
            {dayNumbers.map((d) => {
              const isSelected = selectedDayStr === d;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => onChange(d)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Day ${d} of month`}
                  accessibilityState={{ selected: isSelected }}
                  className={cn(
                    'h-9 w-9 rounded-xl border items-center justify-center',
                    isSelected
                      ? 'border-primary bg-primary'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-bold',
                      isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'
                    )}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {error && !showDropdownSelect && (
        <Text className="mt-1 text-xs text-red-500 ms-0.5">{error}</Text>
      )}
    </View>
  );
};

export default DayOfMonthPicker;
