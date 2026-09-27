/**
 * NAHOM / Connect Harmony - Mobile Phase 6: FinancialRecoveryBanner
 *
 * Resident-facing Recovery Center surface displaying active/unresolved financial operations.
 * Allows instant verification with the server and inspection of diagnostic support data.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react-native';
import { FinancialOperationDiagnostic } from '../types/financialDiagnostics.types';
import { FinancialDiagnosticCard } from './FinancialDiagnosticCard';
import { useTranslation } from '@/src/utils/i18n';

export interface FinancialRecoveryBannerProps {
  unresolvedDiagnostics: FinancialOperationDiagnostic[];
  onCheckStatus: (diagnostic: FinancialOperationDiagnostic) => void;
  onOpenSupportInfo: (diagnostic: FinancialOperationDiagnostic) => void;
  onReconcileAll?: () => void;
  isReconciling?: boolean;
}

export function FinancialRecoveryBanner({
  unresolvedDiagnostics,
  onCheckStatus,
  onOpenSupportInfo,
  onReconcileAll,
  isReconciling = false,
}: FinancialRecoveryBannerProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (!unresolvedDiagnostics || unresolvedDiagnostics.length === 0) {
    return null;
  }

  const count = unresolvedDiagnostics.length;

  return (
    <View
      testID="financial-recovery-banner"
      className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 gap-3 mb-3"
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`Financial recovery center: ${count} active or unresolved transaction${count > 1 ? 's' : ''}`}
    >
      {/* Banner Header */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5 flex-1">
          <View className="w-8 h-8 rounded-full bg-amber-500/20 items-center justify-center">
            <AlertCircle size={18} className="text-amber-600 dark:text-amber-400" />
          </View>
          <View className="flex-1">
            <Text className="font-bold text-sm text-foreground">
              {t('unresolved_operations_title', 'Pending Financial Operations')}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {count === 1
                ? t('one_unresolved_op', '1 active operation awaiting server confirmation')
                : `${count} ${t('multiple_unresolved_ops', 'active operations awaiting server confirmation')}`}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setIsExpanded(!isExpanded)}
          className="p-2 min-h-[44px] min-w-[44px] items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? 'Collapse pending operations' : 'Expand pending operations'}
        >
          {isExpanded ? (
            <ChevronUp size={18} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={18} className="text-muted-foreground" />
          )}
        </TouchableOpacity>
      </View>

      {/* Expanded Cards List */}
      {isExpanded && (
        <View className="gap-2.5 pt-1">
          {unresolvedDiagnostics.map((diagnostic) => (
            <FinancialDiagnosticCard
              key={diagnostic.operationId}
              diagnostic={diagnostic}
              onCheckStatus={onCheckStatus}
              onOpenSupportInfo={onOpenSupportInfo}
              isChecking={isReconciling}
            />
          ))}

          {onReconcileAll && count > 1 && (
            <Button
              variant="outline"
              onPress={onReconcileAll}
              disabled={isReconciling}
              className="h-10 rounded-xl flex-row items-center justify-center gap-1.5 border-amber-500/30 bg-amber-500/5 active:bg-amber-500/10"
              accessibilityRole="button"
              accessibilityLabel="Check all pending transaction statuses with server"
            >
              <RefreshCw size={14} className={`text-amber-600 dark:text-amber-400 ${isReconciling ? 'animate-spin' : ''}`} />
              <Text className="text-xs font-bold text-amber-700 dark:text-amber-300">
                {isReconciling
                  ? t('reconciling_all', 'Reconciling All...')
                  : t('check_all_statuses', 'Check All Statuses')}
              </Text>
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

export default FinancialRecoveryBanner;
