import React, { useState, memo, useCallback } from 'react'
import PropTypes from 'prop-types'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
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
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilXCircle, cilClock } from '@coreui/icons'
import '../styles/_billing.scss'

/**
 * Status badge component for Ledger Rows
 */
const StatusBadge = memo(({ status, paymentMethod }) => {
  const { t } = useTranslation()

  if (status === 'PAID') {
    return (
      <span className="billing-status-badge billing-status-badge--paid">
        <CIcon icon={cilCheckCircle} size="sm" className="me-1" />
        {t('billing.status.paid', 'Paid')}
      </span>
    )
  }

  if (status === 'VERIFICATION_PENDING') {
    return (
      <span
        className="billing-status-badge billing-status-badge--pending"
        title={`${paymentMethod || 'Payment'} ${t('billing.status.pendingTooltip', 'clearing T+3')}`}
      >
        <CIcon icon={cilClock} size="sm" className="me-1" />
        {t('billing.status.pending', 'Pending')}
      </span>
    )
  }

  return (
    <span className="billing-status-badge billing-status-badge--unpaid">
      <CIcon icon={cilXCircle} size="sm" className="me-1" />
      {t('billing.status.unpaid', 'Unpaid')}
    </span>
  )
})

StatusBadge.displayName = 'StatusBadge'

/**
 * Table row component for Billing Ledger Grid
 */
const LedgerRow = memo(({ invoice, onMarkPaid, onOfflineSettle }) => (
  <tr className="billing-ledger__row">
    <td className="billing-ledger__cell">
      <span className="billing-ledger__invoice-num">{invoice.invoiceNumber}</span>
      <div className="billing-ledger__date">{invoice.date}</div>
    </td>
    <td className="billing-ledger__cell">
      <span className="billing-ledger__unit">{invoice.unitNumber}</span>
    </td>
    <td className="billing-ledger__cell">
      <div className="d-flex align-items-center gap-2">
        <div className="billing-ledger__avatar">{(invoice.targetUser || 'U').charAt(0)}</div>
        <span className="billing-ledger__user">{invoice.targetUser || 'Unknown'}</span>
      </div>
    </td>
    <td className="billing-ledger__cell billing-ledger__cell--amount">
      <span className="billing-ledger__amount">
        {invoice.currency || '₹'}
        {(invoice.amount || 0).toLocaleString('en-IN')}
      </span>
      {invoice.status === 'VERIFICATION_PENDING' &&
        invoice.offlineAmount &&
        invoice.offlineAmount !== invoice.amount && (
          <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
            (Pending: ₹{invoice.offlineAmount.toLocaleString('en-IN')})
          </div>
        )}
    </td>
    <td className="billing-ledger__cell">
      <StatusBadge status={invoice.status} paymentMethod={invoice.paymentMethod} />
    </td>
    <td className="billing-ledger__cell">
      <span className="billing-ledger__method">{invoice.paymentMethod || '—'}</span>
    </td>
    <td className="billing-ledger__cell billing-ledger__cell--actions text-end">
      <CButton
        color="success"
        size="sm"
        className="me-2 text-white"
        onClick={() => onMarkPaid(invoice._id)}
        disabled={invoice.status === 'PAID'}
      >
        Mark Paid
      </CButton>
      <CButton color="secondary" size="sm" onClick={() => onOfflineSettle(invoice._id)}>
        Settle
      </CButton>
    </td>
  </tr>
))

LedgerRow.displayName = 'LedgerRow'

/**
 * Main BillingLedgerGrid Component
 */
