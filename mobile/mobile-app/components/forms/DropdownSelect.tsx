import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  ScrollView,
  Platform,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { ChevronDown, Check, AlertCircle, Search } from 'lucide-react-native';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../src/utils/i18n';

export interface DropdownOption {
  label: string;
  value: string;
}

export interface DropdownSelectProps {
  label?: string;
  required?: boolean;
  options: DropdownOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  className?: string;
  inline?: boolean;
  accordion?: boolean;
  searchable?: boolean;
}

export const DropdownSelect = ({
  label,
  required = false,
  options,
  value,
  onValueChange,
  placeholder = 'Select an option',
  error,
  helperText,
  className,
  inline = false,
  accordion = false,
  searchable = true,
}: DropdownSelectProps) => {
  const { translateText, t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isInline = inline || accordion;

  const selectedOption = options.find((opt) => opt.value === value);

  const handlePress = () => {
    if (inline) {
      setIsOpen(!isOpen);
    } else {
      setSearchQuery('');
      setModalVisible(true);
    }
  };

  const filteredOptions = options.filter((opt) => {
    const rawLabel = opt.label || '';
    const localizedLabel = translateText(rawLabel);
    return (
      rawLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      localizedLabel.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <View
      className={cn('w-full relative', className)}
      style={inline && isOpen ? { zIndex: 1000 } : undefined}
    >
      {Boolean(label) && (
        <Text className="mb-1.5 text-[13.5px] font-bold font-sans text-foreground">
          {translateText(label || '')}
          {required && !label?.includes('*') && (
            <Text className="text-destructive font-bold"> *</Text>
          )}
        </Text>
      )}

      <Pressable
        className={cn(
          'flex-row items-center justify-between rounded-2xl border bg-card px-3.5 py-3 shadow-2xs active:bg-secondary/70 transition-colors',
          'border-border/80',
          Boolean(error) && 'border-destructive bg-destructive/5 shadow-sm'
        )}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={label ? `${translateText(label || '')}: ${translateText(selectedOption?.label || placeholder)}` : translateText(placeholder)}
      >
        <Text
          numberOfLines={1}
          className={cn(
            'text-[14.5px] font-sans flex-1 me-1',
            selectedOption ? 'text-foreground font-semibold' : 'text-muted-foreground'
          )}
        >
          {selectedOption ? translateText(selectedOption.label) : translateText(placeholder)}
        </Text>
        <ChevronDown size={16} className="text-muted-foreground shrink-0" />
      </Pressable>

      {Boolean(error) && (
        <View className="flex-row items-center mt-1 ms-1 gap-1">
          <AlertCircle size={12} className="text-destructive shrink-0" />
          <Text className="text-xs text-destructive font-semibold">{translateText(error || '')}</Text>
        </View>
      )}

      {!error && Boolean(helperText) && (
        <Text className="mt-1 text-[11.5px] text-muted-foreground ms-1">{translateText(helperText || '')}</Text>
      )}

      {/* Inline Dropdown List overlay */}
      {isInline && isOpen && (
        <View
          className="absolute left-0 right-0 z-[1000] bg-card border border-border rounded-xl shadow-lg mt-1 overflow-hidden"
          style={{
            top: '100%',
            maxHeight: 200,
            elevation: 5,
          }}
        >
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.length === 0 ? (
              <View className="px-4 py-4 items-center justify-center">
                <Text className="text-sm text-muted-foreground italic">{t('no_options_available', 'No options available')}</Text>
              </View>
            ) : (
              options.map((item) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    key={item.value}
                    className={cn(
                      'flex-row items-center justify-between px-4 py-3 border-b border-border/50 last:border-b-0',
                      isSelected && 'bg-primary/10'
                    )}
                    onPress={() => {
                      onValueChange(item.value);
                      setIsOpen(false);
                    }}
                  >
                    <Text
                      className={cn(
                        'text-sm font-sans',
                        isSelected ? 'font-bold text-primary' : 'text-foreground'
                      )}
                    >
                      {translateText(item.label)}
                    </Text>
                    {isSelected && <Check size={16} className="text-primary" />}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* Full Sheet Modal Dropdown for standard (non-inline) usage */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-end bg-black/60">
            <Pressable
              className="absolute top-0 bottom-0 left-0 right-0"
              onPress={() => setModalVisible(false)}
            />
            <View className="max-h-[75%] rounded-t-3xl bg-card border-t border-border p-4 shadow-xl">
              <Text className="mb-3 text-center text-lg font-bold font-sans text-foreground">
                {label ? translateText(label) : t('select_option', 'Select Option')}
              </Text>

              {/* In-modal search bar when options > 5 */}
              {(searchable || options.length > 5) && (
                <View className="mb-3 rounded-2xl border border-border/40 bg-card p-2 shadow-sm">
                  <View className="h-11 flex-row items-center rounded-xl border border-border/80 bg-background/70 px-3.5 shadow-2xs">
                    <Search size={18} className="text-muted-foreground me-2.5" />
                    <RNTextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder={t('search_options', 'Search options...')}
                      placeholderTextColor="#737c88"
                      className="h-full min-w-0 flex-1 p-0 font-sans text-[13px] font-medium text-foreground"
                      style={{ outlineStyle: 'none' } as any}
                    />
                  </View>
                </View>
              )}

              <FlatList
                data={filteredOptions}
                keyExtractor={(item, index) => {
                  if (item && typeof item === 'object') {
                    if (typeof item.value === 'string' || typeof item.value === 'number') {
                      return String(item.value);
                    }
                    if (typeof item.label === 'string' && item.label) {
                      return `${item.label}-${index}`;
                    }
                  }
                  return `opt-${index}`;
                }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={() => (
                  <View className="py-6 items-center justify-center">
                    <Text className="text-base text-muted-foreground italic">{t('no_options_found', 'No options found')}</Text>
                  </View>
                )}
                renderItem={({ item }) => {
                  const isSelected = item.value === value;
                  return (
                    <Pressable
                      className={cn(
                        'flex-row items-center justify-between rounded-xl px-4 py-3.5 mb-1',
                        isSelected && 'bg-primary/10'
                      )}
                      onPress={() => {
                        onValueChange(item.value);
                        setModalVisible(false);
                      }}
                    >
                      <Text
                        className={cn(
                          'text-base font-sans',
                          isSelected ? 'font-bold text-primary' : 'text-foreground'
                        )}
                      >
                        {translateText(item.label)}
                      </Text>
                      {isSelected && <Check size={18} className="text-primary" />}
                    </Pressable>
                  );
                }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};
