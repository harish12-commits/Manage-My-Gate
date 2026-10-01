import React from 'react'
import { useTranslation } from 'react-i18next'
import CIcon from '@coreui/icons-react'
import { cilBuilding, cilUser, cilCheckCircle, cilTag } from '@coreui/icons'

/**
 * Organization Overview KPI Cards — Notice Board `.dashboard-grid` + `.kpi-card` pattern.
 * Uses CIcon from @coreui/icons-react instead of Font Awesome.
 */
export const OrganizationOverviewCards = ({ summary }) => {
  const { t } = useTranslation()

  if (!summary) return null

  const {
    totalVillas = 0,
    occupiedVillas = 0,
    vacantVillas = 0,
    totalUsers = 0,
    activeUsers = 0,
    inactiveUsers = 0,
    pendingUsers = 0,
    roleBreakdown = {},
  } = summary

  return (
    <div className="dashboard-grid">
      {/* Total Villas */}
      <div className="kpi-card">
        <div className="kpi-title">
          <CIcon
            icon={cilBuilding}
            size="sm"
            style={{ color: 'var(--primary)', marginRight: '8px' }}
          />
          {t('superAdmin.orgDetails.totalVillas', { defaultValue: 'Total Villas' })}
        </div>
        <div className="kpi-value">{totalVillas}</div>
        <div className="kpi-trend text-primary">
          {occupiedVillas} {t('superAdmin.orgDetails.occupied', { defaultValue: 'Occupied' })}
          {' • '}
          {vacantVillas} {t('superAdmin.orgDetails.vacant', { defaultValue: 'Vacant' })}
        </div>
      </div>

      {/* Total Users */}
      <div className="kpi-card">
        <div className="kpi-title">
          <CIcon icon={cilUser} size="sm" style={{ color: 'var(--info)', marginRight: '8px' }} />
          {t('superAdmin.orgDetails.totalUsers', { defaultValue: 'Total Users' })}
        </div>
        <div className="kpi-value">{totalUsers}</div>
        <div className="kpi-trend text-info">
          {t('superAdmin.orgDetails.memberships', { defaultValue: 'Registered Members' })}
        </div>
      </div>

      {/* Active Users */}
      <div className="kpi-card">
        <div className="kpi-title">
          <CIcon
            icon={cilCheckCircle}
            size="sm"
            style={{ color: 'var(--success)', marginRight: '8px' }}
          />
          {t('superAdmin.orgDetails.activeUsers', { defaultValue: 'Active Users' })}
        </div>
        <div className="kpi-value">{activeUsers}</div>
        <div className="kpi-trend text-success">
          {inactiveUsers} {t('superAdmin.orgDetails.inactive', { defaultValue: 'Inactive' })}
          {' • '}
          {pendingUsers} {t('superAdmin.orgDetails.pending', { defaultValue: 'Pending' })}
        </div>
      </div>

      {/* Role Breakdown */}
      <div className="kpi-card">
        <div className="kpi-title">
          <CIcon icon={cilTag} size="sm" style={{ color: 'var(--warning)', marginRight: '8px' }} />
          {t('superAdmin.orgDetails.rolesBreakdown', { defaultValue: 'Role Breakdown' })}
        </div>
        <div className="role-pill-list">
          {Object.keys(roleBreakdown).length === 0 ? (
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('superAdmin.orgDetails.noRoles', { defaultValue: 'No roles assigned' })}
            </span>
          ) : (
            Object.entries(roleBreakdown).map(([roleName, count]) => (
              <span key={roleName} className="role-pill">
                {roleName}: <span className="role-count">{count}</span>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default OrganizationOverviewCards
