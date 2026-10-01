import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Plug, Check } from 'lucide-react-native';
import { ProviderCatalogItem } from '../services/integrationHubApi';
import { Text } from '@/components/ui/text';

interface ProviderCardProps {
  provider: ProviderCatalogItem;
  activeCount?: number;
  onConnect: (provider: ProviderCatalogItem) => void;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  activeCount = 0,
  onConnect,
}) => {
  const isMapped = activeCount > 0;

  const getProviderColorClass = (id: string) => {
    switch (id.toLowerCase()) {
      case 'smtp':
      case 'resend':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-600';
      case 'twilio':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-600';
      case 'openai':
        return 'bg-purple-500/10 border-purple-500/30 text-purple-600';
      case 'firebase':
        return 'bg-orange-500/10 border-orange-500/30 text-orange-600';
      case 'razorpay':
      case 'banking':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600';
      default:
        return 'bg-primary/10 border-primary/30 text-primary';
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onConnect(provider)}
      accessibilityRole="button"
      accessibilityLabel={`${isMapped ? 'Manage' : 'Connect'} ${provider.name}`}
      className="bg-card border border-border/80 rounded-2xl p-3 shadow-xs w-44 justify-between me-2.5"
    >
      {/* Top Header Row: Icon + Status */}
      <View className="flex-row items-center justify-between mb-2">
        <View
          className={`w-9 h-9 rounded-xl items-center justify-center border shrink-0 ${getProviderColorClass(
            provider.id
          )}`}
        >
          <Text className="text-base">{provider.icon || '🔌'}</Text>
        </View>

        <View
          className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full border ${
            isMapped
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-muted/80 border-border/60'
          }`}
        >
          <View
            className={`w-1.5 h-1.5 rounded-full ${
              isMapped ? 'bg-emerald-500' : 'bg-muted-foreground/60'
            }`}
          />
          <Text
            className={`text-[9px] font-bold uppercase tracking-wide ${
              isMapped ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
            }`}
          >
            {isMapped ? `${activeCount} Active` : 'Available'}
          </Text>
        </View>
      </View>

      {/* Provider Info */}
      <View className="mb-2.5">
        <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
          {provider.name}
        </Text>
        <Text className="text-[11px] text-muted-foreground mt-0.5" numberOfLines={1}>
          {provider.category || 'Integration'}
        </Text>
      </View>

      {/* Action Indicator */}
      <View
        className={`w-full rounded-xl py-1.5 px-2 flex-row items-center justify-center gap-1.5 border ${
          isMapped
            ? 'bg-blue-500/10 border-blue-500/20'
            : 'bg-primary border-primary'
        }`}
      >
        {isMapped ? (
          <>
            <Check size={12} className="text-blue-600 dark:text-blue-400" />
            <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
              Configured
            </Text>
          </>
        ) : (
          <>
            <Plug size={12} color="#ffffff" />
            <Text className="text-xs font-bold text-primary-foreground">
              Connect
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default ProviderCard;
