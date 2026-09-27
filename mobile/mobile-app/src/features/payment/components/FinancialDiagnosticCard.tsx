/**
 * NAHOM / Connect Harmony - Mobile Phase 6: FinancialDiagnosticCard
 *
 * Operational diagnostic card for in-flight, checking, pending-verification, or rejected financial operations.
 * Allows residents to check authoritative status and copy sanitized support details.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
} from 'lucide-react-native';
import { FinancialOperationDiagnostic } from '../types/financialDiagnostics.types';
import { generateFinancialTimeline } from '../utils/financialDiagnostics';
import { useTranslation } from '@/src/utils/i18n';

export interface FinancialDiagnosticCardProps {
  diagnostic: FinancialOperationDiagnostic;
  onCheckStatus: (diagnostic: FinancialOperationDiagnostic) => void;
  onOpenSupportInfo: (diagnostic: FinancialOperationDiagnostic) => void;
  isChecking?: boolean;
}

export function FinancialDiagnosticCard({
  diagnostic,
  onCheckStatus,
  onOpenSupportInfo,
  isChecking = false,
}: FinancialDiagnosticCardProps) {
  const { t } = useTranslation();
  const [timelineExpanded, setTimelineExpanded] = useState<boolean>(false);

  const clientState = diagnostic.clientState;
  const serverState = diagnostic.lastKnownServerState;
  const meta = diagnostic.metadata || {};
  const timelineSteps = generateFinancialTimeline(diagnostic);

  const isPendingVerification = clientState === 'PENDING_VERIFICATION' || serverState === 'VERIFICATION_PENDING';
  const isRejected = clientState === 'REJECTED' || serverState === 'REJECTED';
  const isRecoveryRequired = diagnostic.diagnosticState === 'RECOVERY_REQUIRED' || clientState === 'CHECKING';

  // Contextual title & description
  let title = t('financial_operation', 'Financial Operation');
  let description = t('checking_payment_status_desc', 'Verifying transaction status with the server.');
  let borderClass = 'border-border';
  let bgClass = 'bg-card';

  if (isPendingVerification) {
    title = t('verification_pending_title', 'Payment submitted — awaiting verification.');
    description = t(
      'verification_pending_desc',
      'Your offline payment submission is under review by management. Funds will be credited once verified.'
    );
    borderClass = 'border-amber-500/30';
    bgClass = 'bg-amber-500/5';
  } else if (isRejected) {
    title = t('rejection_title', 'Payment submission rejected.');
    description = meta.rejectionReason
      ? `${t('reason', 'Reason')}: ${meta.rejectionReason}`
      : t('rejection_generic_desc', 'Your submission was reviewed and rejected. Please review details.');
    borderClass = 'border-destructive/30';
    bgClass = 'bg-destructive/5';
  } else if (isRecoveryRequired) {
    title = t('checking_payment_status_title', "We're checking your payment status.");
    description = t(
      'checking_payment_status_desc',
      'Your payment request may already have reached the server. Do not submit another payment while we verify the result.'
    );
    borderClass = 'border-primary/30';
    bgClass = 'bg-primary/5';
  }

  const amountDisplay = meta.amount !== undefined ? `₹${meta.amount.toLocaleString('en-IN')}` : null;
  const referenceDisplay = meta.invoiceNumber
    ? `Invoice #${meta.invoiceNumber}`
    : meta.bookingId
    ? `Booking #${meta.bookingId}`
    : diagnostic.referenceId
    ? `Ref #${diagnostic.referenceId}`
    : `Operation #${diagnostic.operationId.slice(-6)}`;

  return (
    <View
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`Financial diagnostic: ${title}. ${referenceDisplay}. Status: ${clientState}`}
      className={`border rounded-2xl p-4 gap-3 shadow-2xs ${borderClass} ${bgClass}`}
    >
      {/* Header Row: Title & Amount */}
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <Text className="font-bold text-sm text-foreground" numberOfLines={2}>
            {title}
          </Text>
          <Text className="text-xs text-muted-foreground font-mono">
            {referenceDisplay}
          </Text>
        </View>
        {amountDisplay && (
          <Text className="font-extrabold text-base text-foreground">
            {amountDisplay}
          </Text>
        )}
      </View>

      {/* Status Badges Row */}
      <View className="flex-row items-center gap-2 flex-wrap">
        <StatusBadge
          label={clientState}
          variant={
            clientState === 'SUCCESS'
              ? 'success'
              : clientState === 'CHECKING'
              ? 'info'
              : clientState === 'REJECTED'
              ? 'danger'
              : 'warning'
          }
        />
        {serverState && (
          <View className="bg-muted px-2 py-0.5 rounded-full">
            <Text className="text-[11px] font-semibold text-muted-foreground">
              Server: {serverState}
            </Text>
          </View>
        )}
      </View>

      {/* Contextual Description */}
      <Text className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </Text>

      {/* Expandable Lifecycle Timeline */}
      {timelineSteps.length > 0 && (
        <View className="pt-1">
          <TouchableOpacity
            onPress={() => setTimelineExpanded(!timelineExpanded)}
            className="flex-row items-center justify-between py-1.5 min-h-[44px]"
            accessibilityRole="button"
            accessibilityLabel={timelineExpanded ? 'Hide operation timeline' : 'Show operation timeline'}
          >
            <Text className="text-xs font-semibold text-primary">
              {timelineExpanded ? t('hide_timeline', 'Hide Timeline') : t('view_timeline', 'View Operation Timeline')}
            </Text>
            {timelineExpanded ? (
              <ChevronUp size={16} className="text-primary" />
            ) : (
              <ChevronDown size={16} className="text-primary" />
            )}
          </TouchableOpacity>

          {timelineExpanded && (
            <View className="bg-card/80 border border-border/60 rounded-xl p-3 mt-1.5 gap-2.5">
              {timelineSteps.map((step, idx) => {
                const isStepCompleted = step.state === 'completed';
                const isStepCurrent = step.state === 'current';
                const isStepFailed = step.state === 'failed';

                return (
                  <View key={step.id} className="flex-row items-start gap-2.5">
                    <View className="items-center mt-0.5">
                      {isStepCompleted ? (
                        <CheckCircle2 size={16} className="text-status-success" />
                      ) : isStepFailed ? (
                        <AlertCircle size={16} className="text-destructive" />
                      ) : isStepCurrent ? (
                        <RefreshCw size={16} className="text-primary animate-spin" />
                      ) : (
                        <Clock size={16} className="text-muted-foreground" />
                      )}
                      {idx < timelineSteps.length - 1 && (
                        <View className="w-0.5 h-4 bg-border my-0.5" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-xs font-bold ${
                          isStepFailed
                            ? 'text-destructive'
                            : isStepCurrent
                            ? 'text-primary'
                            : 'text-foreground'
                        }`}
                      >
                        {step.title}
                      </Text>
                      <Text className="text-[11px] text-muted-foreground leading-tight">
                        {step.subtitle}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Action Row: Check Status & Support Info */}
      <View className="flex-row items-center gap-2 pt-1">
        <Button
          variant="default"
          onPress={() => onCheckStatus(diagnostic)}
          disabled={isChecking}
          className="flex-1 h-11 rounded-xl flex-row items-center justify-center gap-1.5"
          accessibilityRole="button"
          accessibilityLabel="Check status with server"
        >
          <RefreshCw size={15} className={`text-primary-foreground ${isChecking ? 'animate-spin' : ''}`} />
          <Text className="text-xs font-bold text-primary-foreground">
            {isChecking ? t('checking', 'Checking...') : t('check_status', 'Check Status')}
          </Text>
        </Button>

        <Button
          variant="outline"
          onPress={() => onOpenSupportInfo(diagnostic)}
          className="h-11 px-3.5 rounded-xl border-border bg-card flex-row items-center justify-center gap-1.5"
          accessibilityRole="button"
          accessibilityLabel="Open support and diagnostic details"
        >
          <Info size={15} className="text-foreground" />
          <Text className="text-xs font-semibold text-foreground">
            {t('support_info', 'Support Info')}
          </Text>
        </Button>
      </View>
    </View>
  );
}

export default FinancialDiagnosticCard;
