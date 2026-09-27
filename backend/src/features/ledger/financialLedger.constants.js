/**
 * NAHOM Unified Financial Architecture - Phase 4
 * Canonical Account Taxonomy, Statuses, and Entry Types
 */

// 1. Canonical Chart of Accounts
export const FINANCIAL_ACCOUNTS = Object.freeze({
  // Asset / Clearing Accounts (Debit = Increase, Credit = Decrease)
  GATEWAY_CLEARING: 'GATEWAY_CLEARING',     // Inbound clearing from online payment gateway (Razorpay)
  EXTERNAL_CLEARING: 'EXTERNAL_CLEARING',   // Alias for external payment clearing
  CASH_CLEARING: 'CASH_CLEARING',           // Physical cash collected at gate or office
  BANK_CLEARING: 'BANK_CLEARING',           // Direct bank transfer / NEFT clearing

  // Accounts Receivable (Asset: Debit = Increase, Credit = Decrease)
  INVOICE_RECEIVABLE: 'INVOICE_RECEIVABLE', // Accounts receivable for maintenance/utility billing
  AMENITY_RECEIVABLE: 'AMENITY_RECEIVABLE', // Accounts receivable for facility bookings

  // Liabilities (Tenant's liability to resident: Credit = Increase, Debit = Decrease)
  RESIDENT_WALLET: 'RESIDENT_WALLET',       // Stored digital wallet balances

  // Earned Revenue (Revenue: Credit = Increase, Debit = Decrease)
  INVOICE_REVENUE: 'INVOICE_REVENUE',       // Earned assessment & maintenance revenue
  AMENITY_REVENUE: 'AMENITY_REVENUE',       // Earned facility booking revenue

  // Contra-Revenue & Adjustments (Debit = Increase, Credit = Decrease)
  REFUND_CLEARING: 'REFUND_CLEARING',       // Outbound refund clearing
  REVENUE_ADJUSTMENT: 'REVENUE_ADJUSTMENT', // Revenue reversal / contra account for cancellations
});

// 2. Canonical Entry Types
export const ENTRY_TYPES = Object.freeze({
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
});

// 3. Ledger Entry Lifecycle Statuses
export const LEDGER_STATUSES = Object.freeze({
  POSTED: 'POSTED',           // Finalized, active financial entry
  COMPENSATED: 'COMPENSATED', // Offset by a compensating journal entry
  VOID: 'VOID',               // Voided via administrative correction
});

// 4. Financial Transaction Domains
export const FINANCIAL_DOMAINS = Object.freeze({
  INVOICE: 'INVOICE',
  AMENITY: 'AMENITY',
  WALLET: 'WALLET',
  REFUND: 'REFUND',
  ADJUSTMENT: 'ADJUSTMENT',
});

// 5. Default Currency
export const DEFAULT_CURRENCY = 'INR';

/**
 * Resolve standard double-entry accounts based on transaction domain and payment method.
 * @param {string} domain - INVOICE | AMENITY | WALLET | REFUND
 * @param {string} paymentMethod - ONLINE | WALLET | CASH | BANK_TRANSFER
 * @param {boolean} isRefund - whether the transaction is a refund
 * @returns {{ debitAccount: string, creditAccount: string }}
 */
export function resolveDoubleEntryAccounts(domain, paymentMethod = 'ONLINE', isRefund = false) {
  const normMethod = (paymentMethod || 'ONLINE').toUpperCase();
  const normDomain = (domain || '').toUpperCase();

  // Clearing account based on payment method
  let clearingAccount = FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING;
  if (normMethod === 'CASH') {
    clearingAccount = FINANCIAL_ACCOUNTS.CASH_CLEARING;
  } else if (
    normMethod === 'BANK_TRANSFER' ||
    normMethod === 'BANK' ||
    normMethod === 'NEFT' ||
    normMethod === 'IMPS' ||
    normMethod === 'RTGS' ||
    normMethod === 'CHEQUE' ||
    normMethod === 'CHQ' ||
    normMethod === 'DEMAND_DRAFT' ||
    normMethod === 'DD'
  ) {
    clearingAccount = FINANCIAL_ACCOUNTS.BANK_CLEARING;
  } else if (normMethod === 'WALLET') {
    clearingAccount = FINANCIAL_ACCOUNTS.RESIDENT_WALLET;
  }

  if (isRefund) {
    // Refund: Debit Revenue Adjustment, Credit Clearing/Wallet
    return {
      debitAccount: FINANCIAL_ACCOUNTS.REVENUE_ADJUSTMENT,
      creditAccount: clearingAccount,
    };
  }

  // Normal Settlements:
  switch (normDomain) {
    case 'WALLET':
      // Wallet Recharge: External Clearing -> Resident Wallet
      return {
        debitAccount: clearingAccount === FINANCIAL_ACCOUNTS.RESIDENT_WALLET ? FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING : clearingAccount,
        creditAccount: FINANCIAL_ACCOUNTS.RESIDENT_WALLET,
      };

    case 'AMENITY':
      // Amenity Booking: Clearing / Wallet -> Amenity Revenue
      return {
        debitAccount: clearingAccount,
        creditAccount: FINANCIAL_ACCOUNTS.AMENITY_REVENUE,
      };

    case 'INVOICE':
      // Invoice Payment: Clearing / Wallet -> Invoice Receivable
      return {
        debitAccount: clearingAccount,
        creditAccount: FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE,
      };

    default:
      return {
        debitAccount: clearingAccount,
        creditAccount: FINANCIAL_ACCOUNTS.REVENUE_ADJUSTMENT,
      };
  }
}
