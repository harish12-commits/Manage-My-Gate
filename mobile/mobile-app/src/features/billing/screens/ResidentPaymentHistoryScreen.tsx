/**
 * NAHOM / Connect Harmony - Mobile Phase 3: ResidentPaymentHistoryScreen
 * Re-exports unified FinancialHistoryScreen for 100% backward compatibility.
 */

import React from 'react';
import { FinancialHistoryScreen } from '@/src/features/payment/screens/FinancialHistoryScreen';

export function ResidentPaymentHistoryScreen() {
  return <FinancialHistoryScreen />;
}

export default ResidentPaymentHistoryScreen;
