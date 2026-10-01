import React, { memo, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import BillingLedgerTable from '../components/BillingLedgerTable.jsx'
import { useBilling } from '../hooks/useBilling'
import { clearInvoicesGrid } from '../store/billingSlice'
import '../styles/_billing.scss'

/**
 * BillingDashboardView
 *
 * Admin dashboard tab — community billing ledger with KPI strip and data grid.
 */
const BillingDashboardView = memo(({ onRunBillingClick }) => {
  const dispatch = useDispatch()
  const billingData = useBilling()

  const {
    kpis,
    invoicesList,
    pagination,
    loadingStates,
    activeOrgId,
    loadAdminDashboard,
    changeTablePage,
    settleOffline,
    approveOffline,
    sendReminder,
  } = billingData

  useEffect(() => {
    if (activeOrgId) {
      loadAdminDashboard(activeOrgId)
      changeTablePage(1)
    }

    return () => {
      dispatch(clearInvoicesGrid())
    }
  }, [activeOrgId, loadAdminDashboard, changeTablePage, dispatch])

  return (
    <div className="billing-os-theme billing-dashboard-view">
      <div className="billing-dashboard-view__header">
        <div>
          <h4 className="billing-dashboard-view__title">Billing Ledger</h4>
          <p className="billing-dashboard-view__sub">
            All community invoices for the current billing period.
          </p>
        </div>
        <div className="billing-dashboard-view__header-actions d-flex align-items-center">
          {onRunBillingClick && (
            <button
              type="button"
              className="btn btn-primary d-inline-flex align-items-center me-2"
              style={{
                borderRadius: '10px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 600,
              }}
              onClick={onRunBillingClick}
            >
              <i className="fa-solid fa-play me-2" />
              Run Billing
            </button>
          )}
          <button type="button" className="billing-dashboard-view__export-btn">
            <i className="fa-solid fa-file-export me-2" />
            Export CSV
          </button>
        </div>
      </div>

      <BillingLedgerTable
        kpis={kpis}
        invoices={invoicesList}
        pagination={pagination}
        loading={loadingStates.fetchGrid || loadingStates.fetchKPIs}
        onPageChange={changeTablePage}
        onSettleOffline={settleOffline}
        onApproveOffline={approveOffline}
        onSendReminder={sendReminder}
      />
    </div>
  )
})

BillingDashboardView.displayName = 'BillingDashboardView'

export default BillingDashboardView
