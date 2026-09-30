import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge, StatusVariant } from '@/components/ui/StatusBadge';
import { SegmentedControl } from '@/components/common/SegmentedControl';
import { getLocalizedPresetNotes } from '../types/communityNoteTypes';
import { useCommunityNote, formatExpirationCountdown } from '../hooks/useCommunityNote';
import { useDirectoryMessaging } from '../hooks/useDirectoryMessaging';
import { DirectoryQuickMessageSheet } from './DirectoryQuickMessageSheet';
import { useTranslation } from '@/src/utils/i18n';
import { Sparkles, Send, Trash2, ThumbsUp, Phone } from 'lucide-react-native';

export interface DirectoryNoteComposerProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: 'compose' | 'feed';
}

export const DirectoryNoteComposer = ({
  visible,
  onClose,
  initialTab = 'compose',
}: DirectoryNoteComposerProps) => {
  const [currentTab, setCurrentTab] = useState<'compose' | 'feed'>(initialTab);
  const {
    quickSheetOpen,
    setQuickSheetOpen,
    selectedMember,
    onOpenQuickMessage: onInterestedInNote,
  } = useDirectoryMessaging();
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

  useEffect(() => {
    if (visible) {
      setCurrentTab(initialTab);
    }
  }, [visible, initialTab]);

  const charCount = noteText.length;
  const isOverLimit = charCount > 80;
  const localizedPresetOptions = getLocalizedPresetNotes(t);

  const handlePublish = async () => {
    await onPublish();
    onClose();
  };

  const handleDelete = async () => {
    await onDelete();
    onClose();
  };

  return (
    <>
      <BottomSheet
      visible={visible}
      onClose={onClose}
      title={currentTab === 'compose' ? (myActiveNote ? t('manage_active_note', 'Manage Active Note') : t('whats_happening', "What's happening?")) : t('community_notes_feed', 'Community Notes Feed')}
    >
      <View className="px-4 pb-6 gap-4">
        {/* Navigation Segmented Control */}
        <SegmentedControl
          segments={[
            { key: 'compose', label: myActiveNote ? t('my_note_tab', 'My Note') : t('add_note_tab', 'Add Note') },
            { key: 'feed', label: `${t('all_notes_tab', 'All Notes')} (${totalActiveNotesCount || activeNotes.length || 0})` },
          ]}
          activeSegment={currentTab}
          onChange={(tab) => setCurrentTab(tab as any)}
        />

        {currentTab === 'compose' ? (
          <View className="gap-4">
            {/* Active Note Banner inside Composer */}
            {myActiveNote ? (
              <View className="bg-primary/10 border border-primary/20 rounded-2xl p-3 flex-row items-center justify-between">
                <View className="flex-1 pe-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[10px] font-bold text-primary uppercase">
                      {t('active_community_note', 'Active Community Note')}
                    </Text>
                    <Text className="text-[10px] text-muted-foreground font-semibold">
                      {formatExpirationCountdown(myActiveNote.expiresAt)}
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-foreground mt-1" numberOfLines={2}>
                    {myActiveNote.emoji ? `${myActiveNote.emoji} ` : ''}{myActiveNote.text}
                  </Text>
                </View>
                <Button
                  variant="destructive"
                  size="sm"
                  onPress={handleDelete}
                  disabled={loading}
                  leftIcon={Trash2}
                  className="rounded-xl px-3 h-9 bg-rose-500/15 border border-rose-500/30"
                  textClassName="text-xs font-bold text-rose-500"
                >
                  {t('delete_btn', 'Delete')}
                </Button>
              </View>
            ) : (
              <Text className="text-xs text-muted-foreground font-medium">
                {t('post_temporary_note_sub', 'Post a temporary 24-hour note to your community. Let neighbors know what you are up to!')}
              </Text>
            )}

            {/* Quick Ideas Presets */}
            <View className="gap-1.5">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Sparkles size={14} className="text-primary" />
                <Text className="text-xs font-bold text-foreground">
                  {myActiveNote ? t('change_note', 'Change Note') : t('quick_ideas', 'Quick Ideas')}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="pe-4 gap-2" className="flex-row">
                {localizedPresetOptions.map((preset) => (
                  <TouchableOpacity
                    key={preset.id}
                    onPress={() => onSelectPreset(preset.id, preset.defaultText)}
                    className="bg-muted/60 border border-border/50 rounded-xl px-3 py-2 flex-row items-center gap-1.5 active:bg-primary/10"
                  >
                    <Text className="text-sm">{preset.emoji}</Text>
                    <Text className="text-xs font-semibold text-foreground">{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Text Input with Character Counter */}
            <View className="gap-1">
              <Input
                value={noteText}
                onChangeText={setNoteText}
                placeholder={t('custom_note_placeholder', 'Type your note (max 80 chars)...')}
                multiline
                numberOfLines={3}
                className="min-h-[80px] bg-background border-border text-foreground text-sm p-3 rounded-xl"
              />
              <View className="flex-row justify-end px-1">
                <Text
                  className={`text-xs font-semibold ${
                    isOverLimit ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {charCount} / 80
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-2">
              {myActiveNote ? (
                <Button
                  variant="outline"
                  size="lg"
                  onPress={handleDelete}
                  disabled={loading}
                  leftIcon={Trash2}
                  className="flex-1 rounded-xl border-rose-500/30 bg-rose-500/10"
                  textClassName="text-rose-500 font-bold"
                >
                  {t('delete_note', 'Delete Note')}
                </Button>
              ) : null}

              <Button
                variant="default"
                size="lg"
                onPress={handlePublish}
                disabled={loading || charCount === 0 || isOverLimit}
                loading={loading}
                leftIcon={Send}
                className="flex-1 rounded-xl"
              >
                {myActiveNote ? t('update_note', 'Update Note') : t('publish_note_24h', 'Publish Note (24h)')}
              </Button>
            </View>
          </View>
        ) : (
          /* All Community Notes Feed Tab */
          <ScrollView className="max-h-[450px]" showsVerticalScrollIndicator={false}>
            {activeNotes.length > 0 ? (
              <View className="gap-3.5">
                {activeNotes.map((note) => {
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
                  const interests = note.interests || note.memberData?.interests || [];

                  const targetUserId = typeof note.userId === 'string' ? note.userId : note.userId?._id || note._id;

                  const targetMember = note.memberData || {
                    id: targetUserId,
                    userId: targetUserId,
                    name: authorName,
                    unitNumber: authorUnit,
                    role: String(rawRole).toLowerCase(),
                    phone: phoneNum,
                  };

                  return (
                    <View key={note._id || note.id} className="bg-muted/40 border border-border/50 rounded-2xl p-3 gap-2">
                      {/* Top Header Row */}
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2 flex-1 pe-2">
                          <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center">
                            <Text className="text-xs font-bold text-primary">{initial}</Text>
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center gap-1.5 flex-wrap">
                              <Text className="text-xs font-bold text-foreground">{authorName}</Text>
                              <StatusBadge label={roleLabel} variant={roleVariant} size="sm" />
                            </View>
                            <Text className="text-[11px] text-muted-foreground font-medium mt-0.5" numberOfLines={1}>
                              {authorUnit}{phoneNum ? ` • 📞 ${phoneNum}` : ''}
                            </Text>
                          </View>
                        </View>

                        <Text className="text-[10px] text-muted-foreground font-semibold">
                          {formatExpirationCountdown(note.expiresAt)}
                        </Text>
                      </View>

                      {/* Interest Tags */}
                      {interests && interests.length > 0 ? (
                        <View className="flex-row flex-wrap gap-1">
                          {interests.map((interest: string, idx: number) => (
                            <View key={idx} className="bg-muted/60 rounded-md px-1.5 py-0.5 border border-border/30">
                              <Text className="text-[9px] font-semibold text-muted-foreground">{interest}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {/* Note Content Bubble */}
                      <View className="bg-background rounded-xl p-2.5 border border-border/30">
                        <Text className="text-xs font-semibold text-foreground leading-snug">
                          {note.emoji ? `${note.emoji} ` : ''}{note.text}
                        </Text>
                      </View>

                      {/* Compact Action Buttons Row */}
                      <View className="flex-row items-center gap-1.5 pt-0.5 justify-end flex-wrap">
                        <Button
                          variant="default"
                          size="sm"
                          onPress={() => {
                            onInterestedInNote(targetMember as any);
                          }}
                          leftIcon={ThumbsUp}
                          className="h-7.5 rounded-xl bg-primary px-2.5"
                          textClassName="text-[11px] font-bold text-primary-foreground"
                        >
                          {t('btn_interested', 'Interested')}
                        </Button>

                        {phoneNum ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onPress={() => Linking.openURL(`tel:${phoneNum.replace(/[^\d+]/g, '')}`).catch(() => {})}
                            leftIcon={Phone}
                            className="h-7.5 rounded-xl border-border bg-background px-2"
                            textClassName="text-[11px] font-semibold text-foreground"
                          >
                            {t('btn_call', 'Call')}
                          </Button>
                        ) : null}

                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="items-center justify-center py-8 px-4 gap-2">
                <Sparkles size={28} className="text-primary/60 mb-1" />
                <Text className="text-sm font-bold text-foreground text-center">
                  {t('no_active_notes_title', 'No active community notes')}
                </Text>
                <Text className="text-xs text-muted-foreground text-center max-w-[240px]">
                  {t('no_active_notes_sub', "Be the first to share what's happening in your community.")}
                </Text>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setCurrentTab('compose')}
                  leftIcon={Sparkles}
                  className="rounded-xl mt-2 px-4 bg-white border-neutral-300"
                  textClassName="text-black font-bold"
                >
                  {t('add_note_btn', 'Add Note')}
                </Button>
              </View>
            )}
          </ScrollView>
        )}
      </View>
      </BottomSheet>
      <DirectoryQuickMessageSheet
        visible={quickSheetOpen}
        onClose={() => setQuickSheetOpen(false)}
        member={selectedMember}
      />
    </>
  );
};

export default DirectoryNoteComposer;
