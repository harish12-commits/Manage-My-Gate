import React from 'react';
import { View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { TextInput } from '@/components/forms/TextInput';
import { Text } from '@/components/ui/text';
import {
  EngagementContentType,
  NoticeCategory,
  NoticePriority,
} from '../../types/communityEngagement.types';
import { cn } from '@/lib/utils';
import { Tag, AlertCircle, FileText, HelpCircle } from 'lucide-react-native';

interface BasicInfoStepProps {
  contentType: EngagementContentType;
  title: string;
  description: string;
  category: NoticeCategory;
  priority: NoticePriority;
  onChangeField: (field: any, value: any) => void;
  error?: string;
}

const NOTICE_CATEGORIES: { label: string; value: NoticeCategory }[] = [
  { label: 'General', value: 'General' },
  { label: 'Maintenance', value: 'Maintenance' },
  { label: 'Events', value: 'Events' },
  { label: 'Emergency', value: 'Emergency' },
  { label: 'Meetings', value: 'Meetings' },
  { label: 'Rules', value: 'Rules' },
];

const PRIORITY_OPTIONS: { label: string; value: NoticePriority; color: string }[] = [
  { label: 'Low', value: 'Low', color: 'border-muted-foreground/30 bg-muted/30' },
  { label: 'Medium', value: 'Medium', color: 'border-blue-500/30 bg-blue-500/10' },
  { label: 'High', value: 'High', color: 'border-amber-500/30 bg-amber-500/10' },
  { label: 'Critical', value: 'Critical', color: 'border-destructive/30 bg-destructive/10' },
];

export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  contentType,
  title,
  description,
  category,
  priority,
  onChangeField,
  error,
}) => {
  const isNotice = contentType === 'NOTICE';

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
        {/* Error banner if present */}
        {error ? (
          <View className="flex-row items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
            <AlertCircle size={18} className="text-destructive" />
            <Text className="text-xs text-destructive flex-1 font-medium">{error}</Text>
          </View>
        ) : null}

        {/* Title / Question Input */}
        <View>
          <TextInput
            label={isNotice ? 'Announcement Headline' : 'Poll Question'}
            placeholder={
              isNotice
                ? 'e.g., Annual Water Tank Cleaning Schedule'
                : 'e.g., Should we install EV charging stations in Basement 2?'
            }
            value={title}
            onChangeText={(val) => onChangeField('title', val)}
            required
            leftIcon={isNotice ? FileText : HelpCircle}
            helperText={
              isNotice
                ? 'Clear headline that residents immediately recognize in their notifications.'
                : 'Clear, objective question for residents to vote on.'
            }
          />
        </View>

        {/* Notice Category Presets */}
        {isNotice && (
          <View className="gap-2">
            <View className="flex-row items-center gap-1.5">
              <Tag size={15} className="text-primary" />
              <Text className="text-sm font-semibold text-foreground">Category</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {NOTICE_CATEGORIES.map((cat) => {
                const isSelected = category === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => onChangeField('category', cat.value)}
                    activeOpacity={0.7}
                    className={cn(
                      'px-3.5 py-2 rounded-xl border transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card active:bg-muted/40'
                    )}
                    accessibilityRole="button"
                    accessibilityLabel={`Category ${cat.label}`}
                  >
                    <Text
                      className={cn(
                        'text-xs font-semibold',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Notice Priority Presets */}
        {isNotice && (
          <View className="gap-2">
            <View className="flex-row items-center gap-1.5">
              <AlertCircle size={15} className="text-primary" />
              <Text className="text-sm font-semibold text-foreground">Priority Level</Text>
            </View>
            <View className="flex-row gap-2">
              {PRIORITY_OPTIONS.map((p) => {
                const isSelected = priority === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    onPress={() => onChangeField('priority', p.value)}
                    activeOpacity={0.7}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl border items-center justify-center transition-all',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                        : cn('border-border bg-card', p.color)
                    )}
                    accessibilityRole="button"
                    accessibilityLabel={`Priority ${p.label}`}
                  >
                    <Text
                      className={cn(
                        'text-xs font-bold',
                        isSelected ? 'text-primary-foreground' : 'text-foreground'
                      )}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Description / Additional Context */}
        <View>
          <TextInput
            label={isNotice ? 'Full Notice Details' : 'Background / Context (Optional)'}
            placeholder={
              isNotice
                ? 'Provide complete information regarding dates, affected blocks, and contact persons...'
                : 'Explain why this vote is taking place and provide any necessary context...'
            }
            value={description}
            onChangeText={(val) => onChangeField('description', val)}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            required={isNotice}
            helperText={
              isNotice
                ? 'Markdown formatting and line breaks will be preserved.'
                : 'Optional context to help voters make an informed choice.'
            }
          />
        </View>
      </View>
    </ScrollView>
  );
};

export default BasicInfoStep;
