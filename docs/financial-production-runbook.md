# NAHOM Financial Production Runbook

## 1. Production Deployment Sequence

Follow this strict step-by-step checklist when deploying Phase 8 to staging or production environments.

### Step 1: Pre-Deployment Health & Regression Check
Run the comprehensive financial test suite and CLI health check on the active deployment environment:
```bash
# 1. Run all regression test suites
node --test tests/payment.contracts.phase2.test.mjs
node --test tests/payment.core.phase3.test.mjs
node --test tests/payment.financial.phase4.test.mjs
node --test tests/billing.payment.phase5.test.mjs
node --test tests/amenity.payment.phase6.test.mjs
node --test tests/financial.reconciliation.phase7.test.mjs
node --test tests/financial.architecture.phase8.test.mjs
node tests/wallet_recharge_security.test.js

# 2. Run financial integrity CLI
node scripts/financial-integrity.mjs --mode=all
```
*Criteria:* All suites must pass with 0 failures before initiating code deployment.

---

### Step 2: Database Index Verification
Ensure MongoDB compound indexes are present (or build in background):
```javascript
// Run in mongosh connected to production database
use manage_my_gate;

// 1. Payment compound indexes
db.payments.createIndex({ orgId: 1, status: 1, createdAt: -1 }, { background: true });
db.payments.createIndex({ orgId: 1, domain: 1, createdAt: -1 }, { background: true });
db.payments.createIndex({ referenceType: 1, referenceId: 1, status: 1 }, { background: true });

// 2. Financial Ledger Entry indexes
db.financialledgerentries.createIndex({ idempotencyKey: 1 }, { unique: true, background: true });
db.financialledgerentries.createIndex({ orgId: 1, domain: 1, createdAt: -1 }, { background: true });
db.financialledgerentries.createIndex({ paymentId: 1 }, { background: true });

// 3. Wallet indexes
db.wallets.createIndex({ userId: 1, orgId: 1 }, { unique: true, background: true });
db.wallettransactions.createIndex({ orgId: 1, referenceType: 1, referenceId: 1 }, { background: true });
```

---

### Step 3: Production Environment Variables & Feature Flags
Configure the following feature flags in `backend/.env`:

```env
# Phase 8 Canonical Financial Feature Flags
UNIFIED_PAYMENT_CORE_ENABLED=true
UNIFIED_LEDGER_ENABLED=true
LEGACY_PAYMENT_PATH_ENABLED=false
LEGACY_WEBHOOK_ENABLED=true
HISTORICAL_RECONCILIATION_ENABLED=true
GENESIS_LEDGER_ENABLED=false
```

---

### Step 4: Rolling Deployment & Process Restart
Deploy backend application instances using a zero-downtime rolling strategy (e.g. PM2, Kubernetes, or Docker Compose).
```bash
pm2 reload backend-api
```

---

### Step 5: Post-Deployment Smoke Verification
Immediately execute the health endpoints:
```bash
# 1. Check operational metrics
curl -X GET "https://api.domain.com/api/v1/ledger/reconciliation/metrics" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"

# 2. Check full system integrity
curl -X GET "https://api.domain.com/api/v1/ledger/reconciliation/integrity" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```
*Verification Target:*
* `overallStatus`: `"HEALTHY"`
* `ledger.isBalanced`: `true`
* `ledger.imbalance`: `0`
* `wallets.negativeBalanceCount`: `0`

---

## 2. Operational Monitoring & Alert Thresholds

| Metric | Normal Range | Alert Threshold | Severity | Immediate Action |
| :--- | :--- | :--- | :--- | :--- |
| **Ledger Imbalance** | `₹0.00` | `> ₹0.00` | **P0 (Critical)** | Page Financial Eng On-Call. Halt automated withdrawals. Run integrity diagnostic. |
| **Negative Wallet Balances** | `0` | `> 0` | **P0 (Critical)** | Lock affected wallet record. Trace concurrent debit logs. |
| **Open Reconciliation Exceptions** | `0 - 5` | `> 10` | **P1 (High)** | Review `/api/v1/ledger/reconciliation/exceptions`. Dispatch settlement retries. |
| **Webhook Failure Rate** | `< 0.5%` | `> 2.0%` | **P1 (High)** | Verify Razorpay webhook secret signature in Tier 1 Integration Hub. |
| **Settlement Latency (p99)** | `< 500ms` | `> 2000ms` | **P2 (Medium)** | Check MongoDB replica set write concern and transaction locks. |

---

## 3. Incident Response Playbooks

### Playbook A: Webhook Dropped / Gateway Network Glitch
* **Symptom:** Resident completed Razorpay checkout, but app shows Invoice or Amenity Booking as pending.
* **Diagnosis:** Check `payments` collection for `gatewayTransactionId: pay_...` with `status: pending`.
* **Resolution:**
  1. Trigger manual settlement via admin endpoint:
     ```bash
     curl -X POST "https://api.domain.com/api/v1/payment/verify" \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
       -d '{"paymentId": "<PAYMENT_ID>", "razorpayPaymentId": "<RZP_PAY_ID>"}'
     ```
  2. `PaymentSettlementService` will execute transaction-bounded domain settlement and double-entry ledger entry idempotently.

---

### Playbook B: Ledger Imbalance Alarm Triggered
* **Symptom:** Alert fired `ledger.imbalance > 0`.
* **Diagnosis:** Run CLI diagnostic with `--mode=audit`:
  ```bash
  node scripts/financial-integrity.mjs --mode=audit
  ```
* **Resolution:**
  1. Inspect the reported transaction IDs where `debits !== credits`.
  2. If an entry is corrupted or partial, inspect the MongoDB transaction log. All production writes are wrapped in Mongoose transactions (`session.startTransaction()`); uncommitted partial transactions automatically abort.

---

### Playbook C: Rollback Strategy
If an unexpected edge case requires temporarily falling back:
1. Set `LEGACY_PAYMENT_PATH_ENABLED=true` in `backend/.env`.
2. Reload backend instances (`pm2 reload backend-api`).
3. The system will activate the backward-compatible compatibility facade while investigations proceed without dropping data.
