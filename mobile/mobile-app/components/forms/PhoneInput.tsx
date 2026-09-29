import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChevronDown, Check, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { cn } from '../../lib/utils';
import {
  examplePhone,
  getDefaultPhoneCountry,
  getPhoneCountries,
  getPhoneCountry,
  maxNationalDigits,
  parsePhone,
  phoneLengthStatus,
  type PhoneCountry,
} from '../../src/utils/phone';

export interface PhoneInputProps {
  label?: string;
  required?: boolean;
  /** E.164 (+971501234567) or a bare national number. */
  value?: string;
  /** Emits E.164 when parseable, `+<dial><digits>` while typing, '' when empty. */
  onChangeText?: (fullPhoneNumber: string) => void;
  error?: string;
  placeholder?: string;
  containerClassName?: string;
  helperText?: string;
  /** ISO country used for bare numbers; defaults to community → device → IN. */
  defaultCountry?: string;
  /** Rendered at the end of the field, e.g. a contact-picker button. */
  rightElement?: React.ReactNode;
  testID?: string;
  /** 'form' matches the standard Input card field; 'glass' is the translucent auth-screen look. */
  variant?: 'form' | 'glass';
}

const buildFullNumber = (digits: string, country: PhoneCountry): string => {
  if (!digits) return '';
  const parsed = parsePhoneNumberFromString(digits, country.code as CountryCode);
  return parsed && parsed.isPossible() ? parsed.number : `${country.dialCode}${digits}`;
};

