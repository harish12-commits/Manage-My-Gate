import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { BookUser, Phone } from 'lucide-react-native';
import { useContactPicker, type ContactPhoneOption, type PickedContact } from '../../src/hooks/useContactPicker';

export interface ContactSelection {
  name: string;
  /** E.164 when parseable; '' when the contact has no number. */
  phone: string;
  email?: string;
}

interface ContactPickerButtonProps {
  onPick: (selection: ContactSelection) => void;
  testID?: string;
}

/**
 * Small icon button placed inside a phone field. Opens the system contact
 * picker; when the contact has several numbers the user chooses one.
 * Renders nothing on web.
 */
export const ContactPickerButton: React.FC<ContactPickerButtonProps> = ({ onPick, testID }) => {
  const { pickContact, isSupported } = useContactPicker();
  const [pending, setPending] = useState<PickedContact | null>(null);

  if (!isSupported) return null;

  const finish = (contact: PickedContact, option?: ContactPhoneOption) => {
    setPending(null);
    onPick({ name: contact.name, phone: option?.phone || '', email: contact.email });
  };

  const handlePress = async () => {
    const contact = await pickContact();
    if (!contact) return;
    if (contact.phones.length > 1) setPending(contact);
    else finish(contact, contact.phones[0]);
  };

  return (
    <>
      <View style={{ justifyContent: 'center', alignItems: 'center', zIndex: 10, elevation: 10, marginLeft: 8 }}>
        <TouchableOpacity
          onPress={handlePress}
          className="h-9 w-9 rounded-xl bg-primary/10 items-center justify-center"
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Choose from contacts"
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          testID={testID || 'contact-picker-button'}
        >
          <BookUser size={18} className="text-primary" />
        </TouchableOpacity>
      </View>

      <Modal visible={!!pending} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setPending(null)}>
        <Pressable className="flex-1 bg-black/50 justify-center items-center p-4" onPress={() => setPending(null)}>
          <Pressable className="w-full max-w-sm bg-card border border-border rounded-2xl p-4" onPress={(e) => e.stopPropagation()}>
            <Text className="text-base font-bold text-foreground">{pending?.name || 'Choose a number'}</Text>
            <Text className="text-xs text-muted-foreground mb-3">This contact has more than one number.</Text>
            {pending?.phones.map((option) => (
              <TouchableOpacity
                key={option.phone}
                onPress={() => pending && finish(pending, option)}
                className="flex-row items-center gap-3 p-3 rounded-xl mb-1 active:bg-muted"
              >
                <Phone size={16} className="text-primary" />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{option.display}</Text>
                  {Boolean(option.label) && (
                    <Text className="text-xs text-muted-foreground capitalize">{option.label}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

export default ContactPickerButton;
