import React, { useEffect } from 'react'
import AmenitiesTopNav from '../components/AmenitiesTopNav.jsx'
import useResidentHistory from '../hooks/useResidentHistory.js'
import { CCard, CCardBody } from '@coreui/react'
import CancelBookingModal from '../components/booking/CancelBookingModal.jsx'
import { cancelBooking } from '../services/amenityBookingApi.js'
import toast from 'react-hot-toast'
import '../styles/_amenities.scss'
import AppLoader from '../../../components/common/AppLoader'

const calculateDuration = (start, end) => {
  if (!start || !end) return ''
  const parseTime = (timeStr) => {
    const [time, modifier] = timeStr.split(' ')
    let [hours, minutes] = time.split(':').map(Number)
    if (modifier === 'PM' && hours < 12) hours += 12
    if (modifier === 'AM' && hours === 12) hours = 0
    return hours * 60 + minutes
  }
  try {
    const startMins = parseTime(start)
    const endMins = parseTime(end)
    let diff = endMins - startMins
    if (diff < 0) diff += 24 * 60
    return `${diff} Mins`
  } catch (e) {
    return ''
  }
}

const ResidentHistoryView = () => {
  const { bookings, loading, error, loadBookings } = useResidentHistory()
  const [bookingToCancel, setBookingToCancel] = React.useState(null)
  const [isCancelling, setIsCancelling] = React.useState(false)

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return <span className="badge badge-success">Confirmed</span>
      case 'completed':
        return <span className="badge badge-secondary">Completed</span>
      case 'checked-in':
        return <span className="badge badge-info">Checked In</span>
      case 'pending':
        return <span className="badge badge-warning text-body">Pending</span>
      case 'cancelled':
        return <span className="badge badge-danger">Cancelled</span>
      default:
        return <span className="badge badge-secondary text-capitalize">{status}</span>
    }
  }

  const getEntryStatusBadge = (status, qrStatus) => {
    if (qrStatus === 'expired') return <span className="badge badge-danger">Expired</span>
    switch (status) {
      case 'checked-in':
        return <span className="badge badge-info">Entered</span>
      case 'completed':
        return <span className="badge badge-secondary">Completed</span>
      case 'cancelled':
        return <span className="badge badge-danger">Cancelled</span>
      default:
        return <span className="badge badge-warning text-body">Not Entered</span>
    }
  }

  const getQrStatusBadge = (qrStatus, status) => {
    if (status === 'cancelled') return <span className="badge badge-danger">Revoked</span>
    switch (qrStatus) {
      case 'active':
        return <span className="badge badge-success">Active</span>
      case 'expired':
        return <span className="badge badge-danger">Expired</span>
      case 'revoked':
        return <span className="badge badge-danger">Revoked</span>
      default:
        return <span className="badge badge-secondary">{qrStatus || 'N/A'}</span>
    }
  }

  const getPaymentStatusBadge = (status, bookingStatus) => {
    if (['success', 'completed', 'paid'].includes(status))
      return <span className="badge badge-success text-white">Paid</span>
    if (status === 'failed') return <span className="badge badge-danger text-white">Failed</span>
    if (status === 'refunded') return <span className="badge badge-info text-white">Refunded</span>
    if (status === 'partial_refund')
      return <span className="badge bg-purple text-white">Partial Refund</span>

    // Inference for missing or pending
    if (bookingStatus === 'confirmed')
      return <span className="badge badge-success text-white">Paid</span>
    if (bookingStatus === 'cancelled')
      return <span className="badge badge-info text-white">Refunded</span>

    return <span className="badge badge-warning text-body">Unpaid</span>
  }

  const handleConfirmCancel = async (bookingId, reason) => {
    setIsCancelling(true)
    try {
      await cancelBooking(bookingId, reason)
      toast.success('Booking cancelled successfully.')
      setBookingToCancel(null)
      loadBookings()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to cancel booking')
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <>
      <div className="amenities-module-wrapper amenity-os-theme">
        <AmenitiesTopNav />
        <div className="view-container">
          <div className="view active" id="view-resident-history">
            <h2 style={{ marginBottom: '32px', marginTop: 0 }} className="fs-2">
              Booking History
            </h2>

            {loading && bookings.length === 0 ? (
              <div className="d-flex justify-content-center p-5">
                <AppLoader variant="block" />
              </div>
            ) : error ? (
              <div className="alert alert-danger">{error}</div>
            ) : bookings.length === 0 ? (
              <CCard className="border-0 shadow-sm text-center py-5">
                <CCardBody>
                  <i className="fa-regular fa-calendar-xmark fa-3x text-muted mb-3 opacity-50"></i>
                  <h4 className="fw-bold">No History Found</h4>
                  <p className="text-muted small">You haven't made any bookings yet.</p>
                </CCardBody>
              </CCard>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="ent-table align-middle">
                    <thead>
                      <tr>
                        <th>Booking ID</th>
                        <th>Amenity</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Booking Status</th>
                        <th>Entry Status</th>
                        <th>Check In / Out</th>
                        <th>Payment Status</th>
                        <th>QR Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr key={booking._id} id={`res-booking-row-${booking._id}`}>
                          <td style={{ color: 'var(--primary)' }} className="fw-bold">
                            {booking.bookingId || booking._id.substring(0, 8).toUpperCase()}
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-3">
                              <img
                                src={
                                  booking.amenityId?.images?.[0] || 'https://via.placeholder.com/40'
                                }
                                alt={booking.amenityId?.name}
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  objectFit: 'cover',
                                  borderRadius: '8px',
                                }}
                              />
                              <span className="fw-bold">
                                {booking.amenityId?.name || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="fw-semibold">{booking.bookingDate}</td>
                          <td className="fw-semibold">
                            {booking.startTime} - {booking.endTime}
                          </td>
                          <td>{getStatusBadge(booking.status)}</td>
                          <td>{getEntryStatusBadge(booking.status, booking.qrStatus)}</td>
                          <td>
                            {booking.checkInTime ? (
                              <div>
                                <span className="text-muted">In:</span>{' '}
                                {new Date(booking.checkInTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            ) : (
                              '-'
                            )}
                            {booking.checkOutTime ? (
                              <div>
                                <span className="text-muted">Out:</span>{' '}
                                {new Date(booking.checkOutTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            ) : (
                              ''
                            )}
                          </td>
                          <td>{getPaymentStatusBadge(booking.paymentStatus, booking.status)}</td>
                          <td>{getQrStatusBadge(booking.qrStatus, booking.status)}</td>
                          <td>
                            {['pending', 'confirmed'].includes(booking.status) && (
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => setBookingToCancel(booking)}
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <CancelBookingModal
        visible={!!bookingToCancel}
        onClose={() => setBookingToCancel(null)}
        onConfirm={handleConfirmCancel}
        booking={bookingToCancel}
        isSubmitting={isCancelling}
      />
    </>
  )
}

export default ResidentHistoryView
