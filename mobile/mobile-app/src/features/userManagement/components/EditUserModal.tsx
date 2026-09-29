import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { X, User as UserIcon, Phone, Mail } from 'lucide-react-native';
import { UserData } from '../services/userService';
import { TextInput } from '@/components/forms/TextInput';
import { Button } from '@/components/common/Button';
import { useTranslation } from '@/src/utils/i18n';

interface EditUserModalProps {
  visible: boolean;
  user: UserData | null;
  onClose: () => void;
  onSave: (userId: string, data: { name: string; phone: string }) => Promise<void>;
}

export function EditUserModal({ visible, user, onClose, onSave }: EditUserModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required.');
      return;
    }
    
    setIsSaving(true);
    try {
      const userId = user.id || user._id || '';
      await onSave(userId, { name, phone });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update user profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Modal visible={visible} transparent statusBarTranslucent={true} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-card rounded-t-3xl border-t border-border/50 max-h-[90%] shadow-2xl">
            {/* Header */}
            <View className="flex-row items-center justify-between p-5 border-b border-border/40">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center me-3">
                  <UserIcon size={16} className="text-primary" />
                </View>
                <Text className="text-lg font-extrabold text-foreground tracking-tight">Edit Profile</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-muted/50 items-center justify-center active:bg-muted"
                accessibilityLabel="Close modal"
              >
                <X size={18} className="text-muted-foreground" />
              </TouchableOpacity>
            </View>

            {/* Form Body */}
            <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              
              {/* Readonly Email */}
              <View className="mb-5">
                <Text className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-widest">{t('email_label', 'Email Address')}</Text>
                <View className="flex-row items-center px-4 py-3 bg-muted/30 rounded-xl border border-border/30">
                  <Mail size={16} className="text-muted-foreground me-2" />
                  <Text className="text-[14px] text-muted-foreground font-medium">{user.email}</Text>
                </View>
                <Text className="text-[10px] text-muted-foreground mt-1.5 ms-1">Email cannot be changed.</Text>
              </View>

              {/* Name Input */}
              <View className="mb-5">
                <Text className="text-xs font-bold text-foreground mb-2">{t('name_label', 'Full Name')} <Text className="text-red-500">*</Text></Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t('enter_name', 'Enter full name')}
                  autoCapitalize="words"
                  className="bg-card rounded-xl border border-border/80"
                />
              </View>

              {/* Phone Input */}
              <View className="mb-6">
                <Text className="text-xs font-bold text-foreground mb-2">{t('phone_label', 'Phone Number')}</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={t('enter_phone', 'Enter phone number')}
                  keyboardType="phone-pad"
                  className="bg-card rounded-xl border border-border/80"
                />
              </View>
            </ScrollView>

            {/* Footer */}
            <View className="p-5 border-t border-border/40 bg-muted/10">
              <Button
                variant="default"
                onPress={handleSave}
                isLoading={isSaving}
                className="w-full rounded-2xl py-3.5 shadow-sm"
              >
                {t('save_changes', 'Save Changes')}
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
