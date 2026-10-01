import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useSelector } from 'react-redux'
import DefaultLayout from '../../layout/DefaultLayout.jsx'

/**
 * Super Admin Layout Wrapper
 * Protects routes under /admin/* by verifying the user has Platform access
 */
export const SuperAdminLayout = () => {
  const activeWorkspace = useSelector((state) => state.workspace)
  const isPlatform = activeWorkspace?.isPlatform

  // Protect Super Admin routes
  if (!isPlatform) {
    return <Navigate to="/403" replace />
  }

  return <DefaultLayout />
}

/**
 * Tenant Admin Layout Wrapper
 * Protects routes under /tenant/* by verifying the user is a Tenant Admin
 */
export const TenantAdminLayout = () => {
  const { user } = useSelector((state) => state.auth)
  const activeWorkspace = useSelector((state) => state.workspace)
  const isPlatform = activeWorkspace?.isPlatform

  // Prevent platform admins from entering tenant spaces directly,
  // and ensure the user actually has the Admin role for this tenant workspace.
  if (isPlatform || (user?.role !== 'Admin' && user?.role !== 'Tenant Admin')) {
    return <Navigate to="/403" replace />
  }

  return <DefaultLayout />
}
