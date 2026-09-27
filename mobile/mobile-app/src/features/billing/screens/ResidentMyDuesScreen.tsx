import React, { useEffect, useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/common/Button';
import { StatusBadge, getStatusVariant } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useTranslation } from '@/src/utils/i18n';
import { Wallet, CreditCard, Receipt, ChevronRight, CheckCircle2, ShieldAlert, Clock, Landmark, Zap, QrCode } from 'lucide-react-native';
import { useBilling } from '../hooks/useBilling';
import { useBillingSocket } from '../hooks/useBillingSocket';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { billingService } from '../services/billingService';
import paymentService from '../../payment/services/paymentService';
import { UnitDueBreakdown, InvoiceStatus, Invoice } from '../types';
import { PaymentCheckoutSheet } from '../components/PaymentCheckoutSheet';
import { OfflineSettleSheet } from '../components/OfflineSettleSheet';
import { PaymentReceiptModal } from '../components/PaymentReceiptModal';
import { InvoiceQRModal } from '../components/InvoiceQRModal';

export function ResidentMyDuesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const residentVillaNumber =
    (user as any)?.villaNumber ||
    (user as any)?.activeVillaNumber ||
    (user as any)?.unitNumber ||
    '';

  const {
    activeDues,
    walletBalance,
    loadingStates,
    error,
    loadResidentDues,
    resetBillingError,
  } = useBilling();

  // Listen silently for background Socket.io billing & wallet events
  useBillingSocket();

  // Modal sheet state
  const [checkoutInvoice, setCheckoutInvoice] = useState<Invoice | null>(null);
  const [offlineInvoice, setOfflineInvoice] = useState<Invoice | null>(null);
  const [receiptInvoice, setReceiptInvoice] = useState<any | null>(null);
  const [receiptAmount, setReceiptAmount] = useState<number | undefined>(undefined);
  const [receiptMethod, setReceiptMethod] = useState<string | undefined>(undefined);
  const [qrInvoice, setQrInvoice] = useState<Invoice | null>(null);

  // Load resident dues & wallet balance on screen mount
  useEffect(() => {
    loadResidentDues();
  }, [loadResidentDues]);

  const handleRefresh = useCallback(() => {
    loadResidentDues();
  }, [loadResidentDues]);

  const totalPortfolioDue = activeDues?.totalPortfolioDue || 0;
  const duesList: UnitDueBreakdown[] = activeDues?.unitBreakdown || [];

  // Check for any invoice pending admin verification
  const clearingInvoice = duesList.find((inv) => inv.status === ('VERIFICATION_PENDING' as InvoiceStatus));
  const isClearing = !!clearingInvoice;
  const clearingAmount = (clearingInvoice as any)?.offlineAmount || clearingInvoice?.totalDue || 0;
  const clearingRef = (clearingInvoice as any)?.offlineReference || 'Cheque';

  const handleViewInvoiceDetails = (invoiceId: string) => {
    if (!invoiceId) return;
    router.push(`/(resident)/billing/invoice/${invoiceId}` as any);
  };

  const handleOpenWalletScreen = () => {
    router.push('/(resident)/billing/wallet' as any);
  };

  const handleOpenPaymentHistory = () => {
    router.push('/(resident)/billing/history' as any);
  };

  const findFirstUnpaidInvoice = (): Invoice | null => {
    const firstDue = duesList.find(
      (inv) => ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.status) || inv.totalDue > 0
    );
    if (!firstDue) return null;
    const invId = firstDue.invoiceId || (firstDue as any)._id;
    return {
      _id: invId,
      invoiceNumber: firstDue.invoiceNumber || invId,
      unitNumber: firstDue.unitNumber || residentVillaNumber,
      assessmentName: firstDue.assessmentName,
      billingPeriodString: firstDue.billingPeriodString,
      totalDue: firstDue.totalDue,
      paidAmount: firstDue.paidAmount ?? 0,
      outstandingAmount: firstDue.outstandingAmount ?? Math.max(0, firstDue.totalDue - (firstDue.paidAmount ?? 0)),
      status: firstDue.status,
    } as Invoice;
  };

  const handlePayNowPrimary = () => {
    const targetInv = findFirstUnpaidInvoice();
    if (targetInv) {
      setCheckoutInvoice(targetInv);
    }
  };

  const handlePayOfflinePrimary = () => {
    const targetInv = findFirstUnpaidInvoice();
    if (targetInv) {
      setOfflineInvoice(targetInv);
    }
  };

  return (
    <ScreenShell
      title={t('feature_billing_my_dues_name', 'Personal Dues')}
      subtitle={t('feature_billing_my_dues_sub', 'Manage & settle your unit maintenance liabilities')}
      iconName="CreditCard"
      loading={loadingStates.fetchDues && duesList.length === 0}
    >
      <View className="flex-1 bg-background">
        {/* Error Banner Container */}
        {error ? (
          <View className="p-4">
            <ErrorBanner
              message={error}
              onDismiss={() => {
                resetBillingError();
              }}
            />
          </View>
        ) : null}

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: totalPortfolioDue > 0 ? 150 : 120 }}
          refreshControl={
            <RefreshControl
              refreshing={loadingStates.fetchDues}
              onRefresh={handleRefresh}
              tintColor="#6366f1"
            />
          }
        >
          {/* Portfolio Liability Hero Banner */}
          <View className="p-4 pb-2">
            <View className="bg-card border border-border rounded-2xl p-5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Total Outstanding Dues
                </Text>
                <View className="flex-row items-center bg-primary/10 px-2.5 py-1 rounded-full">
                  <Icon as={CreditCard} size={12} className="text-primary me-1" />
                  <Text className="text-xs font-semibold text-primary">Active Portfolio</Text>
                </View>
              </View>

              <Text className="text-3xl font-extrabold text-foreground tracking-tight mb-4">
                ₹{totalPortfolioDue.toLocaleString('en-IN')}
              </Text>

              {/* Digital Wallet Pill Widget */}
              <View className="flex-row items-center justify-between bg-muted/50 border border-border/60 rounded-xl p-3">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-lg bg-emerald-500/10 items-center justify-center me-2.5">
                    <Icon as={Wallet} size={18} className="text-emerald-600 dark:text-emerald-400" />
                  </View>
                  <View>
                    <Text className="text-xs text-muted-foreground font-medium">Digital Wallet</Text>
                    <Text className="text-sm font-bold text-foreground">
                      ₹{walletBalance.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                <Button
                  variant="outline"
                  size="sm"
                  onPress={handleOpenWalletScreen}
                  accessibilityLabel="Manage Digital Wallet"
                  accessibilityRole="button"
                >
                  View Wallet
                </Button>
              </View>

              {/* Payment & Invoice History Button */}
              <Pressable
                onPress={handleOpenPaymentHistory}
                className="mt-3 flex-row items-center justify-between bg-muted/40 border border-border/50 rounded-xl p-3 active:bg-muted/70"
                accessibilityRole="button"
                accessibilityLabel="View Payment and Invoice History"
              >
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center me-2.5">
                    <Icon as={Receipt} size={18} className="text-primary" />
                  </View>
                  <View>
                    <Text className="text-xs font-bold text-foreground">Payment & Invoice History</Text>
                    <Text className="text-xs text-muted-foreground">View past receipts & settled fees</Text>
                  </View>
                </View>
                <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
              </Pressable>
            </View>
          </View>

          {/* Pending Verification Clearing Banner */}
          {isClearing ? (
            <View className="px-4 py-2">
              <View className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex-row items-center">
                <Icon as={Clock} size={20} className="text-blue-600 dark:text-blue-400 me-3" />
                <View className="flex-1">
                  <Text className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    Payment Clearance In Progress
                  </Text>
                  <Text className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                    Payment of ₹{clearingAmount.toLocaleString('en-IN')} is clearing via Reference {clearingRef}. Awaiting admin verification.
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Active Maintenance Dues Section */}
          <View className="px-4 pt-2">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Maintenance Invoices ({duesList.length})
              </Text>
            </View>

            {duesList.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All Dues Settled!"
                description="No outstanding invoices."
              />
            ) : (
              <View className="gap-3">
                {duesList.map((item) => {
                  const invoiceId = item.invoiceId || (item as any)._id;
                  const invNo = item.invoiceNumber || invoiceId || '—';
                  const unitStr = item.unitNumber ? `Villa ${item.unitNumber}` : 'Villa Unit';
                  const periodStr = item.billingPeriodString || 'Current Month';
                  const totalDue = item.totalDue || 0;
                  const paidAmount = item.paidAmount || 0;
                  const remainingDue = item.outstandingAmount !== undefined
                    ? item.outstandingAmount
                    : Math.max(0, totalDue - paidAmount);
                  const formattedDue = `₹${remainingDue.toLocaleString('en-IN')}`;

                  const statusVariant = getStatusVariant(item.status);
                  const statusLabel = item.status ? item.status.replace(/_/g, ' ') : 'UNPAID';
                  const isPendingVerification = item.status === ('VERIFICATION_PENDING' as InvoiceStatus);

                  const mappedInvoice: Invoice = {
                    _id: invoiceId,
                    invoiceNumber: invNo,
                    unitNumber: item.unitNumber || residentVillaNumber,
                    assessmentName: item.assessmentName,
                    billingPeriodString: periodStr,
                    totalDue,
                    paidAmount,
                    outstandingAmount: remainingDue,
                    status: item.status,
                  } as Invoice;

                  return (
                    <Pressable
                      key={invoiceId}
                      onPress={() => handleViewInvoiceDetails(invoiceId)}
                      accessibilityRole="button"
                      accessibilityLabel={`View Invoice ${invNo} for ${unitStr}`}
                      className="bg-card border border-border rounded-xl p-4 active:bg-muted/40"
                    >
                      <View className="flex-row items-start justify-between mb-3">
                        <View className="flex-row items-center flex-1 me-2">
                          <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center me-3">
                            <Icon as={Receipt} size={20} className="text-primary" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-foreground font-bold text-base truncate">
                              {item.assessmentName || 'Maintenance Assessment'}
                            </Text>
                            <Text className="text-muted-foreground text-xs font-medium mt-0.5">
                              #{invNo} • {unitStr} • {periodStr}
                            </Text>
                          </View>
                        </View>

                        <StatusBadge label={statusLabel} variant={statusVariant} dot />
                      </View>

                      <View className="border-t border-border/50 pt-3 flex-row items-center justify-between">
                        <View>
                          <Text className="text-xs text-muted-foreground">Remaining Liability</Text>
                          <Text className="text-lg font-extrabold text-foreground">
                            {formattedDue}
                          </Text>
                        </View>

                        <View className="flex-row items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onPress={() => setQrInvoice(mappedInvoice)}
                            accessibilityLabel={`Show QR for invoice ${invNo}`}
                            className="px-2.5"
                          >
                            <Icon as={QrCode} size={14} className="text-primary me-1" />
                            <Text className="text-xs font-semibold text-primary">QR</Text>
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => handleViewInvoiceDetails(invoiceId)}
                          >
                            Details
                          </Button>

                          {!isPendingVerification ? (
                            <Button
                              variant="default"
                              size="sm"
                              onPress={() => setCheckoutInvoice(mappedInvoice)}
                            >
                              Pay Now
                            </Button>
                          ) : (
                            <View className="bg-blue-500/10 px-2.5 py-1 rounded-lg">
                              <Text className="text-blue-600 dark:text-blue-400 text-xs font-semibold">
                                Pending
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Tenant Compliance Arrears Section */}
          {activeDues?.secondaryCompliance && activeDues.secondaryCompliance.length > 0 ? (
            <View className="px-4 pt-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Tenant Arrears ({activeDues.secondaryCompliance.length})
                </Text>
              </View>

              <View className="bg-card border border-border rounded-xl p-4 gap-3">
                {activeDues.secondaryCompliance.map((arrear: any, idx: number) => (
                  <View key={arrear._id || idx} className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 me-2">
                      <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center me-3">
                        <Text className="font-bold text-primary text-sm">
                          {(arrear.tenantName || 'T').charAt(0)}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="font-bold text-sm text-foreground">{arrear.tenantName}</Text>
                        <Text className="text-xs text-muted-foreground">{arrear.unit || arrear.unitNumber || 'Leased Unit'}</Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <Text className="font-extrabold text-sm text-foreground">
                        ₹{(arrear.amountDue || arrear.amount || 0).toLocaleString('en-IN')}
                      </Text>
                      <StatusBadge label={arrear.status || 'UNPAID'} variant="danger" />
                    </View>
                  </View>
                ))}

                <View className="border-t border-border/50 pt-2.5 flex-row items-center">
                  <Icon as={ShieldAlert} size={14} className="text-amber-600 dark:text-amber-400 me-2" />
                  <Text className="text-xs text-muted-foreground flex-1">
                    As the owner, you may be held liable if tenant dues remain unpaid beyond 30 days.
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* Payment Checkout Sheet */}
        <PaymentCheckoutSheet
          visible={!!checkoutInvoice}
          invoice={checkoutInvoice}
          onClose={() => setCheckoutInvoice(null)}
          onOpenOfflineSheet={(inv, amount) => {
            setCheckoutInvoice(null);
            setOfflineInvoice({
              ...inv,
              totalDue: amount || inv.totalDue || inv.amount || 0,
              outstandingAmount: amount || inv.outstandingAmount || inv.totalDue || 0,
            });
          }}
          onPaymentSuccess={(result: any, amountPaid?: number, paymentMethod?: string) => {
            loadResidentDues();
            const serverInv = result?.invoice || result?.data?.invoice || result?.data || result;
            const authoritativeStatus = serverInv?.status || result?.status || 'PAID';
            const paid = serverInv?.paidAmount ?? (amountPaid !== undefined && amountPaid !== null ? Number(amountPaid) : checkoutInvoice?.paidAmount || 0);
            const remaining = serverInv?.outstandingAmount ?? 0;
            const total = serverInv?.totalDue ?? checkoutInvoice?.totalDue ?? (paid + remaining);

            const receiptData = {
              ...(checkoutInvoice || {}),
              ...serverInv,
              ...(result || {}),
              invoiceNumber: serverInv?.invoiceNumber || result?.invoiceNumber || checkoutInvoice?.invoiceNumber || checkoutInvoice?._id,
              unitNumber: serverInv?.unitNumber || result?.unitNumber || checkoutInvoice?.unitNumber || residentVillaNumber,
              assessmentName: serverInv?.assessmentName || result?.assessmentName || checkoutInvoice?.assessmentName,
              totalDue: total,
              totalAmount: total,
              paidAmount: paid,
              amountPaid: amountPaid || paid,
              outstandingAmount: remaining,
              status: authoritativeStatus as any,
              paymentMethod: paymentMethod || result?.paymentMethod || 'Online Payment',
            };
            setReceiptInvoice(receiptData);
            setReceiptAmount(amountPaid || paid);
            setReceiptMethod(paymentMethod || 'Online Payment');
          }}
        />

        {/* Offline Settlement Sheet */}
        <OfflineSettleSheet
          visible={!!offlineInvoice}
          invoice={offlineInvoice}
          initialAmount={(offlineInvoice as any)?.outstandingAmount ?? offlineInvoice?.totalDue}
          onClose={() => setOfflineInvoice(null)}
          onSettlementSubmitted={(result) => {
            loadResidentDues();
          }}
        />

        {/* Post-Payment Invoice Receipt & PDF Modal */}
        <PaymentReceiptModal
          visible={!!receiptInvoice}
          invoice={receiptInvoice}
          amountPaid={receiptAmount}
          paymentMethod={receiptMethod}
          onClose={() => setReceiptInvoice(null)}
        />

        {/* Invoice QR Pass Modal */}
        <InvoiceQRModal
          visible={!!qrInvoice}
          invoice={qrInvoice}
          onClose={() => setQrInvoice(null)}
        />
      </View>
    </ScreenShell>
  );
}

export default ResidentMyDuesScreen;

