/**
 * NAHOM / Connect Harmony - Mobile Phase 6: Financial Support Modal
 *
 * Exposes safe, copyable operational support information for resident inquiries.
 * Strict privacy guarantee: Never exposes passwords, card numbers, CVVs, or gateway secrets.
 */

import React, { useState } from 'react';
import { View, ScrollView, Share, Platform } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Copy, Check, ShieldCheck, Share2 } from 'lucide-react-native';
import { FinancialOperationDiagnostic } from '../types/financialDiagnostics.types';
import { formatSupportInformation } from '../utils/financialDiagnostics';
import { useTranslation } from '@/src/utils/i18n';

export interface FinancialSupportModalProps {
  visible: boolean;
  onClose: () => void;
  diagnostic: FinancialOperationDiagnostic | null;
}

export function FinancialSupportModal({
  visible,
  onClose,
  diagnostic,
}: FinancialSupportModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<boolean>(false);

  if (!diagnostic) return null;

  const supportInfo = formatSupportInformation(diagnostic);

  const handleShareOrCopy = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(supportInfo.sanitizedSummaryText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        await Share.share({
          title: 'Financial Operation Support Information',
          message: supportInfo.sanitizedSummaryText,
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.warn('[FinancialSupportModal] Share/Copy failed:', err);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('support_info_title', 'Payment Support Information')}
    >
      <ScrollView className="py-2 pb-4 gap-4">
        {/* Security badge notice */}
        <View className="bg-primary/10 border border-primary/20 rounded-2xl p-3 flex-row items-center gap-2.5">
          <ShieldCheck size={20} className="text-primary shrink-0" />
          <Text className="text-xs text-muted-foreground flex-1 leading-relaxed">
            {t(
              'support_info_privacy_note',
              'This diagnostic payload is safe to share with resident support. It contains zero private credentials or payment card secrets.'
            )}
          </Text>
        </View>

        {/* Diagnostic Metadata Grid */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-3">
          {/* Operation ID */}
          <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
            <Text className="text-xs text-muted-foreground">
              {t('operation_id', 'Operation ID')}
            </Text>
            <Text className="text-xs font-mono font-bold text-foreground">
              {supportInfo.operationId}
            </Text>
          </View>

          {/* Reference Type & ID */}
          <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
            <Text className="text-xs text-muted-foreground">
              {t('reference', 'Reference')}
            </Text>
            <Text className="text-xs font-bold text-foreground">
              {supportInfo.referenceType} #{supportInfo.referenceId}
            </Text>
          </View>

          {/* Client State */}
          <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
            <Text className="text-xs text-muted-foreground">
              {t('client_state', 'Client State')}
            </Text>
            <StatusBadge
              label={supportInfo.clientState}
              variant={
                supportInfo.clientState === 'SUCCESS'
                  ? 'success'
                  : supportInfo.clientState === 'CHECKING'
                  ? 'info'
                  : supportInfo.clientState === 'REJECTED'
                  ? 'danger'
                  : 'warning'
              }
            />
          </View>

          {/* Server State */}
          <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
            <Text className="text-xs text-muted-foreground">
              {t('server_state', 'Server Status')}
            </Text>
            <Text className="text-xs font-bold text-foreground">
              {supportInfo.serverState}
            </Text>
          </View>

          {/* Amount if available */}
          {supportInfo.amountFormatted && (
            <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
              <Text className="text-xs text-muted-foreground">
                {t('amount', 'Amount')}
              </Text>
              <Text className="text-xs font-bold text-foreground">
                {supportInfo.amountFormatted}
              </Text>
            </View>
          )}

          {/* Payment Method / Ref */}
          {supportInfo.paymentReference && (
            <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
              <Text className="text-xs text-muted-foreground">
                {t('payment_reference', 'Payment Reference')}
              </Text>
              <Text className="text-xs font-mono font-semibold text-foreground">
                {supportInfo.paymentReference}
              </Text>
            </View>
          )}

          {/* Rejection Reason if any */}
          {supportInfo.rejectionReason && (
            <View className="flex-row justify-between items-center pb-2 border-b border-border/50">
              <Text className="text-xs text-destructive">
                {t('rejection_reason', 'Rejection Reason')}
              </Text>
              <Text className="text-xs font-semibold text-destructive max-w-[65%] text-right">
                {supportInfo.rejectionReason}
              </Text>
            </View>
          )}

          {/* Last Checked */}
          <View className="flex-row justify-between items-center">
            <Text className="text-xs text-muted-foreground">
              {t('last_checked', 'Last Checked')}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {new Date(supportInfo.lastCheckedAt || '').toLocaleTimeString()}
            </Text>
          </View>
        </View>

        {/* Action Button: Copy / Share Support Information */}
        <Button
          variant="outline"
          onPress={handleShareOrCopy}
          className="h-12 rounded-2xl flex-row items-center justify-center gap-2 border-primary/30 bg-primary/5 active:bg-primary/10"
          accessibilityRole="button"
          accessibilityLabel="Copy or share support information"
        >
          {copied ? (
            <>
              <Check size={18} className="text-status-success" />
              <Text className="font-bold text-status-success text-sm">
                {t('support_copied', 'Copied to Clipboard')}
              </Text>
            </>
          ) : (
            <>
              <Share2 size={18} className="text-primary" />
              <Text className="font-bold text-primary text-sm">
                {t('copy_support_info', 'Copy or Share Support Info')}
              </Text>
            </>
          )}
        </Button>
      </ScrollView>
    </BottomSheet>
  );
}

export default FinancialSupportModal;
