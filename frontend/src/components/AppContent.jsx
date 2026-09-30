/**
 * AppContent Component - Forced HMR refresh
 *
 * Main content area that renders routes defined in routes.js.
 * Handles lazy loading with Suspense and provides a loading spinner
 * while components are being loaded.
 *
 * Features:
 * - Dynamic route rendering from routes configuration
 * - Suspense boundary for lazy-loaded components
 * - Automatic redirect from root to dashboard
 * - Loading spinner fallback during component load
 *
 * @component
 * @example
 * return (
 *   <AppContent />
 * )
 */

import React, { Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { CContainer } from '@coreui/react'
import { useAuth } from '../features/auth/hooks/useAuth'
import AuthGuard from '../features/auth/components/AuthGuard'
import Page403 from '../views/pages/page403/Page403'

// routes config
import { routes } from '../routes'
import AppLoader from './common/AppLoader'

/**
 * AppContent functional component
 *
 * Renders all application routes within a container with:
 * - Suspense for lazy-loaded route components
 * - Spinner shown during component loading
 * - Default redirect to dashboard
 *
 * Memoized to prevent unnecessary re-renders when parent updates.
 *
 * @returns {React.ReactElement} Content container with routed views
 */
const AppContent = () => {
  const location = useLocation()
  const activeWorkspace = useSelector((state) => state.workspace)
  const isPlatform = activeWorkspace?.isPlatform || false
  const { checkPermission } = useAuth()

  return (
    <CContainer className="px-4" lg>
      <Suspense fallback={<AppLoader variant="page" />}>
        <Routes>
          {routes.map((route, idx) => {
            // Exclude /workspace-setup route from rendering inside DefaultLayout
            if (route.path === '/workspace-setup') return null

            // Route-level authorization checks
            if (route.requirePlatform && !isPlatform) {
              return <Route key={idx} path={route.path} element={<Page403 />} />
            }

            if (
              route.requiredPermission &&
              !isPlatform &&
              !checkPermission(route.requiredPermission)
            ) {
              return <Route key={idx} path={route.path} element={<Page403 />} />
            }

            const isProtected =
              [
                '/users',
                '/roles',
                '/role-builder',
                '/villas',
                '/integrations',
              ].includes(route.path) || route.path.startsWith('/super-admin/')
            const routeElement = isProtected ? (
              <AuthGuard>
                <route.element />
              </AuthGuard>
            ) : (
              <route.element />
            )

            return (
              route.element && (
                <Route
                  key={idx}
                  path={route.path}
                  exact={route.exact}
                  name={route.name}
                  element={routeElement}
                />
              )
            )
          })}
          <Route path="/" element={<Navigate to="dashboard" replace />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </CContainer>
  )
}

export default React.memo(AppContent)
