import React, { useState, useEffect } from 'react';
import { View, ScrollView, Share, Platform, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import {
  Pin,
  PinOff,
  Share2,
  Trash2,
  Users,
  Vote,
  FileText,
  Calendar,
  BarChart2,
  Download,
  Lock,
  RefreshCw,
  Edit3,
  SlidersHorizontal,
  ChevronRight,
  ArrowUpRight,
  Megaphone,
} from 'lucide-react-native';
import { EngagementCardItem } from './EngagementCard';
import * as noticeBoardService from '@/src/features/noticeBoard/services/noticeBoardService';
import { pollApi } from '@/src/features/poll/services/pollApi';
import { PollVotersModal } from '@/src/features/poll/components/PollVotersModal';
import { useTranslation } from '@/src/utils/i18n';

const VotersModal = PollVotersModal as React.ComponentType<any>;

export interface EngagementActionsBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  item: EngagementCardItem | null;
  onActionSuccess?: () => void;
}

export const EngagementActionsBottomSheet: React.FC<EngagementActionsBottomSheetProps> = ({
  visible,
  onClose,
  item,
  onActionSuccess,
}) => {
  const router = useRouter();
  const { t, translateText } = useTranslation();

  // Pinning state
  const [isPinning, setIsPinning] = useState(false);
  const [pinnedLocal, setPinnedLocal] = useState(Boolean(item?.isPinned));

  // Poll live results state
  const [pollResults, setPollResults] = useState<any>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  // Poll voters modal state
  const [votersModalVisible, setVotersModalVisible] = useState(false);
  const [voters, setVoters] = useState<any[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);

  // Nested actions bottom sheet
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);

  // Confirmation Modals
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [closePollConfirmVisible, setClosePollConfirmVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (visible && item) {
      setPinnedLocal(Boolean(item.isPinned));

      if (item.type === 'POLL') {
        setLoadingResults(true);
        pollApi
          .getPollResults(item.id)
          .then((res: any) => {
            const data = res?.data?.data || res?.data || res;
            setPollResults(data);
          })
          .catch(() => {})
          .finally(() => setLoadingResults(false));
      }
    }
  }, [visible, item]);

  if (!item) return null;

  const isNotice = item.type === 'NOTICE';

  const formatExpiryDisplay = (d?: string) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      const datePart = date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const hasTime = !(hours === 0 && minutes === 0);
      if (hasTime) {
        const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${datePart}, ${timePart}`;
      }
      return datePart;
    } catch {
      return d;
    }
  };

  // 1. Notice Pin Toggle
  const handleTogglePin = async () => {
    try {
      setIsPinning(true);
      const nextPinState = !pinnedLocal;
      await noticeBoardService.togglePin(item.id, nextPinState);
      setPinnedLocal(nextPinState);
      onActionSuccess?.();
    } catch (e: any) {
      const msg = e?.message || 'Could not update pinned state.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Action Failed', msg);
    } finally {
      setIsPinning(false);
    }
  };

  // 2. Share
  const handleShare = async () => {
    try {
      await Share.share({
        title: item.title,
        message: `${item.title}\n\n${item.subtitle || ''}`,
      });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  // 3. Delete
  const handleConfirmDelete = async () => {
    try {
      setActionLoading(true);
      if (isNotice) {
        await noticeBoardService.deleteNotice(item.id);
      } else {
        await pollApi.deletePoll(item.id);
      }
      setDeleteConfirmVisible(false);
      onClose();
      onActionSuccess?.();
    } catch (e: any) {
      const msg = e?.message || 'Failed to delete item.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Delete Failed', msg);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Poll Close Early
  const handleConfirmClosePoll = async () => {
    try {
      setActionLoading(true);
      await pollApi.closePoll(item.id);
      setClosePollConfirmVisible(false);
      onClose();
      onActionSuccess?.();
    } catch (e: any) {
      const msg = e?.message || 'Failed to close poll.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Poll Reopen
  const handleReopenPoll = async () => {
    try {
      setActionLoading(true);
      await pollApi.reopenPoll(item.id);
      onClose();
      onActionSuccess?.();
    } catch (e: any) {
      const msg = e?.message || 'Failed to reopen poll.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  // 6. View Voters
  const handleOpenVoters = async () => {
    try {
      setLoadingVoters(true);
      setVotersModalVisible(true);
      const res = await pollApi.getPollVoters(item.id);
      const list = res?.data?.data || res?.data?.voters || res?.data || [];
      setVoters(Array.isArray(list) ? list : []);
    } catch {
      setVoters([]);
    } finally {
      setLoadingVoters(false);
    }
  };

  // 7. Export CSV
  const handleExportCSV = async () => {
    try {
      await pollApi.exportPollCSV(item.id);
      if (Platform.OS === 'web') window.alert('Export started.');
      else Alert.alert('Export Successful', 'Ballot CSV records exported.');
    } catch (e: any) {
      const msg = e?.message || 'Failed to export CSV.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Export Failed', msg);
    }
  };

  // 7b. Edit Content via Wizard
  const handleEdit = () => {
    onClose();
    router.navigate({
      pathname: '/(resident)/community-engagement/edit' as any,
      params: {
        mode: 'edit',
        id: item.id,
        type: isNotice ? 'NOTICE' : 'POLL',
      },
    });
  };

  // 8. Full Details Navigation
  const handleViewFullDetails = () => {
    onClose();
    router.navigate(item.route as any);
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title={isNotice ? t('notice_actions_title') : t('poll_actions_title')}
        snapPoints={['88%']}
      >
        <ScrollView className="flex-1 px-4 py-2" showsVerticalScrollIndicator={false}>
          <View className="gap-4 pb-14">
            {/* Card 1: Expiry / Voting Closes Date */}
            <View className="bg-card border border-border/70 rounded-2xl p-3.5 flex-row items-center gap-3.5">
              <View className="w-11 h-11 rounded-xl bg-orange-500/10 items-center justify-center">
                <Icon as={Calendar} size={20} className="text-orange-600 dark:text-orange-400" />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground font-medium">
                  {isNotice ? t('expiry_date', 'Expiry Date') : t('voting_closes')}
                </Text>
                <Text className="text-sm font-bold text-foreground mt-0.5">
                  {formatExpiryDisplay(item.expiryDate)}
                </Text>
              </View>
            </View>

            {/* Card 2: Live Results & Quorum (Poll) OR Core Specs (Notice) */}
            {!isNotice ? (
              <View className="bg-card border border-border/70 rounded-2xl p-4 gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="w-11 h-11 rounded-xl bg-orange-500/10 items-center justify-center">
                    <Icon as={BarChart2} size={20} className="text-orange-600 dark:text-orange-400" />
                  </View>
                  <Text className="text-sm font-bold text-foreground">
                    {t('live_results_quorum')}
                  </Text>
                </View>

                {loadingResults ? (
                  <Text className="text-xs text-muted-foreground py-2">
                    {t('loading_live_ballot_distribution')}
                  </Text>
                ) : pollResults?.options && pollResults.options.length > 0 ? (
                  <View className="gap-3 pt-1">
                    {/* Quorum indicator callout */}
                    {pollResults.quorumPercentage ? (
                      <View className="p-3 bg-[#FFF8F3] dark:bg-muted/30 border border-[#FDDBC9] dark:border-border/60 rounded-xl">
                        <Text className="text-xs font-semibold text-foreground">
                          {t('participation_quorum', { pct: pollResults.quorumPercentage })}
                        </Text>
                        <Text variant="muted" className="text-[11px] mt-0.5">
                          {t('total_votes_recorded', { count: pollResults.totalVotes || 0 })}
                        </Text>
                      </View>
                    ) : null}

                    {/* Option tallies */}
                    <View className="gap-3">
                      {pollResults.options.map((opt: any, idx: number) => {
                        const total = pollResults.totalVotes || 0;
                        const count = opt.votesCount || 0;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;

                        return (
                          <View key={opt._id || idx} className="gap-1.5">
                            <View className="flex-row items-center justify-between">
                              <Text className="text-xs font-medium text-foreground flex-1 me-2">
                                {translateText(opt.text)}
                              </Text>
                              <Text className="text-xs font-bold text-orange-600 dark:text-orange-400">
                                {count} ({pct}%)
                              </Text>
                            </View>
                            <View className="h-2 rounded-full bg-secondary/80 overflow-hidden">
                              <View
                                className="h-full bg-orange-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <Text className="text-xs text-muted-foreground py-2">
                    {item.status.toUpperCase() === 'DRAFT'
                      ? t('poll_has_not_been_published')
                      : t('no_votes_recorded_yet')}
                  </Text>
                )}
              </View>
            ) : (
              <View className="bg-card border border-border/70 rounded-2xl p-4 gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="w-11 h-11 rounded-xl bg-orange-500/10 items-center justify-center">
                    <Icon as={Megaphone} size={20} className="text-orange-600 dark:text-orange-400" />
                  </View>
                  <Text className="text-sm font-bold text-foreground">
                    {t('core_specifications')}
                  </Text>
                </View>

                <View className="gap-2 pt-1 border-t border-border/40">
                  <View className="flex-row justify-between py-1">
                    <Text className="text-xs text-muted-foreground">{t('category', 'Category')}</Text>
                    <Text className="text-xs font-semibold text-foreground">{translateText(item.category) || t('general', 'General')}</Text>
                  </View>
                  <View className="flex-row justify-between py-1">
                    <Text className="text-xs text-muted-foreground">{t('priority', 'Priority')}</Text>
                    <Text className="text-xs font-semibold text-foreground">{translateText(item.priority) || t('priority_medium', 'Medium')}</Text>
                  </View>
                  <View className="flex-row justify-between py-1">
                    <Text className="text-xs text-muted-foreground">{t('signoff_compliance')}</Text>
                    <Text className="text-xs font-semibold text-foreground">
                      {item.requiresAcknowledgement ? t('mandatory_signoff') : t('not_required', 'Not Required')}
                    </Text>
                  </View>
                  <View className="flex-row justify-between py-1">
                    <Text className="text-xs text-muted-foreground">{t('pinned_status')}</Text>
                    <Text className="text-xs font-semibold text-foreground">
                      {pinnedLocal ? t('pinned_to_top') : t('standard_feed')}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* MANAGEMENT Section */}
            <View className="gap-2.5">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t('management')}
              </Text>

              {/* Actions Button */}
              <TouchableOpacity
                onPress={() => setActionsSheetVisible(true)}
                activeOpacity={0.7}
                className="p-3.5 rounded-2xl bg-[#FFF8F3] dark:bg-card border border-[#FDDBC9] dark:border-border flex-row items-center justify-between"
                accessibilityRole="button"
                accessibilityLabel={t('actions')}
              >
                <View className="flex-row items-center">
                  <Icon as={SlidersHorizontal} size={18} className="text-orange-600 dark:text-orange-400" />
                  <Text className="text-sm font-semibold text-foreground ms-2.5">
                    {t('actions')}
                  </Text>
                </View>
                <Icon as={ChevronRight} size={18} className="text-orange-600 dark:text-orange-400" />
              </TouchableOpacity>
            </View>

            {/* Primary View Action Button */}
            <View className="pt-2">
              <TouchableOpacity
                onPress={handleViewFullDetails}
                activeOpacity={0.8}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#F95700] active:bg-[#EA580C] flex-row items-center justify-center gap-2.5 shadow-sm"
                accessibilityRole="button"
                accessibilityLabel={isNotice ? t('view_full_notice') : t('view_full_ballot')}
              >
                <Icon as={isNotice ? FileText : Vote} size={20} className="text-white" />
                <Text className="text-sm font-bold text-white">
                  {isNotice ? t('view_full_notice') : t('view_full_ballot')}
                </Text>
                <Icon as={ArrowUpRight} size={18} className="text-white" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </BottomSheet>

      {/* Secondary Management Actions Bottom Sheet */}
      <BottomSheet
        visible={actionsSheetVisible}
        onClose={() => setActionsSheetVisible(false)}
        title={t('actions')}
      >
        <View className="gap-2.5 px-2 pb-6 pt-1">
          {/* Edit */}
          <TouchableOpacity
            onPress={() => {
              setActionsSheetVisible(false);
              handleEdit();
            }}
            activeOpacity={0.7}
            className="flex-row items-center p-3.5 rounded-xl bg-card border border-border/80"
          >
            <View className="w-9 h-9 rounded-lg bg-primary/10 items-center justify-center me-3">
              <Icon as={Edit3} size={18} className="text-primary" />
            </View>
            <Text className="text-sm font-semibold text-foreground">
              {isNotice ? t('edit_notice') : t('edit_poll')}
            </Text>
          </TouchableOpacity>

          {/* Close Early / Reopen or Pin / Unpin */}
          {isNotice ? (
            <TouchableOpacity
              onPress={() => {
                setActionsSheetVisible(false);
                handleTogglePin();
              }}
              activeOpacity={0.7}
              className="flex-row items-center p-3.5 rounded-xl bg-card border border-border/80"
            >
              <View className="w-9 h-9 rounded-lg bg-amber-500/10 items-center justify-center me-3">
                <Icon
                  as={pinnedLocal ? PinOff : Pin}
                  size={18}
                  className="text-amber-600 dark:text-amber-400"
                />
              </View>
              <Text className="text-sm font-semibold text-foreground">
                {pinnedLocal ? t('unpin') : t('pin_to_top')}
              </Text>
            </TouchableOpacity>
          ) : item.status.toUpperCase() === 'ACTIVE' ? (
            <TouchableOpacity
              onPress={() => {
                setActionsSheetVisible(false);
                setClosePollConfirmVisible(true);
              }}
              activeOpacity={0.7}
              className="flex-row items-center p-3.5 rounded-xl bg-card border border-border/80"
            >
              <View className="w-9 h-9 rounded-lg bg-amber-500/10 items-center justify-center me-3">
                <Icon as={Lock} size={18} className="text-amber-600 dark:text-amber-400" />
              </View>
              <Text className="text-sm font-semibold text-foreground">
                {t('close_early')}
              </Text>
            </TouchableOpacity>
          ) : item.status.toUpperCase() === 'CLOSED' ? (
            <TouchableOpacity
              onPress={() => {
                setActionsSheetVisible(false);
                handleReopenPoll();
              }}
              activeOpacity={0.7}
              className="flex-row items-center p-3.5 rounded-xl bg-card border border-border/80"
            >
              <View className="w-9 h-9 rounded-lg bg-primary/10 items-center justify-center me-3">
                <Icon as={RefreshCw} size={18} className="text-primary" />
              </View>
              <Text className="text-sm font-semibold text-foreground">
                {t('reopen_poll')}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Audit Voters (Poll only) */}
          {!isNotice ? (
            <TouchableOpacity
              onPress={() => {
                setActionsSheetVisible(false);
                handleOpenVoters();
              }}
              activeOpacity={0.7}
              className="flex-row items-center p-3.5 rounded-xl bg-card border border-border/80"
            >
              <View className="w-9 h-9 rounded-lg bg-blue-500/10 items-center justify-center me-3">
                <Icon as={Users} size={18} className="text-blue-600 dark:text-blue-400" />
              </View>
              <Text className="text-sm font-semibold text-foreground">
                {t('audit_voters')}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Export CSV (Poll only) */}
          {!isNotice ? (
            <TouchableOpacity
              onPress={() => {
                setActionsSheetVisible(false);
                handleExportCSV();
              }}
              activeOpacity={0.7}
              className="flex-row items-center p-3.5 rounded-xl bg-card border border-border/80"
            >
              <View className="w-9 h-9 rounded-lg bg-emerald-500/10 items-center justify-center me-3">
                <Icon as={Download} size={18} className="text-emerald-600 dark:text-emerald-400" />
              </View>
              <Text className="text-sm font-semibold text-foreground">
                {t('export_csv')}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Share */}
          <TouchableOpacity
            onPress={() => {
              setActionsSheetVisible(false);
              handleShare();
            }}
            activeOpacity={0.7}
            className="flex-row items-center p-3.5 rounded-xl bg-card border border-border/80"
          >
            <View className="w-9 h-9 rounded-lg bg-purple-500/10 items-center justify-center me-3">
              <Icon as={Share2} size={18} className="text-purple-600 dark:text-purple-400" />
            </View>
            <Text className="text-sm font-semibold text-foreground">
              {isNotice ? t('share_notice') : t('share_poll')}
            </Text>
          </TouchableOpacity>

          {/* Delete */}
          <TouchableOpacity
            onPress={() => {
              setActionsSheetVisible(false);
              setDeleteConfirmVisible(true);
            }}
            activeOpacity={0.7}
            className="flex-row items-center p-3.5 rounded-xl bg-destructive/10 border border-destructive/30"
          >
            <View className="w-9 h-9 rounded-lg bg-destructive/20 items-center justify-center me-3">
              <Icon as={Trash2} size={18} className="text-destructive" />
            </View>
            <Text className="text-sm font-semibold text-destructive">
              {t('delete')}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        visible={deleteConfirmVisible}
        title={`${t('delete')} ${isNotice ? t('notice') : t('poll')}?`}
        message={`${t('confirm_delete', 'Are you sure you want to delete')} "${item.title}"?`}
        variant="danger"
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmVisible(false)}
        loading={actionLoading}
      />

      {/* Confirmation Modal for Closing Poll Early */}
      <ConfirmationModal
        visible={closePollConfirmVisible}
        title={t('close_poll_early')}
        message={t('close_poll_confirm_msg', 'Closing this poll will prevent residents from submitting any further votes. The current results will be finalized.')}
        variant="warning"
        confirmLabel={t('close_early')}
        cancelLabel={t('cancel')}
        onConfirm={handleConfirmClosePoll}
        onCancel={() => setClosePollConfirmVisible(false)}
        loading={actionLoading}
      />

      {/* Poll Voters Inspection Modal */}
      <VotersModal
        visible={votersModalVisible}
        onClose={() => setVotersModalVisible(false)}
        poll={item}
        voters={voters}
        loading={loadingVoters}
      />
    </>
  );
};

export default EngagementActionsBottomSheet;
