import React from 'react'
import KpiCard from '../../../components/common/KpiCard'
import Button from '../../../components/common/Button'

const Dashboard = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Platform Overview</h2>
          <p className="text-sm text-slate-500 mt-1">
            Super Admin global metrics and system health.
          </p>
        </div>
        <Button variant="primary">Open CRM Workspace</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard label="Open Enquiries" value="24" trend="↑ 3 today" trendDirection="up" />
        <KpiCard
          label="Quotes Awaiting Action"
          value="8"
          trend="Requires follow up"
          trendDirection="neutral"
        />
        <KpiCard
          label="Active Free Trials"
          value="12"
          trend="2 expiring soon"
          trendDirection="down"
        />
        <KpiCard label="Active Subscriptions" value="86" trend="↑ 12% MRR" trendDirection="up" />
      </div>
    </div>
  )
}

export default Dashboard
