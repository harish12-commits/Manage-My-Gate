/**
 * NAHOM / Connect Harmony - Mobile Phase 3: FinancialHistoryItemCard
 * Reuses ListCard and StatusBadge from Mobile Component Catalog.
 * Strictly presentation-only.
 */

import React from 'react';
import { View } from 'react-native';
import { ListCard } from '@/components/ui/ListCard';
import { Text } from '@/components/ui/text';
import { getStatusVariant, type StatusVariant } from '@/components/ui/StatusBadge';
import {
  Receipt,
  CalendarCheck,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  CreditCard,
} from 'lucide-react-native';
import { FinancialHistoryItem } from '../types/financialHistory.types';

export interface FinancialHistoryItemCardProps {
  item: FinancialHistoryItem;
  onPress: (item: FinancialHistoryItem) => void;
  className?: string;
}

export function FinancialHistoryItemCard({
  item,
  onPress,
  className = '',
}: FinancialHistoryItemCardProps) {
  // Determine contextual icon and icon background
  let icon = Receipt;
  let iconBgClass = 'bg-primary/10';
  let iconTextClass = 'text-primary';

  switch (item.type) {
    case 'INVOICE':
      icon = Receipt;
      iconBgClass = 'bg-primary/10';
      iconTextClass = 'text-primary';
      break;
    case 'AMENITY':
      icon = CalendarCheck;
      iconBgClass = 'bg-accent/15';
      iconTextClass = 'text-accent';
      break;
    case 'WALLET_TRANSACTION':
      if (item.isCredit) {
        icon = ArrowDownLeft;
        iconBgClass = 'bg-status-success/15';
        iconTextClass = 'text-status-success';
      } else {
        icon = ArrowUpRight;
        iconBgClass = 'bg-muted';
        iconTextClass = 'text-muted-foreground';
      }
      break;
    case 'REFUND':
      icon = RotateCcw;
      iconBgClass = 'bg-status-info/15';
      iconTextClass = 'text-status-info';
      break;
    case 'PAYMENT':
      icon = CreditCard;
      iconBgClass = 'bg-primary/10';
      iconTextClass = 'text-primary';
      break;
  }

  // Format date
  const dateStr = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recent';

  // Format amount
  const absAmount = Math.abs(item.amount || 0);
  const formattedAmount = `${item.isCredit ? '+' : ''}₹${absAmount.toLocaleString('en-IN')}`;

  // Status variant
  const statusVariant: StatusVariant = getStatusVariant(item.status);
  const statusLabel = item.status.replace(/_/g, ' ');

  const subtitleText = item.subtitle ? `${dateStr} • ${item.subtitle}` : dateStr;

  return (
    <ListCard
      title={item.title}
      subtitle={subtitleText}
      leftIcon={icon}
      leftIconBgColor={iconBgClass}
      status={{
        label: statusLabel,
        variant: statusVariant,
      }}
      showChevron
      onPress={() => onPress(item)}
      className={`mb-2.5 ${className}`}
      rightContent={
        <View className="items-end justify-center ms-2 shrink-0">
          <Text
            className={`text-base font-extrabold ${
              item.isCredit ? 'text-status-success' : 'text-foreground'
            }`}
          >
            {formattedAmount}
          </Text>
        </View>
      }
    />
  );
}

export default FinancialHistoryItemCard;
