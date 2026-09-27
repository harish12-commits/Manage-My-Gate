# NAHOM Unified Financial Architecture — Phase 8 Production Audit

## 1. Executive Summary

Phase 8 concludes the **Unified Financial Architecture** of the NAHOM (Connect Harmony) platform. Across Phases 2 through 7, fragmented and competing payment flows, unledgered transactions, and historical data divergences were audited, unified, migrated, and reconciled.

Phase 8 hardens this architecture for production readiness by:
1. **Enforcing Canonical Pathways:** 100% of resident financial mutations (Billing, Amenity, Wallet) flow strictly through `UnifiedPaymentService` → `PaymentSettlementService` → `FinancialLedgerService`.
2. **Permanently Write-Protecting Legacy Models:** Obsolete single-entry ledgers (`WalletLedger` and `Ledger`) are sealed with database-level `pre('validate')` and `pre('save')` hooks, preventing write mutations while preserving 100% read-only historical queryability.
3. **Hardening Concurrency & Preventing Overdraft:** Wallet mutations use atomic conditional database updates (`balance: { $gte: debitAmount }`) preventing negative balances under extreme concurrency.
4. **Enforcing Webhook Replay Idempotency:** Duplicate delivery of payment events is safely absorbed via database transactions without double-crediting or duplicate ledger lines.
5. **Multi-Tenant Boundary Isolation:** Cross-tenant payments, adjustments, and queries are strictly rejected with 403 Forbidden.
6. **Operational Observability:** Real-time financial integrity auditing (`FinancialIntegrityService`) and health metrics (`FinancialMetricsService`) are accessible via administrative CLI (`scripts/financial-integrity.mjs`) and authenticated API endpoints (`/api/v1/ledger/reconciliation/integrity`, `/api/v1/ledger/reconciliation/metrics`).

---

## 2. Authoritative Architecture & Execution Flow

```text
Resident / Client / Gateway
           │
           ▼
     Domain Adapter
 (Billing / Amenity / Wallet)
           │
           ▼
     PaymentContext
           │
           ▼
  Unified Payment Core  (UnifiedPaymentService)
           │
           ├── OCC Idempotency Check
           ├── Authoritative Amount Validation
           ├── Multi-Tenant Credential Resolution (Tier 1: Hub → Tier 2: Org → Tier 3: Env)
           └── Payment Record (Status: PENDING)
           │
           ▼
 Payment Settlement Engine  (PaymentSettlementService)
           │
  ┌────────┴──────────────────────────────────────────┐
  │ Mongoose ACID Transaction Boundary               │
  │                                                   │
  │  1. Idempotency Check (alreadySettled detection)  │
  │  2. Domain Settlement Execution:                 │
  │     ├── Invoice: Paid amount, status PAID/DUE     │
  │     ├── Amenity: Confirmed, QR, passToken         │
  │     └── Wallet: Atomic credit / debit             │
  │  3. Double-Entry Financial Ledger Posting:       │
  │     ├── DEBIT:  Cash/Bank/Clearing Account        │
  │     └── CREDIT: Revenue/Receivable/Liability      │
  │  4. Payment Status Updated -> SUCCESS             │
  └────────┬──────────────────────────────────────────┘
           │ (Post-Commit Only)
           ▼
    Native EventEmitter  (payment.events.js)
           │
     Socket.io Rooms  (user:{userId}, org:{orgId})
```

---

## 3. Canonical Domain Execution Pathways

### A. Billing / Invoice Domain
* **Online Payment:** `InvoiceRouter` → `unifiedPaymentService.createPaymentOrder()` → Gateway Checkout → `unifiedPaymentService.verifyPayment()` → `paymentSettlementService.settlePayment()` → `invoiceService.settleInvoicePayment()` → `financialLedgerService.recordEntry({ debit: EXTERNAL_CLEARING, credit: INVOICE_RECEIVABLE })`.
* **Wallet Payment:** `invoiceService.payInvoiceWithWallet()` → `walletService.debitWallet()` (atomic) → `paymentSettlementService.settlePayment()` → `financialLedgerService.recordEntry({ debit: RESIDENT_WALLET, credit: INVOICE_RECEIVABLE })`.
* **Offline Cash / Bank / Cheque:** `invoiceService.logOfflinePayment()` → Admin Review → `invoiceService.approveOfflinePayment()` → `paymentSettlementService.settlePayment()` → `financialLedgerService.recordEntry({ debit: CASH_CLEARING / BANK_CLEARING, credit: INVOICE_RECEIVABLE })`.

