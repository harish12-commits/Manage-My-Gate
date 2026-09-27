# NAHOM / Connect Harmony — Mobile Financial Migration Plan

**Document Version:** 1.0.0  
**Audit Date:** September 2026  
**Implementation Strategy:** Phased, Non-Breaking, Server-Authoritative Migration  
**Target Codebase:** `mobile/mobile-app/`  
**Status:** Canonical Implementation Roadmap

---

## 1. File Classification & Action Inventory

Every file touched by financial logic in the mobile codebase is classified below with a specific lifecycle tag:
* **`KEEP`**: Architecture-compliant; maintain without structural modifications.
* **`MODIFY`**: Requires surgical modifications to adopt canonical backend contracts or remove anti-patterns.
* **`MIGRATE`**: Move from existing feature folder to a new standalone domain module.
* **`REMOVE`**: Redundant, bypass, or dead file marked for deletion.
* **`CREATE`**: New architectural module or hook required to complete unified payment integration.
* **`VERIFY`**: Existing visual or presentation component requiring end-to-end integration validation.

### 1.1 Detailed File Classification Registry

| File Path | Current Feature | Lifecycle Action | Detailed Rationale & Required Changes |
| :--- | :--- | :--- | :--- |
| `src/features/billing/store/walletSlice.ts` | Billing | **MIGRATE** | Migrate to `src/features/wallet/store/walletSlice.ts` to satisfy the "One Model, One Feature" rule. |
| `src/features/amenities/store/walletSlice.ts` | Amenities | **REMOVE** | Redundant proxy forwarding to billing wallet slice. Replace with direct import from new `@/features/wallet`. |
| `src/features/billing/screens/WalletScreen.tsx` | Billing | **MIGRATE** | Move to `src/features/wallet/screens/WalletScreen.tsx` as the top-level container for resident wallet. |
| `src/features/billing/components/WalletHeroCard.tsx` | Billing | **MIGRATE** | Move to `src/features/wallet/components/WalletHeroCard.tsx`. |
| `src/features/billing/components/WalletTransactionCard.tsx` | Billing | **MIGRATE** | Move to `src/features/wallet/components/WalletTransactionCard.tsx`. |
| `src/features/amenities/components/WalletTopUpModal.tsx` | Amenities | **MODIFY** | Eliminate `topUpWalletDirect` (`/wallet/add-money`) bypass. Convert to create genuine Razorpay top-up orders. |
| `src/features/amenities/components/wizard/AmenityBookingWizard.tsx` | Amenities | **MODIFY** | Eliminate hardcoded `order_amenity_${Date.now()}` and `'rzp_test_mockkey'`. Connect to dynamic order creation hook. |
| `src/features/amenities/hooks/useAmenityBookingWizard.ts` | Amenities | **MODIFY** | Add `verifySignature` step before confirming reservation; remove dummy `WALLET_TXN_` reference synthesis; execute backend wallet debit. |
| `src/features/billing/components/PaymentCheckoutSheet.tsx` | Billing | **MODIFY** | Remove optimistic local calculation of `currentPaid`, `calcRemaining`, and status; consume server-authoritative settlement envelope. |
| `src/features/billing/store/billingSlice.ts` | Billing | **MODIFY** | Refactor `performInvoiceSync` to ingest server response data rather than predicting state changes locally. |
| `src/features/billing/services/billingService.ts` | Billing | **MODIFY** | Remove `/wallet/add-money` test bypass method; extract wallet-specific API methods to `src/features/wallet/services/walletService.ts`. |
| `src/features/amenities/services/amenityManagementService.ts` | Amenities | **MODIFY** | Add `createAmenityPaymentOrder` endpoint wrapper calling `POST /payments/create-order` for reservations. |
| `src/features/billing/hooks/useMobilePayment.ts` | Billing | **MODIFY** | Add deterministic `X-Idempotency-Key` header injection to all payment lifecycle calls. |
| `src/features/payment/hooks/useUnifiedPayment.ts` | Shared / Payment | **CREATE** | New reusable hook providing a unified interface for Razorpay, Wallet, and Cash checkout across Billing and Amenities. |
| `src/features/wallet/services/walletService.ts` | Wallet | **CREATE** | Dedicated API client service isolating `/wallet` balance, recharge order, and transaction pagination calls. |
| `src/features/billing/components/RazorpayCheckoutModal.tsx` | Billing | **KEEP** | Robust in-app WebView checkout modal. Retain and reuse across both Billing and Amenity flows. |
| `src/features/billing/screens/ResidentMyDuesScreen.tsx` | Billing | **VERIFY** | Verify accurate presentation of dues after switching to server-authoritative settlement payloads. |
| `src/features/billing/screens/InvoiceDetailsScreen.tsx` | Billing | **VERIFY** | Verify invoice line-item calculations and settlement state binding. |
| `src/features/billing/screens/PaymentResultScreen.tsx` | Billing | **VERIFY** | Verify presentation of server-provided `PaymentReceiptCard` data. |

