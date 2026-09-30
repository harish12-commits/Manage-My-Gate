import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DirectoryMember } from '../types/directoryTypes';
import { getLocalizedQuickMessages } from '../types/messagingTypes';
import { useDirectoryMessaging } from '../hooks/useDirectoryMessaging';
import { useTranslation } from '@/src/utils/i18n';
import { Send, MessageSquare } from 'lucide-react-native';

export interface DirectoryQuickMessageSheetProps {
  visible: boolean;
  onClose: () => void;
  member: DirectoryMember | null;
}

export const DirectoryQuickMessageSheet = ({
  visible,
  onClose,
  member,
}: DirectoryQuickMessageSheetProps) => {
  const { onSendQuickMessage, sending } = useDirectoryMessaging();
  const [customMessage, setCustomMessage] = useState('');
  const { t } = useTranslation();
  
  if (!member) return null;

  // Compute quick options using the provided member
  const computeQuickOptions = () => {
    const localized = getLocalizedQuickMessages(t);
    if (member.role === 'guard' || member.role === 'security') {
      return [...localized.guard, ...localized.default];
    }
    return localized.default;
  };
  const quickOptions = computeQuickOptions();

  const handleSendQuickOption = async (text: string) => {
    await onSendQuickMessage(text, member);
    onClose();
  };

  const handleSendCustom = async () => {
    if (!customMessage.trim()) return;
    await onSendQuickMessage(customMessage.trim(), member);
    setCustomMessage('');
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`${t('message_user', 'Message')} ${member.name}`}
    >
      <View className="px-4 pb-6 gap-4">
        {/* Quick Messages Preset Pills */}
        <View className="gap-1.5">
          <Text className="text-xs font-bold text-foreground">{t('quick_options', 'Quick Options')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {quickOptions.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                onPress={() => handleSendQuickOption(opt.text)}
                disabled={sending}
                className="bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 active:bg-primary/20"
              >
                <Text className="text-xs font-semibold text-primary">{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Input */}
        <View className="gap-2">
          <Input
            value={customMessage}
            onChangeText={setCustomMessage}
            placeholder={t('type_message', 'Type a message...')}
            className="bg-background border-border text-foreground text-sm p-3 rounded-xl"
          />
          <Button
            variant="default"
            size="default"
            onPress={handleSendCustom}
            disabled={sending || !customMessage.trim()}
            loading={sending}
            leftIcon={Send}
            className="w-full rounded-xl"
          >
            {t('send_message', 'Send Message')}
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
};

export default DirectoryQuickMessageSheet;
