import React, { memo } from 'react'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CButton,
  CRow,
  CCol,
  CCard,
  CCardBody,
} from '@coreui/react'
import { useTranslation } from 'react-i18next'
import useAmenityPayment from '../../hooks/useAmenityPayment.js'
import AppLoader from '../../../../components/common/AppLoader'

const AmenityCheckoutModal = memo(
  ({ visible, paymentIntent, onSuccess, onFailure, onClose, draft, amenity }) => {
    const { t } = useTranslation()
    const { processPayment, loading } = useAmenityPayment()

    const handlePayNow = () => {
      if (!paymentIntent) return
      processPayment({
        paymentIntent,
        onSuccess,
        onFailure,
      })
    }

    const amount = paymentIntent?.amount || draft?.amount || 0

    const formattedDate = draft?.bookingDate
      ? new Date(draft.bookingDate + 'T00:00:00').toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : ''

    return (
      <CModal
        visible={visible}
        onClose={loading ? undefined : onClose}
        alignment="center"
        backdrop="static"
        size="lg"
      >
        <CModalHeader closeButton={!loading}>
          <CModalTitle>{t('checkout.modal_title', 'Secure Checkout')}</CModalTitle>
        </CModalHeader>
        <CModalBody className="py-4">
          {loading ? (
            <div className="text-center py-5">
              <AppLoader variant="block" />
              <p className="mb-0 text-muted">
                {t('checkout.processing', 'Processing payment order...')}
              </p>
            </div>
          ) : (
            <div>
              <h5 className="mb-4 text-center">
                {t('checkout.booking_summary_title', 'Confirm and Pay for Booking')}
              </h5>

              <CCard className="border-0 shadow-sm mb-4">
                <CCardBody className="p-4">
                  <CRow className="g-4 align-items-center">
                    <CCol md={4} className="text-center">
                      <img
                        src={amenity?.images?.[0] || 'https://via.placeholder.com/150'}
                        alt={amenity?.name}
                        className="img-fluid rounded shadow-sm"
                        style={{ maxHeight: '150px', objectFit: 'cover' }}
                      />
                      <h5 className="fw-bold mt-3 mb-0">{amenity?.name}</h5>
                    </CCol>

                    <CCol md={8}>
                      <CRow className="g-3">
                        <CCol xs={12}>
                          <div className="small text-muted text-uppercase fw-bold mb-1">
                            {t('checkout.date_label', 'Date')}
                          </div>
                          <div className="fw-semibold">{formattedDate}</div>
                        </CCol>
                        <CCol xs={6}>
                          <div className="small text-muted text-uppercase fw-bold mb-1">
                            {t('checkout.start_time_label', 'Start Time')}
                          </div>
                          <div className="fw-semibold">{draft?.startTime}</div>
                        </CCol>
                        <CCol xs={6}>
                          <div className="small text-muted text-uppercase fw-bold mb-1">
                            {t('checkout.end_time_label', 'End Time')}
                          </div>
                          <div className="fw-semibold">{draft?.endTime}</div>
                        </CCol>
                        <CCol xs={6}>
                          <div className="small text-muted text-uppercase fw-bold mb-1">
                            {t('checkout.duration_label', 'Duration')}
                          </div>
                          <div className="fw-semibold">
                            {draft?.duration || amenity?.bookingRules?.slotDurationMinutes || 60}{' '}
                            {t('checkout.minutes', 'Minutes')}
                          </div>
                        </CCol>
                        <CCol xs={6}>
                          <div className="small text-muted text-uppercase fw-bold mb-1">
                            {t('checkout.persons_label', 'Persons')}
                          </div>
                          <div className="fw-semibold">{draft?.numberOfPersons || 1}</div>
                        </CCol>

                        <CCol xs={12} className="border-top pt-3 mt-3">
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="small text-muted text-uppercase fw-bold">
                              {t('checkout.status_label', 'Status')}
                            </span>
                            <span className="badge bg-warning px-3 py-2 text-dark">
                              {t('checkout.status_pending', 'Pending Payment')}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between align-items-center mt-2">
                            <span className="small text-muted text-uppercase fw-bold">
                              {t('checkout.total_amount_label', 'Total Amount')}
                            </span>
                            <span className="fw-bold fs-5 text-success">₹{amount.toFixed(2)}</span>
                          </div>
                        </CCol>
                      </CRow>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>

              <div className="d-flex justify-content-center gap-3 mt-4">
                <CButton
                  color="secondary"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4"
                >
                  {t('checkout.cancel_btn', 'Cancel')}
                </CButton>
                <CButton
                  color="primary"
                  onClick={handlePayNow}
                  className="px-5 fw-semibold"
                  disabled={loading || !paymentIntent}
                >
                  {t('checkout.pay_now_btn', 'Pay with Razorpay')}
                </CButton>
              </div>
            </div>
          )}
        </CModalBody>
      </CModal>
    )
  },
)

export default AmenityCheckoutModal
