#!/usr/bin/env node

/**
 * CLI runner for NAHOM Production Financial Integrity and Metrics Check.
 *
 * Usage:
 *   node scripts/financial-integrity.mjs
 *   node scripts/financial-integrity.mjs --orgId=60d0fe4f5311236168a109ca
 *   node scripts/financial-integrity.mjs --mode=audit
 *   node scripts/financial-integrity.mjs --mode=metrics
 *   node scripts/financial-integrity.mjs --json
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import financialIntegrityService from '../src/features/ledger/financialIntegrity.service.js';
import financialMetricsService from '../src/features/ledger/financialMetrics.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = process.argv.slice(2);
let orgId = null;
let mode = 'all';
let outputJson = false;

for (const arg of args) {
  if (arg.startsWith('--orgId=')) {
    orgId = arg.split('=')[1];
  } else if (arg.startsWith('--mode=')) {
    mode = arg.split('=')[1];
  } else if (arg === '--json') {
    outputJson = true;
  }
}

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/manage_my_gate?replicaSet=rs0';

async function main() {
  try {
    await mongoose.connect(mongoUri);

    let integrityResult = null;
    let metricsResult = null;

    if (mode === 'audit' || mode === 'all') {
      integrityResult = await financialIntegrityService.runIntegrityCheck(orgId);
    }

    if (mode === 'metrics' || mode === 'all') {
      metricsResult = await financialMetricsService.getMetrics(orgId);
    }

    if (outputJson) {
      console.log(JSON.stringify({ integrity: integrityResult, metrics: metricsResult }, null, 2));
    } else {
      console.log('===============================================================');
      console.log('           NAHOM FINANCIAL INTEGRITY & HEALTH REPORT           ');
      console.log('===============================================================');
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log(`Tenant Scope: ${orgId || 'GLOBAL (ALL TENANTS)'}`);

      if (integrityResult) {
        console.log('\n--- 1. INTEGRITY AUDIT SUITES ---');
        console.log(`Overall Status: [${integrityResult.status}]`);
        for (const [suite, status] of Object.entries(integrityResult.suites)) {
          const mark = status === 'PASS' ? '✅ PASS' : '❌ FAIL';
          console.log(`  - ${suite.padEnd(20)}: ${mark}`);
        }

        const totalIssues = Object.values(integrityResult.details).reduce((acc, curr) => acc + curr.length, 0);
        if (totalIssues > 0) {
          console.log('\n--- DETECTED ANOMALIES ---');
          for (const [cat, issues] of Object.entries(integrityResult.details)) {
            if (issues.length > 0) {
              console.log(`  [${cat.toUpperCase()}]: ${issues.length} issue(s)`);
              for (const issue of issues.slice(0, 5)) {
                console.log(`    * ${issue.type}: ${issue.message}`);
              }
              if (issues.length > 5) {
                console.log(`    ... and ${issues.length - 5} more`);
              }
            }
          }
        } else {
          console.log('\n✅ Zero financial invariants violated across all audited records.');
        }
      }

      if (metricsResult) {
        console.log('\n--- 2. OPERATIONAL FINANCIAL METRICS ---');
        console.log(`System Status: [${metricsResult.overallStatus}]`);
        console.log(`Payments: Total=${metricsResult.payments.total} (Success=${metricsResult.payments.success}, Pending=${metricsResult.payments.pending}, Failed=${metricsResult.payments.failed}, Vol=₹${metricsResult.payments.totalSuccessVolume})`);
        console.log(`Ledger: TotalEntries=${metricsResult.ledger.totalEntries}, Debits=₹${metricsResult.ledger.totalDebits}, Credits=₹${metricsResult.ledger.totalCredits}, Imbalance=₹${metricsResult.ledger.imbalance} (${metricsResult.ledger.isBalanced ? 'BALANCED ✅' : 'IMBALANCED ❌'})`);
        console.log(`Wallets: Active=${metricsResult.wallets.totalWallets}, Circulating=₹${metricsResult.wallets.totalCirculatingBalance}, NegativeCount=${metricsResult.wallets.negativeBalanceCount} (Transactions=${metricsResult.wallets.transactions.total})`);
        console.log(`Exceptions Queue: Total=${metricsResult.reconciliationQueue.total}, Open=${metricsResult.reconciliationQueue.open}, UnderReview=${metricsResult.reconciliationQueue.under_review}, Resolved=${metricsResult.reconciliationQueue.resolved}`);
        console.log(`Legacy Models Status: WriteProtected=${metricsResult.legacyStorage.writeProtectionEnforced} (WalletLedger=${metricsResult.legacyStorage.walletLedgerHistoricalCount}, Ledger=${metricsResult.legacyStorage.ledgerHistoricalCount})`);
      }

      console.log('===============================================================\n');
    }

    const failed = (integrityResult && integrityResult.status === 'FAIL') || (metricsResult && metricsResult.overallStatus === 'DEGRADED');
    process.exit(failed ? 1 : 0);
  } catch (err) {
    console.error('Fatal integrity check error:', err);
    process.exit(2);
  } finally {
    await mongoose.disconnect();
  }
}

main();
