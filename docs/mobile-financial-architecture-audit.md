# NAHOM / Connect Harmony — Mobile Financial Architecture Forensic Audit

**Document Version:** 1.0.0  
**Audit Date:** September 2026  
**Audited Subsystems:** Mobile Application (`mobile/mobile-app/`)  
**Backend Reference:** Unified Financial Architecture (Phases 1–8)  
**Status:** Completed Forensic Audit (Audit Only — Zero Code Modifications Executed)

---

## 1. Executive Summary

A comprehensive forensic audit of the mobile application codebase (`mobile/mobile-app/`) was conducted to evaluate its alignment with the finalized backend **Unified Financial Architecture** (`UnifiedPaymentService` → `PaymentSettlementService` → `FinancialLedgerService` / atomic `Wallet`).

### 1.1 High-Level Assessment
The mobile application exhibits strong UI foundations (NativeWind styling, responsive bottom sheets, and an in-app `RazorpayCheckoutModal` WebView implementation). However, the mobile codebase contains **critical financial vulnerabilities, signature verification bypasses, duplicate slice definitions, and optimistic client-side calculations** that actively conflict with the backend's server-authoritative, double-entry financial principles.

### 1.2 Summary of Findings
| Domain | Forensic Status | Critical Flaws Identified | Risk Level |
| :--- | :--- | :--- | :--- |
| **Billing / Invoices** | Partially Integrated | Local optimistic arithmetic overwriting server state; receipt synthesized on client; missing idempotency keys on writes. | **Medium** |
| **Amenity Bookings** | Severely Compromised | Hardcoded mock order IDs (`order_amenity_${Date.now()}`) and mock keys (`rzp_test_mockkey`); complete signature verification bypass; dummy client wallet reference (`WALLET_TXN_${Date.now()}`) bypassing wallet debit and ledger. | **Critical** |
| **Digital Wallet** | Structurally Misaligned | Dual slice definitions (`amenities/store/walletSlice` aliasing `billing/store/walletSlice`); wallet not isolated as a standalone feature; direct unverified balance inflation via `/wallet/add-money`. | **High** |
| **Offline / Cash** | Incomplete Integration | Cash payments recorded via isolated legacy routes without correlation to the unified financial ledger. | **Medium** |
| **Network & Security** | Pass with Gaps | Zero private secrets exposed in client (clean); `X-Request-ID` is present; missing request-level idempotency headers on checkout. | **Medium** |

---

## 2. Complete Inventory of Mobile Financial Codebase

The mobile codebase contains financial logic distributed across two primary feature directories (`src/features/billing/` and `src/features/amenities/`):

### 2.1 Screens (`screens/` and `app/`)
* `app/(tabs)/billing.tsx` & `app/(tabs)/wallet.tsx`: Top-level tab routes.
* `src/features/billing/screens/ResidentMyDuesScreen.tsx`: Resident portfolio overview and due cards.
* `src/features/billing/screens/InvoiceDetailsScreen.tsx`: Detailed invoice view with breakdown and settlement CTA.
* `src/features/billing/screens/WalletScreen.tsx`: Resident digital wallet overview, balance card, top-up trigger, and transaction list.
* `src/features/billing/screens/PaymentResultScreen.tsx`: Success/failure status screen displaying synthesized receipt details.
* `src/features/billing/screens/BillingLedgerScreen.tsx` & `AdminBillingDashboardScreen.tsx`: Admin-facing audit grids and KPIs.
* `src/features/amenities/screens/ResidentAmenityDetailScreen.tsx`: Amenity booking entry point.

