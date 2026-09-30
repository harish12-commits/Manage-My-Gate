import React from 'react';
import { Platform } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockPicker = jest.fn();
const mockGetPerms = jest.fn();
const mockRequestPerms = jest.fn();
jest.mock('expo-contacts', () => ({
  Contact: { presentPicker: () => mockPicker() },
  getPermissionsAsync: () => mockGetPerms(),
  requestPermissionsAsync: () => mockRequestPerms(),
}));

import { ContactPickerButton } from '../../../components/forms/ContactPickerButton';

/** Shape returned by Contact.presentPicker(): details are read through async getters. */
const pickedContact = (c: { name: string; phoneNumbers: any[]; emails?: any[] }) => ({
  getFullName: async () => c.name,
  getPhones: async () => c.phoneNumbers,
  getEmails: async () => c.emails ?? [],
});

describe('ContactPickerButton', () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
    mockGetPerms.mockResolvedValue({ granted: true, canAskAgain: true });
  });
  afterAll(() => Object.defineProperty(Platform, 'OS', { get: () => originalOS, configurable: true }));

  it('fills name and an E.164 phone from a single-number contact', async () => {
    mockPicker.mockResolvedValue({
      getFullName: async () => 'Aisha Khan',
      getPhones: async () => [{ number: '+971 50 123 4567', label: 'mobile' }],
      getEmails: async () => [{ address: 'aisha@example.com' }],
    });
    const onPick = jest.fn();
    await render(<ContactPickerButton onPick={onPick} />);
    fireEvent.press(screen.getByTestId('contact-picker-button'));
    await waitFor(() =>
      expect(onPick).toHaveBeenCalledWith({ name: 'Aisha Khan', phone: '+971501234567', email: 'aisha@example.com' })
    );
  });

  it('reads bare local numbers using the contact country code', async () => {
    mockPicker.mockResolvedValue({
      getFullName: async () => 'Ravi',
      getPhones: async () => [{ number: '+91 98765 43210' }],
      getEmails: async () => [],
    });
    const onPick = jest.fn();
    await render(<ContactPickerButton onPick={onPick} />);
    fireEvent.press(screen.getByTestId('contact-picker-button'));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ phone: '+919876543210' })));
  });

  it('asks which number to use when the contact has several', async () => {
    mockPicker.mockResolvedValue({
      getFullName: async () => 'Sam',
      getPhones: async () => [
        { number: '+44 7400 123456', label: 'mobile' },
        { number: '+1 415 555 2671', label: 'work' },
      ],
      getEmails: async () => [],
    });
    const onPick = jest.fn();
    await render(<ContactPickerButton onPick={onPick} />);
    fireEvent.press(screen.getByTestId('contact-picker-button'));
    fireEvent.press(await screen.findByText('+1 415 555 2671'));
    expect(onPick).toHaveBeenCalledWith({ name: 'Sam', phone: '+14155552671', email: undefined });
  });

  it('does nothing when Android permission is denied', async () => {
    mockGetPerms.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPerms.mockResolvedValue({ granted: false, canAskAgain: false });
    const onPick = jest.fn();
    await render(<ContactPickerButton onPick={onPick} />);
    fireEvent.press(screen.getByTestId('contact-picker-button'));
    await waitFor(() => expect(mockRequestPerms).toHaveBeenCalled());
    expect(mockPicker).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });
});
