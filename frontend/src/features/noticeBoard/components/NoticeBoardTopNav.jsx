import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { CNav, CNavItem, CNavLink } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSpeedometer, cilList, cilSettings } from '@coreui/icons'
import { useAuth } from '../../auth/hooks/useAuth.js'

const navItems = [
  {
    name: 'Dashboard',
    to: '/admin/notices/dashboard',
    icon: cilSpeedometer,
    requiredPermission: 'notices:dashboard',
  },
  {
    name: 'Active Board',
    to: '/notices/board',
    icon: cilList,
    requiredPermission: 'notices:active_board',
  },
  {
    name: 'Manage Notices',
    to: '/admin/notices/manage',
    icon: cilSettings,
    requiredPermission: 'notices:manage_notices',
  },
  {
    name: 'Polls',
    to: '/notices/polls',
    icon: cilList,
    requiredPermission: 'notices:polls',
  },
]

const NoticeBoardTopNav = () => {
  const location = useLocation()
  const { checkPermission } = useAuth()

  const filteredNavItems = navItems.filter((item) => checkPermission(item.requiredPermission))

  return (
    <div className="notice-board-topnav-container">
      <CNav
        variant="underline"
        style={{
          borderBottom: 'none',
          gap: '16px',
          flexWrap: 'nowrap',
          minWidth: 'max-content',
          paddingBottom: '4px',
        }}
      >
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.to
          return (
            <CNavItem key={item.name}>
              <CNavLink
                to={item.to}
                as={NavLink}
                active={isActive}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  color: isActive ? 'var(--primary, #321fdb)' : '#768192',
                  fontWeight: isActive ? '600' : '500',
                  padding: '8px 16px',
                  borderBottom: isActive
                    ? '2px solid var(--primary, #321fdb)'
                    : '2px solid transparent',
                  transition:
                    'color 0.2s ease-in-out, background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out, opacity 0.2s ease-in-out, width 0.2s ease-in-out, height 0.2s ease-in-out, max-height 0.2s ease-in-out',
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

export default NoticeBoardTopNav
