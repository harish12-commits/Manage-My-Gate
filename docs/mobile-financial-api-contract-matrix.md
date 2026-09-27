# NAHOM / Connect Harmony — Mobile ↔ Backend Financial API Contract Matrix

**Document Version:** 1.0.0  
**Audit Date:** September 2026  
**Reference Backend:** Phase 8 Deprecation & Hardened Architecture  
**Reference Client:** Expo React Native (`mobile/mobile-app/`)  
**Status:** Canonical Reference Matrix

---

## 1. Overview of Contract Statuses

Each mobile API interaction is categorized under one of the following authoritative contract statuses:
* **`CANONICAL`**: Fully aligned with the Phase 8 Unified Payment Core and atomic ledger. Retain with standard maintenance.
* **`MISCONFIGURED`**: Points to a valid or semi-valid endpoint, but transmits an incomplete, malformed, or client-derived payload. Requires payload/header correction.
* **`BYPASS`**: Completely bypasses backend verification, authentication, or financial atomicity (e.g. mock orders, direct unverified balance injections). **Must be eliminated immediately**.
* **`DEPRECATED`**: Targets a legacy or redundant backend route that is marked for sunset. Must be migrated to the canonical unified route.

---

## 2. Comprehensive API Contract Matrix

| Feature / Domain | Mobile Service / Hook Caller | Current Mobile Endpoint & Method | Current Mobile Payload & Headers | Target Canonical Endpoint (Phase 8) & Method | Target Canonical Payload & Headers | Contract Status | Canonical Response Structure & State Mapping | Backward Compatibility & Migration Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Billing: Online Order** | `billingService.createRazorpayOrder` / `useMobilePayment` | `POST /payments/create-order` | `{ referenceId, referenceType: 'Invoice', amount, currency: 'INR', gateway: 'razorpay' }`<br>Headers: `X-Request-ID` | `POST /payments/create-order` | `{ referenceId, referenceType: 'Invoice', amount, currency: 'INR', gateway: 'razorpay' }`<br>Headers: `X-Request-ID`, `X-Idempotency-Key: invoice-order-${id}-${amount}` | **CANONICAL** | Returns `{ success: true, data: { orderId, amount, currency, razorpayKeyId, paymentId } }`. Mobile binds directly to `RazorpayCheckoutModal`. | Fully compatible with Phase 5/8 backend. Add deterministic idempotency header. |
| **Billing: Online Verification** | `billingService.verifyRazorpayPayment` / `useMobilePayment` | `POST /payments/verify-signature` | Redundant dual casing `{ paymentId, orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }` | `POST /payments/verify-signature` | `{ paymentId, orderId, razorpayPaymentId, razorpaySignature }`<br>Headers: `X-Request-ID`, `X-Idempotency-Key: invoice-verify-${paymentId}` | **CANONICAL** | Returns `{ success: true, message, data: { ...payment, invoice } }`. Mobile must update Redux using `data.invoice` and `data.payment` directly. | Clean up redundant payload casing. Do not recalculate status locally. |
| **Billing: Wallet Payment** | `billingService.payInvoiceWithWallet` / `useMobilePayment` | `POST /wallet/pay-invoice` | `{ invoiceId, amount }`<br>Headers: `X-Request-ID` | `POST /wallet/pay-invoice` *(or `POST /payments/create-order` with `paymentMethod: 'WALLET'`)* | `{ invoiceId, amount }`<br>Headers: `X-Request-ID`, `X-Idempotency-Key: invoice-wallet-${invoiceId}-${amount}` | **CANONICAL** | Returns `{ success: true, data: { invoice, payment, balance, walletTransaction } }`. Bind directly to store. | Retain `POST /wallet/pay-invoice` as canonical backward-compatible alias wrapping `UnifiedPaymentService`. |
| **Billing: Offline Proof** | `billingService.settleInvoiceOffline` / `useBilling` | `PATCH /invoices/:id/settle-offline` | `{ offlineReference, paymentMethod, offlineAmount, paymentDate, paymentScreenshot, payerNotes }` | `PATCH /invoices/:id/settle-offline` | `{ offlineReference, paymentMethod, amount, paymentDate, paymentScreenshot, payerNotes }`<br>Headers: `X-Request-ID` | **CANONICAL** | Returns `{ success: true, data: updatedInvoice }`. Dispatches `syncRealtimeInvoice`. | Fully supported by Billing service. Standardize `amount` naming. |
| **Billing: Offline Approval (Admin)** | `billingService.approveInvoiceOffline` / `useBilling` | `PATCH /invoices/:id/approve` | `{ amount, settlementType, paymentMethod, paymentReference, notes, paymentScreenshot }` | `PATCH /invoices/:id/approve` | `{ amount, settlementType, paymentMethod, paymentReference, notes, paymentScreenshot }` | **CANONICAL** | Backend settles invoice and posts ledger entry. Returns updated invoice. | Fully supported. Settle amount must be passed if custom. |
| **Amenity: Online Order (v2 Wizard)** | `AmenityBookingWizard.tsx` (Direct inline modal) | **NONE (Client synthesis)** | Client synthesizes fake IDs: `order_amenity_${Date.now()}` and key `'rzp_test_mockkey'` | `POST /payments/create-order` | `{ referenceId: holdId, referenceType: 'AmenityBooking', amount: totalAmount, currency: 'INR', gateway: 'razorpay' }`<br>Headers: `X-Idempotency-Key: amenity-order-${holdId}` | **BYPASS** | Returns canonical Razorpay order (`orderId`, `amount`, `currency`, `razorpayKeyId`, `paymentId`). | **CRITICAL FIX**: Introduce `createAmenityOrder` API call before opening `RazorpayCheckoutModal`. |
| **Amenity: Online Verification (v2 Wizard)** | `useAmenityBookingWizard.handleRazorpaySuccess` | **NONE (Direct bypass to confirm)** | Skips signature verification! Forwards raw `razorpayPaymentId` as `paymentReference` into `/reservations/confirm` | `POST /payments/verify-signature` THEN `POST /amenities/v2/reservations/confirm` | Step 1: `{ paymentId, orderId, razorpayPaymentId, razorpaySignature }`<br>Step 2: `{ holdId, paymentReference: paymentId, paymentId }` | **BYPASS** | Step 1 confirms payment in Payment Core & Ledger. Step 2 links verified `paymentId` to confirmed reservation and generates pass. | **CRITICAL FIX**: Insert `verifyPaymentSignature` step prior to triggering reservation confirmation. |
| **Amenity: Wallet Payment (v2 Wizard)** | `useAmenityBookingWizard.handleConfirmReservation` | **NONE (Synthesizes dummy ref)** | Generates `WALLET_TXN_${Date.now()}` and skips wallet debit API call entirely! | `POST /amenities/v2/reservations/confirm` with verified wallet payment | Option A: Backend handles atomic wallet debit inside `confirmReservationFromHold` when `paymentMethod: 'WALLET'`.<br>Option B: Call `POST /payments/create-order` (`method: 'WALLET'`). | **BYPASS** | Returns `{ reservation, pass, updatedWalletBalance }`. Dispatches wallet balance update to Redux store. | **CRITICAL FIX**: Ensure backend transaction executes `walletService.updateBalance` and ledger posting. |
| **Amenity: Legacy Booking Creation** | `amenityService.createAmenityBooking` / `useResidentBooking` | `POST /amenity-bookings` | `{ amenityId, date, startTime, endTime, paymentMethod, guestsCount }` | `POST /amenity-bookings` | `{ amenityId, bookingDate, startTime, endTime, paymentMethod, guestsCount }`<br>Headers: `X-Idempotency-Key` | **CANONICAL (Phase 6)** | Backend automatically wraps wallet debit, ledger posting, or returns `paymentIntent` for online checkout. | Backward compatible with older resident screen flows. |
| **Amenity: Cash at Gate** | `amenityService.recordCashPayment` / `amenityBookingService` | `POST /amenity-bookings/:id/cash-payment` | `{ amount, receiptNumber, notes }` | `POST /amenity-bookings/:id/cash-payment` | `{ amount, receiptNumber, notes }`<br>Headers: `X-Idempotency-Key` | **CANONICAL (Phase 6)** | Settle payment via Unified Payment Core with `paymentMethod: 'CASH'`, marks booking as paid, and posts ledger entry. | Admin/Guard scanner flow. |
| **Wallet: Fetch Balance & History** | `billingService.getWalletBalance` / `walletSlice` | `GET /wallet` | Query: `{ page, limit }`<br>Headers: `X-Request-ID` | `GET /wallet` | Query: `{ page, limit }`<br>Headers: `X-Request-ID` | **CANONICAL** | Returns `{ success: true, data: { balance, currency, transactionHistory, pagination } }`. | Core balance query. Register in standalone `walletSlice`. |
| **Wallet: Recharge Order** | `billingService.createWalletOrder` / `walletSlice` | `POST /wallet/create-order` | `{ amount }`<br>Headers: `X-Request-ID` | `POST /wallet/create-order` *(or `POST /payments/create-order` with `referenceType: 'WalletRecharge'`)* | `{ amount }`<br>Headers: `X-Request-ID`, `X-Idempotency-Key: wallet-order-${userId}-${Date.now()}` | **CANONICAL** | Returns `{ success: true, data: { orderId, amount, currency, razorpayKeyId, paymentId } }`. | Backend routes to `UnifiedPaymentService.createPaymentOrder`. |
| **Wallet: Recharge Verification** | `billingService.verifyWalletPayment` / `walletSlice` | `POST /wallet/verify-payment` | Casing soup: `{ amount, paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature }` | `POST /wallet/verify-payment` *(or `POST /payments/verify-signature'`)* | Normalized: `{ amount, paymentId, orderId, razorpayPaymentId, razorpaySignature }` | **CANONICAL** | Backend verifies signature, credits wallet atomically, and posts double-entry ledger record. | Normalize payload keys to camelCase. |
| **Wallet: Direct Add Money (Test/Bypass)** | `billingService.topUpWalletDirect` / `useResidentWallet` | `POST /wallet/add-money` | `{ amount }`<br>Headers: `X-Request-ID` | **DO NOT CALL IN PRODUCTION** | N/A (Decommission from user UI) | **BYPASS** | Instantly inflates wallet balance without payment gateway order or ledger entry. | **CRITICAL FIX**: Remove "Top Up Wallet" direct add-money bypass from `WalletTopUpModal` and `useResidentWallet`. Route top-ups through `createWalletOrder`. |
| **Payment Config / Status** | None (Currently hardcoded / env only) | N/A | N/A | `GET /payments/status` | Headers: `X-Request-ID` | **CANONICAL (Phase 8)** | Returns tenant-aware payment gateway configuration: `{ isConfigured, provider: 'razorpay', keyId: 'rzp_live_...' }`. | Call on app startup or checkout init to dynamically resolve gateway key for current community. |

