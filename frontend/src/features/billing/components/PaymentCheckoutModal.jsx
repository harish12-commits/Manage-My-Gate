import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormCheck,
  CAlert,
  CSpinner,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilWallet, cilCreditCard, cilCheckCircle, cilWarning, cilInstitution } from '@coreui/icons'
import config, { isMockRazorpayKey } from '../../../config/config.js'
import '../styles/_billing.scss'

/**
 * Dynamically load the Razorpay checkout.js script if not already present on window.
 */
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/**
 * Isolated Resident Payment Checkout Modal.
 * Offers dual payment selection: Razorpay (INR) and Digital Wallet.
 */
export const PaymentCheckoutModal = ({
  isOpen,
  onClose,
  invoice,
  walletBalance,
  onPayWithWallet,
  onPayWithRazorpay,
  onVerifyRazorpay,
  onPayOffline,
  isLoading,
  actionError,
  totalPortfolioDue,
}) => {
  const { t } = useTranslation()
  const [paymentMethod, setPaymentMethod] = useState('WALLET')
  const [scriptLoading, setScriptLoading] = useState(false)
  const [localError, setLocalError] = useState(null)

  const isPaymentGatewayConfigured = useSelector(
    (state) => state.wallet?.isPaymentGatewayConfigured !== false,
  )

  const totalDue = invoice?.totalDue ?? invoice?.amount ?? 0
  const paidAmount = invoice?.paidAmount ?? 0
  const invoiceOutstanding =
    invoice?.outstandingAmount !== undefined
      ? invoice.outstandingAmount
      : Math.max(0, totalDue - paidAmount)
  const maxAmount =
    totalPortfolioDue && totalPortfolioDue > invoiceOutstanding
      ? totalPortfolioDue
      : invoiceOutstanding
  const [customAmount, setCustomAmount] = useState(maxAmount)

  useEffect(() => {
    if (invoice) {
      setCustomAmount(maxAmount)
    }
  }, [invoice, maxAmount])

  useEffect(() => {
    if (!isPaymentGatewayConfigured && paymentMethod === 'RAZORPAY') {
      setPaymentMethod(walletBalance >= customAmount ? 'WALLET' : 'OFFLINE')
    }
  }, [isPaymentGatewayConfigured, paymentMethod, walletBalance, customAmount])

  if (!invoice) return null

  const isWalletInsufficient = walletBalance < customAmount

  const handleCheckoutSubmit = async () => {
    setLocalError(null)

    if (paymentMethod === 'OFFLINE') {
      if (onPayOffline) {
        onPayOffline(invoice, customAmount)
      }
      onClose(false)
      return
    }

    if (paymentMethod === 'WALLET') {
      if (isWalletInsufficient) {
        setLocalError(
          t(
            'billing.checkout.insufficientBalance',
            'Insufficient wallet balance. Please recharge your wallet or choose Razorpay.',
          ),
        )
        return
      }
      if (onPayWithWallet) {
        const result = await onPayWithWallet(invoice.invoiceId || invoice._id, customAmount)
        if (result?.success || !result?.error) {
          onClose(true, customAmount, 'WALLET')
        }
      }
    } else if (paymentMethod === 'RAZORPAY') {
      setScriptLoading(true)

      if (onPayWithRazorpay) {
        const orderResult = await onPayWithRazorpay(invoice.invoiceId || invoice._id, customAmount)
        if (orderResult?.error) {
          setLocalError(orderResult.error)
          setScriptLoading(false)
          return
        }

        const orderData = orderResult?.data || orderResult?.payload || orderResult
        const keyId = orderData.keyId || orderData.razorpayKeyId || config.razorpayKeyId
        const isMock = isMockRazorpayKey(keyId)

        if (isMock) {
          // Mock Payment Flow
          await new Promise((resolve) => setTimeout(resolve, 1500)) // Simulate loading delay
          const confirmPayment = window.confirm(
            t('billing.checkout.mockConfirm', `[Mock Mode] Confirm payment of ₹${customAmount}?`),
          )

          if (confirmPayment) {
            if (onVerifyRazorpay) {
              const verifyResult = await onVerifyRazorpay({
                paymentId: orderData.paymentId,
                razorpayPaymentId: `pay_mock_${Date.now()}`,
                razorpayOrderId: orderData.orderId || orderData.id,
                razorpaySignature: `sig_mock_${Date.now()}`,
              })
              if (
                verifyResult?.meta?.requestStatus === 'fulfilled' ||
                (verifyResult && !verifyResult.error && verifyResult.success !== false)
              ) {
                onClose(true, customAmount, 'RAZORPAY')
              } else {
                setLocalError(t('billing.checkout.verificationFailed', 'Mock verification failed.'))
              }
            }
          } else {
            setLocalError(t('billing.checkout.cancelled', 'Payment cancelled by user.'))
          }
          setScriptLoading(false)
          return
        }

        // Real Razorpay Flow
        const scriptLoaded = await loadRazorpayScript()
        setScriptLoading(false)

        if (!scriptLoaded) {
          setLocalError(
            t(
              'billing.checkout.scriptError',
              'Failed to load Razorpay payment gateway script. Check connection.',
            ),
          )
          return
        }

        const options = {
          key: keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'ManageMyGate Billing',
          description: `Settlement for Invoice #${invoice.invoiceNumber || 'INV-001'}`,
          order_id: orderData.orderId || orderData.id,
          handler: async (response) => {
            if (onVerifyRazorpay) {
              const verifyResult = await onVerifyRazorpay({
                paymentId: orderData.paymentId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              })
              if (
                verifyResult?.meta?.requestStatus === 'fulfilled' ||
                (verifyResult && !verifyResult.error && verifyResult.success !== false)
              ) {
                onClose(true, customAmount, 'RAZORPAY')
              }
            }
          },
          prefill: {
            name: invoice.targetUser || '',
          },
          theme: {
            color: '#321fdb',
          },
        }

        const razorpayInstance = new window.Razorpay(options)
        razorpayInstance.open()
      } else {
        setScriptLoading(false)
      }
    }
  }

  return (
    <CModal
      visible={isOpen}
      onClose={onClose}
      backdrop="static"
      alignment="center"
      size="md"
      className="payment-checkout-modal"
    >
      <CModalHeader closeButton>
        <CModalTitle className="fw-bold">
          {t('billing.checkout.modalTitle', 'Invoice Settlement')}
        </CModalTitle>
      </CModalHeader>

      <CModalBody className="p-4">
        {(actionError || localError) && (
          <CAlert color="danger" className="mb-4">
            {typeof (actionError || localError) === 'object'
              ? (actionError || localError)?.message || JSON.stringify(actionError || localError)
              : actionError || localError}
          </CAlert>
        )}

        {/* Invoice Summary Card */}
        <div className="p-3 mb-4 rounded border bg-light text-start">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">
              {t('billing.checkout.invoiceLabel', 'Invoice Number')}
            </span>
            <span className="fw-bold text-primary">{invoice.invoiceNumber}</span>
          </div>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">
              {t('billing.checkout.unitLabel', 'Unit / Flat')}
            </span>
            <span className="fw-medium">{invoice.unitNumber || '—'}</span>
          </div>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">{t('billing.checkout.periodLabel', 'Period')}</span>
            <span className="fw-medium">{invoice.billingPeriodString || 'Current'}</span>
          </div>
          <hr className="my-2" />
          <div className="d-flex justify-content-between align-items-center">
            <span className="fw-bold">{t('billing.checkout.payAmount', 'Amount to Pay (₹)')}</span>
            <div style={{ width: '150px' }}>
              <input
                type="number"
                className="form-control text-end fw-bold text-success"
                value={customAmount}
                max={maxAmount}
                min={1}
                onChange={(e) => {
                  let val = Number(e.target.value)
                  if (val > maxAmount) val = maxAmount
                  if (val < 0) val = 0
                  setCustomAmount(val)
                }}
              />
            </div>
          </div>
        </div>

        {/* Payment Method Selector */}
        <h6 className="fw-bold mb-3 text-start">
          {t('billing.checkout.selectMethodTitle', 'Select Payment Method')}
        </h6>

        {/* Option 1: Digital Wallet */}
        <div
          className={`p-3 border rounded mb-3 cursor-pointer text-start transition-all ${
            paymentMethod === 'WALLET' ? 'border-primary bg-primary bg-opacity-10' : ''
          }`}
          onClick={() => setPaymentMethod('WALLET')}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-3">
              <CFormCheck
                type="radio"
                name="paymentMethod"
                id="method-wallet"
                checked={paymentMethod === 'WALLET'}
                onChange={() => setPaymentMethod('WALLET')}
              />
              <div className="d-flex align-items-center gap-2">
                <CIcon icon={cilWallet} size="lg" className="text-primary" />
                <div>
                  <div className="fw-semibold">
                    {t('billing.checkout.walletOptionTitle', 'Digital Wallet Balance')}
                  </div>
                  <div className="text-muted small">
                    {t('billing.checkout.availableBalance', 'Available Balance:')}{' '}
                    <strong className={isWalletInsufficient ? 'text-danger' : 'text-success'}>
                      ₹{walletBalance.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {isWalletInsufficient && (
              <CBadge color="danger" className="d-flex align-items-center gap-1">
                <CIcon icon={cilWarning} size="sm" />
                {t('billing.checkout.insufficientBadge', 'Insufficient')}
              </CBadge>
            )}
          </div>
        </div>

        {/* Option 2: Razorpay Online */}
        <div
          className={`p-3 border rounded mb-3 text-start transition-all ${
            !isPaymentGatewayConfigured
              ? 'opacity-50 bg-light'
              : paymentMethod === 'RAZORPAY'
                ? 'border-primary bg-primary bg-opacity-10 cursor-pointer'
                : 'cursor-pointer'
          }`}
          onClick={() => {
            if (isPaymentGatewayConfigured) setPaymentMethod('RAZORPAY')
          }}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-3">
              <CFormCheck
                type="radio"
                name="paymentMethod"
                id="method-razorpay"
                disabled={!isPaymentGatewayConfigured}
                checked={paymentMethod === 'RAZORPAY'}
                onChange={() => {
                  if (isPaymentGatewayConfigured) setPaymentMethod('RAZORPAY')
                }}
              />
              <div className="d-flex align-items-center gap-2">
                <CIcon icon={cilCreditCard} size="lg" className="text-primary" />
                <div>
                  <div className="fw-semibold">
                    {t(
                      'billing.checkout.razorpayOptionTitle',
                      'Razorpay (Cards, UPI, Net Banking)',
                    )}
                  </div>
                  <div className="text-muted small">
                    {isPaymentGatewayConfigured
                      ? t(
                          'billing.checkout.razorpayOptionSub',
                          'Instant online payment via official Razorpay SDK',
                        )
                      : t(
                          'billing.checkout.gatewayNotConfiguredSub',
                          'Online gateway has not been configured by community management',
                        )}
                  </div>
                </div>
              </div>
            </div>

            {!isPaymentGatewayConfigured && (
              <CBadge color="secondary" className="d-flex align-items-center gap-1">
                <CIcon icon={cilWarning} size="sm" />
                {t('billing.checkout.unavailableBadge', 'Unavailable')}
              </CBadge>
            )}
          </div>
        </div>

        {/* Option 3: Pay Offline */}
        <div
          className={`p-3 border rounded cursor-pointer text-start transition-all ${
            paymentMethod === 'OFFLINE' ? 'border-warning bg-warning bg-opacity-10' : ''
          }`}
          onClick={() => setPaymentMethod('OFFLINE')}
        >
          <div className="d-flex align-items-center gap-3">
            <CFormCheck
              type="radio"
              name="paymentMethod"
              id="method-offline"
              checked={paymentMethod === 'OFFLINE'}
              onChange={() => setPaymentMethod('OFFLINE')}
            />
            <div className="d-flex align-items-center gap-2">
              <CIcon icon={cilInstitution} size="lg" className="text-warning" />
              <div>
                <div className="fw-semibold">
                  {t('billing.checkout.offlineOptionTitle', 'Pay Offline')}
                </div>
                <div className="text-muted small">
                  {t(
                    'billing.checkout.offlineOptionSub',
                    'Bank Transfer (NEFT/IMPS/UPI) or Facility Cash',
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CModalBody>

      <CModalFooter>
        <CButton
          color="secondary"
          variant="ghost"
          onClick={onClose}
          disabled={isLoading || scriptLoading}
        >
          {t('billing.checkout.cancel', 'Cancel')}
        </CButton>
        <CButton
          color="primary"
          onClick={handleCheckoutSubmit}
          disabled={
            isLoading ||
            scriptLoading ||
            (paymentMethod === 'WALLET' && isWalletInsufficient) ||
            (paymentMethod === 'RAZORPAY' && !isPaymentGatewayConfigured)
          }
        >
          {isLoading || scriptLoading ? (
            <>
              <CSpinner size="sm" aria-hidden="true" className="me-2" />
              {t('billing.checkout.processing', 'Processing...')}
            </>
          ) : (
            t('billing.checkout.payNowBtn', 'Confirm & Pay ₹{{amount}}', {
              amount: customAmount.toLocaleString('en-IN'),
            })
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

PaymentCheckoutModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  invoice: PropTypes.object,
  walletBalance: PropTypes.number,
  onPayWithWallet: PropTypes.func,
  onPayWithRazorpay: PropTypes.func,
  onVerifyRazorpay: PropTypes.func,
  isLoading: PropTypes.bool,
  actionError: PropTypes.string,
}

PaymentCheckoutModal.defaultProps = {
  invoice: null,
  walletBalance: 0,
  isLoading: false,
  actionError: null,
}

export default PaymentCheckoutModal
