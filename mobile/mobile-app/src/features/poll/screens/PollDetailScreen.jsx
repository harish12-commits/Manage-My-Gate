import React, { useEffect, useState } from 'react';
import { View, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Users, Lock, BarChart2, ShieldCheck, Calendar, CheckSquare } from 'lucide-react-native';

import { ScreenShell } from '@/components/ui/ScreenShell';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { Button } from '@/components/common/Button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Text } from '@/components/ui/text';

import { usePolls } from '../hooks/usePolls.js';
import { PollVotingSection } from '../components/PollVotingSection';
import { PollResultsView } from '../components/PollResultsView';
import { PollVotersModal } from '../components/PollVotersModal';
import { PollEngagementBar } from '../components/PollEngagementBar';
import { checkIsAdmin } from '@/src/utils/rbac';
import { useTranslation } from '@/src/utils/i18n';

/**
 * PollDetailScreen Component (Pure JSX)
 * Detailed view of a single community poll.
 * Features:
 * - Poll header & status badge
 * - Audience and governance configuration detail section
 * - Interactive voting card (single/multiple choice + unit input)
 * - Live results breakdown with quorum progress meter
 * - Administrative controls (Close Poll, View Voters Turnout modal)
 */
export default function PollDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { t, translateText } = useTranslation();

  const {
    selectedPoll,
    results,
    voters,
    loading,
    voting,
    user,
    canClose,
    canViewVoters,
    loadPollById,
    loadResults,
    loadVoters,
    castVote,
    closeExistingPoll,
    reactToPoll,
  } = usePolls();

  const [votersModalOpen, setVotersModalOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);

  const isCommunityAdmin = checkIsAdmin(user);

  useEffect(() => {
    if (id) {
      loadPollById(id);
      loadResults(id);
    }
  }, [id, loadPollById, loadResults]);

  const rawPoll = selectedPoll?.poll || selectedPoll?.data || selectedPoll;
  const poll =
    rawPoll &&
    (!id ||
      !rawPoll._id ||
      String(rawPoll._id) === String(id) ||
      String(rawPoll.id) === String(id))
      ? rawPoll
      : rawPoll;

  const handleVote = async (votePayload) => {
    try {
      await castVote(id, votePayload);
      loadResults(id);
    } catch (err) {
      if (Platform.OS === 'web') {
        window.alert('Failed to cast vote: ' + (err?.message || 'Unknown error'));
      } else {
        Alert.alert('Voting Error', err?.message || 'Failed to submit vote.');
      }
    }
  };

  const handleOpenVoters = () => {
    loadVoters(id);
    setVotersModalOpen(true);
  };

  const handleConfirmClose = async () => {
    try {
      setCloseLoading(true);
      await closeExistingPoll(id);
      setCloseConfirmOpen(false);
      loadPollById(id);
      loadResults(id);
      if (Platform.OS === 'web') {
        window.alert('Poll has been closed.');
      } else {
        Alert.alert('Poll Closed', 'The poll has been closed to further voting.');
      }
    } catch (err) {
      if (Platform.OS === 'web') {
        window.alert('Failed to close poll: ' + (err?.message || 'Unknown error'));
      } else {
        Alert.alert('Error', err?.message || 'Failed to close poll');
      }
    } finally {
      setCloseLoading(false);
    }
  };

  if (!poll && loading) {
    return (
      <ScreenShell title="Poll Details" iconName="BarChart2">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-muted-foreground text-sm">Loading poll details...</Text>
        </View>
      </ScreenShell>
    );
  }

  if (!poll) {
    return (
      <ScreenShell title="Poll Details" iconName="BarChart2">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-destructive font-bold text-base mb-2">Poll Not Found</Text>
          <Text className="text-muted-foreground text-sm text-center mb-4">
            The requested community poll could not be loaded or you do not have permission to view it.
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            Go Back
          </Button>
        </View>
      </ScreenShell>
    );
  }

  const isClosed = poll.status === 'Closed';
  const hasVoted = Boolean(poll.hasVoted);
  const isCreator = poll.createdBy?._id === user?.id || poll.createdBy === user?.id;

  // Decide whether to show results based on resultsVisibility policy (Strictly Community Admin only)
  const canSeeResults =
    isCommunityAdmin &&
    (poll.resultsVisibility === 'ALWAYS' ||
      (poll.resultsVisibility === 'AFTER_VOTE' && (hasVoted || isClosed)) ||
      (poll.resultsVisibility === 'AFTER_EXPIRY' && isClosed) ||
      (poll.resultsVisibility === 'ADMIN_ONLY' && (canClose || isCreator)) ||
      isCommunityAdmin);

  return (
    <ScreenShell
      title={t('poll_details', 'Poll Details')}
      subtitle={translateText(poll.question)}
      iconName="BarChart2"
      scrollable
    >
      <View className="px-4 py-4">
        {/* Top Poll Card Header */}
        <View className="bg-card rounded-2xl border border-border p-4 mb-4 shadow-sm">
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-1 me-3">
              <Text className="text-lg font-bold text-foreground">
                {translateText(poll.question)}
              </Text>
              {Boolean(poll.description) && (
                <Text className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {translateText(poll.description)}
                </Text>
              )}
            </View>
            <StatusBadge
              label={t(`status_${poll.status.toLowerCase()}`, poll.status)}
              variant={poll.status === 'Active' ? 'success' : 'neutral'}
            />
          </View>

          {/* Target Audience / Metadata pill row */}
          <View className="flex-row flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/40">
            <View className="bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
              <Text className="text-[10px] text-muted-foreground font-medium">
                {t('audience', 'Audience')}: {poll.targetAudience?.targetType || t('all_community_residents', 'ALL RESIDENTS')}
              </Text>
            </View>
            <View className="bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
              <Text className="text-[10px] text-muted-foreground font-medium">
                {t('ends', 'Ends')}: {poll.endDate ? new Date(poll.endDate).toLocaleDateString() : t('no_expiry_set', 'No expiry set')}
              </Text>
            </View>
            {hasVoted && (
              <View className="bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                <Text className="text-[10px] text-primary font-bold">
                  ✓ {t('you_voted', 'You Voted')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Draft Poll Notice Callout */}
        {poll.status === 'Draft' && (
          <View className="bg-amber-500/10 rounded-2xl border border-amber-500/20 p-4 mb-4 flex-row items-center gap-3">
            <Lock size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-bold text-foreground">{t('draft_poll_not_published', 'Draft Poll (Not Published)')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {t('draft_poll_desc', 'This poll is currently saved as a draft. Voting will open once it is published.')}
              </Text>
            </View>
            {isCommunityAdmin && (
              <Button
                variant="outline"
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: '/(resident)/community-engagement/edit',
                    params: { mode: 'edit', id: poll._id || poll.id, type: 'POLL' },
                  })
                }
              >
                <Text className="text-xs font-semibold">{t('edit_poll', 'Edit Poll')}</Text>
              </Button>
            )}
          </View>
        )}

        {/* Social Engagement & Reactions Bar: 👍 Helpful  ❤️ Important  🙏 Thanks */}
        <PollEngagementBar
          reactions={poll.reactionCounts || poll.reactions}
          userReaction={poll.userReaction}
          likeCount={poll.likeCount || 0}
          isLiked={Boolean(poll.isLiked)}
          onReactionPress={(type) => reactToPoll(poll._id, type)}
          onLikePress={() => reactToPoll(poll._id, 'HELPFUL')}
        />

        {/* Voting Section (Shown only if Active and not yet voted) */}
        {poll.status === 'Active' && (
          <PollVotingSection
            poll={poll}
            onVote={handleVote}
            submitting={voting}
            userUnit={user?.unitNumber || user?.unit || ''}
          />
        )}

        {/* Already Voted Notice */}
        {!isClosed && hasVoted && (
          <View className="bg-primary/10 rounded-2xl border border-primary/20 p-4 mb-4 flex-row items-center gap-3">
            <ShieldCheck size={24} color="#2563eb" className="shrink-0" />
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-bold text-foreground">{t('your_vote_recorded', 'Your Vote Has Been Recorded')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {t('thank_you_voting_desc', 'Thank you for participating in this community decision.')}
              </Text>
            </View>
          </View>
        )}

        {/* Closed Poll Notice */}
        {isClosed && (
          <View className="bg-muted/60 rounded-2xl border border-border p-4 mb-4 flex-row items-center gap-3">
            <Lock size={20} color="#64748b" className="shrink-0" />
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-bold text-foreground">{t('poll_closed', 'Poll Closed')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {t('poll_closed_desc', 'Voting has concluded for this poll.')}
              </Text>
            </View>
          </View>
        )}

        {/* Results View (Restricted strictly to Community Admin) */}
        {isCommunityAdmin && (
          canSeeResults ? (
            <PollResultsView poll={poll} results={results} />
          ) : (
            <View className="bg-card rounded-2xl border border-border p-4 mb-4 items-center justify-center py-8">
              <Lock size={28} color="#94a3b8" />
              <Text className="text-sm font-bold text-foreground mt-2">{t('results_are_hidden', 'Results are Hidden')}</Text>
              <Text className="text-xs text-muted-foreground text-center mt-1 px-4">
                {t('results_restricted_admin', 'Results are restricted to community administrators.')}
              </Text>
            </View>
          )
        )}

        {/* Governance & Rules DetailSection (Restricted strictly to Community Admin) */}
        {isCommunityAdmin && (
          <DetailSection title={t('poll_governance_rules', 'Poll Governance Rules')} iconName="Shield">
            <DetailRow
              label={t('ballot_selection', 'Ballot Selection')}
              value={
                poll.choiceType === 'MULTIPLE_CHOICE'
                  ? `${t('multiple_choice', 'Multiple Choice')} (Max ${poll.maxChoices || 1})`
                  : t('single_choice', 'Single Choice')
              }
            />
            <DetailRow
              label={t('voting_policy', 'Voting Policy')}
              value={poll.votingMode === 'ONE_PER_UNIT' ? t('one_vote_per_unit', 'One Vote Per Unit') : t('one_vote_per_person', 'One Vote Per Person')}
            />
            <DetailRow
              label={t('results_visibility', 'Results Visibility')}
              value={t(poll.resultsVisibility?.toLowerCase(), poll.resultsVisibility)}
            />
            <DetailRow
              label={t('quorum_required', 'Quorum Required')}
              value={`${poll.quorumPercentage || 0}%`}
            />
            <DetailRow
              label={t('anonymous_ballot', 'Anonymous Ballot')}
              value={poll.isAnonymous ? `${t('yes', 'Yes')} (${t('encrypted', 'Encrypted')})` : `${t('no', 'No')} (${t('public', 'Public')})`}
              isLast
            />
          </DetailSection>
        )}

        {/* Administrative & Accountability Actions */}
        {(canClose || canViewVoters || isCreator) && (
          <View className="gap-2.5 mt-2">
            {canViewVoters && (
              <Button
                variant="outline"
                size="lg"
                onPress={handleOpenVoters}
                className="w-full"
                accessibilityRole="button"
                accessibilityLabel="View Voter Turnout"
              >
                <Text className="font-bold text-foreground text-sm">{t('view_voter_turnout', 'View Voter Turnout')}</Text>
              </Button>
            )}

            {!isClosed && (canClose || isCreator) && (
              <Button
                variant="destructive"
                size="lg"
                onPress={() => setCloseConfirmOpen(true)}
                className="w-full"
                accessibilityRole="button"
                accessibilityLabel="Close Poll"
              >
                <Text className="font-bold text-white text-sm">{t('close_poll_now', 'Close Poll Now')}</Text>
              </Button>
            )}
          </View>
        )}
      </View>

      {/* Voter Turnout Modal */}
      <PollVotersModal
        visible={votersModalOpen}
        onClose={() => setVotersModalOpen(false)}
        poll={poll}
        voters={voters?.voters || voters || []}
        loading={loading}
      />

      {/* Confirmation Modal for closing poll */}
      <ConfirmationModal
        visible={closeConfirmOpen}
        title={t('close_poll', 'Close Poll')}
        message={t('close_poll_confirm_desc', 'Are you sure you want to close this poll? No further votes can be submitted once closed.')}
        confirmLabel={t('close_poll', 'Close Poll')}
        cancelLabel={t('cancel', 'Cancel')}
        variant="danger"
        loading={closeLoading}
        onConfirm={handleConfirmClose}
        onCancel={() => setCloseConfirmOpen(false)}
      />
    </ScreenShell>
  );
}

