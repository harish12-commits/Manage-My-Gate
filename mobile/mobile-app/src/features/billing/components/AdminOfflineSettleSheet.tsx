import React, { useState, useEffect, useMemo } from 'react';
import { View, TouchableOpacity, Alert, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/forms/TextInput';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { AttachmentPicker, Attachment } from '@/components/ui/AttachmentPicker';
import {
  Banknote,
  Landmark,
  Smartphone,
  FileCheck,
  Building2,
  Check,
  Clock,
  CheckCircle2,
  FileText,
  Download,
  Printer,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';
import { Invoice } from '../types';
import { generateInvoiceHtml, exportInvoiceHtmlDocument } from '../utils/invoicePdfUtility';
import billingService from '../services/billingService';

export type AdminOfflinePaymentType = 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'DEMAND_DRAFT';

interface AdminPaymentMethodOption {
  key: AdminOfflinePaymentType;
  label: string;
  sublabel: string;
  icon: any;
  prefix: string;
  placeholder: string;
  refLabel?: string;
}

export const ADMIN_OFFLINE_METHODS: AdminPaymentMethodOption[] = [
  {
    key: 'CASH',
    label: 'Cash',
    sublabel: 'Office Cash',
    icon: Banknote,
    prefix: 'CASH',
    placeholder: 'e.g. Receipt # or cash memo (Optional)',
    refLabel: '3. Reference / Receipt Number (Optional)',
  },
  {
    key: 'BANK_TRANSFER',
    label: 'Bank Transfer',
    sublabel: 'NEFT / RTGS / IMPS',
    icon: Landmark,
    prefix: 'BANK',
    placeholder: 'e.g. UTR / IMPS / NEFT Reference Number',
    refLabel: '3. Bank UTR / Reference Number',
  },
  {
    key: 'UPI',
    label: 'UPI / QR',
    sublabel: 'GPay, PhonePe, Paytm',
    icon: Smartphone,
    prefix: 'UPI',
    placeholder: 'e.g. 12-digit UPI Reference / UTR',
    refLabel: '3. UPI Reference / UTR (12 Digits)',
  },
  {
    key: 'CHEQUE',
    label: 'Cheque',
    sublabel: 'Bank Cheque',
    icon: FileCheck,
    prefix: 'CHQ',
    placeholder: 'e.g. Cheque #004521, HDFC Bank',
    refLabel: '3. Cheque Number & Bank Name',
  },
  {
    key: 'DEMAND_DRAFT',
    label: 'Demand Draft',
    sublabel: 'Bank DD',
    icon: Building2,
    prefix: 'DD',
    placeholder: 'e.g. DD #771234, SBI Bank',
    refLabel: '3. Demand Draft Number & Bank',
  },
];

export interface AdminOfflineSettleSheetProps {
  visible: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSuccess?: (updatedInvoice: any) => void;
  communityName?: string;
}

export function AdminOfflineSettleSheet({
  visible,
  onClose,
  invoice,
  onSuccess,
  communityName = 'Community Workspace',
}: AdminOfflineSettleSheetProps) {
  // Method: All 5 offline payment channels
  const [paymentMethod, setPaymentMethod] = useState<AdminOfflinePaymentType>('CASH');
  // Amount Mode: Full or Custom
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'CUSTOM'>('FULL');
  const [customAmountStr, setCustomAmountStr] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Flow State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Post-payment success state
  const [settledResult, setSettledResult] = useState<any | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Financial figures
  const totalDue = invoice?.totalDue ?? invoice?.amount ?? 0;
  const paidAmount = invoice?.paidAmount ?? 0;
  const remainingDue =
    (invoice as any)?.outstandingAmount !== undefined
      ? (invoice as any).outstandingAmount
      : Math.max(0, totalDue - paidAmount);

  const amountToSettle = useMemo(() => {
    if (paymentMode === 'FULL') return remainingDue;
    const parsed = parseFloat(customAmountStr);
    return isNaN(parsed) || parsed <= 0 ? 0 : parsed;
  }, [paymentMode, customAmountStr, remainingDue]);

  const remainingAfterPayment = Math.max(0, Math.round((remainingDue - amountToSettle) * 100) / 100);
  const willBeFullyPaid = remainingAfterPayment === 0;

  const isReferenceRequired = paymentMethod !== 'CASH';
  const isReferenceMissing = isReferenceRequired && !referenceNumber.trim();
  const isAmountTooHigh = amountToSettle > remainingDue;
  const isFormInvalid = isAmountTooHigh || amountToSettle <= 0 || isReferenceMissing;

  // Reset form upon opening
  useEffect(() => {
    if (visible && invoice) {
      setPaymentMethod('CASH');
      setPaymentMode('FULL');
      setCustomAmountStr('');
      setReferenceNumber('');
      setNotes('');
      setAttachments([]);
      setError(null);
      setIsSubmitting(false);
      setShowConfirmModal(false);
      setSettledResult(null);
    }
  }, [visible, invoice, remainingDue]);

  const currentMethodOption = useMemo(() => {
    return ADMIN_OFFLINE_METHODS.find((m) => m.key === paymentMethod) || ADMIN_OFFLINE_METHODS[0];
  }, [paymentMethod]);

  // Clear reference when payment method changes so the method's placeholder shows
  const handleMethodChange = (method: AdminOfflinePaymentType) => {
    setPaymentMethod(method);
    setReferenceNumber('');
  };

  if (!invoice) return null;

  const invNo = invoice.invoiceNumber || invoice._id || '—';
  const unitStr = invoice.unitNumber ? `Villa ${invoice.unitNumber}` : 'Villa Unit';
  const residentStr = invoice.targetUser || (invoice as any)?.residentName || 'Resident';

  const handleRecordPayment = async () => {
    if (!invoice._id || isFormInvalid || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // Upload proof attachment if attached
      let uploadedProofUrl: string | undefined;
      if (attachments.length > 0) {
        try {
          const formData = new FormData();
          const fileItem = attachments[0];
          if (Platform.OS === 'web' && fileItem.file) {
            formData.append('proof', fileItem.file);
          } else {
            formData.append('proof', {
              uri: fileItem.uri,
              name: fileItem.name || 'admin_proof.jpg',
              type: fileItem.type || 'image/jpeg',
            } as any);
          }
          const uploadRes = await billingService.uploadProof(formData);
          uploadedProofUrl = uploadRes?.url;
        } catch (uploadErr) {
          console.warn('[AdminOfflineSettleSheet] Proof upload fallback to local URI:', uploadErr);
          uploadedProofUrl = attachments[0].uri;
        }
      }

      const effectiveRef = referenceNumber.trim() || undefined;

      const payload = {
        amount: amountToSettle,
        settlementType: willBeFullyPaid ? ('FULL' as const) : ('CUSTOM' as const),
        paymentMethod,
        paymentReference: effectiveRef,
        reference: effectiveRef,
        notes: notes.trim() || undefined,
        paymentScreenshot: uploadedProofUrl,
      };

      const result = await billingService.approveInvoiceOffline(invoice._id, payload);

      setIsSubmitting(false);
      setShowConfirmModal(false);
      setSettledResult(result);
      if (onSuccess) onSuccess(result);
    } catch (err: any) {
      setIsSubmitting(false);
      setShowConfirmModal(false);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to record offline payment';
      setError(errMsg);
      Alert.alert('Payment Recording Failed', errMsg);
    }
  };

  // PDF Actions
  const handlePdfAction = async (action: 'download' | 'print') => {
    try {
      setIsExportingPdf(true);
      const targetInvoice = settledResult || {
        ...invoice,
        paidAmount: (invoice.paidAmount || 0) + amountToSettle,
        outstandingAmount: remainingAfterPayment,
        status: willBeFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
        paymentMethod,
        offlineReference: referenceNumber,
      };

      const html = generateInvoiceHtml(targetInvoice, {
        communityName,
        residentName: residentStr,
      });

      const filename = `Invoice_${invNo}_${paymentMethod}.html`;
      await exportInvoiceHtmlDocument(html, filename, `Invoice Statement #${invNo}`, { action });
      setIsExportingPdf(false);
    } catch (pdfErr: any) {
      setIsExportingPdf(false);
      Alert.alert('PDF Generation Failed', pdfErr?.message || 'Unable to render invoice PDF.');
    }
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title={settledResult ? `Receipt Generated • #${invNo}` : `Record Offline Payment • #${invNo}`}
      >
        <View className="py-2 pb-3">
          {error ? (
            <View className="mb-3">
              <ErrorBanner message={error} onDismiss={() => setError(null)} />
            </View>
          ) : null}

          {/* If already settled successfully, show PDF actions and summary */}
          {settledResult ? (
            <View className="gap-4">
              <View className="bg-status-success/10 border border-status-success/30 rounded-2xl p-5 items-center justify-center">
                <View className="w-12 h-12 rounded-full bg-status-success/20 items-center justify-center mb-2">
                  <Icon as={CheckCircle2} size={28} className="text-status-success" />
                </View>
                <Text className="font-extrabold text-lg text-foreground text-center">
                  Payment Recorded Successfully!
                </Text>
                <Text className="text-xs text-muted-foreground text-center mt-1">
                  ₹{amountToSettle.toLocaleString('en-IN')} received via {currentMethodOption.label} for {unitStr}. Notification has been dispatched to {residentStr}.
                </Text>

                <View className="mt-3 flex-row items-center gap-2">
                  <StatusBadge
                    label={willBeFullyPaid ? 'FULLY PAID' : 'PARTIALLY PAID'}
                    variant={willBeFullyPaid ? 'success' : 'warning'}
                  />
                  {remainingAfterPayment > 0 ? (
                    <Text className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      Remaining: ₹{remainingAfterPayment.toLocaleString('en-IN')}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* PDF Actions CTA */}
              <View className="bg-card border border-border rounded-xl p-4 gap-3">
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Invoice & Statement Documents
                </Text>

                <View className="flex-row gap-2.5">
                  <Button
                    variant="outline"
                    size="default"
                    className="flex-1 flex-row items-center justify-center gap-2 border-primary/40 bg-primary/10"
                    onPress={() => handlePdfAction('print')}
                    disabled={isExportingPdf}
                    accessibilityRole="button"
                    accessibilityLabel="View PDF Invoice"
                  >
                    <Icon as={Printer} size={16} className="text-primary" />
                    <Text className="text-primary font-bold text-sm">View PDF</Text>
                  </Button>

                  <Button
                    variant="default"
                    size="default"
                    className="flex-1 flex-row items-center justify-center gap-2 bg-primary"
                    onPress={() => handlePdfAction('download')}
                    disabled={isExportingPdf}
                    accessibilityRole="button"
                    accessibilityLabel="Download PDF Invoice"
                  >
                    <Icon as={Download} size={16} className="text-primary-foreground" />
                    <Text className="text-primary-foreground font-bold text-sm">Download PDF</Text>
                  </Button>
                </View>
              </View>

              <Button
                variant="secondary"
                size="lg"
                className="w-full mt-2"
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close Settlement Sheet"
              >
                <Text className="font-bold text-sm text-foreground">Done</Text>
              </Button>
            </View>
          ) : (
            // Offline Payment Form (All 5 Offline Channels, Full & Custom Amount)
            <View className="gap-4">
              {/* Unit & Due Summary Header */}
              <View className="bg-muted/40 border border-border/60 rounded-xl p-3.5 flex-row items-center justify-between">
                <View>
                  <Text className="text-xs text-muted-foreground">Target Unit & Resident</Text>
                  <Text className="font-bold text-sm text-foreground">
                    {unitStr} ({residentStr})
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-muted-foreground">Current Outstanding</Text>
                  <Text className="text-base font-extrabold text-status-danger">
                    ₹{remainingDue.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              {/* 1. Payment Method: All 5 Channels */}
              <View className="gap-2">
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  1. Select Payment Method
                </Text>

                <View className="flex-row flex-wrap gap-2">
                  {ADMIN_OFFLINE_METHODS.map((method) => {
                    const isSelected = paymentMethod === method.key;
                    const MethodIcon = method.icon;
                    return (
                      <TouchableOpacity
                        key={method.key}
                        activeOpacity={0.8}
                        onPress={() => handleMethodChange(method.key)}
                        className={`p-2.5 rounded-xl border flex-row items-center gap-2 ${
                          isSelected
                            ? method.key === 'CASH'
                              ? 'bg-emerald-500/10 border-emerald-500'
                              : 'bg-primary/10 border-primary'
                            : 'bg-card border-border'
                        } ${method.key === 'DEMAND_DRAFT' ? 'w-full' : 'flex-1 min-w-[45%]'}`}
                      >
                        <View
                          className={`w-8 h-8 rounded-lg items-center justify-center ${
                            isSelected
                              ? method.key === 'CASH'
                                ? 'bg-emerald-500/20'
                                : 'bg-primary/20'
                              : 'bg-muted'
                          }`}
                        >
                          <Icon
                            as={MethodIcon}
                            size={16}
                            className={
                              isSelected
                                ? method.key === 'CASH'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-primary'
                                : 'text-muted-foreground'
                            }
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            className={`font-bold text-xs ${
                              isSelected
                                ? method.key === 'CASH'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-primary'
                                : 'text-foreground'
                            }`}
                            numberOfLines={1}
                          >
                            {method.label}
                          </Text>
                          <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
                            {method.sublabel}
                          </Text>
                        </View>
                        {isSelected ? (
                          <View
                            className={`w-4 h-4 rounded-full items-center justify-center ${
                              method.key === 'CASH' ? 'bg-emerald-500' : 'bg-primary'
                            }`}
                          >
                            <Check size={10} color="#ffffff" />
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 2. Amount Mode: Full vs Custom */}
              <View className="gap-2.5">
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  2. Settle Amount Mode
                </Text>

                {/* Option A: Full Amount */}
                <TouchableOpacity
                  onPress={() => setPaymentMode('FULL')}
                  activeOpacity={0.8}
                  className={`p-3.5 rounded-xl border flex-row items-center justify-between ${
                    paymentMode === 'FULL'
                      ? 'bg-status-success/10 border-status-success'
                      : 'bg-card border-border'
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className={`w-5 h-5 rounded-full border items-center justify-center ${
                        paymentMode === 'FULL'
                          ? 'border-status-success bg-status-success'
                          : 'border-muted-foreground'
                      }`}
                    >
                      {paymentMode === 'FULL' ? (
                        <Check size={12} className="text-primary-foreground" />
                      ) : null}
                    </View>
                    <View>
                      <Text className="font-bold text-sm text-foreground">Full Amount</Text>
                      <Text className="text-xs text-muted-foreground">
                        Clear total remaining balance
                      </Text>
                    </View>
                  </View>
                  <Text className="text-base font-extrabold text-status-success">
                    ₹{remainingDue.toLocaleString('en-IN')}
                  </Text>
                </TouchableOpacity>

                {/* Option B: Custom Amount */}
                <TouchableOpacity
                  onPress={() => setPaymentMode('CUSTOM')}
                  activeOpacity={0.8}
                  className={`p-3.5 rounded-xl border ${
                    paymentMode === 'CUSTOM'
                      ? 'bg-primary/10 border-primary'
                      : 'bg-card border-border'
                  }`}
                >
                  <View className="flex-row items-center gap-3 mb-1">
                    <View
                      className={`w-5 h-5 rounded-full border items-center justify-center ${
                        paymentMode === 'CUSTOM'
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      }`}
                    >
                      {paymentMode === 'CUSTOM' ? (
                        <Check size={12} className="text-primary-foreground" />
                      ) : null}
                    </View>
                    <View>
                      <Text className="font-bold text-sm text-foreground">Custom Amount</Text>
                      <Text className="text-xs text-muted-foreground">
                        Settle partial payment and maintain remaining dues
                      </Text>
                    </View>
                  </View>

                  {paymentMode === 'CUSTOM' ? (
                    <View className="mt-2 ps-8">
                      <TextInput
                        label="Enter Amount Being Paid (₹)"
                        required
                        value={customAmountStr}
                        onChangeText={setCustomAmountStr}
                        placeholder={`Max ₹${remainingDue.toLocaleString('en-IN')}`}
                        keyboardType="numeric"
                        inputClassName="font-bold text-base"
                        error={
                          isAmountTooHigh
                            ? `Cannot exceed current due of ₹${remainingDue.toLocaleString('en-IN')}`
                            : undefined
                        }
                      />
                    </View>
                  ) : null}
                </TouchableOpacity>

                {/* Dynamic Remaining Balance Calculation Box */}
                <View className="bg-muted/40 border border-border/60 rounded-xl p-3 flex-row items-center justify-between">
                  <View>
                    <Text className="text-xs text-muted-foreground">Paid Amount Now</Text>
                    <Text className="text-base font-extrabold text-primary">
                      ₹{amountToSettle.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs text-muted-foreground">Remaining Amount</Text>
                    <Text
                      className={`text-base font-extrabold ${
                        remainingAfterPayment > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-status-success'
                      }`}
                    >
                      ₹{remainingAfterPayment.toLocaleString('en-IN')} (
                      {willBeFullyPaid ? 'FULLY PAID' : 'PARTIAL'})
                    </Text>
                  </View>
                </View>
              </View>

              {/* 3. Reference */}
              <View className="gap-1.5">
                <TextInput
                  label={currentMethodOption.refLabel || '3. Reference / Receipt Number'}
                  required={isReferenceRequired}
                  value={referenceNumber}
                  onChangeText={setReferenceNumber}
                  placeholder={currentMethodOption.placeholder}
                  leftIcon={FileText}
                />
                {isReferenceRequired && !referenceNumber.trim() ? (
                  <Text className="text-[11px] text-amber-600 dark:text-amber-400 ms-1">
                    * Mandatory: Enter transaction UTR, cheque #, or reference ID to record
                  </Text>
                ) : null}
              </View>

              {/* 4. Receipt / Proof Attachment (Optional) */}
              <View className="gap-1.5">
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  4. Receipt / Document Proof (Optional)
                </Text>
                <Text className="text-xs text-muted-foreground mb-1">
                  Attach physical cheque photo, bank deposit slip, or payment screenshot
                </Text>
                <AttachmentPicker
                  attachments={attachments}
                  onAdd={(newFiles) => setAttachments((prev) => [...prev, ...newFiles])}
                  onRemove={(idx) => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  maxFiles={1}
                  accept="images-and-pdf"
                />
              </View>

              {/* 5. Internal Notes */}
              <View className="gap-2.5">
                <TextInput
                  label="5. Internal Notes / Received From (Optional)"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Handed to facility manager / Cheque #1024"
                />
              </View>

              {/* Submit CTA */}
              <Button
                variant="default"
                size="lg"
                className="w-full flex-row items-center justify-center mt-1 bg-status-success active:bg-status-success/90"
                disabled={isFormInvalid || isSubmitting}
                loading={isSubmitting}
                onPress={() => {
                  if (isReferenceMissing) {
                    Alert.alert('Reference Required', `Please enter the transaction reference / UTR for ${currentMethodOption.label}.`);
                    return;
                  }
                  if (isFormInvalid) return;
                  setShowConfirmModal(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Record ${currentMethodOption.label} payment`}
              >
                <Text className="font-bold text-base text-primary-foreground me-1">
                  {`Record ${currentMethodOption.label} • ₹${amountToSettle.toLocaleString('en-IN')}`}
                </Text>
                <Icon as={ChevronRight} size={18} className="text-primary-foreground" />
              </Button>
            </View>
          )}
        </View>
      </BottomSheet>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showConfirmModal}
        title={`Confirm ${currentMethodOption.label} Settlement?`}
        message={`Confirm receiving ₹${amountToSettle.toLocaleString('en-IN')} via ${currentMethodOption.label} for Invoice #${invNo}.${referenceNumber.trim() ? ` (Ref: ${referenceNumber.trim()})` : ''} Status will update to ${willBeFullyPaid ? 'PAID' : 'PARTIALLY PAID'} with Remaining Due of ₹${remainingAfterPayment.toLocaleString('en-IN')}. A user notification will be dispatched.`}
        confirmLabel="Confirm & Record"
        cancelLabel="Cancel"
        variant="info"
        loading={isSubmitting}
        onConfirm={handleRecordPayment}
        onCancel={() => setShowConfirmModal(false)}
      />
    </>
  );
}

export default AdminOfflineSettleSheet;
