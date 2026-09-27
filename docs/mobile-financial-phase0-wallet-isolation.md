# NAHOM / Connect Harmony — Mobile Financial Phase 0: Wallet Feature Isolation & Domain Boundary Refactor

**Document Version:** 1.0.0  
**Execution Date:** September 2026  
**Phase:** Phase 0 (Domain Refactor & Isolation Only)  
**Status:** Successfully Executed & Verified  
**Target Architecture:** `src/features/wallet/` independent domain module

---

## 1. Executive Summary

In accordance with Phase 0 directives, the mobile application's Wallet implementation has been cleanly extracted from `src/features/billing/` and isolated into a dedicated, first-class feature module at:

```text
src/features/wallet/
├── components/
│   ├── WalletHeroCard.tsx
│   └── WalletTransactionCard.tsx
├── screens/
│   └── WalletScreen.tsx
├── services/
│   └── walletService.ts
├── store/
│   └── walletSlice.ts
├── types/
│   └── index.ts
└── index.ts
```

### Critical Boundaries Preserved
* **Zero Financial Behavior Mutations:** No changes were made to Razorpay payment orders, signature verification, Amenity booking payments, wallet debits/credits, or `/wallet/add-money` in this phase.
* **Backend Preservation:** Zero modifications to backend endpoints, database models, or API contracts.
* **Redux Shape Parity:** The Redux root store continues to expose `state.wallet` backed by the authoritative `walletReducer`.
* **Zero Old Imports:** All production imports of `billing/store/walletSlice`, `amenities/store/walletSlice`, `billing/screens/WalletScreen`, and related components were migrated.

---

## 2. Structural & Architectural Changes

### 2.1 Original vs. New File Locations

| Original Location | New Authoritative Location | Action | Architectural Rationale |
| :--- | :--- | :--- | :--- |
| `src/features/billing/store/walletSlice.ts` | `src/features/wallet/store/walletSlice.ts` | **MOVED** | Isolates wallet state, reducers, and thunks into its own feature module. |
| `src/features/billing/screens/WalletScreen.tsx` | `src/features/wallet/screens/WalletScreen.tsx` | **MOVED** | Container screen for resident wallet dashboard and transaction history. |
| `src/features/billing/components/WalletHeroCard.tsx` | `src/features/wallet/components/WalletHeroCard.tsx` | **MOVED** | Reusable card displaying wallet balance and top-up trigger. |
| `src/features/billing/components/WalletTransactionCard.tsx` | `src/features/wallet/components/WalletTransactionCard.tsx` | **MOVED** | Reusable card displaying transaction statement line items. |
| `src/features/amenities/store/walletSlice.ts` | **N/A** | **REMOVED** | Deleted 52-line redundant proxy slice. Amenities now imports directly from `@/features/wallet`. |
| N/A | `src/features/wallet/services/walletService.ts` | **CREATED** | Dedicated API boundary wrapping `/wallet`, `/wallet/create-order`, `/wallet/verify-payment`, and `/wallet/add-money`. |
| N/A | `src/features/wallet/types/index.ts` | **CREATED** | Dedicated TypeScript domain types (`WalletState`, `WalletTransaction`, `WalletPagination`). |
| N/A | `src/features/wallet/index.ts` | **CREATED** | Public barrel export file for the Wallet feature. |

---

## 3. Dependency & API Service Architecture

### 3.1 Pre-Phase 0 Coupling (Anti-Pattern)
```text
Amenities (useResidentBooking, useAmenityBookingWizard, useResidentWallet)
       │
       ▼
src/features/amenities/store/walletSlice.ts (Proxy)
       │
       ▼
src/features/billing/store/walletSlice.ts
       │
       ▼
src/features/billing/services/billingService.ts
```

### 3.2 Target Clean Architecture (Phase 0)
```text
Billing Feature                    Amenities Feature
       │                                  │
       ▼                                  ▼
       └──────────────┬───────────────────┘
                      │ (Direct consumers of state/thunks)
                      ▼
        src/features/wallet/store/walletSlice.ts
                      │
                      ▼
        src/features/wallet/services/walletService.ts
                      │
                      ▼
        src/services/apiClient.ts
                      │
                      ▼
               Backend /wallet/*
```

---

## 4. Redux Store & Navigation Verification

1. **Redux Store (`src/store/store.ts`):**
   * Imported `walletReducer` directly from `../features/wallet/store/walletSlice`.
   * State namespace preserved under `state.wallet`.
