import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Phone, UserPlus, Trash2 } from 'lucide-react-native';

export interface GroupGuestItem {
  id: string;
  name: string;
  phone: string;
}

export interface AddGroupGuestsStepProps {
  guests: GroupGuestItem[];
  onAddGuest: (guest: GroupGuestItem) => void;
  onRemoveGuest?: (id: string) => void;
}

export const AddGroupGuestsStep: React.FC<AddGroupGuestsStepProps> = ({
  guests,
  onAddGuest,
  onRemoveGuest,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!name.trim()) {
      setError('Guest name is required');
      return;
    }
    
    if (phone && phone.trim()) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length !== 10) {
        setError('Contact number must be exactly 10 digits');
        return;
      }
    }
    
    setError('');
    onAddGuest({
      id: `guest-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      phone: phone.trim(),
    });
    setName('');
    setPhone('');
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
          Add Group Guests ({guests.length} Added)
        </Text>
        <Text variant="muted" className="text-xs">
          Enter names and phone numbers of guests attending your event.
        </Text>
      </View>

      <View className="bg-card border border-border rounded-2xl p-4 gap-4">
        <Input
          label="Guest Full Name"
          placeholder="e.g. Ananya Roy"
          leftIcon={<User size={18} className="text-muted-foreground" />}
          value={name}
          onChangeText={setName}
          error={error}
        />

        <Input
          label="Phone Number (Optional)"
          placeholder="9876543210"
          keyboardType="phone-pad"
          maxLength={10}
          leftIcon={<Phone size={18} className="text-muted-foreground" />}
          value={phone}
          onChangeText={setPhone}
        />

        <Button
          variant="secondary"
          onPress={handleAdd}
          className="h-11 rounded-xl flex-row items-center justify-center gap-2 border border-border"
        >
          <UserPlus size={16} className="text-foreground" />
          <Text className="font-bold text-foreground">Add Guest to List</Text>
        </Button>
      </View>

      {guests.length > 0 && (
        <View className="gap-2 pt-2">
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Added Guests ({guests.length})
          </Text>
          {guests.map((item, index) => (
            <View
              key={item.id}
              className="bg-card border border-border rounded-xl p-3 flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3 flex-1 me-2">
                <View className="w-7 h-7 rounded-full bg-primary/10 items-center justify-center">
                  <Text className="text-xs font-bold text-primary">{index + 1}</Text>
                </View>
                <View className="gap-0.5 flex-1">
                  <Text className="font-bold text-foreground text-sm" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.phone ? (
                    <Text variant="muted" className="text-xs">
                      Ph: {item.phone}
                    </Text>
                  ) : null}
                </View>
              </View>

              {onRemoveGuest ? (
                <TouchableOpacity
                  onPress={() => onRemoveGuest(item.id)}
                  activeOpacity={0.7}
                  className="w-11 h-11 rounded-xl bg-destructive/10 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={`Remove guest ${item.name}`}
                >
                  <Trash2 size={15} className="text-destructive" />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};
