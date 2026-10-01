import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard } from '../../hooks/useDashboard.js'

const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  let interval = Math.floor(seconds / 31536000)
  if (interval >= 1) return interval + 'y ago'
  interval = Math.floor(seconds / 2592000)
  if (interval >= 1) return interval + 'mo ago'
  interval = Math.floor(seconds / 86400)
  if (interval >= 1) return interval + 'd ago'
  interval = Math.floor(seconds / 3600)
  if (interval >= 1) return interval + 'h ago'
  interval = Math.floor(seconds / 60)
  if (interval >= 1) return interval + 'm ago'
  return Math.floor(seconds) + 's ago'
}

const RecentActivityWidget = () => {
  const { recentActivity, loading } = useDashboard()
  const [showAll, setShowAll] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  if (loading) {
    return (
      <div className="card">
        <h3 style={{ margin: 0, marginBottom: '24px' }}>Live Activity Log</h3>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    )
  }

  const getIconAndColor = (item) => {
    if (item.type === 'payment') {
      if (item.status === 'success')
        return {
          icon: 'fa-solid fa-indian-rupee-sign',
          bg: 'var(--success-bg)',
          color: 'var(--success)',
        }
      if (item.status === 'failed')
        return {
          icon: 'fa-solid fa-triangle-exclamation',
          bg: 'var(--danger-bg)',
          color: 'var(--danger)',
        }
      return {
        icon: 'fa-solid fa-clock-rotate-left',
        bg: 'var(--warning-bg)',
        color: 'var(--warning)',
      }
    }
    // Booking
    if (item.status === 'Checked-In')
      return { icon: 'fa-solid fa-qrcode', bg: 'var(--success-bg)', color: 'var(--success)' }
    if (item.status === 'Cancelled')
      return { icon: 'fa-solid fa-xmark', bg: 'var(--danger-bg)', color: 'var(--danger)' }
    return { icon: 'fa-solid fa-calendar-check', bg: 'var(--info-bg)', color: 'var(--info)' }
  }

  const displayedList = showAll ? recentActivity || [] : (recentActivity || []).slice(0, 5)

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ margin: 0 }}>Live Activity Log</h3>
        <span
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)' }}
          className="fw-semibold small"
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              background: 'var(--success)',
              borderRadius: '50%',
              boxShadow: '0 0 8px var(--success)',
            }}
          ></span>
          LIVE
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {displayedList && displayedList.length > 0 ? (
          displayedList.map((item, index) => {
            const { icon, bg, color } = getIconAndColor(item)
            return (
              <div
                key={item.id || index}
                onClick={() => setSelectedItem(item)}
                style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                  paddingBottom: index !== displayedList.length - 1 ? '20px' : '8px',
                  borderBottom:
                    index !== displayedList.length - 1 ? '1px solid var(--border-light)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: bg,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  className="fs-4 flex-shrink-0"
                >
                  <i className={icon}></i>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fw-bold">{item.title}</div>
                  <div style={{ color: 'var(--text-muted)' }} className="fw-medium small">
                    {item.subtitle} • {timeAgo(item.timestamp)}
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right text-muted small"></i>
              </div>
            )
          })
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No recent activity</div>
        )}
      </div>

      {recentActivity && recentActivity.length > 5 && (
        <div
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-light)',
            textAlign: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="btn btn-link fw-bold text-primary text-decoration-none small p-0"
          >
            {showAll ? 'Collapse Activity Logs' : 'View Full Activity Logs'}{' '}
            <i className={`fa-solid ${showAll ? 'fa-chevron-up' : 'fa-arrow-right'} ms-1`}></i>
          </button>
        </div>
      )}

      {/* Activity Detail Modal Popup */}
      {selectedItem && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Activity Log Details</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedItem(null)}
                ></button>
              </div>
              <div className="modal-body py-4">
                <div className="p-3 bg-light rounded-3 mb-3">
                  <div className="fw-bold fs-5 mb-1">{selectedItem.title}</div>
                  <div className="text-muted small">{selectedItem.subtitle}</div>
                </div>
                <div className="d-flex flex-column gap-2 small">
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Status</span>
                    <span className="fw-bold text-primary">
                      {selectedItem.status || 'Processed'}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Timestamp</span>
                    <span className="fw-semibold">
                      {selectedItem.timestamp
                        ? new Date(selectedItem.timestamp).toLocaleString()
                        : 'Just now'}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted">Activity ID</span>
                    <span className="fw-mono text-muted">{selectedItem.id || 'LOG-ACT-101'}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  className="btn btn-secondary w-100 fw-semibold"
                  onClick={() => setSelectedItem(null)}
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecentActivityWidget
