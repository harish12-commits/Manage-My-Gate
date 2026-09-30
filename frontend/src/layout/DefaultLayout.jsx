/**
 * DefaultLayout Component
 *
 * Main application layout wrapper that composes the primary UI structure
 * for authenticated/protected routes.
 *
 * Layout structure:
 * - AppSidebar: Collapsible navigation sidebar
 * - AppHeader: Top navigation bar with user menu and theme switcher
 * - AppContent: Main content area with route rendering
 * - AppFooter: Footer with links and copyright
 *
 * This layout is used for all routes defined in routes.js, providing
 * a consistent structure across the application.
 *
 * @component
 * @example
 * // Used in App.js for protected routes
 * <Route path="*" element={<DefaultLayout />} />
 */

import React, { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { AppContent, AppSidebar, AppHeader } from '../components/index'
import { loadCurrentModules } from '../features/workspace/store/workspaceSlice.js'
import useNotificationSocket from '../features/notification/hooks/useNotificationSocket.js'
import useWalkInListener from '../features/visitorManagement/hooks/useWalkInListener.js'
import useRoleSocket from '../features/roleBuilder/hooks/useRoleSocket.js'
import useAuthSocket from '../features/auth/hooks/useAuthSocket.js'
import GlobalGateApprovalModal from '../features/visitorManagement/components/GlobalGateApprovalModal.jsx'

/**
 * DefaultLayout functional component
 *
 * Renders the main application layout with:
 * - Fixed sidebar navigation
 * - Sticky header
 * - Flexible content area
 * - Footer at bottom
 *
 * Uses flexbox for proper content stretching and footer positioning.
 *
 * @returns {React.ReactElement} Complete application layout
 */
const DefaultLayout = () => {
  const dispatch = useDispatch()
  const { token, user } = useSelector((state) => state.auth)
  const activeOrgId = useSelector((state) => state.workspace.activeOrganizationId)
  const availableWorkspaces = useSelector((state) => state.workspace.availableWorkspaces) || []
  const subscriptionStatus = useSelector((state) => state.workspace.subscriptionStatus)
  const accessGranted = useSelector((state) => state.workspace.accessGranted)
  const subscriptionReason = useSelector((state) => state.workspace.subscriptionReason)
  const organizationName = useSelector((state) => state.workspace.organizationName)

  const [isRenewing, setIsRenewing] = React.useState(false)

  // Initialize real-time notification socket listener
  useNotificationSocket(user?.id || user?._id)

  // Initialize real-time gate walk-in approval request listener
  useWalkInListener()

  // Initialize real-time role update listener
  useRoleSocket()

  // Initialize real-time auth and session listener
  useAuthSocket()

  useEffect(() => {
    if (token && activeOrgId) {
      dispatch(loadCurrentModules())
    }
  }, [token, activeOrgId, dispatch])

  const handleRenewNow = async () => {
    try {
      setIsRenewing(true)
      const apiClient = (await import('../services/apiClient.js')).default
      const { toast } = await import('react-hot-toast')
      toast.loading('Processing subscription renewal...', { id: 'renew-toast' })

      await apiClient.post('/platform-subscriptions/renew-organization', {
        organizationId: activeOrgId,
        billingFrequency: 'YEARLY',
      })

      toast.success('Subscription successfully renewed! Full access restored.', { id: 'renew-toast' })
      dispatch(loadCurrentModules())
    } catch (err) {
      const { toast } = await import('react-hot-toast')
      toast.error('Renewal failed: ' + (err.message || 'Error processing payment'), { id: 'renew-toast' })
    } finally {
      setIsRenewing(false)
    }
  }

  // Redirect to login if not authenticated
  if (!token && !user) {
    return <Navigate to="/login" replace />
  }

  // Redirect to workspace setup if the user has no active organizations/workspaces
  if (availableWorkspaces.length === 0) {
    return <Navigate to="/workspace-setup" replace />
  }

  const isPlatformUser = user?.role === 'Platform Super Admin' || user?.isPlatform === true

  return (
    <div>
      <AppSidebar />
      <div className="wrapper d-flex flex-column min-vh-100">
        <AppHeader />
        <div className="body flex-grow-1 position-relative">
          {!isPlatformUser && accessGranted === false && (
            <div 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(8px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}
            >
              <div 
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  maxWidth: '560px',
                  width: '100%',
                  padding: '36px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  textAlign: 'center'
                }}
              >
                <div 
                  style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    marginBottom: '20px'
                  }}
                >
                  ⚠️
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '10px' }}>
                  Subscription Plan Expired
                </h2>
                <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
                  {subscriptionReason || 'Your Free Trial or Subscription period has ended. Access to workspace modules is suspended until subscription renewal.'}
                </p>

                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '28px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b', fontSize: '13px' }}>Organization:</span>
                    <strong style={{ color: '#0f172a' }}>{organizationName || 'Your Organization'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b', fontSize: '13px' }}>Current Status:</span>
                    <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '13px' }}>{subscriptionStatus || 'EXPIRED'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontSize: '13px' }}>Renewal Amount:</span>
                    <strong style={{ color: '#16a34a' }}>₹1,86,300 INR / Year</strong>
                  </div>
                </div>

                <button
                  onClick={handleRenewNow}
                  disabled={isRenewing}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '16px',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                    transition: 'color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease, width 0.2s ease, height 0.2s ease, max-height 0.2s ease'
                  }}
                >
                  {isRenewing ? 'Processing Renewal...' : '💳 Renew Subscription Now & Restore Access'}
                </button>
              </div>
            </div>
          )}
          <AppContent />
        </div>
      </div>
      <GlobalGateApprovalModal />
    </div>
  )
}

export default DefaultLayout
