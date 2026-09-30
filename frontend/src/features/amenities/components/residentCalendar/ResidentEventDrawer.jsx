import React, { memo, useState } from 'react'
import {
  COffcanvas,
  COffcanvasHeader,
  COffcanvasTitle,
  COffcanvasBody,
  CCloseButton,
  CRow,
  CCol,
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CBadge,
} from '@coreui/react'
import AmenityStatusBadge from '../AmenityStatusBadge.jsx'
import { formatCurrency, formatTimeAMPM } from '../../utils/amenityUtils.js'
import AppLoader from '../../../../components/common/AppLoader'

const BookingTimeline = ({ status }) => {
  const steps = [
    { key: 'pending', label: 'Requested' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'checked-in', label: 'Active' },
    { key: 'completed', label: 'Completed' },
  ]

  const isCancelled = status === 'cancelled' || status === 'rejected'
  const getStepIndex = (s) => {
    if (isCancelled) return -1
    const map = { pending: 0, approved: 1, confirmed: 1, 'checked-in': 2, completed: 3 }
    return map[s] ?? 0
  }
  const currentIdx = getStepIndex(status)

  if (isCancelled) {
    return (
      <div className="d-flex align-items-center gap-2 py-2 text-danger small fw-bold">
        <i className="fa-solid fa-circle-xmark"></i> Booking {status}
      </div>
    )
  }

  return (
    <div className="d-flex align-items-center gap-2" style={{ overflowX: 'auto' }}>
      {steps.map((step, idx) => (
        <React.Fragment key={step.key}>
          <div className="d-flex flex-column align-items-center" style={{ minWidth: '60px' }}>
            <div
              className={`fw-bold small rounded-circle d-flex align-items-center justify-content-center`}
              style={{
                width: '28px',
                height: '28px',
                background: idx <= currentIdx ? 'var(--bs-primary, #0d6efd)' : '#dee2e6',
                color: 'white',
              }}
            >
              {idx <= currentIdx ? <i className="fa-solid fa-check"></i> : idx + 1}
            </div>
            <span
              className="small mt-1"
              style={{
                color: idx <= currentIdx ? 'var(--bs-primary, #0d6efd)' : '#6c757d',
                textAlign: 'center',
              }}
            >
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              style={{
                flex: 1,
                height: '2px',
                background: idx < currentIdx ? 'var(--bs-primary, #0d6efd)' : '#dee2e6',
                minWidth: '20px',
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

const ResidentEventDrawer = memo(({ visible, onClose, event, onCancel, onPayNow }) => {
  const [cancelModalVisible, setCancelModalVisible] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [qrExpanded, setQrExpanded] = useState(false)

  if (!event) return null

  const handleCancelClick = () => {
    setCancelError('')
    setCancelModalVisible(true)
  }

  const confirmCancel = async () => {
    setIsCancelling(true)
    setCancelError('')
    try {
      await onCancel(event.id)
      setCancelModalVisible(false)
      onClose()
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel booking. Please try again later.')
    } finally {
      setIsCancelling(false)
    }
  }

  const isCancellable =
    (event.status === 'pending' || event.status === 'confirmed' || event.status === 'approved') &&
    !!onCancel
  const isPending = event.status === 'pending'
  const isConfirmed = event.status === 'confirmed' || event.status === 'approved'
  const isCompleted = event.status === 'completed'
  const isCancelled = event.status === 'cancelled' || event.status === 'rejected'

  return (
    <>
      <COffcanvas
        placement="end"
        visible={visible}
        onHide={onClose}
        style={{ maxWidth: '440px', width: '100%' }}
      >
        <COffcanvasHeader className="bg-body-secondary border-bottom">
          <COffcanvasTitle className="fw-bold">Booking Details</COffcanvasTitle>
          <CCloseButton className="text-reset" onClick={onClose} />
        </COffcanvasHeader>
        <COffcanvasBody className="d-flex flex-column gap-4 pb-5">
          {/* Amenity Info */}
          <div className="d-flex gap-3 align-items-start">
            {event.image && (
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '12px',
                  backgroundImage: `url(${event.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  flexShrink: 0,
                  border: '1px solid #dee2e6',
                }}
              />
            )}
            <div>
              <h4 className="fw-bold mb-1">{event.amenityName}</h4>
              <div className="d-flex gap-2 flex-wrap">
                <AmenityStatusBadge status={event.status} />
                <CBadge
                  color={
                    event.paymentStatus === 'paid'
                      ? 'success'
                      : event.paymentStatus === 'failed'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {event.paymentStatus?.toUpperCase()}
                </CBadge>
              </div>
            </div>
          </div>

          {/* Booking Timeline */}
          <div className="bg-body-secondary p-3 rounded border">
            <div className="small text-muted text-uppercase fw-bold mb-3">Booking Progress</div>
            <BookingTimeline status={event.status} />
          </div>

          {/* Booking Information */}
          <div className="bg-body-secondary p-3 rounded border">
            <div className="small text-muted text-uppercase fw-bold mb-3">Booking Information</div>
            <CRow className="g-2">
              <CCol xs={12}>
                <div className="small text-muted">Booking ID</div>
                <div className="small fw-semibold" style={{ wordBreak: 'break-all' }}>
                  {event.bookingId || event.id}
                </div>
              </CCol>
              <CCol xs={12}>
                <div className="small text-muted">Date</div>
                <div className="fw-semibold">
                  {new Date(event.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </CCol>
              <CCol xs={6}>
                <div className="small text-muted">Start Time</div>
                <div className="fw-semibold">{formatTimeAMPM(event.start)}</div>
              </CCol>
              <CCol xs={6}>
                <div className="small text-muted">End Time</div>
                <div className="fw-semibold">{formatTimeAMPM(event.end)}</div>
              </CCol>
              <CCol xs={6}>
                <div className="small text-muted">Duration</div>
                <div className="fw-semibold">
                  {event.duration} hr{event.duration > 1 ? 's' : ''}
                </div>
              </CCol>
            </CRow>
          </div>

          {/* Payment Information */}
          <div className="bg-body-secondary p-3 rounded border">
            <div className="small text-muted text-uppercase fw-bold mb-3">Payment Information</div>
            <CRow className="g-2">
              <CCol xs={6}>
                <div className="small text-muted">Total Amount</div>
                <div className="fw-bold fs-5">{formatCurrency(event.price)}</div>
              </CCol>
              <CCol xs={6}>
                <div className="small text-muted">Payment Status</div>
                <CBadge
                  color={
                    event.paymentStatus === 'paid'
                      ? 'success'
                      : event.paymentStatus === 'failed'
                        ? 'danger'
                        : 'warning'
                  }
                  className="mt-1"
                >
                  {event.paymentStatus?.toUpperCase()}
                </CBadge>
              </CCol>
            </CRow>
          </div>

          {/* QR Code Section */}
          {(isConfirmed || isCompleted) && (
            <div className="bg-body-secondary p-3 rounded border text-center">
              <div className="small text-muted text-uppercase fw-bold mb-3">Access QR Pass</div>
              {event.qrCode ? (
                <>
                  <img
                    src={event.qrCode}
                    alt="QR Code"
                    style={{
                      width: qrExpanded ? '220px' : '150px',
                      height: qrExpanded ? '220px' : '150px',
                      cursor: 'pointer',
                      transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                    }}
                    onClick={() => setQrExpanded(!qrExpanded)}
                  />
                  <p className="text-muted small mt-2 mb-0">Scan at the amenity entrance</p>
                  <button
                    className="btn btn-link btn-sm"
                    onClick={() => setQrExpanded(!qrExpanded)}
                  >
                    {qrExpanded ? 'Shrink' : 'Expand'}
                  </button>
                </>
              ) : (
                <div className="text-muted small py-2">
                  <i className="fa-solid fa-spinner fa-spin me-2"></i> QR Pass is being generated...
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="d-grid gap-2 mt-auto">
            {isPending && (
              <>
                <CButton color="warning" className="fw-bold" onClick={() => onPayNow && onPayNow(event)}>
                  <i className="fa-solid fa-credit-card me-2"></i> Complete Payment
                </CButton>
                <CButton color="danger" variant="ghost" onClick={handleCancelClick}>
                  <i className="fa-solid fa-xmark me-2"></i> Cancel Booking
                </CButton>
              </>
            )}

            {isConfirmed && (
              <>
                {isCancellable && (
                  <CButton color="danger" variant="ghost" onClick={handleCancelClick}>
                    <i className="fa-solid fa-xmark me-2"></i> Cancel Booking
                  </CButton>
                )}
              </>
            )}

            {(isCompleted || isCancelled) && (
              <CButton color="secondary" variant="outline" onClick={onClose}>
                <i className="fa-solid fa-arrow-left me-2"></i> Back to Bookings
              </CButton>
            )}
          </div>
        </COffcanvasBody>
      </COffcanvas>

      {/* Cancellation Confirmation Modal */}
      <CModal
        visible={cancelModalVisible}
        onClose={isCancelling ? undefined : () => setCancelModalVisible(false)}
        backdrop="static"
      >
        <CModalHeader closeButton={!isCancelling}>
          <CModalTitle>Cancel Booking</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {isCancelling ? (
            <div className="text-center py-4">
              <AppLoader variant="block" />
              <p className="mb-0 text-muted">Cancelling your booking...</p>
            </div>
          ) : (
            <div>
              <p>
                Are you sure you want to cancel your booking for{' '}
                <strong>{event.amenityName}</strong> on <strong>{event.date}</strong>?
              </p>
              <p className="text-muted small mb-0">
                Depending on the amenity rules, deposits may not be fully refundable if cancelled
                within 24 hours.
              </p>
              {cancelError && <div className="alert alert-danger mt-3 mb-0">{cancelError}</div>}
            </div>
          )}
        </CModalBody>
        {!isCancelling && (
          <CModalFooter>
            <CButton color="secondary" variant="ghost" onClick={() => setCancelModalVisible(false)}>
              Keep Booking
            </CButton>
            <CButton color="danger" onClick={confirmCancel}>
              Confirm Cancellation
            </CButton>
          </CModalFooter>
        )}
      </CModal>
    </>
  )
})

export default ResidentEventDrawer
