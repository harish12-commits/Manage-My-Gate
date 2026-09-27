import React, { useState, useEffect } from 'react';
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
import { ChevronDown, Check, Phone, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { cn } from '../../lib/utils';
import { validatePhone } from '../../src/utils/validation';

export interface CountryOption {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  digitsLength: number;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', digitsLength: 10 },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', digitsLength: 9 },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', digitsLength: 9 },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', digitsLength: 10 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', digitsLength: 10 },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦', digitsLength: 8 },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼', digitsLength: 8 },
  { code: 'OM', name: 'Oman', dialCode: '+968', flag: '🇴🇲', digitsLength: 8 },
  { code: 'BH', name: 'Bahrain', dialCode: '+973', flag: '🇧🇭', digitsLength: 8 },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', digitsLength: 8 },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', digitsLength: 9 },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', digitsLength: 9 },
];

export interface PhoneInputProps {
  label?: string;
  required?: boolean;
  value?: string;
  onChangeText?: (fullPhoneNumber: string) => void;
  error?: string;
  placeholder?: string;
  placeholderTextColor?: string;
  containerClassName?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  codeClassName?: string;
  style?: any;
  helperText?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  label = 'Mobile Number',
  required = false,
  value = '',
  onChangeText,
  error,
  placeholder = '99887 76655',
  placeholderTextColor,
  containerClassName,
  className,
  labelClassName,
  inputClassName,
  codeClassName,
  style,
  helperText,
}) => {
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRIES[0]); // Default India +91
  const [nationalNumber, setNationalNumber] = useState('');
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Parse initial value if passed e.g. +919988776655
  useEffect(() => {
    if (value) {
      const matched = COUNTRIES.find((c) => value.startsWith(c.dialCode));
      if (matched) {
        setSelectedCountry(matched);
        setNationalNumber(value.slice(matched.dialCode.length).trim());
      } else {
        const digits = value.replace(/[^0-9]/g, '');
        setNationalNumber(digits);
      }
    }
  }, [value]);

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.dialCode.includes(searchQuery) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCountrySelect = (country: CountryOption) => {
    setSelectedCountry(country);
    setIsPickerVisible(false);
    setSearchQuery('');
    const trimmedNumber = nationalNumber.slice(0, country.digitsLength);
    setNationalNumber(trimmedNumber);
    if (onChangeText) {
      onChangeText(`${country.dialCode}${trimmedNumber}`);
    }
  };

  const handleNumberChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, selectedCountry.digitsLength);
    setNationalNumber(cleaned);
    if (onChangeText) {
      onChangeText(`${selectedCountry.dialCode}${cleaned}`);
    }
  };

  const currentLength = nationalNumber.length;
  const isComplete = currentLength === selectedCountry.digitsLength;
  const isIncomplete = currentLength > 0 && currentLength < selectedCountry.digitsLength;

  return (
    <View className={cn('w-full', containerClassName)}>
      {Boolean(label) && (
        <View className="flex-row items-center justify-between mb-1.5">
          <Text className={cn('text-sm font-medium text-foreground', labelClassName)}>
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
                    {currentLength}/{selectedCountry.digitsLength}
                  </Text>
                </View>
              ) : (
                <Text className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  {currentLength}/{selectedCountry.digitsLength} digits
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      <View
        className={cn(
          'flex-row items-center rounded-2xl border bg-white/75 dark:bg-[#292524]/75 border-white/80 dark:border-white/20 px-3.5 min-h-[48px] py-2.5 shadow-2xs transition-colors backdrop-blur-sm',
          isFocused && !error && 'border-primary ring-2 ring-primary/20',
          isIncomplete && !error && 'border-amber-500/80 bg-amber-500/5',
          isComplete && !error && 'border-emerald-500/80 bg-emerald-500/5',
          Boolean(error) && 'border-destructive bg-destructive/5 ring-1 ring-destructive/20',
          className
        )}
      >
        {/* Country Picker Trigger */}
        <TouchableOpacity
          onPress={() => setIsPickerVisible(true)}
          className="flex-row items-center me-2.5 pe-2.5 border-e border-border/80"
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Selected country ${selectedCountry.name}, dial code ${selectedCountry.dialCode}. Tap to change.`}
        >
          <Text className="text-base me-1">{selectedCountry.flag}</Text>
          <Text className={cn('text-xs font-bold text-foreground me-1', codeClassName)}>
            {selectedCountry.dialCode}
          </Text>
          <ChevronDown size={14} className="text-muted-foreground" />
        </TouchableOpacity>

        {/* National Number Input */}
        {(() => {
          const hasFontFamily = Boolean(
            inputClassName &&
              (inputClassName.includes('font-sans') ||
                inputClassName.includes('font-medium') ||
                inputClassName.includes('font-semibold') ||
                inputClassName.includes('font-bold') ||
                inputClassName.includes('font-mono'))
          );
          return (
            <RNTextInput
              className={cn(
                'flex-1 text-sm text-foreground self-stretch min-h-[44px] py-3',
                !hasFontFamily && 'font-sans',
                inputClassName
              )}
              style={[{ outlineStyle: 'none' } as any, style]}
              keyboardType="phone-pad"
              placeholder={placeholder}
              placeholderTextColor={placeholderTextColor || '#737c88'}
              value={nationalNumber}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onChangeText={handleNumberChange}
              maxLength={selectedCountry.digitsLength}
              accessibilityLabel={label}
            />
          );
        })()}

        {isComplete && !error && (
          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 ms-2" />
        )}
      </View>

      {Boolean(error) && (
        <View className="flex-row items-center mt-1 ms-1 gap-1">
          <AlertCircle size={12} className="text-destructive shrink-0" />
          <Text className="text-xs text-destructive font-semibold">{error}</Text>
        </View>
      )}

      {!error && isIncomplete && (
        <Text className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium ms-1">
          Enter {selectedCountry.digitsLength - currentLength} more digit{selectedCountry.digitsLength - currentLength > 1 ? 's' : ''} to complete.
        </Text>
      )}

      {!error && !isIncomplete && Boolean(helperText) && (
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
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-xl max-h-[440px]"
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
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleCountrySelect(item)}
                    className={cn(
                      'flex-row items-center justify-between p-2.5 rounded-xl mb-1',
                      selectedCountry.code === item.code ? 'bg-primary/10' : 'active:bg-muted'
                    )}
                  >
                    <View className="flex-row items-center">
                      <Text className="text-2xl me-3">{item.flag}</Text>
                      <View>
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
