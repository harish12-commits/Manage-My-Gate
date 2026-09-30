import { useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { formatPhoneDisplay, parsePhone } from '../utils/phone';

export interface ContactPhoneOption {
  /** E.164 when parseable, otherwise the digits as saved. */
  phone: string;
  display: string;
  label?: string;
}

export interface PickedContact {
  name: string;
  email?: string;
  phones: ContactPhoneOption[];
}

/** The native contact picker exists only on iOS/Android builds. */
export const isContactPickerSupported = Platform.OS === 'ios' || Platform.OS === 'android';

// Lazy require: expo-contacts has no web implementation and is mocked away in unit tests.
const loadContacts = () => require('expo-contacts') as typeof import('expo-contacts');

/**
 * Opens the system contact picker for one contact. Only the chosen contact is
 * read — the address book is never listed or uploaded. iOS needs no permission;
 * Android needs READ_CONTACTS, requested on first use.
 */
export const useContactPicker = () => {
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const Contacts = loadContacts();
    const current = await Contacts.getPermissionsAsync();
    if (current.granted) return true;
    const requested = current.canAskAgain ? await Contacts.requestPermissionsAsync() : current;
    if (requested.granted) return true;
    Alert.alert(
      'Contacts access needed',
      'Allow contacts access to pick a person from your phone. You can still type the details manually.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }, []);

  const pickContact = useCallback(async (): Promise<PickedContact | null> => {
    if (!isContactPickerSupported) return null;
    try {
      if (!(await ensurePermission())) return null;
      const Contacts = loadContacts();
      const contact = await Contacts.Contact.presentPicker();
      if (!contact) return null;

      const [fullName, contactPhones, contactEmails] = await Promise.all([
        contact.getFullName(),
        contact.getPhones(),
        contact.getEmails(),
      ]);

      const seen = new Set<string>();
      const phones: ContactPhoneOption[] = [];
      for (const pn of contactPhones || []) {
        const raw = pn.number || '';
        if (!raw.trim()) continue;
        const parsed = parsePhone(raw);
        const phone = parsed.e164 || raw.replace(/[^\d+]/g, '');
        if (seen.has(phone)) continue;
        seen.add(phone);
        phones.push({ phone, display: parsed.e164 ? formatPhoneDisplay(parsed.e164) : raw, label: pn.label });
      }

      return {
        name: fullName?.trim() || '',
        email: contactEmails?.[0]?.address,
        phones,
      };
    } catch (err) {
      Alert.alert('Could not open contacts', 'Please type the details manually.');
      return null;
    }
  }, [ensurePermission]);

  return { pickContact, isSupported: isContactPickerSupported };
};
