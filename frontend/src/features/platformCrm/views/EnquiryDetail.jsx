import React, { useEffect, useState } from 'react'
import { usePlatformCrm } from '../hooks/usePlatformCrm.js'

export const EnquiryDetail = ({ enquiryId, onBack }) => {
  const {
    activeEnquiry,
    loading,
    error,
    fetchEnquiryDetails,
    changeEnquiryStatus,
    assignSalesExecutive,
    convertEnquiryToCustomer,
    resetActiveEnquiry,
    actionLoading,
  } = usePlatformCrm()

  const [notesInput, setNotesInput] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedExecutive, setSelectedExecutive] = useState('')

  // Mock list of executives - ideally fetched from an API
  const salesExecutives = [
    { id: '64f1b2c3e4b0c1d2e3f4a5b6', name: 'Alice Smith' },
    { id: '64f1b2c3e4b0c1d2e3f4a5b7', name: 'Bob Jones' },
  ]

  const statuses = [
    'New',
    'Contacted',
    'Demo Scheduled',
    'Proposal Sent',
    'Negotiation',
    'Won',
    'Lost',
  ]

  useEffect(() => {
    if (enquiryId) {
      fetchEnquiryDetails(enquiryId)
    }
    return () => resetActiveEnquiry()
  }, [enquiryId, fetchEnquiryDetails, resetActiveEnquiry])

  useEffect(() => {
    if (activeEnquiry) {
      setSelectedStatus(activeEnquiry.status)
      setSelectedExecutive(activeEnquiry.assignedTo?._id || activeEnquiry.assignedTo || '')
      setNotesInput(activeEnquiry.notes || '')
    }
  }, [activeEnquiry])

  const handleStatusChange = () => {
    if (selectedStatus !== activeEnquiry?.status) {
      changeEnquiryStatus(enquiryId, { status: selectedStatus, notes: notesInput })
    }
  }

  const handleAssign = () => {
    if (selectedExecutive !== (activeEnquiry?.assignedTo?._id || activeEnquiry?.assignedTo)) {
      assignSalesExecutive(enquiryId, { assignedTo: selectedExecutive })
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading enquiry details...</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-400 rounded">
          {error}
        </div>
        <button onClick={onBack} className="text-blue-600 hover:underline">
          &larr; Back to List
        </button>
      </div>
    )
  }

  if (!activeEnquiry) return null

  return (
    <div className="enquiry-detail-container p-6 bg-white shadow-md rounded-lg">
      <div className="header flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <button onClick={onBack} className="text-blue-600 hover:underline mb-2 text-sm">
            &larr; Back to List
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Enquiry: {activeEnquiry.enquiryId}</h1>
          <span className="text-sm text-gray-500">
            Submitted on {new Date(activeEnquiry.createdAt).toLocaleString()}
          </span>
        </div>
        <div>
          <button
            className="px-4 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-700 disabled:opacity-50"
            disabled={activeEnquiry.status === 'Won' || actionLoading}
            onClick={() => convertEnquiryToCustomer(enquiryId)}
          >
            Convert to Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-gray-50 p-4 rounded border">
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">Organization Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Organization Name</p>
                <p className="font-medium text-gray-900">{activeEnquiry.organizationName}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Units</p>
                <p className="font-medium text-gray-900">{activeEnquiry.totalUnits}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded border">
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">Contact Person</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{activeEnquiry.username}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{activeEnquiry.email}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{activeEnquiry.phone}</p>
              </div>
              <div>
                <p className="text-gray-500">Source</p>
                <p className="font-medium text-gray-900">{activeEnquiry.source}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded border">
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">Interested Features</h3>
            <div className="flex flex-wrap gap-2">
              {activeEnquiry.selectedFeatures?.map((feature) => (
                <span
                  key={feature}
                  className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                >
                  {feature}
                </span>
              ))}
              {(!activeEnquiry.selectedFeatures || activeEnquiry.selectedFeatures.length === 0) && (
                <span className="text-gray-500 text-sm">No features selected</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Actions */}
        <div className="space-y-6">
          <div className="bg-white p-4 rounded border shadow-sm">
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">CRM Actions</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status Pipeline
              </label>
              <div className="flex space-x-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded text-sm"
                  disabled={activeEnquiry.status === 'Won'}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleStatusChange}
                  disabled={
                    actionLoading ||
                    selectedStatus === activeEnquiry.status ||
                    activeEnquiry.status === 'Won'
                  }
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                >
                  Update
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign Executive
              </label>
              <div className="flex space-x-2">
                <select
                  value={selectedExecutive}
                  onChange={(e) => setSelectedExecutive(e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded text-sm"
                  disabled={activeEnquiry.status === 'Won'}
                >
                  <option value="">-- Unassigned --</option>
                  {salesExecutives.map((exec) => (
                    <option key={exec.id} value={exec.id}>
                      {exec.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssign}
                  disabled={
                    actionLoading ||
                    selectedExecutive ===
                      (activeEnquiry.assignedTo?._id || activeEnquiry.assignedTo) ||
                    activeEnquiry.status === 'Won'
                  }
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                >
                  Assign
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Follow-up Notes
              </label>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm h-24"
                placeholder="Add notes from demo or calls..."
                disabled={activeEnquiry.status === 'Won'}
              ></textarea>
              <button
                onClick={handleStatusChange}
                disabled={
                  actionLoading ||
                  notesInput === (activeEnquiry.notes || '') ||
                  activeEnquiry.status === 'Won'
                }
                className="mt-2 w-full px-3 py-2 border border-blue-600 text-blue-600 rounded text-sm hover:bg-blue-50 disabled:opacity-50"
              >
                Save Notes
              </button>
            </div>

            <div className="mt-4 pt-4 border-t">
              <button
                className="w-full px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                disabled={activeEnquiry.status === 'Won'}
              >
                Schedule Demo (Google Meet)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnquiryDetail
