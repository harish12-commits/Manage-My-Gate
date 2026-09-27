import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import { Clock, Zap, Plus, Trash2, Calendar } from 'lucide-react-native';
import { MOCK_WEEKDAYS } from '../../mocks/visitorMocks';

export interface TimeSlotWindow {
  startTime: string; // e.g. "07:30 AM" or "07:30"
  endTime: string;   // e.g. "09:00 AM" or "09:00"
}

export interface CabScheduleData {
  usageType: 'ONE_TIME' | 'MULTI_USE';
  arrivalWindow: 'IMMEDIATE' | 'THIRTY_MINS' | 'ONE_HOUR' | 'TODAY_LATER' | 'CUSTOM';
  customVisitDate?: string;
  customStartTime?: string;
  customEndTime?: string;
  customTimeWindow?: string;
  selectedWeekdays: string[];
  timeSlots: TimeSlotWindow[];
}

export interface CabScheduleStepProps {
  data: CabScheduleData;
  onChange: (data: CabScheduleData) => void;
}

const CAB_SCHEDULE_OPTIONS = [
  { id: 'IMMEDIATE', label: 'Arriving Now (Next 15 Mins)', subtitle: 'Immediate auto-approval' },
  { id: 'THIRTY_MINS', label: 'Next 30 Minutes', subtitle: 'Cab booked & on the way' },
  { id: 'ONE_HOUR', label: 'Next 1 Hour', subtitle: 'Scheduled pickup / drop' },
  { id: 'TODAY_LATER', label: 'Later Today (Valid 4 Hours)', subtitle: 'Flexible time window' },
  { id: 'CUSTOM', label: 'Custom Timing', subtitle: 'Specify custom date & arrival time window' },
];

const DEFAULT_TIME_SLOT: TimeSlotWindow = {
  startTime: '07:30 AM',
  endTime: '09:00 AM',
};