---

## 2. Target Architectural Blueprint

```text
                                  ┌─────────────────────────────┐
                                  │      Mobile UI Screens      │
                                  │ (Billing / Amenities / Dues)│
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │     useUnifiedPayment Hook  │
                                  │  (Standardized Coordinator) │
                                  └──────┬───────────────┬──────┘
                                         │               │
                     ┌───────────────────┘               └───────────────────┐
                     ▼                                                       ▼
      ┌─────────────────────────────┐                         ┌─────────────────────────────┐
      │     Digital Wallet Flow     │                         │     Gateway (Razorpay) Flow │
      │   (src/features/wallet/)    │                         │ (RazorpayCheckoutModal.tsx) │
      └──────────────┬──────────────┘                         └──────────────┬──────────────┘
                     │                                                       │
                     │ [POST /wallet/pay-invoice]                            │ 1. [POST /payments/create-order]
                     │ (or atomic booking debit)                             │ 2. WebView Gateway Checkout
                     │                                                       │ 3. [POST /payments/verify-signature]
                     ▼                                                       ▼
      ┌─────────────────────────────────────────────────────────────────────────────────────┐
      │                      Backend Phase 8 Unified Payment Core                           │
      │   (UnifiedPaymentService ──► PaymentSettlementService ──► FinancialLedgerService)   │
      └─────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │ Server-Authoritative State  │
                                  │ (Canonical Invoice/Booking) │
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │     Redux Feature Slices    │
                                  │  (Direct Ingestion, No Math)│
                                  └─────────────────────────────┘
```

---

## 3. Phased Implementation Roadmap

### Phase 0: Architectural Refactoring & Feature Isolation
* **Goal:** Satisfy the "One Model, One Feature" architectural rule and eliminate duplicate slices.
* **Tasks:**
  1. Create directory `src/features/wallet/` with subfolders `screens/`, `components/`, `store/`, `services/`, `hooks/`.
  2. Migrate `walletSlice.ts` from `billing/store/` to `wallet/store/walletSlice.ts`.
  3. Migrate `WalletScreen.tsx`, `WalletHeroCard.tsx`, and `WalletTransactionCard.tsx` into `src/features/wallet/`.
  4. Create `src/features/wallet/services/walletService.ts` and transfer wallet API calls from `billingService.ts`.
  5. Delete `src/features/amenities/store/walletSlice.ts` and update all amenity imports to point to `@/features/wallet`.
  6. Register the migrated wallet slice in `src/store/store.ts`.

---

