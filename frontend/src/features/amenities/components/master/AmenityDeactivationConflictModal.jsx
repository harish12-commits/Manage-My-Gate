import React from 'react'

export const AmenityDeactivationConflictModal = ({
  visible,
  amenity,
  bookingsCount = 1,
  isLoading = false,
  onHonorExisting,
  onCancelAndRefund,
  onClose,
}) => {
  if (!visible || !amenity) return null

  return (
    <div className="modal-overlay active amenity-os-theme">
      <div className="modal-box" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h2 style={{ margin: 0 }} className="fs-4">
              Active Bookings Conflict
            </h2>
          </div>
          <button className="modal-close" onClick={onClose} disabled={isLoading}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div
          className="modal-body"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5' }}>
            <strong>{amenity.name}</strong> currently has{' '}
            <span style={{ color: '#d97706', fontWeight: 'bold' }}>
              {bookingsCount} upcoming confirmed booking{bookingsCount === 1 ? '' : 's'}
            </span>
            . How would you like to handle these existing reservations?
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Option 1: Honor Existing */}
            <div
              style={{
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                padding: '14px',
                background: 'rgba(59, 130, 246, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <i
                  className="fa-regular fa-calendar-check"
                  style={{ color: '#2563eb', marginTop: '3px', fontSize: '16px' }}
                ></i>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-main)' }}>
                    Honor Existing Bookings
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Deactivate facility for new reservations, but keep and honor all existing
                    scheduled bookings.
                  </div>
                </div>
              </div>
              <button
                className="btn"
                style={{
                  marginTop: '12px',
                  width: '100%',
                  background: '#2563eb',
                  color: 'white',
                  borderColor: '#2563eb',
                  fontSize: '13px',
                  padding: '8px',
                }}
                disabled={isLoading}
                onClick={onHonorExisting}
              >
                {isLoading ? 'Processing...' : 'Honor Existing & Deactivate'}
              </button>
            </div>

            {/* Option 2: Cancel & Refund */}
            <div
              style={{
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '14px',
                background: 'rgba(239, 68, 68, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <i
                  className="fa-solid fa-rotate-left"
                  style={{ color: '#dc2626', marginTop: '3px', fontSize: '16px' }}
                ></i>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-main)' }}>
                    Cancel & Refund All
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Cancel all {bookingsCount} upcoming bookings immediately and initiate 100% full
                    refunds to residents.
                  </div>
                </div>
              </div>
              <button
                className="btn"
                style={{
                  marginTop: '12px',
                  width: '100%',
                  background: '#dc2626',
                  color: 'white',
                  borderColor: '#dc2626',
                  fontSize: '13px',
                  padding: '8px',
                }}
                disabled={isLoading}
                onClick={onCancelAndRefund}
              >
                {isLoading ? 'Processing...' : 'Cancel, Refund & Deactivate'}
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-outline"
            onClick={onClose}
            disabled={isLoading}
            style={{ width: '100%' }}
          >
            Keep Facility Active (Cancel)
          </button>
        </div>
      </div>
    </div>
  )
}

export default AmenityDeactivationConflictModal
