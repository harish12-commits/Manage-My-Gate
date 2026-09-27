import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { MOCK_WEEKDAYS } from '../../mocks/visitorMocks';
import { CalendarCheck, Check } from 'lucide-react-native';

export interface ServiceWeekdayStepProps {
  selectedWeekdays: string[];
  onToggleWeekday: (dayId: string) => void;
}

export const ServiceWeekdayStep: React.FC<ServiceWeekdayStepProps> = ({
  selectedWeekdays,
  onToggleWeekday,
}) => {
  const isAllSelected = selectedWeekdays.length === MOCK_WEEKDAYS.length;

  const toggleAll = () => {
    if (isAllSelected) {
      MOCK_WEEKDAYS.forEach((d) => {
        if (selectedWeekdays.includes(d.id)) onToggleWeekday(d.id);
      });
    } else {
      MOCK_WEEKDAYS.forEach((d) => {
        if (!selectedWeekdays.includes(d.id)) onToggleWeekday(d.id);
      });
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 gap-4">
      <View className="flex-row items-center justify-between">
        <View className="gap-0.5">
          <Text variant="large" className="font-bold text-foreground">
            Allowed Entry Weekdays
          </Text>
          <Text variant="muted" className="text-xs">
            Select days of the week when staff is authorized to enter.
          </Text>
        </View>

        <TouchableOpacity
          onPress={toggleAll}
          activeOpacity={0.7}
          className="min-h-11 bg-primary/10 border border-primary/20 px-3 py-2 rounded-full items-center justify-center"
        >
          <Text className="text-xs font-bold text-primary">
            {isAllSelected ? 'Deselect All' : 'Select All Days'}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="gap-2.5">
        {MOCK_WEEKDAYS.map((day) => {
          const isSelected = selectedWeekdays.includes(day.id);
          return (
            <TouchableOpacity
              key={day.id}
              onPress={() => onToggleWeekday(day.id)}
              activeOpacity={0.7}
              className={`p-3.5 rounded-xl border flex-row items-center justify-between ${
                isSelected
                  ? 'bg-primary/10 border-primary'
                  : 'bg-card border-border'
              }`}
            >
              <View className="flex-row items-center gap-3">
                <CalendarCheck
                  size={18}
                  className={isSelected ? 'text-primary' : 'text-muted-foreground'}
                />
                <Text
                  className={`text-sm font-bold ${
                    isSelected ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {day.fullLabel}
                </Text>
              </View>

              <View
                className={`w-5 h-5 rounded-full border items-center justify-center ${
                  isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                }`}
              >
                {isSelected ? <Check size={12} color="#fff" /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
};
