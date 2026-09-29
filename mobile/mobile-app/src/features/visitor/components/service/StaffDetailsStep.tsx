import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { User, Phone, Tag, ShieldCheck, Check, CreditCard } from 'lucide-react-native';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { ContactPickerButton } from '@/components/forms/ContactPickerButton';

export interface StaffDetailsData {
  staffName: string;
  phone: string;
  notes?: string;
  isIdProofPass?: boolean;
  idProofType?: string;
  idProofNumber?: string;
}

export interface StaffDetailsStepProps {
  data: StaffDetailsData;
  onChange: (data: StaffDetailsData) => void;
  error?: string;
}

const ID_PROOF_TYPES = [
  'Aadhaar Card',
  'PAN Card',
  'Driving License',
  'Voter ID',
  'Indian Passport',
];

export const validateIdProofNumber = (type: string, number: string): string | null => {
  if (!number || !number.trim()) return 'ID Proof number is required.';
  const clean = number.trim();
  switch (type) {
    case 'Aadhaar Card':
      if (!/^\d{12}$/.test(clean)) return 'Aadhaar number must be 12 numeric digits.';
      break;
    case 'PAN Card':
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(clean)) return 'Invalid PAN Card format (e.g. ABCDE1234F).';
      break;
    case 'Driving License':
      if (clean.length < 10) return 'Invalid Driving License number.';
      break;
    case 'Voter ID':
      if (!/^[A-Z]{3}\d{7}$/i.test(clean)) return 'Invalid Voter ID format (e.g. XYZ1234567).';
      break;
    case 'Indian Passport':
      if (!/^[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]$/.test(clean)) return 'Invalid Passport format.';
      break;
    default:
      break;
  }
  return null;
};

export const StaffDetailsStep: React.FC<StaffDetailsStepProps> = ({
  data,
  onChange,
  error,
}) => {
  const isIdProofPass = !!data.isIdProofPass;
  const currentIdType = data.idProofType || 'Aadhaar Card';

  const idValidationError = isIdProofPass && data.idProofNumber
    ? validateIdProofNumber(currentIdType, data.idProofNumber)
    : undefined;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 gap-4"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View className="gap-1">
        <Text variant="large" className="font-bold text-foreground">
          Staff / Worker Details
        </Text>
        <Text variant="muted" className="text-xs">
          Enter personal identification details of daily household staff or technician.
        </Text>
      </View>

      <View className="bg-card border border-border rounded-2xl p-4 gap-4">
        <Input
          label="Staff / Worker Name"
          placeholder="e.g. Sunita Devi, Ramesh Plumber"
          leftIcon={<User size={18} className="text-muted-foreground" />}
          value={data.staffName}
          onChangeText={(val) => onChange({ ...data, staffName: val })}
          error={error}
        />

        <PhoneInput
          label="Staff Contact Phone Number"
          value={data.phone}
          onChangeText={(val) => onChange({ ...data, phone: val })}
          testID="staff-phone"
          rightElement={
            <ContactPickerButton
              onPick={(c) => onChange({ ...data, staffName: c.name || data.staffName, phone: c.phone || data.phone })}
            />
          }
        />

        <Input
          label="Additional Work Note (Optional)"
          placeholder="e.g. Morning maid for Villa #402"
          leftIcon={<Tag size={18} className="text-muted-foreground" />}
          value={data.notes || ''}
          onChangeText={(val) => onChange({ ...data, notes: val })}
        />
      </View>

      {/* Invite by ID Proof Card Toggle */}
      <TouchableOpacity
        onPress={() => onChange({ ...data, isIdProofPass: !isIdProofPass })}
        activeOpacity={0.8}
        className={`p-4 rounded-2xl border flex-row items-center justify-between ${
          isIdProofPass ? 'bg-primary/10 border-primary' : 'bg-card border-border'
        }`}
      >
        <View className="flex-row items-center gap-3 flex-1 pe-2">
          <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
            <ShieldCheck size={20} className="text-primary" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-foreground">Invite by ID Proof Pass</Text>
            <Text variant="muted" className="text-xs">
              Visitor presents government ID at gate barrier instead of QR code.
            </Text>
          </View>
        </View>

        <View
          className={`w-5 h-5 rounded-full border items-center justify-center ${
            isIdProofPass ? 'border-primary bg-primary' : 'border-muted-foreground/40'
          }`}
        >
          {isIdProofPass ? <Check size={12} color="#fff" /> : null}
        </View>
      </TouchableOpacity>

      {isIdProofPass && (
        <View className="bg-card border border-primary/30 rounded-2xl p-4 gap-3">
          <Text className="text-xs font-bold text-primary">Select Government ID Proof Type</Text>
          <View className="flex-row flex-wrap gap-2">
            {ID_PROOF_TYPES.map((type) => {
              const isSelected = currentIdType === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => onChange({ ...data, idProofType: type })}
                  activeOpacity={0.7}
                  className={`px-3 py-2 rounded-xl border ${
                    isSelected ? 'bg-primary border-primary' : 'bg-background border-border'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Input
            label={`${currentIdType} Number`}
            placeholder={
              currentIdType === 'Aadhaar Card'
                ? 'e.g. 123456789012'
                : currentIdType === 'PAN Card'
                ? 'e.g. ABCDE1234F'
                : 'e.g. XYZ1234567'
            }
            leftIcon={<CreditCard size={18} className="text-muted-foreground" />}
            value={data.idProofNumber || ''}
            onChangeText={(val) => onChange({ ...data, idProofNumber: val })}
            error={idValidationError || undefined}
          />
        </View>
      )}
    </ScrollView>
  );
};
