import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import { Chip } from '@/components/common/Chip';
import { Button } from '@/components/ui/button';
import { DoorOpen, Plus, Trash2, Sparkles } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';
import type { RoomStayMode } from '../../../utils/mapAmenityCreationPayloadStrategy';
import {
  ROOM_AMENITY_CHIPS,
  DURATION_PRESETS,
} from '../../../constants/amenityCatalogPresets';

export interface RoomResourceConfigData {
  isMultiResourceFacility: boolean;
  slotDurationMinutes: number | string;
  subRooms?: Array<{ id: string; name: string; capacity: number }>;
  roomAmenities?: string[];
  stayMode?: RoomStayMode;
  checkInTime?: string;
  checkOutTime?: string;
  maxNights?: number | string;
}

export interface RoomResourceConfigStepProps {
  data: RoomResourceConfigData;
  onChange: (data: RoomResourceConfigData) => void;
  errors?: Partial<Record<keyof RoomResourceConfigData, string>>;
}

export const RoomResourceConfigStep: React.FC<RoomResourceConfigStepProps> = ({
  data,
  onChange,
  errors = {},
}) => {
  const { t } = useTranslation();
  const stayMode: RoomStayMode = data.stayMode || 'HOURLY';
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCap, setNewRoomCap] = useState('8');

  const subRooms = data.subRooms || [
    { id: 'room-1', name: 'Conference Suite A', capacity: 10 },
  ];
  const roomAmenities = data.roomAmenities || ['wifi', 'projector'];
  const currentDuration = parseInt(String(data.slotDurationMinutes || 60), 10);

  const handleAddRoom = () => {
    if (!newRoomName.trim()) return;
    const added = [
      ...subRooms,
      {
        id: 'room-' + Date.now(),
        name: newRoomName.trim(),
        capacity: parseInt(newRoomCap, 10) || 6,
      },
    ];
    onChange({ ...data, subRooms: added });
    setNewRoomName('');
    setNewRoomCap('8');
  };

  const handleRemoveRoom = (id: string) => {
    const filtered = subRooms.filter((r) => r.id !== id);
    onChange({ ...data, subRooms: filtered });
  };

  const toggleAmenity = (id: string) => {
    const exists = roomAmenities.includes(id);
    const updated = exists
      ? roomAmenities.filter((a) => a !== id)
      : [...roomAmenities, id];
    onChange({ ...data, roomAmenities: updated });
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 gap-4 pb-8"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-1">
        <Text variant="large" className="font-bold text-foreground">
          Sub-Rooms & Resource Setup
        </Text>
        <Text variant="muted" className="text-xs">
          Manage individual meeting rooms, co-working suites, and in-room amenities.
        </Text>
      </View>

      {/* Sub-Room / Pod List Builder */}
      <View className="bg-card p-4 rounded-3xl border border-border gap-3.5">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-2xl bg-primary/10 items-center justify-center">
            <DoorOpen size={20} className="text-primary" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-foreground">
              Configured Room Units ({subRooms.length})
            </Text>
            <Text variant="muted" className="text-xs">
              Each unit maintains its own independent booking schedule.
            </Text>
          </View>
        </View>

        {/* Existing Sub-Rooms List */}
        <View className="gap-2">
          {subRooms.map((room) => (
            <View
              key={room.id}
              className="flex-row items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border"
            >
              <View className="gap-0.5">
                <Text className="text-sm font-bold text-foreground">
                  {room.name}
                </Text>
                <Text variant="muted" className="text-xs">
                  Max Occupancy: {room.capacity} seats
                </Text>
              </View>

              {subRooms.length > 1 && (
                <TouchableOpacity
                  onPress={() => handleRemoveRoom(room.id)}
                  className="w-8 h-8 rounded-full bg-destructive/10 items-center justify-center"
                >
                  <Trash2 size={14} className="text-destructive" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Add New Room Row */}
        <View className="bg-muted/20 p-3 rounded-2xl border border-border/80 gap-2.5 mt-1">
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Add Another Sub-Room
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <TextInput
                label="Room Identifier"
                placeholder="e.g. Pod #2, Meeting Room B"
                value={newRoomName}
                onChangeText={setNewRoomName}
              />
            </View>
            <View className="w-24">
              <TextInput
                label="Seats"
                placeholder="6"
                keyboardType="numeric"
                value={newRoomCap}
                onChangeText={setNewRoomCap}
              />
            </View>
          </View>

          <Button
            variant="outline"
            onPress={handleAddRoom}
            disabled={!newRoomName.trim()}
            className="h-10 rounded-xl flex-row items-center justify-center gap-1.5 bg-primary/10 border-primary/30"
          >
            <Plus size={15} className="text-primary" />
            <Text className="text-xs font-bold text-primary">Add Room Unit</Text>
          </Button>
        </View>
      </View>

      {/* Available Room Amenities Chips */}
      <View className="bg-card p-4 rounded-3xl border border-border gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            In-Room Equipment & Amenities
          </Text>
          <Sparkles size={14} className="text-muted-foreground" />
        </View>

        <View className="flex-row flex-wrap gap-2">
          {ROOM_AMENITY_CHIPS.map((a) => {
            const isSelected = roomAmenities.includes(a.id);
            return (
              <Chip
                key={a.id}
                label={a.label}
                selected={isSelected}
                onPress={() => toggleAmenity(a.id)}
              />
            );
          })}
        </View>
      </View>

      {/* Hourly rooms or overnight stays */}
      <View className="bg-card p-4 rounded-3xl border border-border gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t('amenity_create_stay_title', 'How are rooms booked?')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Chip
            label={t('amenity_create_stay_hourly', 'By the hour')}
            selected={stayMode === 'HOURLY'}
            onPress={() => onChange({ ...data, stayMode: 'HOURLY' })}
            testID="room-stay-HOURLY"
          />
          <Chip
            label={t('amenity_create_stay_overnight', 'Overnight stays')}
            selected={stayMode === 'OVERNIGHT'}
            onPress={() => onChange({ ...data, stayMode: 'OVERNIGHT' })}
            testID="room-stay-OVERNIGHT"
          />
        </View>
        {stayMode === 'OVERNIGHT' ? (
          <View className="gap-2">
            <View className="flex-row gap-2">
              <View className="flex-1">
                <TextInput
                  label={t('amenity_create_check_in', 'Check-in (HH:MM)')}
                  placeholder="14:00"
                  value={data.checkInTime || ''}
                  onChangeText={(checkInTime) => onChange({ ...data, checkInTime })}
                  error={errors.checkInTime}
                />
              </View>
              <View className="flex-1">
                <TextInput
                  label={t('amenity_create_check_out', 'Check-out (HH:MM)')}
                  placeholder="11:00"
                  value={data.checkOutTime || ''}
                  onChangeText={(checkOutTime) => onChange({ ...data, checkOutTime })}
                  error={errors.checkOutTime}
                />
              </View>
            </View>
            <TextInput
              label={t('amenity_create_max_nights', 'Longest stay (nights)')}
              placeholder="3"
              keyboardType="numeric"
              value={String(data.maxNights ?? '')}
              onChangeText={(maxNights) => onChange({ ...data, maxNights })}
              error={errors.maxNights}
            />
            <Text variant="muted" className="text-xs">
              {t('amenity_create_overnight_hint', 'Use a daily rate on the pricing step: it is charged per night.')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Slot Duration Chips */}
      {stayMode === 'HOURLY' ? (
      <View className="bg-card p-4 rounded-3xl border border-border gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Booking Slot Duration
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {DURATION_PRESETS.map((d) => (
            <Chip
              key={d}
              label={`${d} min`}
              selected={currentDuration === d}
              onPress={() => onChange({ ...data, slotDurationMinutes: d })}
            />
          ))}
        </View>
      </View>
      ) : null}
    </ScrollView>
  );
};

export default RoomResourceConfigStep;
