/**
 * NAHOM Unified Financial Architecture - Phase 7
 * Canonical Reconciliation Constants, Classifications, and Execution Modes
 */

export const RECONCILIATION_CLASSIFICATIONS = Object.freeze({
  MATCHED: 'MATCHED',                         // Identical record found and matched
  ALREADY_CANONICAL: 'ALREADY_CANONICAL',     // Already represented in canonical Payment & FinancialLedgerEntry
  BACKFILL_REQUIRED: 'BACKFILL_REQUIRED',     // Authoritative evidence exists, requires canonical Payment/Ledger creation
  PARTIAL_MATCH: 'PARTIAL_MATCH',             // Partially matches (e.g., partial payment recorded)
  UNMATCHED: 'UNMATCHED',                     // No authoritative financial record found for claimed status
  CONFLICT: 'CONFLICT',                       // Conflicting evidence (e.g. invoice total != payments, or wallet math != balance)
  INVALID: 'INVALID',                         // Missing required fields (e.g. missing tenant orgId or non-positive amount)
  EXCLUDED: 'EXCLUDED',                       // Excluded with explicit justification (e.g. UNPAID invoice with 0 payments)
});

export const RECONCILIATION_EXCEPTION_STATUSES = Object.freeze({
  OPEN: 'OPEN',                               // Initial detected discrepancy
  REVIEWED: 'REVIEWED',                       // Reviewed by finance / administrator
  RESOLVED: 'RESOLVED',                       // Resolved via verified compensating entry or evidence
  IGNORED_WITH_REASON: 'IGNORED_WITH_REASON', // Explicitly excluded with audited reason
});

export const MIGRATION_EXECUTION_MODES = Object.freeze({
  DRY_RUN: 'DRY_RUN',                         // Safe evaluation mode; performs zero database writes
  EXECUTE: 'EXECUTE',                         // Authoritative idempotent backfill with transactional writes
  VERIFY: 'VERIFY',                           // Read-only integrity check validating invariants and balance math
});

export const RECONCILIATION_SOURCE_TYPES = Object.freeze({
  INVOICE: 'Invoice',
  AMENITY_BOOKING: 'AmenityBooking',
  WALLET: 'Wallet',
  WALLET_TRANSACTION: 'WalletTransaction',
  PAYMENT: 'Payment',
});

export const RECONCILIATION_DOMAINS = Object.freeze({
  INVOICE: 'INVOICE',
  AMENITY: 'AMENITY',
  WALLET: 'WALLET',
  REFUND: 'REFUND',
});
