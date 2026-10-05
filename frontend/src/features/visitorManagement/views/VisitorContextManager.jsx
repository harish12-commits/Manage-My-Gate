import React from 'react'
import { useSelector } from 'react-redux'
import { CCallout } from '@coreui/react'
import ResidentVisitorManagementView from './ResidentVisitorManagementView'
import GuardVisitormanagementViews from './GuardVisitormanagementViews'
import AdminVisitorManagementViews from './AdminVisitorManagementViews'

export const VisitorContextManager = () => {
  const user = useSelector((state) => state.auth.user)
  const context = user?.visitorContext || 'None'

  switch (context) {
    case 'Resident':
      return <ResidentVisitorManagementView />
    case 'Guard':
      return <GuardVisitormanagementViews />
    case 'Admin':
      return <AdminVisitorManagementViews />
    default:
      return (
        <div className="container py-5 visitor-os-theme">
          <CCallout color="warning" className="bg-body shadow-sm border-start-4 p-4">
            <h5 className="fw-bold text-warning mb-2">Access Restrained</h5>
            <p className="mb-0 text-muted">
              Your active community role is not configured with any Visitor Management context.
              Please contact your administrator to map this role to a specific Console context view.
            </p>
          </CCallout>
        </div>
      )
  }
}

export default VisitorContextManager