### 2.2 UI Components (`components/`)
* `src/features/billing/components/PaymentCheckoutSheet.tsx`: Multi-method invoice checkout modal (Wallet, Razorpay, Offline).
* `src/features/billing/components/RazorpayCheckoutModal.tsx`: In-app WebView embedding Razorpay standard checkout script (`checkout.razorpay.com/v1/checkout.js`).
* `src/features/billing/components/WalletHeroCard.tsx`: Wallet balance summary card with quick action buttons.
* `src/features/billing/components/WalletTransactionCard.tsx`: List item renderer for credit/debit transaction records.
* `src/features/billing/components/PaymentReceiptCard.tsx` & `PaymentReceiptModal.tsx`: Renderers for payment receipts.
* `src/features/billing/components/OfflineSettleSheet.tsx` & `AdminOfflineSettleSheet.tsx`: Resident submission and admin approval of offline proof.
* `src/features/amenities/components/wizard/AmenityBookingWizard.tsx`: Multi-step amenity reservation container.
* `src/features/amenities/components/BookingCheckoutModal.tsx`: Legacy booking review and payment selector.
* `src/features/amenities/components/WalletTopUpModal.tsx`: Preset chip selector for wallet balance top-up.

### 2.3 Custom Hooks (`hooks/`)
* `src/features/billing/hooks/useMobilePayment.ts`: Encapsulates wallet settlement, Razorpay order creation, and signature verification.
* `src/features/billing/hooks/useBilling.ts`: Bridges `billingSlice` state, dues loading, and payment thunks.
* `src/features/amenities/hooks/useAmenityBookingWizard.ts`: Orchestrates availability, holds, pricing, checkout, and pass generation.
* `src/features/amenities/hooks/useResidentBooking.ts`: Legacy hook orchestrating slot selection and single-step reservation.
* `src/features/amenities/hooks/useResidentWallet.ts`: Hook providing wallet balance and top-up operations for amenity users.

### 2.4 State Slices (`store/`)
* `src/store/store.ts`: Global Redux store registering `billing`, `wallet` (from billing), `amenities`, and `amenityBookings`.
* `src/features/billing/store/billingSlice.ts`: Authoritative slice for invoices, dues portfolio, KPIs, and offline settlement.
* `src/features/billing/store/walletSlice.ts`: Authoritative slice for wallet balance, transaction pagination, and top-up thunks.
* `src/features/amenities/store/walletSlice.ts`: **Duplicate/Alias slice** re-exporting thunks from `billing/store/walletSlice.ts`.
* `src/features/amenities/store/amenityBookingSlice.ts`: Authoritative slice for holds, reservations, and gate passes.

### 2.5 API Services (`services/`)
* `src/features/billing/services/billingService.ts`: Axios client wrapper for `/invoices`, `/wallet`, and `/payments`.
* `src/features/amenities/services/amenityService.ts`: Axios client wrapper for legacy `/amenity-bookings`.
* `src/features/amenities/services/amenityManagementService.ts`: Axios client wrapper for v2 `/holds`, `/pricing`, and `/reservations`.

---

## 3. Forensic Analysis: The 5 Critical Architectural Flaws

### 3.1 Flaw 1: Amenity Mock Order ID & Mock Key Hardcoding
* **Location:** `mobile/mobile-app/src/features/amenities/components/wizard/AmenityBookingWizard.tsx` (Lines 228–238)
* **Code Evidence:**
  ```tsx
  {/* Razorpay Checkout Modal */}
  <RazorpayCheckoutModal
    visible={wizard.isRazorpayOpen}
    options={{
      razorpayKeyId: 'rzp_test_mockkey',
      orderId: `order_amenity_${Date.now()}`,
      paymentId: `pay_rec_${Date.now()}`,
      amount: wizard.pricingSnapshot?.totalAmount || 0,
      currency: wizard.pricingSnapshot?.currency || 'INR',
      description: `Amenity Booking: ${facility.name}`,
    }}
    onSuccess={wizard.handleRazorpaySuccess}
    onDismiss={() => wizard.setIsRazorpayOpen(false)}
    ...
  />
  ```
* **Forensic Diagnosis:**  
  When an online payment is initiated for an amenity reservation, the mobile app **never contacts the backend** to create a genuine Razorpay order. It fabricates a client-side order ID (`order_amenity_${Date.now()}`) and uses a hardcoded dummy key (`'rzp_test_mockkey'`). This causes real payment gateways to fail or forces the WebView into synthetic mock mode.

---

