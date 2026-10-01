import React, { memo, useEffect, useMemo } from 'react'
import HeroLiabilityBanner from '../components/HeroLiabilityBanner'
import TenantComplianceBadge from '../components/TenantComplianceBadge'
import { useBilling } from '../hooks/useBilling'
import { openInvoicePrintWindow } from '../utils/invoiceTemplate'
import '../styles/_billing.scss'

/**
 * ResidentActionCenterView
 *
 * Mobile-first financial command center for residents (owners + tenants).
 * Renders the HeroLiabilityBanner and TenantComplianceBadge in a responsive grid.
 */
const ResidentActionCenterView = memo(() => {
  const {
    activeDues,
    loadResidentDues,
    settleOffline,
    walletBalance,
    payInvoiceWallet,
    payInvoiceRazorpay,
    verifyRazorpay,
    loadingStates,
  } = useBilling()

  const handleDownloadInvoice = (item) => {
    openInvoicePrintWindow(item)
  }

  useEffect(() => {
    loadResidentDues()

    const handleRefresh = () => {
      loadResidentDues()
    }

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadResidentDues()
      }
    }

    window.addEventListener('billing:refreshDues', handleRefresh)
    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)

    return () => {
      window.removeEventListener('billing:refreshDues', handleRefresh)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
    }
  }, [loadResidentDues])

  const currentPeriod = useMemo(() => {
    const now = new Date()
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]
    return `${months[now.getMonth()]} ${now.getFullYear()}`
  }, [])

  if (
    loadingStates.fetchDues &&
    !activeDues?.unitBreakdown?.length &&
    !activeDues?.secondaryCompliance?.length
  ) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center py-5 my-5">
        <div className="spinner-border text-primary spinner-border-lg" role="status">
          <span className="visually-hidden">Loading financials...</span>
        </div>
        <span className="text-muted mt-3 fw-semibold small">Fetching outstanding dues...</span>
      </div>
    )
  }

  return (
    <div className="billing-os-theme resident-action-center">
      <div className="resident-action-center__header">
        <div className="resident-action-center__header-left">
          <h4 className="resident-action-center__title">My Financials</h4>
          <p className="resident-action-center__sub">
            Current billing status and outstanding dues for your units.
          </p>
        </div>
        <div className="resident-action-center__period-badge">
          <i className="fa-solid fa-calendar-days me-2" />
          {currentPeriod}
        </div>
      </div>

      <div className="resident-action-center__grid">
        {/* Column 1 — Hero card (left / top on mobile) */}
        <div className="resident-action-center__col resident-action-center__col--hero">
          <HeroLiabilityBanner
            activeDues={activeDues}
            settleOffline={settleOffline}
            walletBalance={walletBalance}
            payInvoiceWallet={payInvoiceWallet}
            payInvoiceRazorpay={payInvoiceRazorpay}
            verifyRazorpay={verifyRazorpay}
            loadingStates={loadingStates}
          />
        </div>

        {/* Column 2 — Tenant compliance (right / bottom on mobile) */}
        <div className="resident-action-center__col resident-action-center__col--compliance">
          <TenantComplianceBadge activeDues={activeDues} />
        </div>
      </div>

      {/* ── Recent Invoices / History ─────────────────────────────────────── */}
      {activeDues?.recentInvoices && activeDues.recentInvoices.length > 0 && (
        <div className="invoice-history">
          <h5 className="invoice-history__title">
            <i className="fa-solid fa-receipt" />
            Recent Invoice History
          </h5>
          <div className="invoice-history__table-wrap">
            <table className="invoice-history__table">
              <thead className="invoice-history__thead">
                <tr>
                  <th className="invoice-history__th">Period</th>
                  <th className="invoice-history__th">Unit</th>
                  <th className="invoice-history__th">Billed</th>
                  <th className="invoice-history__th">Paid</th>
                  <th className="invoice-history__th">Balance</th>
                  <th className="invoice-history__th">Status</th>
                  <th className="invoice-history__th">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {activeDues.recentInvoices.map((inv) => (
                  <tr key={inv.invoiceId || inv._id} className="invoice-history__row">
                    <td className="invoice-history__cell">
                      <div className="invoice-history__period">{inv.billingPeriodString}</div>
                      <div className="invoice-history__assessment-name">
                        {inv.assessmentName || 'Maintenance'}
                      </div>
                    </td>
                    <td className="invoice-history__cell">
                      <span className="invoice-history__unit">{inv.unitNumber}</span>
                    </td>
                    <td className="invoice-history__cell">
                      <span className="invoice-history__amount">
                        ₹{(inv.totalDue || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="invoice-history__cell">
                      <span style={{ fontWeight: 600, color: '#065F46' }}>
                        ₹{(inv.paidAmount || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="invoice-history__cell">
                      <span className="invoice-history__amount">
                        ₹{(inv.outstandingAmount ?? inv.totalDue ?? 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="invoice-history__cell">
                      <span
                        className={`invoice-history__status ${
                          inv.status === 'PAID'
                            ? 'invoice-history__status--paid'
                            : inv.status === 'PARTIALLY_PAID'
                              ? 'invoice-history__status--partial'
                              : inv.status === 'UNPAID' || inv.status === 'OVERDUE'
                                ? 'invoice-history__status--unpaid'
                                : 'invoice-history__status--other'
                        }`}
                      >
                        {inv.status ? inv.status.replace('_', ' ') : 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="invoice-history__cell">
                      <button
                        type="button"
                        className="invoice-history__receipt-btn"
                        onClick={() => handleDownloadInvoice(inv)}
                      >
                        <i className="fa-solid fa-download" /> Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
})

ResidentActionCenterView.displayName = 'ResidentActionCenterView'

export default ResidentActionCenterView