---

## 3. Payload Discrepancy & Normalization Guide

### 3.1 Gateway Signature Verification Normalization
Currently, mobile code passes arbitrary combinations of camelCase and snake_case properties across different services:
```ts
// Legacy Mobile Discrepancy (billingService.ts line 168):
const formattedPayload = {
  paymentId: payload.paymentId || payload.payment_id,
  orderId: payload.razorpayOrderId || payload.orderId || payload.razorpay_order_id,
  razorpayPaymentId: payload.razorpayPaymentId || payload.razorpay_payment_id,
  razorpaySignature: payload.razorpaySignature || payload.razorpay_signature,
  payment_id: payload.paymentId || payload.payment_id,
  razorpay_payment_id: payload.razorpayPaymentId || payload.razorpay_payment_id,
  razorpay_order_id: payload.razorpayOrderId || payload.orderId || payload.razorpay_order_id,
  razorpay_signature: payload.razorpaySignature || payload.razorpay_signature,
};
```
**Canonical Phase 8 Standard:**  
All mobile payment verification payloads should be standardized to clean, single-casing properties supported directly by `payment.controller.js`:
```json
{
  "paymentId": "pay_684fbc...",
  "orderId": "order_NX8...",
  "razorpayPaymentId": "pay_O745...",
  "razorpaySignature": "4a71b..."
}
```

