import React, { useState } from 'react';
import { View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { ListCard } from '@/components/ui/ListCard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import PollOptionRow from './PollOptionRow';
import { checkIsAdmin } from '../../../utils/rbac';
import { useTranslation } from '@/src/utils/i18n';

export interface PollCardProps {
  poll: any;
  onVote?: (optionIndex: number) => void;
  onViewDetails?: () => void;
  onPress?: () => void;
  onDelete?: () => void;
  onPublish?: () => void;
  onClose?: () => void;
  isCreator?: boolean;
  currentUser?: any;
  showViewDetails?: boolean;
}

/**
 * PollCard Component
 * Canonical ListCard implementation for interactive Community Poll items.
 * Embeds PollOptionRows and action triggers into ListCard's children slot.
 * Ensures the poll question is prominently displayed as the title.
 */
export function PollCard({
  poll,
  onVote,
  onViewDetails,
  onPress,
  onDelete,
  onPublish,
  onClose,
  isCreator,
  currentUser,
  showViewDetails,
}: PollCardProps) {
  const { t, translateText } = useTranslation();
  if (!poll) return null;

  const isCommunityAdmin = checkIsAdmin(currentUser);
  const canShowDetails = showViewDetails !== undefined ? showViewDetails : true;

  const [submittingIndex, setSubmittingIndex] = useState<number | null>(null);
  const isClosed = poll.status === 'Closed';
  const isVoted = Boolean(poll.hasVoted);
  const isVotingDisabled = isClosed || submittingIndex !== null;

  const totalVotes = poll.totalVotes !== undefined
    ? poll.totalVotes
    : (Array.isArray(poll.options) ? poll.options.reduce((sum: number, opt: any) => sum + (opt.votesCount || 0), 0) : 0);
  const questionText = poll.question || poll.title || 'Untitled Poll';
  const likeCount = poll.likeCount || 0;
  const isLiked = Boolean(poll.isLiked || poll.userReaction === 'HELPFUL' || poll.userReaction === 'LIKE');
  const reactionCounts = poll.reactionCounts || poll.reactions || {};
  const helpfulCount = (reactionCounts.HELPFUL || 0) + (reactionCounts.LIKE || 0) || (isLiked && likeCount > 0 ? likeCount : 0);
  const importantCount = (reactionCounts.IMPORTANT || 0) + (reactionCounts.LOVE || 0);
  const thanksCount = (reactionCounts.THANKS || 0) + (reactionCounts.APPLAUD || 0);

  const getPollStatusVariant = (status: string) => {
    switch (status) {
      case 'Active': return 'success' as const;
      case 'Draft': return 'warning' as const;
      case 'Closed': return 'neutral' as const;
      case 'Archived': return 'danger' as const;
      default: return 'neutral' as const;
    }
  };

  const votingModeLabel = poll.votingMode === 'ONE_PER_UNIT' ? 'Per Unit' : 'Per User';
  const handlePress = canShowDetails ? (onPress || onViewDetails) : undefined;

  return (
    <ListCard
      title={translateText(questionText)}
      subtitle={poll.description ? translateText(poll.description) : undefined}
      leftIcon="BarChart2"
      leftIconBgColor="bg-primary/10"
      onPress={handlePress}
      status={{
        label: t(`status_${poll.status.toLowerCase()}`, poll.status),
        variant: getPollStatusVariant(poll.status),
      }}
      secondaryBadge={{
        label: `${totalVotes} ${totalVotes === 1 ? t('vote', 'Vote') : t('votes', 'Votes')}`,
        variant: 'neutral',
      }}
    >
      {/* Poll Options Voting & Progress List */}
      {Array.isArray(poll.options) && poll.options.length > 0 && (
        <View className="mt-1 gap-2">
          {poll.options.map((option: any, index: number) => {
            const percentage = totalVotes > 0 ? Math.round(((option.votesCount || 0) / totalVotes) * 100) : 0;
            return (
              <PollOptionRow
                key={option._id || index}
                text={option.text}
                votesCount={option.votesCount || 0}
                percentage={percentage}
                isSelected={
                  poll.votedOptionIndex === index ||
                  (Array.isArray(poll.votedOptionIndices) && poll.votedOptionIndices.includes(index)) ||
                  (Array.isArray(poll.votedOptions) && poll.votedOptions.includes(index)) ||
                  submittingIndex === index
                }
                showResults={isClosed || isVoted}
                onSelect={() => {
                  if (!isVotingDisabled) {
                    if (onVote) {
                      setSubmittingIndex(index);
                      Promise.resolve(onVote(index)).finally(() => {
                        setSubmittingIndex(null);
                      });
                    } else if (handlePress) {
                      handlePress();
                    }
                  }
                }}
                disabled={isVotingDisabled}
              />
            );
          })}
        </View>
      )}

      {/* Footer Details & Action CTA Row */}
      <View className="mt-2.5 flex-row flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/30">
        <View className="flex-row flex-wrap items-center gap-1.5">
          {helpfulCount > 0 && (
            <View className="flex-row items-center px-2 py-0.5 rounded-md border bg-blue-500/10 border-blue-500/20">
              <Text className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                👍 {helpfulCount}
              </Text>
            </View>
          )}
          {importantCount > 0 && (
            <View className="flex-row items-center px-2 py-0.5 rounded-md border bg-rose-500/10 border-rose-500/20">
              <Text className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                ❤️ {importantCount}
              </Text>
            </View>
          )}
          {thanksCount > 0 && (
            <View className="flex-row items-center px-2 py-0.5 rounded-md border bg-amber-500/10 border-amber-500/20">
              <Text className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                🙏 {thanksCount}
              </Text>
            </View>
          )}
          {poll.quorumPercentage > 0 && (
            <View className="bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
              <Text className="text-[10px] text-muted-foreground font-medium">
                Quorum: {poll.quorumPercentage}%
              </Text>
            </View>
          )}
          {poll.isAnonymous && (
            <View className="bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
              <Text className="text-[10px] text-indigo-500 font-semibold">
                Anonymous
              </Text>
            </View>
          )}
        </View>

        {(canShowDetails || (isCreator && isCommunityAdmin)) && (
          <View className="flex-row items-center gap-2">
            {canShowDetails && handlePress && (
              <Button variant="outline" size="sm" onPress={handlePress} className="h-8 px-3 rounded-lg">
                <Text className="text-xs font-semibold text-foreground">View Details</Text>
              </Button>
            )}
            {isCreator && isCommunityAdmin && poll.status === 'Draft' && onPublish && (
              <Button variant="default" size="sm" onPress={onPublish} className="h-8 px-3 rounded-lg">
                <Text className="text-xs font-semibold text-primary-foreground">Publish</Text>
              </Button>
            )}
            {isCreator && isCommunityAdmin && poll.status === 'Active' && onClose && (
              <Button variant="secondary" size="sm" onPress={onClose} className="h-8 px-3 rounded-lg">
                <Text className="text-xs font-semibold text-secondary-foreground">Close Poll</Text>
              </Button>
            )}
            {isCreator && isCommunityAdmin && onDelete && (
              <Button variant="destructive" size="sm" onPress={onDelete} className="h-8 px-3 rounded-lg">
                <Text className="text-xs font-semibold text-destructive-foreground">Delete</Text>
              </Button>
            )}
          </View>
        )}
      </View>
    </ListCard>
  );
}

export default PollCard;