### 3.2 Flaw 2: Amenity Gateway Signature Verification Bypass
* **Location:** `mobile/mobile-app/src/features/amenities/hooks/useAmenityBookingWizard.ts` (Lines 632–660)
* **Code Evidence:**
  ```tsx
  const handleRazorpaySuccess = useCallback(
    async (result: { razorpayPaymentId: string }) => {
      setIsRazorpayOpen(false);
      setPaymentReference(result.razorpayPaymentId);

      // Auto trigger confirmation with verified payment ID
      if (activeHold?._id) {
        const payload = mapConfirmFormToApiPayload({
          holdId: activeHold._id,
          paymentReference: result.razorpayPaymentId,
          notes: bookingNotes,
        });

        const idempotencyKey = `confirm_hold_${activeHold._id}`;
        const confirmResult = await dispatch(
          confirmReservationThunk({ payload, idempotencyKey })
        ).unwrap();
        ...
  ```
* **Forensic Diagnosis:**  
  Upon receiving a callback from Razorpay, the mobile app **never calls `POST /payments/verify-signature`**. It immediately takes the raw, unverified `result.razorpayPaymentId` and forwards it as the `paymentReference` in the `confirmReservationThunk` payload to `/reservations/confirm`. Because the backend's v2 reservation service sets `paymentStatus = 'PAID'` if any string `paymentReference` is present, the booking is confirmed without cryptographic verification, creating a massive financial fraud vulnerability.

---

### 3.3 Flaw 3: Amenity Wallet Payment Bypass & Missing Debit
* **Location:** `mobile/mobile-app/src/features/amenities/hooks/useAmenityBookingWizard.ts` (Lines 575–586)
* **Code Evidence:**
  ```tsx
  if (isPaymentRequired) {
    if (paymentMethod === 'WALLET') {
      if (!isBalanceSufficient) {
        setStepError(`Insufficient wallet balance (${balance} ${currency}). Please top up.`);
        setIsTopUpOpen(true);
        return;
      }
      finalRef = finalRef || `WALLET_TXN_${Date.now()}`;
    } else if (paymentMethod === 'RAZORPAY' && !finalRef) {
      ...
  ```
* **Forensic Diagnosis:**  
  When a resident pays for an amenity via their Digital Wallet, the app checks if `balance >= amount`, generates a local dummy string (`WALLET_TXN_${Date.now()}`), and submits that as `paymentReference` to confirm the reservation. **No wallet debit API call is ever made**. The resident's wallet balance is never deducted, no `WalletTransaction` is created, and no double-entry ledger record is posted to the database.

---

### 3.4 Flaw 4: Direct Unverified Wallet Balance Top-Up (`/wallet/add-money`)
* **Location:**  
  - `src/features/billing/store/walletSlice.ts` (Lines 52–64)  
  - `src/features/amenities/store/walletSlice.ts` (Lines 29–39)  
  - `src/features/amenities/hooks/useAmenityBookingWizard.ts` (Lines 666–675)
* **Code Evidence:**
  ```tsx
  export const topUpWalletThunk = createAsyncThunk(
    'wallet/topUpWalletThunk',
    async (amount: number, { dispatch, rejectWithValue }) => {
      try {
        const result = await dispatch(topUpWalletDirect({ amount })).unwrap();
        return result;
      } catch (err: any) { ... }
    }
  );
  ```
  Calling `billingService.topUpWalletDirect(amount)`:
  ```ts
  async topUpWalletDirect(amount: number): Promise<any> {
    const response: any = await apiClient.post('/wallet/add-money', { amount });
    ...
  }
  ```
* **Forensic Diagnosis:**  
  In the amenity booking flow, clicking "Top Up Wallet" displays preset chips (₹100, ₹250, ₹500, ₹1000). Upon confirming, the mobile client calls `POST /wallet/add-money`, instantly inflating the user's wallet balance on the backend without any payment gateway order, payment verification, or ledger backing. This debug/test endpoint should never be invoked in production user flows.

---

