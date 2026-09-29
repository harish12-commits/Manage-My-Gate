/**
 * Amenity Management Phase 6B.2 - Step: Guest & Quantity Details
 * Headcount / Quantity selection respecting facility limits and dynamic guest collection.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import { QuantitySelector } from '@/components/common/QuantitySelector';
import { Button } from '@/components/ui/button';
import { AmenityFacility, AmenityGuest } from '../../../types/amenityDomain.types';
import { Users, Wrench, Plus, Trash2, UserCheck } from 'lucide-react-native';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { ContactPickerButton } from '@/components/forms/ContactPickerButton';

export interface GuestQuantityStepProps {
  facility: AmenityFacility;
  headcount: number;
  quantity: number;
  guests: AmenityGuest[];
  notes: string;
  onHeadcountChange: (count: number) => void;
  onQuantityChange: (qty: number) => void;
  onGuestsChange: (guests: AmenityGuest[]) => void;
  onNotesChange: (notes: string) => void;
  /** Largest party / quantity this booking allows (players, venue capacity, room seats or stock). */
  maxParty?: number;
  error?: string | null;
}

export function GuestQuantityStep({
  facility,
  headcount,
  quantity,
  guests,
  notes,
  onHeadcountChange,
  onQuantityChange,
  onGuestsChange,
  onNotesChange,
  maxParty,
  error,
}: GuestQuantityStepProps) {
  const isTool = facility.archetype === 'INVENTORY_TOOLS';
  const maxHeadcount = maxParty || facility.maxHeadcountPerReservation || facility.maxCapacity || 10;

  // Local guest input fields
  const [newGuestName, setNewGuestName] = useState<string>('');
  const [newGuestPhone, setNewGuestPhone] = useState<string>('');

  const handleAddGuestRow = () => {
    if (!newGuestName.trim()) return;
    const newGuest: AmenityGuest = {
      clientId: `guest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newGuestName.trim(),
      phone: newGuestPhone.trim() || undefined,
    };
    onGuestsChange([...guests, newGuest]);
    setNewGuestName('');
    setNewGuestPhone('');
  };

  const handleRemoveGuestRow = (index: number) => {
    const updated = guests.filter((_, i) => i !== index);
    onGuestsChange(updated);
  };

  return (
    <View className="gap-4">
      {/* Header Description */}
      <View>
        <Text variant="large" className="font-bold text-foreground">
          {isTool ? 'Specify Equipment Quantity' : 'Participants & Attendees'}
        </Text>
        <Text variant="muted" className="text-xs text-muted-foreground mt-0.5">
          {isTool
            ? 'Indicate the quantity of units requested for checkout.'
            : 'Specify attendee headcount and optional companion details.'}
        </Text>
      </View>

      {/* Headcount or Quantity Selector */}
      <View className="bg-card p-4 rounded-2xl border border-border">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 me-3">
            <View className="flex-row items-center gap-2 mb-1">
              {isTool ? (
                <Wrench size={16} className="text-primary" />
              ) : (
                <Users size={16} className="text-primary" />
              )}
              <Text className="font-semibold text-sm text-foreground">
                {isTool ? 'Requested Units' : 'Total Participants'}
              </Text>
            </View>
            <Text variant="muted" className="text-xs">
              {isTool
                ? 'Subject to inventory stock availability'
                : `Maximum ${maxHeadcount} persons allowed per booking`}
            </Text>
          </View>

          {isTool ? (
            <QuantitySelector
              value={quantity}
              min={1}
              max={maxHeadcount}
              onChange={onQuantityChange}
            />
          ) : (
            <QuantitySelector
              value={headcount}
              min={1}
              max={maxHeadcount}
              onChange={onHeadcountChange}
            />
          )}
        </View>
      </View>

      {/* Companion / Guest List Collection (Optional) */}
      {!isTool && (
        <View className="bg-card p-4 rounded-2xl border border-border gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-semibold text-sm text-foreground">Additional Guest Details</Text>
            <Text variant="muted" className="text-xs font-mono">
              ({guests.length} added)
            </Text>
          </View>

          {/* Guest Rows */}
          {guests.map((g, idx) => (
            <View
              key={g.clientId || idx}
              className="p-3 rounded-xl bg-muted/30 border border-border/60 flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-2.5 flex-1 me-2">
                <UserCheck size={16} className="text-primary" />
                <View className="flex-1">
                  <Text className="font-medium text-xs text-foreground">{g.name}</Text>
                  {g.phone ? (
                    <Text variant="muted" className="text-[11px] font-mono">
                      {g.phone}
                    </Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => handleRemoveGuestRow(idx)}
                className="p-1.5 rounded-lg bg-destructive/10 text-destructive"
                accessibilityRole="button"
                accessibilityLabel={`Remove guest ${g.name}`}
              >
                <Trash2 size={14} className="text-destructive" />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Guest Form Inputs */}
          <View className="gap-2 pt-2 border-t border-border/40">
            <TextInput
              placeholder="Guest full name"
              value={newGuestName}
              onChangeText={setNewGuestName}
            />

            <View className="flex-row gap-2">
              <View className="flex-1">
                <PhoneInput
                  label=""
                  placeholder="Mobile number (optional)"
                  value={newGuestPhone}
                  onChangeText={setNewGuestPhone}
                  testID="amenity-guest-phone"
                  rightElement={
                    <ContactPickerButton
                      onPick={(c) => {
                        if (c.name) setNewGuestName(c.name);
                        if (c.phone) setNewGuestPhone(c.phone);
                      }}
                    />
                  }
                />
              </View>

              <Button
                variant="outline"
                onPress={handleAddGuestRow}
                disabled={!newGuestName.trim()}
                className="h-10 px-3 rounded-xl flex-row items-center gap-1 self-end mb-0.5"
              >
                <Plus size={14} className="text-foreground" />
                <Text className="text-xs font-semibold text-foreground">Add</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* Special Requests & Notes */}
      <View className="bg-card p-4 rounded-2xl border border-border gap-2">
        <Text className="font-semibold text-sm text-foreground">Special Instructions / Notes</Text>
        <TextInput
          placeholder="E.g., require audio setup, extra chairs, etc."
          value={notes}
          onChangeText={onNotesChange}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* Error Banner */}
      {error ? (
        <View className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <Text className="text-xs text-destructive font-medium">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default GuestQuantityStep;
