import React, { useEffect, useMemo, useState } from 'react';
import { View, Share, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';


import { ScreenShell } from '@/components/ui/ScreenShell';
import { ScrollContainer } from '@/components/layout/ScrollContainer';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { StatusBadge, getStatusVariant } from '@/components/ui/StatusBadge';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { ActionBar } from '@/components/ui/ActionBar';

import { useNoticeBoard } from '../hooks/useNoticeBoard';
import {
  NoticeImageGallery,
  resolveImageUrl,
  NoticeEngagementBar,
  NoticeCommentsSection,
  ErrorBoundary,
} from '../components';
import { Divider } from '@/components/common/Divider';
import { Pin, FileText, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

function NoticeDetailContent() {
  const { id } = useLocalSearchParams();
  const [showMetadata, setShowMetadata] = useState(false);
  const { t, translateText, tCategoryName } = useTranslation();

  const {
    selectedNotice,
    loading,
    error,
    acknowledging,
    comments,
    commentsLoading,
    addingComment,
    reactions,
    reactionsLoading,
    isAdmin,
    user,
    loadNoticeById,
    readNotice,
    toggleBookmark,
    acknowledgeNotice,
    loadComments,
    postComment,
    removeComment,
    loadReactions,
    toggleReaction,
  } = useNoticeBoard();

  // Load notice details, read status, comments and reactions on mount
  useEffect(() => {
    if (id) {
      loadNoticeById(id);
      readNotice(id);
      loadComments(id);
      loadReactions(id);
    }
  }, [id]);

  const handleBookmarkToggle = () => {
    if (selectedNotice) {
      toggleBookmark(selectedNotice._id, !selectedNotice.isBookmarkedByUser);
    }
  };

  const handleShare = async () => {
    if (!selectedNotice) return;
    try {
      await Share.share({
        title: selectedNotice.title,
        message: `${selectedNotice.title}\n\n${selectedNotice.description}`,
      });
    } catch (e) {
      console.error('Error sharing notice:', e);
    }
  };

  const handleLikeToggle = () => {
    if (selectedNotice && selectedNotice._id) {
      toggleReaction(selectedNotice._id, 'LIKE');
    }
  };

  const handleAddComment = (content) => {
    if (selectedNotice && selectedNotice._id) {
      return postComment(selectedNotice._id, content);
    }
  };

  const handleDeleteComment = (commentId) => {
    if (selectedNotice && selectedNotice._id) {
      return removeComment(selectedNotice._id, commentId);
    }
  };

  const noticeImages = useMemo(() => {
    const rawList = [];
    if (selectedNotice?.images && Array.isArray(selectedNotice.images)) {
      selectedNotice.images.forEach((img) => {
        const u = typeof img === 'string' ? img : img?.url || img?.uri;
        if (u) rawList.push(u);
      });
    }
    if (selectedNotice?.image && typeof selectedNotice.image === 'string') {
      rawList.push(selectedNotice.image);
    }

    const seen = new Set();
    const resolved = [];

    for (const raw of rawList) {
      const url = resolveImageUrl(raw);
      if (url && !seen.has(url)) {
        seen.add(url);
        resolved.push(url);
      }
    }

    return resolved;
  }, [selectedNotice]);

  // Show loading spinner if actively loading, OR if we haven't fetched a notice yet and there is no error.
  const isFetching = loading || (!selectedNotice && !error);

  if (isFetching) {
    return (
      <View className="flex-1 items-center justify-center p-4 bg-background">
        <ActivityIndicator size="large" color="#171717" />
      </View>
    );
  }

  if (error || !selectedNotice || !selectedNotice._id) {
    return (
      <View className="flex-1 items-center justify-center p-4 bg-background">
        <Text className="text-destructive font-semibold text-center">
          {error || selectedNotice?.message || 'Notice not found.'}
        </Text>
      </View>
    );
  }

  const isBookmarked = selectedNotice.isBookmarkedByUser;
  const postedDateObj = selectedNotice.createdAt ? new Date(selectedNotice.createdAt) : null;
  const formattedPostedDate = postedDateObj
    ? postedDateObj.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  const formattedPostedTime = postedDateObj
    ? postedDateObj.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  const formattedExpiryDate = selectedNotice.expiryDate
    ? new Date(selectedNotice.expiryDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const creatorName =
    selectedNotice.createdBy?.username || selectedNotice.createdBy?.name || 'Community Admin';

  const attachments = Array.isArray(selectedNotice.attachments) ? selectedNotice.attachments : [];

  const currentUserId = user?._id || user?.id;
  const likeCount = reactions?.counts?.LIKE || 0;
  const isLiked = reactions?.userReaction === 'LIKE';

  return (
    <View className="flex-1 bg-background">
      <ScrollContainer contentContainerStyle={{ paddingBottom: 125 }}>
        <View className="p-4">
          {/* 1. Header Badges: Priority, Pinned, Category, Status */}
          <View className="flex-row flex-wrap items-center gap-2 mb-3">
            {selectedNotice.priority === 'High' && (
              <StatusBadge label="🟠 HIGH PRIORITY" variant="warning" size="md" />
            )}
            {selectedNotice.priority === 'Medium' && (
              <StatusBadge label="🟡 MEDIUM PRIORITY" variant="info" size="sm" />
            )}
            {selectedNotice.priority === 'Low' && (
              <StatusBadge label="🟢 LOW PRIORITY" variant="neutral" size="sm" />
            )}
            {selectedNotice.isPinned && (
              <View className="flex-row items-center bg-primary/10 px-2 py-1 rounded-md">
                <Icon as={Pin} size={12} className="text-primary me-1" />
                <Text className="text-primary text-xs font-semibold">{t('pinned', 'Pinned')}</Text>
              </View>
            )}
            <StatusBadge label={tCategoryName(selectedNotice.category || 'General')} variant="neutral" size="sm" />
            <StatusBadge
              label={t(`status_${(selectedNotice.status || 'published').toLowerCase()}`, selectedNotice.status || 'Published')}
              variant={getStatusVariant(selectedNotice.status || 'Published')}
              size="sm"
            />
          </View>

          {/* 2. Notice Title */}
          <Text className="text-foreground text-2xl font-bold mb-1.5 text-start">
            {translateText(selectedNotice.title)}
          </Text>

          {/* 3. Subtitle / Timestamp & Author */}
          <Text className="text-muted-foreground text-xs font-medium mb-4 text-start">
            {[
              formattedPostedDate && formattedPostedTime
                ? `${formattedPostedDate} • ${formattedPostedTime}`
                : formattedPostedDate,
              `${t('posted_by', 'Posted by')} ${creatorName}`,
            ]
              .filter(Boolean)
              .join(' • ')}
          </Text>

          {/* 4. Horizontal Divider */}
          <Divider className="my-2" />

          {/* 5. Notice Announcement Body Content */}
          <View className="py-3">
            <Text className="text-foreground text-base leading-relaxed text-start">
              {translateText(selectedNotice.description || selectedNotice.content)}
            </Text>
          </View>

          {/* 6. Attachments (PDF / Document cards & Image Gallery) */}
          {attachments.length > 0 && (
            <View className="my-3 gap-2">
              <Text className="text-foreground font-semibold text-sm">{t('attachments', 'Attachments')}</Text>
              {attachments.map((att, idx) => {
                const attUrl = typeof att === 'string' ? att : att.url || att.filename;
                const attName =
                  typeof att === 'object' && att.filename
                    ? att.filename
                    : attUrl.split('/').pop() || `Attachment ${idx + 1}`;
                return (
                  <View
                    key={idx}
                    className="flex-row items-center bg-muted/60 border border-border rounded-xl p-3"
                  >
                    <FileText size={20} color="#2563eb" className="me-3" />
                    <View className="flex-1">
                      <Text className="text-foreground font-medium text-sm" numberOfLines={1}>
                        {attName}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {noticeImages.length > 0 && (
            <View className="my-3 items-center justify-center">
              <NoticeImageGallery images={noticeImages} />
            </View>
          )}

          {/* 7. Horizontal Divider */}
          <Divider className="my-2" />

          {/* 8. Social Engagement Bar: 💬 Comments & Community Reactions */}
          <NoticeEngagementBar
            commentCount={comments.length}
            reactions={reactions?.counts || selectedNotice?.reactionCounts || selectedNotice?.reactions}
            userReaction={reactions?.userReaction || selectedNotice?.userReaction}
            likeCount={likeCount}
            isLiked={isLiked}
            allowComments={selectedNotice.allowComments !== false}
            allowReactions={selectedNotice.allowReactions !== false}
            onReactionPress={(type) => toggleReaction(selectedNotice._id, type)}
            onLikePress={() => toggleReaction(selectedNotice._id, 'HELPFUL')}
            onCommentPress={() => {}}
            loading={reactionsLoading}
          />

          {/* 10. Interactive Comments Section */}
          <NoticeCommentsSection
            comments={comments}
            loading={commentsLoading}
            addingComment={addingComment}
            allowComments={selectedNotice.allowComments !== false}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />

          {/* 11. Collapsible Notice Details Metadata */}
          <View className="mt-2 mb-4 bg-card border border-border rounded-xl overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setShowMetadata((prev) => !prev)}
              className="flex-row items-center justify-between px-4 py-3 w-full"
            >
              <Text className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                {showMetadata ? t('hide_notice_details', 'Hide Notice Details') : t('view_notice_details', 'View Notice Details & Audience')}
              </Text>
              {showMetadata ? <ChevronUp size={16} color="#737373" /> : <ChevronDown size={16} color="#737373" />}
            </Button>

            {showMetadata && (
              <View className="p-4 pt-0">
                <DetailRow label={t('posted_by', 'Posted By')} value={creatorName} iconName="User" />
                <DetailRow label={t('posted_on', 'Posted On')} value={formattedPostedDate || t('n_a', 'N/A')} iconName="Calendar" />
                <DetailRow label={t('expiry', 'Expiry')} value={formattedExpiryDate || t('n_a', 'N/A')} iconName="CalendarOff" />
                <DetailRow
                  label={t('audience', 'Audience')}
                  value={(() => {
                    const aud = selectedNotice.targetAudience;
                    if (!aud || aud.targetType === 'ALL') {
                      return t('all_community_members', 'All Community Members');
                    }
                    if (aud.targetType === 'ROLES') {
                      const rolesList = (aud.targetRoles || [])
                        .map((r) => (typeof r === 'string' ? r : r.name || r._id))
                        .filter(Boolean);
                      return rolesList.length > 0 ? `${t('roles', 'Roles')}: ${rolesList.join(', ')}` : t('specific_roles', 'Specific Roles');
                    }
                    if (aud.targetType === 'RESIDENCY_TYPES') {
                      return (aud.targetResidencyTypes || []).join(', ') || t('specific_residents', 'Specific Residents');
                    }
                    if (aud.targetType === 'CUSTOM') {
                      const userNames = (aud.targetUsers || [])
                        .map((u) => (typeof u === 'string' ? u : u.name || u.username || u.email))
                        .filter(Boolean);
                      return userNames.length > 0
                        ? `${t('specific_members', 'Specific Member(s)')}: ${userNames.join(', ')}`
                        : t('specific_member', 'Specific Member');
                    }
                    return aud.targetType || t('community', 'Community');
                  })()}
                  iconName="Users"
                  isLast
                />
              </View>
            )}
          </View>
        </View>
      </ScrollContainer>

      {/* Floating Actions Sticky Footer */}
      <View className="absolute bottom-0 left-0 right-0">
        <ActionBar
          primaryAction={{
            label: isBookmarked ? t('bookmarked', 'Bookmarked') : t('add_to_bookmarks', 'Add to Bookmarks'),
            onPress: handleBookmarkToggle,
          }}
          secondaryAction={{
            label: t('share', 'Share'),
            onPress: handleShare,
          }}
        />
      </View>
    </View>
  );
}

export default function NoticeDetailScreen() {
  const { canUpdate, isAdmin } = useNoticeBoard();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();

  return (
    <ErrorBoundary>
      <ScreenShell 
        title={t('notice_details', 'Notice Details')}
        headerRight={
          (canUpdate || isAdmin) ? (
            <Button
              variant="outline"
              size="sm"
              onPress={() => router.navigate({
                pathname: '/(resident)/notices/create',
                params: { id }
              })}
              accessibilityLabel="Edit Notice"
            >
              {t('edit', 'Edit')}
            </Button>
          ) : null
        }
      >
        <NoticeDetailContent />
      </ScreenShell>
    </ErrorBoundary>
  );
}
