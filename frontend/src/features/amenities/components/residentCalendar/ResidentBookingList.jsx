import React from 'react'
import { CPlaceholder } from '@coreui/react'
import AmenityStatusBadge from '../AmenityStatusBadge.jsx'
import { formatCurrency, getAmenityImagePlaceholder } from '../../utils/amenityUtils.js'

const PAYMENT_BADGE = {
  paid: { bg: '#D1FAE5', color: '#059669', label: 'Paid' },
  pending: { bg: '#FEF3C7', color: '#B45309', label: 'Pending' },
  failed: { bg: '#FEE2E2', color: '#DC2626', label: 'Failed' },
}

const BookingSkeleton = () => (
  <div
    style={{
      borderRadius: '16px',
      overflow: 'hidden',
      border: '1px solid #E2E8F0',
      background: '#fff',
      display: 'flex',
      flexDirection: 'row',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}
  >
    <CPlaceholder animation="glow" style={{ width: '180px', minHeight: '150px', flexShrink: 0 }} />
    <div
      style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      <CPlaceholder animation="glow" xs={7} size="lg" />
      <CPlaceholder animation="glow" xs={4} />
      <CPlaceholder animation="glow" xs={9} />
    </div>
  </div>
)

const ResidentBookingList = ({ events, onEventClick, onBookClick, loading }) => {
  if (loading) {
    return (
      <div className="rbl-wrapper">
        <div className="rbl-heading">All Bookings</div>
        <div className="rbl-grid">
          {[1, 2, 3].map((i) => (
            <BookingSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (!events || events.length === 0) {
    return null
  }

  return (
    <div className="rbl-wrapper">
      <div className="rbl-heading-row">
        <div className="rbl-heading">All Bookings</div>
        <span className="rbl-count">
          {events.length} booking{events.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="rbl-grid">
        {events.map((event) => {
          const payment = PAYMENT_BADGE[event.paymentStatus] || PAYMENT_BADGE.pending
          const dateLabel = new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })

          return (
            <div key={event.id} className="rbl-card" onClick={() => onEventClick(event)}>
              {/* Image */}
              <div
                className="rbl-card__image"
                style={{
                  backgroundImage: `url(${event.image || getAmenityImagePlaceholder(event.amenityName)})`,
                }}
              />

              {/* Body */}
              <div className="rbl-card__body">
                <div className="rbl-card__header">
                  <h5 className="rbl-card__amenity">{event.amenityName}</h5>
                  <div className="rbl-card__badges">
                    <AmenityStatusBadge status={event.status} />
                    <span
                      className="rbl-payment-badge"
                      style={{ background: payment.bg, color: payment.color }}
                    >
                      {payment.label}
                    </span>
                  </div>
                </div>

                <div className="rbl-card__id">Booking #{event.bookingId?.toString().slice(-8)}</div>

                <div className="rbl-card__meta">
                  <div className="rbl-meta-item">
                    <i className="fa-regular fa-calendar"></i>
                    <span>{dateLabel}</span>
                  </div>
                  <div className="rbl-meta-item">
                    <i className="fa-regular fa-clock"></i>
                    <span>
                      {event.start} – {event.end}
                    </span>
                  </div>
                  <div className="rbl-meta-item">
                    <i className="fa-regular fa-hourglass-half"></i>
                    <span>
                      {event.duration} hr{event.duration !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="rbl-meta-item rbl-meta-item--price">
                    <i className="fa-solid fa-tag"></i>
                    <span>{formatCurrency(event.price)}</span>
                  </div>
                </div>

                <div className="rbl-card__footer">
                  <div className="rbl-qr-status">
                    {event.qrCode ? (
                      <span className="rbl-qr-status--ready">
                        <i className="fa-solid fa-qrcode"></i> QR Ready
                      </span>
                    ) : (
                      <span className="rbl-qr-status--pending">
                        <i className="fa-regular fa-clock"></i> QR Pending
                      </span>
                    )}
                  </div>
                  <span className="rbl-view-link">
                    View Details <i className="fa-solid fa-arrow-right"></i>
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ResidentBookingList
