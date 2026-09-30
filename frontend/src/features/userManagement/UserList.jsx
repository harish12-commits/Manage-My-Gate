/**
 * UserList Component
 *
 * Enterprise user management view. Consumes generic `<PageHeader>` and `<DataTable>`
 * components, and features sub-components `<UserToolbar>` and `<InviteUserModal>`.
 * Exclusively reads data and dispatches actions using the `useUserList` custom hook.
 *
 * Scope: feature-level, lives in src/features/userManagement/
 */

import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CBadge, CAlert, CButton, CSpinner } from '@coreui/react'
import { toast } from 'react-hot-toast'

// Import generic layout components
import PageHeader from '../../components/common/PageHeader'
import DataTable from '../../components/common/DataTable'
import ActionIconButton from '../../components/common/ActionIconButton'

// Import feature sub-components and controller hook
import UserToolbar from './components/UserToolbar'
import InviteUserModal from './components/InviteUserModal'
import BulkInviteModal from './components/BulkInviteModal'
import InviteUserButton from './components/InviteUserButton'
import ManageRolesModal from './components/ManageRolesModal'
import TemplateEditorCanvasModal from '../messageTemplate/components/TemplateEditorCanvasModal'
import { useUserList } from './hooks/useUserList'
import { useTranslation } from 'react-i18next'
import { parseBackendError } from '../../utils/validation'
import './styles/_userManagement.scss'

// ─── Main Component ───────────────────────────────────────────────────────────

