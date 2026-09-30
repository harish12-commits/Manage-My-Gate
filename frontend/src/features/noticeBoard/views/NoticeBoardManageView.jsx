import React, { useState, useEffect } from 'react'
import { CBadge, CButton, CTooltip, CNav, CNavItem, CNavLink } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPin, cilTrash, cilPencil, cilFolderOpen } from '@coreui/icons'
import { useNoticeBoard } from '../hooks/useNoticeBoard.js'
import { useNoticeSocket } from '../hooks/useNoticeSocket.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import NoticeBoardTopNav from '../components/NoticeBoardTopNav.jsx'
import NoticeBoardFilters from '../components/NoticeBoardFilters.jsx'
import NoticeBoardPagination from '../components/NoticeBoardPagination.jsx'
import NoticeBoardFormModal from '../components/NoticeBoardFormModal.jsx'
import NoticeBoardDetailsModal from '../components/NoticeBoardDetailsModal.jsx'
import DeleteNoticeDialog from '../components/DeleteNoticeDialog.jsx'
import EmptyState from '../components/EmptyState.jsx'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import '../styles/_noticeBoard.scss'
import AppLoader from '../../../components/common/AppLoader'

export const NoticeBoardManageView = () => {
  useNoticeSocket()
  const { t } = useTranslation()
  const { checkPermission } = useAuth()

  // Enforce permissions checks
  const canCreate = checkPermission('notices:manage_notices')
  const canUpdate = checkPermission('notices:manage_notices')
  const canDelete = checkPermission('notices:manage_notices')

  const {
    notices,
    selectedNotice,
    loading,
    error,
    success,
    pagination,
    search,
    filters,
    sort,
    createNotice,
    updateNotice,
    deleteNotice,
    togglePin,
    setSearch,
    applyFilters,
    resetFilters,
    changePage,
    selectNotice,
    clearNoticeErrors,
    clearNoticeSuccess,
    initializeAdminBoard,
  } = useNoticeBoard()

  // Modal visibilities local states
  const [formModalVisible, setFormModalVisible] = useState(false)
  const [detailsModalVisible, setDetailsModalVisible] = useState(false)
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false)
  const [noticeIdToDelete, setNoticeIdToDelete] = useState(null)
  const [activeTab, setActiveTab] = useState('All')

  // Trigger load on mount
  useEffect(() => {
    initializeAdminBoard()
  }, [initializeAdminBoard])

  // Sync toasts
  useEffect(() => {
    if (success) {
      toast.success(t(`noticeBoard.messages.${success}`, { defaultValue: 'Operation successful' }))
      clearNoticeSuccess()
    }
    if (error) {
      toast.error(error)
      clearNoticeErrors()
    }
  }, [success, error, clearNoticeSuccess, clearNoticeErrors, t])

  const handleTabChange = (tab) => {
    if (tab === 'Create Notice') {
      handleAddClick()
      return
    }
    setActiveTab(tab)
    const filterTab = tab === 'All' ? '' : tab
    applyFilters({ status: filterTab })
  }

  const handleAddClick = () => {
    selectNotice(null)
    setFormModalVisible(true)
  }

  const handleEditClick = (notice) => {
    selectNotice(notice)
    setFormModalVisible(true)
  }

  const handleDeleteClick = (id) => {
    setNoticeIdToDelete(id)
    setDeleteDialogVisible(true)
  }

  const handleDetailsClick = (notice) => {
    selectNotice(notice)
    setDetailsModalVisible(true)
  }

  const handleSaveNotice = async (formData) => {
    try {
      if (selectedNotice) {
        await updateNotice(selectedNotice._id, formData)
      } else {
        await createNotice(formData)
        resetFilters()
      }
      setFormModalVisible(false)
    } catch (err) {
      console.error(err)
    }
  }

  const handleConfirmDelete = async () => {
    if (noticeIdToDelete) {
      try {
        await deleteNotice(noticeIdToDelete)
        setDeleteDialogVisible(false)
      } catch (err) {
        console.error(err)
      }
    }
  }

  const handlePinToggle = async (id, isPinned) => {
    try {
      await togglePin(id, isPinned)
    } catch (err) {
      console.error(err)
    }
  }

  const getPriorityBadgeColor = (p) => {
    switch (p) {
      case 'Critical':
        return 'danger'
      case 'High':
        return 'warning'
      case 'Medium':
        return 'info'
      default:
        return 'secondary'
    }
  }

  const getStatusBadgeColor = (s) => {
    switch (s) {
      case 'Published':
        return 'success'
      case 'Draft':
        return 'warning'
      case 'Scheduled':
        return 'info'
      case 'Archived':
        return 'secondary'
      default:
        return 'danger' // Expired
    }
  }

  const handleResetFilters = () => {
    resetFilters()
    setActiveTab('All')
  }

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      changePage(pagination.currentPage + 1)
    }
  }

  const handlePreviousPage = () => {
    if (pagination.currentPage > 1) {
      changePage(pagination.currentPage - 1)
    }
  }

  return (
    <div className="notice-board-theme pt-1">
      <div className="view-container py-2 pt-1">
        <NoticeBoardTopNav />

        {/* Admin Action Tabs */}
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <CNav className="notice-admin-tabs">
            {['All', 'Published', 'Draft', 'Scheduled', 'Archived'].map((tab) => (
              <CNavItem key={tab}>
                <CNavLink
                  active={activeTab === tab}
                  onClick={() => handleTabChange(tab)}
                  className="cursor-pointer fw-semibold"
                >
                  {t(`noticeBoard.statuses.${tab}`, tab)}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>

          {canCreate && (
            <button
              className="btn-pill btn-pill-primary"
              onClick={handleAddClick}
              style={{
                height: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Create Notice
            </button>
          )}
        </div>

        {/* Search & Filters */}
        <NoticeBoardFilters
          search={search}
          filters={filters}
          sort={sort}
          onSearchChange={setSearch}
          onFiltersChange={applyFilters}
          onReset={handleResetFilters}
          hideStatusFilter={true} // Hiding status select in filters as it is handled by tabs
        />

        {/* Table Listing */}
        {loading && notices.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <AppLoader variant="block" />
          </div>
        ) : notices.length === 0 ? (
          <EmptyState canCreate={canCreate} onAddClick={handleAddClick} />
        ) : (
          <div
            className="table-wrapper mb-2"
            style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}
          >
            <table className="ent-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Expiry Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notices.map((notice) => {
                  const creator = notice.createdBy?.username || notice.createdBy?.name || 'Someone'
                  return (
                    <tr
                      key={notice._id || notice.id}
                      className={notice.isPinned ? 'pinned-notice-card' : ''}
                    >
                      <td>
                        {notice.isPinned && (
                          <CTooltip content="Pinned notice">
                            <span style={{ color: 'var(--primary)' }}>
                              <CIcon icon={cilPin} size="sm" />
                            </span>
                          </CTooltip>
                        )}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <div className="position-relative" style={{ flexShrink: 0 }}>
                            <img
                              src={
                                notice.image ||
                                'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=600&auto=format&fit=crop&q=60'
                              }
                              alt=""
                              style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '8px',
                                objectFit: 'cover',
                                display: 'block',
                              }}
                              onError={(e) => {
                                e.target.src =
                                  'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=600&auto=format&fit=crop&q=60'
                              }}
                            />
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                              {notice.title}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                marginTop: '2px',
                              }}
                            >
                              By {creator}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <CBadge
                          color="light"
                          className="text-body border border-secondary border-opacity-25 small fw-semibold"
                        >
                          {notice.category}
                        </CBadge>
                      </td>
                      <td>
                        <CBadge color={getPriorityBadgeColor(notice.priority)} className="small">
                          {notice.priority}
                        </CBadge>
                      </td>
                      <td>
                        <CBadge color={getStatusBadgeColor(notice.status)} className="small">
                          {notice.status}
                        </CBadge>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {new Date(notice.expiryDate).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <CButton
                            color="info"
                            variant="outline"
                            size="sm"
                            title="View details"
                            onClick={() => handleDetailsClick(notice)}
                          >
                            <CIcon icon={cilFolderOpen} size="sm" />
                          </CButton>

                          {canUpdate && (
                            <>
                              <CButton
                                color="primary"
                                variant={notice.isPinned ? 'solid' : 'outline'}
                                size="sm"
                                title={notice.isPinned ? 'Unpin' : 'Pin'}
                                onClick={() => handlePinToggle(notice._id, !notice.isPinned)}
                              >
                                <CIcon icon={cilPin} size="sm" />
                              </CButton>

                              <CButton
                                color="warning"
                                variant="outline"
                                size="sm"
                                title="Edit notice"
                                onClick={() => handleEditClick(notice)}
                              >
                                <CIcon icon={cilPencil} size="sm" />
                              </CButton>
                            </>
                          )}

                          {canDelete && (
                            <CButton
                              color="danger"
                              variant="outline"
                              size="sm"
                              title="Delete notice"
                              onClick={() => handleDeleteClick(notice._id)}
                            >
                              <CIcon icon={cilTrash} size="sm" />
                            </CButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {notices.length > 0 && (
          <NoticeBoardPagination
            pagination={pagination}
            onPageChange={changePage}
            onNext={handleNextPage}
            onPrevious={handlePreviousPage}
          />
        )}
      </div>

      {/* Pop-up Form Modal */}
      <NoticeBoardFormModal
        visible={formModalVisible}
        notice={selectedNotice}
        onClose={() => setFormModalVisible(false)}
        onSave={handleSaveNotice}
      />

      {/* Details Modal */}
      <NoticeBoardDetailsModal
        visible={detailsModalVisible}
        notice={selectedNotice}
        onClose={() => setDetailsModalVisible(false)}
      />

      {/* Confirmation removal modal */}
      <DeleteNoticeDialog
        visible={deleteDialogVisible}
        loading={loading}
        onClose={() => setDeleteDialogVisible(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default NoticeBoardManageView
