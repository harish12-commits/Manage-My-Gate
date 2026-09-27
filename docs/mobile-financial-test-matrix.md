# NAHOM / Connect Harmony — Mobile Financial Test Matrix

**Document Version:** 1.0.0  
**Audit Date:** September 2026  
**Scope:** Mobile Financial Subsystems (`mobile/mobile-app/`)  
**Backend Parity:** Phase 8 Unified Payment Core & Double-Entry Ledger  
**Status:** Verification & Testing Blueprint

---

## 1. Testing Framework & Philosophy

Testing of the mobile financial integration adheres to the project's core testing rule: **"Test the Engine, Not the Paint"**.
* **Engine Focus:** Prioritize unit and integration testing of Custom Hooks (`useMobilePayment`, `useAmenityBookingWizard`, `useResidentWallet`), Redux Feature Slices (`billingSlice`, `walletSlice`, `amenityBookingSlice`), and API Services (`billingService`, `amenityManagementService`, `walletService`).
* **Invariants Verification:** Every financial test scenario must verify that:
  1. Client-side math never overrides server-authoritative numbers.
  2. Idempotency keys prevent duplicate orders or settlements.
  3. Every successful financial movement reflects accurately in Redux state without requiring manual page reloads.
  4. Intermittent network drops never leave the UI in an unrecoverable or conflicting state.

---

## 2. Comprehensive Test Scenario Matrix

