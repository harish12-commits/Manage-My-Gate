import React from 'react'

const FEATURE_ICONS = {
  'Visitor Management':
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  Billing:
    'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  Complaints:
    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  'Notice Board':
    'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H14',
  'Facility Booking':
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  'Staff Management':
    'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  'Vehicle Management':
    'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  Marketplace:
    'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  Polls:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  Analytics: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
  Security:
    'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z',
  Wallet: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
}

const ALL_FEATURES = Object.keys(FEATURE_ICONS)

export const UserOrganizationPanel = ({ activeEnquiry }) => {
  const selectedFeatures = activeEnquiry?.selectedFeatures || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Primary Contact */}
        <div className="border border-gray-100 p-4 rounded-lg bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">
            Primary Contact
          </h4>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Username</p>
              <p className="font-medium text-gray-900">{activeEnquiry.username}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="font-medium text-blue-600">{activeEnquiry.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="font-medium text-gray-900">{activeEnquiry.phone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Preferred Communication</p>
              <p className="font-medium text-gray-900">Email / Phone</p>
            </div>
          </div>
        </div>

        {/* Organization Details */}
        <div className="border border-gray-100 p-4 rounded-lg bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">
            Organization Details
          </h4>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Organization Name</p>
              <p className="font-medium text-gray-900">{activeEnquiry.organizationName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Community Type</p>
              <p className="font-medium text-gray-900">Residential Complex</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Units</p>
              <p className="font-medium text-gray-900">{activeEnquiry.totalUnits}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Expected Launch</p>
              <p className="font-medium text-gray-900">Within 30 Days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Internal CRM Information */}
      <div className="border border-gray-100 p-4 rounded-lg bg-indigo-50/30">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">
          Internal CRM Record
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Enquiry ID</p>
            <p className="font-medium text-gray-900 text-sm">{activeEnquiry.enquiryId}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Source</p>
            <p className="font-medium text-gray-900 text-sm">{activeEnquiry.source}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Campaign</p>
            <p className="font-medium text-gray-900 text-sm">Organic Search</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Assigned Team</p>
            <p className="font-medium text-gray-900 text-sm">Enterprise Sales EMEA</p>
          </div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">
          Platform Features Needed
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ALL_FEATURES.map((feature) => {
            const isSelected = selectedFeatures.includes(feature)
            return (
              <div
                key={feature}
                className={`p-3 rounded-lg border ${isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white opacity-50 grayscale'}`}
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`p-2 rounded-md ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d={FEATURE_ICONS[feature] || FEATURE_ICONS['Analytics']}
                      ></path>
                    </svg>
                  </span>
                  <div>
                    <p
                      className={`text-xs font-semibold ${isSelected ? 'text-indigo-900' : 'text-gray-500'}`}
                    >
                      {feature}
                    </p>
                    {isSelected && (
                      <span className="text-[10px] text-indigo-500 uppercase font-bold tracking-wider">
                        Requested
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
