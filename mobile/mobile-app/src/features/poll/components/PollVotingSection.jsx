import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Check, CheckSquare, Square } from 'lucide-react-native';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/forms/TextInput';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/src/utils/i18n';

/**
 * PollVotingSection Component (Pure JSX)
 * Handles interactive voting for:
 * - SINGLE_CHOICE (radio selection)
 * - MULTIPLE_CHOICE (checkbox selection up to maxChoices)
 * - ONE_PER_UNIT (requires entering/confirming unit number)
 */
export function PollVotingSection({
  poll,
  onVote,
  submitting = false,
  userUnit = '',
}) {
  const { t, translateText } = useTranslation();
  if (!poll || poll.status !== 'Active') return null;

  const isMultiple = poll.choiceType === 'MULTIPLE_CHOICE';
  const maxChoices = poll.maxChoices || (isMultiple ? poll.options.length : 1);
  const isPerUnit = poll.votingMode === 'ONE_PER_UNIT';

  // Selected options state
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [unitNumber, setUnitNumber] = useState(userUnit || '');
  const [validationError, setValidationError] = useState('');

  const handleToggleOption = (index) => {
    setValidationError('');
    if (isMultiple) {
      if (selectedIndices.includes(index)) {
        setSelectedIndices(selectedIndices.filter((i) => i !== index));
      } else {
        if (selectedIndices.length >= maxChoices) {
          setValidationError(`You can select at most ${maxChoices} options.`);
          return;
        }
        setSelectedIndices([...selectedIndices, index]);
      }
    } else {
      setSelectedIndices([index]);
    }
  };

  const handleSubmitVote = () => {
    if (selectedIndices.length === 0) {
      setValidationError('Please select at least one option.');
      return;
    }

    if (isPerUnit && !unitNumber.trim()) {
      setValidationError('Unit number is required for per-unit voting.');
      return;
    }

    const votePayload = {
      optionIndex: selectedIndices[0],
      selectedOptions: selectedIndices,
      selectedOptionIndices: selectedIndices,
      optionIndices: selectedIndices,
      selectedOptionIndex: selectedIndices[0],
    };

    if (isPerUnit) {
      votePayload.unitNumber = unitNumber.trim();
    }

    onVote(votePayload);
  };

  return (
    <View className="bg-card rounded-2xl border border-border p-4 mb-4 shadow-sm">
      <View className="mb-3">
        <Text className="text-base font-bold text-foreground">{t('cast_your_vote', 'Cast Your Vote')}</Text>
        <Text className="text-xs text-muted-foreground mt-0.5">
          {isMultiple
            ? `Select up to ${maxChoices} options`
            : 'Select one option'}
          {isPerUnit ? ' • One vote recorded per residential unit' : ''}
        </Text>
      </View>

      {/* Options List */}
      <View className="gap-2 mb-4">
        {poll.options?.map((opt, index) => {
          const isSelected = selectedIndices.includes(index);

          return (
            <TouchableOpacity
              key={opt._id || index}
              onPress={() => handleToggleOption(index)}
              activeOpacity={0.7}
              className={cn(
                'flex-row items-center p-3.5 rounded-xl border transition-colors',
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-border bg-background'
              )}
            >
              {/* Radio or Checkbox icon */}
              <View className="me-3 shrink-0">
                {isMultiple ? (
                  isSelected ? (
                    <CheckSquare size={20} color="#10b981" />
                  ) : (
                    <Square size={20} color="#94a3b8" />
                  )
                ) : (
                  <View
                    className={cn(
                      'w-5 h-5 rounded-full border items-center justify-center',
                      isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground'
                    )}
                  >
                    {isSelected && <View className="w-2 h-2 rounded-full bg-white" />}
                  </View>
                )}
              </View>

              <Text
                className={cn(
                  'flex-1 text-sm font-medium',
                  isSelected ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-foreground'
                )}
              >
                {translateText(opt.text)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Unit Number Input for ONE_PER_UNIT mode */}
      {isPerUnit && (
        <View className="mb-4">
          <TextInput
            label={t('residential_unit_villa_number', 'Residential Unit / Villa Number')}
            placeholder="e.g. Villa 104 or Apt 4B"
            value={unitNumber}
            onChangeText={(text) => {
              setUnitNumber(text);
              setValidationError('');
            }}
            error={!unitNumber && validationError ? validationError : undefined}
          />
          <Text className="text-[11px] text-muted-foreground mt-1">
            Official community ballot: Only one ballot is counted per unit.
          </Text>
        </View>
      )}

      {/* Validation error notice */}
      {Boolean(validationError) && (
        <View className="bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 mb-3">
          <Text className="text-xs text-destructive font-medium">{validationError}</Text>
        </View>
      )}

      {/* Submit Button */}
      <Button
        variant="default"
        size="lg"
        onPress={handleSubmitVote}
        loading={submitting}
        disabled={submitting || selectedIndices.length === 0}
        accessibilityRole="button"
        accessibilityLabel="Submit Ballot"
      >
        <Text className="font-bold text-white text-base">{t('submit_ballot', 'Submit Ballot')}</Text>
      </Button>
    </View>
  );
}

export default PollVotingSection;
