import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, ScrollView, Share, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { Share2, Download, RefreshCw, FileText } from 'lucide-react-native';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useBilling } from '../hooks/useBilling';
import { useBillingSocket } from '../hooks/useBillingSocket';
import { billingService } from '../services/billingService';
import paymentService from '../../payment/services/paymentService';
import { PaymentResultHeroCard } from '../components/PaymentResultHeroCard';
import { InvoiceStatus, Invoice } from '../types';
import { generateInvoiceHtml, exportInvoiceHtmlDocument } from '../utils/invoicePdfUtility';

export function PaymentResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    invoiceId?: string;
    status?: string;
    paymentMethod?: string;
    reference?: string;
    amount?: string;
  }>();

  const invoiceId = params?.invoiceId || '';
  const paramMethod = params?.paymentMethod || '';
  const paramRef = params?.reference || '';

  const {
    activeDues,
    invoicesList,
    loadingStates,
    loadResidentDues,
  } = useBilling();

  const [serverInvoice, setServerInvoice] = useState<Invoice | null>(null);
  const [isRechecking, setIsRechecking] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Socket listener for real-time verification updates
  useBillingSocket();

  useEffect(() => {
    loadResidentDues();
  }, [loadResidentDues]);

  // Match target invoice from Redux state or directly loaded server invoice
  const reduxInvoice: Invoice | null = useMemo(() => {
    if (!invoiceId) return null;

    const inGrid = invoicesList.find(
      (inv) => String(inv._id || (inv as any).id || '') === String(invoiceId) || String(inv.invoiceNumber || '') === String(invoiceId)
    );
    if (inGrid) return inGrid;

    const recent = activeDues?.recentInvoices || [];
    const inRecent = recent.find(
      (inv) => String(inv._id || (inv as any).id || '') === String(invoiceId) || String(inv.invoiceNumber || '') === String(invoiceId)
    );
    if (inRecent) return inRecent;

    const breakdown = activeDues?.unitBreakdown || [];
    const inBreakdown = breakdown.find(
      (inv) => String(inv.invoiceId || inv._id || (inv as any).id || '') === String(invoiceId) || String(inv.invoiceNumber || '') === String(invoiceId)
    );
    if (inBreakdown) {
      return {
        _id: inBreakdown.invoiceId,
        invoiceNumber: inBreakdown.invoiceNumber,
        unitNumber: inBreakdown.unitNumber,
        totalDue: inBreakdown.totalDue,
        amount: inBreakdown.totalDue,
        billingPeriodString: inBreakdown.billingPeriodString,
        status: inBreakdown.status,
        dueDate: inBreakdown.dueDate,
      };
    }

    return null;
  }, [invoiceId, invoicesList, activeDues]);

  // Server invoice takes absolute precedence over Redux summary state
  const invoice = serverInvoice || reduxInvoice;

  const invNo = invoice?.invoiceNumber || invoiceId || '—';
  const unitStr = invoice?.unitNumber ? `Villa ${invoice.unitNumber}` : 'Villa Unit';
  const periodStr = invoice?.billingPeriodString || 'Current Period';

  // Authoritative financial state
  const status: InvoiceStatus | string =
    serverInvoice?.status ||
    (params?.status as InvoiceStatus) ||
    invoice?.status ||
    'UNPAID';

  const totalDue = invoice?.totalDue ?? invoice?.amount ?? (params?.amount ? parseFloat(params.amount) : 0);
  const paidAmount = invoice?.paidAmount ?? (status === 'PAID' ? totalDue : 0);
  const remainingDue = invoice?.outstandingAmount ?? Math.max(0, totalDue - paidAmount);
  const methodStr = invoice?.paymentMethod || paramMethod || 'Digital Payment';
  const refStr = invoice?.offlineReference || paramRef || '—';

  const isPaid = status === 'PAID' || status === 'SUCCESS';
  const isChecking = status === 'CHECKING' || status === 'PAYMENT_CHECKING';
  const isPartial = status === 'PARTIALLY_PAID' || (!isChecking && paidAmount > 0 && remainingDue > 0);
  const isFailed = status === 'FAILED';
  const isCancelled = status === 'CANCELLED';

  // Interactive recovery action querying authoritative backend invoice endpoint
  const handleCheckStatus = useCallback(async () => {
    if (!invoiceId) return;
    try {
      setIsRechecking(true);
      const fresh = await billingService.getInvoiceById(invoiceId);
      if (fresh) {
        setServerInvoice(fresh);
        await loadResidentDues();
        if (fresh.status === 'PAID' || fresh.status === 'PARTIALLY_PAID') {
          await paymentService.clearActivePaymentSession('Invoice', invoiceId);
        }
      }
    } catch (err: any) {
      console.log('[PaymentResultScreen] Status check query returned error or in-progress', err);
    } finally {
      setIsRechecking(false);
    }
  }, [invoiceId, loadResidentDues]);

  // Limited automatic reconciliation on mount for checking state
  useEffect(() => {
    if (invoiceId && (params?.status === 'CHECKING' || status === 'CHECKING')) {
      handleCheckStatus();
    }
  }, [invoiceId]);

  // Native Receipt Share Handler
  const handleShareReceipt = async () => {
    try {
      const formattedAmount = `₹${(isPaid ? totalDue : paidAmount || totalDue).toLocaleString('en-IN')}`;
      await Share.share({
        title: `Payment Receipt #${invNo}`,
        message: `Nahom Payment Receipt #${invNo}\nUnit: ${unitStr}\nAmount: ${formattedAmount}\nStatus: ${String(status).replace(/_/g, ' ')}\nMethod: ${methodStr}\nReference: ${refStr}`,
      });
    } catch (err: any) {
      Alert.alert('Share Failed', err.message || 'Unable to share receipt.');
    }
  };

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

  // Export / Download PDF HTML statement
  const handleDownloadInvoicePdf = async () => {
    try {
      setIsExportingPdf(true);
      const targetData = invoice || {
        _id: invoiceId,
        invoiceNumber: invNo,
        unitNumber: unitStr,
        totalDue,
        paidAmount: isPaid ? totalDue : paidAmount,
        outstandingAmount: remainingDue,
        status: status as any,
        paymentMethod: methodStr,
        offlineReference: refStr,
        billingPeriodString: periodStr,
      };

      const html = generateInvoiceHtml(targetData, {
        communityName: dynamicCommunityName,
        residentName: (invoice as any)?.targetUser || (user as any)?.name || (user as any)?.fullName || 'Resident Owner',
      });

      await exportInvoiceHtmlDocument(
        html,
        `Invoice_${invNo}.html`,
        `Invoice Statement #${invNo}`,
        { action: 'download' }
      );
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Unable to generate invoice PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <ScreenShell
      title="Payment Result"
      subtitle={`Invoice #${invNo}`}
      iconName="Receipt"
      loading={loadingStates.fetchDues && !invoice && !serverInvoice}
    >
      <View className="flex-1 bg-background justify-between">
        {/* Scrollable Receipt Body with pb-32 Bottom Clearance */}
        <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4 pb-32">
          {/* Domain Hero Outcome Card */}
          <PaymentResultHeroCard
            status={status}
            amount={totalDue}
            paidAmount={paidAmount}
            remainingDue={remainingDue}
            invoiceNumber={invNo}
            unitName={unitStr}
            reference={refStr}
            rejectionReason={(invoice as any)?.rejectionReason || (invoice as any)?.offlinePayment?.rejectionReason}
          />

          {/* Payment Summary Details Section */}
          <DetailSection title="Transaction Details">
            <DetailRow label="Invoice Number" value={invNo} copyable />
            <DetailRow label="Unit & Period" value={`${unitStr} (${periodStr})`} />
            <DetailRow label="Settled Amount" value={`₹${(isPaid ? totalDue : paidAmount).toLocaleString('en-IN')}`} />
            {remainingDue > 0 ? (
              <DetailRow label="Remaining Liability" value={`₹${remainingDue.toLocaleString('en-IN')}`} />
            ) : null}
            <DetailRow label="Payment Method" value={methodStr} />
            {refStr !== '—' ? (
              <DetailRow label="Reference / ID #" value={refStr} copyable />
            ) : null}
            <DetailRow
              label="Transaction Date"
              value={new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              isLast
            />
          </DetailSection>
        </ScrollView>

        {/* Sticky Bottom Completion CTAs */}
        <View className="gap-2.5 p-4 pt-2 pb-6 border-t border-border bg-background">
          {isChecking ? (
            <Button
              variant="default"
              size="lg"
              className="w-full flex-row items-center justify-center"
              onPress={handleCheckStatus}
              disabled={isRechecking}
              loading={isRechecking}
              accessibilityRole="button"
              accessibilityLabel="Check Payment Status"
            >
              <Icon as={RefreshCw} size={18} className="text-primary-foreground me-2" />
              <Text className="font-bold text-base text-primary-foreground">
                {isRechecking ? 'Verifying with Server…' : 'Check Payment Status'}
              </Text>
            </Button>
          ) : (isPaid || isPartial) ? (
            <>
              <Button
                variant="default"
                size="lg"
                className="w-full flex-row items-center justify-center"
                onPress={handleDownloadInvoicePdf}
                disabled={isExportingPdf}
                accessibilityRole="button"
                accessibilityLabel="Download Official Invoice PDF"
              >
                <Icon as={Download} size={18} className="text-primary-foreground me-2" />
                <Text className="font-bold text-base text-primary-foreground">
                  {isExportingPdf ? 'Generating Invoice...' : 'Download Invoice Receipt PDF'}
                </Text>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full flex-row items-center justify-center"
                onPress={handleShareReceipt}
                accessibilityRole="button"
                accessibilityLabel="Share Digital Receipt"
              >
                <Icon as={Share2} size={18} className="text-foreground me-2" />
                <Text className="font-bold text-base text-foreground">Share Digital Summary</Text>
              </Button>
            </>
          ) : null}

          {invoiceId ? (
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onPress={() => router.push(`/(resident)/billing/invoice/${invoiceId}` as any)}
              accessibilityRole="button"
              accessibilityLabel="View Invoice Details"
            >
              <Text className="font-semibold text-base text-foreground">View Invoice Details</Text>
            </Button>
          ) : null}

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onPress={() => router.push('/(resident)/billing/my-dues' as any)}
            accessibilityRole="button"
            accessibilityLabel="Return to My Dues Overview"
          >
            <Text className="font-semibold text-base text-secondary-foreground">Return to My Dues</Text>
          </Button>
        </View>
      </View>
    </ScreenShell>
  );
}

export default PaymentResultScreen;
