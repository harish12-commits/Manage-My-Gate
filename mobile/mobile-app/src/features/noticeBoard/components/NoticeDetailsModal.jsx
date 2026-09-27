import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { StatusBadge, getStatusVariant } from '@/components/ui/StatusBadge';
import { DetailRow } from '@/components/ui/DetailRow';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useTranslation } from '@/src/utils/i18n';
import {
  Pin,
  Globe,
  Archive,
  Edit,
  Trash2,
  Users,
  Calendar,
  Clock,
  ShieldAlert,
  CheckCircle2,
  FileText,
  ExternalLink,
} from 'lucide-react-native';

export function NoticeDetailsModal({
  visible,
  notice,
  onClose,
  onPinToggle,
  onStatusChange,
  onDeletePress,
  canPin = false,
  canUpdate = false,
  canDelete = false,
}) {
  const router = useRouter();
  const { t, translateText } = useTranslation();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  if (!notice) return null;

  const isPinned = !!notice.isPinned;
  const status = notice.status || 'Draft';

  const getNoticeStatusVariant = (st) => {
    switch (st) {
      case 'Published': return 'success';
      case 'Scheduled': return 'info';
      case 'Draft': return 'secondary';
      case 'Expired': return 'warning';
      case 'Archived': return 'muted';
      default: return 'neutral';
    }
  };

  const formattedDate = (dateVal) => {
    if (!dateVal) return null;
    try {
      return new Date(dateVal).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(dateVal);
    }
  };

  const targetType = notice.targetAudience?.targetType || 'ALL';
  const targetLabel =
    targetType === 'ALL'
      ? t('all_community_residents', 'All Community Residents')
      : targetType === 'BLOCK'
      ? `${t('specific_blocks', 'Specific Blocks')} (${notice.targetAudience?.blocks?.join(', ') || t('n_a', 'N/A')})`
      : targetType === 'ROLE'
      ? `${t('specific_roles', 'Specific Roles')} (${notice.targetAudience?.roles?.join(', ') || t('n_a', 'N/A')})`
      : targetType === 'USER'
      ? t('specific_users', 'Specific Users')
      : targetType;

  return (
    <>
      <BottomSheet
        visible={visible && !deleteConfirmOpen}
        onClose={onClose}
        title={t('notice_administration', 'Notice Administration')}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="p-4"
          contentContainerClassName="gap-4 pb-6"
        >
          {/* Header Card / Title + Status */}
          <View className="bg-muted/40 p-4 rounded-2xl border border-border/60 gap-2.5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5 flex-1 me-2">
                {isPinned && (
                  <View className="bg-primary/15 px-2 py-0.5 rounded-md flex-row items-center gap-1">
                    <Pin size={12} className="text-primary" />
                    <Text className="text-[11px] font-bold text-primary">{t('pinned', 'PINNED')}</Text>
                  </View>
                )}
              </View>
              <StatusBadge
                label={t(`status_${status.toLowerCase()}`, status)}
                variant={getNoticeStatusVariant(status)}
                size="sm"
              />
            </View>

            <Text className="text-lg font-bold text-foreground text-start">
              {notice.title}
            </Text>

            {notice.description ? (
              <Text className="text-sm text-muted-foreground leading-relaxed text-start">
                {notice.description}
              </Text>
            ) : null}
          </View>

          {/* Quick Admin Actions Row */}
          <View className="p-1 bg-muted/60 rounded-2xl flex-row gap-1">
            {canPin && (
              <Button
                variant={isPinned ? 'default' : 'outline'}
                size="sm"
                onPress={() => onPinToggle?.(notice._id, isPinned)}
                className="flex-1 flex-row items-center justify-center py-2 px-2 rounded-xl gap-1"
                accessibilityLabel="Toggle Pin"
              >
                <Pin size={13} className={isPinned ? 'text-primary-foreground' : 'text-foreground'} />
                <Text className={`text-xs font-bold ${isPinned ? 'text-primary-foreground' : 'text-foreground'}`}>
                  {isPinned ? t('unpin', 'Unpin') : t('pin', 'Pin')}
                </Text>
              </Button>
            )}

            {canUpdate && status !== 'Published' && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => onStatusChange?.(notice._id, 'Published')}
                className="flex-1 flex-row items-center justify-center py-2 px-2 rounded-xl gap-1"
                accessibilityLabel="Publish Notice"
              >
                <Globe size={13} className="text-foreground" />
                <Text className="text-xs font-bold text-foreground">{t('publish', 'Publish')}</Text>
              </Button>
            )}

            {canUpdate && status === 'Published' && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => onStatusChange?.(notice._id, 'Archived')}
                className="flex-1 flex-row items-center justify-center py-2 px-2 rounded-xl gap-1"
                accessibilityLabel="Archive Notice"
              >
                <Archive size={13} className="text-foreground" />
                <Text className="text-xs font-bold text-foreground">{t('archive', 'Archive')}</Text>
              </Button>
            )}

            {canUpdate && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/(resident)/notices/create',
                    params: { id: notice._id },
                  });
                }}
                className="flex-1 flex-row items-center justify-center py-2 px-2 rounded-xl gap-1"
                accessibilityLabel="Edit Notice"
              >
                <Edit size={13} className="text-foreground" />
                <Text className="text-xs font-bold text-foreground">{t('edit', 'Edit')}</Text>
              </Button>
            )}

            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onPress={() => setDeleteConfirmOpen(true)}
                className="flex-1 flex-row items-center justify-center py-2 px-2 rounded-xl gap-1"
                accessibilityLabel="Delete Notice"
              >
                <Trash2 size={13} color="#ffffff" />
                <Text className="text-xs font-bold text-white">{t('delete', 'Delete')}</Text>
              </Button>
            )}
          </View>

          {/* Specification Details */}
          <View className="bg-card border border-border/70 rounded-2xl p-4 gap-1">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              {t('notice_details', 'Notice Details')}
            </Text>
            <DetailRow
              label={t('category', 'Category')}
              value={notice.category || 'General'}
              iconName="Tag"
            />
            <DetailRow
              label={t('priority', 'Priority')}
              value={
                <StatusBadge
                  label={t(`priority_${(notice.priority || 'Normal').toLowerCase()}`, notice.priority || 'Normal')}
                  variant={getStatusVariant(notice.priority || 'Normal')}
                  size="sm"
                />
              }
              iconName="AlertCircle"
            />
            <DetailRow
              label={t('target_audience', 'Target Audience')}
              value={targetLabel}
              iconName="Users"
            />
            <DetailRow
              label={t('created', 'Created')}
              value={formattedDate(notice.createdAt) || t('n_a', 'N/A')}
              iconName="Calendar"
            />
            {notice.scheduleDate && (
              <DetailRow
                label={t('scheduled_for', 'Scheduled For')}
                value={formattedDate(notice.scheduleDate)}
                iconName="Clock"
              />
            )}
            {notice.expiryDate && (
              <DetailRow
                label={t('expires_on', 'Expires On')}
                value={formattedDate(notice.expiryDate)}
                iconName="Clock"
              />
            )}
            <DetailRow
              label={t('author', 'Author')}
              value={notice.author?.name || notice.createdBy?.name || t('community_admin', 'Community Admin')}
              iconName="UserCheck"
              isLast={true}
            />
          </View>

          {/* View Full Screen Detail Link */}
          <Button
            variant="outline"
            size="md"
            onPress={() => {
              onClose();
              router.push({
                pathname: '/(resident)/notices/[id]',
                params: { id: notice._id },
              });
            }}
            className="flex-row items-center justify-center gap-2 rounded-xl"
            accessibilityLabel="View Full Screen Notice"
          >
            <Text className="text-sm font-semibold text-foreground">{t('open_fullscreen_notice', 'Open Full Screen Notice')}</Text>
            <ExternalLink size={15} className="text-foreground" />
          </Button>
        </ScrollView>
      </BottomSheet>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        visible={deleteConfirmOpen}
        title={t('delete_notice_confirm', 'Delete Notice?')}
        message={`Are you sure you want to permanently remove "${notice.title}"? This cannot be undone.`}
        variant="danger"
        confirmLabel={t('delete_notice', 'Delete Notice')}
        cancelLabel={t('cancel', 'Cancel')}
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          onClose();
          onDeletePress?.(notice._id);
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  );
}

export default NoticeDetailsModal;
