import React from 'react';
import { View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Clock, Calendar, Plus, Trash2 } from 'lucide-react-native';
import { MOCK_WEEKDAYS } from '../../mocks/visitorMocks';
import { toLocalDateKey } from '../../utils/localDate';

export interface TimeSlotWindow {
  startTime: string; // e.g. "07:00 AM"
  endTime: string;   // e.g. "09:00 AM"
}

export interface DeliveryValidityData {
  usageType?: 'ONE_TIME' | 'MULTI_USE';
  validityDuration: 'THIRTY_MINS' | 'ONE_HOUR' | 'TWO_HOURS' | 'END_OF_DAY' | 'CUSTOM';
  customVisitDate?: string;
  customStartTime?: string;
  customEndTime?: string;
  selectedWeekdays?: string[];
  timeSlots?: TimeSlotWindow[];
}

export interface DeliveryValidityStepProps {
  data: DeliveryValidityData;
  onChange: (data: DeliveryValidityData) => void;
}

const DELIVERY_VALIDITY_OPTIONS = [
  { id: 'THIRTY_MINS', label: '30 Minutes Quick Pass', subtitle: 'Instant delivery (Blinkit / Zepto / Swiggy Instamart)' },
  { id: 'ONE_HOUR', label: '1 Hour Pass', subtitle: 'Standard food delivery (Swiggy / Zomato / Talabat)' },
  { id: 'TWO_HOURS', label: '2 Hours Pass', subtitle: 'Standard e-commerce courier & parcel delivery' },
  { id: 'END_OF_DAY', label: 'Valid Until Midnight Today', subtitle: 'Flexible full-day delivery window' },
  { id: 'CUSTOM', label: 'Custom Timing', subtitle: 'Specify custom date & arrival time window' },
];

const DEFAULT_TIME_SLOT: TimeSlotWindow = {
  startTime: '06:00 AM',
  endTime: '08:00 AM',
};

export const DeliveryValidityStep: React.FC<DeliveryValidityStepProps> = ({
  data,
  onChange,
}) => {
  const usageType = data.usageType || 'ONE_TIME';
  const selectedWeekdays = data.selectedWeekdays || ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const timeSlots = data.timeSlots && data.timeSlots.length > 0 ? data.timeSlots : [{ startTime: '06:00 AM', endTime: '09:00 AM' }];
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
    const nextSlots = [...timeSlots, { ...DEFAULT_TIME_SLOT, startTime: '04:00 PM', endTime: '06:00 PM' }];
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
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 gap-4"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
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
            One-time Delivery
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
              Pass Validity Duration
            </Text>
            <Text variant="muted" className="text-xs">
              Select how long the delivery pass code remains active.
            </Text>
          </View>

          <View className="gap-3">
            {DELIVERY_VALIDITY_OPTIONS.map((opt) => {
              const isSelected = data.validityDuration === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => onChange({ ...data, validityDuration: opt.id as any })}
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
                      {opt.label}
                    </Text>
                    <Text variant="muted" className="text-xs">
                      {opt.subtitle}
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

          {data.validityDuration === 'CUSTOM' ? (
            <View className="bg-card border border-border rounded-2xl p-4 gap-3 mt-1">
              <Input
                label="Delivery Date (YYYY-MM-DD)"
                placeholder={toLocalDateKey()}
                leftIcon={<Calendar size={18} className="text-muted-foreground" />}
                value={data.customVisitDate || toLocalDateKey()}
                onChangeText={(val) => onChange({ ...data, customVisitDate: val })}
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
                Select days when recurring delivery entry is authorized.
              </Text>
            </View>

            <TouchableOpacity
              onPress={toggleAllWeekdays}
              activeOpacity={0.7}
              className="bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full shrink-0"
            >
              <Text className="text-xs font-bold text-primary">
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Day Chips */}
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
                      isSelected ? 'text-white' : 'text-foreground'
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
                  Delivery Entry Time Slots
                </Text>
                <Text variant="muted" className="text-xs">
                  Configure daily delivery entry time slots (e.g. Milk, Newspaper).
                </Text>
              </View>

              <TouchableOpacity
                onPress={addTimeSlot}
                activeOpacity={0.7}
                className="flex-row items-center gap-1 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full shrink-0"
              >
                <Plus size={13} className="text-primary" />
                <Text className="text-xs font-bold text-primary">Add Window</Text>
              </TouchableOpacity>
            </View>

            {timeSlots.map((slot, index) => (
              <View key={index} className="p-3.5 bg-card border border-border rounded-2xl gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Clock size={16} className="text-primary" />
                    <Text className="text-xs font-bold text-foreground">
                      Window #{index + 1}
                    </Text>
                  </View>
                  {timeSlots.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeTimeSlot(index)}
                      activeOpacity={0.7}
                      className="px-2 py-1 rounded-lg bg-destructive/10 border border-destructive/20 flex-row items-center gap-1"
                    >
                      <Trash2 size={12} className="text-destructive" />
                      <Text className="text-xs font-bold text-destructive">Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <Input
                      label="Start Time"
                      value={slot.startTime}
                      onChangeText={(txt) => updateTimeSlot(index, 'startTime', txt)}
                      placeholder="e.g. 06:00 AM"
                      className="text-xs font-semibold"
                    />
                  </View>

                  <View className="pt-4">
                    <Text className="text-xs font-bold text-muted-foreground">to</Text>
                  </View>

                  <View className="flex-1">
                    <Input
                      label="End Time"
                      value={slot.endTime}
                      onChangeText={(txt) => updateTimeSlot(index, 'endTime', txt)}
                      placeholder="e.g. 09:00 AM"
                      className="text-xs font-semibold"
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View className="p-3 bg-muted/20 border border-border rounded-xl mt-1">
            <Text variant="muted" className="text-xs text-center">
              Multi-use delivery passes are valid for 30 days on the selected days & time windows.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
};
