import { runSoon } from '@/src/utils/runSoon';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ScrollView, RefreshControl, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/src/store/store';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/forms/TextInput';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { StatusBadge, getStatusVariant } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, Receipt, ShieldCheck, ChevronRight, AlertCircle, RotateCcw } from 'lucide-react-native';
import { fetchWalletBalance, createWalletRazorpayOrder, verifyWalletPayment, refundWalletToOriginalPayment, clearWalletError } from '../store/walletSlice';
import { useBillingSocket } from '@/src/features/billing/hooks/useBillingSocket';
import { RazorpayCheckoutModal } from '@/src/features/billing/components/RazorpayCheckoutModal';
import { WalletHeroCard } from '../components/WalletHeroCard';
import { FinancialTransactionCard } from '@/src/features/billing/components/FinancialTransactionCard';
import { useTranslation } from '@/src/utils/i18n';

export function WalletScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();

  const walletState = useSelector((state: RootState) => state.wallet);
  const balance = walletState?.balance || 0;
  const history: any[] = walletState?.transactionHistory || (walletState as any)?.transactions || [];
  const isLoading = walletState?.isLoading || (walletState as any)?.loading || false;
  const error = walletState?.error || null;
  const isGatewayReady = walletState?.isPaymentGatewayConfigured === true;
  const minimumRefundAmount = walletState?.minimumRefundAmount || 10;
  const refundEligibleBalance = Number(walletState?.refundEligibleBalance || 0);
  const refundableSources = walletState?.refundableSources || [];

  // Real-time socket listener
  useBillingSocket();

  // Top-Up State
  const [showTopUpSheet, setShowTopUpSheet] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | 'CUSTOM'>(1000);
  const [customAmountStr, setCustomAmountStr] = useState<string>('');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);
  const [showRefundSheet, setShowRefundSheet] = useState(false);
  const [selectedRefundPaymentId, setSelectedRefundPaymentId] = useState<string | null>(null);
  const [refundAmountStr, setRefundAmountStr] = useState('');
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [showRefundConfirmation, setShowRefundConfirmation] = useState(false);
  const [refundErrorMessage, setRefundErrorMessage] = useState<string | null>(null);
  const [refundSuccessMessage, setRefundSuccessMessage] = useState<string | null>(null);

  const loadWallet = useCallback(() => {
    dispatch(fetchWalletBalance());
  }, [dispatch]);

  useEffect(() => {
    const task = runSoon(() => {
        loadWallet();
      });
    return () => {
      task.cancel();
    };
  }, [loadWallet]);

  const handleRefresh = useCallback(() => {
    loadWallet();
  }, [loadWallet]);

  const pagination = walletState?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalRecords: history.length,
    limit: 10,
  };

  const handleLoadMore = useCallback(() => {
    if (pagination && pagination.currentPage < pagination.totalPages) {
      dispatch(fetchWalletBalance({ page: pagination.currentPage + 1, limit: pagination.limit || 10 }));
    }
  }, [dispatch, pagination]);

  // Derived top-up amount
  const topUpAmount = useMemo(() => {
    if (selectedPreset === 'CUSTOM') {
      const parsed = parseFloat(customAmountStr);
      return isNaN(parsed) || parsed <= 0 ? 0 : parsed;
    }
    return selectedPreset;
  }, [selectedPreset, customAmountStr]);

  const expectedBalance = balance + topUpAmount;
  const isTopUpInvalid = topUpAmount <= 0 || topUpAmount > 50000;

  const [razorpayOptions, setRazorpayOptions] = useState<any>(null);

  const selectedRefundSource = useMemo(
    () => refundableSources.find((source) => source.paymentId === selectedRefundPaymentId) || null,
    [refundableSources, selectedRefundPaymentId]
  );
  const selectedRefundMaximum = useMemo(
    () => Math.min(refundEligibleBalance, Number(selectedRefundSource?.availableAmount || 0)),
    [refundEligibleBalance, selectedRefundSource]
  );
  const refundAmount = useMemo(() => {
    const parsed = Number.parseFloat(refundAmountStr);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [refundAmountStr]);
  const isRefundInvalid = !selectedRefundSource
    || refundAmount < minimumRefundAmount
    || refundAmount > selectedRefundMaximum;

  const openRefundSheet = useCallback(() => {
    const firstSource = refundableSources[0];
    if (!firstSource || refundEligibleBalance < minimumRefundAmount) {
      Alert.alert(
        'No Refundable Balance',
        'Only unused wallet money added through a verified online top-up can be refunded. The minimum refund is ₹10.'
      );
      return;
    }
    setSelectedRefundPaymentId(firstSource.paymentId);
    setRefundAmountStr('');
    setRefundErrorMessage(null);
    setShowRefundSheet(true);
  }, [refundableSources, refundEligibleBalance, minimumRefundAmount]);

  const closeRefundSheet = useCallback(() => {
    if (isProcessingRefund) return;
    // A confirmation modal must never outlive a user-cancelled refund sheet.
    // This prevents a second modal from being left hidden beneath the sheet.
    setShowRefundConfirmation(false);
    setShowRefundSheet(false);
  }, [isProcessingRefund]);

  const executeWalletRefund = async () => {
    if (isRefundInvalid || !selectedRefundSource || isProcessingRefund) return;
    setIsProcessingRefund(true);
    try {
      await dispatch(refundWalletToOriginalPayment({
        paymentId: selectedRefundSource.paymentId,
        amount: refundAmount,
      })).unwrap();
      setShowRefundConfirmation(false);
      setShowRefundSheet(false);
      setRefundAmountStr('');
      dispatch(fetchWalletBalance());
      setRefundSuccessMessage(
        `₹${refundAmount.toLocaleString('en-IN')} has been sent to Razorpay for return to the original UPI or card account used for this wallet top-up.`
      );
    } catch (err: any) {
      setShowRefundConfirmation(false);
      setRefundErrorMessage(err?.message || err || 'Unable to start this wallet refund.');
    } finally {
      setIsProcessingRefund(false);
    }
  };

  const confirmWalletRefund = () => {
    if (isRefundInvalid || !selectedRefundSource || isProcessingRefund) return;
    // Modal stacking is unreliable on React Native Web. Unmount the refund
    // sheet before presenting the confirmation so it is always the top layer.
    setRefundErrorMessage(null);
    setShowRefundSheet(false);
    setShowRefundConfirmation(true);
  };

  // Handle Top-Up Execution via Razorpay Order Creation
  const handleProceedTopUp = async () => {
    if (isTopUpInvalid || isProcessingTopUp) return;
    setIsProcessingTopUp(true);

    try {
      // 1. Create Razorpay Top-Up Order on Backend
      const orderData: any = await dispatch(createWalletRazorpayOrder({ amount: topUpAmount })).unwrap();

      const keyId = orderData?.razorpayKeyId || orderData?.keyId || orderData?.key || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_TXAJ0OalVys0pH';
      const orderId = orderData?.orderId || orderData?.id || '';
      const paymentId = orderData?.paymentId || '';

      setIsProcessingTopUp(false);
      setRazorpayOptions({
        razorpayKeyId: keyId,
        orderId,
        paymentId,
        amount: topUpAmount,
        currency: orderData?.currency || 'INR',
        description: `Digital Wallet Top-Up (₹${topUpAmount})`,
      });
    } catch (err: any) {
      setIsProcessingTopUp(false);
      Alert.alert('Top-Up Order Failed', err?.message || err || 'Unable to create wallet recharge order.');
    }
  };

  const handleWalletRazorpaySuccess = async (payload: any) => {
    const currentPaymentId = payload?.paymentId || razorpayOptions?.paymentId;
    setRazorpayOptions(null);
    setIsProcessingTopUp(true);
    try {
      await dispatch(verifyWalletPayment({
        ...payload,
        paymentId: currentPaymentId,
        amount: topUpAmount,
      })).unwrap();
      setIsProcessingTopUp(false);
      setShowTopUpSheet(false);
      dispatch(fetchWalletBalance());
      Alert.alert('Top-Up Successful!', `₹${topUpAmount.toLocaleString('en-IN')} has been added to your Digital Wallet balance.`);
    } catch (err: any) {
      setIsProcessingTopUp(false);
      Alert.alert('Verification Failed', err?.message || err || 'Wallet top-up signature verification failed.');
    }
  };

  return (
    <ScreenShell
      title="Digital Wallet"
      subtitle="Instant maintenance top-up & statement history"
      iconName="Wallet"
      loading={isLoading && history.length === 0}
    >
      <View className="flex-1 bg-background">
        {/* Error Banner Container */}
        {error ? (
          <View className="mb-2">
            <ErrorBanner
              message={error}
              onDismiss={() => dispatch(clearWalletError())}
            />
          </View>
        ) : null}

        <View className="flex-1 px-4 pt-2">
          <PaginatedList<any>
            data={history}
            renderItem={(tx: any) => (
              <FinancialTransactionCard
                key={tx._id || tx.id || tx.transactionId}
                transaction={tx}
                className="mb-2.5"
              />
            )}
            pagination={pagination}
            onLoadMore={handleLoadMore}
            onRefresh={handleRefresh}
            loading={isLoading}
            ListHeaderComponent={
              <View className="mb-3">
                {/* Gateway unconfigured notice */}
                {!isGatewayReady && !isLoading ? (
                  <View className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-3 flex-row items-center">
                    <Icon as={AlertCircle} size={16} className="text-amber-600 dark:text-amber-400 me-2.5 shrink-0" />
                    <Text className="text-xs text-amber-900 dark:text-amber-200 font-medium flex-1">
                      Online Top-Up Disabled: Community administrator has not configured Razorpay in the Integration Hub.
                    </Text>
                  </View>
                ) : null}

                {/* Authoritative Wallet Balance Hero Card */}
                <WalletHeroCard
                  balance={balance}
                  onTopUpPress={() => setShowTopUpSheet(true)}
                  onRefundPress={openRefundSheet}
                  refundDisabled={!isGatewayReady || refundEligibleBalance < minimumRefundAmount || refundableSources.length === 0}
                />

                {/* Transaction Statement Section Header */}
                <View className="flex-row items-center justify-between px-0.5">
                  <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Transaction Statement ({history.length})
                  </Text>
                </View>
              </View>
            }
            emptyIcon="Receipt"
            emptyTitle="No Wallet Transactions Yet"
            emptySubtitle="No wallet transactions yet."
            contentContainerClassName="px-4 pt-3 pb-28"
          />
        </View>

        {/* Instant Top-Up Bottom Sheet */}
        <BottomSheet
          visible={showTopUpSheet}
          onClose={() => setShowTopUpSheet(false)}
          title="Add Money to Digital Wallet"
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="w-full">
            <View className="py-2 gap-4">
              {!isGatewayReady ? (
                <View className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <Text className="text-xs text-amber-900 dark:text-amber-200 font-semibold">
                    Online Top-Up Unavailable: Community management has not configured an online merchant account.
                  </Text>
                </View>
              ) : null}

              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Select Top-Up Amount
              </Text>

              {/* Quick Denomination Presets */}
              <View className="flex-row gap-2.5">
                {[500, 1000, 2000].map((preset) => {
                  const isSelected = selectedPreset === preset;
                  return (
                    <Button
                      key={preset}
                      variant={isSelected ? 'default' : 'outline'}
                      onPress={() => setSelectedPreset(preset)}
                      className="flex-1 h-12 rounded-xl"
                    >
                      <Text className={`font-extrabold text-sm ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
                        + ₹{preset.toLocaleString('en-IN')}
                      </Text>
                    </Button>
                  );
                })}
              </View>

              {/* Custom Top-Up Preset Option */}
              <View className="gap-2">
                <Button
                  variant={selectedPreset === 'CUSTOM' ? 'default' : 'outline'}
                  onPress={() => setSelectedPreset('CUSTOM')}
                  className="w-full h-11 rounded-xl"
                >
                  <Text className={`font-bold text-xs ${selectedPreset === 'CUSTOM' ? 'text-primary-foreground' : 'text-foreground'}`}>
                    Enter Custom Top-Up Amount
                  </Text>
                </Button>

                {selectedPreset === 'CUSTOM' ? (
                  <TextInput
                    label="Custom Amount (₹)"
                    value={customAmountStr}
                    onChangeText={setCustomAmountStr}
                    placeholder="Enter amount (e.g. 1500)"
                    keyboardType="numeric"
                    inputClassName="font-bold text-base"
                  />
                ) : null}
              </View>

              {/* Expected Balance Preview */}
              <View className="bg-muted/40 border border-border/60 rounded-xl p-3.5 flex-row items-center justify-between">
                <View className="flex-1 min-w-0 me-2">
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>{t('top_up_amount', 'Top-Up Amount')}</Text>
                  <Text className="text-base font-extrabold text-status-success">
                    + ₹{topUpAmount.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View className="items-end shrink-0">
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>{t('balance_after_top_up', 'Balance After Top-Up')}</Text>
                  <Text className="text-base font-bold text-foreground">
                    ₹{expectedBalance.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              {/* Submit Top-Up Button */}
              <Button
                variant="default"
                size="lg"
                className="w-full flex-row items-center justify-center bg-status-success active:bg-status-success/90 mt-2"
                disabled={isTopUpInvalid || isProcessingTopUp || !isGatewayReady}
                loading={isProcessingTopUp}
                onPress={handleProceedTopUp}
                accessibilityRole="button"
                accessibilityLabel={`Proceed to Top-Up ₹${topUpAmount.toLocaleString('en-IN')} via Razorpay`}
              >
                <Text className="font-bold text-base text-primary-foreground me-1" numberOfLines={1}>
                  {isGatewayReady
                    ? `${t('proceed_to_top_up', 'Proceed to Top-Up')} • ₹${topUpAmount.toLocaleString('en-IN')}`
                    : t('gateway_not_configured', 'Gateway Not Configured')}
                </Text>
                {isGatewayReady ? <Icon as={ChevronRight} size={18} className="text-primary-foreground shrink-0" /> : null}
              </Button>
            </View>
          </KeyboardAvoidingView>
        </BottomSheet>

        {/* Refund always returns via Razorpay to the original payment account. */}
        <BottomSheet
          visible={showRefundSheet}
          onClose={closeRefundSheet}
          title={t('refund_wallet_balance', 'Refund Wallet Balance')}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="w-full">
            <View className="py-2 gap-4">
              {refundErrorMessage ? (
                <ErrorBanner
                  title={t('refund_unavailable', 'Refund Unavailable')}
                  message={refundErrorMessage}
                  onDismiss={() => setRefundErrorMessage(null)}
                />
              ) : null}

              <View className="bg-primary/10 border border-primary/20 rounded-2xl p-3.5 flex-row items-start">
                <Icon as={RotateCcw} size={18} className="text-primary mt-0.5 me-2.5 shrink-0" />
                <View className="flex-1">
                  <Text className="font-bold text-sm text-foreground mb-1">{t('refund_to_paid_account', 'Refund to your paid account')}</Text>
                  <Text className="text-xs leading-5 text-muted-foreground">
                    {t('refund_policy_notice', `Refunds go only to the original UPI or card account used for the selected wallet top-up. Minimum refund: ₹${minimumRefundAmount}.`)}
                  </Text>
                </View>
              </View>

              <View className="bg-muted/40 border border-border/60 rounded-xl p-3 flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground flex-1 min-w-0 me-2" numberOfLines={1}>{t('available_to_refund_now', 'Available to refund now')}</Text>
                <Text className="text-base font-extrabold text-foreground shrink-0">₹{refundEligibleBalance.toLocaleString('en-IN')}</Text>
              </View>

              <View className="gap-2">
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('choose_original_top_up', 'Choose original top-up')}</Text>
                {refundableSources.map((source) => {
                  const isSelected = selectedRefundPaymentId === source.paymentId;
                  const paidDate = source.paidAt
                    ? new Date(source.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : t('verified_top_up', 'Verified top-up');
                  return (
                    <Button
                      key={source.paymentId}
                      variant={isSelected ? 'navy' : 'outline'}
                      size="default"
                      onPress={() => setSelectedRefundPaymentId(source.paymentId)}
                      className="w-full h-auto min-h-14 px-4"
                      accessibilityLabel={`Select wallet top-up of ₹${source.availableAmount.toLocaleString('en-IN')}`}
                    >
                      <View className="flex-1 items-start">
                        <Text className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-foreground'}`} numberOfLines={1}>
                          {t('wallet_top_up', 'Wallet top-up')} • ₹{source.availableAmount.toLocaleString('en-IN')}
                        </Text>
                        <Text className={`text-xs mt-0.5 ${isSelected ? 'text-white/75' : 'text-muted-foreground'}`} numberOfLines={1}>
                          {paidDate} • {t('original_payment_account', 'Original payment account')}
                        </Text>
                      </View>
                    </Button>
                  );
                })}
              </View>

              <TextInput
                label={t('refund_amount_inr', 'Refund amount (₹)')}
                value={refundAmountStr}
                onChangeText={setRefundAmountStr}
                placeholder={`Enter ₹${minimumRefundAmount} to ₹${selectedRefundMaximum.toLocaleString('en-IN')}`}
                keyboardType="decimal-pad"
                helperText={`You can refund up to ₹${selectedRefundMaximum.toLocaleString('en-IN')} from this top-up.`}
                inputClassName="font-bold text-base"
              />

              <Button
                variant="navy"
                size="lg"
                className="w-full mt-1"
                leftIcon={RotateCcw}
                disabled={isRefundInvalid || isProcessingRefund}
                loading={isProcessingRefund}
                onPress={confirmWalletRefund}
                accessibilityLabel={`Refund ₹${refundAmount || 0} to original payment account`}
              >
                <Text className="font-bold text-base text-white">
                  {isProcessingRefund ? t('starting_refund', 'Starting Refund…') : t('refund_to_paid_account', 'Refund to Paid Account')}
                </Text>
              </Button>
            </View>
          </KeyboardAvoidingView>
        </BottomSheet>

        {/* Razorpay WebView Checkout Modal for Top-Up */}
        <RazorpayCheckoutModal
          visible={!!razorpayOptions}
          options={razorpayOptions}
          onSuccess={handleWalletRazorpaySuccess}
          onDismiss={(reason) => {
            setRazorpayOptions(null);
            Alert.alert(t('top_up_cancelled', 'Top-Up Cancelled'), reason || 'Wallet top-up was cancelled by user.');
          }}
          onError={(err) => {
            setRazorpayOptions(null);
            Alert.alert(t('top_up_error', 'Top-Up Error'), err.description || 'Razorpay checkout encountered an error.');
          }}
        />

        <ConfirmationModal
          visible={showRefundConfirmation && !showRefundSheet}
          title={t('confirm_wallet_refund', 'Confirm Wallet Refund')}
          message={`Refund ₹${refundAmount.toLocaleString('en-IN')} to the original UPI or card account used for this wallet top-up? This cannot be undone after Razorpay accepts it.`}
          confirmLabel={`${t('refund', 'Refund')} ₹${refundAmount.toLocaleString('en-IN')}`}
          cancelLabel={t('keep_balance', 'Keep Balance')}
          variant="warning"
          loading={isProcessingRefund}
          onConfirm={executeWalletRefund}
          onCancel={() => {
            setShowRefundConfirmation(false);
            setShowRefundSheet(true);
          }}
        />

        <ConfirmationModal
          visible={Boolean(refundSuccessMessage)}
          title={t('refund_initiated', 'Refund Initiated')}
          message={refundSuccessMessage || ''}
          confirmLabel={t('done', 'Done')}
          cancelLabel={t('close', 'Close')}
          variant="success"
          onConfirm={() => setRefundSuccessMessage(null)}
          onCancel={() => setRefundSuccessMessage(null)}
        />
      </View>
    </ScreenShell>
  );
}

export default WalletScreen;
