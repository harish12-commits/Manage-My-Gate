import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { StatusBadge, getStatusVariant, type StatusVariant } from '@/components/ui/StatusBadge';
import { CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw } from 'lucide-react-native';
import { InvoiceStatus } from '../types';

export interface PaymentResultHeroCardProps {
  status: InvoiceStatus | string;
  amount: number;
  paidAmount?: number;
  remainingDue?: number;
  invoiceNumber?: string;
  unitName?: string;
  reference?: string;
  rejectionReason?: string;
  className?: string;
}

interface OutcomeConfig {
  icon: any;
  iconBgClass: string;
  iconTextClass: string;
  badgeVariant: StatusVariant;
  subTitle?: string;
  title: string;
  description: string;
}

function resolveOutcomeConfig({
  isPaid,
  isPartial,
  isPending,
  isChecking,
  isRejected,
  isFailed,
  isCancelled,
  invoiceNumber,
  unitName,
  reference,
  rejectionReason,
  remainingDue,
  defaultVariant,
}: {
  isPaid: boolean;
  isPartial: boolean;
  isPending: boolean;
  isChecking: boolean;
  isRejected: boolean;
  isFailed: boolean;
  isCancelled: boolean;
  invoiceNumber: string;
  unitName: string;
  reference: string;
  rejectionReason?: string;
  remainingDue: number;
  defaultVariant: StatusVariant;
}): OutcomeConfig {
  if (isPaid) {
    return {
      icon: CheckCircle2,
      iconBgClass: 'bg-status-success/15',
      iconTextClass: 'text-status-success',
      badgeVariant: 'success',
      title: 'Payment Confirmed!',
      description: `Invoice #${invoiceNumber} for ${unitName} has been fully settled.`,
    };
  }

  if (isChecking) {
    return {
      icon: RefreshCw,
      iconBgClass: 'bg-primary/10',
      iconTextClass: 'text-primary',
      badgeVariant: 'info',
      subTitle: 'Payment is being verified',
      title: "We're checking your payment status.",
      description: 'Your payment request may already have reached the server. Do not submit another payment while we verify. Verifying authoritative settlement with the server.',
    };
  }

  if (isPartial) {
    return {
      icon: Clock,
      iconBgClass: 'bg-status-warning/15',
      iconTextClass: 'text-status-warning',
      badgeVariant: 'warning',
      title: 'Partial Payment Received',
      description: `Partially settled balance. Remaining due: ₹${remainingDue.toLocaleString('en-IN')}.`,
    };
  }

  if (isPending) {
    return {
      icon: Clock,
      iconBgClass: 'bg-primary/10',
      iconTextClass: 'text-primary',
      badgeVariant: 'warning',
      subTitle: 'Submitted for Verification',
      title: 'Payment submitted — awaiting verification.',
      description: `Offline ref #${reference} submitted and pending admin clearance verification.`,
    };
  }

  if (isRejected) {
    return {
      icon: XCircle,
      iconBgClass: 'bg-destructive/15',
      iconTextClass: 'text-destructive',
      badgeVariant: 'danger',
      title: 'Payment submission rejected.',
      description: rejectionReason
        ? `Reason: ${rejectionReason}. Please check your details and try again.`
        : 'Your offline payment submission was reviewed and rejected by management.',
    };
  }

  if (isFailed) {
    return {
      icon: XCircle,
      iconBgClass: 'bg-destructive/15',
      iconTextClass: 'text-destructive',
      badgeVariant: 'danger',
      title: 'Payment Failed',
      description: 'Your transaction could not be completed by the gateway.',
    };
  }

  if (isCancelled) {
    return {
      icon: AlertCircle,
      iconBgClass: 'bg-muted',
      iconTextClass: 'text-muted-foreground',
      badgeVariant: 'neutral',
      title: 'Payment Cancelled',
      description: 'No funds were deducted from your account.',
    };
  }

  return {
    icon: RefreshCw,
    iconBgClass: 'bg-muted',
    iconTextClass: 'text-muted-foreground',
    badgeVariant: defaultVariant,
    title: 'Payment Status Unknown',
    description: 'Network status unknown. Please check payment status before retrying.',
  };
}

export function PaymentResultHeroCard({
  status,
  amount,
  paidAmount,
  remainingDue = 0,
  invoiceNumber = '—',
  unitName = 'Villa Unit',
  reference = '—',
  rejectionReason,
  className = '',
}: PaymentResultHeroCardProps) {
  const normStatus = String(status || 'UNPAID');
  const statusVariant = getStatusVariant(normStatus);

  const isPaid = normStatus === 'PAID' || normStatus === 'SUCCESS';
  const isChecking = normStatus === 'CHECKING' || normStatus === 'PAYMENT_CHECKING';
  const isPartial = normStatus === 'PARTIALLY_PAID' || ((paidAmount || 0) > 0 && remainingDue > 0);
  const isPending = normStatus === 'VERIFICATION_PENDING' || normStatus === 'PENDING';
  const isRejected = normStatus === 'REJECTED';
  const isFailed = normStatus === 'FAILED';
  const isCancelled = normStatus === 'CANCELLED';

  const displayAmount = isPaid ? amount : (paidAmount || amount);

  const outcome = resolveOutcomeConfig({
    isPaid,
    isPartial,
    isPending,
    isChecking,
    isRejected,
    isFailed,
    isCancelled,
    invoiceNumber,
    unitName,
    reference,
    rejectionReason,
    remainingDue,
    defaultVariant: isChecking ? 'info' : statusVariant,
  });

  return (
    <View
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`Payment outcome: ${outcome.title}. Amount: ₹${displayAmount.toLocaleString('en-IN')}`}
      className={`bg-card border border-border rounded-2xl p-6 items-center shadow-xs ${className}`}
    >
      {/* Header Outcome Icon */}
      <View className={`w-16 h-16 rounded-full items-center justify-center mb-3 ${outcome.iconBgClass}`}>
        <Icon as={outcome.icon} size={36} className={outcome.iconTextClass} />
      </View>

      {/* Sub-headline category tag if present */}
      {outcome.subTitle ? (
        <Text className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
          {outcome.subTitle}
        </Text>
      ) : null}

      {/* Main Headline Title */}
      <Text className="text-xl font-extrabold text-foreground text-center mb-1">
        {outcome.title}
      </Text>

      {/* Numerical Amount */}
      <Text className="text-3xl font-black text-foreground tracking-tight my-1">
        ₹{displayAmount.toLocaleString('en-IN')}
      </Text>

      {/* Contextual Subtitle Description */}
      <Text className="text-xs text-muted-foreground text-center mt-1 px-4 leading-relaxed">
        {outcome.description}
      </Text>

      {/* Status Pill Badge */}
      <View className="mt-3">
        <StatusBadge label={normStatus.replace(/_/g, ' ')} variant={outcome.badgeVariant} dot />
      </View>
    </View>
  );
}

export default PaymentResultHeroCard;
