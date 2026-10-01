import React, { useState } from 'react'

const STAGES = [
  'New',
  'Contacted',
  'Demo Scheduled',
  'Demo Completed',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
]

export const FollowUpCard = ({
  activeEnquiry,
  changeStage,
  createNewActivity,
  assignSalesExecutive,
  actionLoading,
}) => {
  const [activeTab, setActiveTab] = useState('status') // 'status', 'note', 'assign'

  // Status State
  const [selectedStatus, setSelectedStatus] = useState(activeEnquiry?.status || 'New')

  // Note State
  const [noteContent, setNoteContent] = useState('')

  // Assign State
  const [selectedExecutive, setSelectedExecutive] = useState(
    activeEnquiry?.assignedTo?._id || activeEnquiry?.assignedTo || '',
  )
  const salesExecutives = [
    { id: '64f1b2c3e4b0c1d2e3f4a5b6', name: 'Alice Smith' },
    { id: '64f1b2c3e4b0c1d2e3f4a5b7', name: 'Bob Jones' },
  ]

  if (!activeEnquiry) return null
  const isWon = activeEnquiry.status === 'Won'

  const handleUpdateStatus = () => {
    if (selectedStatus !== activeEnquiry.status) {
      changeStage(activeEnquiry._id, { stage: selectedStatus })
    }
  }

  const handleSaveNote = async () => {
    if (noteContent.trim()) {
      await createNewActivity(activeEnquiry._id, { type: 'Note', description: noteContent })
      setNoteContent('')
    }
  }

  const handleAssign = () => {
    if (selectedExecutive !== (activeEnquiry.assignedTo?._id || activeEnquiry.assignedTo)) {
      assignSalesExecutive(activeEnquiry._id, { assignedTo: selectedExecutive })
    }
  }

  return (
    <div className="bg-white p-5 rounded-lg border shadow-sm">
      <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          className={`pb-2 px-1 text-sm font-medium mr-4 border-b-2 ${activeTab === 'status' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('status')}
        >
          Status
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium mr-4 border-b-2 ${activeTab === 'note' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('note')}
        >
          Add Note
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 ${activeTab === 'assign' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('assign')}
        >
          Assign
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[120px]">
        {activeTab === 'status' && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-700">Update Sales Stage</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isWon}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={handleUpdateStatus}
              disabled={actionLoading || selectedStatus === activeEnquiry.status || isWon}
              className="w-full px-3 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Updating...' : 'Update Stage'}
            </button>
          </div>
        )}

        {activeTab === 'note' && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-700">Follow-up Note</label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm h-20 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Log call details, meeting notes..."
              disabled={isWon}
            ></textarea>
            <button
              onClick={handleSaveNote}
              disabled={actionLoading || !noteContent.trim() || isWon}
              className="w-full px-3 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        )}

        {activeTab === 'assign' && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-700">Assign Executive</label>
            <select
              value={selectedExecutive}
              onChange={(e) => setSelectedExecutive(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isWon}
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
                selectedExecutive === (activeEnquiry.assignedTo?._id || activeEnquiry.assignedTo) ||
                isWon
              }
              className="w-full px-3 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t">
        <button
          className="w-full px-3 py-2 border border-purple-600 text-purple-600 rounded text-sm font-medium hover:bg-purple-50 transition-colors disabled:opacity-50 flex justify-center items-center"
          disabled={isWon}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            ></path>
          </svg>
          Schedule Demo
        </button>
      </div>
    </div>
  )
}
