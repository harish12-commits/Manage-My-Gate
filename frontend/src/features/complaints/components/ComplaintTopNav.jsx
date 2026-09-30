import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { CNav, CNavItem, CNavLink } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilPencil,
  cilSearch,
  cilList,
  cilChartPie,
  cilPeople,
  cilSettings,
  cilPlus,
  cilBriefcase,
  cilWarning,
} from '@coreui/icons'
import { useAuth } from '../../auth/hooks/useAuth'

const navItems = [
  {
    name: 'Dashboard',
    to: '/admin/complaints/dashboard',
    icon: cilSpeedometer,
    requiredPermission: 'complaints:dashboard',
  },
  {
    name: 'Raise Ticket',
    to: '/admin/complaints/create',
    icon: cilPlus,
    requiredPermission: 'complaints:raise_ticket',
  },
  {
    name: 'Track',
    to: '/admin/complaints/my-tickets',
    icon: cilSearch,
    requiredPermission: 'complaints:track_requests',
  },
  {
    name: 'Management',
    to: '/admin/complaints/manage',
    icon: cilList,
    requiredPermission: 'complaints:complaint_management',
  },
  {
    name: 'Staff',
    to: '/admin/complaints/staff',
    icon: cilPeople,
    requiredPermission: 'complaints:staff',
  },
  {
    name: 'Assignee',
    to: '/admin/complaints/assignee',
    icon: cilBriefcase,
    requiredPermission: 'complaints:assignee',
  },
  {
    name: 'Issue Reports',
    to: '/admin/complaints/issue-reports',
    icon: cilWarning,
    requiredPermission: 'complaints:complaint_management',
  },
]

const ComplaintTopNav = () => {
  const location = useLocation()
  const { checkPermission } = useAuth()

  const filteredNavItems = navItems.filter((item) => checkPermission(item.requiredPermission))

  return (
    <div
      style={{
        marginBottom: '24px',
        backgroundColor: 'var(--surface)',
        borderRadius: '8px',
        padding: '12px 24px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <CNav
        variant="underline"
        style={{
          borderBottom: 'none',
          gap: '0px',
          flexWrap: 'nowrap',
          width: 'max-content',
          minWidth: 'max-content',
          paddingBottom: '4px',
        }}
      >
        {filteredNavItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to)
          return (
            <CNavItem key={item.name} style={{ flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }}>
              <CNavLink
                to={item.to}
                as={NavLink}
                active={isActive}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: isActive ? '700' : '600',
                  padding: '6px 10px',
                  flexGrow: 0,
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  transition: 'color 0.2s ease-in-out, background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out, opacity 0.2s ease-in-out, width 0.2s ease-in-out, height 0.2s ease-in-out, max-height 0.2s ease-in-out',
                }}
              >
                <CIcon icon={item.icon} size="lg" style={{ marginBottom: '4px' }} />
                {item.name}
              </CNavLink>
            </CNavItem>
          )
        })}
      </CNav>
    </div>
  )
}

export default ComplaintTopNav
