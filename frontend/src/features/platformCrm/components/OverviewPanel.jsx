import React from 'react'

export const OverviewPanel = ({ activeEnquiry, insights, activities }) => {
  if (!activeEnquiry) return null

  // Compute activity stats
  const followUpCount =
    activities?.filter((a) => a.type === 'Call' || a.type === 'Meeting' || a.type === 'Email')
      .length || 0
  const lastContact = activities?.find(
    (a) => a.type === 'Call' || a.type === 'Meeting' || a.type === 'Email',
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      {/* Organization Summary */}
      <div className="bg-white p-5 rounded-lg border shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">
          Organization Summary
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">Organization</span>
            <span className="font-medium text-gray-900 text-sm text-right">
              {activeEnquiry.organizationName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">Contact Person</span>
            <span className="font-medium text-gray-900 text-sm text-right">
              {activeEnquiry.username}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">Phone</span>
            <span className="font-medium text-gray-900 text-sm text-right">
              {activeEnquiry.phone}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">Email</span>
            <span
              className="text-blue-600 text-sm text-right truncate max-w-[150px]"
              title={activeEnquiry.email}
            >
              {activeEnquiry.email}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">Total Units</span>
            <span className="font-medium text-gray-900 text-sm text-right">
              {activeEnquiry.totalUnits}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">Current Status</span>
            <span className="font-medium text-blue-700 text-sm text-right">
              {activeEnquiry.status}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white p-5 rounded-lg border shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">
          Financial Summary
        </h3>
        <div className="space-y-4">
          <div className="bg-green-50 p-3 rounded border border-green-100 flex justify-between items-center">
            <span className="text-green-800 text-sm font-medium">Est. Monthly Revenue</span>
            <span className="text-green-900 font-bold text-lg">
              ${insights?.revenueEstimate?.monthly || 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Est. Annual Revenue</span>
            <span className="font-medium text-gray-900 text-sm">
              ${insights?.revenueEstimate?.annual || 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Recommended Plan</span>
            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
              {activeEnquiry.totalUnits > 500 ? 'ENTERPRISE' : 'GROWTH'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Expected Onboarding</span>
            <span className="font-medium text-gray-900 text-sm">
              ${activeEnquiry.totalUnits * 5} (One-time)
            </span>
          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="bg-white p-5 rounded-lg border shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">
          Activity Summary
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Total Follow-ups</span>
            <span className="font-bold text-indigo-600 text-lg">{followUpCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">Last Contact</span>
            <span className="font-medium text-gray-900 text-sm text-right">
              {lastContact ? new Date(lastContact.createdAt).toLocaleDateString() : 'Never'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">Demo Status</span>
            <span className="font-medium text-gray-900 text-sm text-right">
              {activeEnquiry.status === 'Demo Scheduled' ||
              activeEnquiry.status === 'Demo Completed'
                ? 'Scheduled/Completed'
                : 'Pending'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">Proposal Status</span>
            <span className="font-medium text-gray-900 text-sm text-right">
              {['Proposal Sent', 'Negotiation', 'Won'].includes(activeEnquiry.status)
                ? 'Sent'
                : 'Pending'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
