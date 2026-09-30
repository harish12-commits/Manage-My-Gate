import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge, StatusVariant } from '@/components/ui/StatusBadge';
import { SegmentedControl } from '@/components/common/SegmentedControl';
import { getLocalizedPresetNotes } from '../types/communityNoteTypes';
import { useCommunityNote, formatExpirationCountdown } from '../hooks/useCommunityNote';
import { useDirectoryMessaging } from '../hooks/useDirectoryMessaging';
import { DirectoryQuickMessageSheet } from '../components/DirectoryQuickMessageSheet';
import { useTranslation } from '@/src/utils/i18n';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { Sparkles, Send, Trash2, ThumbsUp, MessageSquare, Phone, Clock } from 'lucide-react-native';

export function AllNotesScreen() {
  const [currentTab, setCurrentTab] = useState<'feed' | 'compose'>('feed');
  const { onOpenConversation } = useDirectoryMessaging();
  const { user } = useAuth();
  const currentUserId = (user as any)?.id || (user as any)?._id || (user as any)?.userId;
  const { t, tRole } = useTranslation();

  const {
    myActiveNote,
    activeNotes,
    totalActiveNotesCount,
    noteText,
    setNoteText,
    loading,
    onPublish,
    onDelete,
    onSelectPreset,
  } = useCommunityNote();

  const [quickSheetOpen, setQuickSheetOpen] = useState(false);
  const [selectedMemberForMsg, setSelectedMemberForMsg] = useState<any>(null);

  const charCount = noteText.length;
  const isOverLimit = charCount > 80;

  const localizedPresetOptions = getLocalizedPresetNotes(t);

  const handlePublishNote = async () => {
    await onPublish();
    setCurrentTab('feed');
  };

  const handleDeleteNote = async () => {
    await onDelete();
    setCurrentTab('feed');
  };

  const handleInterested = async (targetMember: any) => {
    setSelectedMemberForMsg(targetMember);
    setQuickSheetOpen(true);
  };

  const router = useRouter();
return (
    <ScreenShell
      title={t('all_community_notes', 'All Community Notes')}
      subtitle={t('community_notes_sub', 'Discover 24-hour neighbor notes & publish your status')}
      iconName="Sparkles"
      showBackButton={true}
>
      <View className="flex-1 bg-background px-4 pt-3 pb-6 gap-3.5">
        {/* Navigation Segmented Control */}
        <SegmentedControl
          segments={[
            { key: 'feed', label: `${t('all_notes_tab', 'All Notes')} (${totalActiveNotesCount || activeNotes.length || 0})` },
            { key: 'compose', label: myActiveNote ? t('my_active_note_tab', 'My Active Note') : t('publish_note_tab', '+ Publish Note') },
          ]}
          activeSegment={currentTab}
          onChange={(tab) => setCurrentTab(tab as any)}
        />

        {currentTab === 'compose' ? (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 pb-12">
            {/* Active Note Banner */}
            {myActiveNote ? (
              <View className="bg-primary/10 border border-primary/20 rounded-2xl p-4 gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-primary uppercase">
                    {t('active_community_note_banner', 'Active Community Note')}
                  </Text>
                  <View className="flex-row items-center gap-1 bg-background/80 px-2 py-1 rounded-lg border border-border/40">
                    <Clock size={11} className="text-muted-foreground" />
                    <Text className="text-[11px] text-muted-foreground font-semibold">
                      {formatExpirationCountdown(myActiveNote.expiresAt)}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm font-bold text-foreground">
                  {myActiveNote.emoji ? `${myActiveNote.emoji} ` : ''}{myActiveNote.text}
                </Text>
              </View>
            ) : (
              <View className="bg-muted/40 border border-border p-4 rounded-2xl gap-1">
                <Text className="text-xs font-bold text-foreground">
                  {t('post_24h_note_banner', 'Post a 24-Hour Community Note')}
                </Text>
                <Text className="text-xs text-muted-foreground leading-relaxed">
                  {t('post_24h_note_sub', 'Let neighbors know what activities, hobbies, or quick events you are hosting or looking for today!')}
                </Text>
              </View>
            )}

            {/* Quick Presets */}
            <View className="gap-2">
              <View className="flex-row items-center gap-1.5">
                <Sparkles size={14} className="text-primary" />
                <Text className="text-xs font-bold text-foreground">
                  {myActiveNote ? t('replace_note_idea_header', 'Replace Note with Idea') : t('quick_idea_presets_header', 'Quick Idea Presets')}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="pe-4 gap-2" className="flex-row">
                {localizedPresetOptions.map((preset) => (
                  <TouchableOpacity
                    key={preset.id}
                    onPress={() => onSelectPreset(preset.id, preset.defaultText)}
                    className="bg-card border border-border rounded-xl px-3.5 py-2 flex-row items-center gap-1.5 active:bg-primary/10"
                  >
                    <Text className="text-base">{preset.emoji}</Text>
                    <Text className="text-xs font-semibold text-foreground">{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Custom Input */}
            <View className="gap-1.5">
              <Input
                value={noteText}
                onChangeText={setNoteText}
                placeholder={t('custom_note_placeholder', 'Type your 24-hour note (max 80 chars)...')}
                multiline
                numberOfLines={3}
                className="min-h-[100px] bg-card border-border text-foreground text-sm p-3.5 rounded-2xl"
              />
              <View className="flex-row justify-end px-1">
                <Text className={`text-xs font-semibold ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {charCount} / 80
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View className="flex-row gap-2.5 pt-2">
              {myActiveNote ? (
                <Button
                  variant="outline"
                  size="lg"
                  onPress={handleDeleteNote}
                  disabled={loading}
                  leftIcon={Trash2}
                  className="flex-1 rounded-xl border-rose-500/30 bg-rose-500/10 h-11"
                  textClassName="text-xs font-bold text-rose-500"
                >
                  {t('delete_note_btn', 'Delete Note')}
                </Button>
              ) : null}

              <Button
                variant="default"
                size="lg"
                onPress={handlePublishNote}
                disabled={loading || charCount === 0 || isOverLimit}
                loading={loading}
                leftIcon={Send}
                className="flex-1 rounded-xl h-11"
                textClassName="text-xs font-bold"
              >
                {myActiveNote ? t('update_note_btn', 'Update Note') : t('publish_note_24h_btn', 'Publish Note (24h)')}
              </Button>
            </View>
          </ScrollView>
        ) : (
          /* All Notes Feed */
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="gap-3.5 pb-12">
            {activeNotes.length > 0 ? (
              activeNotes.map((note) => {
                const authorName = note.userName || t('logged_in_resident', 'Community Resident');
                const authorUnit = note.userUnit || t('active_resident', 'Villa Resident');
                const initial = authorName.charAt(0).toUpperCase();
                const rawRole = note.role || 'RESIDENT';
                const roleLabel = tRole(rawRole, rawRole.toUpperCase());
                const roleVariant: StatusVariant = String(rawRole).toUpperCase().includes('GUARD')
                  ? 'warning'
                  : String(rawRole).toUpperCase().includes('STAFF')
                  ? 'info'
                  : 'success';

                const phoneNum = note.phone || note.memberData?.phone;
                const intercomNum = note.intercomNumber || note.memberData?.intercomNumber;

                const targetUserId = typeof note.userId === 'string' ? note.userId : (note.userId as any)?._id || note.authorId || null;

                const targetMember = note.memberData || { id: targetUserId, userId: targetUserId, name: authorName, unitNumber: authorUnit, role: String(rawRole).toLowerCase(), phone: phoneNum, intercomNumber: intercomNum }; const isMyOwnNote = targetUserId && String(targetUserId) === String(currentUserId); return (
                  <View key={note._id || note.id} className="bg-card border border-border/80 rounded-2xl p-4 gap-3 shadow-xs">
                    {/* Header Row: Avatar + Author Info + Expiry */}
                    <View className="flex-row items-start justify-between">
                      <View className="flex-row items-center gap-3 flex-1 me-2">
                        {/* Avatar initials */}
                        <View className="w-10 h-10 rounded-full bg-primary/12 border border-primary/20 items-center justify-center shrink-0">
                          <Text className="text-sm font-bold text-primary">{initial}</Text>
                        </View>
                        {/* Name + Badge + Unit */}
                        <View className="flex-1 justify-center">
                          <View className="flex-row items-center gap-2 flex-wrap">
                            <Text className="text-sm font-bold text-foreground tracking-tight">{authorName}</Text>
                            <StatusBadge label={roleLabel} variant={roleVariant} size="sm" />
                          </View>
                          <Text className="text-xs text-muted-foreground font-medium mt-0.5" numberOfLines={1}>
                            {authorUnit}{phoneNum ? ` • 📞 ${phoneNum}` : ''}
                          </Text>
                        </View>
                      </View>

                      {/* Expiry Pill */}
                      <View className="bg-secondary/80 border border-border/50 px-2 py-1 rounded-lg shrink-0 mt-0.5">
                        <Text className="text-[11px] font-semibold text-muted-foreground">
                          {formatExpirationCountdown(note.expiresAt)}
                        </Text>
                      </View>
                    </View>

                    {/* Note Content Bubble */}
                    <View className="bg-secondary/40 rounded-xl p-3.5 border border-border/40">
                      <Text className="text-sm font-medium text-foreground leading-relaxed">
                        {note.emoji ? `${note.emoji} ` : ''}{note.text}
                      </Text>
                    </View>

                    {/* Action Row */}
                    {!isMyOwnNote && (
                      <View className="flex-row items-center gap-2 pt-2 border-t border-border/30 w-full mt-0.5">
                        <Button
                          variant="default"
                          size="sm"
                          onPress={() => handleInterested(targetMember)}
                          leftIcon={ThumbsUp}
                          className="flex-1 h-9.5 rounded-xl bg-primary border border-primary"
                          textClassName="text-xs font-bold text-primary-foreground"
                        >
                          {t('btn_interested', 'Interested')}
                        </Button>

                        {phoneNum ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onPress={() => Linking.openURL(`tel:${phoneNum}`)}
                            leftIcon={Phone}
                            className="flex-1 h-9.5 rounded-xl border-border bg-muted/30 px-3.5"
                            textClassName="text-xs font-semibold text-foreground"
                          >
                            {t('btn_call', 'Call')}
                          </Button>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View className="items-center justify-center py-16 px-4 gap-2">
                <Sparkles size={32} className="text-primary/60 mb-1" />
                <Text className="text-base font-bold text-foreground text-center">
                  {t('no_active_notes_title', 'No active community notes')}
                </Text>
                <Text className="text-xs text-muted-foreground text-center max-w-[260px]">
                  {t('no_active_notes_sub', "Be the first to share what's happening in your community today.")}
                </Text>
                <Button
                  variant="default"
                  size="default"
                  onPress={() => setCurrentTab('compose')}
                  leftIcon={Sparkles}
                  className="rounded-xl mt-3 px-5 h-10"
                  textClassName="text-xs font-bold"
                >
                  {t('publish_first_note_btn', 'Publish First Note')}
                </Button>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Messaging Sheet */}
      <DirectoryQuickMessageSheet
        visible={quickSheetOpen}
        onClose={() => setQuickSheetOpen(false)}
        member={selectedMemberForMsg}
      />
    </ScreenShell>
  );
}

export default AllNotesScreen;







