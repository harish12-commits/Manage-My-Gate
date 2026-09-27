import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CheckCircle2, Download, Printer, Receipt, Clock, AlertCircle } from 'lucide-react-native';
import { generateInvoiceHtml, exportInvoiceHtmlDocument } from '../utils/invoicePdfUtility';
import { useAuth } from '@/src/features/auth/hooks/useAuth';

export interface PaymentReceiptModalProps {
  visible: boolean;
  onClose: () => void;
  invoice: any | null;
  amountPaid?: number;
  paymentMethod?: string;
  communityName?: string;
}

export function PaymentReceiptModal({
  visible,
  onClose,
  invoice,
  amountPaid,
  paymentMethod,
  communityName = 'Community Workspace',
}: PaymentReceiptModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { user } = useAuth();

  if (!invoice) return null;

  // Resolve Resident's Villa / Unit from invoice or resident profile
  const residentVillaNumber =
    (user as any)?.villaNumber ||
    (user as any)?.activeVillaNumber ||
    (user as any)?.unitNumber ||
    '';

  const rawUnit =
    invoice.unitNumber ||
    invoice.unit ||
    invoice.villaNumber ||
    invoice.snapshot?.unitDetails?.unitNumber ||
    residentVillaNumber ||
    '';

  const unitStr = rawUnit
    ? (String(rawUnit).trim().toLowerCase().startsWith('villa') ? String(rawUnit).trim() : `Villa ${String(rawUnit).trim()}`)
    : 'Villa Unit';

  const invNo =
    invoice.invoiceNumber ||
    invoice.invoiceId ||
    invoice._id ||
    '—';

  const assessmentTitle =
    invoice.assessmentName ||
    invoice.snapshot?.assessmentName ||
    invoice.title ||
    invoice.purpose ||
    invoice.assessmentPurpose ||
    'Community Maintenance Assessment';

  const effectivePaid =
    amountPaid !== undefined && amountPaid !== null && Number(amountPaid) > 0
      ? Number(amountPaid)
      : (invoice.amountPaid !== undefined && invoice.amountPaid !== null && Number(invoice.amountPaid) > 0
          ? Number(invoice.amountPaid)
          : (invoice.paidAmount !== undefined && invoice.paidAmount !== null && Number(invoice.paidAmount) > 0
              ? Number(invoice.paidAmount)
              : Number(invoice.totalDue || invoice.totalAmount || 0)));

  const totalLiability = Number(invoice.totalDue || invoice.totalAmount || invoice.currentCharge || 0);

  let remainingDue = 0;
  if (invoice.outstandingAmount !== undefined && Number(invoice.outstandingAmount) >= 0) {
    remainingDue = Number(invoice.outstandingAmount);
  } else if (totalLiability > 0) {
    remainingDue = Math.max(0, totalLiability - effectivePaid);
  }

  // Safety check: if effectivePaid is less than totalLiability and remaining was calculated as 0, calculate true remaining
  if (totalLiability > 0 && effectivePaid < totalLiability && remainingDue <= 0) {
    remainingDue = totalLiability - effectivePaid;
  }

  const authoritativeStatus = invoice.status || (remainingDue <= 0.01 ? 'PAID' : 'PARTIALLY_PAID');
  const isFullyPaid = authoritativeStatus === 'PAID' || authoritativeStatus === 'SUCCESS';
  const isVerificationPending = authoritativeStatus === 'VERIFICATION_PENDING';
  const isRejected = authoritativeStatus === 'REJECTED';

  const offlineRef = invoice.offlinePayment?.reference || invoice.paymentReference || null;

  const effectiveMethod =
    paymentMethod ||
    invoice.paymentMethod ||
    (invoice.selectedMethod === 'WALLET' ? 'Digital Wallet' : 'Online Payment');

  const handlePdfAction = async (action: 'download' | 'print') => {
    try {
      setIsExporting(true);
      const targetInvoice = {
        ...invoice,
        unitNumber: rawUnit || 'Unit',
        assessmentName: assessmentTitle,
        paidAmount: effectivePaid,
        outstandingAmount: remainingDue,
        status: authoritativeStatus,
        paymentMethod: effectiveMethod,
      };

      const html = generateInvoiceHtml(targetInvoice, {
        communityName,
        residentName: invoice.residentName || invoice.targetUser || (user as any)?.name || 'Resident Owner',
      });

      const filename = `Invoice_${invNo}_Receipt.html`;
      await exportInvoiceHtmlDocument(html, filename, `Invoice Statement #${invNo}`, { action });
      setIsExporting(false);
    } catch (err: any) {
      setIsExporting(false);
      Alert.alert('PDF Export Failed', err?.message || 'Unable to render invoice PDF.');
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Receipt • #${invNo}`}>
      <View className="py-2 pb-3 gap-4">
        {/* Verification Pending Header Box */}
        {isVerificationPending ? (
          <View testID="receipt-verification-pending-box" className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 items-center justify-center">
            <View className="w-12 h-12 rounded-full bg-amber-500/20 items-center justify-center mb-2">
              <Icon as={Clock} size={28} className="text-amber-500" />
            </View>
            <Text className="font-extrabold text-lg text-foreground text-center">
              Payment Acknowledgment
            </Text>
            <Text className="text-xs text-muted-foreground text-center mt-1">
              ₹{effectivePaid.toLocaleString('en-IN')} submitted via {effectiveMethod} for {unitStr}.
            </Text>

            <View className="mt-3 flex-row items-center gap-2">
              <StatusBadge
                label="VERIFICATION PENDING"
                variant="warning"
              />
              <View className="bg-amber-500/20 px-2.5 py-0.5 rounded-full">
                <Text className="text-[11px] font-bold text-amber-800 dark:text-amber-200">
                  Not yet settled.
                </Text>
              </View>
            </View>
            <Text className="text-xs text-amber-600 dark:text-amber-400 text-center mt-2.5 px-2">
              Your payment submission is awaiting admin verification. Funds will be credited once verified.
            </Text>
          </View>
        ) : isRejected ? (
          <View testID="receipt-rejected-box" className="bg-destructive/10 border border-destructive/30 rounded-2xl p-5 items-center justify-center">
            <View className="w-12 h-12 rounded-full bg-destructive/20 items-center justify-center mb-2">
              <Icon as={AlertCircle} size={28} className="text-destructive" />
            </View>
            <Text className="font-extrabold text-lg text-foreground text-center">
              Payment Submission Rejected
            </Text>
            <Text className="text-xs text-muted-foreground text-center mt-1">
              Submission for ₹{effectivePaid.toLocaleString('en-IN')} was rejected by management.
            </Text>

            <View className="mt-3 flex-row items-center gap-2">
              <StatusBadge
                label="REJECTED"
                variant="danger"
              />
              <View className="bg-destructive/20 px-2.5 py-0.5 rounded-full">
                <Text className="text-[11px] font-bold text-destructive">
                  Payment submission rejected.
                </Text>
              </View>
            </View>
            {(invoice.offlinePayment?.rejectionReason || invoice.rejectionReason) ? (
              <Text className="text-xs text-destructive text-center mt-2 px-2">
                {`Reason: ${invoice.offlinePayment?.rejectionReason || invoice.rejectionReason}`}
              </Text>
            ) : null}
          </View>
        ) : (
          /* Success / Paid Header Box */
          <View className="bg-status-success/10 border border-status-success/30 rounded-2xl p-5 items-center justify-center">
            <View className="w-12 h-12 rounded-full bg-status-success/20 items-center justify-center mb-2">
              <Icon as={CheckCircle2} size={28} className="text-status-success" />
            </View>
            <Text className="font-extrabold text-lg text-foreground text-center">
              {isFullyPaid ? 'Payment Completed!' : 'Partial Payment Received!'}
            </Text>
            <Text className="text-xs text-muted-foreground text-center mt-1">
              ₹{effectivePaid.toLocaleString('en-IN')} received via {effectiveMethod} for {unitStr}.
            </Text>

            <View className="mt-3 flex-row items-center gap-2">
              <StatusBadge
                label={isFullyPaid ? 'FULLY PAID' : 'PARTIALLY PAID'}
                variant={isFullyPaid ? 'success' : 'warning'}
              />
              {!isFullyPaid ? (
                <Text className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  Remaining: ₹{remainingDue.toLocaleString('en-IN')}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Offline Reference if available */}
        {offlineRef ? (
          <View className="bg-muted/40 border border-border/60 rounded-xl p-3 flex-row justify-between items-center">
            <Text className="text-xs text-muted-foreground font-medium">Payment Reference / UTR</Text>
            <Text className="text-xs font-mono font-bold text-foreground">
              {offlineRef}
            </Text>
          </View>
        ) : null}

        {/* Assessment Purpose Card */}
        <View className="bg-muted/40 border border-border/60 rounded-xl p-3.5 gap-1.5">
          <Text className="text-xs text-muted-foreground font-medium">Assessment Purpose</Text>
          <Text className="font-bold text-sm text-foreground">{assessmentTitle}</Text>
          <Text className="text-xs text-muted-foreground">
            Invoice #{invNo} • {unitStr}
          </Text>
        </View>

        {/* Invoice PDF Actions (Only for settled payments per Phase 5 Section 20) */}
        {!isVerificationPending && !isRejected ? (
          <View className="bg-card border border-border rounded-xl p-4 gap-3">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Statement & Invoice Documents
            </Text>

            <View className="flex-row gap-2.5">
              <Button
                variant="outline"
                size="default"
                className="flex-1 flex-row items-center justify-center gap-2 border-primary/40 bg-primary/10 min-h-[44px]"
                onPress={() => handlePdfAction('print')}
                disabled={isExporting}
                accessibilityRole="button"
                accessibilityLabel="View PDF Invoice"
              >
                <Icon as={Printer} size={16} className="text-primary" />
                <Text className="text-primary font-bold text-sm">View PDF</Text>
              </Button>

              <Button
                variant="default"
                size="default"
                className="flex-1 flex-row items-center justify-center gap-2 bg-primary min-h-[44px]"
                onPress={() => handlePdfAction('download')}
                disabled={isExporting}
                accessibilityRole="button"
                accessibilityLabel="Download PDF Invoice"
              >
                <Icon as={Download} size={16} className="text-primary-foreground" />
                <Text className="text-primary-foreground font-bold text-sm">Download PDF</Text>
              </Button>
            </View>
          </View>
        ) : isVerificationPending ? (
          <View className="bg-muted/30 border border-border/70 rounded-xl p-3.5 items-center">
            <Text className="text-xs text-muted-foreground text-center">
              Official settled statement will be available once administrative verification is complete.
            </Text>
          </View>
        ) : null}

        <Button
          variant="secondary"
          size="lg"
          className="w-full mt-1"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text className="font-bold text-sm text-foreground">Done</Text>
        </Button>
      </View>
    </BottomSheet>
  );
}

export default PaymentReceiptModal;