const BillingLedgerGrid = memo(
  ({
    kpis = { grossDemand: 0, totalCollected: 0, inTransitGateway: 0, totalUnpaidArrears: 0 },
    invoices = [],
    pagination = { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 },
    loading = false,
    onPageChange,
    onSettleOffline,
    onApproveOffline,
  }) => {
    const { t } = useTranslation()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')

    // Modal states
    const [confirmPaidId, setConfirmPaidId] = useState(null)
    const [settleInvoiceId, setSettleInvoiceId] = useState(null)
    const [settleRef, setSettleRef] = useState('')
    const [settleAmount, setSettleAmount] = useState('')
    const [maxAmount, setMaxAmount] = useState(0)

    const handleMarkPaid = useCallback((invoiceId) => {
      setConfirmPaidId(invoiceId)
    }, [])

    const handleConfirmMarkPaid = async () => {
      if (!confirmPaidId || !onApproveOffline) return
      try {
        const res = await onApproveOffline(confirmPaidId)
        if (res && typeof res.unwrap === 'function') {
          await res.unwrap()
        }
        toast.success('Invoice marked as paid successfully.')
      } catch (err) {
        toast.error('Failed to clear invoice: ' + (err?.message || err || 'Unknown error'))
      } finally {
        setConfirmPaidId(null)
      }
    }

    const handleOfflineSettle = useCallback(
      (invoiceId) => {
        setSettleInvoiceId(invoiceId)
        setSettleRef('')
        const inv = invoices.find((i) => i._id === invoiceId)
        const maxAmt = inv ? inv.outstandingAmount || inv.amount || 0 : 0
        setMaxAmount(maxAmt)
        setSettleAmount(maxAmt > 0 ? maxAmt : '')
      },
      [invoices],
    )

    const handleConfirmOfflineSettle = async () => {
      if (
        !settleInvoiceId ||
        !settleRef.trim() ||
        !onSettleOffline ||
        !settleAmount ||
        settleAmount <= 0
      )
        return
      try {
        const res = await onSettleOffline(settleInvoiceId, {
          offlineReference: settleRef,
          paymentMethod: 'BANK_TRANSFER',
          amount: Number(settleAmount),
        })
        if (res && typeof res.unwrap === 'function') {
          await res.unwrap()
        }
        toast.success('Offline payment recorded successfully.')
      } catch (err) {
        toast.error('Failed to record settlement: ' + (err?.message || err || 'Unknown error'))
      } finally {
        setSettleInvoiceId(null)
        setSettleRef('')
        setSettleAmount('')
      }
    }

    const handleSearchChange = (e) => {
      const val = e.target.value
      setSearch(val)
      if (onPageChange) {
        onPageChange(1, { search: val, status: statusFilter })
      }
    }

    const handleStatusFilterChange = (status) => {
      setStatusFilter(status)
      if (onPageChange) {
        onPageChange(1, { search, status })
      }
    }

    return (
      <div className="billing-ledger">
        {/* KPI Summary Strip */}
        <div className="billing-ledger__kpi-strip">
          <div className="billing-ledger__kpi-card">
            <div className="billing-ledger__kpi-value">
              {loading ? '…' : kpis.grossDemandCount || 0}
            </div>
            <div className="billing-ledger__kpi-label">
              {t('billing.kpi.totalInvoices', 'Total Invoices')}
            </div>
          </div>
          <div className="billing-ledger__kpi-card billing-ledger__kpi-card--success">
            <div className="billing-ledger__kpi-value">
              ₹{loading ? '…' : (kpis.totalCollected || 0).toLocaleString('en-IN')}
            </div>
            <div className="billing-ledger__kpi-label">{t('billing.kpi.collected', 'Paid')}</div>
          </div>
          <div className="billing-ledger__kpi-card billing-ledger__kpi-card--danger">
            <div className="billing-ledger__kpi-value">
              ₹{loading ? '…' : (kpis.totalUnpaidArrears || 0).toLocaleString('en-IN')}
            </div>
            <div className="billing-ledger__kpi-label">
              {t('billing.kpi.unpaid', 'Unpaid Arrears')}
            </div>
          </div>
          <div className="billing-ledger__kpi-card billing-ledger__kpi-card--info">
            <div className="billing-ledger__kpi-value">
              ₹{loading ? '…' : (kpis.inTransitGateway || 0).toLocaleString('en-IN')}
            </div>
            <div className="billing-ledger__kpi-label">
              {t('billing.kpi.pending', 'Pending Clearance')}
            </div>
          </div>
          <div className="billing-ledger__kpi-card billing-ledger__kpi-card--primary">
            <div className="billing-ledger__kpi-value">
              ₹{loading ? '…' : (kpis.grossDemand || 0).toLocaleString('en-IN')}
            </div>
            <div className="billing-ledger__kpi-label">
              {t('billing.kpi.grossBilled', 'Total Billed')}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="billing-ledger__toolbar">
          <div className="billing-ledger__search-wrap">
            <i className="fa-solid fa-magnifying-glass billing-ledger__search-icon" />
            <input
              type="text"
              className="billing-ledger__search"
              placeholder={t('billing.searchPlaceholder', 'Search invoice, unit, or resident…')}
              value={search}
              onChange={handleSearchChange}
            />
          </div>

          <div className="billing-ledger__filter-pills">
            {['ALL', 'PAID', 'UNPAID', 'VERIFICATION_PENDING'].map((s) => (
              <button
                key={s}
                type="button"
                className={`billing-ledger__filter-pill${statusFilter === s ? ' billing-ledger__filter-pill--active' : ''}`}
                onClick={() => handleStatusFilterChange(s)}
              >
                {s === 'ALL'
                  ? 'All'
                  : s === 'VERIFICATION_PENDING'
                    ? 'Pending'
                    : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="billing-ledger__table-wrap position-relative">
          {loading && (
            <div className="position-absolute top-0 bottom-0 start-0 end-0 bg-white-75 d-flex align-items-center justify-content-center z-3">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          )}
          <table className="billing-ledger__table">
            <thead>
              <tr className="billing-ledger__thead-row">
                <th className="billing-ledger__th">Invoice</th>
                <th className="billing-ledger__th">Unit</th>
                <th className="billing-ledger__th">Resident</th>
                <th className="billing-ledger__th">Amount</th>
                <th className="billing-ledger__th">Status</th>
                <th className="billing-ledger__th">Method</th>
                <th className="billing-ledger__th text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="billing-ledger__empty text-center p-4">
                    <p className="mt-2 mb-0 text-muted">No invoices match your search.</p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <LedgerRow
                    key={inv._id}
                    invoice={inv}
                    onMarkPaid={handleMarkPaid}
                    onOfflineSettle={handleOfflineSettle}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="table-pagination-footer d-flex justify-content-between align-items-center mt-3">
          <span className="text-muted small">
            Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalRecords}{' '}
            total records)
          </span>
          <div className="d-flex gap-1">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={pagination.currentPage <= 1 || loading}
              onClick={() =>
                onPageChange &&
                onPageChange(pagination.currentPage - 1, { search, status: statusFilter })
              }
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={pagination.currentPage >= pagination.totalPages || loading}
              onClick={() =>
                onPageChange &&
                onPageChange(pagination.currentPage + 1, { search, status: statusFilter })
              }
            >
              Next
            </button>
          </div>
        </div>

        {/* Confirm Mark Paid Modal */}
        <CModal visible={!!confirmPaidId} onClose={() => setConfirmPaidId(null)} alignment="center">
          <CModalHeader>
            <CModalTitle className="fw-semibold">Confirm Payment Clearance</CModalTitle>
          </CModalHeader>
          <CModalBody>
            {(() => {
              const inv = invoices.find((i) => i._id === confirmPaidId)
              const verifyAmt = inv?.offlineAmount || inv?.amount || 0
              return (
                <>
                  Are you sure you want to verify and approve the offline payment of{' '}
                  <strong>₹{verifyAmt.toLocaleString('en-IN')}</strong>?
                  {inv?.offlineAmount && inv.offlineAmount < (inv.amount || 0) && (
                    <div className="mt-2 text-danger small">
                      Note: This is a partial payment. The invoice will be marked as "Partially
                      Paid" and the remaining balance will still be due.
                    </div>
                  )}
                </>
              )
            })()}
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" size="sm" onClick={() => setConfirmPaidId(null)}>
              Cancel
            </CButton>
            <CButton color="primary" size="sm" onClick={handleConfirmMarkPaid}>
              Confirm Clear
            </CButton>
          </CModalFooter>
        </CModal>

        {/* Offline Settle Modal */}
        <CModal
          visible={!!settleInvoiceId}
          onClose={() => {
            setSettleInvoiceId(null)
            setSettleRef('')
          }}
          alignment="center"
        >
          <CModalHeader>
            <CModalTitle className="fw-semibold">Enter Offline Settlement Details</CModalTitle>
          </CModalHeader>
          <CForm
            onSubmit={(e) => {
              e.preventDefault()
              handleConfirmOfflineSettle()
            }}
          >
            <CModalBody>
              <div className="mb-3">
                <CFormLabel htmlFor="offline-ref" className="small fw-semibold">
                  Transaction ID / Reference Number (Cheque/NEFT) *
                </CFormLabel>
                <CFormInput
                  id="offline-ref"
                  type="text"
                  placeholder="e.g. CHQ-92842 or UTR-28194"
                  value={settleRef}
                  onChange={(e) => setSettleRef(e.target.value)}
                  required
                  autoFocus
                  size="sm"
                />
              </div>
              <div className="mb-3">
                <CFormLabel htmlFor="offline-amount" className="small fw-semibold">
                  Payment Amount (₹) *
                </CFormLabel>
                <CFormInput
                  id="offline-amount"
                  type="number"
                  placeholder="0.00"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                  min="1"
                  max={maxAmount || undefined}
                  step="0.01"
                  size="sm"
                />
                {maxAmount > 0 && (
                  <div className="small text-muted mt-1">
                    Maximum allowed: ₹{maxAmount.toLocaleString('en-IN')}
                  </div>
                )}
              </div>
            </CModalBody>
            <CModalFooter>
              <CButton
                type="button"
                color="secondary"
                size="sm"
                onClick={() => {
                  setSettleInvoiceId(null)
                  setSettleRef('')
                  setSettleAmount('')
                }}
              >
                Cancel
              </CButton>
              <CButton
                type="submit"
                color="primary"
                size="sm"
                disabled={!settleRef.trim() || !settleAmount || settleAmount <= 0}
              >
                Record Settlement
              </CButton>
            </CModalFooter>
          </CForm>
        </CModal>
      </div>
    )
  },
)

BillingLedgerGrid.displayName = 'BillingLedgerGrid'

BillingLedgerGrid.propTypes = {
  kpis: PropTypes.object,
  invoices: PropTypes.array,
  pagination: PropTypes.object,
  loading: PropTypes.bool,
  onPageChange: PropTypes.func,
  onSettleOffline: PropTypes.func,
  onApproveOffline: PropTypes.func,
}

export default BillingLedgerGrid
