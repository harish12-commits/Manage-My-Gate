import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useComplaints } from '../hooks/useComplaints'
import toast from 'react-hot-toast'
import AssignComplaint from './AssignComplaint'
import { getImageUrl } from '../../../utils/imageUrl'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('ComplaintDetails ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="complaint-modal-overlay"
          style={{
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15,23,42,0.7)',
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <h2 style={{ color: 'red' }}>Something went wrong.</h2>
            <p className="fw-bold">{this.state.error && this.state.error.toString()}</p>
            <pre style={{ background: '#f5f5f5', padding: '10px' }} className="small">
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
            <button className="btn btn-primary" onClick={() => this.props.onClose()}>
              Close
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const ComplaintDetails = ({ complaintId, onClose, onProvideFeedback }) => {
  const {
    currentComplaint: complaint,
    isDetailsLoading,
    loadComplaintDetails,
    addComment,
    updateStatus,
    assignTechnician,
    cancelComplaint,
    reopenComplaint,
    confirmCompletion,
  } = useComplaints({}, { disableAutoFetch: true })
  const authUser = useSelector((state) => state.auth?.user || {})
  const userRole = authUser.role || 'Resident'

  const [localLoading, setLocalLoading] = useState(true)

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [enlargedImage, setEnlargedImage] = useState(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [isInternalComment, setIsInternalComment] = useState(false)
  const [assignmentType, setAssignmentType] = useState('staff')
  const [assignForm, setAssignForm] = useState({
    technicianId: '',
    technicianName: '',
    temporaryName: '',
    temporaryPhone: '',
    adminInstructions: '',
  })
  const [updateForm, setUpdateForm] = useState({ status: '', remarks: '', priority: '' })
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackForm, setFeedbackForm] = useState({
    overallRating: 5,
    technicianRating: 5,
    serviceRating: 5,
    cleanlinessRating: 5,
    communicationRating: 5,
    remarks: '',
  })

  const handlePrint = () => {
    window.print()
  }

  const handleEscalate = async () => {
    try {
      await updateStatus(complaintId, {
        status: 'Escalated',
        remarks: 'Escalated by administrator',
      })
      toast.success('Complaint escalated')
    } catch (err) {
      toast.error('Failed to escalate complaint')
    }
  }

  // Mock technicians for dropdown
  const technicians = [
    { id: '1', name: 'Ravi Kumar (In-House)' },
    { id: '2', name: 'QuickFix Plumbing Co. (External)' },
  ]

  useEffect(() => {
    if (complaintId) {
      setLocalLoading(true)
      loadComplaintDetails(complaintId)
        .catch((err) => {
          toast.error('Failed to load complaint details')
        })
        .finally(() => {
          setLocalLoading(false)
        })
    }
  }, [complaintId])

  useEffect(() => {
    if (complaint) {
      setUpdateForm({
        status: complaint.status,
        remarks: '',
        priority: complaint.priority || 'Medium',
      })
    }
  }, [complaint])

  if (isDetailsLoading || localLoading) {
    return (
      <div
        className="complaint-modal-overlay"
        style={{
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.7)',
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center',
            minWidth: '300px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }}
        >
          <h3 style={{ margin: 0, color: 'var(--ink)' }} className="fw-bold fs-5">
            Loading Details...
          </h3>
        </div>
      </div>
    )
  }

  if (!complaint) {
    return (
      <div
        className="complaint-modal-overlay"
        style={{
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.7)',
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center',
            minWidth: '300px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }}
        >
          <h3 style={{ color: 'var(--ink)', margin: '0 0 12px 0' }} className="fw-semibold fs-5">
            Ticket Not Found
          </h3>
          <p style={{ color: '#475569', margin: '0 0 24px 0' }}>
            We couldn't find the details for this ticket.
          </p>
          <button
            style={{
              background: '#2F6FED',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            onClick={onClose}
            className="fw-bold"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  const formatDate = (dateString) => {
    const d = new Date(dateString)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getWorkflowStepIndex = (status) => {
    if (['Closed', 'Completed'].includes(status)) return 4
    if (['Resolved', 'Work Completed', 'Waiting For Resident Confirmation'].includes(status))
      return 3
    if (status === 'In Progress') return 2
    if (['Assigned', 'Accepted'].includes(status)) return 1
    return 0 // Submitted/Open/Waiting For Assignment
  }

  const renderWorkflowFlow = () => {
    if (complaint.status === 'Cancelled') {
      const steps = [
        { label: 'Submitted', isCompleted: true },
        { label: 'Cancelled', isActive: true, isError: true },
      ]
      return renderSteps(steps)
    }
    if (complaint.status === 'Rejected') {
      const steps = [
        { label: 'Submitted', isCompleted: true },
        { label: 'Rejected', isActive: true, isError: true },
      ]
      return renderSteps(steps)
    }
    if (complaint.vendor === 'Temporary Vendor' || complaint.vendor === 'External Vendor') {
      const getTempVendorIndex = (s) => {
        if (['Closed', 'Completed', 'Resolved'].includes(s)) return 2
        if (['Assigned', 'In Progress'].includes(s)) return 1
        return 0
      }
      const idx = getTempVendorIndex(complaint.status)
      const tempSteps = [
        { label: 'Submitted', isCompleted: idx > 0, isActive: idx === 0 },
        { label: 'Assigned', isCompleted: idx > 1, isActive: idx === 1 },
        { label: 'Closed', isCompleted: idx > 2, isActive: idx === 2 },
      ]
      return renderSteps(tempSteps)
    }

    const currentStepIndex = getWorkflowStepIndex(complaint.status)
    const steps = [
      { label: 'Submitted', isCompleted: currentStepIndex > 0, isActive: currentStepIndex === 0 },
      { label: 'Assigned', isCompleted: currentStepIndex > 1, isActive: currentStepIndex === 1 },
      { label: 'In Progress', isCompleted: currentStepIndex > 2, isActive: currentStepIndex === 2 },
      { label: 'Resolved', isCompleted: currentStepIndex > 3, isActive: currentStepIndex === 3 },
      { label: 'Closed', isCompleted: currentStepIndex > 4, isActive: currentStepIndex === 4 },
    ]
    return renderSteps(steps)
  }

  const renderSteps = (steps) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: '12px' }}>
        {steps.map((step, idx) => {
          // Circle styles
          let circleBg = 'var(--bg)'
          let circleColor = 'var(--ink-soft)'
          let circleBorder = '1px solid var(--border)'

          if (step.isCompleted) {
            circleBg = 'var(--success)'
            circleColor = '#fff'
            circleBorder = '1px solid var(--success)'
          } else if (step.isActive) {
            if (step.isError) {
              circleBg = 'var(--critical)'
              circleColor = '#fff'
              circleBorder = '2px solid #B91C1C'
            } else {
              circleBg = 'var(--primary)'
              circleColor = '#fff'
              circleBorder = '2px solid var(--primary-dark)'
            }
          }

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                position: 'relative',
                paddingBottom: idx === steps.length - 1 ? '0' : '20px',
              }}
            >
              {/* Connector Line */}
              {idx !== steps.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: '11px',
                    top: '24px',
                    bottom: 0,
                    width: '2px',
                    background: step.isCompleted ? 'var(--success)' : 'var(--border)',
                    zIndex: 0,
                  }}
                />
              )}

              {/* Step Indicator Circle */}
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: circleBg,
                  color: circleColor,
                  border: circleBorder,
                  zIndex: 1,
                  marginRight: '12px',
                  flexShrink: 0,
                }}
                className="fw-bold small"
              >
                {step.isCompleted ? <i className="small fa-solid fa-check"></i> : idx + 1}
              </div>

              {/* Step Details */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span
                  style={{
                    fontWeight: step.isActive ? 700 : 600,
                    color: step.isActive
                      ? step.isError
                        ? 'var(--critical)'
                        : 'var(--primary)'
                      : step.isCompleted
                        ? 'var(--ink)'
                        : 'var(--ink-faint)',
                  }}
                  className="small"
                >
                  {step.label}
                </span>
                {step.isActive && (
                  <span
                    style={{ color: step.isError ? 'var(--critical)' : 'var(--ink-soft)' }}
                    className="small"
                  >
                    {step.isError ? 'Request Terminated' : 'Current Stage'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    try {
      await addComment(complaintId, {
        remarks: newComment,
        attachments: [],
        isInternal: isInternalComment,
      })
      setNewComment('')
      setIsInternalComment(false)
      toast.success('Comment added')
    } catch (err) {
      toast.error('Failed to add comment')
    }
  }

  const handleAssign = async () => {
    try {
      const payload = {
        adminInstructions: assignForm.adminInstructions,
      }

      if (assignmentType === 'staff') {
        payload.technicianId = assignForm.technicianId
        payload.technicianName = assignForm.technicianName
        payload.vendor = 'In-House'
      } else {
        payload.technicianId = null
        payload.technicianName = assignForm.temporaryName
        payload.vendor = 'External Vendor'
        if (assignForm.temporaryPhone) {
          payload.adminInstructions =
            `${assignForm.adminInstructions || ''}\n[Temporary Vendor Phone: ${assignForm.temporaryPhone}]`.trim()
        }
      }

      await assignTechnician(complaintId, payload)
      setShowAssignModal(false)
      setAssignForm({
        technicianId: '',
        technicianName: '',
        temporaryName: '',
        temporaryPhone: '',
        adminInstructions: '',
      })
      setAssignmentType('staff')
      toast.success('Technician assigned successfully')
    } catch (err) {
      toast.error('Failed to assign technician')
    }
  }

  const handleUpdateStatus = async () => {
    try {
      await updateStatus(complaintId, updateForm)
      setShowUpdateModal(false)
      toast.success('Status updated')
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  return (
    <ErrorBoundary onClose={onClose}>
      <div className="complaints-os-theme complaint-modal-overlay active" onClick={onClose}>
        <div
          className="complaint-modal"
          style={{ maxWidth: '1000px', display: 'flex', flexDirection: 'column', padding: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="complaint-modal-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4
                style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}
                className="fs-4"
              >
                Ticket {complaint.complaintNumber}
                <span
                  className={`badge ${['Resolved', 'Closed'].includes(complaint.status) ? 'resolved' : ['In Progress', 'Assigned'].includes(complaint.status) ? 'progress' : 'open'}`}
                >
                  {complaint.status}
                </span>
              </h4>
            </div>
            <div className="d-flex align-items-center gap-3">
              {['Admin', 'FacilityManager', 'Manager', 'Super Admin'].includes(userRole) && (
                <>
                  {!['Cancelled', 'Closed', 'Resolved'].includes(complaint.status) && (
                    <>
                      <button className="btn btn-ghost" onClick={() => setShowUpdateModal(true)}>
                        Update Status
                      </button>
                      <button className="btn btn-ghost" onClick={handleEscalate}>
                        Escalate
                      </button>
                    </>
                  )}
                  <button className="btn btn-ghost" onClick={handlePrint}>
                    <i className="fa-solid fa-print"></i> Print / PDF
                  </button>
                  {!['Cancelled', 'Closed', 'Resolved'].includes(complaint.status) && (
                    <button className="btn btn-primary" onClick={() => setShowAssignModal(true)}>
                      Assign Technician
                    </button>
                  )}
                </>
              )}
              {((['Admin', 'FacilityManager', 'Manager', 'Super Admin'].includes(userRole) &&
                ['Submitted', 'Open', 'Assigned', 'In Progress'].includes(complaint.status)) ||
                (userRole?.toLowerCase() === 'resident' &&
                  ['Submitted', 'Open', 'Assigned'].includes(complaint.status))) && (
                <button
                  className="btn btn-ghost"
                  style={{ color: '#DC2626' }}
                  onClick={() => {
                    const reason = prompt('Reason for cancellation:')
                    if (reason) {
                      cancelComplaint(complaintId, reason).then(() =>
                        toast.success('Complaint Cancelled'),
                      )
                    }
                  }}
                >
                  Cancel Request
                </button>
              )}
              {userRole?.toLowerCase() === 'resident' &&
                [
                  'Completed',
                  'Work Completed',
                  'Resolved',
                  'Waiting For Resident Confirmation',
                ].includes(complaint.status) && (
                  <>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        const reason = prompt('Reason for reopening:')
                        if (reason) {
                          reopenComplaint(complaintId, reason).then(() =>
                            toast.success('Complaint Reopened'),
                          )
                        }
                      }}
                    >
                      Reopen
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setShowFeedbackModal(true)
                      }}
                    >
                      Confirm Completion
                    </button>
                  </>
                )}
              <button
                type="button"
                className="complaint-modal-close"
                onClick={onClose}
                style={{ marginLeft: '12px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <div className="complaint-modal-body" style={{ padding: '24px 32px' }}>
            <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
              {/* Left Column */}
              <div>
                <div className="card" style={{ marginBottom: '20px' }}>
                  <h2
                    style={{ color: 'var(--ink)', margin: '0 0 16px 0' }}
                    className="fw-bold fs-5"
                  >
                    {complaint.title}
                  </h2>
                  <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {complaint.description}
                  </p>

                  {complaint.attachments && complaint.attachments.length > 0 && (
                    <div style={{ marginTop: '24px' }}>
                      <h4 style={{ color: 'var(--ink)', marginBottom: '12px' }} className="small">
                        Attached Files
                      </h4>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {complaint.attachments.map((att, i) => {
                          const fileUrl = typeof att === 'string' ? att : att.url
                          const isImage = fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)
                          return (
                            <div
                              key={i}
                              style={{
                                position: 'relative',
                                width: '80px',
                                height: '80px',
                                borderRadius: 'var(--radius-md)',
                                overflow: 'hidden',
                                border: '1px solid var(--border)',
                                background: 'var(--bg)',
                              }}
                            >
                              {isImage ? (
                                <img
                                  src={getImageUrl(fileUrl)}
                                  alt={`Attachment ${i + 1}`}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => setEnlargedImage(fileUrl)}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--ink-soft)',
                                  }}
                                >
                                  <i
                                    className="fa-solid fa-file-pdf fa-lg"
                                    style={{ marginBottom: '8px' }}
                                  ></i>
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: 'var(--primary)', textDecoration: 'none' }}
                                    className="small"
                                  >
                                    View
                                  </a>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Assignment Summary */}
                <div className="card" style={{ marginBottom: '20px' }}>
                  <h3
                    style={{ color: 'var(--ink)', marginBottom: '16px' }}
                    className="fw-bold fs-6"
                  >
                    Assignment Summary
                  </h3>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}
                    className="small"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--ink-soft)' }} className="small">
                        Resident & Unit
                      </span>
                      <span style={{ color: 'var(--ink)' }} className="fw-semibold">
                        {complaint?.residentName || complaint?.residentId?.username || 'Resident'} -{' '}
                        {complaint?.location?.tower ? `${complaint.location.tower}, ` : ''}
                        {complaint?.location?.flat || 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--ink-soft)' }} className="small">
                        Category
                      </span>
                      <span style={{ color: 'var(--ink)' }} className="fw-semibold">
                        {complaint?.category}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--ink-soft)' }} className="small">
                        Assignee
                      </span>
                      <span style={{ color: 'var(--ink)' }} className="fw-semibold">
                        {complaint?.assignedTechnicianName || 'Unassigned'}{' '}
                        {(complaint?.assignedTechnicianName ||
                          complaint?.vendor === 'Temporary Vendor') && (
                          <span style={{ color: '#2563eb' }} className="fw-medium small">
                            (
                            {complaint?.vendor === 'Temporary Vendor'
                              ? 'Temp Vendor'
                              : 'Existing Staff'}
                            )
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--ink-soft)' }} className="small">
                        Expected Visit Time
                      </span>
                      <span style={{ color: 'var(--ink)' }} className="fw-semibold">
                        {complaint?.preferredVisitDate
                          ? `${complaint.preferredVisitDate} ${complaint.preferredVisitTime || ''}`.trim()
                          : 'Not specified'}
                      </span>
                    </div>
                    {(complaint?.instructions || complaint?.adminInstructions) && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          gridColumn: 'span 2',
                        }}
                      >
                        <span style={{ color: 'var(--ink-soft)' }} className="small">
                          Admin Instructions
                        </span>
                        <span
                          className="fw-semibold"
                          style={{ color: 'var(--ink)', whiteSpace: 'pre-wrap' }}
                        >
                          {complaint.instructions || complaint.adminInstructions}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Activity Timeline */}
                <div className="card">
                  <h3
                    style={{ color: 'var(--ink)', marginBottom: '24px' }}
                    className="fw-bold fs-6"
                  >
                    Activity & Updates
                  </h3>
                  <div className="timeline">
                    {complaint.timeline
                      ?.filter((evt) => !evt.isInternal || userRole !== 'Resident')
                      .map((evt, idx) => (
                        <div className="tl-item done" key={idx}>
                          <div
                            className="tl-node"
                            style={
                              evt.isInternal
                                ? { background: '#F59E0B', borderColor: '#F59E0B' }
                                : {}
                            }
                          >
                            <i className="fa-solid fa-check"></i>
                          </div>
                          <div className="tl-content">
                            <b>
                              {evt.action}
                              {evt.isInternal && (
                                <span
                                  className="small badge warning"
                                  style={{
                                    padding: '2px 6px',
                                    marginLeft: '8px',
                                    background: '#FEF3C7',
                                    color: '#D97706',
                                    border: '1px solid #FDE68A',
                                  }}
                                >
                                  Internal
                                </span>
                              )}
                            </b>
                            <span>
                              {evt.userName ? `${evt.userName} (${evt.userRole})` : evt.userRole} •{' '}
                              {formatDate(evt.date || evt.timestamp || evt.createdAt || new Date())}
                            </span>
                            {evt.remarks && (
                              <p
                                style={{
                                  color: 'var(--ink-soft)',
                                  marginTop: '8px',
                                  background: evt.isInternal ? '#FFFBEB' : 'var(--bg)',
                                  padding: '12px',
                                  borderRadius: 'var(--radius-md)',
                                  border: evt.isInternal ? '1px dashed #FDE68A' : 'none',
                                }}
                              >
                                {evt.remarks}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>

                  <div
                    style={{
                      marginTop: '32px',
                      borderTop: '1px solid var(--border)',
                      paddingTop: '24px',
                    }}
                  >
                    <textarea
                      placeholder="Type an update or comment..."
                      style={{
                        width: '100%',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        minHeight: '80px',
                        marginBottom: '12px',
                      }}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    ></textarea>
                    <div className="d-flex align-items-center justify-content-between">
                      <div />
                      <button className="btn btn-primary" onClick={handleAddComment}>
                        Post Update
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card">
                  <h3
                    style={{
                      color: 'var(--ink)',
                      marginBottom: '16px',
                      borderBottom: '1px solid var(--border)',
                      paddingBottom: '12px',
                    }}
                    className="fw-bold"
                  >
                    Ticket Info
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div
                      style={{
                        borderBottom: '1px solid var(--border)',
                        paddingBottom: '16px',
                        marginBottom: '8px',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          color: 'var(--ink-faint)',
                          textTransform: 'uppercase',
                          marginBottom: '8px',
                        }}
                        className="fw-semibold small"
                      >
                        Ticket Flow
                      </span>
                      {renderWorkflowFlow()}
                    </div>
                    <div
                      style={{
                        borderTop: '1px solid var(--border)',
                        paddingTop: '16px',
                        marginTop: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            display: 'block',
                            color: 'var(--ink-faint)',
                            textTransform: 'uppercase',
                            marginBottom: '4px',
                          }}
                          className="fw-semibold small"
                        >
                          Created
                        </span>
                        <div style={{ color: 'var(--ink)' }} className="small">
                          {formatDate(complaint.createdAt)}
                        </div>
                      </div>
                      {complaint.slaDueDate && (
                        <div>
                          <span
                            style={{
                              display: 'block',
                              color: 'var(--ink-faint)',
                              textTransform: 'uppercase',
                              marginBottom: '4px',
                            }}
                            className="fw-semibold small"
                          >
                            Expected SLA
                          </span>
                          <div style={{ color: 'var(--ink)' }} className="small">
                            {formatDate(complaint.slaDueDate)}
                          </div>
                        </div>
                      )}
                      {complaint.resolvedAt && (
                        <div>
                          <span
                            style={{
                              display: 'block',
                              color: 'var(--ink-faint)',
                              textTransform: 'uppercase',
                              marginBottom: '4px',
                            }}
                            className="fw-semibold small"
                          >
                            Resolved
                          </span>
                          <div style={{ color: 'var(--ink)' }} className="small">
                            {formatDate(complaint.resolvedAt)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div
                      className="d-flex flex-column gap-2"
                      style={{
                        borderTop: '1px solid var(--border)',
                        paddingTop: '16px',
                        marginTop: '8px',
                      }}
                    >
                      {complaint.vendor === 'Temporary Vendor' &&
                        ['Assigned', 'In Progress'].includes(complaint.status) && (
                          <button
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                            onClick={() => {
                              confirmCompletion(complaintId, {
                                remarks: 'Work marked as done for temporary vendor.',
                              })
                                .then(() => toast.success('Work marked as done.'))
                                .catch((e) =>
                                  toast.error(e.response?.data?.message || 'Error marking as done'),
                                )
                            }}
                          >
                            Work Done
                          </button>
                        )}
                      <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>
                        Cancel
                      </button>
                    </div>
                  </div>{' '}
                </div>

                {complaint.assignedTechnicianName && (
                  <div className="card">
                    <h3
                      style={{
                        color: 'var(--ink)',
                        marginBottom: '16px',
                        borderBottom: '1px solid var(--border)',
                        paddingBottom: '12px',
                      }}
                      className="fw-bold"
                    >
                      Assignee Details
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <span
                          style={{
                            display: 'block',
                            color: 'var(--ink-faint)',
                            textTransform: 'uppercase',
                            marginBottom: '4px',
                          }}
                          className="fw-semibold small"
                        >
                          Name
                        </span>
                        <div style={{ color: 'var(--ink)' }} className="fw-semibold small">
                          {complaint.assignedTechnicianName}
                        </div>
                      </div>
                      {true && (
                        <div>
                          <span
                            style={{
                              display: 'block',
                              color: 'var(--ink-faint)',
                              textTransform: 'uppercase',
                              marginBottom: '4px',
                            }}
                            className="fw-semibold small"
                          >
                            Phone Number
                          </span>
                          <div style={{ color: 'var(--ink)' }} className="small">
                            {(() => {
                              if (complaint.assignedTechnicianPhone) {
                                return complaint.assignedTechnicianPhone
                              }
                              if (complaint.assignedTechnicianId?.phone) {
                                return complaint.assignedTechnicianId.phone
                              }
                              if (complaint.vendor === 'Temporary Vendor') {
                                const assignEvent = complaint.timeline?.find(
                                  (t) =>
                                    t.action === 'Complaint Assigned' &&
                                    t.remarks?.includes('Assigned to:'),
                                )
                                if (assignEvent && assignEvent.remarks) {
                                  const match = assignEvent.remarks.match(
                                    /Phone:\s*([\d\+\-\(\)\s]+)/i,
                                  )
                                  if (match && match[1]) return match[1].trim()
                                }
                              }
                              return 'N/A'
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {['Resolved', 'Closed', 'Completed', 'Waiting For Resident Confirmation'].includes(
                  complaint.status,
                ) &&
                  (complaint.resolutionSummary ||
                    complaint.resolutionNotes ||
                    complaint.workDone ||
                    complaint.technicianRemarks ||
                    (complaint.workNotes && complaint.workNotes.length > 0) ||
                    (complaint.workAttachments && complaint.workAttachments.length > 0)) && (
                    <div className="card" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
                      <h3
                        style={{
                          color: '#166534',
                          marginBottom: '16px',
                          borderBottom: '1px solid #BBF7D0',
                          paddingBottom: '12px',
                        }}
                        className="fw-bold"
                      >
                        Resolution Details
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {complaint.resolutionSummary && (
                          <div>
                            <span
                              style={{
                                display: 'block',
                                color: '#166534',
                                opacity: 0.8,
                                textTransform: 'uppercase',
                              }}
                              className="fw-semibold small"
                            >
                              Resolution Summary
                            </span>
                            <div style={{ color: '#14532D' }} className="small">
                              {complaint.resolutionSummary}
                            </div>
                          </div>
                        )}
                        {complaint.resolutionNotes && (
                          <div>
                            <span
                              style={{
                                display: 'block',
                                color: '#166534',
                                opacity: 0.8,
                                textTransform: 'uppercase',
                              }}
                              className="fw-semibold small"
                            >
                              Resolution Notes
                            </span>
                            <div style={{ color: '#14532D' }} className="small">
                              {complaint.resolutionNotes}
                            </div>
                          </div>
                        )}
                        {complaint.workDone && (
                          <div>
                            <span
                              style={{
                                display: 'block',
                                color: '#166534',
                                opacity: 0.8,
                                textTransform: 'uppercase',
                              }}
                              className="fw-semibold small"
                            >
                              Work Done
                            </span>
                            <div style={{ color: '#14532D' }} className="small">
                              {complaint.workDone}
                            </div>
                          </div>
                        )}
                        {complaint.technicianRemarks && (
                          <div>
                            <span
                              style={{
                                display: 'block',
                                color: '#166534',
                                opacity: 0.8,
                                textTransform: 'uppercase',
                              }}
                              className="fw-semibold small"
                            >
                              Technician Remarks
                            </span>
                            <div style={{ color: '#14532D' }} className="small">
                              {complaint.technicianRemarks}
                            </div>
                          </div>
                        )}
                        {complaint.workNotes && complaint.workNotes.length > 0 && (
                          <div>
                            <span
                              style={{
                                display: 'block',
                                color: '#166534',
                                opacity: 0.8,
                                textTransform: 'uppercase',
                              }}
                              className="fw-semibold small"
                            >
                              Work Notes
                            </span>
                            <ul
                              style={{ color: '#14532D', margin: 0, paddingLeft: '20px' }}
                              className="small"
                            >
                              {complaint.workNotes.map((note, idx) => (
                                <li key={idx}>
                                  <strong>{formatDate(note.createdAt)}</strong>: {note.note} (by{' '}
                                  {note.authorName})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {complaint.workAttachments && complaint.workAttachments.length > 0 && (
                          <div>
                            <span
                              style={{
                                display: 'block',
                                color: '#166534',
                                opacity: 0.8,
                                textTransform: 'uppercase',
                                marginBottom: '8px',
                              }}
                              className="fw-semibold small"
                            >
                              Work Photos
                            </span>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {complaint.workAttachments.map((url, i) => (
                                <div
                                  key={i}
                                  style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    border: '1px solid #BBF7D0',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => setEnlargedImage(url)}
                                >
                                  <img
                                    src={getImageUrl(url)}
                                    alt={`Work Photo ${i + 1}`}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {complaint.completionDate && (
                          <div>
                            <span
                              style={{
                                display: 'block',
                                color: '#166534',
                                opacity: 0.8,
                                textTransform: 'uppercase',
                              }}
                              className="fw-semibold small"
                            >
                              Completion Date
                            </span>
                            <div style={{ color: '#14532D' }} className="small">
                              {formatDate(complaint.completionDate)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {['Resolved', 'Closed', 'Completed'].includes(complaint.status) &&
                  complaint.feedback && (
                    <div
                      className="card"
                      style={{ background: 'var(--primary-light)', borderColor: '#C7D2FE' }}
                    >
                      <h3
                        style={{ color: 'var(--primary-dark)', marginBottom: '12px' }}
                        className="fw-bold"
                      >
                        Resolution Feedback
                      </h3>
                      <div className="fs-6 feedback-stars" style={{ marginBottom: '12px' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <i
                            key={star}
                            className={
                              star <=
                              (complaint.feedback.overallRating || complaint.feedback.rating)
                                ? 'fa-solid fa-star'
                                : 'fa-regular fa-star'
                            }
                          ></i>
                        ))}
                      </div>
                      <p
                        style={{ color: 'var(--ink-soft)', fontStyle: 'italic', margin: 0 }}
                        className="small"
                      >
                        "{complaint.feedback.remarks}"
                      </p>
                      {complaint.feedback.feedbackDate && (
                        <div
                          style={{ color: 'var(--ink-faint)', marginTop: '8px' }}
                          className="small"
                        >
                          Submitted: {formatDate(complaint.feedback.feedbackDate)}
                        </div>
                      )}
                    </div>
                  )}

                {['Resolved', 'Closed', 'Completed'].includes(complaint.status) &&
                  !(
                    complaint.feedback &&
                    (complaint.feedback.overallRating || complaint.feedback.rating)
                  ) &&
                  onProvideFeedback && (
                    <div style={{ marginTop: '16px' }}>
                      <button
                        className="fw-semibold btn btn-primary"
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                        }}
                        onClick={() => onProvideFeedback(complaint._id)}
                      >
                        <i className="fa-solid fa-star"></i> Provide Feedback
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Modals */}
          {showAssignModal && (
            <AssignComplaint
              complaint={complaint}
              onCancel={() => setShowAssignModal(false)}
              onAssigned={() => {
                setShowAssignModal(false)
              }}
            />
          )}

          {showUpdateModal && (
            <div className="complaint-modal-overlay">
              <div className="complaint-modal" style={{ display: 'block' }}>
                <div className="complaint-modal-header">
                  <h3 className="complaint-modal-title">Update Status</h3>
                  <i
                    className="fa-solid fa-xmark complaint-modal-close"
                    onClick={() => setShowUpdateModal(false)}
                  ></i>
                </div>
                <div className="form-group">
                  <label>New Status</label>
                  <select
                    value={updateForm.status}
                    onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                  >
                    <option>Submitted</option>
                    <option>Assigned</option>
                    <option>In Progress</option>
                    <option>Resolved</option>
                    <option>Closed</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>Priority</label>
                  <select
                    value={updateForm.priority}
                    onChange={(e) => setUpdateForm({ ...updateForm, priority: e.target.value })}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Internal Note / Remarks</label>
                  <textarea
                    placeholder="Reason for update..."
                    value={updateForm.remarks}
                    onChange={(e) => setUpdateForm({ ...updateForm, remarks: e.target.value })}
                  ></textarea>
                </div>
                <div className="d-flex align-items-center justify-content-end gap-3 mt-4">
                  <button className="btn btn-ghost" onClick={() => setShowUpdateModal(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleUpdateStatus}>
                    Save Update
                  </button>
                </div>
              </div>
            </div>
          )}

          {enlargedImage && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.8)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
              }}
              onClick={() => setEnlargedImage(null)}
            >
              <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
                <button
                  onClick={() => setEnlargedImage(null)}
                  style={{
                    position: 'absolute',
                    top: '-40px',
                    right: 0,
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    fontSize: '24px',
                    cursor: 'pointer',
                  }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
                <img
                  src={enlargedImage}
                  alt="Enlarged Attachment"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '80vh',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    display: 'block',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <a
                    href={enlargedImage}
                    download
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: '#2563eb',
                      color: '#fff',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    <i className="fa-solid fa-download" style={{ marginRight: '8px' }}></i> Download
                    Image
                  </a>
                </div>
              </div>
            </div>
          )}

          {showFeedbackModal && (
            <div
              className="modal-overlay active"
              style={{
                zIndex: 1100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                padding: '20px',
              }}
            >
              <div
                className="modal-box"
                style={{
                  width: '100%',
                  maxWidth: '500px',
                  background: 'var(--surface)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div
                  className="complaint-modal-header"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--bg)',
                  }}
                >
                  <h4 style={{ margin: 0, color: 'var(--ink)' }} className="fw-semibold fs-5">
                    Provide Feedback
                  </h4>
                  <button
                    onClick={() => setShowFeedbackModal(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '18px',
                      color: '#64748b',
                    }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div className="complaint-modal-body" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {[
                      { label: 'Overall Rating', key: 'overallRating' },
                      { label: 'Technician Rating', key: 'technicianRating' },
                      { label: 'Service Quality', key: 'serviceRating' },
                      { label: 'Cleanliness', key: 'cleanlinessRating' },
                      { label: 'Communication', key: 'communicationRating' },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: '#334155' }} className="fw-medium">
                          {item.label}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <i
                              key={star}
                              className="fs-4 fa-solid fa-star"
                              style={{
                                color: star <= feedbackForm[item.key] ? '#f59e0b' : '#cbd5e1',
                                cursor: 'pointer',
                              }}
                              onClick={() => setFeedbackForm({ ...feedbackForm, [item.key]: star })}
                            ></i>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div style={{ marginTop: '12px' }}>
                      <label
                        style={{ display: 'block', color: '#334155', marginBottom: '8px' }}
                        className="fw-semibold small"
                      >
                        Additional Remarks
                      </label>
                      <textarea
                        rows="3"
                        className="form-control"
                        value={feedbackForm.remarks}
                        onChange={(e) =>
                          setFeedbackForm({ ...feedbackForm, remarks: e.target.value })
                        }
                        placeholder="Tell us about your experience..."
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          outline: 'none',
                          resize: 'vertical',
                        }}
                      ></textarea>
                    </div>
                  </div>
                </div>
                <div
                  className="modal-footer d-flex align-items-center justify-content-end gap-3"
                  style={{
                    padding: '16px 24px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--bg)',
                  }}
                >
                  <button className="btn btn-ghost" onClick={() => setShowFeedbackModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      confirmCompletion(complaintId, feedbackForm).then(() => {
                        toast.success('Completed and feedback submitted')
                        setShowFeedbackModal(false)
                      })
                    }}
                  >
                    Submit & Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default ComplaintDetails
