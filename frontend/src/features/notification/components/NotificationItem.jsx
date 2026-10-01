import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import CIcon from '@coreui/icons-react'
import { cilInfo, cilCheckCircle, cilWarning, cilXCircle, cilCheck, cilTrash } from '@coreui/icons'
import '../styles/_notification.scss'

/**
 * Format relative time using native Intl API
 * @param {string} dateString
 * @param {string} locale
 */
const formatRelativeTime = (dateString, locale = 'en') => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)

  if (isNaN(diffInSeconds)) return ''

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (diffInSeconds < 60) {
    return rtf.format(-Math.max(1, diffInSeconds), 'second')
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return rtf.format(-diffInMinutes, 'minute')
  }
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return rtf.format(-diffInHours, 'hour')
  }
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) {
    return rtf.format(-diffInDays, 'day')
  }
  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return rtf.format(-diffInMonths, 'month')
  }
  const diffInYears = Math.floor(diffInMonths / 12)
  return rtf.format(-diffInYears, 'year')
}

/**
 * Maps notification type to CoreUI icon
 * @param {string} type
 */
const getNotificationIcon = (type) => {
  switch (type) {
    case 'SUCCESS':
    case 'INVITATION':
      return cilCheckCircle
    case 'WARNING':
      return cilWarning
    case 'ERROR':
      return cilXCircle
    case 'INFO':
    default:
      return cilInfo
  }
}

/**
 * Renders a single notification item.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.notification - The notification data object
 * @param {Function} props.onMarkAsRead - Callback when mark as read is clicked
 * @param {Function} props.onDelete - Callback when delete/clear is clicked
 */
export const NotificationItem = ({ notification, onMarkAsRead, onDelete, onClose }) => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { _id, id, title, body, type, isRead, createdAt, actionUrl } = notification
  const notificationId = id || _id

  const handleMarkAsReadClick = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (onMarkAsRead && !isRead) {
      onMarkAsRead(notificationId)
    }
  }

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (onDelete) {
      onDelete(notificationId)
    }
  }

  const itemClassNames = `notification-item ${isRead ? 'read' : 'unread'} type-${type}`

  const renderedContent = (
    <>
      {!isRead && <span className="unread-blue-dot" aria-hidden="true" />}
      <div className={`notification-icon-wrapper ${type}`}>
        <CIcon icon={getNotificationIcon(type)} size="md" />
      </div>
      <div className="notification-content">
        <h6 className="notification-title">{title}</h6>
        <p className="notification-body">{body}</p>
        <span className="notification-time">{formatRelativeTime(createdAt, i18n.language)}</span>
      </div>
      <div className="notification-actions">
        {!isRead && (
          <button
            type="button"
            className="mark-read-btn"
            onClick={handleMarkAsReadClick}
            title={t('notification.markAsRead')}
            aria-label={t('notification.markAsRead')}
          >
            <CIcon icon={cilCheck} size="sm" />
          </button>
        )}
        <button
          type="button"
          className="clear-btn"
          onClick={handleDeleteClick}
          title={t('notification.clear')}
          aria-label={t('notification.clear')}
        >
          <CIcon icon={cilTrash} size="sm" />
        </button>
      </div>
    </>
  )

  if (actionUrl) {
    let finalActionUrl = actionUrl

    // Handle invitation link routing
    if (finalActionUrl.includes('/invite/web/')) {
      finalActionUrl = '/invite/' + finalActionUrl.split('/invite/web/')[1]
    } else if (finalActionUrl.includes('/invite/app/')) {
      finalActionUrl = '/invite/' + finalActionUrl.split('/invite/app/')[1]
    } else if (finalActionUrl.includes('/invite/')) {
      finalActionUrl = '/invite/' + finalActionUrl.split('/invite/')[1]
    } else if (finalActionUrl.startsWith('/complaints/')) {
      finalActionUrl = '/complaints'
    } else if (finalActionUrl === '/assignee') {
      finalActionUrl = '/admin/complaints/assignee'
    } else if (
      finalActionUrl.startsWith('/admin/complaints') &&
      finalActionUrl !== '/admin/complaints/assignee'
    ) {
      finalActionUrl = '/complaints'
    } else if (
      finalActionUrl === '/tenant/platform-crm/enquiries' ||
      finalActionUrl.includes('platform-crm/enquiries')
    ) {
      finalActionUrl = '/super-admin/crm'
    } else if (finalActionUrl.includes('billing')) {
      finalActionUrl = '/billing?tab=action-center'
    } else if (finalActionUrl.startsWith('#/')) {
      finalActionUrl = finalActionUrl.replace('#', '')
    }

    // Use programmatic navigation to ensure HashRouter works correctly
    // navigate defined at component level
    const handleClick = () => {
      if (onClose) onClose()
      navigate(finalActionUrl)
    }
    return (
      <div className={itemClassNames} onClick={handleClick}>
        {renderedContent}
      </div>
    )
  }

  return (
    <div
      className={itemClassNames}
      onClick={() => {
        if (onClose) onClose()
      }}
    >
      {renderedContent}
    </div>
  )
}

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    _id: PropTypes.string,
    id: PropTypes.string,
    title: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['INFO', 'WARNING', 'SUCCESS', 'ERROR', 'INVITATION']).isRequired,
    isRead: PropTypes.bool.isRequired,
    createdAt: PropTypes.string.isRequired,
    actionUrl: PropTypes.string,
  }).isRequired,
  onMarkAsRead: PropTypes.func.isRequired,
  onClose: PropTypes.func,
}

export default NotificationItem
