import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CSpinner } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft } from '@coreui/icons'
import useOrganizationDetails from '../hooks/useOrganizationDetails.js'
import useOrganizationUsers from '../hooks/useOrganizationUsers.js'
import OrganizationOverviewCards from '../components/OrganizationOverviewCards.jsx'
import OrganizationInfoCard from '../components/OrganizationInfoCard.jsx'
import UserFiltersBar from '../components/UserFiltersBar.jsx'
import UserDirectoryTable from '../components/UserDirectoryTable.jsx'
import UserDetailDrawer from '../components/UserDetailDrawer.jsx'
import '../styles/_organization.scss'
import AppLoader from '../../../components/common/AppLoader'

/**
 * Organization Details view — orchestrates overview cards, org info, user directory.
 * Follows the Notice Board theme and Thin View Pattern.
 */
export const OrganizationDetails = () => {
  const { organizationId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const {
    organization,
    summary,
    loading: detailsLoading,
    error: detailsError,
    fetchDetails,
    resetDetails,
  } = useOrganizationDetails()

  const {
    users,
    total: usersTotal,
    page: usersPage,
    totalPages: usersTotalPages,
    search: usersSearch,
    roleFilter: usersRoleFilter,
    statusFilter: usersStatusFilter,
    loading: usersLoading,
    error: usersError,
    selectedUser,
    userDrawerOpen,
    userDrawerLoading,
    fetchUsers,
    handleSearch,
    handleRoleFilter,
    handleStatusFilter,
    handleViewUser,
    handleCloseDrawer,
  } = useOrganizationUsers(organizationId)

  useEffect(() => {
    if (organizationId) {
      fetchDetails(organizationId)
      fetchUsers(1)
    }
    return () => {
      resetDetails()
    }
  }, [organizationId])

  const handleBack = () => {
    navigate('/super-admin/organizations')
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
        {/* Back Navigation */}
        <button className="back-nav" onClick={handleBack}>
          <CIcon icon={cilArrowLeft} size="sm" />
          <span>
            {t('superAdmin.orgDetails.backBtn', { defaultValue: 'Back to Organizations' })}
          </span>
        </button>

        {/* Page Header */}
        <div className="page-header">
          <div>
            <h2
              className="page-title"
              style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <span>
                {organization?.name ||
                  t('superAdmin.orgDetails.title', { defaultValue: 'Organization Details' })}
              </span>
              {organization?.status && (
                <span className={`status-pill ${getStatusClass(organization.status)}`}>
                  {organization.status}
                </span>
              )}
            </h2>
            {organization && (
              <p className="page-subtitle">
                {t('superAdmin.orgDetails.orgIdLabel', { defaultValue: 'ID:' })}{' '}
                <code
                  style={{
                    fontSize: '13px',
                    color: '#321fdb',
                    fontWeight: 700,
                    background: '#ebedff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {organization._id}
                </code>
              </p>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {detailsError && (
          <div
            className="alert alert-danger mb-4"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span>{detailsError}</span>
            <button
              className="btn-pill btn-pill-outline"
              onClick={() => fetchDetails(organizationId)}
            >
              {t('superAdmin.orgDetails.retryBtn', { defaultValue: 'Retry' })}
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {detailsLoading && !organization ? (
          <div className="loading-center">
            <AppLoader variant="block" />
            <span>
              {t('superAdmin.orgDetails.loadingDetails', {
                defaultValue: 'Loading organization details...',
              })}
            </span>
          </div>
        ) : (
          <>
            {/* Overview KPI Cards */}
            <OrganizationOverviewCards summary={summary} />

            {/* Organization Information */}
            <OrganizationInfoCard organization={organization} />

            {/* User Directory Section */}
            <div className="section-card">
              <div className="section-card-header">
                <div>
                  <h4 className="section-title">
                    {t('superAdmin.orgDetails.userDirectoryTitle', {
                      defaultValue: 'User Directory',
                    })}
                  </h4>
                  <p className="section-subtitle">
                    {t('superAdmin.orgDetails.userDirectorySub', {
                      defaultValue:
                        'Browse, search, filter, and inspect member details belonging to this organization.',
                    })}
                  </p>
                </div>
              </div>
              <div className="section-card-body">
                {usersError && <div className="alert alert-danger mb-3">{usersError}</div>}

                {/* Filters & Search Bar */}
                <UserFiltersBar
                  search={usersSearch}
                  roleFilter={usersRoleFilter}
                  statusFilter={usersStatusFilter}
                  onSearchChange={handleSearch}
                  onRoleChange={handleRoleFilter}
                  onStatusChange={handleStatusFilter}
                />

                {/* Users Directory Table */}
                <UserDirectoryTable
                  users={users}
                  loading={usersLoading}
                  page={usersPage}
                  totalPages={usersTotalPages}
                  total={usersTotal}
                  onPageChange={(page) => fetchUsers(page)}
                  onViewUser={handleViewUser}
                />
              </div>
            </div>
          </>
        )}

        {/* User Detail Offcanvas Drawer */}
        <UserDetailDrawer
          visible={userDrawerOpen}
          onClose={handleCloseDrawer}
          user={selectedUser}
          loading={userDrawerLoading}
          organizationName={organization?.name}
        />
      </div>
    </div>
  )
}

export default OrganizationDetails
