import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { ArrowLeft, X } from 'lucide-react-native';
import { AmenityArchetype } from '../../types/amenityDomain.types';
import { ARCHETYPE_CATALOG_OPTIONS } from '../../constants/amenityCatalogPresets';
import { cn } from '@/lib/utils';

export interface AmenityCreationFlowHeaderProps {
  archetype: AmenityArchetype;
  stepTitle: string;
  stepSubtitle?: string;
  stepIndex: number;
  totalSteps: number;
  isEditing?: boolean;
  onBack?: () => void;
  onCancel: () => void;
}

export const AmenityCreationFlowHeader: React.FC<AmenityCreationFlowHeaderProps> = ({
  archetype,
  stepTitle,
  stepSubtitle,
  stepIndex,
  totalSteps,
  isEditing = false,
  onBack,
  onCancel,
}) => {
  const currentMeta = ARCHETYPE_CATALOG_OPTIONS.find((o) => o.archetype === archetype) || ARCHETYPE_CATALOG_OPTIONS[0];
  const IconComp = currentMeta.icon;

  const insets = useSafeAreaInsets();

  return (
    <View className="bg-card border-b border-border px-4 pb-3 gap-2"
      style={{ paddingTop: Math.max(insets.top, 12) }}>
      {/* Top action row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1">
          {onBack && stepIndex > 0 ? (
            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.7}
              className="w-9 h-9 rounded-full bg-muted/60 items-center justify-center -ms-1"
              accessibilityRole="button"
              accessibilityLabel="Go back to previous step"
            >
              <ArrowLeft size={18} className="text-foreground" />
            </TouchableOpacity>
          ) : null}

          <View className="flex-1 min-w-0 me-1">
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              numberOfLines={1}
              className="text-sm sm:text-base font-bold text-foreground"
            >
              {isEditing ? 'Edit Amenity' : 'Create Amenity'}
            </Text>
            <Text variant="muted" className="text-xs">
              Step {stepIndex + 1} of {totalSteps}
            </Text>
          </View>
        </View>

        {/* Active Archetype Badge (Read-only) */}
        <View className="flex-row items-center gap-1 px-2 py-1 rounded-full border border-primary/20 bg-primary/10 shrink-0">
          <IconComp size={12} className="text-primary" />
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            numberOfLines={1}
            className="text-[11px] sm:text-xs font-bold text-primary"
          >
            {currentMeta.label}
          </Text>
        </View>

        {/* Cancel / Close button */}
        <TouchableOpacity
          onPress={onCancel}
          activeOpacity={0.7}
          className="w-9 h-9 rounded-full bg-muted/60 items-center justify-center ms-2"
          accessibilityRole="button"
          accessibilityLabel="Close creation wizard"
        >
          <X size={18} className="text-muted-foreground" />
        </TouchableOpacity>
      </View>

      {/* Step title & subtitle */}
      <View className="pt-0.5">
        <Text className="text-lg font-bold text-foreground">
          {stepTitle}
        </Text>
        {stepSubtitle ? (
          <Text variant="muted" className="text-xs mt-0.5">
            {stepSubtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export default AmenityCreationFlowHeader;
