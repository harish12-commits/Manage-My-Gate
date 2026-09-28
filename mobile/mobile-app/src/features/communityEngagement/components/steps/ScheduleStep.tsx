import React from 'react';
import { View, TouchableOpacity, ScrollView, Switch, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { DatePicker } from '@/components/common/DatePicker';
import {
  EngagementContentType,
} from '../../types/communityEngagement.types';
import { cn } from '@/lib/utils';
import {
  Zap,
  CalendarClock,
  Pin,
  Clock,
  AlertCircle,
} from 'lucide-react-native';

interface ScheduleStepProps {
  contentType: EngagementContentType;
  publishNow: boolean;
  scheduleDate: string;
  expiryDate: string;
  isPinned: boolean;
  onChangeField: (field: any, value: any) => void;
  error?: string;
}

export const ScheduleStep: React.FC<ScheduleStepProps> = ({
  contentType,
  publishNow,
  scheduleDate,
  expiryDate,
  isPinned,
  onChangeField,
  error,
}) => {
  const isNotice = contentType === 'NOTICE';

  const scheduleDateObj = scheduleDate ? new Date(scheduleDate) : new Date();
  const expiryDateObj = expiryDate
    ? new Date(expiryDate)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

        {/* Publication timing mode */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Publication Timing</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => onChangeField('publishNow', true)}
              activeOpacity={0.7}
              className={cn(
                'flex-1 p-3.5 rounded-2xl border items-center justify-center gap-1.5 transition-all',
                publishNow
                  ? 'border-primary bg-primary/10 shadow-xs'
                  : 'border-border bg-card active:bg-muted/40'
              )}
              accessibilityRole="button"
              accessibilityLabel="Publish Immediately"
            >
              <Zap
                size={20}
                className={publishNow ? 'text-primary' : 'text-muted-foreground'}
              />
              <Text
                className={cn(
                  'text-xs font-bold',
                  publishNow ? 'text-primary' : 'text-foreground'
                )}
              >
                Publish Immediately
              </Text>
              <Text variant="muted" className="text-[10px] text-center">
                Live right away
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onChangeField('publishNow', false)}
              activeOpacity={0.7}
              className={cn(
                'flex-1 p-3.5 rounded-2xl border items-center justify-center gap-1.5 transition-all',
                !publishNow
                  ? 'border-primary bg-primary/10 shadow-xs'
                  : 'border-border bg-card active:bg-muted/40'
              )}
              accessibilityRole="button"
              accessibilityLabel="Schedule for Later"
            >
              <CalendarClock
                size={20}
                className={!publishNow ? 'text-primary' : 'text-muted-foreground'}
              />
              <Text
                className={cn(
                  'text-xs font-bold',
                  !publishNow ? 'text-primary' : 'text-foreground'
                )}
              >
                Schedule for Later
              </Text>
              <Text variant="muted" className="text-[10px] text-center">
                Pick future date
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Schedule Date (if not publishing now) */}
        {!publishNow && (
          <View className="gap-1">
            <DatePicker
              label={isNotice ? 'Scheduled Publication Date' : 'Poll Voting Start Date'}
              value={scheduleDateObj}
              onChange={(date: Date) => onChangeField('scheduleDate', date.toISOString())}
              minDate={new Date()}
            />
            <Text variant="muted" className="text-[11px] px-1">
              Content will remain hidden in drafts until this date is reached by the background scheduler.
            </Text>
          </View>
        )}

        {/* Expiration / Closing Date */}
        <View className="gap-1">
          <DatePicker
            label={isNotice ? 'Announcement Expiry Date' : 'Poll Voting Deadline'}
            value={expiryDateObj}
            onChange={(date: Date) => onChangeField('expiryDate', date.toISOString())}
            minDate={new Date(Date.now() + 60 * 60 * 1000)}
          />
          <Text variant="muted" className="text-[11px] px-1">
            {isNotice
              ? 'Notice will automatically be archived from the resident bulletin board after this date.'
              : 'Voting closes at midnight on this date and results become final.'}
          </Text>
        </View>

        {/* Notice Pinning Card */}
        {isNotice && (
          <View className="p-4 bg-card border border-border rounded-2xl gap-2 mt-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1 me-3 min-w-0">
                <View className="w-9 h-9 rounded-xl bg-amber-500/10 items-center justify-center shrink-0">
                  <Pin size={18} className="text-amber-500" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-bold text-foreground">Pin to Top of Feed</Text>
                  <Text variant="muted" className="text-xs">
                    Keep this announcement pinned at the head of the resident board.
                  </Text>
                </View>
              </View>
              <Switch
                value={isPinned}
                onValueChange={(val: boolean) => onChangeField('isPinned', val)}
                trackColor={{ false: '#374151', true: '#16a34a' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default ScheduleStep;
