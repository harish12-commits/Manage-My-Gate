import axios, { InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import storage from '../utils/storage';

// A pure JavaScript UUID v4 generator to prevent Expo native crypto errors
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const PRODUCTION_API_URL = 'https://managemygate.e3esg.com/api/v1';
export const PRODUCTION_SOCKET_URL = 'https://managemygate.e3esg.com';

export const getApiBaseUrl = () => {
  let url = process.env.EXPO_PUBLIC_API_URL;

  // In production builds, never allow local/LAN or emulator fallback IPs
  if (!__DEV__) {
    if (!url || /^(https?:\/\/)?(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)/i.test(url)) {
      return PRODUCTION_API_URL;
    }
    return url;
  }

  // 1. Web browser development: align with the browser's hostname and local backend port.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const isLocalHostName = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i.test(window.location.hostname);
    if (isLocalHostName) {
      return `${window.location.protocol}//${window.location.hostname}:5002/api/v1`;
    }
  }

  // 2. Native mobile development (Expo Go / Dev Client): connect to developer's local machine running backend
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5002/api/v1`;
    }
  }

  // 3. Android Emulator fallback
  if (Platform.OS === 'android') {
    if (!url || url.includes('localhost') || url.includes('127.0.0.1')) {
      return 'http://10.0.2.2:5002/api/v1';
    }
  }

  // 4. Default fallback
  return url || 'http://localhost:5002/api/v1';
};

export const getDefaultBaseUrl = getApiBaseUrl;

export const getSocketBaseUrl = () => {
  let socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;

  // In production builds, never allow local/LAN or emulator fallback socket URLs
  if (!__DEV__) {
    if (!socketUrl || /^(https?:\/\/)?(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)/i.test(socketUrl)) {
      return PRODUCTION_SOCKET_URL;
    }
    return socketUrl;
  }

  // 1. Web browser development: align socket with browser's hostname
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const isLocalHostName = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i.test(window.location.hostname);
    if (isLocalHostName) {
      return `${window.location.protocol}//${window.location.hostname}:5002`;
    }
  }

  // 2. Native mobile development: connect socket to developer's local machine
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5002`;
    }
  }

  // 3. Android Emulator fallback
  if (Platform.OS === 'android') {
    if (!socketUrl || socketUrl.includes('localhost') || socketUrl.includes('127.0.0.1')) {
      return 'http://10.0.2.2:5002';
    }
  }

  // 4. Default fallback
  return socketUrl || 'http://localhost:5002';
};

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Type': 'APP',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
  },
  timeout: 15000,
  withCredentials: true,
  // Treat 304 as valid to prevent unhandled cross-origin XHR network errors
  validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
});

if (__DEV__) {
  console.log(`[ApiClient] Configured baseURL: ${apiClient.defaults.baseURL}`);
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string | null) => void;
  reject: (reason: any) => void;
}> = [];

let store: any;

export const injectStore = (_store: any) => {
  store = _store;
};

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Helper to safely extract payload claims from JWT token with in-memory caching
let cachedJwtToken: string | null = null;
let cachedJwtPayload: any = null;

const decodeJwtPayload = (token: string): any => {
  if (!token || typeof token !== 'string') return null;
  if (token === cachedJwtToken && cachedJwtPayload !== null) {
    return cachedJwtPayload;
  }

  let result: any = null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof atob === 'function') {
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      result = JSON.parse(jsonPayload);
    }
  } catch (e) {
    try {
      const parts = token.split('.');
      if (parts.length >= 2 && typeof atob === 'function') {
        result = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      }
    } catch (e2) {}
  }

  if (result) {
    cachedJwtToken = token;
    cachedJwtPayload = result;
  }
  return result;
};

// Request Interceptor: Attach headers and correlation ID
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Dynamically align baseURL with the active runtime environment
    config.baseURL = getApiBaseUrl();

    // Generate and inject a unique Request Correlation ID
    config.headers['X-Request-ID'] = generateUUID();
    config.headers['X-Client-Type'] = 'APP';

    try {
      const state = store ? (store.getState() as any) : null;

      let token = state?.auth?.token;
      if (!token) {
        token = await storage.getItem('token');
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      let rawOrgId =
        state?.workspace?.activeOrganizationId ||
        state?.auth?.user?.orgId ||
        state?.auth?.user?.communityId ||
        state?.auth?.user?.organizationId ||
        state?.auth?.user?.org?._id ||
        state?.auth?.user?.org ||
        state?.auth?.user?.activeOrgId ||
        state?.auth?.user?.activeOrganizationId ||
        (Array.isArray(state?.auth?.user?.availableWorkspaces) && state?.auth?.user?.availableWorkspaces[0]?.orgId) ||
        (Array.isArray(state?.auth?.user?.availableWorkspaces) && state?.auth?.user?.availableWorkspaces[0]?._id);

      if (!rawOrgId) {
        const userStr = await storage.getItem('user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            rawOrgId =
              user?.orgId ||
              user?.communityId ||
              user?.organizationId ||
              user?.org?._id ||
              user?.org ||
              user?.activeOrgId ||
              user?.activeOrganizationId ||
              (Array.isArray(user?.availableWorkspaces) && user?.availableWorkspaces[0]?.orgId) ||
              (Array.isArray(user?.availableWorkspaces) && user?.availableWorkspaces[0]?._id);
          } catch (e) {}
        }
      }

      // If orgId is still missing, extract it directly from the JWT token payload claims
      if (!rawOrgId && token) {
        const jwtData = decodeJwtPayload(token);
        rawOrgId =
          jwtData?.orgId ||
          jwtData?.organizationId ||
          jwtData?.org ||
          jwtData?.activeOrgId;
      }

      // Extract target orgId from URL if requesting an organization-scoped endpoint (e.g., /organizations/:id/features)
      const urlOrgMatch = config.url ? config.url.match(/\/organizations\/([a-fA-F0-9]{24})/) : null;
      const targetUrlOrgId = urlOrgMatch ? urlOrgMatch[1] : null;

      const activeOrgId =
        targetUrlOrgId ||
        (typeof rawOrgId === 'object' && rawOrgId !== null
          ? rawOrgId._id || rawOrgId.id || String(rawOrgId)
          : rawOrgId);

      if (activeOrgId && activeOrgId !== '[object Object]') {
        config.headers['x-organization-id'] = activeOrgId;
      }

      let rawUserId =
        state?.auth?.user?.id ||
        state?.auth?.user?._id ||
        state?.auth?.user?.userId;

      if (!rawUserId) {
        const userStr = await storage.getItem('user');
        if (userStr) {
          try {
            const parsedUser = JSON.parse(userStr);
            rawUserId = parsedUser?.id || parsedUser?._id || parsedUser?.userId;
          } catch (e) {}
        }
      }

      if (!rawUserId && token) {
        const jwtData = decodeJwtPayload(token);
        rawUserId = jwtData?.id || jwtData?._id || jwtData?.userId || jwtData?.sub;
      }

      if (rawUserId && typeof rawUserId === 'string' && rawUserId !== '[object Object]') {
        config.headers['X-User-ID'] = rawUserId;
      }
    } catch (err) {
      console.error('Failed to inject headers in mobile request interceptor:', err);
    }

    // Handle multipart form data Content-Type override for FormData payloads
    const isFormData =
      config.data &&
      (config.data instanceof FormData ||
        typeof (config.data as any)?._parts !== 'undefined' ||
        typeof (config.data as any)?.getParts === 'function');

    if (isFormData) {
      // In both Web and React Native, deleting Content-Type allows the runtime (browser/XHR)
      // to automatically set "multipart/form-data; boundary=..." with the correct boundary string.
      delete config.headers['Content-Type'];
    }

    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    config.headers['Pragma'] = 'no-cache';

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Extract envelope data and handle JWT refresh
apiClient.interceptors.response.use(
  (response) => {
    // If 304 Not Modified without body, safely return success envelope
    if (response.status === 304 && !response.data) {
      return { success: true, message: 'Not Modified', data: null, notModified: true };
    }
    // Return the backend's standard { success, message, data } envelope
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.message === 'Network Error') {
      console.warn('Network Error - check backend server connectivity');
    }

    const isAuthEndpoint = originalRequest?.url && (
      originalRequest.url.includes('/auth/login') ||
      originalRequest.url.includes('/auth/refresh-token') ||
      originalRequest.url.includes('/auth/register') ||
      originalRequest.url.includes('/auth/forgot-password') ||
      originalRequest.url.includes('/auth/reset-password') ||
      originalRequest.url.includes('/auth/google') ||
      originalRequest.url.includes('/auth/microsoft')
    );

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        let refreshToken = store?.getState?.()?.auth?.refreshToken || null;
        if (!refreshToken) {
          refreshToken = await storage.getItem('refreshToken');
        }

        if (!refreshToken) {
          // Stale session without refresh token: clear storage and auto-logout cleanly
          await storage.removeItem('token');
          await storage.removeItem('refreshToken');
          await storage.removeItem('user');

          if (store) {
            try {
              store.dispatch({ type: 'auth/logout' });
            } catch (dispatchErr) {}
          }
          return Promise.reject(new Error('Session expired. Please log in again.'));
        }

        const res = await axios.post(
          `${getApiBaseUrl()}/auth/refresh-token`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
        );

        if (res.status === 200 || res.status === 201) {
          const resData = res.data?.data || res.data;
          const newToken = resData?.token || res.data?.token;
          const newRefreshToken = resData?.refreshToken || res.data?.refreshToken || refreshToken;

          if (newToken) {
            await storage.setItem('token', newToken);
            if (newRefreshToken) {
              await storage.setItem('refreshToken', newRefreshToken);
            }

            if (store) {
              try {
                store.dispatch({
                  type: 'auth/updateTokenAndUser',
                  payload: { token: newToken, refreshToken: newRefreshToken },
                });
              } catch (dispatchErr) {
                console.error('Failed to update refreshed token in store:', dispatchErr);
              }
            }

            apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
            originalRequest.headers['Authorization'] = 'Bearer ' + newToken;

            processQueue(null, newToken);
            return apiClient(originalRequest);
          }
        }
        throw new Error('Session expired. Please log in again.');
      } catch (refreshError: any) {
        processQueue(refreshError, null);

        // Wipe local storage items so stale credentials don't persist
        try {
          await storage.removeItem('token');
          await storage.removeItem('refreshToken');
          await storage.removeItem('user');
        } catch (e) {}

        if (store) {
          try {
            store.dispatch({ type: 'auth/logout' });
          } catch (dispatchErr) {
            console.error('Failed to trigger mobile auto-logout on refresh failure', dispatchErr);
          }
        }
        return Promise.reject(new Error('Session expired. Please log in again.'));
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 400 && error.response?.data?.message === 'Workspace context is required.') {
      console.warn('[ApiClient] Workspace context missing on request. Preserving session.');
    }

    if (
      (error.response?.status === 403 || error.response?.status === 404) &&
      error.response?.data?.message &&
      (
        error.response.data.message.includes('do not have an active membership') ||
        error.response.data.message.includes('Organization not found') ||
        error.response.data.message.includes('Workspace not found')
      )
    ) {
      if (store) {
        try {
          const { switchWorkspaceContextThunk } = require('../features/auth/store/authSlice');
          store.dispatch(switchWorkspaceContextThunk({}));
        } catch (e) {}
      }
    }

    if (error.response?.data?.message) {
      error.message = error.response.data.message;
    } else if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
      error.message = 'Connection timed out. Please check backend server status.';
    } else if (error.message === 'Network Error' || (!error.response && error.request)) {
      error.message = 'Unable to connect to server. Please verify backend is running.';
    }

    return Promise.reject(error);
  }
);

export default apiClient;
