/**
 * Amenity Management Phase 6B.2 - Step 1: Facility Resource Step
 * Resource selection for ROOM_RESOURCE and INVENTORY_TOOLS archetypes.
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AmenityFacility, AmenityResource } from '../../../types/amenityDomain.types';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { AppLoader } from '@/components/ui/AppLoader';

export interface FacilityResourceStepProps {
  facility: AmenityFacility;
  availableResources: AmenityResource[];
  selectedResource: AmenityResource | null;
  onSelectResource: (resource: AmenityResource) => void;
  loading?: boolean;
}

export function FacilityResourceStep({
  facility,
  availableResources,
  selectedResource,
  onSelectResource,
  loading = false,
}: FacilityResourceStepProps) {
  const isTool = facility.archetype === 'INVENTORY_TOOLS';

  React.useEffect(() => {
    if (
      availableResources.length === 1 &&
      !selectedResource &&
      availableResources[0].assetState === 'AVAILABLE'
    ) {
      onSelectResource(availableResources[0]);
    }
  }, [availableResources, selectedResource, onSelectResource]);

  return (
    <View className="gap-3">
      <View className="mb-1">
        <Text variant="large" className="font-bold text-foreground">
          {isTool ? 'Select Equipment Asset' : 'Select Room or Suite'}
        </Text>
        <Text variant="muted" className="text-xs text-muted-foreground mt-0.5">
          {isTool
            ? 'Choose a specific serialized tool or bulk item from community inventory.'
            : 'Choose from available guest rooms, conference halls, or suites.'}
        </Text>
      </View>

      {loading ? (
        <View className="py-8 items-center justify-center">
          <AppLoader variant="inline" />
          <Text variant="muted" className="text-xs mt-2">Loading available resources...</Text>
        </View>
      ) : availableResources.length === 0 ? (
        <View className="p-4 rounded-2xl bg-muted/40 border border-border items-center">
          <Text variant="muted" className="text-sm text-center">
            No active resources are currently listed for this facility.
          </Text>
        </View>
      ) : (
        availableResources.map((res) => {
          const isSelected = selectedResource?._id === res._id;
          const isAvailable = res.assetState === 'AVAILABLE';

          return (
            <TouchableOpacity
              key={res._id}
              disabled={!isAvailable}
              onPress={() => onSelectResource(res)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Select resource ${res.name}`}
              className={`p-4 rounded-2xl border transition-all flex-row items-center justify-between ${
                isSelected
                  ? 'bg-primary/5 border-primary shadow-sm'
                  : isAvailable
                  ? 'bg-card border-border'
                  : 'bg-muted/30 border-border/40 opacity-60'
              }`}
            >
              <View className="flex-1 me-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className={`font-semibold text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {res.name}
                  </Text>
                  <StatusBadge
                    label={res.assetState || 'AVAILABLE'}
                    variant={isAvailable ? 'success' : 'warning'}
                  />
                </View>

                <View className="flex-row items-center gap-3">
                  {res.identifier ? (
                    <Text variant="muted" className="text-xs font-mono">
                      ID: {res.identifier}
                    </Text>
                  ) : null}

                  {res.isSerializedAsset && res.serialNumber ? (
                    <Text variant="muted" className="text-xs">
                      S/N: {res.serialNumber}
                    </Text>
                  ) : (
                    <Text variant="muted" className="text-xs">
                      Total Stock: {res.totalBulkStock || 1}
                    </Text>
                  )}
                </View>
              </View>

              <View className="items-center justify-center">
                {isSelected ? (
                  <CheckCircle2 size={22} className="text-primary" />
                ) : (
                  <Circle size={22} className="text-muted-foreground/40" />
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

export default FacilityResourceStep;
