import React, { useState, useMemo } from 'react'
import { CBadge, CButton, CSpinner, CAlert } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSend, cilBan, cilUserPlus } from '@coreui/icons'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

import PageHeader from '../../../components/common/PageHeader'
import DataTable from '../../../components/common/DataTable'
import InvitationToolbar from '../components/InvitationToolbar'
import RevokeInvitationModal from '../components/RevokeInvitationModal'
import InviteUserModal from '../components/InviteUserModal'
import { useInvitationList } from '../hooks/useInvitationList'
import { inviteUser } from '../services/userApi'
import '../styles/_userManagement.scss'

/**
 * InvitationManagementView Component
 *
 * Primary administrative view for managing workspace invitations:
 * viewing lifecycle status, resending, revoking, and filtering.
 */
const InvitationManagementView = () => {
  const { t } = useTranslation()

  const {
    invitations,
    currentPage,
    rowsPerPage,
    totalRecords,
    totalPages,
    statusFilter,
    searchQuery,
    loading,
    actionLoadingId,
    error,
    refreshInvitations,
    handleSearchChange,
    handleStatusChange,
    handlePageChange,
    handleRowsPerPageChange,
    handleResend,
    handleRevoke,
    STATUS_OPTIONS,
  } = useInvitationList()

  const [selectedForRevoke, setSelectedForRevoke] = useState(null)
  const [showInviteModal, setShowInviteModal] = useState(false)

  // Resend action handler
  const onResendClick = async (invitation) => {
    try {
      const res = await handleResend(invitation._id)
      if (res?.error) {
        toast.error(
          res.error.message || t('invitations.resendFailed', 'Failed to resend invitation'),
        )
      } else {
        toast.success(
          t('invitations.resendSuccess', 'Invitation successfully resent to {{email}}', {
            email: invitation?.recipient?.email || 'recipient',
          }),
        )
      }
    } catch (err) {
      toast.error(err?.message || t('invitations.resendFailed', 'Failed to resend invitation'))
    }
  }

  // Revoke action confirmation
  const onConfirmRevoke = async (invitationId) => {
    const res = await handleRevoke(invitationId)
    if (res?.error) {
      throw new Error(
        res.error.message || t('invitations.revokeFailed', 'Failed to revoke invitation'),
      )
    }
    toast.success(t('invitations.revokeSuccess', 'Invitation successfully revoked'))
  }

  // Handle new invite from this view
  const handleSendInvite = async (inviteData) => {
    await inviteUser(inviteData)
    toast.success(t('invitations.inviteSuccess', 'Invitation sent successfully!'))
    refreshInvitations()
  }

  // Table Columns
  const columns = useMemo(
    () => [
      {
        key: 'recipient',
        label: t('invitations.columns.recipient', 'Recipient'),
        render: (_, row) => (
          <div>
            <div className="fw-semibold text-body">
              {row.recipient?.name || row.recipient?.username || t('common.na', '—')}
            </div>
            <div className="small text-muted">{row.recipient?.email || t('common.na', '—')}</div>
            {row.recipient?.phone && <div className="small text-muted">{row.recipient.phone}</div>}
          </div>
        ),
      },
      {
        key: 'role',
        label: t('invitations.columns.role', 'Role & Residency'),
        render: (_, row) => (
          <div>
            <div>
              {row.role?.name ? (
                <CBadge color="info" shape="rounded-pill" className="px-2 py-1">
                  {row.role.name}
                </CBadge>
              ) : (
                <span className="text-muted small">{t('common.na', '—')}</span>
              )}
            </div>
            {row.residencyType && row.residencyType !== 'None' && (
              <small className="text-muted d-block mt-1">{row.residencyType}</small>
            )}
          </div>
        ),
      },
      {
        key: 'inviter',
        label: t('invitations.columns.inviter', 'Inviter'),
        render: (_, row) => (
          <div>
            <div className="text-body small">
              {row.inviter?.name || row.inviter?.email || t('invitations.system', 'System')}
            </div>
          </div>
        ),
      },
      {
        key: 'createdAt',
        label: t('invitations.columns.sentDate', 'Sent Date'),
        render: (val) => (
          <span className="small text-muted">
            {val ? new Date(val).toLocaleDateString() : t('common.na', '—')}
          </span>
        ),
      },
      {
        key: 'expiresAt',
        label: t('invitations.columns.expiresDate', 'Expires'),
        render: (val) => (
          <span className="small text-muted">
            {val ? new Date(val).toLocaleDateString() : t('common.na', '—')}
          </span>
        ),
      },
      {
        key: 'status',
        label: t('invitations.columns.status', 'Status'),
        render: (val) => {
          let badgeColor = 'secondary'
          const status = val ? String(val).toUpperCase() : 'PENDING'
          if (status === 'ACCEPTED') badgeColor = 'success'
          else if (status === 'PENDING') badgeColor = 'warning'
          else if (status === 'EXPIRED') badgeColor = 'secondary'
          else if (status === 'REVOKED') badgeColor = 'danger'
          else if (status === 'REJECTED') badgeColor = 'dark'

          return (
            <CBadge color={badgeColor} className="px-2 py-1 fw-bold">
              {t(`invitations.status.${status.toLowerCase()}`, status)}
            </CBadge>
          )
        },
      },
    ],
    [t],
  )

  // Action column renderer
  const renderRowActions = (row) => {
    const status = row.status ? String(row.status).toUpperCase() : 'PENDING'
    const isActionLoading = actionLoadingId === row._id

    return (
      <div className="d-flex align-items-center gap-1 justify-content-end">
        {/* Resend Action: Eligible for PENDING or EXPIRED */}
        {(status === 'PENDING' || status === 'EXPIRED') && (
          <CButton
            color="primary"
            variant="outline"
            size="sm"
            onClick={() => onResendClick(row)}
            disabled={isActionLoading}
            title={t('invitations.resendTooltip', 'Resend invitation with new expiration')}
            className="d-inline-flex align-items-center gap-1 px-2 py-1"
          >
            {isActionLoading ? <CSpinner size="sm" /> : <CIcon icon={cilSend} size="sm" />}
            <span className="small">{t('invitations.resend', 'Resend')}</span>
          </CButton>
        )}

        {/* Revoke Action: Eligible for PENDING only */}
        {status === 'PENDING' && (
          <CButton
            color="danger"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedForRevoke(row)}
            disabled={isActionLoading}
            title={t('invitations.revokeTooltip', 'Revoke invitation')}
            className="d-inline-flex align-items-center gap-1 px-2 py-1 text-danger"
          >
            <CIcon icon={cilBan} size="sm" />
            <span className="small">{t('invitations.revoke', 'Revoke')}</span>
          </CButton>
        )}

        {status !== 'PENDING' && status !== 'EXPIRED' && (
          <span className="text-muted small px-2">—</span>
        )}
      </div>
    )
  }

  return (
    <div className="invitation-management-view">
      <PageHeader
        title={t('invitations.pageTitle', 'Invitation Management')}
        breadcrumbs={[
          { label: t('nav.users', 'Users'), to: '/users' },
          { label: t('nav.invitations', 'Invitations') },
        ]}
        actions={
          <CButton
            color="primary"
            size="sm"
            onClick={() => setShowInviteModal(true)}
            className="d-flex align-items-center gap-2"
          >
            <CIcon icon={cilUserPlus} size="sm" />
            <span>{t('invitations.inviteUser', 'Invite User')}</span>
          </CButton>
        }
      />

      {error && (
        <CAlert color="danger" dismissible className="mb-3">
          {error}
        </CAlert>
      )}

      <DataTable
        columns={columns}
        data={invitations}
        toolbar={
          <InvitationToolbar
            search={searchQuery}
            onSearchChange={handleSearchChange}
            status={statusFilter}
            onStatusChange={handleStatusChange}
            statusOptions={STATUS_OPTIONS}
            onRefresh={refreshInvitations}
            loading={loading}
          />
        }
        renderRowActions={renderRowActions}
        currentPage={currentPage}
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 20, 50]}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        loading={loading}
      />

      {/* Confirmation Modal for Revoking */}
      <RevokeInvitationModal
        visible={!!selectedForRevoke}
        onClose={() => setSelectedForRevoke(null)}
        onConfirm={onConfirmRevoke}
        invitation={selectedForRevoke}
      />

      {/* Invite User Modal */}
      <InviteUserModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSendInvite={handleSendInvite}
      />
    </div>
  )
}

export default InvitationManagementView
