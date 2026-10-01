import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/forms/TextInput';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { Icon } from '@/components/ui/icon';
import { Landmark, CreditCard, ShieldCheck } from 'lucide-react-native';

interface BankDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (bankingData: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountType: string;
    razorpayKeyId?: string;
    razorpayKeySecret?: string;
  }) => Promise<boolean>;
  isSubmitting: boolean;
  error?: string | null;
}

export const BankDetailsModal: React.FC<BankDetailsModalProps> = ({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}) => {
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountType, setAccountType] = useState('Current');
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValidationError(null);
    }
  }, [visible]);

  const handleSubmit = async () => {
    setValidationError(null);

    if (!accountHolderName.trim()) {
      setValidationError('Account holder name is required');
      return;
    }
    if (!bankName.trim()) {
      setValidationError('Bank name is required');
      return;
    }
    if (!accountNumber.trim()) {
      setValidationError('Account number is required');
      return;
    }
    if (!/^\d{9,18}$/.test(accountNumber.trim())) {
      setValidationError('Enter a valid 9 to 18 digit bank account number');
      return;
    }
    if (!ifscCode.trim()) {
      setValidationError('IFSC code is required');
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode.trim())) {
      setValidationError('Enter a valid IFSC code (e.g. SBIN0001234)');
      return;
    }

    const success = await onSubmit({
      accountHolderName: accountHolderName.trim(),
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim(),
      ifscCode: ifscCode.trim().toUpperCase(),
      accountType,
      razorpayKeyId: razorpayKeyId.trim() || undefined,
      razorpayKeySecret: razorpayKeySecret.trim() || undefined,
    });

    if (success) {
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Banking Vault & Payment Gateway">
      <ScrollView className="max-h-[520px]" showsVerticalScrollIndicator={false}>
        <View className="gap-3.5 pb-6">
          {(error || validationError) && (
            <View className="bg-destructive/10 p-3 rounded-xl border border-destructive/20 mb-1">
              <Text className="text-xs text-destructive font-medium text-start">
                ⚠️ {error || validationError}
              </Text>
            </View>
          )}

          {/* Top Info Header */}
          <View className="bg-muted/40 p-3 rounded-xl border border-border flex-row items-center gap-3">
            <View className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Icon as={Landmark} size={20} className="text-primary" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-foreground">Encrypted Banking Vault</Text>
              <Text className="text-[11px] text-muted-foreground mt-0.5">
                Bank account and payment gateway credentials are encrypted with AES-256-GCM hardware security.
              </Text>
            </View>
          </View>

          {/* Bank Account Details Section */}
          <View className="gap-3 pt-2">
            <View className="flex-row items-center gap-1.5 mb-1">
              <Icon as={ShieldCheck} size={14} className="text-primary" />
              <Text className="text-xs font-bold text-foreground text-start uppercase tracking-wider">
                Bank Account Details
              </Text>
            </View>

            <TextInput
              label="Account Holder Name *"
              placeholder="e.g. Apex Heights HOA Operations"
              value={accountHolderName}
              onChangeText={setAccountHolderName}
            />

            <TextInput
              label="Bank Name *"
              placeholder="e.g. State Bank of India / HDFC Bank"
              value={bankName}
              onChangeText={setBankName}
            />

            <TextInput
              label="Account Number *"
              placeholder="9 to 18 digit account number"
              keyboardType="number-pad"
              value={accountNumber}
              onChangeText={setAccountNumber}
            />

            <TextInput
              label="IFSC Code *"
              placeholder="e.g. SBIN0001234"
              autoCapitalize="characters"
              value={ifscCode}
              onChangeText={setIfscCode}
            />

            <DropdownSelect
              label="Account Type *"
              options={[
                { label: 'Current Account', value: 'Current' },
                { label: 'Savings Account', value: 'Savings' },
              ]}
              value={accountType}
              onValueChange={setAccountType}
            />
          </View>

          {/* Razorpay Credentials Section */}
          <View className="gap-3 pt-3 border-t border-border/60">
            <View className="flex-row items-center gap-1.5 mb-1">
              <Icon as={CreditCard} size={14} className="text-primary" />
              <Text className="text-xs font-bold text-foreground text-start uppercase tracking-wider">
                Razorpay Payment Gateway (Optional)
              </Text>
            </View>

            <TextInput
              label="Razorpay Key ID"
              placeholder="rzp_live_xxxxxxxxxxxx"
              value={razorpayKeyId}
              onChangeText={setRazorpayKeyId}
            />

            <TextInput
              label="Razorpay Key Secret"
              placeholder="Enter Key Secret..."
              secureTextEntry
              value={razorpayKeySecret}
              onChangeText={setRazorpayKeySecret}
            />
          </View>

          {/* Submit Action Row */}
          <View className="flex-row gap-3 pt-4 mt-2 border-t border-border/60">
            <Button variant="outline" onPress={onClose} className="flex-1 rounded-xl">
              <Text className="text-xs font-semibold text-foreground">Cancel</Text>
            </Button>
            <Button
              variant="default"
              onPress={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 rounded-xl"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-xs font-semibold text-primary-foreground">Save Vault Credentials</Text>
              )}
            </Button>
          </View>
        </View>
      </ScrollView>
    </BottomSheet>
  );
};

export default BankDetailsModal;
