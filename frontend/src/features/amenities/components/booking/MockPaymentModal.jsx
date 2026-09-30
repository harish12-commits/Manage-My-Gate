import React, { memo, useState, useEffect } from 'react'
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
  CFormSelect,
} from '@coreui/react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { simulatePayment } from '../../services/paymentApi.js'
import { fetchMyWallet } from '../../services/walletApi.js'
import AppLoader from '../../../../components/common/AppLoader'

const MockPaymentModal = memo(
  ({ visible, paymentIntent, onSuccess, onFailure, onClose, draft, amenity }) => {
    const { t } = useTranslation()
    const [isProcessing, setIsProcessing] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState('wallet')
    const [walletBalance, setWalletBalance] = useState(0)
    const [isFetchingWallet, setIsFetchingWallet] = useState(false)

    const user = useSelector((state) => state.auth?.user)

    useEffect(() => {
      if (visible) {
        const loadWallet = async () => {
          setIsFetchingWallet(true)
          try {
            const res = await fetchMyWallet()
            setWalletBalance(res?.balance || 0)
          } catch (err) {
            console.error('Failed to fetch wallet balance', err)
          } finally {
            setIsFetchingWallet(false)
          }
        }
        loadWallet()
      }
    }, [visible])

    const amount = paymentIntent?.amount || draft?.amount || 0
    const isInsufficientWallet = paymentMethod === 'wallet' && walletBalance < amount

    const processMockPayment = async (isSuccess) => {
      if (!paymentIntent) return
      if (isSuccess && isInsufficientWallet) return

      setIsProcessing(true)
      try {
        await simulatePayment(
          paymentIntent.paymentId,
          isSuccess,
          isSuccess ? null : 'Insufficient funds in mock bank',
          paymentMethod,
        )

        if (isSuccess) {
          toast.success('Booking Successfully')
          onSuccess()
        } else {
          toast.error('Payment failed!')
          if (onFailure) onFailure()
        }
      } catch (err) {
        toast.error(err.message || 'Payment simulation error')
      } finally {
        setIsProcessing(false)
      }
    }

    const formattedDate = draft?.bookingDate
      ? new Date(draft.bookingDate + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : ''

    return (
      <CModal
        visible={visible}
        onClose={isProcessing ? undefined : onClose}
        alignment="center"
        backdrop="static"
        size="lg"
      >
        <CModalHeader closeButton={!isProcessing}>
          <CModalTitle>Mock Payment Gateway</CModalTitle>
        </CModalHeader>
        <CModalBody className="py-4">
          {isProcessing || isFetchingWallet ? (
            <div className="text-center py-5">
              <AppLoader variant="block" />
              <p className="mb-0 text-muted">
                {isProcessing ? 'Processing your payment...' : 'Fetching wallet details...'}
              </p>
            </div>
          ) : (
            <div>
              <h5 className="mb-4 text-center">You are booking the following amenity</h5>

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
                            Resident
                          </div>
                          <div className="fw-semibold">{user?.name || 'Resident'}</div>
                        </CCol>
                        <CCol xs={12}>
                          <div className="small text-muted text-uppercase fw-bold mb-1">Date</div>
                          <div className="fw-semibold">{formattedDate}</div>
                        </CCol>
                        <CCol xs={6}>
                          <div className="small text-muted text-uppercase fw-bold mb-1">
                            Start Time
                          </div>
                          <div className="fw-semibold">{draft?.startTime}</div>
                        </CCol>
                        <CCol xs={6}>
                          <div className="small text-muted text-uppercase fw-bold mb-1">
                            End Time
                          </div>
                          <div className="fw-semibold">{draft?.endTime}</div>
                        </CCol>
                        <CCol xs={6}>
                          <div className="small text-muted text-uppercase fw-bold mb-1">
                            Duration
                          </div>
                          <div className="fw-semibold">
                            {amenity?.pricing?.pricingType === 'daily'
                              ? 'Full Day'
                              : `${draft?.duration || amenity?.bookingRules?.slotDurationMinutes || 60} Minutes`}
                          </div>
                        </CCol>
                        <CCol xs={6}>
                          <div className="small text-muted text-uppercase fw-bold mb-1">
                            Persons
                          </div>
                          <div className="fw-semibold">{draft?.numberOfPersons || 1}</div>
                        </CCol>
                        <CCol xs={12}>
                          <div className="small text-muted text-uppercase fw-bold mb-1">
                            Payment Method
                          </div>
                          <CFormSelect
                            size="sm"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                          >
                            <option value="wallet">
                              {t('payment.method.wallet', 'My Wallet')}
                            </option>
                            <option value="razorpay">
                              {t('payment.method.razorpay', 'Razorpay (Cards, UPI, Net Banking)')}
                            </option>
                          </CFormSelect>
                        </CCol>

                        <CCol xs={12} className="border-top pt-3 mt-3">
                          {paymentMethod === 'wallet' && (
                            <div className="mb-3 p-3 bg-body-secondary rounded">
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="small fw-bold">Wallet Balance</span>
                                <span className="fw-semibold">₹{walletBalance.toFixed(2)}</span>
                              </div>
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="small fw-bold">Booking Amount</span>
                                <span className="fw-semibold text-danger">
                                  - ₹{amount.toFixed(2)}
                                </span>
                              </div>
                              <hr className="my-2" />
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="small fw-bold">Remaining Balance</span>
                                <span
                                  className={`fw-bold ${isInsufficientWallet ? 'text-danger' : 'text-success'}`}
                                >
                                  ₹{(walletBalance - amount).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="d-flex justify-content-between align-items-center">
                            <span className="small text-muted text-uppercase fw-bold">
                              Booking Status
                            </span>
                            <span className="badge bg-primary px-3 py-2">Ready to Book</span>
                          </div>
                          <div className="d-flex justify-content-between align-items-center mt-2">
                            <span className="small text-muted text-uppercase fw-bold">
                              Total Amount
                            </span>
                            <span className="fw-bold fs-5 text-success">₹{amount.toFixed(2)}</span>
                          </div>
                        </CCol>
                      </CRow>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>

              {isInsufficientWallet && (
                <div className="alert alert-danger text-center small mb-4">
                  Insufficient Wallet Balance. Please add money or choose another payment method.
                </div>
              )}

              <div className="d-flex justify-content-center gap-3 mt-4">
                <CButton color="danger" variant="outline" onClick={() => processMockPayment(false)}>
                  Simulate Failure
                </CButton>
                <CButton
                  color="primary"
                  onClick={() => processMockPayment(true)}
                  className="px-4"
                  disabled={isInsufficientWallet}
                >
                  Simulate Success
                </CButton>
              </div>
            </div>
          )}
        </CModalBody>
      </CModal>
    )
  },
)

export default MockPaymentModal
