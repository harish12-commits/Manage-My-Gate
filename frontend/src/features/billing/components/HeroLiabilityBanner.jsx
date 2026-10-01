import React, { useState, memo } from 'react'
import toast from 'react-hot-toast'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CForm,
  CFormLabel,
  CFormInput,
  CFormSelect,
} from '@coreui/react'
import PaymentCheckoutModal from './PaymentCheckoutModal.jsx'
import { openInvoicePrintWindow } from '../utils/invoiceTemplate'

/**
 * HeroLiabilityBanner
 *
 * Prominent financial summary card for residents.
 * Displays live total outstanding liability with unit breakdown and Pay Now / Checkout CTAs.
 */
const HeroLiabilityBanner = memo(
  ({
    activeDues = null,
    settleOffline,
    walletBalance = 0,
    payInvoiceWallet,
    payInvoiceRazorpay,
    verifyRazorpay,
    loadingStates = {},
  }) => {
    const totalOutstanding = activeDues?.totalPortfolioDue || 0
    const unitBreakdown = activeDues?.unitBreakdown || []

    // Determine if there is any cheque/offline payment currently clearing (VERIFICATION_PENDING)
    const clearingInvoice = unitBreakdown.find((inv) => inv.status === 'VERIFICATION_PENDING')
    const isClearing = !!clearingInvoice
    const clearingAmount =
      clearingInvoice?.offlineAmount ||
      clearingInvoice?.outstandingAmount ||
      clearingInvoice?.totalDue ||
      0
    const clearingRef = clearingInvoice?.offlineReference || 'Cheque'

    const [checkoutInvoice, setCheckoutInvoice] = useState(null)
    const [payOfflineInvoice, setPayOfflineInvoice] = useState(null)
    const [offlineRef, setOfflineRef] = useState('')
    const [offlineAmount, setOfflineAmount] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER')
    const [submitting, setSubmitting] = useState(false)

    const handlePayNow = () => {
      const firstUnpaid = unitBreakdown.find(
        (inv) =>
          ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.status) || inv.outstandingAmount > 0,
      )
      if (!firstUnpaid) {
        toast.error('You have no outstanding unpaid invoices!')
        return
      }
      setCheckoutInvoice(firstUnpaid)
    }

    const handleOpenOfflineModal = () => {
      const firstUnpaid = unitBreakdown.find(
        (inv) =>
          ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.status) || inv.outstandingAmount > 0,
      )
      if (!firstUnpaid) {
        toast.error('You have no outstanding unpaid invoices!')
        return
      }
      setPayOfflineInvoice(firstUnpaid)
      setOfflineRef('')
      setPaymentMethod('BANK_TRANSFER')
      setOfflineAmount(firstUnpaid.outstandingAmount ?? firstUnpaid.totalDue ?? 0)
    }

    const handleConfirmOfflinePay = async () => {
      if (!payOfflineInvoice || !offlineRef.trim()) return
      setSubmitting(true)
      try {
        if (settleOffline) {
          await settleOffline(payOfflineInvoice.invoiceId || payOfflineInvoice._id, {
            offlineReference: offlineRef,
            offlineAmount: Number(offlineAmount),
            paymentMethod: paymentMethod,
          })
        }

        // Offline payment is synchronous in the DB, so we can dispatch immediately
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('billing:refreshDues'))
        }

        toast.success('Offline payment submitted successfully! Awaiting admin verification.')
        setPayOfflineInvoice(null)
      } catch (err) {
        toast.error('Failed to submit offline payment: ' + err.message)
      } finally {
        setSubmitting(false)
      }
    }

    const handleDownloadInvoice = (item) => {
      openInvoicePrintWindow(item)
    }

    return (
      <div className={`hero-liability-card${isClearing ? ' hero-liability-card--clearing' : ''}`}>
        {/* Top label */}
        <div className="hero-liability-card__eyebrow">
          <i className="fa-solid fa-wallet me-2" />
          Outstanding Balance
        </div>

        {/* Big amount */}
        <div className="hero-liability-card__amount">
          <span className="hero-liability-card__currency">₹</span>
          {totalOutstanding.toLocaleString('en-IN')}
        </div>

        {/* Breakdown */}
        <div className="hero-liability-card__breakdown">
          {unitBreakdown.length === 0 ? (
            <div className="text-white-50 small text-center py-2">
              🎉 No outstanding dues. Good job!
            </div>
          ) : (
            unitBreakdown.map((item) => (
              <div key={item.invoiceId || item._id} className="hero-liability-card__breakdown-row">
                <span className="hero-liability-card__breakdown-label">
                  <i className="fa-solid fa-circle-dot me-2 opacity-50" />
                  {item.unitNumber || 'Unit'} — {item.assessmentName || 'Maintenance'} (
                  {item.billingPeriodString})
                </span>
                <div className="text-end">
                  <span className="hero-liability-card__breakdown-value d-block">
                    ₹{(item.outstandingAmount ?? item.totalDue ?? 0).toLocaleString('en-IN')}
                  </span>
                  {item.paidAmount > 0 && (
                    <span className="small text-white-50" style={{ fontSize: '0.75rem' }}>
                      Paid: ₹{(item.paidAmount || 0).toLocaleString('en-IN')} / Total: ₹
                      {(item.totalDue || 0).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Clearing message — shown when isClearing */}
        {isClearing && (
          <div className="hero-liability-card__clearing-msg">
            <i className="fa-solid fa-clock-rotate-left hero-liability-card__clearing-icon" />
            <span>
              Payment of ₹{clearingAmount.toLocaleString('en-IN')} is currently clearing via
              Reference {clearingRef}.
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="hero-liability-card__actions d-flex gap-2">
          <button
            type="button"
            className="hero-liability-card__pay-btn flex-grow-1"
            disabled={isClearing || totalOutstanding === 0}
            onClick={handlePayNow}
          >
            {isClearing ? (
              <>
                <i className="fa-solid fa-spinner fa-spin me-2" />
                Processing Clearance…
              </>
            ) : (
              <>
                <i className="fa-solid fa-bolt me-2" />
                Pay Now — ₹{totalOutstanding.toLocaleString('en-IN')}
              </>
            )}
          </button>

          {totalOutstanding > 0 && !isClearing && (
            <button
              type="button"
              className="btn btn-outline-light btn-sm"
              onClick={handleOpenOfflineModal}
            >
              Pay Offline
            </button>
          )}
        </div>

        {/* ── Online Checkout Modal (Wallet / Razorpay) ─────────────────── */}
        <PaymentCheckoutModal
          isOpen={!!checkoutInvoice}
          onClose={(isSuccess, paidCustomAmount, methodUsed) => {
            if (isSuccess && checkoutInvoice) {
              toast.success('Payment completed successfully!')

              // Add a small delay to allow the backend's PAYMENT_SUCCESS event listener
              // to finish updating the invoice in the database (Eventual Consistency).
              if (window.dispatchEvent) {
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('billing:refreshDues'))
                }, 1500)
              }

              const amountSettled = paidCustomAmount || checkoutInvoice?.outstandingAmount || 0
              const newOutstanding =
                (checkoutInvoice?.outstandingAmount || checkoutInvoice?.totalDue || 0) -
                amountSettled
              const paidInvoice = {
                ...checkoutInvoice,
                alreadyPaidAmount: checkoutInvoice?.paidAmount || 0,
                currentPaymentAmount: amountSettled,
                paidAmount: (checkoutInvoice?.paidAmount || 0) + amountSettled,
                outstandingAmount: newOutstanding,
                status: newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID',
                paid_at: new Date().toISOString(),
                paymentMethod: methodUsed || 'ONLINE',
              }

              handleDownloadInvoice(paidInvoice)
            }
            setCheckoutInvoice(null)
          }}
          invoice={checkoutInvoice}
          walletBalance={walletBalance}
          onPayWithWallet={payInvoiceWallet}
          onPayWithRazorpay={payInvoiceRazorpay}
          onVerifyRazorpay={verifyRazorpay}
          isLoading={loadingStates.settleInvoice}
          totalPortfolioDue={totalOutstanding}
        />

        {/* ── Pay Offline Modal (Bank Transfer & Cash) ─────────────────────────── */}
        <CModal
          visible={!!payOfflineInvoice}
          onClose={() => setPayOfflineInvoice(null)}
          alignment="center"
        >
          <CModalHeader>
            <CModalTitle className="fw-semibold">Pay Offline</CModalTitle>
          </CModalHeader>
          <CForm
            onSubmit={(e) => {
              e.preventDefault()
              if (paymentMethod === 'BANK_TRANSFER') {
                handleConfirmOfflinePay()
              }
            }}
          >
            <CModalBody>
              <div className="alert alert-info py-2 px-3 small mb-3">
                You are paying Invoice <strong>{payOfflineInvoice?.invoiceNumber}</strong> of{' '}
                <strong>
                  ₹
                  {(
                    payOfflineInvoice?.outstandingAmount ?? payOfflineInvoice?.totalDue
                  )?.toLocaleString('en-IN')}
                </strong>
                .
              </div>

              <div className="mb-3">
                <CFormLabel className="small fw-semibold d-block mb-2">How did you pay?</CFormLabel>
                <div className="btn-group w-full" role="group">
                  <button
                    type="button"
                    className={`btn btn-sm ${paymentMethod === 'BANK_TRANSFER' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setPaymentMethod('BANK_TRANSFER')}
                  >
                    Bank Transfer
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${paymentMethod === 'CASH' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setPaymentMethod('CASH')}
                  >
                    Cash
                  </button>
                </div>
              </div>

              {paymentMethod === 'BANK_TRANSFER' ? (
                <>
                  <div className="mb-3">
                    <CFormLabel htmlFor="pay-amount" className="small fw-semibold">
                      Amount Paid (₹) *
                    </CFormLabel>
                    <CFormInput
                      id="pay-amount"
                      type="number"
                      value={offlineAmount}
                      onChange={(e) => {
                        const rawVal = e.target.value
                        if (rawVal === '') {
                          setOfflineAmount('')
                          return
                        }
                        let val = Number(rawVal)
                        const max =
                          payOfflineInvoice?.outstandingAmount ?? payOfflineInvoice?.totalDue ?? 0
                        if (val > max) val = max
                        if (val < 0) val = 0
                        setOfflineAmount(val.toString())
                      }}
                      required
                      min="1"
                      max={payOfflineInvoice?.outstandingAmount ?? payOfflineInvoice?.totalDue ?? 0}
                      size="sm"
                    />
                  </div>

                  <div className="mb-3">
                    <CFormLabel htmlFor="pay-date" className="small fw-semibold">
                      When did you pay? (Payment Date) *
                    </CFormLabel>
                    <CFormInput
                      id="pay-date"
                      type="date"
                      value={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setOfflineRef(offlineRef)} // placeholder
                      required
                      size="sm"
                    />
                  </div>

                  <div className="mb-3">
                    <CFormLabel htmlFor="pay-ref" className="small fw-semibold">
                      Payment Reference / UTR Number *
                    </CFormLabel>
                    <CFormInput
                      id="pay-ref"
                      type="text"
                      placeholder="e.g. UTR192847194 or IMPS-98124"
                      value={offlineRef}
                      onChange={(e) => setOfflineRef(e.target.value)}
                      required
                      autoFocus
                      size="sm"
                    />
                  </div>
                </>
              ) : (
                <div className="alert alert-warning py-3 px-3 small mb-0">
                  <div className="fw-bold mb-1">Cash Payment Instructions</div>
                  Please pay the amount to the community office or authorized facility staff. You
                  will receive a digital receipt after your payment is recorded.
                </div>
              )}
            </CModalBody>
            <CModalFooter>
              <CButton
                type="button"
                color="secondary"
                size="sm"
                onClick={() => setPayOfflineInvoice(null)}
                disabled={submitting}
              >
                Close
              </CButton>
              {paymentMethod === 'BANK_TRANSFER' && (
                <CButton
                  type="submit"
                  color="primary"
                  size="sm"
                  disabled={
                    submitting || !offlineRef.trim() || !offlineAmount || Number(offlineAmount) <= 0
                  }
                >
                  {submitting ? 'Submitting...' : 'Submit Payment'}
                </CButton>
              )}
            </CModalFooter>
          </CForm>
        </CModal>
      </div>
    )
  },
)

HeroLiabilityBanner.displayName = 'HeroLiabilityBanner'
export default HeroLiabilityBanner
