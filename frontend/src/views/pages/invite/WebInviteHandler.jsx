import React, { useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { CSpinner } from '@coreui/react'
import AppLoader from '../../../components/common/AppLoader'

/**
 * WebInviteHandler (Legacy Route)
 *
 * Backward-compatibility redirect handler that smoothly redirects
 * legacy /invite/web/:token requests to the canonical universal /invite/:token entry point.
 */
export const WebInviteHandler = () => {
  const { token: routeToken } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const token = routeToken || searchParams.get('token') || ''

  useEffect(() => {
    if (token) {
      const searchStr = searchParams.toString() ? `?${searchParams.toString()}` : ''
      navigate(`/invite/${token}${searchStr}`, { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [token, searchParams, navigate])

  return (
    <div className="min-vh-100 d-flex flex-row align-items-center justify-content-center bg-dark text-white">
      <div className="text-center">
        <AppLoader variant="block" />
        <h5>Redirecting to workspace invitation...</h5>
      </div>
    </div>
  )
}

export default WebInviteHandler
