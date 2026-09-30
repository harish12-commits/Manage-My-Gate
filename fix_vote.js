const fs = require('fs');
let content = fs.readFileSync('mobile/mobile-app/src/features/poll/components/PollVotingSection.jsx', 'utf8');

const target1 =     } else {
      setSelectedIndices([index]);
    }
  };;
const repl1 =     } else {
      setSelectedIndices([index]);
      if (!isPerUnit) {
        // Auto-submit 1-click for simple single choice
        onVote({
          optionIndex: index,
          selectedOptions: [index],
          selectedOptionIndices: [index],
          optionIndices: [index],
          selectedOptionIndex: index,
        });
      }
    }
  };;
content = content.replace(target1, repl1);

const target2 =       {/* Submit Button */}
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
    </View>;
const repl2 =       {/* Submit Button */}
      {(isMultiple || isPerUnit) && (
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
      )}
    </View>;
content = content.replace(target2, repl2);
fs.writeFileSync('mobile/mobile-app/src/features/poll/components/PollVotingSection.jsx', content);
