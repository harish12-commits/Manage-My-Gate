import React from 'react'
import { usePlatformBilling } from '../../hooks/usePlatformBilling'

const DashboardPage = () => {
  const { changePage } = usePlatformBilling()

  return (
    <section id="page-dashboard" className="page">
      <div className="page-head">
        <div>
          <h1>Platform Overview</h1>
          <div className="sub">Sales, pricing, billing and provisioning at a glance.</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => changePage('enquiries')}>
            Open CRM Workspace
          </button>
        </div>
      </div>

      <div className="cards">
        <div className="card">
          <div className="kpi-label">Open Enquiries</div>
          <div className="kpi-value">24</div>
          <div className="kpi-foot">↑ 12% this month</div>
        </div>

        <div className="card">
          <div className="kpi-label">Quotes Awaiting Action</div>
          <div className="kpi-value">8</div>
          <div className="kpi-foot">3 need approval</div>
        </div>

        <div className="card">
          <div className="kpi-label">Active Free Trials</div>
          <div className="kpi-value">12</div>
          <div className="kpi-foot">↑ 4 starting this week</div>
        </div>

        <div className="card">
          <div className="kpi-label">Active Subscriptions</div>
          <div className="kpi-value">86</div>
          <div className="kpi-foot">↑ 9 new this month</div>
        </div>
      </div>
    </section>
  )
}

export default DashboardPage
