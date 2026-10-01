export const isMockRazorpayKey = (key) => {
  if (!key) return true
  const str = String(key).trim()
  if (
    !str ||
    str.includes('mock') ||
    str.includes('dummy') ||
    str.includes('TG9RGkcF') ||
    str === 'rzp_test_12345' ||
    str === 'rzp_test_mockkey' ||
    str === 'test_key' ||
    str.length < 15
  ) {
    return true
  }
  return false
}

const env =
  typeof import.meta !== 'undefined' && import.meta?.env
    ? import.meta.env
    : typeof process !== 'undefined'
      ? process.env
      : {}

export const config = {
  isDev: Boolean(env.DEV || env.MODE === 'development'),
  apiBaseUrl: env.VITE_API_BASE_URL || '/api',
  apiUrl: env.VITE_API_URL || 'http://localhost:5002/api',
  socketUrl:
    env.VITE_SOCKET_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5002'),
  googleClientId: env.VITE_GOOGLE_CLIENT_ID || '',
  microsoftClientId: env.VITE_MICROSOFT_CLIENT_ID || '',
  microsoftTenantId: env.VITE_MICROSOFT_TENANT_ID || 'common',
  razorpayKey: env.VITE_RAZORPAY_KEY || env.VITE_RAZORPAY_KEY_ID || 'rzp_test_mockkey',
  razorpayKeyId: env.VITE_RAZORPAY_KEY_ID || env.VITE_RAZORPAY_KEY || 'rzp_test_mockkey',
  publicUrl: env.VITE_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
  appName: env.VITE_APP_NAME || 'Nahom',
  androidPackage: env.VITE_ANDROID_PACKAGE || 'com.atominosconsulting.nahom',
  playStoreUrl:
    env.VITE_PLAY_STORE_URL ||
    'https://play.google.com/store/apps/details?id=com.atominosconsulting.nahom',
  customScheme: env.VITE_MOBILE_CUSTOM_SCHEME || 'managemygate',
}

export default config
