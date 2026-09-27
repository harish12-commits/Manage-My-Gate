/**
 * NAHOM Unified Financial Architecture - Phase 8
 * Canonical Financial Feature Flags & Operational Configuration
 *
 * Controls architectural routing, legacy deprecation policies, and reconciliation access.
 */

export const FINANCIAL_FEATURE_FLAGS = Object.freeze({
  UNIFIED_PAYMENT_CORE_ENABLED: 'UNIFIED_PAYMENT_CORE_ENABLED',
  UNIFIED_LEDGER_ENABLED: 'UNIFIED_LEDGER_ENABLED',
  LEGACY_PAYMENT_PATH_ENABLED: 'LEGACY_PAYMENT_PATH_ENABLED',
  LEGACY_WEBHOOK_ENABLED: 'LEGACY_WEBHOOK_ENABLED',
  HISTORICAL_RECONCILIATION_ENABLED: 'HISTORICAL_RECONCILIATION_ENABLED',
  GENESIS_LEDGER_ENABLED: 'GENESIS_LEDGER_ENABLED',
});

const DEFAULT_FLAGS = {
  [FINANCIAL_FEATURE_FLAGS.UNIFIED_PAYMENT_CORE_ENABLED]: true,
  [FINANCIAL_FEATURE_FLAGS.UNIFIED_LEDGER_ENABLED]: true,
  [FINANCIAL_FEATURE_FLAGS.LEGACY_PAYMENT_PATH_ENABLED]: false,
  [FINANCIAL_FEATURE_FLAGS.LEGACY_WEBHOOK_ENABLED]: true,
  [FINANCIAL_FEATURE_FLAGS.HISTORICAL_RECONCILIATION_ENABLED]: true,
  [FINANCIAL_FEATURE_FLAGS.GENESIS_LEDGER_ENABLED]: false,
};

/**
 * Check if a financial feature flag is enabled.
 * Supports environment variable overrides (e.g. process.env.UNIFIED_PAYMENT_CORE_ENABLED = 'true' | 'false').
 * @param {string} flagName
 * @returns {boolean}
 */
export function isFinancialFeatureEnabled(flagName) {
  if (process.env[flagName] !== undefined) {
    return process.env[flagName] === 'true' || process.env[flagName] === '1';
  }
  return DEFAULT_FLAGS[flagName] ?? false;
}

export const financialFeatureFlags = {
  isEnabled: isFinancialFeatureEnabled,
  getAll() {
    const flags = {};
    for (const key of Object.keys(FINANCIAL_FEATURE_FLAGS)) {
      flags[key] = isFinancialFeatureEnabled(key);
    }
    return flags;
  },
  FLAGS: FINANCIAL_FEATURE_FLAGS,
};

export default {
  FINANCIAL_FEATURE_FLAGS,
  isFinancialFeatureEnabled,
  financialFeatureFlags,
};

