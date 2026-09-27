import integrationHubService from '../integrationHub/integrationHub.service.js';
import logger from '../../utils/logger.utils.js';

/**
 * Check if a credential value is an unconfigured placeholder or dummy string.
 * @param {string} val
 * @returns {boolean}
 */
function isPlaceholder(val) {
  if (!val || typeof val !== 'string') return true;
  const normalized = val.trim().toLowerCase();
  const placeholders = [
    'test_key',
    'your_key_id',
    'rzp_test_your_key_id_here',
    'your_key_secret',
    'placeholder',
    'none',
    'null',
    'undefined',
  ];
  return placeholders.some((ph) => normalized.includes(ph));
}

/**
 * Mask credential for safe logging and reporting.
 * @param {string} val
 * @returns {string}
 */
function maskSecret(val) {
  if (!val || typeof val !== 'string') return '***';
  if (val.length <= 8) return '********';
  return `${val.substring(0, 4)}...${val.substring(val.length - 4)}`;
}

/**
 * Payment Configuration Resolver
 * Implements a unified 4-tier fallback hierarchy to resolve gateway credentials:
 * Tier 1: Community IntegrationHub connection (Tenant-level)
 * Tier 2: Community Organization record settings
 * Tier 3: Global IntegrationHub connection (Platform-level)
 * Tier 4: Environment Variables fallback
 */
