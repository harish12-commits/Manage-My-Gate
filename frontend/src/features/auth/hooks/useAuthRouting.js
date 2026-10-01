import { useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * useAuthRouting Custom Hook
 * Handles smart routing redirects after authentication based on URL query params
 * (e.g., intent=create, token=XYZ) and workspace configuration state.
 *
 * Adheres to the "Thin View" architectural pattern.
 */
export const useAuthRouting = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated)
  const token = useSelector((state) => state.auth.token)
  const user = useSelector((state) => state.auth.user)
  const availableWorkspaces = useSelector((state) => state.workspace?.availableWorkspaces) || []
  const authWorkspaces = user?.availableWorkspaces || []
  const loading = useSelector((state) => state.auth.loading)
  const error = useSelector((state) => state.auth.error)

  /**
   * Evaluates authentication state and URL params to perform the appropriate redirect.
   */
  const handlePostAuthRedirect = (options = {}) => {
    if (!isAuthenticated || !token) return

    // Parse URL query parameters from multiple sources (supports HashRouter & normal search)
    const searchParams = new URLSearchParams(location.search)
    const hrefSearch = window.location.href.includes('?')
      ? window.location.href.substring(window.location.href.indexOf('?'))
      : ''
    const hrefParams = new URLSearchParams(hrefSearch.replace(/#.*/, ''))

    const storedIntent = sessionStorage.getItem('auth_intent')
    const intent =
      searchParams.get('intent') ||
      hrefParams.get('intent') ||
      location.state?.intent ||
      storedIntent

    const inviteToken =
      searchParams.get('invite_token') ||
      hrefParams.get('invite_token') ||
      searchParams.get('token') ||
      hrefParams.get('token') ||
      location.state?.inviteToken ||
      location.state?.token

    // Clear stored temporary auth intent once evaluated
    sessionStorage.removeItem('auth_intent')

    // 1. Invite Sign-up/Login Flow:
    // If we have an invite token and we aren't explicitly skipping it, route to accept-invite
    if (inviteToken && !options.skipInviteToken) {
      navigate(`/accept-invite/${inviteToken}`)
      return
    }

    // 2. Organization Creation Intent Flow:
    // If the user arrived with explicit create intent (e.g. intent=create or intent=create-org),
    // navigate to workspace setup so the user can create a new organization under their account.
    if (
      intent === 'create' ||
      intent === 'create-org' ||
      location.pathname === '/login-createOrg'
    ) {
      navigate('/workspace-setup?intent=create')
      return
    }

    // Check if the user already has an active organization
    const hasOrg = !!(
      user &&
      (user.orgId ||
        user.activeOrgId ||
        user.organizationId ||
        authWorkspaces.length > 0 ||
        availableWorkspaces.length > 0)
    )

    // 3. Existing Organization Users (Without Create Intent):
    if (hasOrg) {
      navigate('/dashboard')
      return
    }

    // 4. Fallback for users without active organization:
    navigate('/workspace-setup')
  }

  return {
    isAuthenticated,
    token,
    availableWorkspaces,
    loading,
    error,
    handlePostAuthRedirect,
  }
}

export default useAuthRouting
