import React from 'react'
import SubscriptionConfigurator from '../../../platformQuote/components/SubscriptionConfigurator.jsx'

const PricingTab = ({ lead, onQuoteTotalChange }) => {
  return (
    <div className="panel-body pricing-grid p-6 bg-white">
      <div className="panel shadow-none border border-gray-200 rounded-xl">
        <div className="panel-head flex justify-between items-center bg-gray-50 p-4 border-b border-gray-200 rounded-t-xl">
          <h2 className="text-xl font-bold text-gray-900 m-0">Feature & Pricing Customization</h2>
          <span className="bg-blue-100 text-blue-700 text-sm font-bold px-3 py-1 rounded-full">
            Master Pricing Applied
          </span>
        </div>
        <div className="panel-body p-6">
          <SubscriptionConfigurator
            quoteId={lead?._id || lead?.id || 'new-quote'}
            onQuoteTotalChange={onQuoteTotalChange}
          />
        </div>
      </div>
    </div>
  )
}

export default PricingTab
