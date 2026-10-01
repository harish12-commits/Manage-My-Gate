import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'react-hot-toast'
import config from '../config/config.js'

/**
 * Global API Client
 *
 * Configured Axios instance with request and response interceptors.
 * Handles automatic inclusion of Authorization & X-Request-ID headers,
 * and intercepts 401 Unauthorized responses to perform automatic logout.
 */
const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for secure cookies (Refresh Token)
})

let isRefreshing = false
let failedQueue = []
let store

export const injectStore = (_store) => {
  store = _store
}

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Request Interceptor: Inject Token and Correlation ID
apiClient.interceptors.request.use(
  async (config) => {
    // Sanitize config.url to avoid duplicate '/api/api/' prefixes
    if (config.url && config.url.startsWith('/api/')) {
      config.url = config.url.substring(4)
    }

    // Generate and inject a unique Request Correlation ID
    config.headers['X-Request-ID'] = uuidv4()

    // Use injected store to get state
    try {
      if (store) {
        const state = store.getState()

        const token = state.auth?.token || localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        const rawOrgId =
          state.auth?.user?.orgId ||
          state.auth?.user?.organizationId ||
          state.workspace?.activeOrganizationId ||
          state.auth?.user?.org?._id ||
          state.auth?.user?.org

        const activeOrgId =
          typeof rawOrgId === 'object' && rawOrgId !== null
            ? rawOrgId._id || rawOrgId.id || String(rawOrgId)
            : rawOrgId

        if (activeOrgId && activeOrgId !== '[object Object]') {
          config.headers['x-organization-id'] = activeOrgId
        }
      }
    } catch (err) {
      console.error('Failed to inject headers in request interceptor:', err)
    }

    return config
  },
  (error) => Promise.reject(error),
)

// Response Interceptor: Catch global errors
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config
    // Check if error is due to CORS (or network error where response is undefined)
    if (
      error.message === 'Network Error' ||
      (error.response &&
        error.response.data &&
        error.response.data.message === 'Not allowed by CORS')
    ) {
      toast.error('Not allowed by CORS')
    }

    // Handle 502 Bad Gateway
    if (error.response && error.response.status === 502) {
      toast.error('Request failed with status code 502')
    }

    // Handle 401 Unauthorized globally with Silent Refresh
    // Auth endpoints (login, register, refresh-token, etc.) must not trigger a silent refresh retry
    const isAuthEndpoint =
      originalRequest &&
      originalRequest.url &&
      (originalRequest.url.includes('/auth/login') ||
        originalRequest.url.includes('/auth/refresh-token') ||
        originalRequest.url.includes('/auth/register') ||
        originalRequest.url.includes('/auth/forgot-password') ||
        originalRequest.url.includes('/auth/reset-password') ||
        originalRequest.url.includes('/auth/verify-phone') ||
        originalRequest.url.includes('/auth/verify-email-otp') ||
        originalRequest.url.includes('/auth/accept-invite') ||
        originalRequest.url.includes('/auth/accept_invite'))

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token
            return apiClient(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const res = await axios.post(
          `${apiClient.defaults.baseURL}/auth/refresh-token`,
          {},
          { withCredentials: true },
        )

        if (res.status === 200 || res.status === 201) {
          const newToken = res.data.token

          if (store) {
            store.dispatch({ type: 'auth/updateTokenAndUser', payload: { token: newToken } })
          }

          apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + newToken
          originalRequest.headers['Authorization'] = 'Bearer ' + newToken

          processQueue(null, newToken)
          return apiClient(originalRequest)
        }
      } catch (refreshError) {
        processQueue(refreshError, null)

        if (store) {
          store.dispatch({ type: 'auth/logout' })
        }
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // Extract backend error message if available to prevent raw Axios error strings
    if (
      error.response?.status === 400 &&
      error.response?.data?.message === 'Workspace context is required.'
    ) {
      console.warn('Workspace context lost. Forcing auto-logout to recover corrupted local state.')
      if (store) {
        try {
          store.dispatch({ type: 'auth/logout' })
        } catch (dispatchErr) {
          console.error('Failed to trigger auto-logout on 400 Bad Request', dispatchErr)
        }
      }
      window.location.href = '/login'
    }

    if (error.response && error.response.data && error.response.data.message) {
      error.message = error.response.data.message
    }

    // Phase 7.1: Intercept 403 SUBSCRIPTION_EXPIRED globally
    if (
      error.response &&
      error.response.status === 403 &&
      error.message === 'SUBSCRIPTION_EXPIRED'
    ) {
      if (store) {
        store.dispatch({ type: 'auth/setLockedOut', payload: true })
      }
      // Force redirect strictly to renewal page
      window.location.href = '/tenant/subscription-renewal'
      return Promise.reject(error)
    }

    return Promise.reject(error)
  },
)

export default apiClient
