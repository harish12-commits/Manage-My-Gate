import React, { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Alert, AlertDescription } from 'src/components/ui/alert';

// Import generic layout components
import PageHeader from 'src/components/common/PageHeader';
import DataTable from 'src/components/common/DataTable';
import ActionIconButton from 'src/components/common/ActionIconButton';

// Import feature sub-components and controller hook
import UserToolbar from './components/UserToolbar';
import InviteUserModal from './components/InviteUserModal';
import BulkInviteModal from './components/BulkInviteModal';
import InviteUserButton from './components/InviteUserButton';
import ManageRolesModal from './components/ManageRolesModal';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import TemplateEditorCanvasModal from '../messageTemplate/components/TemplateEditorCanvasModal';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { useUserList } from './hooks/useUserList';

const UserList = () => {
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
    openManageRolesModal,
    closeManageRolesModal,
    handleSaveRoles,
    isLoading,
    error,
  } = useUserList();

  // ── Local UI State ──
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBulkInviteModal, setShowBulkInviteModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // ── Handlers ──
  const handleSendInvite = async (inviteData) => {
    try {
      const response = await inviteUser(inviteData);
      const token = response.invitationToken;
      if (token) {
        const clientUrl = window.location.origin + window.location.pathname;
        const inviteLink = `${clientUrl}#/accept-invite/${token}`;
        toast((t) => (
          <div className="flex items-center gap-2">
            <span className="text-xs">
              User invited! Link:{' '}
              <a
                href={inviteLink}
                target="_blank"
                rel="noreferrer"
                className="underline font-bold text-primary"
              >
                {inviteLink.substring(0, 35)}...
              </a>
            </span>
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                navigator.clipboard.writeText(inviteLink);
                toast.success('Copied link!');
              }}
            >
              Copy
            </Button>
          </div>
        ), { duration: 8000 });
      } else {
        toast.success('User invited successfully!');
      }
    } catch (err) {
      toast.error(err || 'Failed to invite user');
    }
    setShowInviteModal(false);
  };

  const handleDeleteClick = (user) => {
    if (window.confirm(`Delete user "${user.name}"? This action cannot be undone.`)) {
      deleteUser(user.id);
    }
  };

  const handleManageRoles = (user) => {
    openManageRolesModal(user);
  };

  // ── DataTable Columns Configuration ──
  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'Name',
      render: (val) => <span className="font-semibold text-black dark:text-white">{val}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      render: (val) => <span className="text-gray-500 dark:text-gray-400">{val}</span>,
    },
    {
      key: 'villaNumber',
      label: 'Villa / Unit',
      render: (val, row) => {
        if (!val) return <span className="text-gray-400 text-xs">—</span>;
        return (
          <div>
            <span className="font-bold text-xs text-primary">{val}</span>
            {row.villaBlock && <span className="text-gray-400 text-xs ml-1">({row.villaBlock})</span>}
            {row.residentType && row.residentType !== 'None' && (
              <div className="text-gray-400 text-[11px] mt-0.5">
                Residency: <span className="font-semibold">{row.residentType}</span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'role',
      label: 'Role',
      render: (val) => {
        if (!val || val === '' || (Array.isArray(val) && val.length === 0)) {
          return (
            <Badge variant="outlineSecondary" className="text-xs font-semibold px-2 py-0.5">
              Unassigned
            </Badge>
          );
        }
        const rolesList = typeof val === 'string' ? val.split(',').map(r => r.trim()) : [val];
        return (
          <div className="flex flex-wrap gap-1 max-h-[40px] overflow-y-auto">
            {rolesList.map((r, i) => (
              <Badge
                key={i}
                variant="lightInfo"
                className="text-2xs px-2 py-0.5 whitespace-nowrap rounded-full font-medium"
              >
                {r}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => {
        let badgeVariant = 'secondary';
        if (val === 'Active') {
          badgeVariant = 'lightSuccess';
        } else if (val === 'Pending') {
          badgeVariant = 'lightWarning';
        } else if (val === 'Inactive') {
          badgeVariant = 'lightError';
        }
        return (
          <Badge
            variant={badgeVariant}
            className="text-xs font-semibold px-2 py-0.5"
          >
            {val}
          </Badge>
        );
      },
    },
  ], []);

  // ── Render Actions for Data Grid ──
  const renderRowActions = (user) => {
    const isSelf = user.id === currentUserId;
    return (
      <div className="flex gap-2">
        <ActionIconButton
          id={`manage-roles-${user.id}`}
          color="primary"
          onClick={() => handleManageRoles(user)}
          title={isSelf ? 'You cannot modify your own account.' : `Manage roles for ${user.name}`}
          disabled={isSelf}
          icon={
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          }
        />
        <ActionIconButton
          id={`delete-user-${user.id}`}
          color="danger"
          onClick={() => handleDeleteClick(user)}
          title={isSelf ? 'You cannot modify your own account.' : `Delete ${user.name}`}
          disabled={isSelf}
          icon={
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          }
        />
      </div>
    );
  };

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
  );

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Page Header */}
      <PageHeader
        title="User Management"
        subtitle="Manage organization users and allocate access roles."
        actionButtons={
          <div className="flex flex-wrap gap-2">
            <Button
              id="configure-invitation-tmpl-btn"
              variant="outline"
              size="sm"
              className="text-xs font-semibold flex items-center gap-1 bg-white dark:bg-meta-4 border-stroke dark:border-strokedark text-black dark:text-white"
              onClick={() => setShowTemplateModal(true)}
            >
              ✉️ Configure Invitation Mail
            </Button>
            <Button
              id="bulk-invite-users-btn"
              variant="outline"
              size="sm"
              className="text-xs font-semibold flex items-center gap-1 bg-white dark:bg-meta-4 border-stroke dark:border-strokedark text-black dark:text-white"
              onClick={() => setShowBulkInviteModal(true)}
            >
              👥 Bulk Invite
            </Button>
            <InviteUserButton onClick={() => setShowInviteModal(true)} />
          </div>
        }
      />

      {error && (
        <Alert variant="destructive" className="mb-4" id="user-list-error-alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
        onClose={closeManageRolesModal}
        onSave={handleSaveRoles}
        availableRoles={ROLES}
      />
    </div>
  );
};

export default UserList;