### B. Amenity Booking Domain
* **Online Booking Payment:** `AmenityBookingRouter` → `unifiedPaymentService.createPaymentOrder()` → Gateway Checkout → `unifiedPaymentService.verifyPayment()` → `paymentSettlementService.settlePayment()` → `amenityBookingService.confirmBooking()` (generates QR & Pass Token) → `financialLedgerService.recordEntry({ debit: EXTERNAL_CLEARING, credit: AMENITY_REVENUE })`.
* **Wallet Booking Payment:** `amenityBookingService.createBooking()` with `PAYMENT_METHODS.WALLET` → `walletService.debitWallet()` (atomic) → `amenityBookingService.confirmBooking()` → `financialLedgerService.recordEntry({ debit: RESIDENT_WALLET, credit: AMENITY_REVENUE })`.
* **Pay-at-Gate (Counter Cash):** `amenityBookingService.createBooking()` with `CASH` → Slot locked in `PENDING_PAYMENT` → Guard/Staff accepts cash at gate → `amenityBookingService.collectCounterPayment()` → `paymentSettlementService.settlePayment()` → `financialLedgerService.recordEntry({ debit: CASH_CLEARING, credit: AMENITY_REVENUE })`.
* **Cancellation & Refund:** `amenityBookingService.cancelBooking()` → `unifiedPaymentService.initiateRefund()` → `paymentSettlementService.settleRefund()` → Compensating Ledger Entry recorded.

### C. Digital Wallet Domain
* **Wallet Recharge:** `WalletRouter` → `unifiedPaymentService.createPaymentOrder()` → Gateway Checkout → `unifiedPaymentService.verifyPayment()` or Webhook Ingress → `paymentSettlementService.settlePayment()` → `walletRepository.updateBalance(userId, orgId, +amount)` → `financialLedgerService.recordEntry({ debit: EXTERNAL_CLEARING, credit: RESIDENT_WALLET })`.
* **Wallet Debit:** `walletService.debitWallet()` → `walletRepository.updateBalance(userId, orgId, -amount)` with `{ balance: { $gte: debitAmount } }` → `WalletTransaction` recorded → Post-commit socket emission.

---

## 4. Component Role & Boundary Matrix

| Component Layer | Canonical File Path | Allowed Responsibilities | Forbidden Patterns |
| :--- | :--- | :--- | :--- |
| **Payment Router** | `src/features/payment/payment.routes.js`<br>`src/features/payment/webhook/webhook.router.js` | Route definitions, express-validator schemas, auth middleware. | Business logic, direct DB calls, socket calls. |
| **Payment Controller** | `src/features/payment/payment.controller.js`<br>`src/features/payment/webhook/razorpay.webhook.js` | HTTP parsing, correlation ID propagation, service invocation. | Direct Mongoose model queries, multi-service orchestration. |
| **Payment Core Service** | `src/features/payment/unifiedPayment.service.js` | Idempotency validation, amount authorization, gateway ordering, signature verification. | Direct socket emissions, un-bracketed database writes. |
| **Settlement Service** | `src/features/payment/paymentSettlement.service.js` | Mongoose transaction bracketing, domain handler delegation, ledger posting, post-commit event dispatch. | In-memory balance updates without atomic DB checks. |
| **Financial Ledger Service** | `src/features/ledger/financialLedger.service.js` | Double-entry invariant verification ($\sum D = \sum C$), immutable ledger persistence. | Modifying or deleting existing posted ledger records. |
| **Wallet Service / Repo** | `src/features/wallet/wallet.service.js`<br>`src/features/wallet/wallet.repository.js` | Atomic wallet increments/decrements, balance lookups, transaction logging. | In-memory overdraft arithmetic (`if (bal >= amt) bal -= amt`). |

