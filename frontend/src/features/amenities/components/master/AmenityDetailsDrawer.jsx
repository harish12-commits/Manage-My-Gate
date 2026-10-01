import React from 'react'

import AmenityStatusBadge from '../AmenityStatusBadge.jsx'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const AmenityDetailsDrawer = ({ visible, onClose, amenity }) => {
  if (!amenity) return null

  const imageUrl =
    amenity.images && amenity.images.length > 0
      ? amenity.images[0]
      : 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=800&q=80'
  const rate =
    amenity.pricing?.baseRate ?? amenity.pricingConfig?.baseRate ?? amenity.ratePerHour ?? 0
  const pricingType = amenity.pricing?.pricingType || amenity.pricingConfig?.pricingType || 'hourly'
  const deposit = amenity.pricing?.securityDeposit ?? amenity.pricingConfig?.securityDeposit ?? 0

  return (
    <div
      className="modal-overlay active amenity-os-theme"
      style={{ display: visible ? 'flex' : 'none' }}
      onClick={onClose}
    >
      <div className="modal-box" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0 }} className="fs-4">
            Amenity Details
          </h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="modal-body" style={{ padding: '24px 28px' }}>
          <div style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden' }}>
            <img
              src={imageUrl}
              alt={amenity.name}
              style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '20px',
              gap: '12px',
            }}
          >
            <h4 style={{ margin: 0 }} className="fs-4">
              {amenity.name}
            </h4>
            <AmenityStatusBadge status={amenity.status} />
          </div>

          {amenity.description && (
            <p
              style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '20px' }}
              className="small"
            >
              {amenity.description}
            </p>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '140px 1fr',
              gap: '12px 16px',
              marginBottom: '24px',
            }}
          >
            <div style={{ color: 'var(--text-muted)' }} className="fw-semibold small">
              Category
            </div>
            <div className="fw-semibold small">
              {amenity.category || amenity.type || amenity.archetype || 'N/A'}
            </div>

            <div style={{ color: 'var(--text-muted)' }} className="fw-semibold small">
              Location
            </div>
            <div className="fw-semibold small">{amenity.location || 'N/A'}</div>

            <div style={{ color: 'var(--text-muted)' }} className="fw-semibold small">
              Capacity
            </div>
            <div className="fw-semibold small">
              {amenity.capacity ?? amenity.maxCapacity ?? 'N/A'}
            </div>

            <div style={{ color: 'var(--text-muted)' }} className="fw-semibold small">
              Pricing
            </div>
            <div className="fw-semibold small">
              ₹{rate.toLocaleString()} ({pricingType})
            </div>

            <div style={{ color: 'var(--text-muted)' }} className="fw-semibold small">
              Security Deposit
            </div>
            <div className="fw-semibold small">
              ₹{deposit.toLocaleString()}
              {amenity.pricing?.securityDepositDescription && (
                <div
                  className="text-muted"
                  style={{ fontSize: '11px', marginTop: '2px', fontWeight: 'normal' }}
                >
                  {amenity.pricing.securityDepositDescription}
                </div>
              )}
            </div>
          </div>

          <div
            style={{ height: '1px', background: 'var(--border-light)', margin: '0 0 20px' }}
          ></div>

          <h6
            style={{ color: 'var(--primary)', marginBottom: '12px', textTransform: 'uppercase' }}
            className="fw-bold small"
          >
            Booking Rules
          </h6>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 16px' }}>
            <div style={{ color: 'var(--text-muted)' }} className="fw-semibold small">
              Operating Hours
            </div>
            <div className="fw-semibold small">
              {amenity.bookingRules?.openTime || '08:00'} –{' '}
              {amenity.bookingRules?.closeTime || '21:00'}
            </div>

            <div style={{ color: 'var(--text-muted)' }} className="fw-semibold small">
              Slot Duration
            </div>
            <div className="fw-semibold small">
              {amenity.bookingRules?.slotDurationMinutes || 60} mins
            </div>

            <div style={{ color: 'var(--text-muted)' }} className="fw-semibold small">
              Max Advance Booking
            </div>
            <div className="fw-semibold small">
              {amenity.bookingRules?.advanceBookingDays || 7} Days
            </div>

            <div style={{ color: 'var(--text-muted)' }} className="fw-semibold small">
              Max Bookings/Slot
            </div>
            <div className="fw-semibold small">{amenity.maxBookingsPerUserPerSlot || 2}</div>

            {amenity.openDays && (
              <>
                <div style={{ color: 'var(--text-muted)' }} className="fw-semibold small">
                  Open Days
                </div>
                <div className="fw-semibold small">
                  {amenity.openDays.map((d) => DAYS[d]?.substring(0, 3)).join(', ')}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AmenityDetailsDrawer