---

## 4. Idempotency Header Standard

All mobile mutation requests handling financial transactions must include an `X-Idempotency-Key` header following deterministic format patterns:

| Financial Operation | Idempotency Key Format Pattern | Example |
| :--- | :--- | :--- |
| **Invoice Gateway Order** | `inv-ord-${invoiceId}-${amount}` | `inv-ord-66f123abc-2500` |
| **Invoice Gateway Verify** | `inv-vfy-${paymentId}-${orderId}` | `inv-vfy-66f123def-order_O98` |
| **Invoice Wallet Pay** | `inv-wlt-${invoiceId}-${amount}` | `inv-wlt-66f123abc-2500` |
| **Amenity Hold** | `amenity-hold-${facilityId}-${slotId}-${timestamp}` | `amenity-hold-66f456-slot1-1727218` |
| **Amenity Gateway Order** | `amenity-ord-${holdId}-${amount}` | `amenity-ord-66f789-500` |
| **Amenity Reservation Confirm** | `amenity-cfm-${holdId}` | `amenity-cfm-66f789` |
| **Wallet Recharge Order** | `wlt-ord-${userId}-${amount}-${timestamp}` | `wlt-ord-66f111-1000-1727218` |
| **Wallet Recharge Verify** | `wlt-vfy-${paymentId}-${orderId}` | `wlt-vfy-66f222-order_K33` |

---

## 5. Security & Tenant Context Guidelines

1. **Active Community Resolution:**  
   Every outgoing request must continue to have `X-Organization-Id` dynamically resolved by `apiClient.ts` interceptors using `store.getState().workspace.activeOrganizationId` or user payload claims.
2. **Gateway Key Ingestion:**  
   Never hardcode `'rzp_test_mockkey'`. If `EXPO_PUBLIC_RAZORPAY_KEY_ID` is not present, fetch the public key dynamically via `GET /payments/status` upon opening any payment modal.
3. **Response Envelope Invariant:**  
   Backend responses always adhere to `{ success: boolean, message?: string, data: any }`. Mobile callers must unwrap `.data` consistently using `extractEnvelope` or standard interceptor unpacking.