### 3.5 Flaw 5: Client-Side Arithmetic & Optimistic Status Overwrite
* **Location:** `mobile/mobile-app/src/features/billing/components/PaymentCheckoutSheet.tsx` (Lines 141–160, 207–226)
* **Code Evidence:**
  ```tsx
  const rawTotal = invoice.totalDue || invoice.totalAmount || (invoice as any).amount || totalDue;
  const currentPaid = (invoice.paidAmount || 0) + amountToPay;
  const calcRemaining = Math.max(0, remainingDue - amountToPay);
  const isFull = calcRemaining <= 0.01;

  const updatedReceiptData = {
    ...(result?.invoice || {}),
    ...invoice,
    _id: invoice._id,
    invoiceNumber: invoice.invoiceNumber || result?.invoice?.invoiceNumber || invoice._id,
    paidAmount: currentPaid,
    amountPaid: amountToPay,
    outstandingAmount: calcRemaining,
    status: (isFull ? 'PAID' : 'PARTIALLY_PAID') as any,
    paymentMethod: 'Digital Wallet',
  };
  ```
* **Forensic Diagnosis:**  
  The mobile component computes invoice totals, remaining balances, and status (`PAID` vs `PARTIALLY_PAID`) locally using JavaScript arithmetic. It then spreads stale local invoice state (`...invoice`) on top of the backend's response (`...(result?.invoice || {})`), potentially overwriting server-authoritative numbers (discounts, late fees, penalty recalculations). The UI must treat backend response envelopes as the single source of truth.

---

## 4. Architectural Boundaries & Feature Isolation Violations

1. **Violation of "One Model, One Feature" Rule:**  
   The `Digital Wallet` entity currently resides inside `src/features/billing/store/walletSlice.ts` and `src/features/billing/screens/WalletScreen.tsx`. Wallet is an independent financial domain model and must be extracted into its own dedicated feature module: `src/features/wallet/`.
2. **Duplicate Slice Anti-Pattern:**  
   `src/features/amenities/store/walletSlice.ts` is a 52-line redundant proxy that merely imports and re-exports actions from `src/features/billing/store/walletSlice.ts`. This breaks clean feature boundaries and creates confusion regarding the single source of truth.
3. **Optimistic Store Mutators in `billingSlice.ts`:**  
   `performInvoiceSync` manually mutates `state.activeDues.unitBreakdown` and `state.invoicesList` based on assumed statuses instead of re-fetching or consuming canonical settlement state payloads.

---

## 5. Security & Sensitive Configuration Audit

1. **Zero Secret Leakage:**  
   Verification confirmed that **no private payment secrets** (`RAZORPAY_KEY_SECRET`, webhook signing secrets, or private certificates) are bundled or present in the mobile codebase.
2. **Public Key Injection:**  
   The app reads `process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID`. In production, this must be dynamically resolved from the backend's `GET /payments/status` endpoint to ensure tenant-aware gateway configuration without rebuilding native binaries.
3. **Idempotency Deficit:**  
   While `apiClient.ts` automatically generates and attaches an `X-Request-ID` header, financial mutations (e.g. `POST /payments/create-order`, `POST /wallet/pay-invoice`) do **not** supply deterministic client-side `X-Idempotency-Key` headers. An intermittent mobile network drop during payment submission could cause duplicate order creations or double debits.

---

## 6. UI/UX & Mobile Component Catalog Compliance

1. **Catalog Reuse:**  
   `PaymentCheckoutSheet.tsx` and `WalletScreen.tsx` properly utilize catalog primitives (`ScreenShell`, `BottomSheet`, `StatusBadge`, `Button`, `DetailRow`).
2. **RTL & Logical Spacing:**  
   Several custom inline views in `PaymentCheckoutSheet.tsx` and `BookingCheckoutModal.tsx` still use physical margin classes (`mr-2`, `ml-1`) rather than NativeWind logical spacing tokens (`me-2`, `ms-1`).
3. **Dashboard Activity previews:**  
   The recent transaction history in `WalletHeroCard` and `ResidentMyDuesScreen` complies with the 3-item preview restriction before linking to dedicated full-screen lists.

---

## 7. Forensic Audit Conclusion

The mobile application's financial implementation cannot be safely deployed to production in its current state due to the **Amenity signature bypass, mock order hardcoding, and direct wallet balance manipulation**. A structured, 5-phase migration is required to align mobile with the Phase 8 Unified Financial Architecture.
