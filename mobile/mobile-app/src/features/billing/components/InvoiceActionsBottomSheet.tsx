import React, { useState, useEffect, useMemo } from 'react';
import { View, Share, Alert, TouchableOpacity, Image as RNImage, Modal, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/forms/TextInput';
import { getStatusVariant } from '@/components/ui/StatusBadge';
import {
  Clock,
  Check,
  Banknote,
  Landmark,
  XCircle,
  CheckCircle2,
  ShieldAlert,
  Bell,
  FileText,
  Copy,
  QrCode,
  CreditCard,
  FileSpreadsheet,
  ExternalLink,
  Eye,
  X,
} from 'lucide-react-native';
import { Invoice } from '../types';
import billingService from '../services/billingService';
import { getImageUrl } from '@/src/utils/imageUrl';

export interface InvoiceActionsBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onApproveOffline?: (invoiceId: string, options?: { amount?: number; settlementType?: 'FULL' | 'CUSTOM' }) => Promise<any>;
  onRejectOffline?: (invoiceId: string, reason: string) => Promise<any>;
  onSettleOfflineModal?: (invoice: Invoice) => void;
}

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

export function InvoiceActionsBottomSheet({
  visible,
  onClose,
  invoice,
  onApproveOffline,
  onRejectOffline,
  onSettleOfflineModal,
}: InvoiceActionsBottomSheetProps) {
  const router = useRouter();
  const [approvalMode, setApprovalMode] = useState<'FULL' | 'CUSTOM'>('FULL');
  const [customAmountStr, setCustomAmountStr] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);

  // Derived figures
  const totalAmount = invoice?.totalDue ?? invoice?.amount ?? 0;
  const paidAmount = invoice?.paidAmount ?? 0;
  const remainingDue = (invoice as any)?.outstandingAmount !== undefined
    ? (invoice as any).outstandingAmount
    : Math.max(0, totalAmount - paidAmount);

  const submittedOfflineAmount = (invoice as any)?.offlineAmount ?? remainingDue;

  useEffect(() => {
    if (visible && invoice) {
      // If submitted amount is less than remaining due, default to custom amount prefilled with submitted amount
      if (submittedOfflineAmount > 0 && submittedOfflineAmount < remainingDue) {
        setApprovalMode('CUSTOM');
        setCustomAmountStr(String(submittedOfflineAmount));
      } else {
        setApprovalMode('FULL');
        setCustomAmountStr(remainingDue > 0 ? String(remainingDue) : '');
      }
      setShowConfirmModal(false);
      setShowRejectModal(false);
      setRejectReason('');
      setIsApproving(false);
      setIsRejecting(false);
      setIsSendingReminder(false);
      setPreviewProofUrl(null);
    }
  }, [visible, invoice, remainingDue, submittedOfflineAmount]);

  const amountToApprove = useMemo(() => {
    if (approvalMode === 'FULL') return remainingDue;
    const parsed = parseFloat(customAmountStr);
    return isNaN(parsed) || parsed <= 0 ? 0 : parsed;
  }, [approvalMode, customAmountStr, remainingDue]);

  const remainingAfterApproval = Math.max(0, remainingDue - amountToApprove);
  const willBeFullyPaid = remainingAfterApproval === 0;

  if (!invoice) return null;

  const invNo = invoice.invoiceNumber || invoice._id || '—';
  const unitStr = invoice.unitNumber ? `Villa ${invoice.unitNumber}` : '—';
  const residentStr = invoice.targetUser || 'Resident';

  const status = invoice.status || 'UNPAID';
  const isPendingVerification = status === 'VERIFICATION_PENDING';
  const isUnpaid = status === 'UNPAID' || status === 'OVERDUE' || status === 'PARTIALLY_PAID';
  const refStr = invoice.offlineReference || '—';
  const methodStr = (invoice.paymentMethod || 'BANK_TRANSFER').toUpperCase();
  const methodMeta = getMethodMeta(invoice.paymentMethod);
  const isCash = methodStr === 'CASH';

  const handleShareReceipt = async () => {
    try {
      await Share.share({
        title: `Invoice Statement #${invNo}`,
        message: `Nahom Statement #${invNo}\nUnit: ${unitStr}\nAmount: ₹${totalAmount.toLocaleString('en-IN')}\nStatus: ${status.replace(/_/g, ' ')}\nMethod: ${methodMeta.label}\nRef: ${refStr}`,
      });
    } catch (err: any) {
      Alert.alert('Share Failed', err.message || 'Unable to share statement.');
    }
  };

  const handleConfirmApprove = async () => {
    if (!onApproveOffline || !invoice._id || isApproving || amountToApprove <= 0) return;
    setIsApproving(true);
    try {
      await onApproveOffline(invoice._id, {
        amount: amountToApprove,
        settlementType: willBeFullyPaid ? 'FULL' : 'CUSTOM',
      });
      setIsApproving(false);
      setShowConfirmModal(false);
      onClose();
      Alert.alert(
        'Payment Verified & Recorded',
        `Settled ₹${amountToApprove.toLocaleString('en-IN')} via ${methodMeta.label} for Invoice #${invNo}. Status is now ${willBeFullyPaid ? 'PAID' : 'PARTIALLY_PAID'}.`
      );
    } catch (err: any) {
      setIsApproving(false);
      setShowConfirmModal(false);
      const isConflict = err?.statusCode === 409 || String(err).includes('409') || String(err).includes('already');
      Alert.alert(
        isConflict ? 'Already Processed' : 'Approval Failed',
        isConflict
          ? `Invoice #${invNo} has already been updated or settled by another administrator.`
          : (err?.message || err || 'Could not clear offline payment.')
      );
    }
  };

  const handleConfirmReject = async () => {
    if (!invoice._id || isRejecting) return;
    setIsRejecting(true);
    try {
      if (onRejectOffline) {
        await onRejectOffline(invoice._id, rejectReason.trim());
      }
      setIsRejecting(false);
      setShowRejectModal(false);
      onClose();
      Alert.alert('Submission Rejected', `Offline payment for Invoice #${invNo} has been rejected.`);
    } catch (err: any) {
      setIsRejecting(false);
      setShowRejectModal(false);
      Alert.alert('Rejection Failed', err?.message || err || 'Could not reject payment submission.');
    }
  };

  const handleSendInAppReminder = async () => {
    if (!invoice._id || isSendingReminder) return;
    setIsSendingReminder(true);
    try {
      await billingService.sendInvoiceReminder(invoice._id);
      setIsSendingReminder(false);
      Alert.alert(
        'Reminder Sent',
        `In-app notification reminder sent to ${residentStr} for Invoice #${invNo}.`
      );
    } catch (err: any) {
      setIsSendingReminder(false);
      Alert.alert('Reminder Failed', err?.message || err || 'Could not send reminder notification.');
    }
  };

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} title={`Invoice Review • #${invNo}`}>
        <View className="py-2 gap-4">

          {/* Pending Verification Notice */}
          {isPendingVerification ? (
            <View className={`border rounded-xl p-4 flex-row items-start ${methodMeta.badgeBg}`}>
              <Icon as={methodMeta.icon} size={22} className={`me-3 mt-0.5 ${methodMeta.iconColor}`} />
              <View className="flex-1">
                <Text className={`text-sm font-bold ${methodMeta.textColor}`}>
                  {`${methodMeta.label} Clearance Pending`}
                </Text>
                <Text className={`text-xs mt-1 ${methodMeta.subTextColor}`}>
                  Resident submitted ₹{submittedOfflineAmount.toLocaleString('en-IN')} via {methodMeta.label} ({methodMeta.refLabel}: #{refStr}). Select settlement option below.
                </Text>
              </View>
            </View>
          ) : null}

          {/* Resident Submission Details & Proof Preview */}
          {isPendingVerification && (invoice.payerNotes || invoice.paymentScreenshot || invoice.offlineReference) ? (
            <View className="bg-card border border-border rounded-xl p-4 gap-3">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Resident Submission Details
              </Text>

              {/* Reference & Method Row */}
              <View className="bg-muted/30 border border-border/50 rounded-lg p-3 flex-row items-center justify-between">
                <View>
                  <Text className="text-[11px] text-muted-foreground">{methodMeta.refLabel}</Text>
                  <Text className="text-sm font-bold text-foreground">{refStr}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-[11px] text-muted-foreground">Payment Method</Text>
                  <Text className="text-sm font-bold text-foreground">{methodMeta.label}</Text>
                </View>
              </View>

              {/* Payer Remarks Note */}
              {invoice.payerNotes ? (
                <View className="bg-muted/40 border border-border/60 rounded-lg p-3">
                  <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Payer Description / Remarks
                  </Text>
                  <Text className="text-xs text-foreground leading-relaxed">
                    {invoice.payerNotes}
                  </Text>
                </View>
              ) : null}

              {/* Attached Payment Proof Card */}
              {invoice.paymentScreenshot ? (
                <View className="bg-muted/20 border border-border/60 rounded-lg p-3 gap-2">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1.5">
                      <Icon as={FileText} size={15} className="text-primary" />
                      <Text className="text-xs font-bold text-foreground">Attached Proof of Payment</Text>
                    </View>
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
                      className="rounded-lg overflow-hidden border border-border/70 mt-1 bg-muted/40 items-center justify-center h-44"
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
                      className="flex-row items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border/70 mt-1"
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
            </View>
          ) : null}

          {/* Admin Settlement Option Selector (for pending verification) */}
          {isPendingVerification ? (
            <View className="bg-card border border-border rounded-xl p-4 gap-3">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Requested Settlement Amount
              </Text>



              {/* Remaining calculation preview */}
              <View className="bg-muted/30 border border-border/60 rounded-lg p-3 flex-row items-center justify-between">
                <View>
                  <Text className="text-xs text-muted-foreground">Clearing Amount</Text>
                  <Text className="text-base font-extrabold text-foreground">
                    ₹{amountToApprove.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-muted-foreground">Remaining Dues After Approval</Text>
                  <Text className={`text-base font-extrabold ${remainingAfterApproval > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-status-success'}`}>
                    ₹{remainingAfterApproval.toLocaleString('en-IN')} ({willBeFullyPaid ? 'PAID' : 'PARTIAL'})
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Detailed Invoice & Payment Section */}
          <DetailSection title="Transaction Details">
            <DetailRow
              label="Assessment Purpose"
              value={invoice.assessmentName || (invoice as any).snapshot?.assessmentName || 'Monthly Maintenance Assessment'}
            />
            <DetailRow label="Unit & Resident" value={`${unitStr} (${residentStr})`} />
            <DetailRow label="Billing Period" value={invoice.billingPeriodString || 'Current'} />
            <DetailRow label="Invoice Total" value={`₹${totalAmount.toLocaleString('en-IN')}`} />
            {paidAmount > 0 ? (
              <DetailRow label="Paid Amount" value={`₹${paidAmount.toLocaleString('en-IN')}`} />
            ) : null}
            {remainingDue > 0 ? (
              <DetailRow label="Remaining Liability" value={`₹${remainingDue.toLocaleString('en-IN')}`} />
            ) : null}
            <DetailRow label="Payment Method" value={methodMeta.label} />
            {refStr !== '—' ? (
              <DetailRow label={methodMeta.refLabel} value={refStr} copyable />
            ) : null}
            {invoice.payerNotes ? (
              <DetailRow label="Payer Remarks" value={invoice.payerNotes} />
            ) : null}
            {invoice.paymentScreenshot ? (
              <DetailRow
                label="Attached Proof"
                value={isImageProof(invoice.paymentScreenshot) ? 'Payment Screenshot' : 'Proof Document'}
              />
            ) : null}
            <DetailRow label="Status" value={status.replace(/_/g, ' ')} />
          </DetailSection>

          {/* Action CTAs */}
          <View className="gap-2.5 pt-2">
            {/* Direct Link to Child Invoice Details Screen */}
            <Button
              variant="outline"
              size="lg"
              className="w-full border-primary/40"
              leftIcon={FileText}
              onPress={() => {
                onClose();
                router.navigate(`/(resident)/billing/invoice/${invoice._id || invoice.invoiceNumber}` as any);
              }}
              accessibilityRole="button"
              accessibilityLabel="View Full Invoice Statement and Itemized Breakdown"
            >
              View Full Invoice Statement
            </Button>

            {isPendingVerification && onApproveOffline ? (
              <View className="gap-2">
                <Button
                  variant="default"
                  size="lg"
                  className="w-full bg-status-success active:bg-status-success/90"
                  disabled={isApproving || isRejecting || amountToApprove <= 0}
                  loading={isApproving}
                  onPress={() => setShowConfirmModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Approve and Clear Offline Payment"
                >
                  {willBeFullyPaid
                    ? `Mark as Paid • Full ₹${amountToApprove.toLocaleString('en-IN')}`
                    : `Approve Custom Amount • ₹${amountToApprove.toLocaleString('en-IN')}`}
                </Button>

                {onRejectOffline ? (
                  <Button
                    variant="outline"
                    size="default"
                    className="w-full border-destructive/40"
                    textClassName="text-destructive font-bold"
                    disabled={isApproving || isRejecting}
                    loading={isRejecting}
                    onPress={() => setShowRejectModal(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Reject Payment Submission"
                  >
                    Reject Submission
                  </Button>
                ) : null}
              </View>
            ) : null}

            {isUnpaid && !isPendingVerification && onSettleOfflineModal ? (
              <Button
                variant="outline"
                size="lg"
                className="w-full border-emerald-500/30 bg-emerald-500/10"
                textClassName="font-bold text-emerald-600 dark:text-emerald-400"
                onPress={() => {
                  onClose();
                  onSettleOfflineModal(invoice);
                }}
                accessibilityRole="button"
                accessibilityLabel="Record Offline Settlement"
              >
                Record Offline Settlement
              </Button>
            ) : null}

            {status !== 'PAID' ? (
              <Button
                variant="outline"
                size="lg"
                className="w-full border-primary/50"
                textClassName="text-primary font-bold"
                leftIcon={Bell}
                disabled={isApproving || isRejecting || isSendingReminder}
                loading={isSendingReminder}
                onPress={handleSendInAppReminder}
                accessibilityRole="button"
                accessibilityLabel="Send in-app reminder to resident"
              >
                Send In-App Reminder
              </Button>
            ) : null}

            <Button
              variant="outline"
              size="lg"
              className="w-full border-blue-500/30 bg-blue-500/10 active:bg-blue-500/20"
              onPress={handleShareReceipt}
              accessibilityRole="button"
              accessibilityLabel="Share or Print Statement"
            >
              <Text className="font-bold text-base text-blue-600 dark:text-blue-400">
                Share / Print Statement
              </Text>
            </Button>
          </View>
        </View>
      </BottomSheet>

      {/* Confirmation Modal for Clearance */}
      <ConfirmationModal
        visible={showConfirmModal}
        title={willBeFullyPaid ? 'Mark Invoice as Paid?' : 'Approve Custom Amount?'}
        message={`Confirm approval of ₹${amountToApprove.toLocaleString('en-IN')} via ${methodMeta.label} (${methodMeta.refLabel}: #${refStr}) for Invoice #${invNo}. Status will update to ${willBeFullyPaid ? 'PAID' : 'PARTIALLY_PAID (Remaining: ₹' + remainingAfterApproval.toLocaleString('en-IN') + ')'}.`}
        confirmLabel={willBeFullyPaid ? 'Mark as Paid' : 'Approve Partial'}
        cancelLabel="Cancel"
        variant="info"
        loading={isApproving}
        onConfirm={handleConfirmApprove}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* Confirmation Modal for Payment Rejection */}
      <ConfirmationModal
        visible={showRejectModal}
        title="Reject Payment Submission?"
        message={`Are you sure you want to reject the payment submission (Ref #${refStr}) for Invoice #${invNo}? The invoice will revert to its previous unpaid balance status.`}
        confirmLabel="Reject Submission"
        cancelLabel="Cancel"
        variant="danger"
        loading={isRejecting}
        onConfirm={handleConfirmReject}
        onCancel={() => setShowRejectModal(false)}
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
    </>
  );
}

export default InvoiceActionsBottomSheet;

