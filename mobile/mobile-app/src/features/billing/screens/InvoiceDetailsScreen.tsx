import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, RefreshControl, Share, TouchableOpacity, Image as RNImage, Modal, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { StatusBadge, getStatusVariant } from '@/components/ui/StatusBadge';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { SkeletonLoader } from '@/components/feedback/SkeletonLoader';
import { ProgressBar } from '@/components/common/ProgressBar';
import {
  Receipt,
  Calendar,
  Clock,
  ChevronRight,
  ShieldAlert,
  Download,
  Share2,
  FileText,
  QrCode,
  Banknote,
  Landmark,
  CreditCard,
  FileSpreadsheet,
  ExternalLink,
  Eye,
  X,
  AlertCircle,
} from 'lucide-react-native';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useBilling } from '../hooks/useBilling';
import { useBillingSocket } from '../hooks/useBillingSocket';
import { billingService } from '../services/billingService';
import paymentService from '../../payment/services/paymentService';
import { InvoiceStatus, Invoice } from '../types';
import { PaymentCheckoutSheet } from '../components/PaymentCheckoutSheet';
import { OfflineSettleSheet } from '../components/OfflineSettleSheet';
import { PaymentReceiptModal } from '../components/PaymentReceiptModal';
import { InvoiceQRModal } from '../components/InvoiceQRModal';
import { generateInvoiceHtml, exportInvoiceHtmlDocument } from '../utils/invoicePdfUtility';
import { getImageUrl } from '@/src/utils/imageUrl';

const getMethodMeta = (method?: string) => {
  const m = (method || 'BANK_TRANSFER').toUpperCase();
  switch (m) {
    case 'CHEQUE':
      return {
        label: 'Cheque Payment',
        icon: FileSpreadsheet,
        badgeBg: 'bg-blue-500/10 border-blue-500/30',
        textColor: 'text-blue-900 dark:text-blue-200',
        subTextColor: 'text-blue-800 dark:text-blue-300',
        iconColor: 'text-blue-600 dark:text-blue-400',
        refLabel: 'Cheque #',
      };
    case 'UPI':
      return {
        label: 'UPI / QR Payment',
        icon: QrCode,
        badgeBg: 'bg-purple-500/10 border-purple-500/30',
        textColor: 'text-purple-900 dark:text-purple-200',
        subTextColor: 'text-purple-800 dark:text-purple-300',
        iconColor: 'text-purple-600 dark:text-purple-400',
        refLabel: 'UPI / UTR Ref',
      };
    case 'DEMAND_DRAFT':
      return {
        label: 'Demand Draft (DD)',
        icon: CreditCard,
        badgeBg: 'bg-indigo-500/10 border-indigo-500/30',
        textColor: 'text-indigo-900 dark:text-indigo-200',
        subTextColor: 'text-indigo-800 dark:text-indigo-300',
        iconColor: 'text-indigo-600 dark:text-indigo-400',
        refLabel: 'DD Number',
      };
    case 'CASH':
      return {
        label: 'Cash Payment',
        icon: Banknote,
        badgeBg: 'bg-emerald-500/10 border-emerald-500/30',
        textColor: 'text-emerald-900 dark:text-emerald-200',
        subTextColor: 'text-emerald-800 dark:text-emerald-300',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        refLabel: 'Cash Receipt Ref',
      };
    case 'BANK_TRANSFER':
    case 'NEFT':
    default:
      return {
        label: 'Bank Transfer (NEFT/IMPS)',
        icon: Landmark,
        badgeBg: 'bg-amber-500/10 border-amber-500/30',
        textColor: 'text-amber-900 dark:text-amber-200',
        subTextColor: 'text-amber-800 dark:text-amber-300',
        iconColor: 'text-amber-600 dark:text-amber-400',
        refLabel: 'Transaction Reference (UTR)',
      };
  }
};

const isImageProof = (url?: string | null) => {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return (
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.png') ||
    clean.endsWith('.webp') ||
    clean.endsWith('.gif')
  );
};

