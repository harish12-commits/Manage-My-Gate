import React, { useRef, useState } from 'react';
import { View, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import { Button } from '@/components/ui/button';
import { ShieldAlert, X } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { ContactPickerButton } from '@/components/forms/ContactPickerButton';
import { validatePhone } from '@/src/utils/validation';

interface AdminBlacklistModalProps {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: { visitorName: string; phone?: string; idProofNumber?: string; reason: string }) => Promise<void>;
}

export const AdminBlacklistModal: React.FC<AdminBlacklistModalProps> = ({
  visible,
  loading = false,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const [visitorName, setVisitorName] = useState('');
  const [phone, setPhone] = useState('');
  const [idProofNumber, setIdProofNumber] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const formScrollRef = useRef<ScrollView>(null);

  // Keep the active field above the keyboard while the action bar remains
  // reachable. This is especially important for the lower ID and reason fields.
  const revealFocusedField = () => {
    requestAnimationFrame(() => {
      setTimeout(() => formScrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
  };

  const handleSubmit = async () => {
    if (!visitorName.trim()) {
      setError(t('please_enter_visitor_full_name', 'Please enter visitor full name'));
      return;
    }
    if (!reason.trim()) {
      setError(t('please_specify_reason_for_blacklisting', 'Please specify reason for blacklisting'));
      return;
    }
    
    if (phone && phone.trim() && !validatePhone(phone).isValid) {
      setError(t('enter_valid_phone_number', 'Enter a valid phone number for the selected country.'));
      return;
    }

    setError(null);
    try {
      await onSubmit({ visitorName, phone, idProofNumber, reason });
      setVisitorName('');
      setPhone('');
      setIdProofNumber('');
      setReason('');
      onClose();
    } catch (err: any) {
      setError(err?.message || t('failed_to_blacklist_visitor', 'Failed to blacklist visitor'));
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-4">
          <Pressable className="absolute inset-0" onPress={onClose} />
          <View
            style={{ maxHeight: '90%' }}
            className="bg-background w-full rounded-2xl p-4 gap-3 border border-border shadow-lg max-w-md flex-shrink"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-border pb-3">
              <View className="flex-row items-center gap-2">
                <ShieldAlert size={20} className="text-destructive" />
                <Text className="text-base font-bold text-foreground">{t('blacklist_visitor', 'Blacklist Visitor')}</Text>
              </View>
              <TouchableOpacity onPress={onClose} className="p-1 rounded-full bg-muted">
                <X size={16} className="text-muted-foreground" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={formScrollRef}
              style={{ maxHeight: Math.max(300, Math.min(480, windowHeight * 0.56)) }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              {error && (
                <View className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-xl mb-2">
                  <Text className="text-xs text-destructive font-medium">{error}</Text>
                </View>
              )}

              {/* Form */}
              <View className="gap-2.5">
                <TextInput
                  label={t('visitor_name', 'Visitor Name')}
                  required
                  value={visitorName}
                  onChangeText={setVisitorName}
                  onFocus={revealFocusedField}
                  placeholder={t('eg_alexander_wright', 'e.g. John Doe')}
                />

                <PhoneInput
                  label={t('phone_number', 'Phone Number')}
                  value={phone}
                  onChangeText={setPhone}
                  onFocus={revealFocusedField}
                  testID="blacklist-phone"
                  rightElement={
                    <ContactPickerButton
                      onPick={(c) => {
                        if (c.name) setVisitorName(c.name);
                        if (c.phone) setPhone(c.phone);
                      }}
                    />
                  }
                />

                <TextInput
                  label={t('national_id_govt_id', 'National ID / Govt ID')}
                  value={idProofNumber}
                  onChangeText={setIdProofNumber}
                  onFocus={revealFocusedField}
                  placeholder={t('eg_aadhaar_dl_number', 'e.g. AADHAAR / DL Number')}
                />

                <TextInput
                  label={t('blacklist_reason', 'Blacklist Reason')}
                  required
                  value={reason}
                  onChangeText={setReason}
                  onFocus={revealFocusedField}
                  placeholder={t('describe_reason_for_restricting_entry', 'Describe reason for restricting entry...')}
                  multiline
                  numberOfLines={3}
                  inputClassName="min-h-[70px]"
                />
              </View>
            </ScrollView>

            {/* Actions */}
            <View className="flex-row gap-2 pt-2 border-t border-border">
              <Button variant="outline" className="flex-1" onPress={onClose} disabled={loading}>
                <Text className="text-xs font-semibold">{t('cancel', 'Cancel')}</Text>
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onPress={handleSubmit}
                disabled={loading}
                loading={loading}
              >
                <Text className="text-xs font-semibold text-destructive-foreground">{t('add_to_blacklist', 'Add to Blacklist')}</Text>
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default AdminBlacklistModal;
