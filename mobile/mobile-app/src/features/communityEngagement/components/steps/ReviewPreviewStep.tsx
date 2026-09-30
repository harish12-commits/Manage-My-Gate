import React from 'react';
import { View, ScrollView, Image, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  CommunityEngagementFormData,
  PreviewRecipientProjection,
} from '../../types/communityEngagement.types';
import { cn } from '@/lib/utils';
import {
  Users,
  Calendar,
  Clock,
  Pin,
  MessageSquare,
  Smile,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Lock,
  Percent,
} from 'lucide-react-native';
import { AppLoader } from '@/components/ui/AppLoader';

interface ReviewPreviewStepProps {
  formData: CommunityEngagementFormData;
  previewData: PreviewRecipientProjection | null;
  previewLoading: boolean;
  error?: string;
}

export const ReviewPreviewStep: React.FC<ReviewPreviewStepProps> = ({
  formData,
  previewData,
  previewLoading,
  error,
}) => {
  const isNotice = formData.contentType === 'NOTICE';

  const audienceLabel =
    formData.targetType === 'ALL'
      ? 'All Community Residents'
      : formData.targetType === 'OWNERS_ONLY'
      ? 'Owners Only'
      : formData.targetType === 'STAFF_ONLY'
      ? 'Staff & Security Only'
      : formData.targetType === 'SPECIFIC_ROLE'
      ? 'Specific Role'
      : 'Specific Resident';

  return (
    <ScrollView
      className="flex-1 px-4 py-3"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      contentContainerStyle={{ paddingBottom: 132 }}
    >
      <View className="gap-4">
        {/* Error banner */}
        {error ? (
          <View className="flex-row items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
            <AlertTriangle size={18} className="text-destructive" />
            <Text className="text-xs text-destructive flex-1 font-medium">{error}</Text>
          </View>
        ) : null}

        <View>
          <Text className="text-base font-bold text-foreground">
            Review & Resident Feed Simulation
          </Text>
          <Text variant="muted" className="text-xs mt-0.5">
            This is exactly how your {isNotice ? 'notice' : 'poll'} will appear to residents on their mobile screens.
          </Text>
        </View>

        {/* Live Simulation Card */}
        <View className="bg-card border border-primary/20 rounded-3xl p-4 shadow-sm gap-3.5">
          {/* Header row */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-wrap flex-1 pe-2">
              {isNotice ? (
                <>
                  <View className="bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                    <Text className="text-xs font-bold text-primary">
                      {formData.category}
                    </Text>
                  </View>
                  <View
                    className={cn(
                      'px-2.5 py-1 rounded-full border',
                      formData.priority === 'Critical'
                        ? 'bg-destructive/10 border-destructive/20'
                        : formData.priority === 'High'
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-muted border-border'
                    )}
                  >
                    <Text
                      className={cn(
                        'text-xs font-semibold',
                        formData.priority === 'Critical'
                          ? 'text-destructive'
                          : formData.priority === 'High'
                          ? 'text-amber-500'
                          : 'text-foreground'
                      )}
                    >
                      {formData.priority}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View className="bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                    <Text className="text-xs font-bold text-primary">
                      {formData.choiceType === 'SINGLE_CHOICE'
                        ? 'Single Choice'
                        : `Multi Choice (Max ${formData.maxChoices})`}
                    </Text>
                  </View>
                  {formData.isAnonymous && (
                    <View className="flex-row items-center gap-1 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                      <Lock size={10} className="text-purple-500" />
                      <Text className="text-[10px] font-semibold text-purple-500">
                        Anonymous
                      </Text>
                    </View>
                  )}
                </>
              )}

              {formData.isPinned && (
                <View className="flex-row items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Pin size={11} className="text-amber-500" />
                  <Text className="text-[10px] font-bold text-amber-500">PINNED</Text>
                </View>
              )}
            </View>

            {/* Projected Status Badge */}
            <StatusBadge
              variant={formData.publishNow ? 'success' : 'warning'}
              label={formData.publishNow ? 'Will Publish' : 'Will Schedule'}
            />
          </View>

          {/* Headline & Body */}
          <View className="gap-1">
            <Text className="text-lg font-bold text-foreground">{formData.title}</Text>
            {formData.description ? (
              <Text variant="muted" className="text-xs leading-5">
                {formData.description}
              </Text>
            ) : null}
          </View>

          {/* Poll Options Simulation */}
          {!isNotice && (
            <View className="gap-2 pt-1">
              {formData.options
                .filter((opt) => opt.trim().length > 0)
                .map((opt, idx) => (
                  <View
                    key={idx}
                    className="flex-row items-center gap-3 p-3 bg-muted/30 border border-border rounded-xl"
                  >
                    <View
                      className={cn(
                        'w-4 h-4 rounded-full border border-primary items-center justify-center',
                        formData.choiceType === 'MULTIPLE_CHOICE' ? 'rounded-md' : ''
                      )}
                    />
                    <Text className="text-xs font-semibold text-foreground flex-1">
                      {opt}
                    </Text>
                  </View>
                ))}
            </View>
          )}

          {/* Notice Attachments Preview */}
          {isNotice && formData.images.length > 0 && (
            <View className="flex-row gap-2 pt-1 flex-wrap">
              {formData.images.map((img, idx) => (
                <View
                  key={idx}
                  className="w-16 h-16 rounded-xl border border-border overflow-hidden bg-muted"
                >
                  <Image
                    source={{ uri: img.uri }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>
              ))}
            </View>
          )}

          {/* Interaction preview footer */}
          {isNotice && (
            <View className="flex-row items-center gap-4 pt-2 border-t border-border/50">
              {formData.allowComments && (
                <View className="flex-row items-center gap-1.5">
                  <MessageSquare size={13} className="text-muted-foreground" />
                  <Text className="text-[11px] text-muted-foreground">Comments on</Text>
                </View>
              )}
              {formData.allowReactions && (
                <View className="flex-row items-center gap-1.5">
                  <Smile size={13} className="text-muted-foreground" />
                  <Text className="text-[11px] text-muted-foreground">Reactions on</Text>
                </View>
              )}
              {formData.requiresAcknowledgement && (
                <View className="flex-row items-center gap-1.5 ms-auto">
                  <ShieldCheck size={13} className="text-blue-500" />
                  <Text className="text-[11px] font-semibold text-blue-500">
                    Sign-off required
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Backend Target & Lifecycle Telemetry Card */}
        <View className="bg-muted/30 border border-border rounded-2xl p-4 gap-3">
          <Text className="text-xs font-bold text-foreground uppercase tracking-wider">
            Targeting & Delivery Breakdown
          </Text>

          {/* Audience */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Users size={14} className="text-primary" />
              <Text className="text-xs text-muted-foreground">Audience</Text>
            </View>
            <Text className="text-xs font-bold text-foreground">{audienceLabel}</Text>
          </View>

          {/* Estimated Recipients */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <CheckCircle size={14} className="text-primary" />
              <Text className="text-xs text-muted-foreground">Eligible Recipients</Text>
            </View>
            {previewLoading ? (
              <AppLoader variant="inline" />
            ) : (
              <Text className="text-xs font-bold text-foreground">
                {previewData?.estimatedRecipients !== undefined
                  ? `${previewData.estimatedRecipients} accounts`
                  : 'Resolving...'}
              </Text>
            )}
          </View>

          {/* Publication Date */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Clock size={14} className="text-primary" />
              <Text className="text-xs text-muted-foreground">Activation</Text>
            </View>
            <Text className="text-xs font-semibold text-foreground">
              {formData.publishNow
                ? 'Immediately upon submit'
                : new Date(formData.scheduleDate).toLocaleDateString()}
            </Text>
          </View>

          {/* Expiry Date */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Calendar size={14} className="text-primary" />
              <Text className="text-xs text-muted-foreground">
                {isNotice ? 'Archival Date' : 'Voting Closes'}
              </Text>
            </View>
            <Text className="text-xs font-semibold text-foreground">
              {new Date(formData.expiryDate).toLocaleDateString()}
            </Text>
          </View>

          {/* Quorum (Poll) */}
          {!isNotice && formData.quorumPercentage > 0 && (
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Percent size={14} className="text-primary" />
                <Text className="text-xs text-muted-foreground">Quorum Threshold</Text>
              </View>
              <Text className="text-xs font-bold text-primary">
                {formData.quorumPercentage}% required
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default ReviewPreviewStep;
