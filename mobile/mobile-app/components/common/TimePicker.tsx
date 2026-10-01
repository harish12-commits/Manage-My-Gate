import React, { useState } from 'react';
import { View, Pressable, Platform, Modal, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Clock, X } from 'lucide-react-native';
import { cn } from '../../lib/utils';

export interface TimePickerProps {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  error?: string;
  className?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ['00', '15', '30', '45'];

export const TimePicker = ({
  label,
  value,
  onChange,
  placeholder = 'Select time',
  error,
  className,
}: TimePickerProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const isValidDate = value && !isNaN(value.getTime());

  // Web platform rendering with direct styled native HTML time input
  if (Platform.OS === 'web') {
    const formattedWebValue = isValidDate
      ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
      : '';

    return (
      <View className={cn('w-full', className)}>
        {label && (
          <Text className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
            {label}
          </Text>
        )}
        <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <Clock size={20} className="me-2 text-slate-400" />
          <input
            type="time"
            className="flex-1 bg-transparent border-0 text-base font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer py-1 font-sans"
            value={formattedWebValue}
            onChange={(e) => {
              if (e.target.value) {
                const [h, m] = e.target.value.split(':').map(Number);
                const newDate = isValidDate ? new Date(value) : new Date();
                newDate.setHours(h, m, 0, 0);
                onChange(newDate);
              }
            }}
          />
        </View>
        {error && <Text className="mt-1.5 text-xs text-red-500">{error}</Text>}
      </View>
    );
  }

  // Native Mobile Time Selector Modal
  const currentHour = isValidDate ? (value.getHours() % 12 || 12) : 9;
  const currentMinuteStr = isValidDate ? String(Math.floor(value.getMinutes() / 15) * 15).padStart(2, '0') : '00';
  const currentAmPm = isValidDate ? (value.getHours() >= 12 ? 'PM' : 'AM') : 'AM';

  const [selectedHour, setSelectedHour] = useState(currentHour);
  const [selectedMinute, setSelectedMinute] = useState(currentMinuteStr);
  const [selectedAmPm, setSelectedAmPm] = useState(currentAmPm);

  const handleConfirmTime = () => {
    let hour24 = selectedHour;
    if (selectedAmPm === 'PM' && hour24 < 12) hour24 += 12;
    if (selectedAmPm === 'AM' && hour24 === 12) hour24 = 0;

    const newDate = isValidDate ? new Date(value) : new Date();
    newDate.setHours(hour24, Number(selectedMinute), 0, 0);
    onChange(newDate);
    setModalVisible(false);
  };

  return (
    <View className={cn('w-full', className)}>
      {Boolean(label) && (
        <Text className="mb-1.5 text-sm font-medium text-foreground">
          {label}
        </Text>
      )}

      <Pressable
        className={cn(
          'flex-row items-center rounded-xl border border-border bg-card px-3.5 py-3',
          Boolean(error) && 'border-destructive bg-destructive/5'
        )}
        onPress={() => setModalVisible(true)}
      >
        <Clock size={18} className="me-2.5 text-muted-foreground" />
        <Text
          className={cn(
            'flex-1 text-[15px] font-sans',
            isValidDate ? 'font-semibold text-foreground' : 'text-muted-foreground'
          )}
        >
          {isValidDate
            ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : placeholder}
        </Text>
      </Pressable>

      {Boolean(error) && <Text className="mt-1 text-xs text-destructive font-medium ms-1">{error}</Text>}

      {/* Interactive Mobile Time Selection Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center p-4">
          <View className="bg-card rounded-3xl p-5 w-full max-w-sm border border-border shadow-2xl gap-4">
            {/* Header */}
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-extrabold font-sans text-foreground">
                Select Time
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="p-1">
                <X size={18} className="text-muted-foreground" />
              </TouchableOpacity>
            </View>

            {/* Hour Picker */}
            <View className="gap-1.5">
              <Text className="text-xs font-bold font-sans text-muted-foreground">Hour:</Text>
              <View className="flex-row flex-wrap gap-1.5 justify-start">
                {HOURS.map((h) => {
                  const isSelected = selectedHour === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      onPress={() => setSelectedHour(h)}
                      className={cn(
                        'w-10 h-10 rounded-xl items-center justify-center border',
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'bg-secondary border-border'
                      )}
                    >
                      <Text className={cn('text-xs font-bold font-sans', isSelected ? 'text-primary-foreground' : 'text-foreground')}>
                        {h}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Minute Picker */}
            <View className="gap-1.5">
              <Text className="text-xs font-bold font-sans text-muted-foreground">Minute:</Text>
              <View className="flex-row gap-2">
                {MINUTES.map((m) => {
                  const isSelected = selectedMinute === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setSelectedMinute(m)}
                      className={cn(
                        'flex-1 py-2 rounded-xl items-center justify-center border',
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'bg-secondary border-border'
                      )}
                    >
                      <Text className={cn('text-xs font-bold font-sans', isSelected ? 'text-primary-foreground' : 'text-foreground')}>
                        :{m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* AM/PM Toggle */}
            <View className="flex-row gap-2">
              {['AM', 'PM'].map((period) => {
                const isSelected = selectedAmPm === period;
                return (
                  <TouchableOpacity
                    key={period}
                    onPress={() => setSelectedAmPm(period)}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl items-center justify-center border',
                      isSelected
                        ? 'bg-primary border-primary'
                        : 'bg-secondary border-border'
                    )}
                  >
                    <Text className={cn('text-xs font-extrabold font-sans', isSelected ? 'text-primary-foreground' : 'text-foreground')}>
                      {period}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Confirm CTA */}
            <TouchableOpacity
              onPress={handleConfirmTime}
              className="bg-primary rounded-xl py-3 items-center mt-2 active:opacity-90"
            >
              <Text className="text-primary-foreground font-bold font-sans text-sm">Set Time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default TimePicker;