const UserList = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // ── Controller Hook ──
  const {
    currentUserId,
    searchQuery,
    selectedRoles,
    statusFilter,
    currentPage,
    rowsPerPage,
    totalPages,
    filteredUsers,
    ROLES,
    STATUS_OPTIONS,
    setSearchQuery,
    toggleRole,
    toggleStatus,
    clearRoleFilter,
    setCurrentPage,
    setRowsPerPage,
    deleteUser,
    inviteUser,
    bulkInviteUsers,
    selectedUserForRoles,
    selectedUnitForRoles,
    openManageRolesModal,
    closeManageRolesModal,
    handleSaveRoles,
    isLoading,
    error,
  } = useUserList()

  // ── Local UI State ──
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showBulkInviteModal, setShowBulkInviteModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(null)

  // ── Handlers ──

  const handleSendInvite = async (inviteData) => {
    try {
      const response = await inviteUser(inviteData)
      const token = response.invitationToken
      if (token) {
        const inviteLink = response.inviteLink || `${window.location.origin}/invite/${token}`
        toast(
          (t) => (
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: '0.8rem' }}>
                User invited! Link:{' '}
                <a
                  href={inviteLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-decoration-underline fw-bold"
                >
                  {inviteLink.substring(0, 30)}...
                </a>
              </span>
              <CButton
                size="sm"
                color="primary"
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink)
                  toast.success('Copied link!')
                }}
              >
                Copy
              </CButton>
            </div>
          ),
          { duration: 8000 },
        )
      } else {
        toast.success('User invited successfully!')
      }
      setShowInviteModal(false)
      return response
    } catch (err) {
      const cleanMsg = parseBackendError(err, 'Failed to invite user')
      toast.error(cleanMsg)
      throw new Error(cleanMsg)
    }
  }

  const handleResendInvite = (user) => {
    handleSendInvite({
      email: user.email,
      villaId: user.villaId || null,
      residentType: user.residentType || 'None',
      roleName: user.role || null,
    })
  }

  const handleDeleteClick = async (user) => {
    const confirmMessage = `Delete user "${user.name}" from the organization? This action cannot be undone.`;
      
    if (window.confirm(confirmMessage)) {
      try {
        setIsDeleting(user.id)
        await deleteUser({ userId: user.id })
        toast.success(`User ${user.name} deleted successfully`);
      } catch (err) {
        console.error('Delete failed:', err);
        toast.error(err?.message || 'Failed to delete user');
      } finally {
        setIsDeleting(null)
      }
    }
  }

  // ── DataTable Columns Configuration ──
  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: t('userManagement.table.user', 'User'),
        render: (val) => <span className="fw-semibold">{val}</span>,
      },
      {
        key: 'email',
        label: t('auth.invite.emailLabel', 'Contact Info'),
        render: (val, row) => (
          <div className="d-flex flex-column gap-1">
            <span className="text-body-secondary">{val}</span>
            {row.phone && (
              <span className="text-muted small">
                <i className="fa-solid fa-phone me-1"></i>
                {row.phone}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'assignedUnits',
        label: t('auth.invite.unit', 'Villa / Unit'),
        render: (val, row) => {
          if (!val || val.length === 0) return <span className="text-muted small">—</span>
          return (
            <div className="d-flex flex-column gap-3 py-1">
              {val.map((unit, idx) => (
                <div key={idx} className="d-flex flex-column justify-content-center" style={{ height: '50px' }}>
                  <div>
                    <span className="fw-bold small text-primary">{unit.villaNumber}</span>
                    {unit.villaBlock && <span className="text-muted small ms-1">({unit.villaBlock})</span>}
                  </div>
                  {unit.residentType && unit.residentType !== 'None' && (
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {t('userManagement.table.residency', 'Residency')}: <span className="fw-semibold">{unit.residentType}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        },
      },
      {
        key: 'role',
        label: t('userManagement.table.role', 'Role'),
        render: (val, row) => {
          const renderRoleBadges = (roleStr) => {
            if (!roleStr || roleStr === '' || (Array.isArray(roleStr) && roleStr.length === 0)) {
              return (
                <CBadge color="light" className="text-body small px-2 py-1 border">
                  {t('userManagement.unassigned', 'Unassigned')}
                </CBadge>
              )
            }
            const rolesList = typeof roleStr === 'string' ? roleStr.split(',').map((r) => r.trim()) : [roleStr]
            return (
              <div className="d-flex flex-wrap gap-1">
                {rolesList.map((r, i) => (
                  <CBadge
                    key={i}
                    color="info"
                    shape="rounded-pill"
                    className="small px-2 py-1 text-nowrap"
                  >
                    {r}
                  </CBadge>
                ))}
              </div>
            )
          }

          if (row.assignedUnits && row.assignedUnits.length > 0) {
            return (
              <div className="d-flex flex-column gap-3 py-1">
                {row.assignedUnits.map((unit, idx) => (
                  <div key={idx} className="d-flex align-items-center" style={{ height: '50px' }}>
                    {renderRoleBadges(unit.role)}
                  </div>
                ))}
              </div>
            )
          }

          return (
            <div className="d-flex flex-column gap-3 py-1">
              <div className="d-flex align-items-center" style={{ height: '50px' }}>
                {renderRoleBadges(val)}
              </div>
            </div>
          )
        },
      },
      {
        key: 'status',
        label: t('common.status', 'Status'),
        render: (val, row) => {
          const renderStatusBadge = (statusStr) => {
            let badgeColor = 'secondary'
            let statusLabel = statusStr
            if (statusStr === 'Active') {
              badgeColor = 'success'
              statusLabel = t('superAdmin.orgManager.statusActive', 'Active')
            } else if (statusStr === 'Pending') {
              badgeColor = 'warning'
              statusLabel = t('invitations.status.pending', 'Pending')
            } else if (statusStr === 'Inactive' || statusStr === 'Rejected') {
              badgeColor = 'danger'
              statusLabel = statusStr === 'Rejected' ? t('invitations.status.rejected', 'Rejected') : statusStr
            }
            return (
              <CBadge color={badgeColor} className="small px-2 py-1">
                {statusLabel}
              </CBadge>
            )
          }

          if (row.assignedUnits && row.assignedUnits.length > 0) {
            return (
              <div className="d-flex flex-column gap-3 py-1">
                {row.assignedUnits.map((unit, idx) => (
                  <div key={idx} className="d-flex align-items-center" style={{ height: '50px' }}>
                    {renderStatusBadge(unit.status || val)}
                  </div>
                ))}
              </div>
            )
          }

          return (
            <div className="d-flex flex-column gap-3 py-1">
              <div className="d-flex align-items-center" style={{ height: '50px' }}>
                {renderStatusBadge(val)}
              </div>
            </div>
          )
        },
      },
    ],
    [t],
  )

  const handleManageRoles = (user, unit = null) => {
    openManageRolesModal(user, unit)
  }

  // ── Render Actions for Data Grid ──
  const renderRowActions = (user) => {
    const isSelf = user.id === currentUserId
    const isPending = user.status === 'Pending'
    const isRejected = user.status === 'Rejected'

    const ActionButtons = ({ unit }) => (
      <div className="d-flex gap-2">
        {/* Resend Invite — mail icon (for pending or rejected users) */}
        {(isPending || isRejected) && (
          <ActionIconButton
            id={`resend-invite-${user.id}`}
            color="success"
            onClick={() => handleResendInvite(user)}
            title={`Resend invitation to ${user.name}`}
            icon={
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            }
          />
        )}
        {/* Manage Roles — key icon */}
        <ActionIconButton
          id={`manage-roles-${user.id}`}
          color="primary"
          onClick={() => handleManageRoles(user, unit)}
          title={isSelf ? 'You cannot modify your own account.' : `Manage roles for ${user.name}`}
          disabled={isSelf}
          icon={
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          }
        />
        {/* Delete — trash icon */}
        <ActionIconButton
          id={`delete-user-${user.id}`}
          color="danger"
          onClick={() => handleDeleteClick(user)}
          title={isSelf ? 'You cannot modify your own account.' : `Delete ${user.name}`}
          disabled={isSelf || isDeleting === user.id}
          icon={
            isDeleting === user.id ? (
              <CSpinner size="sm" style={{ width: '13px', height: '13px' }} />
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            )
          }
        />
      </div>
    )

    if (user.assignedUnits && user.assignedUnits.length > 0) {
      return (
        <div className="d-flex flex-column gap-3 py-1">
          {user.assignedUnits.map((unit, idx) => (
            <div key={idx} className="d-flex align-items-center" style={{ height: '50px' }}>
              <ActionButtons unit={unit} />
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="d-flex flex-column gap-3 py-1">
        <div className="d-flex align-items-center" style={{ height: '50px' }}>
          <ActionButtons unit={null} />
        </div>
      </div>
    )
  }

  // ── Responsive Toolbar Wrapper ──
  const toolbar = (
    <UserToolbar
      search={searchQuery}
      setSearch={setSearchQuery}
      selectedRoles={selectedRoles}
      handleRoleToggle={toggleRole}
      setSelectedRoles={clearRoleFilter}
      statusFilter={statusFilter}
      handleStatusToggle={toggleStatus}
      ROLES={ROLES}
      STATUS_OPTIONS={STATUS_OPTIONS}
    />
  )

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Page Header */}
      <PageHeader
        title={t('userManagement.title', 'User Management')}
        subtitle={t('userManagement.subtitle', 'Manage organization users and allocate access roles.')}
        actionButtons={
          <div className="d-flex flex-wrap gap-2">
            <CButton
              id="view-invitations-btn"
              color="info"
              variant="outline"
              size="sm"
              className="fw-semibold d-flex align-items-center gap-1"
              onClick={() => navigate('/users/invitations')}
            >
              📋 {t('invitations.pageTitle', 'Invitations')}
            </CButton>
            <CButton
              id="configure-invitation-tmpl-btn"
              color="secondary"
              variant="outline"
              size="sm"
              className="fw-semibold d-flex align-items-center gap-1"
              onClick={() => setShowTemplateModal(true)}
            >
              ✉️ {t('userManagement.configureMail', 'Configure Invitation Mail')}
            </CButton>
            <CButton
              id="bulk-invite-users-btn"
              color="primary"
              variant="outline"
              size="sm"
              className="fw-semibold d-flex align-items-center gap-1"
              onClick={() => setShowBulkInviteModal(true)}
            >
              👥 {t('userManagement.bulkInvite', 'Bulk Invite')}
            </CButton>
            <InviteUserButton onClick={() => setShowInviteModal(true)} />
          </div>
        }
      />

      {error && (
        <CAlert color="danger" className="mb-3" id="user-list-error-alert">
          {error}
        </CAlert>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        toolbar={toolbar}
        renderRowActions={renderRowActions}
        currentPage={currentPage}
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
        loading={isLoading}
      />

      {/* Invite User Modal */}
      <InviteUserModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSendInvite={handleSendInvite}
      />

      {/* Bulk Invite Modal */}
      <BulkInviteModal
        visible={showBulkInviteModal}
        onClose={() => setShowBulkInviteModal(false)}
        onBulkInvite={bulkInviteUsers}
      />

      {/* Template Editor Canvas Modal */}
      <TemplateEditorCanvasModal
        visible={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
      />

      {/* Manage Roles Modal */}
      <ManageRolesModal
        visible={!!selectedUserForRoles}
        user={selectedUserForRoles}
        unit={selectedUnitForRoles}
        onClose={closeManageRolesModal}
        onSave={handleSaveRoles}
        availableRoles={ROLES}
      />
    </div>
  )
}

export default UserList
