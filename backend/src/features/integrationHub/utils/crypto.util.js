import crypto from 'crypto';
import config from '../../../config/config.js';

const CBC_ALGORITHM = 'aes-256-cbc';
const GCM_ALGORITHM = 'aes-256-gcm';
const CBC_IV_LENGTH = 16; // 16 bytes for CBC
const GCM_IV_LENGTH = 12; // 12 bytes standard for AES-256-GCM

/**
 * Derives a 32-byte key for CBC encryption from standard encryption key.
 * @returns {Buffer} 32-byte key buffer
 */
const getEncryptionKey = () => {
  const rawKey = config.encryptionKey || process.env.ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('Encryption key is not configured in environment or config');
  }
  return crypto.createHash('sha256').update(rawKey).digest();
};

/**
 * Derives a 32-byte key for AES-256-GCM vault from VAULT_ENCRYPTION_KEY.
 * Strictly uses process.env.VAULT_ENCRYPTION_KEY (with safe fallbacks).
 * @returns {Buffer} 32-byte key buffer
 */
const getVaultEncryptionKey = () => {
  const rawKey = process.env.VAULT_ENCRYPTION_KEY || config.vaultEncryptionKey || config.encryptionKey;
  if (!rawKey) {
    throw new Error('VAULT_ENCRYPTION_KEY is required but not defined in environment');
  }
  return crypto.createHash('sha256').update(rawKey).digest();
};

/**
 * Legacy CBC Encrypt (Preserved to avoid breaking previous code).
 * @param {string} text - Plain text to encrypt
 * @returns {object} { encryptedValue, iv }
 */
export const encrypt = (text) => {
  if (!text) {
    throw new Error('Text to encrypt cannot be empty');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(CBC_IV_LENGTH);
  const cipher = crypto.createCipheriv(CBC_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encryptedValue: encrypted,
    iv: iv.toString('hex')
  };
};

/**
 * Legacy CBC Decrypt (Preserved to avoid breaking previous code).
 * Also gracefully handles GCM if authTag is passed as 3rd parameter.
 * @param {string} encryptedText - Hex-encoded encrypted text
 * @param {string} ivHex - Hex-encoded initialization vector
 * @param {string} [authTagHex] - Hex-encoded auth tag (optional, for GCM)
 * @returns {string} Plain text decrypted string
 */
export const decrypt = (encryptedText, ivHex, authTagHex = null) => {
  if (!encryptedText || !ivHex) {
    throw new Error('Encrypted text and IV are required for decryption');
  }

  // If authTag is provided, delegate to GCM decryption
  if (authTagHex) {
    return decryptGCM(encryptedText, ivHex, authTagHex);
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key, iv);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

/**
 * Dedicated AES-256-GCM Encrypt for Banking & Credential Vault.
 * Uses process.env.VAULT_ENCRYPTION_KEY.
 * @param {string} text - Plain text to encrypt
 * @returns {object} { encryptedValue, iv, authTag }
 */
export const encryptGCM = (text) => {
  if (!text) {
    throw new Error('Text to encrypt cannot be empty');
  }

  const key = getVaultEncryptionKey();
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedValue: encrypted,
    iv: iv.toString('hex'),
    authTag
  };
};

/**
 * Dedicated AES-256-GCM Decrypt for Banking & Credential Vault.
 * Uses process.env.VAULT_ENCRYPTION_KEY.
 * @param {string} encryptedText - Hex-encoded ciphertext
 * @param {string} ivHex - Hex-encoded IV (12 bytes)
 * @param {string} authTagHex - Hex-encoded Auth Tag (16 bytes)
 * @returns {string} Plain text decrypted string
 */
export const decryptGCM = (encryptedText, ivHex, authTagHex) => {
  if (!encryptedText || !ivHex || !authTagHex) {
    throw new Error('Encrypted text, IV, and authTag are required for GCM decryption');
  }

  const key = getVaultEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

/**
 * Decrypts a stored credential entry of either format: AES-256-GCM (has authTag) or legacy CBC.
 * @param {{encryptedValue: string, iv: string, authTag?: string}} cred
 * @returns {string}
 */
export const decryptCredential = (cred) =>
  cred.authTag ? decryptGCM(cred.encryptedValue, cred.iv, cred.authTag) : decrypt(cred.encryptedValue, cred.iv, cred.authTag);

export default {
  encrypt,
  decrypt,
  encryptGCM,
  decryptGCM,
  decryptCredential
};

