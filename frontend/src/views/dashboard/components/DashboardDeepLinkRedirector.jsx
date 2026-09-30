import React, { useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { CSpinner } from '@coreui/react'
import AppLoader from '../../../components/common/AppLoader'

export const DashboardDeepLinkRedirector = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!id) {
      navigate('/dashboard', { replace: true })
      return
    }

    const path = location.pathname

    if (path.includes('community-notices')) {
      // Redirect to the Active Board and pass the ID to open the modal
      navigate(`/notices/board?openNoticeId=${id}`, { replace: true })
    } else if (path.includes('maintenance')) {
      // Redirect to the Complaint Dashboard (which houses the Maintenance Board)
      navigate(`/complaints?openMaintenanceId=${id}`, { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }, [id, location, navigate])

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
      <div className="text-center">
        <AppLoader variant="block" />
        <div className="mt-3 text-muted">Redirecting to announcement...</div>
      </div>
    </div>
  )
}

export default DashboardDeepLinkRedirector
