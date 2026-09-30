import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend local directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'SESSION_SECRET', 'ENCRYPTION_KEY'];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Environment variable ${envVar} is required but not defined.`);
  }
}

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === process.env.JWT_SECRET) {
    throw new Error('JWT_REFRESH_SECRET must be set and different from JWT_SECRET in production.');
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
  // Payment/banking credentials are encrypted with these keys: require strong, separate secrets.
  if (process.env.ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters in production.');
  }
  if (!process.env.VAULT_ENCRYPTION_KEY || process.env.VAULT_ENCRYPTION_KEY.length < 32) {
    throw new Error('VAULT_ENCRYPTION_KEY must be set (32+ characters) in production.');
  }
  if ([process.env.ENCRYPTION_KEY, process.env.JWT_SECRET, process.env.JWT_REFRESH_SECRET].includes(process.env.VAULT_ENCRYPTION_KEY)) {
    throw new Error('VAULT_ENCRYPTION_KEY must differ from ENCRYPTION_KEY and the JWT secrets in production.');
  }
  if (process.env.ALLOW_MOCK_PAYMENTS === 'true') {
    throw new Error('ALLOW_MOCK_PAYMENTS must not be enabled in production.');
  }
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || 'localhost',
  mongodb: {
    uri: process.env.MONGODB_URI,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  session: {
    secret: process.env.SESSION_SECRET,
  },
  encryptionKey: process.env.ENCRYPTION_KEY,
  vaultEncryptionKey: process.env.VAULT_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY,

  cors: {
    allowedOrigins: (() => {
      const defaultOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3004',
        'http://localhost:5173',
        'http://localhost:8000',
        'http://localhost:8080',
        'http://localhost:8081',
        'http://localhost:8082',
        'http://localhost:19006',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3004',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8081',
        'http://[::1]:3000',
        'http://[::1]:3001',
        'http://[::1]:5173',
        'http://[::1]:8081'
      ];
      let rawOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim().replace(/\/+$/, ''))
        : defaultOrigins;

      rawOrigins = [...rawOrigins, ...defaultOrigins];

      if (process.env.CLIENT_URL) {
        rawOrigins.push(process.env.CLIENT_URL.trim().replace(/\/+$/, ''));
      }
      const host = process.env.HOST || 'localhost';
      const port = parseInt(process.env.PORT || '5000', 10);
      rawOrigins.push(`http://${host}:${port}`);
      rawOrigins.push(`http://127.0.0.1:${port}`);
      if (host !== 'localhost') {
        rawOrigins.push(`http://localhost:${port}`);
      }
      return [...new Set(rawOrigins.filter(Boolean))];
    })()
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  avatarUploadPath: process.env.AVATAR_UPLOAD_PATH || 'uploads/avatars',
  sso: {
    // Public OAuth client IDs are safe fallbacks for the released mobile app;
    // deployment variables still override them for another environment.
    googleClientId: process.env.GOOGLE_CLIENT_ID || '610778456829-edvpd6gcav2u31jo0p2aeligfopvqfbo.apps.googleusercontent.com',
    googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID || '610778456829-6g1bvqtplfrgva93sbdsvgbuqmkpr203.apps.googleusercontent.com',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    microsoftClientId: process.env.MICROSOFT_CLIENT_ID || '',
    microsoftTenantId: process.env.MICROSOFT_TENANT_ID || '',
    // Native Sign in with Apple tokens are issued to the iOS bundle identifier.
    // APPLE_SERVICE_ID is optional and is only needed if a web/Android OAuth flow
    // is added later with an Apple Services ID.
    appleClientId: process.env.APPLE_CLIENT_ID || 'com.atominosconsulting.nahom',
    appleServiceId: process.env.APPLE_SERVICE_ID || '',
  },
  mobile: {
    scheme: process.env.MOBILE_APP_SCHEME || 'managemygate',
    universalLinkDomain: process.env.MOBILE_UNIVERSAL_LINK_DOMAIN || 'app.managemygate.com',
    androidPackageName: process.env.MOBILE_ANDROID_PACKAGE_NAME || 'com.atominosconsulting.nahom',
    iosAppStoreId: process.env.MOBILE_IOS_APP_STORE_ID || '6746501635',
  },
};

export default config;