### Phase 1: Critical Security Vulnerability Remediation
* **Goal:** Eliminate synthetic orders, mock keys, signature bypasses, and unverified wallet reference spoofing.
* **Tasks:**
  1. Update `AmenityBookingWizard.tsx` to stop synthesizing `order_amenity_${Date.now()}` and `'rzp_test_mockkey'`.
  2. Update `useAmenityBookingWizard.ts`:
     - When payment method is `RAZORPAY`: Call `POST /payments/create-order` with `{ referenceId: hold._id, referenceType: 'AmenityBooking', amount: totalAmount, currency: 'INR', gateway: 'razorpay' }` to obtain a real backend order.
     - On Razorpay success: Call `POST /payments/verify-signature` with `{ paymentId, orderId, razorpayPaymentId, razorpaySignature }` to verify cryptographically on backend.
     - Only after successful signature verification: Call `POST /amenities/v2/reservations/confirm` passing the verified `paymentId`.
  3. Update Amenity Wallet Payment:
     - Remove `WALLET_TXN_${Date.now()}` client spoofing.
     - When confirming reservation with `WALLET`: Ensure the reservation confirmation requests an atomic wallet debit on the backend, or call `POST /payments/create-order` with `paymentMethod: 'WALLET'`.
     - Update Redux wallet balance directly from the server's settlement response.

---

### Phase 2: Billing & Invoice Modernization
* **Goal:** Enforce server-authoritative settlement state and eliminate client-side arithmetic.
* **Tasks:**
  1. Refactor `PaymentCheckoutSheet.tsx`:
     - Remove local calculation of `currentPaid = (invoice.paidAmount || 0) + amountToPay`, `calcRemaining = Math.max(0, remainingDue - amountToPay)`, and `isFull ? 'PAID' : 'PARTIALLY_PAID'`.
     - Directly consume `result.invoice` returned by `payInvoiceWallet` and `verifyRazorpayPayment`.
     - Pass server-returned `PaymentReceipt` data directly to `PaymentReceiptCard` and navigation parameters.
  2. Refactor `billingSlice.ts`:
     - Update `performInvoiceSync` to cleanly overwrite stored invoice records with the backend's returned payload rather than mutating fields based on optimistic local assumptions.
  3. Inject deterministic `X-Idempotency-Key` headers into `initiateRazorpayPayment`, `confirmRazorpayPayment`, and `processWalletPayment`.

---

### Phase 3: Wallet Recharge Standardization
* **Goal:** Eliminate debug balance manipulation (`/wallet/add-money`) and unify wallet recharges with the Payment Core.
* **Tasks:**
  1. Remove `topUpWalletDirect` and `POST /wallet/add-money` calls from mobile application production code.
  2. Refactor `WalletTopUpModal.tsx`:
     - When a resident selects a preset or custom amount, trigger `createWalletRazorpayOrder({ amount })`.
     - Open `RazorpayCheckoutModal` with the genuine backend order.
     - Upon completion, trigger `verifyWalletPayment` to cryptographically verify signature, credit wallet atomically, and post double-entry ledger entries.
  3. Update `useResidentWallet.ts` to utilize the unified recharge flow.

---

### Phase 4: Offline / Pay-at-Gate & Receipt Hardening
* **Goal:** Complete offline payment alignment and unify digital receipt generation.
* **Tasks:**
  1. Standardize offline settlement payloads in `billingService.ts` and `OfflineSettleSheet.tsx` (ensure `amount` and `paymentDate` match backend schema).
  2. Ensure Pay-at-Gate cash payments recorded via guard scanner (`POST /amenity-bookings/:id/cash-payment`) update the resident's active booking pass with verified canonical `Payment` records.
  3. Standardize `PaymentReceiptCard.tsx` to format currency with Indian comma separators (`₹1,250.00`) and display canonical transaction IDs (`paymentNumber`, `gatewayTransactionId`).

---

### Phase 5: UI/UX & Component Catalog Alignment
* **Goal:** Ensure full compliance with NativeWind design tokens and logical spacing (RTL).
* **Tasks:**
  1. Audit `PaymentCheckoutSheet.tsx`, `WalletScreen.tsx`, and `BookingCheckoutModal.tsx` for physical spacing classes (`ml-`, `mr-`, `pl-`, `pr-`) and replace with logical classes (`ms-`, `me-`, `ps-`, `pe-`).
  2. Verify all buttons and inputs consume `@/components/ui/button`, `@/components/forms/TextInput`, and `@/components/ui/StatusBadge`.
  3. Ensure all payment screens are wrapped in `<ScreenShell>` and React Error Boundaries.
