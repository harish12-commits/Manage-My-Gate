import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, Sparkles } from 'lucide-react-native';
import { toLocalDateKey } from '../../utils/localDate';

export interface GuestScheduleData {
  visitDate: string;
  timeSlot: string; // 'NOW' | 'TODAY_EVENING' | 'TOMORROW' | 'CUSTOM'
  customTimeWindow?: string;
  customStartTime?: string;
  customEndTime?: string;
}

export interface GuestScheduleStepProps {
  data: GuestScheduleData;
  onChange: (data: GuestScheduleData) => void;
}

const SCHEDULE_PRESETS = [
  { id: 'NOW', label: 'Arriving Now (Valid 4 Hours)', subtitle: 'Immediate single entry' },
  { id: 'TODAY_EVENING', label: 'Today Evening (5 PM - 11 PM)', subtitle: 'Dinner / Party visit' },
  { id: 'TOMORROW', label: 'Tomorrow Full Day (8 AM - 10 PM)', subtitle: 'Scheduled next day' },
  { id: 'CUSTOM', label: 'Custom Time Window', subtitle: 'Specify custom start/end time' },
];

export const GuestScheduleStep: React.FC<GuestScheduleStepProps> = ({
  data,
  onChange,
}) => {
  const handleSelectPreset = (id: string) => {
    let visitDate = toLocalDateKey();
    if (id === 'TOMORROW') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      visitDate = toLocalDateKey(tomorrow);
    }

    onChange({
      ...data,
      timeSlot: id,
      visitDate,
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
          Visit Schedule & Time Window
        </Text>
        <Text variant="muted" className="text-xs">
          Select when your guest is expected to arrive at the gate.
        </Text>
      </View>

      <View className="gap-3">
        {SCHEDULE_PRESETS.map((preset) => {
          const isSelected = data.timeSlot === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              onPress={() => handleSelectPreset(preset.id)}
              activeOpacity={0.7}
              className={`p-4 rounded-2xl border flex-row items-center justify-between ${
                isSelected
                  ? 'bg-primary/10 border-primary'
                  : 'bg-card border-border'
              }`}
            >
              <View className="gap-0.5 flex-1 pe-2">
                <Text
                  className={`text-sm font-bold ${
                    isSelected ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {preset.label}
                </Text>
                <Text variant="muted" className="text-xs">
                  {preset.subtitle}
                </Text>
              </View>

              <View
                className={`w-5 h-5 rounded-full border items-center justify-center ${
                  isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                }`}
              >
                {isSelected ? <View className="w-2 h-2 rounded-full bg-white" /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {data.timeSlot === 'CUSTOM' ? (
        <View className="bg-card border border-border rounded-2xl p-4 gap-3">
          <Input
            label="Visit Date (YYYY-MM-DD)"
            placeholder={toLocalDateKey()}
            leftIcon={<Calendar size={18} className="text-muted-foreground" />}
            value={data.visitDate}
            onChangeText={(val) => onChange({ ...data, visitDate: val })}
          />
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Input
                label="Start Time"
                placeholder="02:00 PM"
                leftIcon={<Clock size={18} className="text-muted-foreground" />}
                value={data.customStartTime || '02:00 PM'}
                onChangeText={(val) => onChange({ ...data, customStartTime: val })}
              />
            </View>
            <View className="flex-1">
              <Input
                label="End Time"
                placeholder="06:00 PM"
                leftIcon={<Clock size={18} className="text-muted-foreground" />}
                value={data.customEndTime || '06:00 PM'}
                onChangeText={(val) => onChange({ ...data, customEndTime: val })}
              />
            </View>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
};
