import React, { useCallback } from 'react';
import { View, ScrollView, Switch, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { DatePicker } from '@/components/common/DatePicker';
import { AttachmentPicker } from '@/components/ui/AttachmentPicker';
import { LocalAttachment } from '../../types/communityEngagement.types';
import {
  MessageSquare,
  Smile,
  CheckSquare,
  ShieldAlert,
  Paperclip,
  AlertCircle,
  Calendar,
} from 'lucide-react-native';

interface NoticeConfigStepProps {
  allowComments: boolean;
  allowReactions: boolean;
  requiresAcknowledgement: boolean;
  acknowledgementDeadline?: string;
  isCritical: boolean;
  images: LocalAttachment[];
  onChangeField: (field: any, value: any) => void;
  error?: string;
}

export const NoticeConfigStep: React.FC<NoticeConfigStepProps> = ({
  allowComments,
  allowReactions,
  requiresAcknowledgement,
  acknowledgementDeadline,
  isCritical,
  images,
  onChangeField,
  error,
}) => {
  const handleAddAttachments = useCallback(
    (newFiles: any[]) => {
      const formatted: LocalAttachment[] = newFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        uri: file.uri,
        name: file.name || `photo_${Date.now()}.jpg`,
        type: file.type || 'image/jpeg',
        isRemote: false,
        file: file.file,
      }));

      const combined = [...images, ...formatted].slice(0, 5); // Enforce max 5 attachments
      onChangeField('images', combined);
    },
    [images, onChangeField]
  );

  const handleRemoveAttachment = useCallback(
    (index: number) => {
      const filtered = images.filter((_, i) => i !== index);
      onChangeField('images', filtered);
    },
    [images, onChangeField]
  );

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
            <AlertCircle size={18} className="text-destructive" />
            <Text className="text-xs text-destructive flex-1 font-medium">{error}</Text>
          </View>
        ) : null}

        <View>
          <Text className="text-base font-bold text-foreground">
            Notice Engagement & Attachments
          </Text>
          <Text variant="muted" className="text-xs mt-0.5">
            Configure resident interaction settings and upload supporting documents or images.
          </Text>
        </View>

        {/* Resident Interactions Section */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-4">
          <Text className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
            Resident Interaction
          </Text>

          {/* Allow Comments */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1 me-3 min-w-0">
              <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center shrink-0">
                <MessageSquare size={18} className="text-primary" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-bold text-foreground">Allow Comments</Text>
                <Text variant="muted" className="text-xs">
                  Residents can discuss and reply under this announcement.
                </Text>
              </View>
            </View>
            <Switch
              value={allowComments}
              onValueChange={(val: boolean) => onChangeField('allowComments', val)}
              trackColor={{ false: '#374151', true: '#16a34a' }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Allow Reactions */}
          <View className="flex-row items-center justify-between pt-2 border-t border-border/50">
            <View className="flex-row items-center gap-3 flex-1 me-3 min-w-0">
              <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center shrink-0">
                <Smile size={18} className="text-primary" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-bold text-foreground">Allow Reactions</Text>
                <Text variant="muted" className="text-xs">
                  Enable resident emoji reactions (Like, Applaud, Caution).
                </Text>
              </View>
            </View>
            <Switch
              value={allowReactions}
              onValueChange={(val: boolean) => onChangeField('allowReactions', val)}
              trackColor={{ false: '#374151', true: '#16a34a' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Governance & Sign-off Section */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-4">
          <Text className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
            Compliance & Alerts
          </Text>

          {/* Requires Acknowledgement */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1 me-3 min-w-0">
              <View className="w-9 h-9 rounded-xl bg-blue-500/10 items-center justify-center shrink-0">
                <CheckSquare size={18} className="text-blue-500" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-bold text-foreground">
                  Require Resident Sign-off
                </Text>
                <Text variant="muted" className="text-xs">
                  Tracks which residents have confirmed reading this notice.
                </Text>
              </View>
            </View>
            <Switch
              value={requiresAcknowledgement}
              onValueChange={(val: boolean) =>
                onChangeField('requiresAcknowledgement', val)
              }
              trackColor={{ false: '#374151', true: '#16a34a' }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Conditional Sign-off Deadline */}
          {requiresAcknowledgement && (
            <View className="pt-2 border-t border-border/50 gap-2">
              <View className="flex-row items-center gap-2">
                <Calendar size={15} className="text-primary" />
                <Text className="text-xs font-semibold text-foreground">Sign-off Deadline</Text>
              </View>
              <DatePicker
                label="Sign-off Deadline"
                value={acknowledgementDeadline ? new Date(acknowledgementDeadline) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)}
                onChange={(date: Date) => onChangeField('acknowledgementDeadline', date.toISOString())}
              />
            </View>
          )}

          {/* Critical Emergency Broadcast */}
          <View className="flex-row items-center justify-between pt-2 border-t border-border/50">
            <View className="flex-row items-center gap-3 flex-1 me-3 min-w-0">
              <View className="w-9 h-9 rounded-xl bg-destructive/10 items-center justify-center shrink-0">
                <ShieldAlert size={18} className="text-destructive" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-bold text-foreground">
                  Emergency Priority Broadcast
                </Text>
                <Text variant="muted" className="text-xs">
                  Bypasses quiet hours with immediate high-priority push alerts.
                </Text>
              </View>
            </View>
            <Switch
              value={isCritical}
              onValueChange={(val: boolean) => onChangeField('isCritical', val)}
              trackColor={{ false: '#374151', true: '#16a34a' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Photos & Document Attachments (Details first, media at bottom) */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-3">
          <View className="flex-row items-center gap-2">
            <Paperclip size={16} className="text-primary" />
            <Text className="text-sm font-bold text-foreground">
              Attachments ({images.length}/5)
            </Text>
          </View>
          <Text variant="muted" className="text-xs">
            Add photos, circular PDFs, or inspection photos. Max 5 files.
          </Text>

          <AttachmentPicker
            attachments={images as any}
            onAdd={handleAddAttachments}
            onRemove={handleRemoveAttachment}
            maxFiles={5}
          />
        </View>
      </View>
    </ScrollView>
  );
};

export default NoticeConfigStep;
