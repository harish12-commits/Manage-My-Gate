import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/forms/TextInput';
import { IntegrationConnection } from '../services/integrationHubApi';

interface EditConnectionModalProps {
  visible: boolean;
  onClose: () => void;
  connection: IntegrationConnection | null;
  onSubmit: (id: string, newLabel: string) => Promise<boolean>;
  isSubmitting: boolean;
  error?: string | null;
}

export const EditConnectionModal: React.FC<EditConnectionModalProps> = ({
  visible,
  onClose,
  connection,
  onSubmit,
  isSubmitting,
  error,
}) => {
  const [accountLabel, setAccountLabel] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (connection) {
      setAccountLabel(connection.accountLabel || '');
      setValidationError(null);
    }
  }, [connection, visible]);

  const handleSubmit = async () => {
    setValidationError(null);
    if (!connection) return;
    if (!accountLabel.trim()) {
      setValidationError('Account label is required');
      return;
    }

    const success = await onSubmit(connection.id, accountLabel.trim());
    if (success) {
      onClose();
    }
  };

  if (!visible || !connection) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Edit Connection Label">
      <ScrollView className="max-h-[350px]" showsVerticalScrollIndicator={false}>
        <View className="gap-3.5 pb-6">
          {(error || validationError) && (
            <View className="bg-destructive/10 p-3 rounded-xl border border-destructive/20 mb-1">
              <Text className="text-xs text-destructive font-medium text-start">
                ⚠️ {error || validationError}
              </Text>
            </View>
          )}

          <View className="bg-muted/40 p-3 rounded-xl border border-border">
            <Text className="text-xs font-bold text-foreground">
              Provider: {connection.provider.toUpperCase()}
            </Text>
            <Text className="text-[11px] text-muted-foreground mt-0.5">
              Update the display name / label for this integration credential set.
            </Text>
          </View>

          <TextInput
            label="Account Label / Identifier *"
            placeholder="e.g. Production Twilio US"
            value={accountLabel}
            onChangeText={setAccountLabel}
          />

          <View className="flex-row gap-3 pt-4 mt-2 border-t border-border/60">
            <Button variant="outline" onPress={onClose} className="flex-1 rounded-xl">
              <Text className="text-xs font-semibold text-foreground">Cancel</Text>
            </Button>
            <Button
              variant="default"
              onPress={handleSubmit}
              disabled={isSubmitting || !accountLabel.trim()}
              className="flex-1 rounded-xl"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-xs font-semibold text-primary-foreground">Save Changes</Text>
              )}
            </Button>
          </View>
        </View>
      </ScrollView>
    </BottomSheet>
  );
};

export default EditConnectionModal;
