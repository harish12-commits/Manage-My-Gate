import React from 'react';
import { View, ScrollView } from 'react-native';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { User, Phone, Tag } from 'lucide-react-native';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { ContactPickerButton } from '@/components/forms/ContactPickerButton';

export interface GuestDetailsData {
  visitorName: string;
  phone: string;
  purpose: string;
}

export interface GuestDetailsStepProps {
  data: GuestDetailsData;
  onChange: (data: GuestDetailsData) => void;
  errors?: Partial<Record<keyof GuestDetailsData, string>>;
}

export const GuestDetailsStep: React.FC<GuestDetailsStepProps> = ({
  data,
  onChange,
  errors = {},
}) => {
  const updateField = (field: keyof GuestDetailsData, value: string) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 gap-4"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View className="gap-1">
        <Text variant="large" className="font-bold text-foreground">
          Guest Information
        </Text>
        <Text variant="muted" className="text-xs">
          Enter primary guest details for gate security pre-approval.
        </Text>
      </View>

      <View className="bg-card border border-border rounded-2xl p-4 gap-4">
        {/* Full Name */}
        <Input
          label="Visitor Full Name"
          placeholder="e.g. Ramesh Chandra"
          leftIcon={<User size={18} className="text-muted-foreground" />}
          value={data.visitorName}
          onChangeText={(val) => updateField('visitorName', val)}
          error={errors.visitorName}
        />

        {/* Phone Number */}
        <PhoneInput
          label="Phone Number (Optional)"
          value={data.phone}
          onChangeText={(val) => updateField('phone', val)}
          error={errors.phone}
          testID="guest-phone"
          rightElement={
            <ContactPickerButton
              onPick={(c) => onChange({ ...data, visitorName: c.name || data.visitorName, phone: c.phone || data.phone })}
            />
          }
        />

        {/* Purpose / Note */}
        <Input
          label="Purpose of Visit (Optional)"
          placeholder="e.g. Family dinner, Personal meeting"
          leftIcon={<Tag size={18} className="text-muted-foreground" />}
          value={data.purpose}
          onChangeText={(val) => updateField('purpose', val)}
          error={errors.purpose}
        />
      </View>
    </ScrollView>
  );
};