export function InvoiceDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const invoiceId = params?.id || '';

  const [showCheckout, setShowCheckout] = useState(false);
  const [showOfflineSheet, setShowOfflineSheet] = useState(false);
  const [offlineAmount, setOfflineAmount] = useState<number | undefined>(undefined);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [fallbackInvoice, setFallbackInvoice] = useState<Invoice | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [receiptInvoice, setReceiptInvoice] = useState<any | null>(null);
  const [receiptAmount, setReceiptAmount] = useState<number | undefined>(undefined);
  const [receiptMethod, setReceiptMethod] = useState<string | undefined>(undefined);

  const {
    activeDues,
    invoicesList,
    loadingStates,
    error,
    loadResidentDues,
    resetBillingError,
  } = useBilling();

  // Socket listener for real-time invoice status updates
  useBillingSocket();

  useEffect(() => {
    loadResidentDues();
  }, [loadResidentDues]);

  // Find invoice from Redux state
  const reduxInvoice: Invoice | null = useMemo(() => {
    if (!invoiceId) return null;

    // 1. Search in invoicesList
    const inGrid = invoicesList.find(
      (inv) =>
        String(inv._id || (inv as any).id || '') === String(invoiceId) ||
        String(inv.invoiceNumber || '') === String(invoiceId)
    );
    if (inGrid) return inGrid;

    // 2. Search in activeDues.recentInvoices
    const recent = activeDues?.recentInvoices || [];
    const inRecent = recent.find(
      (inv) =>
        String(inv._id || (inv as any).id || '') === String(invoiceId) ||
        String(inv.invoiceNumber || '') === String(invoiceId)
    );
    if (inRecent) return inRecent;

    // 3. Search in activeDues.unitBreakdown
    const breakdown = activeDues?.unitBreakdown || [];
    const inBreakdown = breakdown.find(
      (inv) =>
        String(inv.invoiceId || inv._id || (inv as any).id || '') === String(invoiceId) ||
        String(inv.invoiceNumber || '') === String(invoiceId)
    );
    if (inBreakdown) {
      const totalDue = inBreakdown.totalDue || 0;
      const paidAmount = inBreakdown.paidAmount || 0;
      const outstandingAmount = inBreakdown.outstandingAmount ?? Math.max(0, totalDue - paidAmount);
      return {
        _id: inBreakdown.invoiceId,
        invoiceNumber: inBreakdown.invoiceNumber,
        unitNumber: inBreakdown.unitNumber,
        totalDue,
        paidAmount,
        outstandingAmount,
        amount: totalDue,
        billingPeriodString: inBreakdown.billingPeriodString,
        status: inBreakdown.status,
        dueDate: inBreakdown.dueDate,
      };
    }

    return null;
  }, [invoiceId, invoicesList, activeDues]);

  // Always fetch fresh single invoice from backend on mount or invoiceId change
  useEffect(() => {
    if (!invoiceId) return;
    let isMounted = true;

    const fetchAuthoritativeInvoice = async () => {
      try {
        setFallbackLoading(true);
        const data = await billingService.getInvoiceById(invoiceId);
        if (data && isMounted) {
          setFallbackInvoice(data);
        }

        // Active session recovery check
        const activeSession = await paymentService.getActivePaymentSession('Invoice', invoiceId);
        if (activeSession && data) {
          if (data.status === 'PAID' || data.status === 'PARTIALLY_PAID') {
            await paymentService.clearActivePaymentSession('Invoice', invoiceId);
          }
        }
      } catch (err) {
        console.log('Direct invoice fetch completed or unavailable', err);
      } finally {
        if (isMounted) {
          setFallbackLoading(false);
        }
      }
    };

    fetchAuthoritativeInvoice();
    return () => {
      isMounted = false;
    };
  }, [invoiceId]);

  // Server invoice takes strict precedence over Redux dues summary
  const invoice = fallbackInvoice || reduxInvoice;
  const { user } = useAuth();

  const dynamicCommunityName = useMemo(() => {
    return (
      (invoice as any)?.communityName ||
      (invoice as any)?.orgName ||
      (invoice as any)?.organizationName ||
      (invoice as any)?.organization?.name ||
      (user as any)?.organizationName ||
      (user as any)?.activeOrganizationName ||
      (user as any)?.orgName ||
      (user as any)?.communityName ||
      (user as any)?.communityOrg ||
      (user as any)?.organization?.name ||
      'Community Workspace'
    );
  }, [invoice, user]);

  const handleRefresh = useCallback(() => {
    loadResidentDues();
    if (invoiceId) {
      billingService.getInvoiceById(invoiceId).then(setFallbackInvoice).catch(() => {});
    }
  }, [loadResidentDues, invoiceId]);

  // Export / Download PDF HTML statement
  const handleExportPdf = async (action: 'download' | 'print' = 'download') => {
    if (!invoice) return;
    try {
      setIsExporting(true);
      const invNum = invoice.invoiceNumber || invoice._id || 'INVOICE';
      const html = generateInvoiceHtml(invoice, {
        communityName: dynamicCommunityName,
        residentName: invoice.targetUser || (user as any)?.name || (user as any)?.fullName || 'Resident Owner',
      });

      await exportInvoiceHtmlDocument(
        html,
        `Invoice_${invNum}.html`,
        `Invoice Statement #${invNum}`,
        { action }
      );
    } catch (err) {
      console.error('Failed to export invoice document', err);
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = (loadingStates.fetchDues && !invoice) || (fallbackLoading && !invoice);

  if (!invoice && !isLoading) {
    return (
      <ScreenShell title="Invoice Details" iconName="Receipt">
        <View className="flex-1 items-center justify-center p-6 bg-background">
          <EmptyState
            icon={ShieldAlert}
            title="Invoice Not Found"
            description="The requested maintenance invoice could not be located or has been archived."
            actionLabel="Back to My Dues"
            onAction={() => router.back()}
          />
        </View>
      </ScreenShell>
    );
  }

  const invNo = invoice?.invoiceNumber || invoice?._id || '—';
  const unitStr = invoice?.unitNumber ? `Villa ${invoice.unitNumber}` : 'Villa Unit';
  const periodStr = invoice?.billingPeriodString || 'Current Billing Cycle';
  const residentStr = invoice?.targetUser || 'Resident Owner';
  const dueDateStr = invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '—';
  const invoiceDateStr = invoice?.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString('en-IN')
    : '—';

  // Itemized Charge breakdown figures
  const snapshot = (invoice as any)?.financialSnapshot || (invoice as any)?.snapshot || {};
  const currentCharge = snapshot.currentCharge ?? (invoice as any)?.currentCharge ?? invoice?.amount ?? invoice?.totalDue ?? 0;
  const previousOutstanding = snapshot.previousOutstanding ?? (invoice as any)?.previousOutstanding ?? 0;
  const lateFee = snapshot.lateFee ?? (invoice as any)?.lateFeeAmount ?? 0;
  const taxAmount = snapshot.taxAmount ?? (invoice as any)?.taxAmount ?? 0;

  const totalDue = invoice?.totalDue ?? (currentCharge + previousOutstanding + lateFee + taxAmount);
  const paidAmount = invoice?.paidAmount ?? 0;
  const remainingDue = Math.max(0, totalDue - paidAmount);

  // Status variants
  const status: InvoiceStatus = invoice?.status || 'UNPAID';
  const statusVariant = getStatusVariant(status);
  const statusLabel = status.replace(/_/g, ' ');

  const isPaid = status === 'PAID';
  const isPendingVerification = status === 'VERIFICATION_PENDING';
  const isCancelled = status === 'CANCELLED';
  const isPartial = status === 'PARTIALLY_PAID' || (paidAmount > 0 && remainingDue > 0);
  const methodMeta = getMethodMeta(invoice?.paymentMethod);

  // Payment progress percentage
  const paidPercentage =
    totalDue > 0
      ? Math.min(100, Math.round((paidAmount / totalDue) * 100))
      : isPaid
      ? 100
      : 0;

  return (
    <ScreenShell
      title={`Invoice #${invNo}`}
      subtitle={`${unitStr} • ${periodStr}`}
      iconName="Receipt"
      headerRight={
        invoice ? (
          <View className="flex-row items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              leftIcon={QrCode}
              onPress={() => setShowQR(true)}
              className="border-border bg-card px-2.5 h-8"
              textClassName="text-xs font-bold text-primary"
              accessibilityRole="button"
              accessibilityLabel="Show Invoice QR Pass"
            >
              QR
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={isExporting ? FileText : Download}
              onPress={() => handleExportPdf('download')}
              disabled={isExporting}
              className="border-border bg-card px-2.5 h-8"
              textClassName="text-xs font-bold text-foreground"
              accessibilityRole="button"
              accessibilityLabel="Export or Download PDF Invoice"
            >
              {isExporting ? 'Exporting...' : 'PDF'}
            </Button>
          </View>
        ) : null
      }
    >
      <View className="flex-1 bg-background">
        {/* Error Banner Container */}
        {error ? (
          <View className="mb-2 px-4">
            <ErrorBanner message={error} onDismiss={() => resetBillingError()} />
          </View>
        ) : null}

        {isLoading ? (
          <View className="p-4">
            <SkeletonLoader count={3} />
          </View>
        ) : (
          <ScrollView
            className="flex-1 px-4 pt-2"
            contentContainerClassName="gap-4 pb-28"
            contentContainerStyle={{ paddingBottom: 120 }}
            refreshControl={
              <RefreshControl
                refreshing={loadingStates.fetchDues || fallbackLoading}
                onRefresh={handleRefresh}
              />
            }
          >
            {/* Hero Invoice Summary Card using canonical Card */}
            <Card className="p-5 shadow-sm mb-0">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center flex-1 me-2">
                  <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center me-3">
                    <Icon as={Receipt} size={20} className="text-primary" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground font-bold text-base truncate">
                      {snapshot.assessmentName || (invoice as any)?.assessmentName || 'Maintenance Assessment'}
                    </Text>
                    <Text className="text-muted-foreground text-xs">{unitStr} • {periodStr}</Text>
                  </View>
                </View>

                <StatusBadge label={statusLabel} variant={statusVariant} dot />
              </View>

              {/* Outstanding / Total Amount Hero Box */}
              <View className="bg-muted/40 border border-border/60 rounded-xl p-4 mb-3">
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {isPaid ? 'Total Settled Amount' : 'Remaining Outstanding Liability'}
                </Text>
                <Text className="text-3xl font-extrabold text-foreground tracking-tight">
                  ₹{(isPaid ? totalDue : remainingDue).toLocaleString('en-IN')}
                </Text>
                <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-border/40">
                  <View className="flex-row items-center">
                    <Icon as={Calendar} size={12} className="text-muted-foreground me-1" />
                    <Text className="text-xs text-muted-foreground">Due: {dueDateStr}</Text>
                  </View>
                  <View className="flex-row items-center">
                    <Icon as={Clock} size={12} className="text-muted-foreground me-1" />
                    <Text className="text-xs text-muted-foreground">Billed: {invoiceDateStr}</Text>
                  </View>
                </View>
              </View>

              {/* Payment Settlement Progress Bar */}
              {isPartial || paidAmount > 0 ? (
                <View className="mb-4">
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="text-xs font-semibold text-muted-foreground">Settlement Progress</Text>
                    <Text className="text-xs font-extrabold text-primary">{paidPercentage}%</Text>
                  </View>
                  <View className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <View
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${paidPercentage}%` }}
                    />
                  </View>
                </View>
              ) : null}

              {/* Action Buttons: View PDF & Download PDF */}
              <View className="flex-row items-center gap-2 pt-1 border-t border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Share2}
                  onPress={() => handleExportPdf('print')}
                  className="flex-1"
                  textClassName="text-xs font-semibold text-foreground"
                  accessibilityLabel="Share Statement"
                >
                  Share Statement
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  leftIcon={Download}
                  onPress={() => handleExportPdf('download')}
                  className="flex-1"
                  textClassName="text-xs font-semibold text-primary-foreground"
                  accessibilityLabel="Download PDF Statement"
                >
                  Download PDF
                </Button>
              </View>
            </Card>

            {/* Verification Pending Info Banner */}
            {isPendingVerification ? (
              <View className={`border rounded-xl p-4 flex-row items-start ${methodMeta.badgeBg}`}>
                <Icon as={methodMeta.icon} size={20} className={`me-3 mt-0.5 ${methodMeta.iconColor}`} />
                <View className="flex-1">
                  <Text className={`text-sm font-bold ${methodMeta.textColor}`}>
                    {`${methodMeta.label} Verification Pending`}
                  </Text>
                  <Text className={`text-xs mt-1 ${methodMeta.subTextColor}`}>
                    Your offline payment reference (#{invoice?.offlineReference || '—'}) has been submitted. The admin team is currently verifying the receipt and clearing the dues.
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Rejection Info Banner */}
            {((invoice as any)?.rejectionReason || (invoice as any)?.auditHistory?.some((a: any) => a.action === 'OFFLINE_PAYMENT_REJECTED')) && !isPendingVerification ? (
              <View className="border border-destructive/30 bg-destructive/10 rounded-xl p-4 flex-row items-start">
                <Icon as={AlertCircle} size={20} className="me-3 mt-0.5 text-destructive" />
                <View className="flex-1">
                  <Text className="text-sm font-bold text-destructive">
                    Previous Payment Submission Rejected
                  </Text>
                  <Text className="text-xs mt-1 text-destructive/90">
                    Reason: {(invoice as any)?.rejectionReason || (invoice as any)?.auditHistory?.find((a: any) => a.action === 'OFFLINE_PAYMENT_REJECTED')?.reason || 'Payment details could not be verified by the admin.'}
                  </Text>
                  <Text className="text-[11px] mt-1 text-muted-foreground">
                    Please submit a fresh payment request with valid transaction proof or pay using Digital Wallet / Online.
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Offline Submission Details (Proof & Remarks) */}
            {(invoice?.payerNotes || invoice?.paymentScreenshot || (isPendingVerification && invoice?.offlineReference)) ? (
              <DetailSection title="Offline Payment Submission Details">
                {invoice?.paymentMethod ? (
                  <DetailRow label="Payment Method" value={methodMeta.label} />
                ) : null}
                {invoice?.offlineReference ? (
                  <DetailRow label={methodMeta.refLabel} value={invoice.offlineReference} copyable />
                ) : null}
                {(invoice as any)?.offlineAmount ? (
                  <DetailRow label="Submitted Amount" value={`₹${Number((invoice as any).offlineAmount).toLocaleString('en-IN')}`} />
                ) : null}
                {invoice?.payerNotes ? (
                  <DetailRow label="Payer Remarks / Description" value={invoice.payerNotes} />
                ) : null}
                {invoice?.paymentScreenshot ? (
                  <View className="py-2">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-xs font-semibold text-muted-foreground">Proof of Payment</Text>
                      <TouchableOpacity
                        onPress={() => {
                          const fullUrl = getImageUrl(invoice.paymentScreenshot);
                          if (isImageProof(invoice.paymentScreenshot)) {
                            setPreviewProofUrl(fullUrl);
                          } else {
                            Linking.openURL(fullUrl);
                          }
                        }}
                        className="flex-row items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-md"
                      >
                        <Icon as={isImageProof(invoice.paymentScreenshot) ? Eye : ExternalLink} size={13} className="text-primary" />
                        <Text className="text-xs font-bold text-primary">
                          {isImageProof(invoice.paymentScreenshot) ? 'Preview Proof' : 'Open Document'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {isImageProof(invoice.paymentScreenshot) ? (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setPreviewProofUrl(getImageUrl(invoice.paymentScreenshot))}
                        className="rounded-lg overflow-hidden border border-border/70 bg-muted/40 items-center justify-center h-44"
                      >
                        <RNImage
                          source={{ uri: getImageUrl(invoice.paymentScreenshot) }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                        <View className="absolute bottom-2 right-2 bg-black/70 px-2.5 py-1 rounded-md flex-row items-center gap-1">
                          <Icon as={Eye} size={12} color="#ffffff" />
                          <Text className="text-white text-[10px] font-bold">Tap to Zoom</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(getImageUrl(invoice.paymentScreenshot))}
                        className="flex-row items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border/70"
                      >
                        <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center">
                          <Icon as={FileText} size={20} className="text-primary" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                            {invoice.paymentScreenshot.split('/').pop() || 'Proof_Document.pdf'}
                          </Text>
                          <Text className="text-[10px] text-muted-foreground">Attached Document • Tap to Open</Text>
                        </View>
                        <Icon as={ExternalLink} size={16} className="text-muted-foreground" />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
              </DetailSection>
            ) : null}

            {/* Itemized Financial Charge Breakdown Section */}
            <DetailSection title="Itemized Financial Breakdown">
              <DetailRow
                label="Base Maintenance Charge"
                value={`₹${currentCharge.toLocaleString('en-IN')}`}
              />
              {previousOutstanding > 0 ? (
                <DetailRow
                  label="Previous Arrears Carried Forward"
                  value={`₹${previousOutstanding.toLocaleString('en-IN')}`}
                />
              ) : null}
              {lateFee > 0 ? (
                <DetailRow
                  label="Late Fee / Arrears Penalty"
                  value={`₹${lateFee.toLocaleString('en-IN')}`}
                />
              ) : null}
              {taxAmount > 0 ? (
                <DetailRow
                  label="Applicable GST / Taxes"
                  value={`₹${taxAmount.toLocaleString('en-IN')}`}
                />
              ) : null}
              <DetailRow
                label="Gross Total Billed"
                value={`₹${totalDue.toLocaleString('en-IN')}`}
              />
              {paidAmount > 0 ? (
                <DetailRow
                  label="Less Total Settled Amount"
                  value={`- ₹${paidAmount.toLocaleString('en-IN')}`}
                />
              ) : null}
              <DetailRow
                label="Net Balance Payable"
                value={`₹${remainingDue.toLocaleString('en-IN')}`}
              />
            </DetailSection>

            {/* Invoice Metadata Section */}
            <DetailSection title="Statement & Account Information">
              <DetailRow label="Invoice Number" value={invNo} copyable />
              <DetailRow label="Resident Account" value={residentStr} />
              <DetailRow label="Unit / Villa" value={unitStr} />
              <DetailRow label="Billing Cycle" value={periodStr} />
              <DetailRow label="Payment Status" value={statusLabel} />
              {invoice?.createdAt || invoice?.date ? (
                <DetailRow
                  label="Created Date"
                  value={new Date(invoice.createdAt || invoice.date!).toLocaleDateString([], {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                />
              ) : null}
              {invoice?.paymentMethod ? (
                <DetailRow label="Payment Method" value={methodMeta.label} />
              ) : null}
              {invoice?.offlineReference ? (
                <DetailRow
                  label={methodMeta.refLabel}
                  value={invoice.offlineReference}
                  copyable
                />
              ) : null}
            </DetailSection>
          </ScrollView>
        )}

        {/* Sticky Bottom Payment Action Bar */}
        {!isPaid && !isCancelled && !isPendingVerification && remainingDue > 0 && !['Community Admin', 'Super Admin', 'Platform Super Admin', 'Finance Admin'].includes((user as any)?.role) ? (
          <View className="absolute bottom-0 left-0 right-0 bg-card/95 border-t border-border p-4 shadow-lg">
            <Button
              variant="default"
              size="lg"
              className="w-full"
              rightIcon={ChevronRight}
              onPress={() => setShowCheckout(true)}
              accessibilityRole="button"
              accessibilityLabel={`Proceed to Pay Remaining Dues ₹${remainingDue.toLocaleString('en-IN')}`}
            >
              {`Pay Remaining Dues • ₹${remainingDue.toLocaleString('en-IN')}`}
            </Button>
          </View>
        ) : null}

        {/* Payment Checkout Modal Sheet */}
        <PaymentCheckoutSheet
          visible={showCheckout}
          onClose={() => setShowCheckout(false)}
          invoice={invoice}
          onOpenOfflineSheet={(inv, amount) => {
            setShowCheckout(false);
            setOfflineAmount(amount);
            setShowOfflineSheet(true);
          }}
          onPaymentSuccess={(result: any, amountPaid?: number, paymentMethod?: string) => {
            loadResidentDues();
            const serverInv = result?.invoice || result?.data?.invoice || result?.data || result;
            if (serverInv && serverInv.status) {
              setFallbackInvoice(serverInv);
            } else if (invoiceId) {
              billingService.getInvoiceById(invoiceId).then(setFallbackInvoice).catch(() => {});
            }

            const authoritativeStatus = serverInv?.status || result?.status || 'PAID';
            const paid = serverInv?.paidAmount ?? (amountPaid !== undefined && amountPaid !== null ? Number(amountPaid) : invoice?.paidAmount || 0);
            const remaining = serverInv?.outstandingAmount ?? 0;
            const total = serverInv?.totalDue ?? invoice?.totalDue ?? (paid + remaining);

            const receiptData = {
              ...(invoice || {}),
              ...serverInv,
              ...(result || {}),
              invoiceNumber: serverInv?.invoiceNumber || invoice?.invoiceNumber || result?.invoiceNumber || invoice?._id,
              unitNumber: serverInv?.unitNumber || invoice?.unitNumber || (user as any)?.villaNumber || (user as any)?.activeVillaNumber || (user as any)?.unitNumber,
              assessmentName: serverInv?.assessmentName || invoice?.assessmentName || (invoice as any)?.snapshot?.assessmentName,
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

        {/* Offline Settlement Modal Sheet */}
        <OfflineSettleSheet
          visible={showOfflineSheet}
          invoice={invoice}
          initialAmount={offlineAmount || remainingDue}
          onClose={() => setShowOfflineSheet(false)}
          onSettlementSubmitted={() => {
            loadResidentDues();
            if (invoiceId) {
              billingService.getInvoiceById(invoiceId).then(setFallbackInvoice).catch(() => {});
            }
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
          visible={showQR}
          invoice={invoice}
          onClose={() => setShowQR(false)}
        />

        {/* Fullscreen Proof Preview Modal */}
        <Modal visible={!!previewProofUrl} transparent animationType="fade">
          <View className="flex-1 bg-black/90 items-center justify-center p-4">
            <View className="absolute top-12 left-6 right-6 flex-row justify-between items-center z-10">
              <TouchableOpacity
                onPress={() => {
                  if (previewProofUrl) Linking.openURL(previewProofUrl);
                }}
                className="flex-row items-center gap-1 bg-white/20 px-3 py-2 rounded-full"
              >
                <Icon as={ExternalLink} size={16} color="#ffffff" />
                <Text className="text-white text-xs font-bold">Open Original</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPreviewProofUrl(null)}
                className="p-2 rounded-full bg-white/20"
              >
                <Icon as={X} size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {previewProofUrl ? (
              <RNImage
                source={{ uri: previewProofUrl }}
                className="w-full h-4/5"
                resizeMode="contain"
              />
            ) : null}
          </View>
        </Modal>
      </View>
    </ScreenShell>
  );
}

export default InvoiceDetailsScreen;
