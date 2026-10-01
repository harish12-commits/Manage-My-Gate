import React, { useEffect } from 'react'
import { useEnquiryDetail } from '../hooks/useEnquiryDetail.js'
import { OverviewPanel } from '../components/OverviewPanel.jsx'
import { SalesLifecyclePanel } from '../components/SalesLifecyclePanel.jsx'
import { UserOrganizationPanel } from '../components/UserOrganizationPanel.jsx'
import { AIInsightsPanel } from '../components/AIInsightsPanel.jsx'
import { FollowUpCard } from '../components/FollowUpCard.jsx'
// Import other panels as they are built...

export const EnquiryDetailView = ({ enquiryId, onBack }) => {
  const {
    activeEnquiry,
    activities,
    insights,
    loading,
    error,
    actionLoading,
    fetchFullEnquiryData,
    changeStage,
    createNewActivity,
    assignSalesExecutive,
    resetEnquiry,
    convertToOrg,
  } = useEnquiryDetail()

  useEffect(() => {
    if (enquiryId) {
      fetchFullEnquiryData(enquiryId)
    }
    return () => resetEnquiry()
  }, [enquiryId, fetchFullEnquiryData, resetEnquiry])

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error || !activeEnquiry) {
    return (
      <div className="p-8">
        <div className="mb-4 p-4 bg-red-100 text-red-700 border border-red-400 rounded">
          {error || 'Enquiry not found.'}
        </div>
        <button onClick={onBack} className="text-indigo-600 hover:underline font-medium">
          &larr; Back to Enquiries
        </button>
      </div>
    )
  }

  return (
    <div className="crm-360-dashboard bg-gray-50 min-h-screen pb-12">
      {/* Top Header Toolbar */}
      <div className="bg-white border-b sticky top-0 z-10 px-6 py-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <button
            onClick={onBack}
            className="text-indigo-600 hover:underline mb-1 text-sm font-medium flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              ></path>
            </svg>
            Back to List
          </button>
          <div className="flex items-center space-x-3 mt-1">
            <h1 className="text-2xl font-bold text-gray-900">{activeEnquiry.organizationName}</h1>
            <span
              className={`px-3 py-1 text-xs font-semibold rounded-full border 
              ${
                activeEnquiry.status === 'Won'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : activeEnquiry.status === 'Lost'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : 'bg-blue-100 text-blue-800 border-blue-200'
              }`}
            >
              {activeEnquiry.status}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1 flex space-x-4">
            <span>
              Enquiry ID:{' '}
              <span className="font-medium text-gray-700">{activeEnquiry.enquiryId}</span>
            </span>
            <span>
              Created:{' '}
              <span className="font-medium text-gray-700">
                {new Date(activeEnquiry.createdAt).toLocaleDateString()}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-4 md:mt-0 flex space-x-3">
          <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded shadow-sm hover:bg-gray-50">
            Edit
          </button>
          <button
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={activeEnquiry.status === 'Won'}
            onClick={() => convertToOrg(activeEnquiry._id)}
          >
            Convert to Customer
          </button>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto">
        <OverviewPanel activeEnquiry={activeEnquiry} insights={insights} activities={activities} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-5 rounded-lg border shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Sales Lifecycle</h3>
              <SalesLifecyclePanel
                activeEnquiry={activeEnquiry}
                stageHistory={stageHistory}
                activities={activities}
              />
            </div>

            <div className="bg-white p-5 rounded-lg border shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">User & Organization</h3>
              <UserOrganizationPanel activeEnquiry={activeEnquiry} />
            </div>
          </div>

          {/* Right Sidebar - Sticky */}
          <div className="space-y-6">
            <div className="sticky top-28 space-y-6">
              <AIInsightsPanel insights={insights} />

              {/* Quick Actions / FollowUpCard */}
              <FollowUpCard
                activeEnquiry={activeEnquiry}
                changeStage={changeStage}
                createNewActivity={createNewActivity}
                assignSalesExecutive={assignSalesExecutive}
                actionLoading={actionLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnquiryDetailView
