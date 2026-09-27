/**
 * NAHOM / Connect Harmony - Mobile Phase 6: useFinancialDiagnostics Hook
 *
 * Exposes active unresolved operations, safe diagnostics, reconciliation triggers,
 * and support payload formatting for resident and operational screens.
 */

import { useState, useEffect, useCallback } from 'react';
import financialDiagnosticService from '../services/financialDiagnosticService';
import {
  FinancialOperationDiagnostic,
  DomainHealthReport,
} from '../types/financialDiagnostics.types';

export function useFinancialDiagnostics() {
  const [unresolvedDiagnostics, setUnresolvedDiagnostics] = useState<FinancialOperationDiagnostic[]>([]);
  const [domainHealth, setDomainHealth] = useState<DomainHealthReport | null>(null);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [lastReconciledAt, setLastReconciledAt] = useState<string | null>(null);

  // Modal support info state
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<FinancialOperationDiagnostic | null>(null);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState<boolean>(false);

  /**
   * Reconcile all active sessions from storage against authoritative backend state.
   */
  const reconcileAll = useCallback(async () => {
    setIsReconciling(true);
    try {
      const { active } = await financialDiagnosticService.reconcileAllActiveSessions();
      setUnresolvedDiagnostics(active);
      setLastReconciledAt(new Date().toISOString());

      // Check domain health in background
      const health = await financialDiagnosticService.checkDomainHealth();
      setDomainHealth(health);
    } catch (err) {
      console.warn('[useFinancialDiagnostics] Failed to reconcile active sessions:', err);
    } finally {
      setIsReconciling(false);
    }
  }, []);

  /**
   * Reconcile a single session on-demand (e.g. from a "Check Status" CTA).
   */
  const reconcileSingle = useCallback(async (referenceType: string, referenceId: string) => {
    setIsReconciling(true);
    try {
      const { active } = await financialDiagnosticService.reconcileAllActiveSessions();
      setUnresolvedDiagnostics(active);
      setLastReconciledAt(new Date().toISOString());
      return active.find((d) => d.referenceType === referenceType && d.referenceId === referenceId) || null;
    } catch (err) {
      console.warn('[useFinancialDiagnostics] Failed to reconcile single session:', err);
      return null;
    } finally {
      setIsReconciling(false);
    }
  }, []);

  useEffect(() => {
    reconcileAll();
  }, [reconcileAll]);

  const openSupportModal = useCallback((diagnostic: FinancialOperationDiagnostic) => {
    setSelectedDiagnostic(diagnostic);
    setIsSupportModalOpen(true);
  }, []);

  const closeSupportModal = useCallback(() => {
    setIsSupportModalOpen(false);
    setSelectedDiagnostic(null);
  }, []);

  const openTimelineModal = useCallback((diagnostic: FinancialOperationDiagnostic) => {
    setSelectedDiagnostic(diagnostic);
    setIsTimelineModalOpen(true);
  }, []);

  const closeTimelineModal = useCallback(() => {
    setIsTimelineModalOpen(false);
    setSelectedDiagnostic(null);
  }, []);

  return {
    unresolvedDiagnostics,
    domainHealth,
    isReconciling,
    lastReconciledAt,
    reconcileAll,
    reconcileSingle,
    selectedDiagnostic,
    isSupportModalOpen,
    isTimelineModalOpen,
    openSupportModal,
    closeSupportModal,
    openTimelineModal,
    closeTimelineModal,
  };
}

export default useFinancialDiagnostics;