export const CabScheduleStep: React.FC<CabScheduleStepProps> = ({
  data,
  onChange,
}) => {
  const usageType = data.usageType || 'ONE_TIME';
  const selectedWeekdays = data.selectedWeekdays || ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const timeSlots = data.timeSlots && data.timeSlots.length > 0 ? data.timeSlots : [{ startTime: '07:00 AM', endTime: '09:00 PM' }];
  const isAllSelected = selectedWeekdays.length === MOCK_WEEKDAYS.length;

  const toggleAllWeekdays = () => {
    if (isAllSelected) {
      onChange({ ...data, selectedWeekdays: [] });
    } else {
      onChange({ ...data, selectedWeekdays: MOCK_WEEKDAYS.map((d) => d.id) });
    }
  };

  const toggleWeekday = (dayId: string) => {
    const exists = selectedWeekdays.includes(dayId);
    const updated = exists
      ? selectedWeekdays.filter((d) => d !== dayId)
      : [...selectedWeekdays, dayId];
    onChange({ ...data, selectedWeekdays: updated });
  };

  const addTimeSlot = () => {
    const nextSlots = [...timeSlots, { ...DEFAULT_TIME_SLOT, startTime: '03:30 PM', endTime: '05:00 PM' }];
    onChange({ ...data, timeSlots: nextSlots });
  };

  const removeTimeSlot = (index: number) => {
    if (timeSlots.length <= 1) return;
    const nextSlots = timeSlots.filter((_, i) => i !== index);
    onChange({ ...data, timeSlots: nextSlots });
  };

  const updateTimeSlot = (index: number, key: 'startTime' | 'endTime', value: string) => {
    const nextSlots = timeSlots.map((slot, i) => (i === index ? { ...slot, [key]: value } : slot));
    onChange({ ...data, timeSlots: nextSlots });
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4">
      {/* Usage Type Segmented Toggle */}
      <View className="flex-row bg-muted/30 p-1 rounded-2xl border border-border">
        <TouchableOpacity
          onPress={() => onChange({ ...data, usageType: 'ONE_TIME' })}
          activeOpacity={0.7}
          className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
            usageType === 'ONE_TIME' ? 'bg-card border border-border shadow-xs' : ''
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              usageType === 'ONE_TIME' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            One-time Ride
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onChange({ ...data, usageType: 'MULTI_USE' })}
          activeOpacity={0.7}
          className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
            usageType === 'MULTI_USE' ? 'bg-card border border-border shadow-xs' : ''
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              usageType === 'MULTI_USE' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            Recurring / Multi-Use
          </Text>
        </TouchableOpacity>
      </View>

      {usageType === 'ONE_TIME' ? (
        <>
          <View className="gap-1">
            <Text variant="large" className="font-bold text-foreground">
              Expected Arrival Window
            </Text>
            <Text variant="muted" className="text-xs">
              Select how soon the cab or auto will reach the gate barrier.
            </Text>
          </View>

          <View className="gap-3">
            {CAB_SCHEDULE_OPTIONS.map((opt) => {
              const isSelected = data.arrivalWindow === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => onChange({ ...data, arrivalWindow: opt.id as any })}
                  activeOpacity={0.7}
                  className={`p-4 rounded-2xl border flex-row items-center justify-between ${
                    isSelected
                      ? 'bg-primary/10 border-primary'
                      : 'bg-card border-border'
                  }`}
                >
                  <View className="gap-0.5 flex-1 pe-2">
                    <View className="flex-row items-center gap-2">
                      {opt.id === 'IMMEDIATE' ? (
                        <Zap size={16} className="text-amber-500" />
                      ) : (
                        <Clock size={16} className="text-muted-foreground" />
                      )}
                      <Text
                        className={`text-sm font-bold ${
                          isSelected ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    <Text variant="muted" className="text-xs">
                      {opt.subtitle}
                    </Text>
                  </View>

                  <View
                    className={`w-5 h-5 rounded-full border items-center justify-center ${
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                    }`}
                  >
                    {isSelected ? <View className="w-2 h-2 rounded-full bg-primary-foreground" /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {data.arrivalWindow === 'CUSTOM' ? (
            <View className="bg-card border border-border rounded-2xl p-4 gap-3">
              <TextInput
                label="Visit Date (YYYY-MM-DD)"
                placeholder={new Date().toISOString().split('T')[0]}
                leftIcon={Calendar}
                value={data.customVisitDate || new Date().toISOString().split('T')[0]}
                onChangeText={(val) => onChange({ ...data, customVisitDate: val })}
              />
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <TextInput
                    label="Start Time"
                    placeholder="02:00 PM"
                    leftIcon={Clock}
                    value={data.customStartTime || '02:00 PM'}
                    onChangeText={(val) => onChange({ ...data, customStartTime: val })}
                  />
                </View>
                <View className="flex-1">
                  <TextInput
                    label="End Time"
                    placeholder="06:00 PM"
                    leftIcon={Clock}
                    value={data.customEndTime || '06:00 PM'}
                    onChangeText={(val) => onChange({ ...data, customEndTime: val })}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <>
          {/* Header section with responsive layout */}
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1 gap-0.5">
              <Text variant="large" className="font-bold text-foreground">
                Allowed Entry Weekdays
              </Text>
              <Text variant="muted" className="text-xs">
                Select days when cab entry is authorized.
              </Text>
            </View>

            <TouchableOpacity
              onPress={toggleAllWeekdays}
              activeOpacity={0.7}
              className="min-h-11 bg-primary/10 border border-primary/20 px-3 py-2 rounded-full shrink-0 items-center justify-center"
            >
              <Text className="text-xs font-bold text-primary">
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Compact Horizontal Flex Day Chips */}
          <View className="flex-row items-center justify-between gap-1.5 my-1">
            {MOCK_WEEKDAYS.map((day) => {
              const isSelected = selectedWeekdays.includes(day.id);
              return (
                <TouchableOpacity
                  key={day.id}
                  onPress={() => toggleWeekday(day.id)}
                  activeOpacity={0.7}
                  className={`flex-1 py-3 rounded-xl items-center justify-center border ${
                    isSelected
                      ? 'bg-primary border-primary shadow-xs'
                      : 'bg-card border-border'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? 'text-primary-foreground' : 'text-foreground'
                    }`}
                  >
                    {day.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Time Windows Section */}
          <View className="gap-3 mt-2">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1 gap-0.5">
                <Text variant="large" className="font-bold text-foreground">
                  Entry Time Windows
                </Text>
                <Text variant="muted" className="text-xs">
                  Configure daily entry time slots.
                </Text>
              </View>

              <TouchableOpacity
                onPress={addTimeSlot}
                activeOpacity={0.7}
              className="min-h-11 flex-row items-center justify-center gap-1 bg-primary/10 border border-primary/20 px-3 py-2 rounded-full shrink-0"
              >
                <Plus size={13} className="text-primary" />
                <Text className="text-xs font-bold text-primary">Add Time Window</Text>
              </TouchableOpacity>
            </View>

            {timeSlots.map((slot, index) => (
              <View key={index} className="p-3.5 bg-card border border-border rounded-2xl gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Clock size={16} className="text-primary" />
                    <Text className="text-xs font-bold text-foreground">
                      Time Window #{index + 1}
                    </Text>
                  </View>
                  {timeSlots.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeTimeSlot(index)}
                      activeOpacity={0.7}
                      className="min-h-11 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20 flex-row items-center justify-center gap-1"
                    >
                      <Trash2 size={12} className="text-destructive" />
                      <Text className="text-xs font-bold text-destructive">Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <TextInput
                      label="Start Time"
                      value={slot.startTime}
                      onChangeText={(txt) => updateTimeSlot(index, 'startTime', txt)}
                      placeholder="e.g. 07:30 AM"
                      inputClassName="text-xs font-semibold"
                    />
                  </View>

                  <View className="pt-4">
                    <Text className="text-xs font-bold text-muted-foreground">to</Text>
                  </View>

                  <View className="flex-1">
                    <TextInput
                      label="End Time"
                      value={slot.endTime}
                      onChangeText={(txt) => updateTimeSlot(index, 'endTime', txt)}
                      placeholder="e.g. 09:00 AM"
                      inputClassName="text-xs font-semibold"
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View className="p-3 bg-muted/20 border border-border rounded-xl mt-1">
            <Text variant="muted" className="text-xs text-center">
              Multi-use cab passes are valid for 30 days on the selected weekdays & time slots.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
};

export default CabScheduleStep;

