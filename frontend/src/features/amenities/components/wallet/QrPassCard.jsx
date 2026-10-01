import React, { memo } from 'react'
import { CCard, CCardBody, CRow, CCol } from '@coreui/react'
import QRCode from 'react-qr-code'

const QrPassCard = memo(({ booking, onCancel }) => {
  if (!booking) return null

  const formattedDate = booking.date
    ? new Date(booking.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  // Calculate duration if not provided
  let duration = '60 Minutes'
  if (booking.startTime && booking.endTime) {
    const start = new Date(`2000-01-01T${booking.startTime}`)
    const end = new Date(`2000-01-01T${booking.endTime}`)
    const diffMins = Math.round((end - start) / 60000)
    if (diffMins > 0) duration = `${diffMins} Minutes`
  }

  return (
    <CCard className="border-0 shadow-sm mb-4 overflow-hidden position-relative h-100">
      <div
        className="bg-primary position-absolute w-100"
        style={{ height: '110px', top: 0, left: 0, zIndex: 0 }}
      >
        {/* Decorative circles */}
        <div
          className="position-absolute rounded-circle bg-body opacity-10"
          style={{ width: '150px', height: '150px', top: '-40px', right: '-40px' }}
        ></div>
      </div>

      <CCardBody className="p-0 position-relative d-flex flex-column" style={{ zIndex: 1 }}>
        <div className="p-3 text-center text-white">
          <h5 className="fw-bold mb-1 opacity-75 text-uppercase" style={{ fontSize: '13px' }}>
            Digital Access Pass
          </h5>
          <div className="d-flex align-items-center justify-content-center gap-2 mt-1">
            {booking.amenityImage && (
              <img
                src={booking.amenityImage}
                alt={booking.amenityName}
                className="rounded-circle shadow-sm border border-white"
                style={{ width: '32px', height: '32px', objectFit: 'cover' }}
              />
            )}
            <h5 className="fw-bold mb-0">{booking.amenityName}</h5>
          </div>
        </div>

        <div
          className="bg-body p-3 mx-4 rounded shadow-sm text-center"
          style={{ marginTop: '-15px' }}
        >
          <div className="d-inline-block p-2 border rounded bg-body">
            {booking.qrPayload?.startsWith('data:image') ? (
              <img src={booking.qrPayload} alt="QR Code" width={120} height={120} />
            ) : (
              <QRCode
                value={booking.qrPayload || 'invalid'}
                size={120}
                bgColor="#ffffff"
                fgColor="#000000"
                level="Q"
              />
            )}
          </div>
          <div className="mt-2">
            <span className="small text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>
              Booking ID
            </span>
            <div className="fw-bold font-monospace" style={{ fontSize: '14px' }}>
              {booking.bookingId || 'N/A'}
            </div>
          </div>
        </div>

        <div className="p-3 flex-grow-1">
          <CRow className="g-2">
            <CCol xs={7}>
              <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '10px' }}>
                Valid On
              </div>
              <div className="fw-semibold" style={{ fontSize: '13px' }}>
                {formattedDate}
              </div>
            </CCol>
            <CCol xs={5} className="text-end">
              <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '10px' }}>
                Persons
              </div>
              <div className="fw-semibold" style={{ fontSize: '13px' }}>
                {booking.numberOfPersons || 1}
              </div>
            </CCol>
            <CCol xs={4}>
              <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '10px' }}>
                Entry
              </div>
              <div className="fw-semibold text-success" style={{ fontSize: '13px' }}>
                {booking.startTime}
              </div>
            </CCol>
            <CCol xs={4}>
              <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '10px' }}>
                Exit
              </div>
              <div className="fw-semibold text-danger" style={{ fontSize: '13px' }}>
                {booking.endTime}
              </div>
            </CCol>
            <CCol xs={4}>
              <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '10px' }}>
                Duration
              </div>
              <div className="fw-semibold" style={{ fontSize: '13px' }}>
                {duration}
              </div>
            </CCol>
            <CCol xs={12}>
              <hr className="my-1 text-muted opacity-25" />
            </CCol>
            <CCol xs={6}>
              <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '10px' }}>
                Payment
              </div>
              <span
                className={`badge ${booking.paymentStatus === 'success' ? 'bg-success' : 'bg-warning text-body'}`}
              >
                {booking.paymentStatus || 'Pending'}
              </span>
            </CCol>
            <CCol xs={6}>
              <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '10px' }}>
                Status
              </div>
              {(() => {
                if (booking.qrStatus === 'expired')
                  return <span className="badge bg-danger">Expired</span>
                if (booking.status === 'cancelled')
                  return <span className="badge bg-danger">Cancelled</span>
                if (booking.status === 'completed')
                  return <span className="badge bg-secondary">Completed</span>
                if (booking.status === 'checked-in')
                  return <span className="badge bg-success">In Use</span>
                if (booking.status === 'confirmed')
                  return <span className="badge bg-primary">Active</span>
                return <span className="badge bg-secondary">{booking.status || 'Unknown'}</span>
              })()}
            </CCol>
            {onCancel && (
              <CCol xs={12} className="mt-3">
                <button
                  className="btn btn-outline-danger btn-sm w-100 fw-bold"
                  onClick={() => onCancel(booking)}
                >
                  Cancel Booking
                </button>
              </CCol>
            )}
          </CRow>
        </div>

        {booking.qrStatus === 'expired' && (
          <div
            className="position-absolute w-100 h-100 d-flex justify-content-center align-items-center"
            style={{ top: 0, left: 0, background: 'rgba(255,255,255,0.7)', zIndex: 10 }}
          >
            <div
              className="badge bg-danger fs-4 shadow px-4 py-2"
              style={{ transform: 'rotate(-15deg)' }}
            >
              EXPIRED
            </div>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
})

export default QrPassCard
