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

import * as Contacts from 'expo-contacts';

/** The native contact picker exists only on iOS/Android builds. */
export const isContactPickerSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Opens the system contact picker for one contact. Only the chosen contact is
 * read — the address book is never listed or uploaded. iOS needs no permission;
 * Android needs READ_CONTACTS, requested on first use.
 */
export const useContactPicker = () => {
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
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
      const contact = await Contacts.Contact.presentPicker();
      if (!contact) {
        // Did not pick a contact, or picking failed silently
        Alert.alert('Contact Picker', 'No contact selected or the contact picker could not be opened on your device.');
        return null;
      }


      // In SDK 52, the Contact class uses async getters for details
      const [rawPhones, rawEmails, fullName] = await Promise.all([
        contact.getPhones(),
        contact.getEmails(),
        contact.getFullName()
      ]);

      const seen = new Set<string>();
      const phones: ContactPhoneOption[] = [];
      for (const pn of rawPhones || []) {
        const raw = pn.number || (pn as any).digits || '';
        if (!raw.trim()) continue;
        const parsed = parsePhone(raw, (pn as any).countryCode?.toUpperCase());
        const phone = parsed.e164 || raw.replace(/[^\d+]/g, '');
        if (seen.has(phone)) continue;
        seen.add(phone);
        phones.push({ phone, display: parsed.e164 ? formatPhoneDisplay(parsed.e164) : raw, label: pn.label });
      }

      if (phones.length === 0) {
        Alert.alert('No Number Found', 'The selected contact does not have a valid phone number.');
        return null;
      }

      const name = fullName?.trim() || '';
      const email = rawEmails?.[0]?.address || (rawEmails?.[0] as any)?.email;
      return { name, email, phones };
    } catch (err: any) {
      Alert.alert('Could not open contacts', err?.message || 'Please type the details manually.');
      return null;
    }
  }, [ensurePermission]);

  return { pickContact, isSupported: isContactPickerSupported };
};
