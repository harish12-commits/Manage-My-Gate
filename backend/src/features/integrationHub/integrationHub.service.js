import mongoose from 'mongoose';
import integrationHubRepository from './integrationHub.repository.js';
import { verifyProviderConnection } from './utils/providers/index.js';
import { encrypt, decrypt, encryptGCM, decryptGCM } from './utils/crypto.util.js';
import HttpError from '../../utils/httpError.utils.js';

/**
 * Service class for orchestrating the business logic of integrationHub.
 */
export class IntegrationHubService {
  /**
   * Connect an integration by validating the connection and saving the credentials.
   * @param {string} userId - User identifier (who configured the integration)
   * @param {string} orgId - Organization identifier (which owns the integration)
   * @param {string} provider - Provider key (openai, twilio, resend, banking, razorpay)
   * @param {string} accountLabel - Human readable label
   * @param {object} credentials - Key-value pair of raw credentials
   * @returns {Promise<object>} Sanitized integration record details
   */
  async connect(userId, orgId, provider, accountLabel, credentials) {
    if (!userId || !orgId || !provider || !accountLabel || !credentials) {
      throw new HttpError(400, 'User ID, Organization ID, provider, accountLabel, and credentials are required.');
    }

    // 1. Verify connection against the provider API / validation rules
    try {
      await verifyProviderConnection(provider, credentials);
    } catch (err) {
      throw new HttpError(400, err.message);
    }

    // 2. Encrypt all credentials securely using AES-256-GCM for banking/razorpay and CBC for legacy
    const providerLower = provider.toLowerCase();
    // Authenticated encryption (AES-256-GCM) for every provider; legacy CBC records stay readable.
    const useGCM = true;

    const encryptedCredentials = Object.entries(credentials).map(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        throw new HttpError(400, `Value for credential key "${key}" cannot be empty.`);
      }
      const strVal = String(value);

      if (useGCM) {
        const { encryptedValue, iv, authTag } = encryptGCM(strVal);
        return {
          key,
          encryptedValue,
          iv,
          authTag,
        };
      } else {
        const { encryptedValue, iv } = encrypt(strVal);
        return {
          key,
          encryptedValue,
          iv,
        };
      }
    });

    // 3. Database transaction for atomic persistence
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const connection = await integrationHubRepository.upsertConnection(
        userId,
        orgId,
        providerLower,
        accountLabel,
        encryptedCredentials,
        'connected',
        session
      );
      await session.commitTransaction();

      // Return sanitized output (never return encryptedValue, iv, or authTag to client)
      return {
        id: connection._id,
        provider: connection.provider,
        accountLabel: connection.accountLabel,
        status: connection.status,
        configuredKeys: connection.credentials.map((c) => c.key),
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get paginated connections for an organization, omitting secrets.
   * @param {string} orgId - Organization identifier
   * @param {string} [provider] - Optional provider filter
   * @param {number} [page=1] - Current page number
   * @param {number} [limit=10] - Records per page
   * @returns {Promise<object>} Paginated data payload
   */
  async getList(orgId, provider, page = 1, limit = 10) {
    if (!orgId) {
      throw new HttpError(400, 'Organization ID is required.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const skip = (page - 1) * limit;
      const { data, totalRecords } = await integrationHubRepository.getConnectionsPaginated(
        orgId,
        provider,
        skip,
        limit,
        session
      );
      await session.commitTransaction();

      const totalPages = Math.ceil(totalRecords / limit);

      const formatted = data.map((conn) => ({
        id: conn._id,
        provider: conn.provider,
        accountLabel: conn.accountLabel,
        status: conn.status,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
      }));

      return {
        data: formatted,
        pagination: {
          totalRecords,
          currentPage: page,
          totalPages: totalPages || 1,
          limit,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Delete an integration connection after checking it is not in use by any role.
   * @param {string} connectionId - ID of connection to delete
   * @param {string} orgId - Organization identifier of owner
   * @returns {Promise<object>} Deletion metadata
   */
  async deleteConnection(connectionId, orgId) {
    if (!connectionId || !orgId) {
      throw new HttpError(400, 'Connection ID and Organization ID are required.');
    }

    // Dynamic import to prevent circular dependency
    const roleService = (await import('../role/role.services.js')).default;
    
    // Check if the connection is mapped to any role
    const inUse = await roleService.isConnectionInUse(connectionId);
    if (inUse) {
      throw new HttpError(409, 'Cannot delete. This connection is currently mapped to an active role.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const connection = await integrationHubRepository.deleteConnectionById(connectionId, orgId, session);
      if (!connection) {
        throw new HttpError(404, `No connection found for ID: ${connectionId}`);
      }
      await session.commitTransaction();

      return {
        id: connection._id,
        provider: connection.provider,
        status: 'disconnected',
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Update the account label of a connection.
   * @param {string} connectionId - ID of the connection
   * @param {string} orgId - Owner Organization ID
   * @param {string} newLabel - The new account label
   * @returns {Promise<object>} Updated connection metadata
   */
  async updateConnectionLabel(connectionId, orgId, newLabel) {
    if (!connectionId || !orgId || !newLabel) {
      throw new HttpError(400, 'Connection ID, Organization ID, and new label are required.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const connection = await integrationHubRepository.updateConnectionLabel(
        connectionId,
        orgId,
        newLabel,
        session
      );
      if (!connection) {
        throw new HttpError(404, `No connection found for ID: ${connectionId}`);
      }
      await session.commitTransaction();

      return {
        id: connection._id,
        provider: connection.provider,
        accountLabel: connection.accountLabel,
        status: connection.status,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Retrieve and decrypt credentials for a specific connection.
   * Strictly for internal cross-feature use. Supports both GCM and CBC decryption.
   * @param {string} connectionId - ID of the connection
   * @returns {Promise<object>} Raw decrypted credentials key-value object
   */
  async getDecryptedCredentialsById(connectionId) {
    if (!connectionId) {
      throw new HttpError(400, 'Connection ID is required.');
    }

    const connection = await integrationHubRepository.getConnectionById(connectionId);
    if (!connection) {
      throw new HttpError(404, `Connection with ID ${connectionId} not found.`);
    }

    const decryptedCredentials = {};
    for (const cred of connection.credentials) {
      if (cred.authTag) {
        decryptedCredentials[cred.key] = decryptGCM(cred.encryptedValue, cred.iv, cred.authTag);
      } else {
        decryptedCredentials[cred.key] = decrypt(cred.encryptedValue, cred.iv, cred.authTag);
      }
    }

    return decryptedCredentials;
  }

  /**
   * Check whether a provider has been configured and connected by the community admin for this organization.
   * @param {string} orgId - Organization ID
   * @param {string} [provider='razorpay'] - Provider key
   * @returns {Promise<boolean>}
   */
  async isProviderConfigured(orgId, provider = 'razorpay') {
    if (!orgId) return false;
    const connection = await integrationHubRepository.findConnectionByOrgAndProvider(orgId, provider);
    if (!connection || connection.status !== 'connected' || !Array.isArray(connection.credentials)) {
      return false;
    }
    const credKeys = connection.credentials.map((c) => c.key);
    const hasKeyId = credKeys.includes('keyId') || credKeys.includes('key_id');
    const hasKeySecret = credKeys.includes('keySecret') || credKeys.includes('key_secret');
    return hasKeyId && hasKeySecret;
  }

  /**
   * Retrieve and decrypt credentials for an organization by provider key.
   * Strictly for internal cross-feature use by payment and other services.
   * @param {string} orgId - Organization ID
   * @param {string} [provider='razorpay'] - Provider key
   * @returns {Promise<object>} Raw decrypted credentials key-value object with isConfigured flag
   */
  async getDecryptedCredentials(orgId, provider = 'razorpay') {
    if (!orgId) {
      throw new HttpError(400, 'Organization ID is required.');
    }

    const connection = await integrationHubRepository.findConnectionByOrgAndProvider(orgId, provider);
    let decryptedCredentials = {};
    let isConfigured = false;

    if (connection && connection.status === 'connected' && connection.credentials) {
      for (const cred of connection.credentials) {
        if (cred.authTag) {
          decryptedCredentials[cred.key] = decryptGCM(cred.encryptedValue, cred.iv, cred.authTag);
        } else {
          decryptedCredentials[cred.key] = decrypt(cred.encryptedValue, cred.iv, cred.authTag);
        }
      }
      const keyId = decryptedCredentials.keyId || decryptedCredentials.key_id;
      const keySecret = decryptedCredentials.keySecret || decryptedCredentials.key_secret;
      if (keyId && keySecret) {
        isConfigured = true;
      }
    }

    const keyId = decryptedCredentials.keyId || decryptedCredentials.key_id || '';
    const keySecret = decryptedCredentials.keySecret || decryptedCredentials.key_secret || '';

    return {
      ...decryptedCredentials,
      keyId,
      keySecret,
      key_id: keyId,
      key_secret: keySecret,
      isConfigured,
    };
  }

  /**
   * Find SMTP connection for an organization.
   * @param {string} orgId - Organization ID
   * @param {import('mongoose').ClientSession} [session] - Optional session
   * @returns {Promise<object|null>}
   */
  async findSmtpConnection(orgId, session = null) {
    if (!orgId) {
      throw new HttpError(400, 'Organization ID is required.');
    }
    return await integrationHubRepository.findSmtpConnection(orgId, session);
  }

  /**
   * Get connection by provider and status globally (not scoped to an organization).
   * @param {string} provider - Provider key
   * @param {import('mongoose').ClientSession} [session] - Optional session
   * @returns {Promise<object|null>}
   */
  async getGlobalConnectionByProvider(provider, session = null) {
    if (!provider) {
      throw new HttpError(400, 'Provider is required.');
    }
    return await integrationHubRepository.findGlobalConnectionByProvider(provider, session);
  }
}

export default new IntegrationHubService();

