import React from 'react'
import { usePlatformBilling } from '../hooks/usePlatformBilling'
import '../styles/_platformBilling.scss'

// Page Components
import DashboardPage from './pages/DashboardPage'
import MasterPricingManagement from '../../pricing/views/MasterPricingManagement'
import EnquiriesPage from './pages/EnquiriesPage'
import OrderDetailsView from './pages/OrderDetailsView.jsx'
import InvoiceLedgerView from './pages/InvoiceLedgerView.jsx'
import SubscriptionManagerView from './pages/SubscriptionManagerView.jsx'
import PlatformQuotesView from './pages/PlatformQuotesView.jsx'
import ProvisioningJobsView from './pages/ProvisioningJobsView.jsx'
import ConversationsView from './pages/ConversationsView.jsx'
import EmptyGridView from './pages/EmptyGridView.jsx'

const navGroups = [
  {
    group: 'Platform',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '▦' },
      { id: 'pricing', label: 'Master Pricing', icon: '₹' },
      { id: 'enquiries', label: 'Enquiries', icon: '◉' },
      { id: 'quotes', label: 'Quotes', icon: '▤' },
      { id: 'orders', label: 'Orders', icon: '□' },
      { id: 'invoices', label: 'Invoices', icon: '▧' },
      { id: 'subscriptions', label: 'Subscriptions', icon: '↻' },
    ],
  },
  {
    group: 'CRM',
    items: [
      { id: 'meetings', label: 'Meetings', icon: '◷' },
      { id: 'conversations', label: 'Conversations', icon: '✉' },
    ],
  },
]

const PlatformBillingLayout = () => {
  const { activePage, changePage, fetchAllData } = usePlatformBilling()

  React.useEffect(() => {
    fetchAllData()
  }, [])

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />
      case 'pricing':
        return <MasterPricingManagement />
      case 'enquiries':
        return <EnquiriesPage />
      case 'quotes':
        return <PlatformQuotesView />
      case 'orders':
        return <OrderDetailsView />
      case 'invoices':
        return <InvoiceLedgerView />
      case 'subscriptions':
        return <SubscriptionManagerView />
      case 'provisioning':
        return <ProvisioningJobsView />
      case 'meetings':
        return <EmptyGridView title="Meetings" sub="Calendar Grid" />
      case 'conversations':
        return <ConversationsView />
      default:
        return <DashboardPage />
    }
  }

  return (
    <div className="platform-billing-module">
      <div className="app">
        {/* ── Top navigation bar (Notice Board style) ── */}
        <nav className="top-nav" aria-label="Platform Billing Navigation">
          {navGroups.map((group, gIdx) => (
            <div className="top-nav-group" key={group.group}>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => changePage(item.id)}
                  className={`nav-item${activePage === item.id ? ' active' : ''}`}
                  aria-current={activePage === item.id ? 'page' : undefined}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
              {gIdx < navGroups.length - 1 && <div className="nav-divider" />}
            </div>
          ))}
        </nav>

        {/* ── Main content area ── */}
        <main className="main">
          <div className="content">{renderContent()}</div>
        </main>
      </div>
    </div>
  )
}

export default PlatformBillingLayout
