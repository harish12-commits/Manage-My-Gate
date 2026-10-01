import React from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { Check } from 'lucide-react-native';
import { AmenityArchetype } from '../../types/amenityDomain.types';
import { ARCHETYPE_CATALOG_OPTIONS, ArchetypeCatalogOption } from '../../constants/amenityCatalogPresets';
import { cn } from '@/lib/utils';

export interface AmenityArchetypeSheetProps {
  visible: boolean;
  selectedArchetype?: AmenityArchetype;
  onClose: () => void;
  onSelectArchetype: (archetype: AmenityArchetype) => void;
}

export const AmenityArchetypeSheet: React.FC<AmenityArchetypeSheetProps> = ({
  visible,
  selectedArchetype = 'SHARED_CAPACITY',
  onClose,
  onSelectArchetype,
}) => {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Facility Archetype">
      <View className="gap-3 pb-6 px-1 py-1">
        <Text variant="muted" className="text-xs px-1">
          Choose the architectural archetype to configure adaptive capacity, booking rules, and allocation policies.
        </Text>

        {ARCHETYPE_CATALOG_OPTIONS.map((option: ArchetypeCatalogOption) => {
          const IconComp = option.icon;
          const isSelected = selectedArchetype === option.archetype;

          return (
            <TouchableOpacity
              key={option.archetype}
              onPress={() => {
                onSelectArchetype(option.archetype);
                onClose();
              }}
              activeOpacity={0.7}
              className={cn(
                'flex-row items-center bg-card border rounded-2xl p-3.5 gap-3.5 transition-all',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-xs'
                  : 'border-border active:bg-muted/40'
              )}
              accessibilityRole="button"
              accessibilityLabel={`Select archetype ${option.label}`}
            >
              <View
                className={cn(
                  'w-11 h-11 rounded-xl items-center justify-center',
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                )}
              >
                <IconComp
                  size={22}
                  className={isSelected ? 'text-primary-foreground' : 'text-primary'}
                />
              </View>

              <View className="flex-1 gap-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-bold text-foreground">
                    {option.label}
                  </Text>
                  {option.badge ? (
                    <View className="bg-secondary px-2 py-0.5 rounded-full border border-border">
                      <Text className="text-[10px] font-semibold text-secondary-foreground">
                        {option.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text variant="muted" className="text-xs leading-4">
                  {option.hint}
                </Text>

                <Text className="text-[11px] text-primary/80 font-medium">
                  e.g. {option.examples}
                </Text>
              </View>

              {isSelected ? (
                <View className="w-6 h-6 rounded-full bg-primary items-center justify-center ms-1">
                  <Check size={14} className="text-primary-foreground" />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
};

export default AmenityArchetypeSheet;
