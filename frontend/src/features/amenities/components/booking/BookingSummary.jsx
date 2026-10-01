import React, { memo } from 'react'
import { CCard, CCardBody, CRow, CCol, CButton } from '@coreui/react'
import BookingPricing from './BookingPricing.jsx'
import { getAmenityImagePlaceholder } from '../../utils/amenityUtils.js'

const BookingSummary = memo(({ amenity, draft, onConfirm, onBack }) => {
  if (!amenity) return null

  return (
    <CCard
      className="border-0 shadow-sm mb-4"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.96)), url(${amenity.image || getAmenityImagePlaceholder(amenity.name)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <CCardBody className="p-4">
        <h5 className="mb-4">Review Your Booking</h5>

        <CRow className="g-4">
          <CCol xs={12} lg={7}>
            <div className="mb-4">
              <h4 className="fw-bold">{amenity.name}</h4>
              <p className="text-muted mb-0">
                <i className="fa-solid fa-location-dot me-2"></i>
                {amenity.location}
              </p>
            </div>

            <div className="d-flex mb-4">
              <div className="me-5">
                <p className="text-uppercase text-muted small fw-bold mb-1">Date</p>
                <p className="fs-5">{draft.bookingDate}</p>
              </div>
              <div>
                <p className="text-uppercase text-muted small fw-bold mb-1">Time</p>
                <p className="fs-5">
                  {draft.startTime} - {draft.endTime}
                </p>
                {amenity?.pricing?.pricingType === 'daily' ? (
                  <p className="text-muted small mt-1">Duration: Full Day</p>
                ) : (
                  <p className="text-muted small mt-1">
                    Duration:{' '}
                    {(() => {
                      if (!draft.startTime || !draft.endTime) return ''
                      const parseTime = (timeStr) => {
                        const [time, modifier] = timeStr.split(' ')
                        let [hours, minutes] = time.split(':').map(Number)
                        if (modifier === 'PM' && hours < 12) hours += 12
                        if (modifier === 'AM' && hours === 12) hours = 0
                        return hours * 60 + minutes
                      }
                      try {
                        const startMins = parseTime(draft.startTime)
                        const endMins = parseTime(draft.endTime)
                        let diff = endMins - startMins
                        if (diff < 0) diff += 24 * 60
                        return `${diff} Minutes`
                      } catch (e) {
                        return ''
                      }
                    })()}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <h6 className="fw-bold text-uppercase text-muted mb-2">Booking Rules</h6>
              <ul className="small text-muted ps-3 mb-0">
                <li>Cancellation must be made 24 hours in advance for a full refund.</li>
                <li>
                  Please adhere to the maximum capacity of {amenity.capacity || 'N/A'} persons.
                </li>
                {/* Real rules would map here */}
              </ul>
            </div>
          </CCol>

          <CCol xs={12} lg={5}>
            <BookingPricing draft={draft} />
          </CCol>
        </CRow>

        <div className="d-flex justify-content-end pt-4 mt-2 border-top">
          <CButton color="primary" onClick={onConfirm} className="px-5 rounded-pill shadow-sm">
            Book Now <i className="fa-solid fa-check ms-2"></i>
          </CButton>
        </div>
      </CCardBody>
    </CCard>
  )
})

export default BookingSummary
