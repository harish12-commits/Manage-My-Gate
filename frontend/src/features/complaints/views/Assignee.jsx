import React, { useEffect, useState } from 'react'
import { useComplaints } from '../hooks/useComplaints'
import ComplaintTopNav from '../components/ComplaintTopNav'
import '../styles/_complaints.scss'
import toast from 'react-hot-toast'
import { useAuth } from '../../auth/hooks/useAuth'
import ComplaintDetails from './ComplaintDetails'

const Assignee = () => {
  const { currentUser: user } = useAuth()

  const [filterParams, setFilterParams] = useState({
    page: 1,
    limit: 10,
    search: '',
    status: '',
  })

  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filterParams.search)
    }, 500)
    return () => clearTimeout(handler)
  }, [filterParams.search])

  // Optionally filter by assignedTechnicianId backend, assuming backend doesn't, we will filter frontend for now
  // Wait, the API returns all complaints or only permitted? If we are Admin, we see all.
  // For Technician/Staff, they only see assigned ones if RBAC is configured on backend.
  // Let's pass assignedTechnicianId if needed, but it's best to rely on backend or filter list.
  const activeFilters = {
    ...filterParams,
    search: debouncedSearch,
  }

  const {
    complaints,
    pagination,
    isLoading,
    acceptAssignment,
    rejectAssignment,
    startWork,
    pauseWork,
    resumeWork,
    markWorkCompleted,
    uploadWorkAttachments,
    addWorkNotes,
    uploadFiles,
  } = useComplaints(activeFilters)

  // Filter for currently logged-in user or admin view
  const assignedComplaints = (complaints || []).filter((c) => {
    const uid = String(user?.id || user?._id || user?.userId || '')
    const techId = String(user?.technicianId || user?.techId || '')
    const userRole = user?.role || ''
    const userRoles = Array.isArray(user?.roles) ? user.roles : []
    const isAdmin =
      userRoles.some((r) =>
        ['Admin', 'Community Admin', 'FacilityManager', 'Manager', 'Facility Manager'].includes(r),
      ) ||
      ['Admin', 'Community Admin', 'FacilityManager', 'Manager', 'Facility Manager'].includes(
        userRole,
      )

    // Explicitly exclude unassigned complaints / initial open states
    if (
      ['Open', 'Submitted', 'Waiting For Assignment'].includes(c.status) &&
      !c.assignedTechnicianId &&
      !c.assignedTechnicianName &&
      !c.isBroadcast
    ) {
      return false
    }

    // Admins and Facility Managers on Assignee Portal can view all allocated tasks
    if (isAdmin) {
      return true
    }

    if (!uid && !techId) return false

    const assigneeIdStr =
      typeof c.assignedTechnicianId === 'object' && c.assignedTechnicianId !== null
        ? String(c.assignedTechnicianId._id || c.assignedTechnicianId.id || '')
        : String(c.assignedTechnicianId || '')

    const isDirectMatch = Boolean(
      assigneeIdStr && (assigneeIdStr === uid || (techId && assigneeIdStr === techId)),
    )

    const currentUserName = (
      user?.name ||
      user?.username ||
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    ).toLowerCase()
    const assignedName = (c.assignedTechnicianName || '').toLowerCase()
    const isNameMatch = Boolean(assignedName && currentUserName && assignedName === currentUserName)

    const isBroadcastMatch = Boolean(
      c.isBroadcast &&
      c.status === 'Waiting For Acceptance' &&
      c.broadcastTechnicianIds?.some((bid) => {
        const bidStr =
          typeof bid === 'object' && bid !== null
            ? String(bid._id || bid.id || '')
            : String(bid || '')
        return Boolean(bidStr && (bidStr === uid || (techId && bidStr === techId)))
      }),
    )

    return isDirectMatch || isNameMatch || isBroadcastMatch
  })

  console.log('[DEBUG] Raw complaints array from Redux:', complaints)
  console.log('[DEBUG] Filtered assignedComplaints array:', assignedComplaints)

  const [selectedComplaintId, setSelectedComplaintId] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [actionReason, setActionReason] = useState('')
  const [activeComplaint, setActiveComplaint] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])

  const formatDate = (dateString) => {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= (pagination?.totalPages || 1)) {
      setFilterParams((prev) => ({ ...prev, page: newPage }))
    }
  }

  const onAccept = async (e, id) => {
    e.stopPropagation()
    try {
      await acceptAssignment(id)
      toast.success('Assignment accepted')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to accept assignment')
    }
  }

  const onReject = (e, complaint) => {
    e.stopPropagation()
    setActiveComplaint(complaint)
    setActionReason('')
    setShowRejectModal(true)
  }

  const submitReject = async () => {
    try {
      await rejectAssignment(activeComplaint._id, actionReason)
      toast.success('Assignment rejected')
      setShowRejectModal(false)
    } catch (err) {
      toast.error('Failed to reject assignment')
    }
  }

  const onStartWork = async (e, id) => {
    e.stopPropagation()
    try {
      await startWork(id)
      toast.success('Work started')
    } catch (err) {
      toast.error('Failed to start work')
    }
  }

  const onPause = (e, complaint) => {
    e.stopPropagation()
    setActiveComplaint(complaint)
    setActionReason('')
    setShowPauseModal(true)
  }

  const submitPause = async () => {
    try {
      await pauseWork(activeComplaint._id, actionReason)
      toast.success('Work paused')
      setShowPauseModal(false)
    } catch (err) {
      console.error('[DEBUG] submitPause error:', err)
      toast.error(err?.response?.data?.message || err?.message || err || 'Failed to pause work')
    }
  }

  const onResumeWork = async (e, id) => {
    e.stopPropagation()
    try {
      await resumeWork(id)
      toast.success('Work resumed')
    } catch (err) {
      toast.error('Failed to resume work')
    }
  }

  const onComplete = (e, complaint) => {
    e.stopPropagation()
    setActiveComplaint(complaint)
    setActionReason('')
    setShowCompleteModal(true)
  }

  const submitComplete = async () => {
    try {
      await markWorkCompleted(activeComplaint._id, { notes: actionReason, attachments: [] })
      toast.success('Work marked as completed')
      setShowCompleteModal(false)
    } catch (err) {
      toast.error('Failed to mark work as completed')
    }
  }

  const submitUpload = async () => {
    if (selectedFiles.length === 0) return toast.error('Please select at least one photo')

    try {
      const formData = new FormData()
      Array.from(selectedFiles).forEach((file) => formData.append('attachments', file))

      const fileUrls = await uploadFiles(formData)
      await uploadWorkAttachments(activeComplaint._id, fileUrls)
      toast.success('Photos uploaded successfully')
      setShowUploadModal(false)
      setSelectedFiles([])
    } catch (err) {
      toast.error('Failed to upload photos')
    }
  }

  const submitNotes = async () => {
    try {
      await addWorkNotes(activeComplaint._id, actionReason)
      toast.success('Notes added successfully')
      setShowNotesModal(false)
    } catch (err) {
      toast.error('Failed to add notes')
    }
  }

  const newAssignmentsCount = assignedComplaints.filter(
    (c) => c.status === 'Assigned' || c.status === 'Waiting For Acceptance',
  ).length

  return (
    <div className="complaints-module-wrapper complaints-os-theme">
      <ComplaintTopNav />
      <div className="view-container">
        <div className="view active">
          {/* Page header moved into card header */}
          {newAssignmentsCount > 0 && (
            <div
              style={{
                backgroundColor: 'var(--primary-pale)',
                border: '1px solid var(--primary-base)',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary-base)' }}></i>
              <div>
                <strong>Admin allocated work:</strong> You have {newAssignmentsCount} new pending
                assignment{newAssignmentsCount > 1 ? 's' : ''}.
              </div>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '32px',
            }}
          >
            <div>
              <h2 style={{ margin: 0 }} className="fs-2">
                Assignee Portal
              </h2>
            </div>
          </div>

          <div
            className="filter-row"
            style={{ marginBottom: '24px', justifyContent: 'flex-start' }}
          >
            <div className="search-bar" style={{ flex: '0 0 350px' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--ink-faint)' }}></i>
              <input
                type="text"
                placeholder="Search by Ticket ID..."
                value={filterParams.search}
                onChange={(e) =>
                  setFilterParams({ ...filterParams, search: e.target.value, page: 1 })
                }
              />
            </div>
            <select
              className="filter-select"
              value={filterParams.status}
              onChange={(e) =>
                setFilterParams({ ...filterParams, status: e.target.value, page: 1 })
              }
            >
              <option value="">All Statuses</option>
              <option value="Waiting For Acceptance">Waiting For Acceptance</option>
              <option value="Assigned">Assigned / Accepted</option>
              <option value="In Progress">In Progress</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Ticket No.</th>
                    <th>Subject</th>
                    <th>Priority</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedComplaints.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center' }}>
                        No assigned tasks found.
                      </td>
                    </tr>
                  )}
                  {assignedComplaints.map((c) => (
                    <tr
                      key={c._id}
                      onClick={() => setSelectedComplaintId(c._id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="fw-semibold">#{c.complaintNumber}</td>
                      <td>{c.subject}</td>
                      <td>
                        <span
                          className={`badge ${
                            c.priority === 'High'
                              ? 'badge-error'
                              : c.priority === 'Medium'
                                ? 'badge-warning'
                                : 'badge-info'
                          }`}
                        >
                          {c.priority}
                        </span>
                      </td>
                      <td>{c.category}</td>
                      <td>
                        <span className="status-indicator">
                          <span
                            className={`status-dot ${c.status === 'Resolved' || c.status === 'Closed' ? 'bg-success' : c.status === 'In Progress' ? 'bg-primary' : 'bg-warning'}`}
                          ></span>
                          {c.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {(c.status === 'Waiting For Acceptance' || c.status === 'Assigned') && (
                            <>
                              <button
                                className="small btn btn-primary"
                                style={{ padding: '4px 12px' }}
                                onClick={(e) => onAccept(e, c._id)}
                              >
                                Accept
                              </button>
                              <button
                                className="small btn btn-ghost"
                                style={{ padding: '4px 12px', color: 'var(--critical)' }}
                                onClick={(e) => onReject(e, c)}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {(c.status === 'Accepted' || c.status === 'Assigned') && (
                            <button
                              className="small btn btn-primary"
                              style={{ padding: '4px 12px' }}
                              onClick={(e) => onStartWork(e, c._id)}
                            >
                              Start Work
                            </button>
                          )}
                          {c.status === 'In Progress' && (
                            <>
                              <button
                                className="small btn btn-primary"
                                style={{ padding: '4px 12px', background: 'var(--success)' }}
                                onClick={(e) => onComplete(e, c)}
                              >
                                Mark Completed
                              </button>
                              <button
                                className="small btn btn-ghost"
                                style={{ padding: '4px 12px' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActiveComplaint(c)
                                  setShowUploadModal(true)
                                }}
                              >
                                Upload Photos
                              </button>
                              <button
                                className="small btn btn-ghost"
                                style={{ padding: '4px 12px' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActiveComplaint(c)
                                  setShowNotesModal(true)
                                  setActionReason('')
                                }}
                              >
                                Add Notes
                              </button>
                              <button
                                className="small btn btn-ghost"
                                style={{ padding: '4px 12px' }}
                                onClick={(e) => onPause(e, c)}
                              >
                                Pause
                              </button>
                            </>
                          )}
                          {c.status === 'On Hold' && (
                            <button
                              className="small btn btn-primary"
                              style={{ padding: '4px 12px' }}
                              onClick={(e) => onResumeWork(e, c._id)}
                            >
                              Resume Work
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <div className="page-info">
                page {pagination?.currentPage || 1} to {pagination?.totalPages || 1} and records{' '}
                {pagination?.totalRecords || 0}
              </div>
              <div className="page-controls">
                <button
                  className="btn btn-ghost"
                  onClick={() => handlePageChange(filterParams.page - 1)}
                  disabled={filterParams.page <= 1}
                >
                  Previous
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => handlePageChange(filterParams.page + 1)}
                  disabled={filterParams.page >= (pagination?.totalPages || 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="complaint-modal-overlay">
          <div className="complaint-modal">
            <div className="complaint-modal-header">
              <h3 className="complaint-modal-title">Reject Assignment</h3>
              <i
                className="fa-solid fa-xmark complaint-modal-close"
                onClick={() => setShowRejectModal(false)}
              ></i>
            </div>
            <div className="complaint-modal-body">
              <div className="form-group">
                <label>Reason for rejection</label>
                <textarea
                  placeholder="Why are you rejecting this assignment?"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '12px',
                  }}
                ></textarea>
              </div>
            </div>
            <div className="complaint-modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{
                  background: 'var(--critical)',
                  borderColor: 'var(--critical)',
                  color: '#fff',
                }}
                onClick={submitReject}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {showPauseModal && (
        <div className="complaint-modal-overlay">
          <div className="complaint-modal">
            <div className="complaint-modal-header">
              <h3 className="complaint-modal-title">Pause Work</h3>
              <i
                className="fa-solid fa-xmark complaint-modal-close"
                onClick={() => setShowPauseModal(false)}
              ></i>
            </div>
            <div className="complaint-modal-body">
              <div className="form-group">
                <label>Reason for pausing</label>
                <textarea
                  placeholder="E.g. Need to buy materials..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '12px',
                  }}
                ></textarea>
              </div>
            </div>
            <div className="complaint-modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowPauseModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitPause}>
                Confirm Pause
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {showCompleteModal && (
        <div className="complaint-modal-overlay">
          <div className="complaint-modal">
            <div className="complaint-modal-header">
              <h3 className="complaint-modal-title">Mark Work Completed</h3>
              <i
                className="fa-solid fa-xmark complaint-modal-close"
                onClick={() => setShowCompleteModal(false)}
              ></i>
            </div>
            <div className="complaint-modal-body">
              <div className="form-group">
                <label>Completion Notes</label>
                <textarea
                  placeholder="What did you fix?"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '12px',
                  }}
                ></textarea>
              </div>
            </div>
            <div className="complaint-modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCompleteModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                onClick={submitComplete}
              >
                Complete Work
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Photos Modal */}
      {showUploadModal && (
        <div className="complaint-modal-overlay">
          <div className="complaint-modal">
            <div className="complaint-modal-header">
              <h3 className="complaint-modal-title">Upload Work Photos</h3>
              <i
                className="fa-solid fa-xmark complaint-modal-close"
                onClick={() => setShowUploadModal(false)}
              ></i>
            </div>
            <div className="complaint-modal-body">
              <div className="form-group">
                <label>
                  Select Photos <span style={{ color: 'var(--critical)' }}>*</span>
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setSelectedFiles(e.target.files)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '12px',
                  }}
                />
                {selectedFiles.length > 0 && (
                  <div style={{ marginTop: '12px', color: 'var(--ink-soft)' }} className="small">
                    {selectedFiles.length} file(s) selected
                  </div>
                )}
              </div>
            </div>
            <div className="complaint-modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowUploadModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitUpload}>
                Upload Photos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Notes Modal */}
      {showNotesModal && (
        <div className="complaint-modal-overlay">
          <div className="complaint-modal">
            <div className="complaint-modal-header">
              <h3 className="complaint-modal-title">Add Work Notes</h3>
              <i
                className="fa-solid fa-xmark complaint-modal-close"
                onClick={() => setShowNotesModal(false)}
              ></i>
            </div>
            <div className="complaint-modal-body">
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  placeholder="Details about the work..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '12px',
                  }}
                ></textarea>
              </div>
            </div>
            <div className="complaint-modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowNotesModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitNotes}>
                Add Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Complaint Details */}
      {selectedComplaintId && (
        <ComplaintDetails
          complaintId={selectedComplaintId}
          onClose={() => setSelectedComplaintId(null)}
        />
      )}
    </div>
  )
}

export default Assignee
