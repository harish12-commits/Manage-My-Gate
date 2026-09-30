import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Button } from '../../../../components/ui/button';
import { Icon } from '../../../../components/ui/icon';
import { Plug } from 'lucide-react-native';
import {
  useRoleIntegrationConfigurator,
  PROVIDERS,
  ProviderItem,
  IntegrationConnection,
} from '../hooks/useRoleIntegrationConfigurator';
import { AppLoader } from '@/components/ui/AppLoader';

interface RoleIntegrationConfiguratorProps {
  isOpen: boolean;
  onClose: () => void;
  mappings: Record<string, string>;
  onApply: (mappings: Record<string, string>) => void;
}

export const RoleIntegrationConfigurator: React.FC<RoleIntegrationConfiguratorProps> = ({
  isOpen,
  onClose,
  mappings,
  onApply,
}) => {
  const {
    isLoading,
    selectedProvider,
    setSelectedProvider,
    tempMappings,
    filteredConnections,
    handleSelectConnection,
    handleApply,
  } = useRoleIntegrationConfigurator(isOpen, mappings, onApply, onClose);

  if (!isOpen) return null;

  return (
    <View className="mt-2.5 p-2.5 border border-primary/30 rounded-xl bg-primary/5 gap-2.5">
      {/* Title Header */}
      <View className="flex-row items-center justify-between pb-2 border-b border-primary/20">
        <View className="flex-row items-center gap-1.5">
          <View className="p-1 rounded bg-primary/20 border border-primary/30">
            <Icon as={Plug} size={13} className="text-primary" />
          </View>
          <View>
            <Text className="text-[11px] font-extrabold text-primary">
              Integration Hub Connections
            </Text>
            <Text className="text-[9px] text-muted-foreground">
              Bind active provider credentials to this role
            </Text>
          </View>
        </View>
      </View>

      {/* Horizontal Provider Carousel */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-0.5">
        <View className="flex-row items-center gap-1.5">
          {PROVIDERS.map((provider: ProviderItem) => {
            const isSelected = selectedProvider === provider.id;
            const isMapped = !!tempMappings[provider.id];

            return (
              <TouchableOpacity
                key={provider.id}
                onPress={() => setSelectedProvider(provider.id)}
                activeOpacity={0.8}
                className={`px-2.5 py-1.5 rounded-lg border flex-row items-center gap-1.5 ${
                  isSelected
                    ? 'bg-primary border-primary shadow-xs'
                    : 'bg-card border-border'
                }`}
              >
                <Text className="text-xs">{provider.icon}</Text>
                <Text
                  className={`text-[11px] font-bold ${
                    isSelected ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {provider.name}
                </Text>
                {isMapped && (
                  <View
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-emerald-500'
                    }`}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Connections List for Selected Provider */}
      <View className="border border-border rounded-xl bg-card overflow-hidden">
        {isLoading ? (
          <View className="py-4 items-center justify-center">
            <AppLoader variant="inline" />
            <Text className="text-[10px] text-muted-foreground mt-1">Loading connections...</Text>
          </View>
        ) : (
          <View className="p-1.5 gap-1">
            {/* None / Disconnect Option */}
            <TouchableOpacity
              onPress={() => handleSelectConnection(null)}
              activeOpacity={0.7}
              className={`flex-row items-center justify-between p-2 rounded-lg border ${
                !tempMappings[selectedProvider]
                  ? 'bg-primary/10 border-primary/40'
                  : 'bg-muted/20 border-border/60'
              }`}
            >
              <Text className="text-[11px] font-semibold text-muted-foreground italic">
                (None / Disconnect Provider)
              </Text>
              <View
                className={`w-3.5 h-3.5 rounded-full border items-center justify-center ${
                  !tempMappings[selectedProvider]
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                }`}
              >
                {!tempMappings[selectedProvider] && (
                  <View className="w-1 h-1 rounded-full bg-white" />
                )}
              </View>
            </TouchableOpacity>

            {/* Configured Connections List */}
            {filteredConnections.length === 0 ? (
              <View className="py-3 px-2 items-center">
                <Text className="text-[10px] text-muted-foreground text-center">
                  No active {selectedProvider.toUpperCase()} connections in Integration Hub.
                </Text>
              </View>
            ) : (
              filteredConnections.map((conn: IntegrationConnection) => {
                const isChecked = tempMappings[selectedProvider] === conn.id;

                return (
                  <TouchableOpacity
                    key={conn.id}
                    onPress={() => handleSelectConnection(conn.id)}
                    activeOpacity={0.7}
                    className={`flex-row items-center justify-between p-2 rounded-lg border ${
                      isChecked
                        ? 'bg-primary/10 border-primary/50'
                        : 'bg-muted/20 border-border/60'
                    }`}
                  >
                    <View className="flex-1 me-1.5">
                      <Text className="text-[11px] font-bold text-foreground">
                        {conn.accountLabel}
                      </Text>
                      <Text className="text-[9px] text-emerald-600 font-medium">
                        Connected & Active
                      </Text>
                    </View>

                    <View
                      className={`w-3.5 h-3.5 rounded-full border items-center justify-center ${
                        isChecked ? 'border-primary bg-primary' : 'border-muted-foreground'
                      }`}
                    >
                      {isChecked && <View className="w-1 h-1 rounded-full bg-white" />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </View>

      {/* Action Bar */}
      <View className="flex-row items-center justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" size="sm" className="rounded-lg px-2.5 h-8" onPress={onClose}>
          <Text className="text-xs text-foreground">Cancel</Text>
        </Button>
        <Button variant="default" size="sm" className="rounded-lg px-3 h-8 font-bold" onPress={handleApply}>
          <Text className="text-xs text-white font-bold">Apply</Text>
        </Button>
      </View>
    </View>
  );
};

export default RoleIntegrationConfigurator;
