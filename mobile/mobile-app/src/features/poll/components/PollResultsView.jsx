import React from 'react';
import { View } from 'react-native';
import { Trophy, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProgressBar } from '@/components/common/ProgressBar';
import { useTranslation } from '@/src/utils/i18n';

/**
 * PollResultsView Component (Pure JSX)
 * Renders visual breakdown of poll options with progress bars, vote counts,
 * percentages, quorum tracker, and outcome banner.
 */
export function PollResultsView({ poll, results }) {
  const { t, translateText } = useTranslation();
  if (!poll) return null;

  const totalVotes = poll.totalVotes || (Array.isArray(poll.options) ? poll.options.reduce((sum, opt) => sum + (opt.votesCount || 0), 0) : 0);
  const eligibleVoters = poll.totalEligibleVoters || 0;
  const quorumPercentage = poll.quorumPercentage || 0;
  const participationRate = eligibleVoters > 0 ? Math.round((totalVotes / eligibleVoters) * 100) : 0;
  const quorumMet = quorumPercentage === 0 || participationRate >= quorumPercentage;

  const isClosed = poll.status === 'Closed';
  const winningOption = poll.winningOption;

  return (
    <View className="bg-card rounded-2xl border border-border p-4 mb-4 shadow-sm">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-bold text-foreground flex-1 min-w-0 me-2" numberOfLines={1}>
          {t('results_breakdown', 'Results Breakdown')}
        </Text>
        <StatusBadge
          label={`${totalVotes} total ${totalVotes === 1 ? 'vote' : 'votes'}`}
          variant="info"
          size="sm"
        />
      </View>

      {/* Outcome Banner (if closed) */}
      {isClosed && poll.outcome && (
        <View className="flex-row items-center gap-2 p-3 rounded-xl mb-4 bg-muted/70 border border-border">
          {poll.outcome === 'PASSED' ? (
            <Trophy size={20} color="#16a34a" />
          ) : poll.outcome === 'NO_QUORUM' ? (
            <AlertCircle size={20} color="#ea580c" />
          ) : (
            <CheckCircle2 size={20} color="#2563eb" />
          )}
          <View className="flex-1">
            <Text className="text-xs font-bold text-foreground">
              Final Outcome: {poll.outcome}
            </Text>
            {winningOption?.text ? (
              <Text className="text-[11px] text-muted-foreground">
                {t('winning_choice', 'Winning choice')}: {translateText(winningOption.text)} ({winningOption.votesCount || 0} {t('votes', 'votes')})
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Quorum Progress Meter */}
      {quorumPercentage > 0 && (
        <View className="mb-4 p-3 bg-muted/40 rounded-xl border border-border/50">
          <View className="flex-row justify-between items-center mb-1.5">
            <Text className="text-xs font-semibold text-foreground">
              Quorum Requirement: {quorumPercentage}%
            </Text>
            <Text className="text-xs font-bold text-foreground">
              {participationRate}% ({totalVotes}/{eligibleVoters} eligible)
            </Text>
          </View>
          <View className="h-2 w-full bg-border rounded-full overflow-hidden">
            <View
              className={`h-full rounded-full ${
                quorumMet ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(participationRate, 100)}%` }}
            />
          </View>
          <Text className="text-[10px] text-muted-foreground mt-1">
            {quorumMet
              ? '✓ Quorum requirement satisfied'
              : `Quorum not yet reached (${quorumPercentage - participationRate}% needed)`}
          </Text>
        </View>
      )}

      {/* Options Vote Bars */}
      <View className="gap-3">
        {poll.options && poll.options.length > 0 ? (
          poll.options.map((opt, index) => {
            const count = opt.votesCount || 0;
            const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isWinner = winningOption && (winningOption.index === index || winningOption.text === opt.text);
            const isVoted = poll.votedOptionIndex === index ||
              (Array.isArray(poll.votedOptions) && poll.votedOptions.includes(index)) ||
              (Array.isArray(poll.votedOptionIndices) && poll.votedOptionIndices.includes(index));

            return (
              <View key={opt._id || index} className="gap-1">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5 flex-1 me-2 min-w-0">
                    {isWinner && <Trophy size={14} color="#eab308" className="shrink-0" />}
                    {isVoted && (
                      <View className="bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">
                        <Text className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {t('your_vote', 'Your Vote')}
                        </Text>
                      </View>
                    )}
                    <Text
                      className={`text-sm flex-1 ${
                        isVoted
                          ? 'font-bold text-emerald-600 dark:text-emerald-400'
                          : isWinner
                          ? 'font-bold text-primary'
                          : 'font-medium text-foreground'
                      }`}
                    >
                      {translateText(opt.text)}
                    </Text>
                  </View>
                  <Text
                    className={`text-xs font-bold shrink-0 ${
                      isVoted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                    }`}
                  >
                    {count} ({percentage}%)
                  </Text>
                </View>

                <View className="h-3 w-full bg-muted rounded-full overflow-hidden">
                  <View
                    className={`h-full rounded-full transition-all ${
                      isVoted
                        ? 'bg-emerald-500'
                        : isWinner
                        ? 'bg-primary'
                        : 'bg-primary/60'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </View>
              </View>
            );
          })
        ) : (
          <Text className="text-xs text-muted-foreground py-2 text-center">
            {poll.status === 'Draft'
              ? 'No options defined yet for this draft poll.'
              : 'No options available.'}
          </Text>
        )}
      </View>
    </View>
  );
}

export default PollResultsView;
