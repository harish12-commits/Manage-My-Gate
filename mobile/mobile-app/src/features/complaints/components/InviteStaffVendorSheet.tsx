import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { TextInput } from '@/components/forms/TextInput';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck, Phone, Mail, Building2, Send } from 'lucide-react-native';
import { TechnicianData } from '../services/technicianService';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { ContactPickerButton } from '@/components/forms/ContactPickerButton';
import { validatePhone } from '@/src/utils/validation';

interface InviteStaffVendorSheetProps {
  visible: boolean;
  technician: TechnicianData | null;
  onClose: () => void;
  onSave: (data: TechnicianData) => Promise<any>;
}

export const InviteStaffVendorSheet: React.FC<InviteStaffVendorSheetProps> = ({
  visible,
  technician,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Electrical');
  const [type, setType] = useState<'In-House Staff' | 'External Vendor'>('In-House Staff');
  const [status, setStatus] = useState<'Active' | 'Pending' | 'Inactive'>('Active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      if (technician) {
        setName(technician.name || '');
        setPhone(technician.phone || '');
        setEmail(technician.email || '');
        setDepartment(technician.department || 'Electrical');
        setType(technician.type || 'In-House Staff');
        setStatus(technician.status || 'Active');
      } else {
        setName('');
        setPhone('');
        setEmail('');
        setDepartment('Electrical');
        setType('In-House Staff');
        setStatus('Active');
      }
    }
  }, [visible, technician]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter staff/vendor name.');
      return;
    }
    if (!phone.trim() || !validatePhone(phone).isValid) {
      Alert.alert('Validation Error', 'Please enter a valid contact phone number.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Required Field', 'Please enter email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: TechnicianData = {
        _id: technician?._id,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        department,
        type,
        status,
        specialization: department,
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      console.error('Failed to save technician:', err);
      Alert.alert('Save Error', err?.message || 'Failed to save staff/vendor details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={technician ? `Edit ${technician.name}` : 'Invite New Staff or Vendor'}
    >
      <ScrollView className="px-4 py-2" contentContainerStyle={{ paddingBottom: 60 }}>
        <Text className="text-xs text-muted-foreground mb-3">
          {technician
            ? 'Update technician contact info, trade specialization, or active status.'
            : 'Fill details to add or invite a new technician or external agency vendor.'}
        </Text>

        <TextInput
          label="Full Name *"
          placeholder="e.g. Ramesh Kumar"
          value={name}
          onChangeText={setName}
        />

        <PhoneInput
          label="Phone Number *"
          value={phone}
          onChangeText={setPhone}
          testID="invite-staff-phone"
          rightElement={
            <ContactPickerButton
              onPick={(c) => {
                if (c.name) setName(c.name);
                if (c.phone) setPhone(c.phone);
                if (c.email) setEmail(c.email);
              }}
            />
          }
        />

        <TextInput
          label="Email Address *"
          placeholder="e.g. ramesh@maintenance.com"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <DropdownSelect
          label="Department / Trade Specialization"
          value={department}
          options={[
            { label: 'Electrical', value: 'Electrical' },
            { label: 'Plumbing', value: 'Plumbing' },
            { label: 'Housekeeping', value: 'Housekeeping' },
            { label: 'Security', value: 'Security' },
            { label: 'Carpentry', value: 'Carpentry' },
            { label: 'Elevators & Lifts', value: 'Elevators' },
            { label: 'AC & HVAC', value: 'AC & HVAC' },
            { label: 'Others', value: 'Others' },
          ]}
          onValueChange={(val) => setDepartment(val)}
        />

        <DropdownSelect
          label="Staff Category / Type"
          value={type}
          options={[
            { label: 'In-House Staff Member', value: 'In-House Staff' },
            { label: 'External Vendor Agency', value: 'External Vendor' },
          ]}
          onValueChange={(val) => setType(val as any)}
        />

        <DropdownSelect
          label="Account Active Status"
          value={status}
          options={[
            { label: 'Active (Ready for dispatch)', value: 'Active' },
            { label: 'Pending Invitation', value: 'Pending' },
            { label: 'Inactive (On leave / disabled)', value: 'Inactive' },
          ]}
          onValueChange={(val) => setStatus(val as any)}
        />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={{
            backgroundColor: '#2563eb', // solid bright blue
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 16,
          }}
        >
          <Icon as={Send} size={16} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>
            {isSubmitting ? 'Saving...' : technician ? 'Save Changes' : 'Send Invitation & Save'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheet>
  );
};

export default InviteStaffVendorSheet;
