import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AdminVillaFilterSheet } from '../admin/AdminVillaFilterSheet';
import { ShieldAlert, Building2 } from 'lucide-react-native';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { validatePhone } from '@/src/utils/validation';

export interface GuardInitiateWalkInModalProps {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: {
    visitorName: string;
    phone: string;
    villaId?: string;
    villaName?: string;
    residentId?: string;
    residentName?: string;
    idProofNumber?: string;
    vehicleNumber?: string;
  }) => Promise<void>;
}

export const GuardInitiateWalkInModal: React.FC<GuardInitiateWalkInModalProps> = ({
  visible,
  loading = false,
  onClose,
  onSubmit,
}) => {
  const [visitorName, setVisitorName] = useState('');
  const [phone, setPhone] = useState('');
  const [idProofNumber, setIdProofNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [villaId, setVillaId] = useState<string | undefined>(undefined);
  const [villaName, setVillaName] = useState<string>('Select Target Villa & Resident *');
  const [residentId, setResidentId] = useState<string | undefined>(undefined);
  const [residentName, setResidentName] = useState<string | undefined>(undefined);
  const [villaSheetOpen, setVillaSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!visitorName.trim()) {
      setError('Please enter visitor name');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter visitor phone number');
      return;
    }
    if (!validatePhone(phone).isValid) {
      setError('Enter a valid phone number for the selected country.');
      return;
    }
    if (!villaId && !residentId) {
      setError('Please select target villa and resident host');
      return;
    }

    setError(null);
    try {
      await onSubmit({
        visitorName,
        phone,
        villaId,
        villaName,
        residentId,
        residentName,
        idProofNumber,
        vehicleNumber,
      });
      setVisitorName('');
      setPhone('');
      setIdProofNumber('');
      setVehicleNumber('');
      setVillaId(undefined);
      setVillaName('Select Target Villa & Resident *');
      setResidentId(undefined);
      setResidentName(undefined);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate walk-in request');
    }
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title="Initiate Gate Walk-In"
      >
        <View className="gap-3.5 pb-4">
          {error && (
            <View className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex-row items-center gap-2">
              <ShieldAlert size={16} className="text-destructive shrink-0" />
              <Text className="text-xs font-semibold text-destructive flex-1">{error}</Text>
            </View>
          )}

          {/* Target Villa & Resident Selection */}
          <View>
            <Text className="text-xs font-semibold text-muted-foreground mb-1">Target Resident Host & Villa *</Text>
            <TouchableOpacity
              onPress={() => setVillaSheetOpen(true)}
              className="bg-card border border-border rounded-xl p-3 flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-2 flex-1 me-2">
                <Building2 size={16} className="text-primary" />
                <View className="flex-1">
                  <Text className={`text-sm font-semibold ${villaId ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {residentName ? residentName : villaName}
                  </Text>
                  {residentName && (
                    <Text className="text-[11px] text-primary font-medium">
                      Host User selected for gate push notification
                    </Text>
                  )}
                </View>
              </View>
              <Text className="text-xs font-bold text-primary">Choose Host</Text>
            </TouchableOpacity>
          </View>

          {/* Visitor Name */}
          <TextInput
            label="Visitor Full Name"
            required
            value={visitorName}
            onChangeText={setVisitorName}
            placeholder="e.g. Rahul Sharma"
          />

          {/* Visitor Phone */}
          <PhoneInput
            label="Phone Number"
            required
            value={phone}
            onChangeText={setPhone}
            testID="guard-walkin-phone"
          />

          {/* Vehicle Number */}
          <TextInput
            label="Vehicle Plate Number (Optional)"
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            placeholder="e.g. KA 01 AB 1234"
            autoCapitalize="characters"
            inputClassName="font-mono text-sm"
          />

          {/* ID Proof Number */}
          <TextInput
            label="Govt ID / Aadhaar Number (Optional)"
            value={idProofNumber}
            onChangeText={setIdProofNumber}
            placeholder="e.g. XXXX XXXX 1234"
          />

          {/* Action Buttons */}
          <View className="flex-row gap-2 pt-2 border-t border-border">
            <Button variant="outline" className="flex-1 h-11 rounded-xl" onPress={onClose} disabled={loading}>
              <Text className="text-xs font-semibold text-foreground">Cancel</Text>
            </Button>
            <Button
              variant="default"
              className="flex-1 h-11 rounded-xl"
              onPress={handleSubmit}
              disabled={loading}
              loading={loading}
            >
              <Text className="text-xs font-bold text-primary-foreground">Send Resident Request</Text>
            </Button>
          </View>
        </View>
      </BottomSheet>

      <AdminVillaFilterSheet
        visible={villaSheetOpen}
        selectedVillaId={villaId}
        selectedResidentId={residentId}
        onClose={() => setVillaSheetOpen(false)}
        onSelectVilla={(vId, vName, rId, rName) => {
          setVillaId(vId);
          setVillaName(vName || 'Select Target Villa *');
          setResidentId(rId);
          setResidentName(rName);
        }}
      />
    </>
  );
};

export default GuardInitiateWalkInModal;
