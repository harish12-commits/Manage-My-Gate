import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Calendar, AlertCircle } from 'lucide-react-native';
import { toLocalDateKey } from '../../utils/localDate';

export interface ServiceDateRangeData {
  startDate: string;
  endDate: string;
}

export interface ServiceDateRangeStepProps {
  data: ServiceDateRangeData;
  onChange: (data: ServiceDateRangeData) => void;
}

const DURATION_PRESETS = [
  { label: '1 Month', months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: '1 Year', months: 12 },
];

export const ServiceDateRangeStep: React.FC<ServiceDateRangeStepProps> = ({
  data,
  onChange,
}) => {
  const isInvalidDateRange =
    data.startDate &&
    data.endDate &&
    data.startDate.trim() !== '' &&
    data.endDate.trim() !== '' &&
    data.startDate > data.endDate;

  const applyDurationPreset = (months: number) => {
    const start = data.startDate && data.startDate.trim() ? new Date(data.startDate) : new Date();
    const baseDate = isNaN(start.getTime()) ? new Date() : start;
    const end = new Date(baseDate);
    end.setMonth(end.getMonth() + months);
    const endDateStr = toLocalDateKey(end);
    const startDateStr = toLocalDateKey(baseDate);

    onChange({
      startDate: startDateStr,
      endDate: endDateStr,
    });
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 gap-4"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View className="gap-1">
        <Text variant="large" className="font-bold text-foreground">
          Pass Duration & Validity Period
        </Text>
        <Text variant="muted" className="text-xs">
          Set start date and pass expiration date for daily staff.
        </Text>
      </View>

      {isInvalidDateRange && (
        <View className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl flex-row items-center gap-2">
          <AlertCircle size={16} className="text-destructive" />
          <Text className="text-xs font-semibold text-destructive flex-1">
            Pass start date cannot be after end date.
          </Text>
        </View>
      )}

      {/* Quick Duration Presets */}
      <View className="gap-1.5">
        <Text className="text-xs font-bold text-muted-foreground">Quick Duration Presets</Text>
        <View className="flex-row items-center gap-2">
          {DURATION_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.label}
              onPress={() => applyDurationPreset(preset.months)}
              activeOpacity={0.7}
              className="flex-1 py-2 bg-primary/10 border border-primary/20 rounded-xl items-center justify-center"
            >
              <Text className="text-xs font-bold text-primary">{preset.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View className="bg-card border border-border rounded-2xl p-4 gap-4">
        <Input
          label="Pass Start Date (YYYY-MM-DD)"
          placeholder={toLocalDateKey()}
          leftIcon={<Calendar size={18} className="text-muted-foreground" />}
          value={data.startDate}
          onChangeText={(val) => onChange({ ...data, startDate: val })}
        />

        <Input
          label="Pass Expiration / End Date (YYYY-MM-DD)"
          placeholder="2026-12-31"
          leftIcon={<Calendar size={18} className="text-muted-foreground" />}
          value={data.endDate}
          onChangeText={(val) => onChange({ ...data, endDate: val })}
          error={isInvalidDateRange ? 'Start date cannot be after end date' : undefined}
        />
      </View>
    </ScrollView>
  );
};