export class PaymentConfigResolver {
  /**
   * Resolve gateway credentials for an organization and provider.
   * @param {object} params
   * @param {string} [params.orgId] - Community/Organization ID
   * @param {string} [params.provider='razorpay'] - Provider key ('razorpay', 'mock')
   * @returns {Promise<{
   *   provider: string,
   *   keyId: string,
   *   keySecret: string,
   *   isConfigured: boolean,
   *   source: 'integrationHub' | 'organization' | 'globalIntegrationHub' | 'env' | 'mock' | 'none'
   * }>}
   */
  async getConfig({ orgId, provider = 'razorpay', allowEnvFallback = false } = {}) {
    const activeProvider = (provider || 'razorpay').toLowerCase();

    // Mock Provider handling
    if (activeProvider === 'mock') {
      return {
        provider: 'mock',
        keyId: 'rzp_test_mockkey',
        keySecret: 'mock_secret_key',
        isConfigured: true,
        source: 'mock',
      };
    }

    // Tier 1: Community / Tenant IntegrationHub
    if (orgId) {
      try {
        const isConnected = await integrationHubService.isProviderConfigured(orgId, activeProvider);
        if (isConnected) {
          const creds = await integrationHubService.getDecryptedCredentials(orgId, activeProvider);
          const keyId = (creds?.keyId || creds?.key_id || '').trim();
          const keySecret = (creds?.keySecret || creds?.key_secret || '').trim();

          if (keyId && keySecret && !isPlaceholder(keyId) && !isPlaceholder(keySecret)) {
            logger.debug('Resolved payment credentials from Tier 1 (Tenant IntegrationHub)', {
              orgId,
              provider: activeProvider,
              keyIdPreview: maskSecret(keyId),
              source: 'integrationHub',
            });
            return {
              provider: activeProvider,
              keyId,
              keySecret,
              isConfigured: true,
              source: 'integrationHub',
            };
          }
        }
      } catch (err) {
        logger.warn('Tier 1 credential check failed:', { orgId, provider: activeProvider, error: err.message });
      }

      // Tier 2: Organization record settings
      try {
        const organizationService = (await import('../organization/organization.services.js')).default;
        const org = await organizationService.getOrganizationById(orgId);
        const orgPaymentConfig = org?.paymentConfig || org?.billingSettings?.paymentConfig;

        if (orgPaymentConfig) {
          const keyId = (orgPaymentConfig.keyId || orgPaymentConfig.key_id || '').trim();
          const keySecret = (orgPaymentConfig.keySecret || orgPaymentConfig.key_secret || '').trim();

          if (keyId && keySecret && !isPlaceholder(keyId) && !isPlaceholder(keySecret)) {
            logger.debug('Resolved payment credentials from Tier 2 (Organization Record)', {
              orgId,
              provider: activeProvider,
              keyIdPreview: maskSecret(keyId),
              source: 'organization',
            });
            return {
              provider: activeProvider,
              keyId,
              keySecret,
              isConfigured: true,
              source: 'organization',
            };
          }
        }
      } catch (err) {
        logger.debug('Tier 2 organization check skipped or not present:', { orgId, error: err.message });
      }
    }

    // Tier 3: Global IntegrationHub connection (Platform default: orgId: null or isGlobal: true)
    try {
      const IntegrationHub = (await import('../integrationHub/integrationHub.model.js')).default;
      const globalConn = await IntegrationHub.findOne({
        $or: [{ orgId: null }, { isGlobal: true }],
        provider: activeProvider,
        status: 'connected',
      });
      if (globalConn && globalConn.status === 'connected' && globalConn.credentials) {
        const { decrypt, decryptGCM } = await import('../integrationHub/utils/crypto.util.js');
        const decryptedCreds = {};
        for (const cred of globalConn.credentials) {
          if (cred.authTag) {
            decryptedCreds[cred.key] = decryptGCM(cred.encryptedValue, cred.iv, cred.authTag);
          } else {
            decryptedCreds[cred.key] = decrypt(cred.encryptedValue, cred.iv);
          }
        }

        const keyId = (decryptedCreds.keyId || decryptedCreds.key_id || '').trim();
        const keySecret = (decryptedCreds.keySecret || decryptedCreds.key_secret || '').trim();

        if (keyId && keySecret && !isPlaceholder(keyId) && !isPlaceholder(keySecret)) {
          logger.debug('Resolved payment credentials from Tier 3 (Global IntegrationHub)', {
            provider: activeProvider,
            keyIdPreview: maskSecret(keyId),
            source: 'globalIntegrationHub',
          });
          return {
            provider: activeProvider,
            keyId,
            keySecret,
            isConfigured: true,
            source: 'globalIntegrationHub',
          };
        }
      }
    } catch (err) {
      logger.debug('Tier 3 global integration check skipped:', { provider: activeProvider, error: err.message });
    }

    // If an orgId was specified and neither tenant nor global IntegrationHub is configured,
    // tenant cannot use server env fallback unless explicitly requested.
    if (orgId && !allowEnvFallback) {
      return {
        provider: activeProvider,
        keyId: null,
        keySecret: null,
        isConfigured: false,
        source: 'none',
      };
    }

    // Tier 4: Environment Variables Fallback (Platform-level fallback when !orgId)
    const envKeyId = (
      activeProvider === 'razorpay'
        ? process.env.RAZORPAY_KEY_ID
        : process.env[`${activeProvider.toUpperCase()}_KEY_ID`]
    )?.trim();

    const envKeySecret = (
      activeProvider === 'razorpay'
        ? process.env.RAZORPAY_KEY_SECRET
        : process.env[`${activeProvider.toUpperCase()}_KEY_SECRET`]
    )?.trim();

    if (envKeyId && envKeySecret && !isPlaceholder(envKeyId) && !isPlaceholder(envKeySecret)) {
      logger.debug('Resolved payment credentials from Tier 4 (Environment Variables)', {
        provider: activeProvider,
        keyIdPreview: maskSecret(envKeyId),
        source: 'env',
      });
      return {
        provider: activeProvider,
        keyId: envKeyId,
        keySecret: envKeySecret,
        isConfigured: true,
        source: 'env',
      };
    }

    // If completely unconfigured
    return {
      provider: activeProvider,
      keyId: null,
      keySecret: null,
      isConfigured: false,
      source: 'none',
    };
  }

  /**
   * Check whether gateway credentials are fully configured for an org & provider.
   * @param {object} params
   * @param {string} [params.orgId]
   * @param {string} [params.provider='razorpay']
   * @returns {Promise<boolean>}
   */
  async isConfigured({ orgId, provider = 'razorpay' } = {}) {
    const config = await this.getConfig({ orgId, provider });
    return config.isConfigured;
  }

  /**
   * Sanitize a config object for client consumption or public APIs (omits keySecret).
   * @param {object} config
   * @returns {object}
   */
  sanitizeConfig(config) {
    if (!config) return { isConfigured: false, provider: null, keyId: null, source: 'none' };
    return {
      provider: config.provider,
      keyId: config.keyId,
      isConfigured: Boolean(config.isConfigured),
      source: config.source,
    };
  }

  /**
   * Validate whether a config object has usable credentials.
   * @param {object} config
   * @returns {boolean}
   */
  validateConfig(config) {
    if (!config || typeof config !== 'object') return false;
    if (config.provider === 'mock') return true;
    if (!config.keyId || !config.keySecret) return false;
    if (isPlaceholder(config.keyId) || isPlaceholder(config.keySecret)) return false;
    return true;
  }
}

// Global Singleton Instance
export const paymentConfigResolver = new PaymentConfigResolver();

export default paymentConfigResolver;