export const PhoneInput: React.FC<PhoneInputProps> = ({
  label = 'Mobile Number',
  required = false,
  value = '',
  onChangeText,
  error,
  placeholder,
  containerClassName,
  helperText,
  defaultCountry,
  rightElement,
  testID,
  variant = 'form',
}) => {
  const isGlass = variant === 'glass';
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry>(() =>
    getPhoneCountry(defaultCountry || getDefaultPhoneCountry())
  );
  const [nationalNumber, setNationalNumber] = useState('');
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  // Last value we emitted; lets us ignore our own round-trips so typing never flips the country.
  const lastEmitted = useRef<string | null>(null);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    if (!value) {
      setNationalNumber('');
      return;
    }
    const parsed = parsePhone(value, selectedCountry.code);
    setSelectedCountry(getPhoneCountry(parsed.country));
    setNationalNumber(parsed.nationalNumber || value.replace(/\D/g, ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (digits: string, country: PhoneCountry) => {
    const full = buildFullNumber(digits, country);
    lastEmitted.current = full;
    onChangeText?.(full);
  };

  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const all = getPhoneCountries();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const maxDigits = maxNationalDigits(selectedCountry.code);

  const handleCountrySelect = (country: PhoneCountry) => {
    setSelectedCountry(country);
    setIsPickerVisible(false);
    setSearchQuery('');
    emit(nationalNumber, country);
  };

  const handleNumberChange = (text: string) => {
    // A pasted international number (+44…/0044…) switches the country automatically.
    if (/^\s*(\+|00)/.test(text)) {
      const parsed = parsePhone(text, selectedCountry.code);
      const country = getPhoneCountry(parsed.country);
      setSelectedCountry(country);
      setNationalNumber(parsed.nationalNumber);
      emit(parsed.nationalNumber, country);
      return;
    }
    // +1 allows a trunk "0" some users type before the national number.
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, maxDigits + 1);
    setNationalNumber(cleaned);
    emit(cleaned, selectedCountry);
  };

  const status = phoneLengthStatus(nationalNumber, selectedCountry.code);
  const currentLength = nationalNumber.replace(/^0/, '').length;
  const isComplete = status === 'ok';
  const isIncomplete = status === 'short';
  const isInvalid = status === 'long' || status === 'invalid';

  return (
    <View className={cn('w-full', containerClassName)}>
      {Boolean(label) && (
        <View className="flex-row items-center justify-between mb-1.5">
          <Text className={isGlass ? 'text-sm font-medium text-foreground' : 'text-foreground font-bold font-sans text-[15px] ms-1'}>
            {label}
            {required && !label?.includes('*') && (
              <Text className="text-destructive font-bold"> *</Text>
            )}
          </Text>
          {currentLength > 0 && (
            <View className="flex-row items-center gap-1">
              {isComplete ? (
                <View className="flex-row items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                  <Text className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {currentLength} digits
                  </Text>
                </View>
              ) : (
                <Text className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  {currentLength}/{maxDigits} digits
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      <View
        className={cn(
          'flex-row items-center rounded-2xl border px-3.5 min-h-[48px] py-1 shadow-2xs transition-colors',
          isGlass
            ? 'bg-white/75 dark:bg-[#292524]/75 border-white/80 dark:border-white/20 py-2.5 backdrop-blur-sm'
            : 'bg-card border-border/80',
          isFocused && !error && 'border-primary ring-2 ring-primary/20',
          (isIncomplete || isInvalid) && !error && 'border-amber-500/80 bg-amber-500/5',
          isComplete && !error && 'border-emerald-500/80 bg-emerald-500/5',
          Boolean(error) && 'border-destructive bg-destructive/5 ring-1 ring-destructive/20'
        )}
      >
        {/* Country Picker Trigger */}
        <TouchableOpacity
          onPress={() => setIsPickerVisible(true)}
          className="flex-row items-center me-2.5 pe-2.5 border-e border-border/80"
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Selected country ${selectedCountry.name}, dial code ${selectedCountry.dialCode}. Tap to change.`}
          testID={testID ? `${testID}-country` : undefined}
        >
          <Text className="text-base me-1">{selectedCountry.flag}</Text>
          <Text className="text-xs font-bold text-foreground me-1">
            {selectedCountry.dialCode}
          </Text>
          <ChevronDown size={14} className="text-muted-foreground" />
        </TouchableOpacity>

        {/* National Number Input */}
        <RNTextInput
          className={cn('flex-1 font-sans text-foreground self-stretch min-h-[44px] py-3', isGlass ? 'text-sm' : 'text-[16px]')}
          style={{ outlineStyle: 'none' } as any}
          keyboardType="phone-pad"
          placeholder={placeholder || examplePhone(selectedCountry.code) || '99887 76655'}
          placeholderTextColor="#737c88"
          value={nationalNumber}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChangeText={handleNumberChange}
          accessibilityLabel={label}
          testID={testID}
        />

        {isComplete && !error && !rightElement && (
          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 ms-2" />
        )}
        {rightElement ? <View className="ms-2">{rightElement}</View> : null}
      </View>

      {Boolean(error) && (
        <View className="flex-row items-center mt-1 ms-1 gap-1">
          <AlertCircle size={12} className="text-destructive shrink-0" />
          <Text className="text-xs text-destructive font-semibold">{error}</Text>
        </View>
      )}

      {!error && isIncomplete && (
        <Text className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium ms-1">
          Number looks short for {selectedCountry.name}.
        </Text>
      )}

      {!error && isInvalid && (
        <Text className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium ms-1">
          Check this number for {selectedCountry.name}.
        </Text>
      )}

      {!error && !isIncomplete && !isInvalid && Boolean(helperText) && (
        <Text className="mt-1 text-[11px] text-muted-foreground ms-1">{helperText}</Text>
      )}

      {/* Country Selection Modal */}
      <Modal visible={isPickerVisible} transparent statusBarTranslucent={true} animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable
            className="flex-1 bg-black/50 justify-center items-center p-4"
            onPress={() => {
              setIsPickerVisible(false);
              setSearchQuery('');
            }}
          >
            <Pressable
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-xl max-h-[480px]"
              onPress={(e) => e.stopPropagation()}
            >
              <Text className="text-base font-bold text-foreground mb-2 px-1">Select Country</Text>

              {/* Search Filter */}
              <RNTextInput
                className="bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground mb-3"
                placeholder="Search country or code..."
                placeholderTextColor="#737c88"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />

              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.code}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                windowSize={7}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleCountrySelect(item)}
                    className={cn(
                      'flex-row items-center justify-between p-2.5 rounded-xl mb-1',
                      selectedCountry.code === item.code ? 'bg-primary/10' : 'active:bg-muted'
                    )}
                  >
                    <View className="flex-row items-center flex-1">
                      <Text className="text-2xl me-3">{item.flag}</Text>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground">{item.name}</Text>
                        <Text className="text-xs text-muted-foreground">{item.dialCode}</Text>
                      </View>
                    </View>
                    {selectedCountry.code === item.code && (
                      <Check size={18} className="text-primary" />
                    )}
                  </TouchableOpacity>
                )}
              />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default PhoneInput;
