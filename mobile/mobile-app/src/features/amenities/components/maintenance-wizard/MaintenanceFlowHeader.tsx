import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { ArrowLeft, X, Wrench } from 'lucide-react-native';
import { getArchetypeMeta } from '../../utils/amenityPresentation';

export interface MaintenanceFlowHeaderProps {
  category?: string;
  stepTitle: string;
  stepSubtitle?: string;
  onBack?: () => void;
  onCancel: () => void;
  canGoBack?: boolean;
}

export const MaintenanceFlowHeader: React.FC<MaintenanceFlowHeaderProps> = ({
  category = 'GENERAL',
  stepTitle,
  stepSubtitle,
  onBack,
  onCancel,
  canGoBack = true,
}) => {
  const archetypeMeta = getArchetypeMeta(category);

  const insets = useSafeAreaInsets();

  return (
    <View className="bg-card border-b border-border px-4 pb-3 gap-2"
      style={{ paddingTop: Math.max(insets.top, 12) }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          {canGoBack && onBack ? (
            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.7}
              className="w-9 h-9 rounded-full bg-muted items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Go back to previous step"
            >
              <ArrowLeft size={18} className="text-foreground" />
            </TouchableOpacity>
          ) : (
            <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center">
              <Wrench size={18} className="text-primary" />
            </View>
          )}

          <View className="bg-secondary px-2.5 py-1 rounded-full border border-border">
            <Text className="text-xs font-bold text-secondary-foreground">
              {archetypeMeta.label || category}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onCancel}
          activeOpacity={0.7}
          className="w-9 h-9 rounded-full bg-muted items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Cancel maintenance wizard"
        >
          <X size={18} className="text-foreground" />
        </TouchableOpacity>
      </View>

      <View>
        <Text variant="h3" className="font-bold text-foreground">
          {stepTitle}
        </Text>
        {stepSubtitle ? (
          <Text variant="muted" className="text-xs text-muted-foreground mt-0.5">
            {stepSubtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export default MaintenanceFlowHeader;
