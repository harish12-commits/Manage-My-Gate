import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { GroupGuestItem } from './AddGroupGuestsStep';
import { User, Phone, Trash2, Users } from 'lucide-react-native';

export interface GroupGuestListStepProps {
  guests: GroupGuestItem[];
  onRemoveGuest: (id: string) => void;
  onAddMore: () => void;
}

export const GroupGuestListStep: React.FC<GroupGuestListStepProps> = ({
  guests,
  onRemoveGuest,
  onAddMore,
}) => {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 gap-4">
      <View className="flex-row items-center justify-between">
        <View className="gap-0.5">
          <Text variant="large" className="font-bold text-foreground">
            Group Guest List
          </Text>
          <Text variant="muted" className="text-xs">
            Review all visitors included in this pass.
          </Text>
        </View>

        <View className="bg-primary px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
          <Users size={14} color="#fff" />
          <Text className="text-xs font-bold text-primary-foreground">
            {guests.length} Guests
          </Text>
        </View>
      </View>

      {guests.length === 0 ? (
        <View className="bg-card border border-border border-dashed rounded-2xl p-6 items-center justify-center gap-2">
          <Users size={32} className="text-muted-foreground" />
          <Text className="font-semibold text-foreground">No Guests Added Yet</Text>
          <Text variant="muted" className="text-xs text-center">
            Go back to the previous step to add guest names.
          </Text>
          <Button variant="outline" onPress={onAddMore} className="mt-2 h-9 px-3 rounded-lg">
            <Text className="text-xs font-bold">Add Guests Now</Text>
          </Button>
        </View>
      ) : (
        <View className="gap-2.5">
          {guests.map((item, index) => (
            <View
              key={item.id}
              className="bg-card border border-border rounded-xl p-3 flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                  <Text className="text-xs font-bold text-primary">{index + 1}</Text>
                </View>
                <View className="gap-0.5">
                  <Text className="font-bold text-foreground text-sm">{item.name}</Text>
                  <Text variant="muted" className="text-xs">
                    {item.phone || 'No phone number'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => onRemoveGuest(item.id)}
                activeOpacity={0.7}
                className="w-11 h-11 rounded-xl bg-destructive/10 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={`Remove guest ${item.name}`}
              >
                <Trash2 size={16} className="text-destructive" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};
