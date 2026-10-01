import React, { memo, useState, useEffect } from 'react'
import { CModal, CModalHeader, CModalTitle, CModalBody, CSpinner } from '@coreui/react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchAllAmenitySlots } from '../../store/amenitySlice.js'
import { useTranslation } from 'react-i18next'

const ResidentBookingModal = memo(({ visible, onClose, amenities, onSlotSelect }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { allSlots, slotsLoading } = useSelector((state) => state.amenities)

  const [selectedDate, setSelectedDate] = useState('')
  const [selectedAmenityId, setSelectedAmenityId] = useState('')

  const activeAmenities = amenities.filter((a) => a.status === 'active')

  // Set default date to today when opened
  useEffect(() => {
    if (visible && !selectedDate) {
      const today = new Date()
      const localDateStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0]
      setSelectedDate(localDateStr)
    }
  }, [visible, selectedDate])

  // Fetch slots whenever date or amenity changes
  useEffect(() => {
    if (visible && selectedDate && selectedAmenityId) {
      dispatch(fetchAllAmenitySlots({ id: selectedAmenityId, date: selectedDate }))
    }
  }, [visible, selectedDate, selectedAmenityId, dispatch])

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available':
        return 'var(--success)'
      case 'Booked':
        return 'var(--danger)'
      case 'Maintenance':
        return 'var(--warning)'
      case 'Closed':
      default:
        return 'var(--secondary)'
    }
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Available':
        return 'badge-success'
      case 'Booked':
        return 'badge-danger'
      case 'Maintenance':
        return 'badge-warning'
      case 'Closed':
      default:
        return 'badge-secondary'
    }
  }

  const selectedAmenity = activeAmenities.find((a) => a._id === selectedAmenityId)
  const maxLimit = selectedAmenity?.maxBookingsPerUserPerSlot || 2
  const userBooked = selectedAmenity?.userBookedSlotsCount || 0 // Backend still provides this? Let's leave for now.
  const remaining = Math.max(0, maxLimit - userBooked)
  const hasReachedLimit = remaining <= 0
  const isDaily = selectedAmenity?.pricing?.pricingType === 'daily'

  const handleSlotClick = (slot) => {
    if (slot.status === 'Available' && !hasReachedLimit) {
      onSlotSelect(selectedAmenityId, selectedDate, slot)
      onClose() // Close this modal so they proceed to confirmation
    }
  }

  return (
    <CModal
      visible={visible}
      onClose={onClose}
      alignment="center"
      size="lg"
      className="amenity-os-theme"
    >
      <CModalHeader>
        <CModalTitle>Book an Amenity</CModalTitle>
      </CModalHeader>
      <CModalBody style={{ minHeight: '300px' }}>
        <div className="mb-4">
          <label className="fw-medium form-label">Select Date</label>
          <input
            type="date"
            className="form-control"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              borderRadius: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              maxWidth: '250px',
            }}
          />
        </div>

        <div className="mb-4">
          <label className="fw-medium form-label mb-2">Select Amenity</label>
          <select
            className="form-control mb-3"
            value={selectedAmenityId}
            onChange={(e) => setSelectedAmenityId(e.target.value)}
            style={{
              borderRadius: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              maxWidth: '300px',
            }}
          >
            <option value="">-- Choose Amenity --</option>
            {activeAmenities.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>

          <div className="d-flex flex-wrap gap-2">
            {activeAmenities.map((a) => (
              <button
                key={a._id}
                onClick={() => setSelectedAmenityId(a._id)}
                className={`btn btn-sm rounded-pill px-3 py-2 d-flex align-items-center gap-2 ${selectedAmenityId === a._id ? 'btn-primary shadow-sm' : 'btn-outline-secondary'}`}
                style={{
                  backgroundColor: selectedAmenityId !== a._id ? 'var(--bg-secondary)' : '',
                  border: selectedAmenityId === a._id ? 'none' : '1px solid var(--border-light)',
                  transition:
                    'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                  fontWeight: selectedAmenityId === a._id ? '600' : '400',
                }}
              >
                {a.name}
              </button>
            ))}
            {activeAmenities.length === 0 && (
              <span className="text-muted small">No amenities available</span>
            )}
          </div>
        </div>

        {selectedAmenityId && selectedDate && (
          <div>
            {isDaily ? (
              slotsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <CSpinner size="sm" />
                </div>
              ) : (
                <div className="alert alert-success d-flex flex-column gap-3">
                  <div className="d-flex align-items-center mb-2">
                    <i className="fa-solid fa-clock me-2"></i>
                    <strong>
                      Operating Hours: {selectedAmenity.bookingRules?.openTime} -{' '}
                      {selectedAmenity.bookingRules?.closeTime}
                    </strong>
                  </div>
                  <div className="d-flex align-items-center mb-3">
                    <i className="fa-solid fa-money-bill me-2"></i>
                    <strong>Daily Price: {selectedAmenity.pricing?.baseRate || 0}</strong>
                  </div>
                  {allSlots && allSlots[0] && allSlots[0].status !== 'Available' ? (
                    <div className="text-danger small">
                      <i className="fa-solid fa-triangle-exclamation me-1"></i>
                      {t(
                        'This amenity is not available or already fully booked for the selected date.',
                        'This amenity is not available or already fully booked for the selected date.',
                      )}
                    </div>
                  ) : (
                    <div className="text-end">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          onSlotSelect(selectedAmenityId, selectedDate, {
                            startTime: selectedAmenity.bookingRules?.openTime,
                            endTime: selectedAmenity.bookingRules?.closeTime,
                            status: 'Available',
                          })
                          onClose()
                        }}
                      >
                        {t('Confirm Booking', 'Confirm Booking')}
                      </button>
                    </div>
                  )}
                </div>
              )
            ) : (
              <>
                <div className="alert alert-info py-2 small mb-3 d-flex align-items-center gap-2">
                  <i className="fa-solid fa-circle-info"></i>
                  <span>
                    <strong>Slot Limit:</strong> {maxLimit} spots per slot.
                  </span>
                </div>
                <h6 style={{ color: 'var(--text-muted)', marginBottom: '12px' }} className="small">
                  Available Slots
                </h6>
                {slotsLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <CSpinner size="sm" />
                  </div>
                ) : allSlots && allSlots.length > 0 ? (
                  <div>
                    {/* Legend */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '16px',
                        marginBottom: '16px',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                      }}
                      className="small"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: 'var(--success)',
                          }}
                        ></div>{' '}
                        Available
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: 'var(--danger)',
                          }}
                        ></div>{' '}
                        Booked
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: 'var(--warning)',
                          }}
                        ></div>{' '}
                        Maintenance
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: 'var(--secondary)',
                          }}
                        ></div>{' '}
                        Closed
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: '12px',
                      }}
                    >
                      {allSlots.map((slot, index) => {
                        const isAvailable = slot.status === 'Available' && !hasReachedLimit
                        return (
                          <div
                            key={index}
                            onClick={() => handleSlotClick(slot)}
                            style={{
                              padding: '12px 8px',
                              borderRadius: '8px',
                              border: `1px solid ${getStatusColor(slot.status)}`,
                              background: isAvailable ? 'transparent' : 'var(--bg-secondary)',
                              cursor: isAvailable ? 'pointer' : 'not-allowed',
                              opacity: isAvailable ? 1 : 0.6,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '6px',
                              transition:
                                'color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease, width 0.2s ease, height 0.2s ease, max-height 0.2s ease',
                            }}
                            className={isAvailable ? 'slot-hover' : ''}
                          >
                            <div className="fw-semibold small">{slot.startTime}</div>
                            <span
                              className={`small badge ${getStatusBadgeClass(slot.status)}`}
                              style={{ padding: '4px 8px' }}
                            >
                              {hasReachedLimit && slot.status === 'Available'
                                ? 'Limit Reached'
                                : slot.status}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      padding: '40px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                    }}
                    className="small"
                  >
                    No slots generated for this date.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CModalBody>
      <style>{`
        .slot-hover:hover {
          background-color: rgba(40, 167, 69, 0.1) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
      `}</style>
    </CModal>
  )
})

export default ResidentBookingModal
