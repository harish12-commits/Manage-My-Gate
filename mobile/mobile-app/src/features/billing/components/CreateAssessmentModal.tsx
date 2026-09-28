import React, { useState } from 'react';
import { View, Modal, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/forms/TextInput';
import { DropdownSelect, DropdownOption } from '@/components/forms/DropdownSelect';
import { Icon } from '@/components/ui/icon';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';
import { X, Landmark, Plus, Sliders } from 'lucide-react-native';
import billingService from '../services/billingService';
import { parseBackendError, validateNumber } from '@/src/utils/validation';

interface CreateAssessmentModalProps {
  visible: boolean;
  communityId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const TYPE_OPTIONS: DropdownOption[] = [
  { label: 'Recurring Subscription', value: 'RECURRING' },
  { label: 'One-Time Levy', value: 'ONE_TIME' },
  { label: 'Capital Repair Fund', value: 'CAPITAL_REPAIR' },
];

const CYCLE_OPTIONS: DropdownOption[] = [
  { label: 'Monthly Billing', value: 'MONTHLY' },
  { label: 'Quarterly Billing', value: 'QUARTERLY' },
  { label: 'Annual Billing', value: 'ANNUALLY' },
  { label: 'Ad-Hoc / Custom', value: 'AD_HOC' },
];

const METHOD_OPTIONS: DropdownOption[] = [
  { label: 'Flat Rate per Unit (₹)', value: 'FLAT_RATE' },
  { label: 'Rate per Sq. Ft. (₹/sqft)', value: 'PER_SQ_FT' },
];

export const CreateAssessmentModal: React.FC<CreateAssessmentModalProps> = ({
  visible,
  communityId,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('RECURRING');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [generationDay, setGenerationDay] = useState('1');
  const [calculationType, setCalculationType] = useState('FLAT_RATE');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field errors
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [amountError, setAmountError] = useState<string | undefined>(undefined);
  const [dayError, setDayError] = useState<string | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setType('RECURRING');
    setBillingCycle('MONTHLY');
    setGenerationDay('1');
    setCalculationType('FLAT_RATE');
    setAmount('');
    setNameError(undefined);
    setAmountError(undefined);
    setDayError(undefined);
    setErrorMsg(null);
  };

  const handleModalClose = () => {
    resetForm();
    onClose();
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (nameError) setNameError(undefined);
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
    if (amountError) setAmountError(undefined);
  };

  const handleDayChange = (val: string) => {
    setGenerationDay(val);
    if (dayError) setDayError(undefined);
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    setNameError(undefined);
    setAmountError(undefined);
    setDayError(undefined);

    let hasError = false;

    if (!name.trim()) {
      setNameError('Assessment rule name is required.');
      hasError = true;
    }

    const amountRes = validateNumber(amount, { min: 0.01, fieldLabel: 'Assessment amount' });
    if (!amountRes.isValid) {
      setAmountError(amountRes.message || 'Please enter an amount greater than 0.');
      hasError = true;
    }

    const dayRes = validateNumber(generationDay, { integerOnly: true, min: 1, max: 28, fieldLabel: 'Generation day' });
    if (!dayRes.isValid) {
      setDayError('Generation day must be between 1 and 28.');
      hasError = true;
    }

    if (hasError) return;

    setIsSubmitting(true);

    try {
      const payload: Record<string, any> = {
        communityId,
        name: name.trim(),
        type,
        billingCycle,
        generationDay: Number(generationDay),
        targetScope: {
          type: 'ALL_COMMUNITY',
        },
        calculationMethod: {
          type: calculationType,
          ...(calculationType === 'FLAT_RATE'
            ? { flatAmount: Number(amount) }
            : { ratePerSqFt: Number(amount) }),
        },
      };

      await billingService.createAssessment(payload);

      setIsSubmitting(false);
      resetForm();
      Alert.alert(
        'Assessment Created!',
        `Successfully created maintenance assessment rule '${name.trim()}'.`,
        [{ text: 'OK', onPress: () => onSuccess() }]
      );
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      const parsed = parseBackendError(err, 'Failed to create assessment rule.');
      if (parsed.isDuplicate) {
        setNameError(`Assessment rule "${name.trim()}" already exists.`);
      } else {
        setErrorMsg(parsed.userMessage);
      }
    }
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent={true} animationType="slide" onRequestClose={handleModalClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={{ flex: 1 }}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <Pressable className="flex-1" onPress={handleModalClose} />
          <View className="bg-card border-t border-border rounded-t-3xl max-h-[88%] shadow-2xl overflow-hidden flex-col">
            {/* Modal Navigation Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-border bg-card">
              <View className="flex-row items-center">
                <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center me-3">
                  <Icon as={Landmark} size={20} className="text-primary" />
                </View>
                <View>
                  <Text className="text-base font-extrabold text-foreground">Create Assessment Rule</Text>
                  <Text className="text-xs text-muted-foreground">Define maintenance calculation formula</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleModalClose}
                activeOpacity={0.7}
                className="p-1 rounded-full bg-muted border border-border"
              >
                <Icon as={X} size={18} className="text-muted-foreground" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Form Body */}
            <KeyboardAwareScrollView
              extraScrollHeight={48}
              className="p-5"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
            >
              {errorMsg ? (
                <View className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-3">
                  <Text className="text-xs font-bold text-destructive">{errorMsg}</Text>
                </View>
              ) : null}

              <View className="gap-3.5">
                {/* Assessment Name */}
                <TextInput
                  label="Assessment Name"
                  required
                  placeholder="e.g. Monthly Maintenance 2026"
                  value={name}
                  onChangeText={handleNameChange}
                  error={nameError}
                />

                {/* Assessment Type Dropdown */}
                <DropdownSelect
                  label="Assessment Type"
                  required
                  options={TYPE_OPTIONS}
                  value={type}
                  onValueChange={setType}
                  placeholder="Select Type"
                  inline
                />

                {/* Billing Cycle Dropdown */}
                <DropdownSelect
                  label="Billing Cycle"
                  required
                  options={CYCLE_OPTIONS}
                  value={billingCycle}
                  onValueChange={setBillingCycle}
                  placeholder="Select Billing Cycle"
                  inline
                />

                {/* Generation Day */}
                <TextInput
                  label="Monthly Generation Day (1 - 28)"
                  required
                  placeholder="1"
                  keyboardType="number-pad"
                  value={generationDay}
                  onChangeText={handleDayChange}
                  error={dayError}
                />

                {/* Calculation Method */}
                <DropdownSelect
                  label="Calculation Method"
                  required
                  options={METHOD_OPTIONS}
                  value={calculationType}
                  onValueChange={setCalculationType}
                  placeholder="Select Calculation Method"
                  inline
                />

                {/* Assessment Rate or Amount */}
                <TextInput
                  label={
                    calculationType === 'FLAT_RATE'
                      ? 'Flat Maintenance Fee per Villa (₹)'
                      : 'Rate per Square Foot (₹ / sq.ft.)'
                  }
                  required
                  placeholder={calculationType === 'FLAT_RATE' ? 'e.g. 2500' : 'e.g. 3.5'}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={handleAmountChange}
                  error={amountError}
                />
              </View>

              <View className="h-4" />
            </KeyboardAwareScrollView>

            {/* Modal Bottom Action Footer */}
            <View className="flex-row items-center justify-end gap-3 px-5 py-4 border-t border-border bg-card">
              <Button variant="outline" onPress={handleModalClose} disabled={isSubmitting}>
                <Text className="font-semibold text-sm text-foreground">Cancel</Text>
              </Button>
              <Button
                variant="default"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                <Text className="font-extrabold text-sm text-primary-foreground">Save Rule</Text>
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
