import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/forms/TextInput';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { ProviderCatalogItem } from '../services/integrationHubApi';

interface ConnectModalProps {
  visible: boolean;
  catalog: ProviderCatalogItem[];
  selectedCatalogItem: ProviderCatalogItem | null;
  onSelectCatalogItem: (item: ProviderCatalogItem) => void;
  onClose: () => void;
  onSubmit: (payload: {
    provider: string;
    accountLabel: string;
    credentials: Record<string, any>;
  }) => Promise<boolean>;
  isSubmitting: boolean;
  error?: string | null;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  visible,
  catalog,
  selectedCatalogItem,
  onSelectCatalogItem,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}) => {
  const [accountLabel, setAccountLabel] = useState('');
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCatalogItem) {
      setAccountLabel(`${selectedCatalogItem.name} Account`);
      const initialCreds: Record<string, any> = {};
      selectedCatalogItem.fields?.forEach((f) => {
        initialCreds[f.name] = f.default || '';
      });
      setCredentials(initialCreds);
    }
  }, [selectedCatalogItem]);

  const handleFieldChange = (fieldName: string, value: string) => {
    setCredentials((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSubmit = async () => {
    setValidationError(null);
    if (!selectedCatalogItem) {
      setValidationError('Please select a provider');
      return;
    }
    if (!accountLabel.trim()) {
      setValidationError('Account label is required');
      return;
    }

    // Check required fields
    for (const field of selectedCatalogItem.fields || []) {
      if (field.required && !credentials[field.name]?.toString().trim()) {
        setValidationError(`${field.label} is required`);
        return;
      }
    }

    const success = await onSubmit({
      provider: selectedCatalogItem.id,
      accountLabel: accountLabel.trim(),
      credentials,
    });

    if (success) {
      setAccountLabel('');
      setCredentials({});
    }
  };

  if (!visible) return null;

  const providerOptions = catalog.map((item) => ({
    label: `${item.icon || '🔌'} ${item.name}`,
    value: item.id,
  }));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={selectedCatalogItem ? `Connect ${selectedCatalogItem.name}` : 'Connect Integration'}
    >
      <ScrollView className="max-h-[500px]" showsVerticalScrollIndicator={false}>
        <View className="gap-3.5 pb-6">
          {(error || validationError) && (
            <View className="bg-destructive/10 p-3 rounded-xl border border-destructive/20 mb-1">
              <Text className="text-xs text-destructive font-medium text-start">
                ⚠️ {error || validationError}
              </Text>
            </View>
          )}

          {/* Provider Choice */}
          <DropdownSelect
            label="Select Integration Provider *"
            options={providerOptions}
            value={selectedCatalogItem?.id || null}
            onValueChange={(val: string) => {
              const found = catalog.find((c) => c.id === val);
              if (found) onSelectCatalogItem(found);
            }}
            placeholder="Choose provider..."
          />

          {/* Account Label */}
          <TextInput
            label="Account Label / Identification Name *"
            value={accountLabel}
            onChangeText={setAccountLabel}
            placeholder="e.g. Production Twilio Account"
          />

          {/* Dynamic Credential Schema Fields */}
          {selectedCatalogItem && selectedCatalogItem.fields?.length > 0 && (
            <View className="gap-3 pt-2 border-t border-border/40">
              <Text className="text-xs font-bold text-foreground text-start uppercase tracking-wider">
                Provider Credentials Schema
              </Text>
              {selectedCatalogItem.fields.map((field) => (
                <TextInput
                  key={field.name}
                  label={`${field.label}${field.required ? ' *' : ''}`}
                  value={credentials[field.name] || ''}
                  onChangeText={(val: string) => handleFieldChange(field.name, val)}
                  placeholder={field.placeholder || `Enter ${field.label}...`}
                  secureTextEntry={
                    field.name.toLowerCase().includes('secret') ||
                    field.name.toLowerCase().includes('key') ||
                    field.name.toLowerCase().includes('password')
                  }
                />
              ))}
            </View>
          )}

          {/* Submit Action Row matching RoleFormSheetModal */}
          <View className="flex-row gap-3 pt-4 mt-2 border-t border-border/60">
            <Button variant="outline" onPress={onClose} className="flex-1 rounded-xl">
              <Text className="text-xs font-semibold text-foreground">Cancel</Text>
            </Button>
            <Button
              onPress={handleSubmit}
              loading={isSubmitting}
              className="flex-1 rounded-xl bg-emerald-600 active:bg-emerald-700"
            >
              <Text className="text-xs font-bold text-white">Save & Connect</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </BottomSheet>
  );
};

export default ConnectModal;
