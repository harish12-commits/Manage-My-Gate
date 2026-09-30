import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CAlert, CCard, CCardBody, CCardHeader, CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBell, cilChevronLeft, cilChevronRight } from '@coreui/icons'
import useNotifications from '../hooks/useNotifications.js'
import NotificationItem from '../components/NotificationItem.jsx'
import PageHeader from '../../../components/common/PageHeader.jsx'
import '../styles/_notification.scss'
import AppLoader from '../../../components/common/AppLoader'

/**
 * Top-level view orchestrator for `/notifications` full-page route.
 * Implements full page-by-page pagination controls.
 *
 * @component
 */
export const NotificationView = () => {
  const { t } = useTranslation()
  const {
    notifications,
    unreadCount,
    status,
    pagination,
    error,
    fetchNotifications,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleDelete,
  } = useNotifications()

  const { currentPage, totalPages, totalRecords } = pagination
  const limit = 10

  // On initial mount, fetch the first page
  useEffect(() => {
    fetchNotifications(1, limit)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrevPage = () => {
    if (currentPage > 1) {
      fetchNotifications(currentPage - 1, limit)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      fetchNotifications(currentPage + 1, limit)
    }
  }

  const handlePageClick = (pageNumber) => {
    fetchNotifications(pageNumber, limit)
  }

  // Generate page numbers array to render
  const pageNumbers = []
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i)
  }

  // Calculate slice of items to display for the current page
  // Since Redux store getNotifications.fulfilled appends items when page > 1,
  // items array accumulates. To show page-by-page strictly in the list view,
  // we slice the items that correspond to the current page.
  // Wait, if we want to display only the items of the current page, we can slice:
  // startIndex = (currentPage - 1) * limit
  // endIndex = startIndex + limit
  // Wait! What if the items count is smaller (e.g. some items got read/deleted, or real-time added)?
  // Using the index slice is a good way to handle this:
  const startIndex = (currentPage - 1) * limit
  const currentPageNotifications = notifications.slice(startIndex, startIndex + limit)

  return (
    <div className="notifications-view-container p-4">
      {/* Page Header */}
      <PageHeader
        title={t('notification.fullViewTitle')}
        subtitle={t('notification.fullViewSubtitle')}
        actionButtons={
          unreadCount > 0 ? (
            <CButton
              color="primary"
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              id="mark-all-notifications-read-view"
            >
              {t('notification.markAllRead')}
            </CButton>
          ) : null
        }
      />

      {error && (
        <CAlert color="danger" className="mb-3">
          {error}
        </CAlert>
      )}

      {/* Main Notifications Card */}
      <CCard className="notifications-card">
        <CCardHeader className="notifications-header d-flex justify-content-between align-items-center">
          <span className="fw-semibold">
            {t('notification.totalCount', { count: totalRecords })}
          </span>
          {unreadCount > 0 && (
            <span className="badge bg-danger rounded-pill">
              {t('notification.unreadCount', { count: unreadCount })}
            </span>
          )}
        </CCardHeader>
        <CCardBody className="p-0">
          <div className="notifications-list">
            {status === 'loading' && currentPageNotifications.length === 0 ? (
              <div className="d-flex justify-content-center align-items-center p-5">
                <AppLoader variant="block" />
              </div>
            ) : currentPageNotifications.length === 0 ? (
              <div className="notification-empty-state py-5">
                <CIcon icon={cilBell} size="xl" className="empty-icon text-muted mb-3" />
                <p className="text-muted">{t('notification.empty')}</p>
              </div>
            ) : (
              <div className="notification-list-container">
                {currentPageNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id || notification._id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Page-by-Page Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination-controls-wrapper d-flex justify-content-between align-items-center px-4 py-3 border-top">
              <span className="pagination-info">
                {t('notification.paginationInfo', {
                  start: startIndex + 1,
                  end: Math.min(startIndex + limit, totalRecords),
                  total: totalRecords,
                })}
              </span>
              <div className="pagination-buttons d-flex gap-1 align-items-center">
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 || status === 'loading'}
                  aria-label={t('notification.prevPage')}
                >
                  <CIcon icon={cilChevronLeft} size="sm" />
                </CButton>

                {pageNumbers.map((num) => (
                  <CButton
                    key={num}
                    color={num === currentPage ? 'primary' : 'secondary'}
                    variant={num === currentPage ? 'solid' : 'outline'}
                    size="sm"
                    onClick={() => handlePageClick(num)}
                    disabled={status === 'loading'}
                  >
                    {num}
                  </CButton>
                ))}

                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages || status === 'loading'}
                  aria-label={t('notification.nextPage')}
                >
                  <CIcon icon={cilChevronRight} size="sm" />
                </CButton>
              </div>
            </div>
          )}
        </CCardBody>
      </CCard>
    </div>
  )
}

export default NotificationView
