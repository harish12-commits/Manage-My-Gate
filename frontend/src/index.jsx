import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import 'core-js'

import config from './config/config.js'
import App from './App'
import store from './store/store'
import { injectStore } from './services/apiClient'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'

injectStore(store)
import { setActiveWorkspace } from './features/workspace/store/workspaceSlice.js'
import './i18n.js'

// Google and Microsoft SSO Providers Setup
import { GoogleOAuthProvider } from '@react-oauth/google'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'

const msalConfig = {
  auth: {
    clientId: config.microsoftClientId,
    authority: `https://login.microsoftonline.com/${config.microsoftTenantId}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: true,
  },
}

// MSAL instance initialization
let msalInstance = null;
try {
  if (config.microsoftClientId) {
    msalInstance = new PublicClientApplication(msalConfig);
  } else {
    console.warn('MSAL configuration missing client ID. SSO will be disabled.');
  }
} catch (error) {
  console.error('Failed to instantiate MSAL PublicClientApplication:', error);
}

// Retrieve the saved user object from localStorage and hydrate workspace context
try {
  const savedUserStr = localStorage.getItem('user')
  if (savedUserStr) {
    const savedUser = JSON.parse(savedUserStr)
    if (savedUser && savedUser.orgId) {
      const cachedWorkspacesStr = localStorage.getItem('availableWorkspaces')
      const cachedWorkspaces = cachedWorkspacesStr ? JSON.parse(cachedWorkspacesStr) : []
      const matchedOrg = cachedWorkspaces.find((w) => w.orgId === savedUser.orgId)
      store.dispatch(
        setActiveWorkspace({
          activeOrganizationId: savedUser.orgId,
          activeRole: savedUser.role,
          allowedFeatures: savedUser.permissions || [],
          isPlatform: savedUser.isPlatform || false,
          organizationName: matchedOrg ? matchedOrg.name : null,
          availableWorkspaces: cachedWorkspaces,
        }),
      )
    }
  }
} catch (error) {
  console.error('Failed to bootstrap workspace hydration from localStorage:', error)
}

const googleClientId = config.googleClientId

const renderApp = () => (
  <ErrorBoundary>
    <Provider store={store}>
      <GoogleOAuthProvider clientId={googleClientId || 'dummy-client-id'}>
        {msalInstance ? (
          <MsalProvider instance={msalInstance}>
            <App />
          </MsalProvider>
        ) : (
          <App />
        )}
      </GoogleOAuthProvider>
    </Provider>
  </ErrorBoundary>
)

// Fade out the boot splash from index.html once React has painted its first frame.
const hideBootLoader = () => {
  const el = document.getElementById('boot-loader')
  if (!el) return
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      el.classList.add('bl-out')
      setTimeout(() => el.remove(), 500)
    }),
  )
}

// Initialize MSAL, process redirects, and then render the app
if (msalInstance) {
  msalInstance
    .initialize()
    .then(() => {
      // Must handle redirect promise before HashRouter mounts, otherwise HashRouter overwrites the MSAL #code= fragment!
      return msalInstance.handleRedirectPromise()
    })
    .then(() => {
      createRoot(document.getElementById('root')).render(renderApp())
      hideBootLoader()
    })
    .catch((err) => {
      console.error('MSAL Initialization failed:', err)
      // Render anyway so the rest of the app works, even if Microsoft SSO fails
      createRoot(document.getElementById('root')).render(renderApp())
      hideBootLoader()
    })
} else {
  createRoot(document.getElementById('root')).render(renderApp())
  hideBootLoader()
}
