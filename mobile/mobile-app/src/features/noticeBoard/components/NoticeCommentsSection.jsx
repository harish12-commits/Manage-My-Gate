import React, { useState } from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { TextInput } from '@/components/forms/TextInput';
import { Send, Trash2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

/**
 * NoticeCommentsSection
 * Renders the notice comments list, empty state, and interactive post input.
 * Supports collapsing/expanding comments on heading touch.
 * Supports deleting comments for admin/creator.
 */
export function NoticeCommentsSection({
  comments = [],
  loading = false,
  addingComment = false,
  allowComments = true,
  onAddComment,
  onDeleteComment,
  currentUserId,
  isAdmin = false,
}) {
  const { t } = useTranslation();
  const [commentText, setCommentText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePost = async () => {
    if (!allowComments) return;
    const trimmed = commentText.trim();
    if (!trimmed || addingComment) return;
    try {
      await onAddComment(trimmed);
      setCommentText('');
      setIsExpanded(true);
    } catch (e) {
      console.error('Failed to add comment:', e);
    }
  };

  return (
    <View className="mt-4 mb-6">
      {/* Interactive Section Header (Touch heading to expand/hide comments) */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setIsExpanded((prev) => !prev)}
        className="flex-row items-center justify-between py-2.5 px-3 mb-3 bg-muted/20 hover:bg-muted/30 border border-border/60 rounded-xl"
        accessibilityRole="button"
        accessibilityLabel={`${isExpanded ? t('hide', 'Hide') : t('show', 'Show')} ${t('comments', 'comments')}`}
      >
        <View className="flex-row items-center flex-1 min-w-0 me-2">
          <MessageSquare size={18} color="#737373" className="me-2 shrink-0" />
          <Text className="text-foreground font-bold text-base flex-1" numberOfLines={1}>
            {t('comments', 'Comments')} ({comments.length})
          </Text>
          {!allowComments && (
            <View className="bg-muted px-2 py-0.5 rounded-md ms-2 shrink-0">
              <Text className="text-muted-foreground text-[10px] font-bold uppercase">
                {t('disabled_by_admin', 'Disabled by Admin')}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-1.5 shrink-0">
          {loading && <ActivityIndicator size="small" color="#737373" />}
          <Text className="text-muted-foreground text-xs font-semibold">
            {isExpanded ? t('hide', 'Hide') : t('show', 'Show')}
          </Text>
          {isExpanded ? (
            <ChevronUp size={18} color="#737373" />
          ) : (
            <ChevronDown size={18} color="#737373" />
          )}
        </View>
      </TouchableOpacity>

      {/* Collapsible Content */}
      {isExpanded && (
        <View>
          {/* Comment Input Form (only if enabled) */}
          {allowComments ? (
            <View className="flex-row items-center gap-2 mb-4">
              <View className="flex-1">
                <TextInput
                  placeholder={t('write_a_comment', 'Write a comment...')}
                  value={commentText}
                  onChangeText={setCommentText}
                  returnKeyType="send"
                  onSubmitEditing={handlePost}
                  editable={!addingComment}
                  multiline
                  className="text-foreground py-2 text-sm max-h-24"
                />
              </View>
              <Button
                size="icon"
                variant="default"
                onPress={handlePost}
                disabled={!commentText.trim() || addingComment}
                loading={addingComment}
                accessibilityLabel="Send comment"
              >
                <Send size={16} color="#ffffff" />
              </Button>
            </View>
          ) : (
            <View className="bg-muted/30 border border-dashed border-border rounded-xl p-3 mb-4 items-center">
              <Text className="text-muted-foreground text-xs text-center font-medium">
                {t('comments_disabled_notice', 'Comments have been turned off for this announcement.')}
              </Text>
            </View>
          )}

          {/* Comments List */}
          {comments.length === 0 && !loading ? (
            <View className="bg-muted/40 rounded-xl p-6 items-center justify-center border border-dashed border-border my-2">
              <Text className="text-muted-foreground text-sm font-medium text-center">
                No comments yet. Be the first to start the conversation!
              </Text>
            </View>
          ) : (
        <View className="gap-3">
          {comments.map((comment) => {
            const author = comment.createdBy || {};
            const isAuthor =
              currentUserId &&
              (author._id === currentUserId || author.id === currentUserId || comment.userId === currentUserId);

            const isAdminComment =
              comment.isAdminComment === true ||
              author.role === 'Community Admin' ||
              comment.authorRole === 'Community Admin' ||
              comment.authorName === 'Community Admin' ||
              (isAuthor && isAdmin);

            const authorDisplayName = isAdminComment
              ? 'Community Admin'
              : (author.name || comment.authorName || author.username || 'Resident');

            const initials = authorDisplayName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            const canDelete = isAdmin || isAuthor;

            const timeFormatted = comment.createdAt
              ? new Date(comment.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <View
                key={comment._id || comment.id}
                className={`border rounded-xl p-3 ${
                  isAdminComment
                    ? 'bg-primary/5 border-primary/30'
                    : 'bg-card border-border/70'
                }`}
              >
                <View className="flex-row items-center justify-between mb-1.5">
                  <View className="flex-row items-center gap-2 flex-1">
                    <Avatar
                      fallback={initials}
                      size="sm"
                      className={isAdminComment ? 'bg-primary/20 border-primary' : ''}
                    />
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Text
                          className={`font-semibold text-xs ${
                            isAdminComment ? 'text-primary font-bold' : 'text-foreground'
                          }`}
                          numberOfLines={1}
                        >
                          {authorDisplayName}
                        </Text>
                        {isAdminComment && (
                          <View className="bg-primary/15 px-1.5 py-0.5 rounded">
                            <Text className="text-primary font-bold text-[10px] uppercase tracking-wider">
                              Admin
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-muted-foreground text-[10px]">
                        {timeFormatted}
                      </Text>
                    </View>
                  </View>

                  {canDelete && (
                    <TouchableOpacity
                      onPress={() => onDeleteComment && onDeleteComment(comment._id || comment.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      className="p-1"
                      accessibilityLabel="Delete comment"
                      accessibilityRole="button"
                    >
                      <Trash2 size={14} color="#dc2626" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Comment Text Content */}
                <Text className="text-foreground text-sm leading-relaxed ps-9 text-start">
                  {comment.content}
                </Text>
              </View>
            );
          })}
        </View>
      )}
        </View>
      )}
    </View>
  );
}

export default NoticeCommentsSection;
