import React from 'react'
import Panel from './Panel'
import Badge from './Badge'
import Button from './Button'

// Generic Table Layout
const TableLayout = ({ title, subtitle, headers, children }) => (
  <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
    <div>
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
    <Panel className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider px-4 py-3 border-b border-slate-200"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </Panel>
  </div>
)

export const QuotesList = () => (
  <TableLayout
    title="Quotes"
    subtitle="Manage generated price quotes."
    headers={['Quote ID', 'Organization', 'Total Value', 'Status', 'Actions']}
  >
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-900">
        QT-2026-081
      </td>
      <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-700">
        Atominos Consulting
      </td>
      <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-700">₹93,409</td>
      <td className="px-4 py-3 border-b border-slate-100">
        <Badge color="blue">SENT</Badge>
      </td>
      <td className="px-4 py-3 border-b border-slate-100">
        <Button variant="outline" size="small">
          Download PDF
        </Button>
      </td>
    </tr>
  </TableLayout>
)

export const OrdersList = () => (
  <TableLayout
    title="Orders"
    subtitle="Confirmed orders awaiting provisioning."
    headers={['Order ID', 'Organization', 'Date', 'Status', 'Actions']}
  >
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-900">
        ORD-9921
      </td>
      <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-700">
        Sunrise Valley Estates
      </td>
      <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-700">18 Aug 2026</td>
      <td className="px-4 py-3 border-b border-slate-100">
        <Badge color="green">PAID</Badge>
      </td>
      <td className="px-4 py-3 border-b border-slate-100">
        <Button variant="primary" size="small">
          View Receipt
        </Button>
      </td>
    </tr>
  </TableLayout>
)

export const InvoicesList = () => (
  <TableLayout
    title="Invoices"
    subtitle="Billing invoices and receipts."
    headers={['Invoice ID', 'Organization', 'Amount', 'Status', 'Actions']}
  >
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-900">
        INV-4402
      </td>
      <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-700">
        Oceanview Towers
      </td>
      <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-700">₹1,20,000</td>
      <td className="px-4 py-3 border-b border-slate-100">
        <Badge color="green">PAID</Badge>
      </td>
      <td className="px-4 py-3 border-b border-slate-100">
        <Button variant="outline" size="small">
          Download PDF
        </Button>
      </td>
    </tr>
  </TableLayout>
)

export const SubscriptionsList = () => (
  <TableLayout
    title="Subscriptions"
    subtitle="Active tenant subscriptions."
    headers={['Sub ID', 'Organization', 'Plan', 'Status', 'Actions']}
  >
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-900">
        SUB-112
      </td>
      <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-700">
        Atominos Consulting
      </td>
      <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-700">Enterprise</td>
      <td className="px-4 py-3 border-b border-slate-100">
        <Badge color="blue">ACTIVE TRIAL</Badge>
      </td>
      <td className="px-4 py-3 border-b border-slate-100">
        <Button variant="primary" size="small">
          Convert to Paid
        </Button>
      </td>
    </tr>
  </TableLayout>
)

export const ProvisioningJobsList = () => (
  <TableLayout
    title="Provisioning Jobs"
    subtitle="Background workers and setup tasks."
    headers={['Job ID', 'Organization', 'Progress', 'Status', 'Actions']}
  >
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-900">
        JOB-883
      </td>
      <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-700">Sunset Villas</td>
      <td className="px-4 py-3 border-b border-slate-100 text-sm text-slate-700">4/7 Steps</td>
      <td className="px-4 py-3 border-b border-slate-100">
        <Badge color="orange">IN PROGRESS</Badge>
      </td>
      <td className="px-4 py-3 border-b border-slate-100">
        <Button variant="outline" size="small">
          View Logs
        </Button>
      </td>
    </tr>
  </TableLayout>
)
