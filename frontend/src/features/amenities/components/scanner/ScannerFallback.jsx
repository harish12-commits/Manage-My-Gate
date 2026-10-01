import React, { useState, memo } from 'react'
import { CInputGroup, CFormInput, CButton, CForm } from '@coreui/react'

const ScannerFallback = memo(({ onSubmit }) => {
  const [bookingId, setBookingId] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (bookingId.trim()) {
      onSubmit(bookingId.trim())
      setBookingId('')
    }
  }

  return (
    <div className="mt-4 p-4 bg-body-secondary rounded shadow-sm text-center">
      <h6 className="fw-bold mb-3 text-uppercase text-muted">Manual Entry</h6>
      <p className="small text-muted mb-3">
        If the QR scanner is not working, enter the Booking ID manually.
      </p>

      <CForm onSubmit={handleSubmit}>
        <div className="d-flex gap-2">
          <CFormInput
            placeholder="Enter Booking ID..."
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
          />
          <CButton
            type="submit"
            color="primary"
            disabled={!bookingId.trim()}
            className="px-4 fw-semibold"
          >
            Verify
          </CButton>
        </div>
      </CForm>
    </div>
  )
})

export default ScannerFallback