---

## 5. Deprecated & Isolated Legacy Components

1. **`src/features/wallet/walletLedger.model.js` (`WalletLedger`):**
   * *Status:* Deprecated & Write-Protected.
   * *Mechanism:* `pre(['validate', 'save'])` hook throws: `"WalletLedger is deprecated. All financial accounting mutations must use FinancialLedgerEntry."`
   * *Queries:* Allowed in read-only mode for historical audit preservation.
2. **`src/features/ledger/ledger.model.js` (`Ledger`):**
   * *Status:* Deprecated & Sealed.
   * *Mechanism:* `pre(['validate', 'save', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'])` hooks throw deprecation errors.
   * *Queries:* Read-only queries permitted for historical statements.
3. **`src/features/payment/razorpay.controller.js`:**
   * *Status:* Deprecated compatibility facade.
   * *Mechanism:* Annotated `@deprecated`. Forwards calls to `UnifiedPaymentService`.
4. **`src/features/webhook/` (B2B SaaS Webhooks):**
   * *Status:* Isolated SaaS Domain.
   * *Role:* Dedicated strictly to platform community subscription billing (`platformOrderService`). Resident payment webhooks are handled authoritatively by `src/features/payment/webhook/webhook.router.js`.

---

## 6. Database Schema & Index Hardening

All canonical financial collections have been hardened with compound indexes for high-throughput concurrency and multi-tenant isolation:

* **`payments`:**
  * `{ orgId: 1, status: 1, createdAt: -1 }` (Tenant lifecycle queries)
  * `{ orgId: 1, domain: 1, createdAt: -1 }` (Tenant domain volume analytics)
  * `{ referenceType: 1, referenceId: 1, status: 1 }` (Authoritative lookup by domain entity)
  * `{ idempotencyKey: 1 }` (Unique sparse index for OCC deduplication)
* **`financialledgerentries`:**
  * `{ idempotencyKey: 1 }` (Unique index for zero duplicate posting)
  * `{ orgId: 1, domain: 1, createdAt: -1 }`
  * `{ paymentId: 1 }`
  * `{ userId: 1, orgId: 1 }`
* **`wallets`:**
  * `{ userId: 1, orgId: 1 }` (Unique compound index)
* **`wallettransactions`:**
  * `{ orgId: 1, referenceType: 1, referenceId: 1 }`
  * `{ userId: 1, orgId: 1, createdAt: -1 }`

---

## 7. Verification & Regression Evidence

| Test Suite | Coverage Area | Status | Result |
| :--- | :--- | :--- | :--- |
| `tests/payment.contracts.phase2.test.mjs` | Canonical contracts, adapters, math precision | Passed | 31/31 |
| `tests/payment.core.phase3.test.mjs` | Unified payment core, webhook ingress, OCC | Passed | 10/10 |
| `tests/payment.financial.phase4.test.mjs` | Double-entry ledger, atomic wallet, rollback | Passed | 16/16 |
| `tests/billing.payment.phase5.test.mjs` | Invoice migration, online/offline/wallet settlement | Passed | 18/18 |
| `tests/amenity.payment.phase6.test.mjs` | Amenity migration, pass tokens, check-in, refunds | Passed | 20/20 |
| `tests/financial.reconciliation.phase7.test.mjs` | Historical backfill, deterministic matchers, Genesis | Passed | 10/10 |
| `tests/financial.architecture.phase8.test.mjs` | Deprecation, write blocks, concurrency, integrity | Passed | 10/10 |
| `tests/wallet_recharge_security.test.js` | Anti-tampering, replay attacks, webhooks | Passed | 5/5 |
| **TOTAL** | **Entire NAHOM Financial Platform** | **ALL PASS** | **120 / 120** |
