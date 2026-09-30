import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { CNav, CNavItem, CNavLink } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilCalendar,
  cilList,
  cilBuilding,
  cilLayers,
  cilWallet,
  cilSearch,
} from '@coreui/icons'
import { useAuth } from '../../auth/hooks/useAuth'

const navItems = [
  {
    name: 'Dashboard',
    to: '/admin/amenities/dashboard',
    icon: cilSpeedometer,
    requiredPermission: 'amenities:dashboard',
  },
  {
    name: 'Admin Calendar',
    to: '/admin/amenities/calendar',
    icon: cilCalendar,
    requiredPermission: 'amenities:admin_calander',
  },
  {
    name: 'Ledgers',
    to: '/admin/amenities/ledgers',
    icon: cilList,
    requiredPermission: 'amenities:ledgers',
  },
  {
    name: 'Amenities',
    to: '/admin/amenities/master',
    icon: cilLayers,
    requiredPermission: 'amenities:amenities',
  },
  {
    name: 'Maintenance',
    to: '/admin/amenities/maintenance',
    icon: cilBuilding,
    requiredPermission: 'amenities:maintenance',
  },

  {
    name: 'Discover',
    to: '/resident/amenities/discover',
    icon: cilSearch,
    requiredPermission: 'amenities:discover',
  },
  {
    name: 'My Bookings',
    to: '/resident/amenities/calendar',
    icon: cilCalendar,
    requiredPermission: 'amenities:my_booking',
  },
  {
    name: 'Wallet',
    to: '/resident/amenities/wallet',
    icon: cilWallet,
    requiredPermission: 'amenities:wallet',
  },
  {
    name: 'Scanner',
    to: '/admin/amenities/scanner',
    icon: cilSpeedometer,
    requiredPermission: 'amenities:scanner',
  },
  {
    name: 'Security Logs',
    to: '/admin/amenities/security-logs',
    icon: cilList,
    requiredPermission: 'amenities:security_logs',
  },
]

const AmenitiesTopNav = () => {
  const location = useLocation()
  const { checkPermission } = useAuth()
  const allowedFeatures = useSelector((state) => state.workspace?.allowedFeatures || [])
  const isAmenitiesAllowed = allowedFeatures.length === 0 || allowedFeatures.some(f => ['amenities', 'booking', 'amenity', 'amenitiesBooking'].includes(f))

  if (!isAmenitiesAllowed) return null

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
          gap: '16px',
          flexWrap: 'nowrap',
          minWidth: 'max-content',
          paddingBottom: '4px',
        }}
      >
        {filteredNavItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to)
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
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: isActive ? '700' : '600',
                  padding: '8px 16px',
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

export default AmenitiesTopNav
