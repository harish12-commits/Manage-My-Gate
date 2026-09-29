import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/forms/TextInput';
import { UserPlus, Building, CircleCheck, ShieldAlert } from 'lucide-react-native';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { validatePhone } from '@/src/utils/validation';

export interface AdminWalkInRegistrationCardProps {
  onSubmit: (data: {
    visitorName: string;
    phone: string;
    idProofNumber?: string;
    vehicleNumber?: string;
    villaId?: string;
    villaName?: string;
    residentId?: string;
    residentName?: string;
  }) => Promise<void>;
  loading?: boolean;
  onOpenVillaPicker: () => void;
  selectedVillaId?: string;
  selectedVillaName?: string;
  selectedResidentId?: string;
  selectedResidentName?: string;
  formSuccess?: string | null;
  formError?: string | null;
  className?: string;
}

export const AdminWalkInRegistrationCard: React.FC<AdminWalkInRegistrationCardProps> = ({
  onSubmit,
  loading = false,
  onOpenVillaPicker,
  selectedVillaId,
  selectedVillaName = 'Select Target Villa & Resident *',
  selectedResidentId,
  selectedResidentName,
  formSuccess,
  formError,
  className = '',
}) => {
  const [visitorName, setVisitorName] = useState('');
  const [phone, setPhone] = useState('');
  const [idProofNumber, setIdProofNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!visitorName.trim()) {
      setLocalError('Please enter visitor full name');
      return;
    }
    if (!phone.trim()) {
      setLocalError('Please enter visitor phone number');
      return;
    }
    if (!validatePhone(phone).isValid) {
      setLocalError('Enter a valid phone number for the selected country.');
      return;
    }
    if (!selectedVillaId && !selectedResidentId) {
      setLocalError('Please select target villa and resident host');
      return;
    }

    setLocalError(null);
    try {
      await onSubmit({
        visitorName: visitorName.trim(),
        phone: phone.trim(),
        idProofNumber: idProofNumber.trim(),
        vehicleNumber: vehicleNumber.trim(),
        villaId: selectedVillaId,
        villaName: selectedVillaName,
        residentId: selectedResidentId,
        residentName: selectedResidentName,
      });

      // Clear local fields upon successful submission
      setVisitorName('');
      setPhone('');
      setIdProofNumber('');
      setVehicleNumber('');
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to dispatch walk-in registration');
    }
  };

  const activeError = localError || formError;

  return (
    <View className={`bg-card border border-border rounded-2xl p-4 gap-3.5 ${className}`}>
      {formSuccess && (
        <View className="p-3 bg-status-success/10 border border-status-success/20 rounded-xl flex-row items-center gap-2">
          <CircleCheck size={16} className="text-status-success shrink-0" />
          <Text className="text-xs font-semibold text-status-success flex-1">{formSuccess}</Text>
        </View>
      )}

      {activeError && (
        <View className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex-row items-center gap-2">
          <ShieldAlert size={16} className="text-destructive shrink-0" />
          <Text className="text-xs font-semibold text-destructive flex-1">{activeError}</Text>
        </View>
      )}

      {/* Card Header */}
      <View className="flex-row items-center gap-2 border-b border-border/40 pb-2.5">
        <UserPlus size={18} className="text-primary" />
        <Text className="text-sm font-bold text-foreground">Register Unplanned Walk-In</Text>
      </View>

      {/* Target Villa / Resident Host Picker */}
      <View>
        <Text className="text-xs font-semibold text-muted-foreground mb-1">
          Target Resident Host & Unit *
        </Text>
        <Button
          variant="outline"
          onPress={onOpenVillaPicker}
          className="bg-card border border-border rounded-xl p-3 h-auto justify-between flex-row items-center"
          accessibilityLabel="Select Target Villa and Resident"
        >
          <View className="flex-row items-center gap-2 flex-1 me-2">
            <Building size={16} className="text-primary" />
            <View className="flex-1">
              <Text
                className={`text-sm font-semibold ${
                  selectedVillaId ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {selectedResidentName ? selectedResidentName : selectedVillaName}
              </Text>
              {selectedResidentName && (
                <Text className="text-[11px] text-primary font-medium">
                  Host selected for push notification
                </Text>
              )}
            </View>
          </View>
          <Text className="text-xs font-bold text-primary">Select Unit</Text>
        </Button>
      </View>

      {/* Visitor Full Name */}
      <TextInput
        label="Visitor Full Name"
        required
        value={visitorName}
        onChangeText={setVisitorName}
        placeholder="e.g. Alexander Wright"
      />

      {/* Visitor Phone */}
      <PhoneInput
        label="Phone Number"
        required
        value={phone}
        onChangeText={setPhone}
        testID="admin-walkin-phone"
      />

      {/* Vehicle Number */}
      <TextInput
        label="Vehicle Plate Number (Optional)"
        value={vehicleNumber}
        onChangeText={setVehicleNumber}
        placeholder="e.g. DXB 49201"
        autoCapitalize="characters"
        inputClassName="font-mono text-sm"
      />

      {/* ID Proof Number */}
      <TextInput
        label="Govt ID / Passport Number (Optional)"
        value={idProofNumber}
        onChangeText={setIdProofNumber}
        placeholder="e.g. E12345678"
      />

      {/* Dispatch Action Button */}
      <Button
        variant="default"
        onPress={handleSubmit}
        disabled={loading}
        loading={loading}
        className="mt-2 h-12 rounded-xl"
        accessibilityLabel="Dispatch Resident Push Notification"
      >
        <Text className="text-sm font-bold text-primary-foreground">
          Dispatch Resident Push Notification
        </Text>
      </Button>
    </View>
  );
};

export default AdminWalkInRegistrationCard;
