import React from 'react'
import { useTranslation } from 'react-i18next'
import { CPagination, CPaginationItem } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilFolderOpen } from '@coreui/icons'
import AppLoader from '../../../components/common/AppLoader'

/**
 * User Directory Table — Notice Board `.table-wrapper` + `.ent-table` pattern.
 * Uses CIcon for action buttons instead of Font Awesome.
 */
export const UserDirectoryTable = ({
  users = [],
  loading = false,
  page = 1,
  totalPages = 0,
  total = 0,
  onPageChange,
  onViewUser,
}) => {
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
    })
  }

  return (
    <div>
      <div className="table-wrapper" style={{ maxHeight: 'calc(100vh - 460px)', overflowY: 'auto' }}>
        <table className="ent-table">
          <thead>
            <tr>
              <th>{t('superAdmin.orgDetails.tableUser', { defaultValue: 'User' })}</th>
              <th>{t('superAdmin.orgDetails.tableEmail', { defaultValue: 'Email' })}</th>
              <th>{t('superAdmin.orgDetails.tablePhone', { defaultValue: 'Phone' })}</th>
              <th>{t('superAdmin.orgDetails.tableRole', { defaultValue: 'Role' })}</th>
              <th>{t('superAdmin.orgDetails.tableVilla', { defaultValue: 'Villa / Unit' })}</th>
              <th>{t('superAdmin.orgDetails.tableStatus', { defaultValue: 'Status' })}</th>
              <th>{t('superAdmin.orgDetails.tableJoined', { defaultValue: 'Joined' })}</th>
              <th style={{ textAlign: 'right' }}>
                {t('superAdmin.orgDetails.tableActions', { defaultValue: 'Actions' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="loading-center" style={{ padding: '40px' }}>
                    <AppLoader variant="block" />
                    <span>{t('superAdmin.orgDetails.loadingUsers', { defaultValue: 'Loading organization users...' })}</span>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state" style={{ padding: '40px 24px' }}>
                    <div className="empty-icon">👥</div>
                    <div className="empty-title">
                      {t('superAdmin.orgDetails.noUsersFound', { defaultValue: 'No users found' })}
                    </div>
                    <div className="empty-desc">
                      {t('superAdmin.orgDetails.noUsersFoundDesc', { defaultValue: 'Try adjusting your search or filter criteria.' })}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const displayName = u.name || u.username || 'User'
                const displayEmail = u.email || 'N/A'
                const displayPhone = u.phone || 'N/A'
                const roles = u.roles && u.roles.length > 0 ? u.roles : []
                const villaStr =
                  u.villa && u.villa.unitNumber
                    ? `${u.villa.blockOrBuilding ? `${u.villa.blockOrBuilding} - ` : ''}${u.villa.unitNumber}`
                    : 'N/A'

                return (
                  <tr key={u.membershipId || u._id}>
                    {/* User cell with avatar */}
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {u.avatar ? (
                            <img src={u.avatar} alt={displayName} />
                          ) : (
                            displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{displayName}</div>
                          {u.username && u.username !== displayName && (
                            <div className="user-username">@{u.username}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>{displayEmail}</td>

                    <td>{displayPhone}</td>

                    {/* Roles */}
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {roles.length === 0 ? (
                          <span className="count-badge">
                            {t('superAdmin.orgDetails.defaultMemberRole', { defaultValue: 'Member' })}
                          </span>
                        ) : (
                          roles.map((r) => (
                            <span key={r._id || r.name} className="count-badge" style={{ background: 'var(--info-bg)', color: 'var(--info)', borderColor: 'transparent' }}>
                              {r.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Villa */}
                    <td>
                      <span className="count-badge">{villaStr}</span>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`status-pill ${getStatusClass(u.status)}`}>
                        {u.status || 'Active'}
                      </span>
                    </td>

                    {/* Joined Date */}
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {formatDate(u.createdAt)}
                    </td>

                    {/* Action */}
                    <td>
                      <div className="action-btn-group">
                        <button
                          className="action-icon-btn btn-view"
                          title={t('superAdmin.orgDetails.viewUserBtn', { defaultValue: 'View Details' })}
                          onClick={() => onViewUser(u.userId || u.userId?._id)}
                        >
                          <CIcon icon={cilFolderOpen} size="sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination-bar">
          <div className="pagination-info">
            {t('superAdmin.orgDetails.showingUsersCount', {
              defaultValue: `Showing ${users.length} of ${total} users`,
              count: total,
            })}
          </div>
          <CPagination aria-label="User directory navigation">
            <CPaginationItem
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              style={{ cursor: page === 1 ? 'default' : 'pointer' }}
            >
              &laquo;
            </CPaginationItem>
            {[...Array(totalPages)].map((_, i) => (
              <CPaginationItem
                key={i + 1}
                active={page === i + 1}
                onClick={() => onPageChange(i + 1)}
                style={{ cursor: 'pointer' }}
              >
                {i + 1}
              </CPaginationItem>
            ))}
            <CPaginationItem
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
              style={{ cursor: page === totalPages ? 'default' : 'pointer' }}
            >
              &raquo;
            </CPaginationItem>
          </CPagination>
        </div>
      )}
    </div>
  )
}

export default UserDirectoryTable
