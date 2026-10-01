import React, { memo, useState, useEffect } from 'react'
import { CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter, CButton } from '@coreui/react'
import { formatCurrency } from '../../utils/amenityUtils.js'
import AppLoader from '../../../../components/common/AppLoader'

const BookingConfirmationModal = memo(
  ({ visible, onClose, onConfirm, isSubmitting, draft, amenity }) => {
    const [numberOfPersons, setNumberOfPersons] = useState(1)
    const maxSpots = amenity?.maxBookingsPerUserPerSlot || amenity?.maxBookingsPerUserPerSlot || 2
    const myCount = draft.myBookingsCount || 0
    const maxAllowed = Math.max(1, maxSpots - myCount)

    useEffect(() => {
      if (visible) setNumberOfPersons(1)
    }, [visible])

    const isDaily = amenity?.pricing?.pricingType === 'daily'
    const baseAmount = isDaily
      ? amenity?.pricing?.baseRate || 0
      : draft.baseAmount || draft.price || 0
    const tax = draft.tax || 0
    const deposit = isDaily ? amenity?.pricing?.securityDeposit || 0 : draft.deposit || 0

    const totalBase = baseAmount * (isDaily ? 1 : numberOfPersons)
    const totalTax = tax * (isDaily ? 1 : numberOfPersons)
    const finalTotal = totalBase + totalTax + deposit
    return (
      <CModal visible={visible} onClose={isSubmitting ? undefined : onClose} backdrop="static">
        <CModalHeader closeButton={!isSubmitting}>
          <CModalTitle>Confirm Booking</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {isSubmitting ? (
            <div className="text-center py-4">
              <AppLoader variant="block" />
              <p className="mb-0 text-muted">Securing your slot...</p>
            </div>
          ) : (
            <div>
              <p>
                You are about to book <strong>{amenity?.name}</strong>.
              </p>
              <p className="mb-1">
                <strong>Date:</strong> {draft.bookingDate}
              </p>
              <p className="mb-1">
                <strong>Time:</strong> {draft.startTime} - {draft.endTime}{' '}
                {amenity?.pricing?.pricingType === 'daily'
                  ? '(Full Day)'
                  : `(${draft.duration} min)`}
              </p>
              <hr className="my-2" />
              {amenity?.pricing?.pricingType !== 'daily' && (
                <>
                  <div className="mb-2 d-flex justify-content-between align-items-center">
                    <span>
                      <strong>Number of Persons:</strong>
                    </span>
                    <input
                      type="number"
                      className="form-control text-end"
                      style={{ width: '80px', padding: '4px 8px' }}
                      value={numberOfPersons}
                      min="1"
                      max={maxAllowed}
                      onChange={(e) => {
                        let val = parseInt(e.target.value, 10)
                        if (isNaN(val) || val < 1) val = 1
                        if (val > maxAllowed) val = maxAllowed
                        setNumberOfPersons(val)
                      }}
                      disabled={isSubmitting}
                    />
                  </div>
                  <p className="mb-1 d-flex justify-content-between text-muted small">
                    <span>Max allowed (remaining): {maxAllowed}</span>
                  </p>
                  <hr className="my-2" />
                </>
              )}
              <p className="mb-1 d-flex justify-content-between">
                <span>Base Amount:</span> <span>{formatCurrency(totalBase)}</span>
              </p>
              <p className="mb-1 d-flex justify-content-between">
                <span>Tax:</span> <span>{formatCurrency(totalTax)}</span>
              </p>
              <p className="mb-1 d-flex justify-content-between">
                <span>Security Deposit:</span> <span>{formatCurrency(deposit)}</span>
              </p>
              {amenity?.pricing?.securityDepositDescription && (
                <p
                  className="mb-1 text-muted small"
                  style={{ fontSize: '0.8rem', marginTop: '-4px' }}
                >
                  {amenity.pricing.securityDepositDescription}
                </p>
              )}
              <hr className="my-2" />
              <p className="mb-0 d-flex justify-content-between">
                <strong>Total Amount:</strong> <strong>{formatCurrency(finalTotal)}</strong>
              </p>
            </div>
          )}
        </CModalBody>
        {!isSubmitting && (
          <CModalFooter>
            <CButton color="secondary" variant="ghost" onClick={onClose}>
              Cancel
            </CButton>
            <CButton color="primary" onClick={() => onConfirm(numberOfPersons)}>
              Confirm & Pay
            </CButton>
          </CModalFooter>
        )}
      </CModal>
    )
  },
)

export default BookingConfirmationModal