| ID | Domain | Test Category | Scenario Name | Pre-Conditions | Action Steps | Expected Result | Invariant Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-BIL-01** | Billing | Integration / UI | Full Invoice Settlement via Wallet | Resident has open invoice (₹1,500); Wallet balance is ₹2,000. | 1. Open `PaymentCheckoutSheet`.<br>2. Select `Digital Wallet`.<br>3. Confirm full payment of ₹1,500. | Invoice settled; Modal closes; Redirects to receipt screen with canonical transaction details. | Wallet balance in Redux updates to ₹500; Invoice status in `invoicesList` updates to `PAID` from server payload. |
| **TC-BIL-02** | Billing | Integration / UI | Partial Invoice Settlement via Wallet | Resident has open invoice (₹3,000); Wallet balance is ₹1,000. | 1. Open `PaymentCheckoutSheet`.<br>2. Select custom amount ₹1,000.<br>3. Select `Digital Wallet` and confirm. | Settlement succeeds; Receipt shows ₹1,000 paid; Outstanding shows ₹2,000. | Server response dictates remaining balance (₹2,000); Status set to `PARTIALLY_PAID`; Client does not perform optimistic math. |
| **TC-BIL-03** | Billing | Unit / Hook | Wallet Payment with Insufficient Balance | Resident has open invoice (₹2,000); Wallet balance is ₹500. | 1. Open `PaymentCheckoutSheet`.<br>2. Select `Digital Wallet`. | Wallet method displays red warning badge; "Confirm" CTA disabled or replaced with "Top Up Wallet". | No API request is dispatched to `/wallet/pay-invoice`. |
| **TC-BIL-04** | Billing | Integration / E2E | Full Invoice Settlement via Razorpay | Resident has open invoice (₹2,500); Payment gateway configured. | 1. Select `Razorpay Online`.<br>2. Tap "Proceed to Pay".<br>3. Complete WebView mock payment.<br>4. Trigger signature verification. | `POST /payments/create-order` called with real ID; WebView opens with order ID; Signature verified via `POST /payments/verify-signature`; Receipt displayed. | Razorpay order ID is genuine; Signature verified before setting invoice to `PAID`; Ledger updated. |
| **TC-BIL-05** | Billing | Resilience | Duplicate Click Idempotency | Resident taps "Confirm Payment" button multiple times rapidly. | Rapidly double-tap "Confirm & Pay" button. | Second tap is debounced; Both requests carry identical `X-Idempotency-Key`; Backend returns cached result. | Exactly one financial settlement occurs; Zero duplicate ledger postings. |
| **TC-BIL-06** | Billing | Network Failure | Network Timeout during Gateway Order Creation | Resident initiates online checkout; Mobile drops connection. | 1. Tap "Pay with Razorpay".<br>2. Simulate network timeout (15s). | Error banner displayed: "Network connection lost. Please check connection and retry."; State reset cleanly. | No orphaned order in local state; UI remains interactive. |
| **TC-BIL-07** | Billing | Integration | Offline Proof Submission | Resident pays via bank transfer; Has payment screenshot. | 1. Select `Offline Transfer`.<br>2. Enter reference `NEFT-998811`.<br>3. Upload screenshot.<br>4. Submit proof. | `PATCH /invoices/:id/settle-offline` called; Invoice transitions to `VERIFICATION_PENDING`. | Status in store updates to `VERIFICATION_PENDING`; Badge reflects offline review state. |
| **TC-AMN-01** | Amenities | Critical E2E | Amenity Online Booking with Genuine Order | Resident selects tennis court; Total fee ₹600; Hold is ACTIVE. | 1. Proceed to Payment Step.<br>2. Select `Online Payment`.<br>3. Tap "Pay & Confirm". | Backend `POST /payments/create-order` creates order; WebView loads real `orderId`; Key resolved from backend. | **Mock order (`order_amenity_`) is NEVER generated**; Real order ID linked to hold. |
| **TC-AMN-02** | Amenities | Critical E2E | Amenity Signature Verification Enforcement | Resident completes Razorpay checkout for amenity hold. | 1. WebView reports payment success.<br>2. Hook triggers verification. | `POST /payments/verify-signature` is executed FIRST; Upon 200 OK, `POST /reservations/confirm` is called with verified ID. | **Bypass eliminated**: Unverified payment IDs cannot confirm reservations. |
| **TC-AMN-03** | Amenities | Security / Fault | Signature Verification Failure | Malicious/corrupted signature payload returned from WebView. | Tamper with `razorpaySignature` in mock callback. | Verification endpoint returns 400 "Invalid signature"; Reservation confirmation is ABORTED; Error shown. | Reservation status remains `PENDING` or `HOLD`; Access pass is NOT generated. |
| **TC-AMN-04** | Amenities | Critical E2E | Amenity Booking via Digital Wallet | Resident reserves pool slot (₹300); Wallet balance is ₹1,000. | 1. Select `Digital Wallet`.<br>2. Tap "Confirm Reservation". | Backend executes atomic wallet debit and ledger entry; Reservation transitions to `CONFIRMED`; Pass generated. | **Bypass eliminated**: Resident wallet balance decreases by ₹300; Dummy `WALLET_TXN_` string is never used. |
| **TC-AMN-05** | Amenities | Edge Case | Hold Expiry Prior to Payment Completion | Resident holds court slot; 10-minute hold timer elapses while on payment step. | Wait for hold timer to expire; Tap "Confirm & Pay". | UI alerts: "Hold expired. The slot has been released."; User redirected to slot selection. | Payment order is not submitted; No funds deducted. |
| **TC-AMN-06** | Amenities | Integration | Cash Payment at Gate by Guard | Resident arrives at gate with unpaid `PAY_AT_GATE` amenity reservation. | 1. Guard scans QR or opens booking.<br>2. Selects "Record Cash".<br>3. Submits receipt number. | `POST /amenity-bookings/:id/cash-payment` called; Status becomes `CONFIRMED`; Ledger entry posted. | Resident app refreshes pass status to `CONFIRMED` via WebSocket or pull-to-refresh. |
| **TC-WLT-01** | Wallet | Integration / UI | Wallet Balance & Transaction History Fetch | Resident opens Wallet tab. | Open `WalletScreen.tsx`. | `GET /wallet` called; Hero card renders balance; Transaction card list renders with types (`Credit`/`Debit`). | Store `state.wallet.balance` updates; Pagination handles subsequent page loads smoothly. |
| **TC-WLT-02** | Wallet | Critical E2E | Wallet Top-Up via Razorpay Gateway | Resident selects ₹500 preset chip to add funds to wallet. | 1. Select ₹500 chip.<br>2. Tap "Add Money".<br>3. Complete WebView payment.<br>4. Trigger signature verification. | `POST /wallet/create-order` creates order; Signature verified via `POST /wallet/verify-payment`; Balance increases by ₹500. | **Bypass eliminated**: `POST /wallet/add-money` is NEVER called; Double-entry ledger entry created. |
| **TC-WLT-03** | Wallet | Unit / Slice | Multi-Tenant Wallet Context Switch | Resident switches community workspace from Org A to Org B. | Dispatch `auth/switchWorkspaceContext/fulfilled`. | Wallet balance and transaction history are purged from state; Fresh wallet loaded for Org B. | No cross-tenant balance leakage in memory. |
| **TC-RES-01** | Resilience | State Recovery | App Termination During Active WebView Payment | Resident is on Razorpay payment WebView; Force-quits mobile app. | 1. App killed mid-transaction.<br>2. Re-open application. | App restarts gracefully; Invoice/Hold remains in pending state; User can resume checkout without corruption. | Webhook handles backend settlement if payment succeeded at gateway; Next app launch pulls fresh dues. |
| **TC-RES-02** | Resilience | Concurrency | Rapid Hold & Release Race Condition | User taps "Reserve" then immediately taps "Cancel/Back". | Rapidly trigger `createHold` followed by `releaseHold`. | Both requests resolve cleanly; Active hold state in Redux is set to `null`; No lingering lock on slot. | Discrete slot becomes available again for other residents. |

---

## 3. Automated Test Execution Guidelines

### 3.1 Unit & Hook Test Environment Setup
* **Runner:** Jest with React Native Testing Library (`@testing-library/react-native`).
* **Store Mocking:** Use `configureStore` with real reducers (`billingReducer`, `walletReducer`, `amenityBookingReducer`) and mocked Axios client (`apiClient`).
* **Command:**
  ```powershell
  cd mobile/mobile-app
  npm run test -- --testPathPattern="features/(billing|amenities|wallet)"
  ```

### 3.2 Mock Gateway Testing Mode
To run end-to-end payment simulations without incurring real credit card transactions:
1. Ensure backend environment sets `NODE_ENV=development`.
2. The in-app `RazorpayCheckoutModal` will automatically render its native development simulation banner when connected to test credentials.
3. Use the backend `/payments/simulate` route to test asynchronous webhook delivery and socket updates.
