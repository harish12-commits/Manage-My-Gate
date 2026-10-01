import React, { memo, useState, useEffect } from 'react'
import PropTypes from 'prop-types'
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
} from '@coreui/react'

export const OfflineSettleModal = memo(
  ({
    visible,
    onClose,
    settleRef,
    setSettleRef,
    settleAmount,
    setSettleAmount,
    maxAmount,
    onSubmit,
    loading,
  }) => {
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])

    useEffect(() => {
      if (visible) {
        setPaymentDate(new Date().toISOString().split('T')[0])
      }
    }, [visible])

    if (!visible) return null

    return (
      <CModal visible={visible} onClose={onClose} alignment="center">
        <CModalHeader>
          <CModalTitle className="fw-semibold">Bank Transfer Details</CModalTitle>
        </CModalHeader>
        <CForm
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit({ paymentDate })
          }}
        >
          <CModalBody>
            <div className="mb-3">
              <CFormLabel htmlFor="offline-amount" className="small fw-semibold">
                Amount Paid (₹) *
              </CFormLabel>
              <CFormInput
                id="offline-amount"
                type="number"
                placeholder="0.00"
                value={settleAmount}
                onChange={(e) => {
                  const rawVal = e.target.value
                  if (rawVal === '') {
                    setSettleAmount('')
                    return
                  }
                  let val = Number(rawVal)
                  if (maxAmount && val > maxAmount) val = maxAmount
                  if (val < 0) val = 0
                  setSettleAmount(val.toString())
                }}
                required
                min="1"
                max={maxAmount}
                step="0.01"
                size="sm"
                autoFocus
              />
              {maxAmount && (
                <div className="small text-muted mt-1">
                  Maximum allowed: ₹{maxAmount.toLocaleString('en-IN')}
                </div>
              )}
            </div>

            <div className="mb-3">
              <CFormLabel htmlFor="payment-date" className="small fw-semibold">
                When did you pay? (Payment Date) *
              </CFormLabel>
              <CFormInput
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                size="sm"
              />
            </div>

            <div className="mb-3">
              <CFormLabel htmlFor="offline-ref" className="small fw-semibold">
                Payment Reference / UTR Number *
              </CFormLabel>
              <CFormInput
                id="offline-ref"
                type="text"
                placeholder="e.g. UTR-92842 or IMPS-28194"
                value={settleRef}
                onChange={(e) => setSettleRef(e.target.value)}
                required
                size="sm"
              />
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton type="button" color="secondary" size="sm" onClick={onClose}>
              Cancel
            </CButton>
            <CButton
              type="submit"
              color="primary"
              size="sm"
              disabled={loading || !settleRef.trim() || !settleAmount || Number(settleAmount) <= 0}
            >
              {loading ? 'Submitting...' : 'Submit Payment Details'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    )
  },
)

OfflineSettleModal.displayName = 'OfflineSettleModal'

OfflineSettleModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  settleRef: PropTypes.string.isRequired,
  setSettleRef: PropTypes.func.isRequired,
  settleAmount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  setSettleAmount: PropTypes.func.isRequired,
  maxAmount: PropTypes.number,
  onSubmit: PropTypes.func.isRequired,
  loading: PropTypes.bool,
}

export default OfflineSettleModal
