import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CSpinner } from '@coreui/react'
import useResidentBooking from '../hooks/useResidentBooking.js'
import BookingStepper from '../components/booking/BookingStepper.jsx'
import DateSelector from '../components/booking/DateSelector.jsx'
import TimeSlotSelector from '../components/booking/TimeSlotSelector.jsx'
import BookingSummary from '../components/booking/BookingSummary.jsx'
import BookingConfirmationModal from '../components/booking/BookingConfirmationModal.jsx'
import BookingSuccess from '../components/booking/BookingSuccess.jsx'
import AmenitiesTopNav from '../components/AmenitiesTopNav.jsx'
import '../styles/_amenities.scss'
import AppLoader from '../../../components/common/AppLoader'

const ResidentBookingView = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [confirmationVisible, setConfirmationVisible] = useState(false)

  const {
    amenity,
    loading,
    slotsLoading,
    availableSlots,
    step,
    draft,
    errorMsg,
    paymentIntent,
    updateDraft,
    proceedToTime,
    proceedToReview,
    goBack,
    confirmBooking,
    processMockPayment,
    complete,
  } = useResidentBooking(id)

  if (loading && !amenity) {
    return (
      <div className="d-flex justify-content-center p-5">
        <AppLoader variant="block" />
      </div>
    )
  }

  if (!amenity && !loading) {
    return (
      <div
        className="amenities-module-wrapper amenity-os-theme"
        style={{ textAlign: 'center', padding: '64px' }}
      >
        <h4 style={{ color: 'var(--text-muted)' }}>Amenity not found</h4>
        <button
          className="btn btn-outline"
          style={{ marginTop: '16px' }}
          onClick={() => navigate('/resident/amenities/discover')}
        >
          Back to Discover
        </button>
      </div>
    )
  }

  const handleFinalConfirm = async (numberOfPersons = 1) => {
    await confirmBooking(numberOfPersons)
    setConfirmationVisible(false)
  }

  return (
    <div className="amenities-module-wrapper amenity-os-theme">
      <AmenitiesTopNav />
      <div className="view-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <button
            className="btn btn-outline"
            style={{
              border: 'none',
              background: 'transparent',
              padding: '0',
              color: 'var(--text-muted)',
            }}
            onClick={() => navigate('/resident/amenities/discover')}
          >
            <i className="fa-solid fa-arrow-left" style={{ marginRight: '8px' }}></i> Back to
            Amenities
          </button>
        </div>

        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <img
              src={amenity.images?.[0] || 'https://via.placeholder.com/150'}
              alt={amenity.name}
              style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '12px' }}
            />
            <div>
              <h4 style={{ marginBottom: '4px' }} className="fs-3">
                {amenity.name}
              </h4>
              <div
                style={{
                  color: 'var(--text-muted)',
                  display: 'flex',
                  gap: '16px',
                  flexWrap: 'wrap',
                  marginTop: '8px',
                }}
                className="small"
              >
                <span>
                  <i className="fa-solid fa-location-dot" style={{ marginRight: '6px' }}></i>{' '}
                  {amenity.location}
                </span>
                {amenity.bookingRules && amenity.bookingRules.openTime && (
                  <span>
                    <i className="fa-solid fa-clock" style={{ marginRight: '6px' }}></i>{' '}
                    {amenity.bookingRules.openTime} - {amenity.bookingRules.closeTime}
                  </span>
                )}
                {amenity.pricing && amenity.pricing.baseRate !== undefined && (
                  <span>
                    <i className="fa-solid fa-tag" style={{ marginRight: '6px' }}></i> $
                    {amenity.pricing.baseRate} / {amenity.pricing.pricingType || 'hour'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {step !== 'success' && <BookingStepper currentStep={step} />}

        {step === 'date' && (
          <DateSelector
            draft={draft}
            updateDraft={updateDraft}
            onNext={proceedToTime}
            errorMsg={errorMsg}
          />
        )}

        {step === 'time' && amenity?.pricing?.pricingType !== 'daily' && (
          <TimeSlotSelector
            draft={draft}
            availableSlots={availableSlots}
            slotsLoading={slotsLoading}
            updateDraft={updateDraft}
            onBack={goBack}
            errorMsg={errorMsg}
          />
        )}

        {step === 'time' && amenity?.pricing?.pricingType === 'daily' && (
          <div className="card p-4 mb-4">
            <h5 className="mb-3">Daily Booking Details</h5>
            <div className="alert alert-success d-flex flex-column gap-2 mb-0">
              <div className="d-flex align-items-center">
                <i className="fa-solid fa-clock me-2"></i>
                <strong>
                  Operating Hours: {amenity.bookingRules?.openTime} -{' '}
                  {amenity.bookingRules?.closeTime}
                </strong>
              </div>
              <div className="d-flex align-items-center">
                <i className="fa-solid fa-money-bill me-2"></i>
                <strong>Daily Price: {amenity.pricing?.baseRate || 0}</strong>
              </div>
            </div>
            <div className="d-flex justify-content-start pt-3 border-top mt-4">
              <button className="btn btn-outline-secondary px-4 rounded-pill" onClick={goBack}>
                <i className="fa-solid fa-arrow-left me-2"></i> Back
              </button>
            </div>
          </div>
        )}

        {step === 'time' && draft.startTime && draft.endTime && (
          <BookingSummary
            amenity={amenity}
            draft={draft}
            onConfirm={() => setConfirmationVisible(true)}
          />
        )}

        {step === 'submitting' && (
          <BookingSummary
            amenity={amenity}
            draft={draft}
            onConfirm={() => setConfirmationVisible(true)}
          />
        )}

        {step === 'payment' && (
          <div className="card p-5 text-center">
            <h4>Mock Payment Gateway</h4>
            <p className="text-muted">
              Simulate a payment for your booking of{' '}
              <strong>${paymentIntent?.amount || draft.totalPrice}</strong>
            </p>
            <div className="d-flex justify-content-center gap-3 mt-4">
              <button className="btn btn-outline-danger" onClick={() => processMockPayment(false)}>
                Simulate Failure
              </button>
              <button className="btn btn-primary" onClick={() => processMockPayment(true)}>
                Simulate Success
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <BookingSuccess amenity={amenity} draft={draft} onComplete={complete} />
        )}

        <BookingConfirmationModal
          visible={confirmationVisible}
          onClose={() => setConfirmationVisible(false)}
          onConfirm={handleFinalConfirm}
          isSubmitting={step === 'submitting'}
          draft={draft}
          amenity={amenity}
        />
      </div>
    </div>
  )
}

export default ResidentBookingView
