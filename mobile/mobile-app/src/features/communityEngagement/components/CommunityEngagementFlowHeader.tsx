import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { ArrowLeft, Bell, BarChart3 } from 'lucide-react-native';
import { EngagementContentType } from '../types/communityEngagement.types';

export interface CommunityEngagementFlowHeaderProps {
  contentType: EngagementContentType;
  stepTitle: string;
  stepSubtitle?: string;
  stepIndex: number;
  totalSteps: number;
  isEditMode?: boolean;
  onBack?: () => void;
}

export const CommunityEngagementFlowHeader: React.FC<CommunityEngagementFlowHeaderProps> = ({
  contentType,
  stepTitle,
  stepSubtitle,
  stepIndex,
  totalSteps,
  isEditMode = false,
  onBack,
}) => {
  const isNotice = contentType === 'NOTICE';
  const IconComp = isNotice ? Bell : BarChart3;
  const typeLabel = isNotice ? 'Notice' : 'Poll';

  const insets = useSafeAreaInsets();

  return (
    <View className="bg-card border-b border-border px-4 pb-3 gap-2"
      style={{ paddingTop: Math.max(insets.top, 12) }}>
      {/* Top action row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1">
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.7}
              className="w-11 h-11 rounded-xl bg-muted items-center justify-center -ms-1"
              accessibilityRole="button"
              accessibilityLabel={stepIndex > 0 ? 'Go back to previous step' : 'Go back'}
            >
              <ArrowLeft size={18} className="text-foreground" />
            </TouchableOpacity>
          ) : null}

          <View className="flex-1">
            <Text className="text-base font-bold text-foreground" numberOfLines={1}>
              {isEditMode
                ? isNotice
                  ? 'Edit Community Notice'
                  : 'Edit Community Poll'
                : isNotice
                ? 'Create Community Notice'
                : 'Create Community Poll'}
            </Text>
            <Text variant="muted" className="text-xs">
              Step {stepIndex + 1} of {totalSteps}
            </Text>
          </View>
        </View>

        {/* Static Locked Type Badge (No dropdown, no chevron, read-only) */}
        <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/10">
          <IconComp size={13} className="text-primary" />
          <Text className="text-xs font-bold text-primary">{typeLabel}</Text>
        </View>

      </View>

      {/* Step title & subtitle */}
      <View className="pt-0.5">
        <Text className="text-lg font-bold text-foreground">{stepTitle}</Text>
        {stepSubtitle ? (
          <Text variant="muted" className="text-xs mt-0.5">
            {stepSubtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export default CommunityEngagementFlowHeader;
