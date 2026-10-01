import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  COffcanvas,
  COffcanvasHeader,
  COffcanvasTitle,
  COffcanvasBody,
  CCloseButton,
} from '@coreui/react'
import AppLoader from '../../../components/common/AppLoader'

/**
 * User Detail Drawer — Offcanvas with aligned drawer styling.
 */
export const UserDetailDrawer = ({ visible, onClose, user, loading, organizationName }) => {
  const { t } = useTranslation()

  const getStatusClass = (status) => {
    switch (status) {
      case 'Active':
        return 'status-active'
      case 'Pending':
      case 'Pending Verification':
        return 'status-pending'
      case 'Suspended':
      case 'Blocked':
        return 'status-blocked'
      default:
        return 'status-inactive'
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <COffcanvas placement="end" visible={visible} onHide={onClose} className="org-user-drawer">
      <COffcanvasHeader>
        <COffcanvasTitle>
          {t('superAdmin.orgDetails.userProfileTitle', { defaultValue: 'User Profile Details' })}
        </COffcanvasTitle>
        <CCloseButton className="text-reset" onClick={onClose} />
      </COffcanvasHeader>
      <COffcanvasBody>
        {loading ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '60px',
              gap: '12px',
              color: '#768192',
            }}
          >
            <AppLoader variant="block" />
            <span>
              {t('superAdmin.orgDetails.loadingUserDetail', {
                defaultValue: 'Loading user details...',
              })}
            </span>
          </div>
        ) : !user ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#768192' }}>
            {t('superAdmin.orgDetails.noUserSelected', {
              defaultValue: 'No user details available.',
            })}
          </div>
        ) : (
          <div>
            {/* Profile Header */}
            <div className="drawer-profile-header">
              <div className="drawer-avatar">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name || 'User'} />
                ) : user.name ? (
                  user.name.charAt(0).toUpperCase()
                ) : (
                  'U'
                )}
              </div>
              <div className="drawer-name">{user.name || 'User Profile'}</div>
              <div className="drawer-email">{user.email}</div>
              <span
                className={`status-pill ${getStatusClass(user.status)}`}
                style={{ display: 'inline-flex' }}
              >
                {user.status || 'Active'}
              </span>
            </div>

            {/* Detail Fields */}
            <div className="drawer-fields">
              <div className="drawer-field">
                <div className="drawer-field-label">
                  {t('superAdmin.orgDetails.phone', { defaultValue: 'Phone Number' })}
                </div>
                <div className="drawer-field-value">{user.phone || 'N/A'}</div>
              </div>

              <div className="drawer-field">
                <div className="drawer-field-label">
                  {t('superAdmin.orgDetails.assignedRoles', { defaultValue: 'Assigned Roles' })}
                </div>
                <div className="drawer-roles-list">
                  {user.roles && user.roles.length > 0 ? (
                    user.roles.map((r) => (
                      <span key={r.id || r.name} className="drawer-role-pill">
                        {r.name}
                      </span>
                    ))
                  ) : (
                    <span
                      className="drawer-role-pill"
                      style={{ background: '#f5f7fb', color: '#768192' }}
                    >
                      Member
                    </span>
                  )}
                </div>
              </div>

              <div className="drawer-field">
                <div className="drawer-field-label">
                  {t('superAdmin.orgDetails.community', {
                    defaultValue: 'Community / Organization',
                  })}
                </div>
                <div className="drawer-field-value">
                  {organizationName || 'Current Organization'}
                </div>
              </div>

              <div className="drawer-field">
                <div className="drawer-field-label">
                  {t('superAdmin.orgDetails.villaUnit', {
                    defaultValue: 'Villa / Unit Assignment',
                  })}
                </div>
                <div className="drawer-field-value">
                  {user.villa
                    ? `${user.villa.block ? `${user.villa.block} - ` : ''}${user.villa.unitNumber} (${user.villa.status || 'Assigned'})`
                    : 'Unassigned'}
                </div>
              </div>

              <div className="drawer-field">
                <div className="drawer-field-label">
                  {t('superAdmin.orgDetails.joinedDate', {
                    defaultValue: 'Registration / Join Date',
                  })}
                </div>
                <div className="drawer-field-value">{formatDate(user.joinedDate)}</div>
              </div>

              <div className="drawer-field">
                <div className="drawer-field-label">
                  {t('superAdmin.orgDetails.lastLogin', { defaultValue: 'Last Activity / Login' })}
                </div>
                <div className="drawer-field-value">{formatDate(user.lastLogin)}</div>
              </div>
            </div>
          </div>
        )}
      </COffcanvasBody>
    </COffcanvas>
  )
}

export default UserDetailDrawer
