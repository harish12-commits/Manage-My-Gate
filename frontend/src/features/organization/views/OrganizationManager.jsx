import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CPagination, CPaginationItem } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilFolderOpen, cilBan, cilCheckCircle } from '@coreui/icons'
import useOrganizationManager from '../hooks/useOrganizationManager.js'
import '../styles/_organization.scss'
import AppLoader from '../../../components/common/AppLoader'

/**
 * Super Admin View — Community Manager list (Notice Board aligned design).
 */
export const OrganizationManager = () => {
  const { t } = useTranslation()
  const { organizations, totalPages, page, loading, error, fetchOrgs, toggleStatus, viewDetails } =
    useOrganizationManager()

  useEffect(() => {
    const controller = new AbortController()
    fetchOrgs(1, 10, { signal: controller.signal })
    return () => {
      controller.abort()
    }
  }, [])

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchOrgs(newPage, 10)
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'Active':
        return 'status-active'
      case 'Pending':
        return 'status-pending'
      case 'Rejected':
        return 'status-rejected'
      default:
        return 'status-inactive'
    }
  }

  return (
    <div className="org-manager-theme pt-3">
      <div className="view-container">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h2 className="page-title">
              {t('superAdmin.orgManager.title', { defaultValue: 'Community Manager' })}
            </h2>
            <p className="page-subtitle">
              {t('superAdmin.orgManager.subtitle', {
                defaultValue:
                  'Manage all system organizations, view status, and block/unblock access.',
              })}
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {error && <div className="alert alert-danger mb-4">{error}</div>}

        {/* Loading */}
        {loading && organizations.length === 0 ? (
          <div className="loading-center">
            <AppLoader variant="block" />
            <span>
              {t('superAdmin.orgManager.loading', { defaultValue: 'Loading organizations...' })}
            </span>
          </div>
        ) : organizations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <div className="empty-title">
              {t('superAdmin.orgManager.noData', { defaultValue: 'No organizations found.' })}
            </div>
            <div className="empty-desc">
              {t('superAdmin.orgManager.noDataDesc', {
                defaultValue: 'Organizations will appear here once created.',
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Enterprise Table */}
            <div className="table-wrapper">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>
                      {t('superAdmin.orgManager.tableName', { defaultValue: 'Organization' })}
                    </th>
                    <th>{t('superAdmin.orgManager.tableVillas', { defaultValue: 'Villas' })}</th>
                    <th>{t('superAdmin.orgManager.tableUsers', { defaultValue: 'Users' })}</th>
                    <th>{t('superAdmin.orgManager.tableStatus', { defaultValue: 'Status' })}</th>
                    <th style={{ textAlign: 'right' }}>
                      {t('superAdmin.orgManager.tableActions', { defaultValue: 'Actions' })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org) => (
                    <tr key={org._id}>
                      <td>
                        <span
                          className="org-name-link"
                          onClick={() => viewDetails(org._id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && viewDetails(org._id)}
                        >
                          {org.name}
                        </span>
                      </td>
                      <td>
                        <span className="count-badge">{org.villaCount ?? 0} Villas</span>
                      </td>
                      <td>
                        <span className="count-badge">{org.userCount ?? 0} Users</span>
                      </td>
                      <td>
                        <span className={`status-pill ${getStatusClass(org.status)}`}>
                          {org.status
                            ? t(`superAdmin.orgManager.status.${org.status.toLowerCase()}`, {
                                defaultValue: org.status,
                              })
                            : 'Unknown'}
                        </span>
                      </td>
                      <td>
                        <div className="action-btn-group">
                          <button
                            className="action-icon-btn btn-view"
                            title={t('superAdmin.orgManager.viewDetails', {
                              defaultValue: 'View Details',
                            })}
                            onClick={() => viewDetails(org._id)}
                          >
                            <CIcon icon={cilFolderOpen} size="sm" />
                          </button>
                          <button
                            className={`action-icon-btn ${org.status === 'Active' ? 'btn-block' : 'btn-unblock'}`}
                            title={
                              org.status === 'Active'
                                ? t('superAdmin.orgManager.block', { defaultValue: 'Block' })
                                : t('superAdmin.orgManager.unblock', { defaultValue: 'Unblock' })
                            }
                            onClick={() => toggleStatus(org._id, org.status)}
                            disabled={loading || org.status === 'Pending'}
                          >
                            <CIcon
                              icon={org.status === 'Active' ? cilBan : cilCheckCircle}
                              size="sm"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination-bar">
                <div className="pagination-info">
                  {t('superAdmin.orgManager.pageInfo', {
                    defaultValue: `Page ${page} of ${totalPages}`,
                  })}
                </div>
                <CPagination aria-label="Organization pagination">
                  <CPaginationItem
                    disabled={page === 1}
                    onClick={() => handlePageChange(page - 1)}
                    style={{ cursor: page === 1 ? 'default' : 'pointer' }}
                  >
                    &laquo;
                  </CPaginationItem>
                  {[...Array(totalPages)].map((_, i) => (
                    <CPaginationItem
                      key={i + 1}
                      active={page === i + 1}
                      onClick={() => handlePageChange(i + 1)}
                      style={{ cursor: 'pointer' }}
                    >
                      {i + 1}
                    </CPaginationItem>
                  ))}
                  <CPaginationItem
                    disabled={page === totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    style={{ cursor: page === totalPages ? 'default' : 'pointer' }}
                  >
                    &raquo;
                  </CPaginationItem>
                </CPagination>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default OrganizationManager
