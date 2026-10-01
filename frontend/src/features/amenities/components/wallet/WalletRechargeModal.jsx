import React, { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CButton,
  CFormCheck,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCreditCard } from '@coreui/icons'
import useWalletPayment from '../../hooks/useWalletPayment.js'
import AppLoader from '../../../../components/common/AppLoader'

export const WalletRechargeModal = memo(
  ({
    isOpen,
    onClose,
    walletBalance,
    isPaymentGatewayConfigured = true,
    onSuccess,
    onFailure,
    user,
  }) => {
    const { t } = useTranslation()
    const [amount, setAmount] = useState('1000')
    const [paymentMethod, setPaymentMethod] = useState('RAZORPAY')
    const { rechargeWallet, loading } = useWalletPayment()
    const isGatewayReady = isPaymentGatewayConfigured !== false

    const presetAmounts = [500, 1000, 2000, 5000]

    const handleCheckoutSubmit = async () => {
      if (!isGatewayReady) return
      const numericAmount = Number(amount)
      if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) return

      if (paymentMethod === 'RAZORPAY') {
        await rechargeWallet(numericAmount, onSuccess, onFailure)
      }
    }

    const displayAmount = Number(amount) || 0

    return (
      <CModal
        visible={isOpen}
        onClose={loading ? undefined : onClose}
        backdrop="static"
        alignment="center"
        size="md"
        className="payment-checkout-modal"
      >
        <CModalHeader closeButton={!loading}>
          <CModalTitle className="fw-bold">
            {t('wallet.recharge.modalTitle', 'Wallet Recharge')}
          </CModalTitle>
        </CModalHeader>

        <CModalBody className="p-4">
          {loading ? (
            <div className="text-center py-5">
              <AppLoader variant="block" />
              <p className="mb-0 text-muted">
                {t('wallet.recharge.processing', 'Connecting to payment gateway...')}
              </p>
            </div>
          ) : (
            <div>
              {!isGatewayReady && (
                <CAlert color="warning" className="mb-3 text-start small">
                  <strong>
                    {t('wallet.recharge.unavailableTitle', 'Online Recharge Unavailable:')}
                  </strong>{' '}
                  {t(
                    'wallet.recharge.unavailableDesc',
                    'The community administration has not connected an online payment gateway. Please contact management for manual or offline top-up.',
                  )}
                </CAlert>
              )}

              {/* Recharge Summary Card */}
              <div className="p-3 mb-4 rounded border bg-light text-start">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted small">
                    {t('wallet.recharge.targetLabel', 'Recharge Target')}
                  </span>
                  <span className="fw-bold text-primary">
                    {t('wallet.recharge.targetWallet', 'Digital Wallet')}
                  </span>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted small">
                    {t('wallet.recharge.unitLabel', 'Unit / Flat')}
                  </span>
                  <span className="fw-medium">{user?.unitNumber || user?.flatNumber || '—'}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted small">
                    {t('wallet.recharge.balanceLabel', 'Current Balance')}
                  </span>
                  <span className="fw-medium text-success">
                    ₹{(walletBalance || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <hr className="my-2" />

                {/* Preset Buttons */}
                <div className="mb-3 d-flex gap-2 flex-wrap">
                  {presetAmounts.map((preset) => (
                    <CButton
                      key={preset}
                      color="secondary"
                      size="sm"
                      variant={Number(amount) === preset ? '' : 'outline'}
                      onClick={() => setAmount(preset.toString())}
                    >
                      + ₹{preset}
                    </CButton>
                  ))}
                </div>

                {/* Custom Input */}
                <div className="mb-2">
                  <label className="form-label text-muted small mb-1">
                    {t('wallet.recharge.amountLabel', 'Custom Amount (₹)')}
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <hr className="my-2" />

                <div className="d-flex justify-content-between align-items-center">
                  <span className="fw-bold">
                    {t('wallet.recharge.totalAmount', 'Total Recharge Amount')}
                  </span>
                  <h4 className="fw-bold text-success mb-0">
                    ₹{displayAmount.toLocaleString('en-IN')}
                  </h4>
                </div>
              </div>

              {/* Payment Method Selector */}
              <h6 className="fw-bold mb-3 text-start">
                {t('wallet.recharge.selectMethodTitle', 'Select Payment Method')}
              </h6>

              {/* Razorpay Option */}
              <div
                className={`p-3 border rounded mb-4 cursor-pointer text-start transition-all ${
                  paymentMethod === 'RAZORPAY' ? 'border-primary bg-primary bg-opacity-10' : ''
                }`}
                onClick={() => setPaymentMethod('RAZORPAY')}
              >
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <CFormCheck
                      type="radio"
                      name="paymentMethod"
                      id="method-razorpay"
                      checked={paymentMethod === 'RAZORPAY'}
                      onChange={() => setPaymentMethod('RAZORPAY')}
                    />
                    <div className="d-flex align-items-center gap-2">
                      <CIcon icon={cilCreditCard} size="lg" className="text-primary" />
                      <div>
                        <div className="fw-semibold">
                          {t('wallet.recharge.razorpayTitle', 'Razorpay (Cards, UPI, Net Banking)')}
                        </div>
                        <div className="text-muted small">
                          {t(
                            'wallet.recharge.razorpaySub',
                            'Instant online payment via official Razorpay SDK',
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="d-flex justify-content-end gap-3">
                <CButton color="secondary" variant="outline" onClick={onClose} disabled={loading}>
                  {t('wallet.recharge.cancelBtn', 'Cancel')}
                </CButton>
                <CButton
                  color="primary"
                  onClick={handleCheckoutSubmit}
                  disabled={loading || !isGatewayReady || !amount || Number(amount) <= 0}
                  className="px-4"
                >
                  {isGatewayReady
                    ? `${t('wallet.recharge.payBtn', 'Confirm & Pay ₹')}${displayAmount.toLocaleString('en-IN')}`
                    : t('wallet.recharge.gatewayNotConfigured', 'Gateway Not Configured')}
                </CButton>
              </div>
            </div>
          )}
        </CModalBody>
      </CModal>
    )
  },
)

export default WalletRechargeModal
