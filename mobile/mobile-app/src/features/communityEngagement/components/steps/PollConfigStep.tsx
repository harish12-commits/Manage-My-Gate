import React from 'react';
import { View, TouchableOpacity, ScrollView, Switch, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import {
  PollChoiceType,
  PollVotingMode,
  PollResultsVisibility,
} from '../../types/communityEngagement.types';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  CheckSquare,
  Users,
  Eye,
  Lock,
  Percent,
  AlertCircle,
} from 'lucide-react-native';

interface PollConfigStepProps {
  options: string[];
  choiceType: PollChoiceType;
  maxChoices: number;
  votingMode: PollVotingMode;
  resultsVisibility: PollResultsVisibility;
  isAnonymous: boolean;
  quorumPercentage: number;
  onChangeField: (field: any, value: any) => void;
  error?: string;
}

const QUORUM_PRESETS = [0, 25, 50, 75];

export const PollConfigStep: React.FC<PollConfigStepProps> = ({
  options,
  choiceType,
  maxChoices,
  votingMode,
  resultsVisibility,
  isAnonymous,
  quorumPercentage,
  onChangeField,
  error,
}) => {
  const handleAddOption = () => {
    if (options.length < 10) {
      onChangeField('options', [...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const updated = options.filter((_, i) => i !== index);
      onChangeField('options', updated);
    }
  };

  const handleOptionChange = (text: string, index: number) => {
    const updated = [...options];
    updated[index] = text;
    onChangeField('options', updated);
  };

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
            Ballot Options & Voting Rules
          </Text>
          <Text variant="muted" className="text-xs mt-0.5">
            Configure candidate options, voting weights, privacy, and quorum requirements.
          </Text>
        </View>

        {/* Dynamic Options List */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-foreground">
              Options ({options.length}/10)
            </Text>
            {options.length < 10 && (
              <TouchableOpacity
                onPress={handleAddOption}
                className="flex-row items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20"
                accessibilityRole="button"
                accessibilityLabel="Add option"
              >
                <Plus size={14} className="text-primary" />
                <Text className="text-xs font-bold text-primary">Add Option</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="gap-2.5 pt-1">
            {options.map((opt, idx) => (
              <View key={idx} className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-full bg-muted items-center justify-center">
                  <Text className="text-xs font-bold text-muted-foreground">
                    {idx + 1}
                  </Text>
                </View>
                <View className="flex-1">
                  <TextInput
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChangeText={(val) => handleOptionChange(val, idx)}
                  />
                </View>
                {options.length > 2 && (
                  <TouchableOpacity
                    onPress={() => handleRemoveOption(idx)}
                    className="w-10 h-10 rounded-xl bg-destructive/10 items-center justify-center ms-1"
                    accessibilityRole="button"
                    accessibilityLabel={`Remove option ${idx + 1}`}
                  >
                    <Trash2 size={16} className="text-destructive" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Choice Type (Single vs Multi) */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-3">
          <View className="flex-row items-center gap-2">
            <CheckSquare size={16} className="text-primary" />
            <Text className="text-sm font-bold text-foreground">Selection Format</Text>
          </View>

          <View className="flex-row gap-2.5">
            <TouchableOpacity
              onPress={() => onChangeField('choiceType', 'SINGLE_CHOICE')}
              activeOpacity={0.7}
              className={cn(
                'flex-1 p-3 rounded-xl border items-center justify-center transition-all',
                choiceType === 'SINGLE_CHOICE'
                  ? 'border-primary bg-primary/10 shadow-xs'
                  : 'border-border bg-card'
              )}
              accessibilityRole="button"
            >
              <Text
                className={cn(
                  'text-xs font-bold',
                  choiceType === 'SINGLE_CHOICE' ? 'text-primary' : 'text-foreground'
                )}
              >
                Single Choice
              </Text>
              <Text variant="muted" className="text-[10px] mt-0.5">
                Exactly 1 vote
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onChangeField('choiceType', 'MULTIPLE_CHOICE')}
              activeOpacity={0.7}
              className={cn(
                'flex-1 p-3 rounded-xl border items-center justify-center transition-all',
                choiceType === 'MULTIPLE_CHOICE'
                  ? 'border-primary bg-primary/10 shadow-xs'
                  : 'border-border bg-card'
              )}
              accessibilityRole="button"
            >
              <Text
                className={cn(
                  'text-xs font-bold',
                  choiceType === 'MULTIPLE_CHOICE' ? 'text-primary' : 'text-foreground'
                )}
              >
                Multiple Choice
              </Text>
              <Text variant="muted" className="text-[10px] mt-0.5">
                Select multiple
              </Text>
            </TouchableOpacity>
          </View>

          {choiceType === 'MULTIPLE_CHOICE' && (
            <View className="pt-2">
              <TextInput
                label="Maximum Choices Allowed"
                placeholder="2"
                keyboardType="numeric"
                value={String(maxChoices)}
                onChangeText={(val) =>
                  onChangeField('maxChoices', parseInt(val, 10) || 2)
                }
                helperText={`Voters can select up to this many options (max: ${options.length}).`}
              />
            </View>
          )}
        </View>

        {/* Voting Mode (User vs Unit) */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-3">
          <View className="flex-row items-center gap-2">
            <Users size={16} className="text-primary" />
            <Text className="text-sm font-bold text-foreground">Voting Mode</Text>
          </View>

          <View className="flex-row gap-2.5">
            <TouchableOpacity
              onPress={() => onChangeField('votingMode', 'ONE_PER_USER')}
              activeOpacity={0.7}
              className={cn(
                'flex-1 p-3 rounded-xl border items-center justify-center transition-all',
                votingMode === 'ONE_PER_USER'
                  ? 'border-primary bg-primary/10 shadow-xs'
                  : 'border-border bg-card'
              )}
              accessibilityRole="button"
            >
              <Text
                className={cn(
                  'text-xs font-bold',
                  votingMode === 'ONE_PER_USER' ? 'text-primary' : 'text-foreground'
                )}
              >
                One Vote Per Person
              </Text>
              <Text variant="muted" className="text-[10px] mt-0.5 text-center">
                Every resident votes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onChangeField('votingMode', 'ONE_PER_UNIT')}
              activeOpacity={0.7}
              className={cn(
                'flex-1 p-3 rounded-xl border items-center justify-center transition-all',
                votingMode === 'ONE_PER_UNIT'
                  ? 'border-primary bg-primary/10 shadow-xs'
                  : 'border-border bg-card'
              )}
              accessibilityRole="button"
            >
              <Text
                className={cn(
                  'text-xs font-bold',
                  votingMode === 'ONE_PER_UNIT' ? 'text-primary' : 'text-foreground'
                )}
              >
                One Vote Per Unit
              </Text>
              <Text variant="muted" className="text-[10px] mt-0.5 text-center">
                Apartment mutex lock
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Results Visibility */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-3">
          <View className="flex-row items-center gap-2">
            <Eye size={16} className="text-primary" />
            <Text className="text-sm font-bold text-foreground">Results Visibility</Text>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {[
              { label: 'Live Always', value: 'ALWAYS' },
              { label: 'After Voting', value: 'AFTER_VOTE' },
              { label: 'After Poll Closes', value: 'AFTER_EXPIRY' },
              { label: 'Admin Only', value: 'ADMIN_ONLY' },
            ].map((vis) => {
              const isSelected = resultsVisibility === vis.value;
              return (
                <TouchableOpacity
                  key={vis.value}
                  onPress={() => onChangeField('resultsVisibility', vis.value)}
                  activeOpacity={0.7}
                  className={cn(
                    'px-3.5 py-2.5 rounded-xl border transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-border bg-card'
                  )}
                  accessibilityRole="button"
                >
                  <Text
                    className={cn(
                      'text-xs font-bold',
                      isSelected ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {vis.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Quorum Percentage Presets */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-3">
          <View className="flex-row items-center gap-2">
            <Percent size={16} className="text-primary" />
            <Text className="text-sm font-bold text-foreground">Minimum Quorum</Text>
          </View>
          <Text variant="muted" className="text-xs">
            Minimum percentage of eligible voters needed for poll outcome to be legally binding.
          </Text>

          <View className="flex-row gap-2">
            {QUORUM_PRESETS.map((pct) => {
              const isSelected = quorumPercentage === pct;
              return (
                <TouchableOpacity
                  key={pct}
                  onPress={() => onChangeField('quorumPercentage', pct)}
                  activeOpacity={0.7}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl border items-center justify-center transition-all',
                    isSelected
                      ? 'border-primary bg-primary shadow-xs'
                      : 'border-border bg-card'
                  )}
                  accessibilityRole="button"
                >
                  <Text
                    className={cn(
                      'text-xs font-bold',
                      isSelected ? 'text-primary-foreground' : 'text-foreground'
                    )}
                  >
                    {pct === 0 ? 'No Quorum' : `${pct}%`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Anonymous Ballot Toggle */}
        <View className="bg-card border border-border rounded-2xl p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1 me-3 min-w-0">
              <View className="w-9 h-9 rounded-xl bg-purple-500/10 items-center justify-center shrink-0">
                <Lock size={18} className="text-purple-500" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-bold text-foreground">Anonymous Voting</Text>
                <Text variant="muted" className="text-xs">
                  Voter identities and apartment numbers are hidden from tally reports.
                </Text>
              </View>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={(val: boolean) => onChangeField('isAnonymous', val)}
              trackColor={{ false: '#374151', true: '#16a34a' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default PollConfigStep;
