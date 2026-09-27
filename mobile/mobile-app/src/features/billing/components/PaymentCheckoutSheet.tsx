import React, { useState, useEffect, useMemo } from 'react';
import { View, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '@/src/store/store';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/forms/TextInput';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Wallet, CreditCard, AlertCircle, ChevronRight, Check, Landmark } from 'lucide-react-native';
import { useBilling } from '../hooks/useBilling';
import { useMobilePayment, PaymentMethod } from '../hooks/useMobilePayment';
import { Invoice } from '../types';
import { RazorpayCheckoutModal, RazorpayCheckoutOptions } from './RazorpayCheckoutModal';
import {
  createOperationId,
  buildInvoiceWalletKey,
  buildInvoiceOrderKey,
  buildInvoiceVerifyKey,
} from '@/src/utils/idempotency';

export interface PaymentCheckoutSheetProps {
  visible: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onOpenOfflineSheet?: (invoice: Invoice, amountToPay: number) => void;
  onPaymentSuccess?: (result: any, amountPaid?: number, paymentMethod?: string) => void;
}

export function PaymentCheckoutSheet({
  visible,
  onClose,
  invoice,
  onOpenOfflineSheet,
  onPaymentSuccess,
}: PaymentCheckoutSheetProps) {
  const router = useRouter();
  const { walletBalance, loadResidentDues } = useBilling();
  const walletState = useSelector((state: RootState) => state.wallet);
  const isGatewayConfigured = walletState?.isPaymentGatewayConfigured === true;
  const {
    paymentState,
    isGlobalSettling,
    processWalletPayment,
    initiateRazorpayPayment,
    confirmRazorpayPayment,
    resetPaymentState,
  } = useMobilePayment();

  // Selection states
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'CUSTOM'>('FULL');
  const [customAmountStr, setCustomAmountStr] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('WALLET');
  const [showWalletConfirmModal, setShowWalletConfirmModal] = useState<boolean>(false);
  const [razorpayOptions, setRazorpayOptions] = useState<RazorpayCheckoutOptions | null>(null);

  // Derived figures
  const totalDue = invoice?.totalDue ?? invoice?.amount ?? 0;
  const paidAmount = invoice?.paidAmount ?? 0;
  const remainingDue = (invoice as any)?.outstandingAmount !== undefined
    ? (invoice as any).outstandingAmount
    : Math.max(0, totalDue - paidAmount);

  // Parse amount to pay
  const amountToPay = useMemo(() => {
    if (paymentMode === 'FULL') return remainingDue;
    const parsed = parseFloat(customAmountStr);
    return isNaN(parsed) || parsed <= 0 ? 0 : parsed;
  }, [paymentMode, customAmountStr, remainingDue]);

  const remainingAfterPayment = Math.max(0, remainingDue - amountToPay);
  const isWalletInsufficient = selectedMethod === 'WALLET' && walletBalance < amountToPay;
  const isAmountTooHigh = amountToPay > remainingDue;
  const isAmountInvalid = amountToPay <= 0 || isAmountTooHigh;

  // Invoice eligibility
  const status = invoice?.status || 'UNPAID';
  const isPaid = status === 'PAID';
  const isPendingVerification = status === 'VERIFICATION_PENDING';
  const isCancelled = status === 'CANCELLED';
  const isPaymentDisabled = isPaid || isPendingVerification || isCancelled || remainingDue <= 0;

  // Deterministic operation ID for the checkout session (preserved across retries)
  const operationIdRef = React.useRef<string>(createOperationId());

  useEffect(() => {
    if (visible) {
      operationIdRef.current = createOperationId();
      resetPaymentState();
      setPaymentMode('FULL');
      setCustomAmountStr('');
      const defaultMethod = walletBalance >= remainingDue
        ? 'WALLET'
        : (isGatewayConfigured ? 'RAZORPAY' : 'OFFLINE');
      setSelectedMethod(defaultMethod);
      setShowWalletConfirmModal(false);
    }
  }, [visible, invoice, walletBalance, remainingDue, isGatewayConfigured, resetPaymentState]);

  if (!invoice) return null;

  const invNo = invoice.invoiceNumber || invoice._id || '—';

  // --- Handlers ---

  const handleOpenWalletRecharge = () => {
    onClose();
    router.push('/(resident)/billing/wallet' as any);
  };

  const isSubmittingRef = React.useRef<boolean>(false);

  const handleInitiatePayment = () => {
    if (isPaymentDisabled || isAmountInvalid || isSubmittingRef.current || isGlobalSettling) return;

    if (selectedMethod === 'OFFLINE') {
      onClose();
      if (onOpenOfflineSheet && invoice) {
        onOpenOfflineSheet(invoice, amountToPay);
      }
      return;
    }

    if (selectedMethod === 'WALLET') {
      if (isWalletInsufficient) {
        Alert.alert('Insufficient Wallet Balance', `Insufficient wallet balance. Please recharge your wallet or choose Razorpay.`);
        return;
      }
      setShowWalletConfirmModal(true);
    } else if (selectedMethod === 'RAZORPAY') {
      if (!isGatewayConfigured) {
        Alert.alert(
          'Online Gateway Not Configured',
          'Razorpay online payment has not been configured for your community by the administrator. Please choose an Offline Payment Request or pay via Digital Wallet.'
        );
        return;
      }
      handleProcessRazorpay();
    }
  };

  const handleConfirmWalletPayment = async () => {
    if (!invoice._id || amountToPay <= 0 || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const idempotencyKey = buildInvoiceWalletKey(invoice._id, amountToPay, operationIdRef.current);
      const result = await processWalletPayment(invoice._id, amountToPay, idempotencyKey, operationIdRef.current);
      setShowWalletConfirmModal(false);
      await loadResidentDues();

      // Server invoice is strictly authoritative
      const serverInvoice = result?.invoice || result?.data?.invoice || result?.data || result;
      const authoritativeStatus = serverInvoice?.status || 'PAID';
      const authoritativePaid = serverInvoice?.paidAmount ?? (invoice.paidAmount || 0);
      const authoritativeOutstanding = serverInvoice?.outstandingAmount ?? 0;
      const rawTotal = serverInvoice?.totalDue ?? serverInvoice?.totalAmount ?? invoice.totalDue ?? totalDue;

      const updatedReceiptData = {
        ...invoice,
        ...serverInvoice,
        _id: invoice._id,
        invoiceNumber: serverInvoice?.invoiceNumber || invoice.invoiceNumber || invoice._id,
        unitNumber: serverInvoice?.unitNumber || invoice.unitNumber,
        assessmentName: serverInvoice?.assessmentName || serverInvoice?.snapshot?.assessmentName || (invoice as any).assessmentName,
        totalDue: rawTotal,
        totalAmount: rawTotal,
        paidAmount: authoritativePaid,
        amountPaid: amountToPay,
        outstandingAmount: authoritativeOutstanding,
        remainingDue: authoritativeOutstanding,
        status: authoritativeStatus as any,
        paymentStatus: (serverInvoice?.paymentStatus || authoritativeStatus) as any,
        paymentMethod: 'Digital Wallet',
      };
      if (onPaymentSuccess) {
        onPaymentSuccess(updatedReceiptData, amountToPay, 'Digital Wallet');
      } else {
        router.push(`/(resident)/billing/invoice/${invoice._id}` as any);
        Alert.alert('Payment Successful!', `Settled ₹${amountToPay.toLocaleString('en-IN')} via Digital Wallet for Invoice #${invNo}.`);
      }
      onClose();
    } catch (err: any) {
      setShowWalletConfirmModal(false);
      Alert.alert('Wallet Payment Failed', err.message || 'Transaction could not be completed.');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleProcessRazorpay = async () => {
    if (!invoice._id || amountToPay <= 0 || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      const idempotencyKey = buildInvoiceOrderKey(invoice._id, amountToPay, operationIdRef.current);
      const orderData = await initiateRazorpayPayment(invoice._id, amountToPay, idempotencyKey, operationIdRef.current);
      
      const keyId = orderData?.razorpayKeyId || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_TXAJ0OalVys0pH';
      const orderId = orderData?.orderId || orderData?.id || '';
      const paymentId = orderData?.paymentId || '';

      setRazorpayOptions({
        razorpayKeyId: keyId,
        orderId,
        paymentId,
        amount: amountToPay,
        currency: orderData?.currency || 'INR',
        description: `Settlement for Invoice #${invNo}`,
        customerName: (invoice as any)?.targetUser || 'Resident',
      });
    } catch (err: any) {
      Alert.alert('Payment Failed', err.message || 'Razorpay order creation failed.');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleRazorpaySuccess = async (payload: any) => {
    setRazorpayOptions(null);
    try {
      const paymentId = payload?.paymentId || razorpayOptions?.paymentId;
      const orderId = payload?.orderId || razorpayOptions?.orderId;
      const idempotencyKey = paymentId && orderId ? buildInvoiceVerifyKey(paymentId, orderId) : undefined;
      const verifyResult = await confirmRazorpayPayment(payload, idempotencyKey, {
        invoiceId: invoice._id,
        amount: amountToPay,
        operationId: operationIdRef.current,
      });

      // Handle ambiguous verification (network timeout or offline state during verification)
      if (verifyResult?.isChecking || verifyResult?.status === 'CHECKING') {
        onClose();
        router.push(
          `/(resident)/billing/payment-result?invoiceId=${invoice._id}&status=CHECKING&paymentMethod=Razorpay Online&amount=${amountToPay}` as any
        );
        return;
      }

      await loadResidentDues();

      // Server invoice is strictly authoritative
      const serverInvoice = verifyResult?.invoice || verifyResult?.data?.invoice || verifyResult?.data || verifyResult;
      const authoritativeStatus = serverInvoice?.status || 'PAID';
      const authoritativePaid = serverInvoice?.paidAmount ?? (invoice.paidAmount || 0);
      const authoritativeOutstanding = serverInvoice?.outstandingAmount ?? 0;
      const rawTotal = serverInvoice?.totalDue ?? serverInvoice?.totalAmount ?? invoice.totalDue ?? totalDue;

      const updatedReceiptData = {
        ...invoice,
        ...serverInvoice,
        _id: invoice._id,
        invoiceNumber: serverInvoice?.invoiceNumber || invoice.invoiceNumber || invoice._id,
        unitNumber: serverInvoice?.unitNumber || invoice.unitNumber,
        assessmentName: serverInvoice?.assessmentName || serverInvoice?.snapshot?.assessmentName || (invoice as any).assessmentName,
        totalDue: rawTotal,
        totalAmount: rawTotal,
        paidAmount: authoritativePaid,
        amountPaid: amountToPay,
        outstandingAmount: authoritativeOutstanding,
        remainingDue: authoritativeOutstanding,
        status: authoritativeStatus as any,
        paymentStatus: (serverInvoice?.paymentStatus || authoritativeStatus) as any,
        paymentMethod: 'Online Payment',
      };
      if (onPaymentSuccess) {
        onPaymentSuccess(updatedReceiptData, amountToPay, 'Online Payment');
      } else {
        router.push(`/(resident)/billing/invoice/${invoice._id}` as any);
        Alert.alert('Razorpay Payment Confirmed!', `Verified & settled ₹${amountToPay.toLocaleString('en-IN')} for Invoice #${invNo}.`);
      }
      onClose();
    } catch (err: any) {
      Alert.alert('Signature Verification Failed', err.message || 'Payment signature could not be verified by backend.');
    }
  };

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} title={`Payment Checkout • #${invNo}`}>
        <View className="py-2 pb-2">

          {/* Payment Disabled Alert */}
          {isPaymentDisabled ? (
            <View className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4 flex-row items-center me-1">
              <Icon as={AlertCircle} size={20} className="text-amber-600 dark:text-amber-400 me-3" />
              <Text className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex-1">
                {isPaid ? 'This invoice has already been fully settled.' :
                 isPendingVerification ? 'Offline payment submitted and pending admin verification.' :
                 'Invoice is cancelled and cannot accept payments.'}
              </Text>
            </View>
          ) : null}

          {/* Payment Error Banner */}
          {paymentState.error ? (
            <View className="mb-4">
              <ErrorBanner message={paymentState.error} onDismiss={() => resetPaymentState()} />
            </View>
          ) : null}

          {/* Section 1: Payment Amount Selection */}
          <View className="mb-5 gap-2.5">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              1. Select Payment Amount
            </Text>

            {/* Full Amount Option */}
            <TouchableOpacity
              onPress={() => setPaymentMode('FULL')}
              activeOpacity={0.8}
              className={`p-4 rounded-xl border flex-row items-center justify-between ${
                paymentMode === 'FULL'
                  ? 'bg-primary/10 border-primary'
                  : 'bg-card border-border'
              }`}
            >
              <View className="flex-row items-center gap-3">
                <View className={`w-5 h-5 rounded-full border items-center justify-center ${
                  paymentMode === 'FULL' ? 'border-primary bg-primary' : 'border-muted-foreground'
                }`}>
                  {paymentMode === 'FULL' ? <Check size={12} className="text-primary-foreground" /> : null}
                </View>
                <View>
                  <Text className="font-bold text-sm text-foreground">Pay Full Remaining Amount</Text>
                  <Text className="text-xs text-muted-foreground">Settle total outstanding invoice balance</Text>
                </View>
              </View>

              <Text className="text-base font-extrabold text-foreground">
                ₹{remainingDue.toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>

            {/* Custom Partial Amount Option */}
            <TouchableOpacity
              onPress={() => setPaymentMode('CUSTOM')}
              activeOpacity={0.8}
              className={`p-4 rounded-xl border ${
                paymentMode === 'CUSTOM'
                  ? 'bg-primary/10 border-primary'
                  : 'bg-card border-border'
              }`}
            >
              <View className="flex-row items-center gap-3 mb-2">
                <View className={`w-5 h-5 rounded-full border items-center justify-center ${
                  paymentMode === 'CUSTOM' ? 'border-primary bg-primary' : 'border-muted-foreground'
                }`}>
                  {paymentMode === 'CUSTOM' ? <Check size={12} className="text-primary-foreground" /> : null}
                </View>
                <Text className="font-bold text-sm text-foreground">Pay Custom Partial Amount</Text>
              </View>

              {paymentMode === 'CUSTOM' ? (
                <View className="mt-2 ps-8">
                  <TextInput
                    label="Custom Settlement Amount (₹)"
                    value={customAmountStr}
                    onChangeText={setCustomAmountStr}
                    placeholder={`Enter amount (Max ₹${remainingDue})`}
                    keyboardType="numeric"
                    inputClassName="font-bold text-base"
                    error={isAmountTooHigh ? `Amount cannot exceed remaining due of ₹${remainingDue.toLocaleString('en-IN')}` : undefined}
                  />
                </View>
              ) : null}
            </TouchableOpacity>

            {/* Amount Breakdown Preview */}
            <View className="bg-muted/40 border border-border/60 rounded-xl p-3.5 flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-muted-foreground">Amount Being Paid Now</Text>
                <Text className="text-base font-extrabold text-primary">₹{amountToPay.toLocaleString('en-IN')}</Text>
              </View>
              <View className="items-end">
                <Text className="text-xs text-muted-foreground">Remaining After Payment</Text>
                <Text className="text-base font-bold text-foreground">₹{remainingAfterPayment.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </View>

          {/* Section 2: Payment Method Selection */}
          <View className="mb-5 gap-2.5">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              2. Select Payment Method
            </Text>

            {/* Digital Wallet Option */}
            <TouchableOpacity
              onPress={() => setSelectedMethod('WALLET')}
              activeOpacity={0.8}
              className={`p-4 rounded-xl border flex-row items-center justify-between ${
                selectedMethod === 'WALLET' ? 'bg-status-success/10 border-status-success' : 'bg-card border-border'
              }`}
            >
              <View className="flex-row items-center flex-1 me-2 gap-3">
                <View className="w-10 h-10 rounded-xl bg-status-success/15 items-center justify-center">
                  <Icon as={Wallet} size={20} className="text-status-success" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-sm text-foreground">Digital Wallet</Text>
                  <Text className="text-xs text-muted-foreground">
                    Available Balance: ₹{walletBalance.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              {isWalletInsufficient ? (
                <View className="bg-destructive/10 px-2.5 py-1 rounded-md">
                  <Text className="text-xs font-bold text-destructive">Insufficient</Text>
                </View>
              ) : (
                <View className={`w-5 h-5 rounded-full border items-center justify-center ${
                  selectedMethod === 'WALLET' ? 'border-status-success bg-status-success' : 'border-muted-foreground'
                }`}>
                  {selectedMethod === 'WALLET' ? <Check size={12} className="text-primary-foreground" /> : null}
                </View>
              )}
            </TouchableOpacity>

            {/* Razorpay Online Option */}
            <TouchableOpacity
              onPress={() => {
                if (!isGatewayConfigured) {
                  Alert.alert(
                    'Online Gateway Not Configured',
                    'Razorpay online payment has not been configured for your community by the administrator. Please pay using an Offline Payment Request or Digital Wallet.'
                  );
                  return;
                }
                setSelectedMethod('RAZORPAY');
              }}
              activeOpacity={isGatewayConfigured ? 0.8 : 0.9}
              className={`p-4 rounded-xl border flex-row items-center justify-between ${
                !isGatewayConfigured
                  ? 'bg-muted/30 border-border/60 opacity-70'
                  : selectedMethod === 'RAZORPAY'
                  ? 'bg-primary/10 border-primary'
                  : 'bg-card border-border'
              }`}
            >
              <View className="flex-row items-center gap-3 flex-1 me-2">
                <View className={`w-10 h-10 rounded-xl items-center justify-center ${isGatewayConfigured ? 'bg-primary/10' : 'bg-muted/60'}`}>
                  <Icon as={CreditCard} size={20} className={isGatewayConfigured ? 'text-primary' : 'text-muted-foreground'} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className={`font-bold text-sm ${isGatewayConfigured ? 'text-foreground' : 'text-muted-foreground'}`}>
                      Razorpay Online
                    </Text>
                    {!isGatewayConfigured ? (
                      <View className="bg-amber-500/15 px-2 py-0.5 rounded-md">
                        <Text className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Not Configured</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {isGatewayConfigured ? 'UPI, Credit/Debit Card, NetBanking' : 'Disabled by community administrator'}
                  </Text>
                </View>
              </View>

              {isGatewayConfigured ? (
                <View className={`w-5 h-5 rounded-full border items-center justify-center ${
                  selectedMethod === 'RAZORPAY' ? 'border-primary bg-primary' : 'border-muted-foreground'
                }`}>
                  {selectedMethod === 'RAZORPAY' ? <Check size={12} className="text-primary-foreground" /> : null}
                </View>
              ) : null}
            </TouchableOpacity>

            {/* Offline Payment Request Option */}
            <TouchableOpacity
              onPress={() => setSelectedMethod('OFFLINE')}
              activeOpacity={0.8}
              className={`p-4 rounded-xl border flex-row items-center justify-between ${
                selectedMethod === 'OFFLINE' ? 'bg-amber-500/10 border-amber-500' : 'bg-card border-border'
              }`}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-xl bg-amber-500/10 items-center justify-center">
                  <Icon as={Landmark} size={20} className="text-amber-600 dark:text-amber-400" />
                </View>
                <View>
                  <Text className="font-bold text-sm text-foreground">Offline Payment Request</Text>
                  <Text className="text-xs text-muted-foreground">Bank Transfer (NEFT/IMPS), UPI, Cheque, Cash</Text>
                </View>
              </View>

              <View className={`w-5 h-5 rounded-full border items-center justify-center ${
                selectedMethod === 'OFFLINE' ? 'border-amber-500 bg-amber-500' : 'border-muted-foreground'
              }`}>
                {selectedMethod === 'OFFLINE' ? <Check size={12} className="text-primary-foreground" /> : null}
              </View>
            </TouchableOpacity>
          </View>

          {/* Primary Action Button */}
          <Button
            variant="default"
            size="lg"
            className="w-full flex-row items-center justify-center mt-2"
            disabled={isPaymentDisabled || isAmountInvalid || (selectedMethod === 'WALLET' && isWalletInsufficient) || isGlobalSettling || paymentState.isProcessing}
            loading={isGlobalSettling || paymentState.isProcessing}
            onPress={handleInitiatePayment}
            accessibilityRole="button"
            accessibilityLabel={`Confirm and Pay ₹${amountToPay.toLocaleString('en-IN')}`}
          >
            <Text className="font-bold text-base text-primary-foreground me-1">
              {selectedMethod === 'WALLET'
                ? `Pay ₹${amountToPay.toLocaleString('en-IN')} via Wallet`
                : selectedMethod === 'OFFLINE'
                ? `Proceed with Offline Payment (₹${amountToPay.toLocaleString('en-IN')})`
                : `Proceed to Razorpay (₹${amountToPay.toLocaleString('en-IN')})`}
            </Text>
            <Icon as={ChevronRight} size={18} className="text-primary-foreground" />
          </Button>

        </View>
      </BottomSheet>

      {/* Wallet Deduction Confirmation Modal */}
      <ConfirmationModal
        visible={showWalletConfirmModal}
        title="Confirm Wallet Payment"
        message={`Are you sure you want to deduct ₹${amountToPay.toLocaleString('en-IN')} from your Digital Wallet to settle Invoice #${invNo}? Your remaining wallet balance will become ₹${(walletBalance - amountToPay).toLocaleString('en-IN')}.`}
        confirmLabel="Confirm & Pay"
        cancelLabel="Cancel"
        variant="info"
        loading={isGlobalSettling || paymentState.isProcessing}
        onConfirm={handleConfirmWalletPayment}
        onCancel={() => setShowWalletConfirmModal(false)}
      />

      {/* Razorpay WebView Checkout Modal */}
      <RazorpayCheckoutModal
        visible={!!razorpayOptions}
        options={razorpayOptions}
        onSuccess={handleRazorpaySuccess}
        onDismiss={(reason) => {
          setRazorpayOptions(null);
          Alert.alert('Payment Cancelled', reason || 'Payment was cancelled by user.');
        }}
        onError={(err) => {
          setRazorpayOptions(null);
          Alert.alert('Payment Error', err.description || 'Razorpay checkout encountered an error.');
        }}
      />
    </>
  );
}

export default PaymentCheckoutSheet;