2. **Navigation Routes:**
   * `app/(resident)/billing/wallet.tsx`: Updated to render `<WalletScreen />` from `@/src/features/wallet/screens/WalletScreen`.
   * `app/(resident)/amenities/wallet.tsx`: Updated to render `<WalletScreen />` from `@/src/features/wallet/screens/WalletScreen`.
   * Resident Dues Screen navigation: `router.push('/(resident)/billing/wallet')` routes correctly to the updated container.

---

## 5. Files Modified Across the Codebase

1. `src/store/store.ts`: Updated `walletReducer` import to `../features/wallet/store/walletSlice`.
2. `app/(resident)/billing/wallet.tsx`: Updated `WalletScreen` import to `@/src/features/wallet/screens/WalletScreen`.
3. `app/(resident)/amenities/wallet.tsx`: Updated `WalletScreen` import to `@/src/features/wallet/screens/WalletScreen`.
4. `src/features/billing/hooks/useBilling.ts`: Updated `fetchWalletBalance` import to `../../wallet/store/walletSlice`.
5. `src/features/billing/hooks/useBillingSocket.ts`: Updated `fetchWalletBalance, syncWalletBalance` import to `../../wallet/store/walletSlice`.
6. `src/features/billing/index.ts`: Removed `walletSlice`, `WalletScreen`, `WalletHeroCard`, and `WalletTransactionCard` exports.
7. `src/features/billing/services/billingService.ts`: Removed duplicate wallet API methods (`getWalletBalance`, `createWalletOrder`, `topUpWalletDirect`, `verifyWalletPayment`).
8. `src/features/billing/types/index.ts`: Re-exported `WalletState` from `../../wallet/types`.
9. `src/features/amenities/hooks/useAdminLedgers.ts`: Updated `fetchWalletThunk` import to `../../wallet/store/walletSlice`.
10. `src/features/amenities/hooks/useAmenityBookingWizard.ts`: Updated `fetchWalletThunk, topUpWalletThunk` import to `../../wallet/store/walletSlice`.
11. `src/features/amenities/hooks/useAmenitySocket.ts`: Updated `fetchWalletThunk` import to `../../wallet/store/walletSlice`.
12. `src/features/amenities/hooks/useMyBookings.ts`: Updated `fetchWalletThunk` import to `../../wallet/store/walletSlice`.
13. `src/features/amenities/hooks/useResidentBooking.ts`: Updated `fetchWalletThunk, topUpWalletThunk` import to `../../wallet/store/walletSlice`.
14. `src/features/amenities/hooks/useResidentWallet.ts`: Updated `fetchWalletThunk, topUpWalletThunk, clearWalletStatus` import to `../../wallet/store/walletSlice`.
15. `COMPONENTS_CATALOG.md`: Updated `WalletTransactionCard` path to `src/features/wallet/components/WalletTransactionCard.tsx`.

---

## 6. Verification Results

1. **TypeScript Typecheck:**
   * Ran `npx tsc --noEmit`.
   * **Result:** Exit code 0 (Zero compilation errors).
2. **Old Import Search:**
   * Searched for `features/billing/store/walletSlice`: **0 occurrences**.
   * Searched for `features/billing/screens/WalletScreen`: **0 occurrences**.
   * Searched for `features/amenities/store/walletSlice`: **0 occurrences**.
   * Searched for `features/billing/components/WalletHeroCard`: **0 occurrences**.
   * Searched for `features/billing/components/WalletTransactionCard`: **0 occurrences**.
3. **Unit Tests:**
   * Ran `src/features/wallet/__tests__/walletSlice.test.ts`: **6 passed, 6 total**.
   * Ran `src/features/amenities/__tests__/amenityBookingWizard.test.tsx`: **36 passed, 36 total**.

---

## 7. Known Remaining Issues for Phase 1

As mandated by Phase 0 boundaries, the following critical issues identified in the Forensic Audit were intentionally preserved and must be addressed in **Phase 1: Critical Financial Security Remediation**:
1. Amenity Booking Wizard hardcoded mock order ID (`order_amenity_${Date.now()}`) and mock gateway key (`rzp_test_mockkey`).
2. Amenity signature verification bypass (`useAmenityBookingWizard.ts` skipping `/payments/verify-signature`).
3. Amenity wallet payment reference spoofing (`WALLET_TXN_${Date.now()}`) without backend wallet debit.
4. Unverified direct wallet balance inflation via `POST /wallet/add-money`.
5. Local client arithmetic in `PaymentCheckoutSheet.tsx` overwriting server-authoritative settlement state.
6. Missing deterministic `X-Idempotency-Key` headers on payment checkout mutations.
