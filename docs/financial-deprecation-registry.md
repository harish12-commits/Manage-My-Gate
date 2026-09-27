# NAHOM Financial Deprecation Registry

## 1. Overview

This document formally records all deprecated financial modules, legacy database schemas, and backward-compatibility facades established during the Unified Financial Architecture consolidation (Phases 2 through 8).

**Core Safety Principle:** No legacy MongoDB collection or historical database record is dropped, renamed, or deleted. All legacy components are placed into strict **write-protected, read-only status** to preserve complete auditability.

---

## 2. Deprecated Components Registry

| Deprecated Component | Previous Architectural Role | Current Status (Phase 8) | Write-Protection Mechanism | Authoritative Replacement | Safe Removal Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`WalletLedger`**<br>`src/features/wallet/walletLedger.model.js` | Single-entry SHA256 hashed ledger created for early prototype wallet tracking. | **Deprecated & Write-Blocked** (Read-Only) | `pre(['validate', 'save'])` throws: `"WalletLedger is deprecated. All financial accounting mutations must use FinancialLedgerEntry."` Updates and deletes throw immutability errors. | `FinancialLedgerEntry`<br>`src/features/ledger/financialLedgerEntry.model.js` | Must NEVER be deleted from MongoDB. Retained permanently for historical audit verification. |
| **`Ledger`**<br>`src/features/ledger/ledger.model.js` | Prototype general ledger collection. | **Deprecated & Write-Blocked** (Read-Only) | `pre(['validate', 'save', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'])` throws deprecation error. | `FinancialLedgerEntry`<br>`src/features/ledger/financialLedgerEntry.model.js` | Retain collection indefinitely. Code file can only be archived after all historical resident statements are verified to read canonical ledger. |
| **`RazorpayController`**<br>`src/features/payment/razorpay.controller.js` | Legacy controller directly invoking Razorpay Node SDK and updating domain records ad-hoc. | **Deprecated Facade** | Marked `@deprecated`. All methods delegate directly to `UnifiedPaymentService`. | `UnifiedPaymentService`<br>`src/features/payment/unifiedPayment.service.js` | Safe to retire only after mobile and frontend apps migrate all remaining legacy endpoint calls to canonical payment routes. |
| **`src/features/webhook/`** | Legacy dual-use webhook router. | **Isolated B2B SaaS Domain** | Segregated from resident payment processing. | `src/features/payment/webhook/webhook.router.js` | Retained specifically for B2B SaaS community platform subscriptions (`platformOrderService`). |

---

## 3. Public API Compatibility Mappings

To maintain 100% backward compatibility for existing mobile apps (iOS/Android) and web portals without forcing immediate client upgrades, legacy endpoints are transparently forwarded to the Unified Payment Core:

| Client Request Endpoint | Legacy Handler | Canonical Architecture Routing | Underlying State Mutation |
| :--- | :--- | :--- | :--- |
| `POST /api/v1/payment/razorpay/create-order` | `razorpay.controller.js:createOrder` | `unifiedPaymentService.createPaymentOrder(PaymentContext)` | Creates `Payment` (status: `pending`) |
| `POST /api/v1/payment/razorpay/verify-payment` | `razorpay.controller.js:verifyPayment` | `unifiedPaymentService.verifyPayment(...)` → `paymentSettlementService.settlePayment(...)` | Sets `Payment` (`success`), settles domain, posts `FinancialLedgerEntry` |
| `POST /api/v1/payment/razorpay/webhook` | `razorpay.controller.js:handleWebhook` | `unifiedPaymentService.processWebhook(...)` → `paymentSettlementService.settlePayment(...)` | Atomic idempotent settlement |
| `POST /api/v1/invoices/:id/pay` | `invoice.controller.js:payInvoice` | `invoiceService.payInvoiceWithWallet(...)` or `unifiedPaymentService.createPaymentOrder(...)` | Atomic wallet debit or gateway order |
| `POST /api/v1/amenities/bookings` | `amenityBooking.controller.js` | `amenityPaymentAdapter` → `PaymentContext` → `unifiedPaymentService` | Creates booking + pending payment |
| `POST /api/v1/wallet/recharge` | `wallet.controller.js:rechargeWallet` | `PaymentContextFactory.forWalletRecharge(...)` → `unifiedPaymentService` | Creates gateway order |

---

## 4. Migration & Retention Policy for Historical Collections

1. **Zero Database Drops:**
   * Collections `walletledgers` and `ledgers` MUST NOT be dropped, truncated, or renamed in MongoDB staging or production.
2. **Read-Only Preservation:**
   * Read queries (`find`, `findOne`, `aggregate`) are permitted to allow historical accounting reports and forensic investigations.
   * All mutating operations (`create`, `insertMany`, `save`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`) are blocked by Mongoose middleware hooks.
3. **Canonical Representation:**
   * All historical transactions backfilled in Phase 7 are represented canonically in `FinancialLedgerEntry` and `Payment`.
   * For all periods moving forward, `FinancialLedgerEntry` is the sole authoritative Source of Truth (SSOT).
