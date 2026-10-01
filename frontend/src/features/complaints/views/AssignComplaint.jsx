import React, { useState, useEffect } from 'react'
import { useComplaints } from '../hooks/useComplaints'
import apiClient from '../../../services/apiClient.js'
import { toast } from 'react-hot-toast'
import { getImageUrl } from '../../../utils/imageUrl'

const AssignComplaint = ({ complaint, onAssigned, onCancel }) => {
  const { assignComplaint, assignLoading, complaints, addComment } = useComplaints()

  const [assignmentType, setAssignmentType] = useState('broadcast')
  const [techniciansList, setTechniciansList] = useState([])
  const [isFetchingTechs, setIsFetchingTechs] = useState(true)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const [enlargedImage, setEnlargedImage] = useState(null)
  const [form, setForm] = useState({
    technicianId: '',
    technicianIds: [],
    temporaryAssigneeName: '',
    phoneNumber: '',
    companyName: '',
    specialization: '',
    expectedVisit: 'Immediately',
    customVisitDate: '',
    customVisitTime: '',
    adminInstructions: '',
    internalNotes: '',
    reassignmentReason: '',
  })

  useEffect(() => {
    // Fetch technicians list
    setIsFetchingTechs(true)
    apiClient
      .get('/technicians')
      .then((res) => {
        const activeTechs = res?.data || []
        setTechniciansList(activeTechs.filter((t) => ['Active', 'Pending'].includes(t.status)))
      })
      .catch((err) => {
        console.error('Failed to fetch technicians:', err)
        toast.error('Failed to load staff list')
      })
      .finally(() => {
        setIsFetchingTechs(false)
      })
  }, [])

  // Determine availability based on active complaints
  const getAvailability = (techId) => {
    const activeComplaints = complaints.filter(
      (c) =>
        c.assignedTechnicianId === techId &&
        ['Assigned', 'In Progress', 'Accepted'].includes(c.status),
    )
    return activeComplaints.length > 0 ? 'Busy' : 'Available'
  }

  const getVisitDate = () => {
    const now = new Date()
    if (
      form.expectedVisit === 'Today' ||
      form.expectedVisit === 'Immediately' ||
      form.expectedVisit === 'Within 1 Hour'
    ) {
      return now.toISOString().split('T')[0]
    } else if (form.expectedVisit === 'Tomorrow') {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow.toISOString().split('T')[0]
    } else if (form.expectedVisit === 'Custom Date & Time') {
      return form.customVisitDate
    }
    return ''
  }

  const getVisitTime = () => {
    if (form.expectedVisit === 'Custom Date & Time') {
      return form.customVisitTime
    }
    return form.expectedVisit
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    let finalAdminInstructions = form.adminInstructions
    let preferredVisitDate = getVisitDate()
    let preferredVisitTime = getVisitTime()

    const payload = {
      preferredVisitDate,
      preferredVisitTime,
      reassignmentReason: form.reassignmentReason,
    }

    if (assignmentType === 'broadcast') {
      if (!form.technicianIds || form.technicianIds.length === 0) {
        toast.error('Please select at least one staff member to broadcast to')
        return
      }
      payload.technicianIds = form.technicianIds
      payload.assignmentType = 'broadcast'
    } else if (assignmentType === 'staff') {
      if (!form.technicianId) {
        toast.error('Please select an existing staff member')
        return
      }
      payload.technicianId = form.technicianId
      payload.assignmentType = 'staff'
      const selectedTech = techniciansList.find((t) => t._id === form.technicianId)
      payload.technicianName = selectedTech ? selectedTech.name : ''
      payload.vendor = selectedTech?.type === 'External' ? 'External Vendor' : 'In-House'
      payload.instructions = finalAdminInstructions
    } else {
      if (!form.temporaryAssigneeName) {
        toast.error('Temporary Assignee Name is required')
        return
      }
      const phoneRegex = /^[0-9+\s-]{10,15}$/
      if (!form.phoneNumber || !phoneRegex.test(form.phoneNumber)) {
        toast.error('Please enter a valid Phone Number')
        return
      }
      payload.technicianId = null
      payload.technicianName = form.temporaryAssigneeName
      payload.vendor = 'Temporary Vendor'
      payload.assignmentType = 'vendor'

      // Append extra info to adminInstructions
      const extraInfo = `\n[Temporary Vendor Details]\nPhone: ${form.phoneNumber}${form.companyName ? `\nCompany: ${form.companyName}` : ''}${form.specialization ? `\nSpecialization: ${form.specialization}` : ''}`
      payload.adminInstructions = finalAdminInstructions + extraInfo
    }

    try {
      await assignComplaint(complaint._id, payload)

      toast.success('Technician assigned successfully')
      if (onAssigned) onAssigned()
    } catch (error) {
      toast.error(error?.message || 'Failed to assign technician')
    }
  }

  const selectedTechName =
    assignmentType === 'staff'
      ? techniciansList.find((t) => t._id === form.technicianId)?.name || 'Not Selected'
      : form.temporaryAssigneeName || 'Not Entered'

  const selectedTechDept =
    assignmentType === 'staff'
      ? techniciansList.find((t) => t._id === form.technicianId)?.department || 'N/A'
      : form.specialization || 'N/A'

  return (
    <div className="complaints-os-theme complaint-modal-overlay active" onClick={onCancel}>
      <div
        className="complaint-modal"
        style={{ maxWidth: '1000px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="complaint-modal-header">
          <h4 style={{ margin: 0 }} className="fs-4">
            Assign Technician
          </h4>
          <button type="button" className="complaint-modal-close" onClick={onCancel}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="complaint-modal-body">
          <form onSubmit={handleSubmit} id="assignForm">
            <div style={{ display: 'flex', gap: '32px', marginBottom: '28px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  margin: 0,
                }}
                className="fw-semibold"
              >
                <input
                  type="radio"
                  name="assignmentType"
                  checked={assignmentType === 'broadcast'}
                  onChange={() => setAssignmentType('broadcast')}
                  style={{
                    cursor: 'pointer',
                    accentColor: '#2563eb',
                    width: '18px',
                    height: '18px',
                  }}
                />
                Request Assignee
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  margin: 0,
                }}
                className="fw-semibold"
              >
                <input
                  type="radio"
                  name="assignmentType"
                  checked={assignmentType === 'vendor'}
                  onChange={() => setAssignmentType('vendor')}
                  style={{
                    cursor: 'pointer',
                    accentColor: '#2563eb',
                    width: '18px',
                    height: '18px',
                  }}
                />
                Assign Temporary Vendor
              </label>
            </div>

            <div
              style={{ height: '1px', background: '#e2e8f0', margin: '0 -28px 28px -28px' }}
            ></div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {assignmentType === 'broadcast' ? (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label
                    className="fw-semibold small form-label"
                    style={{ color: 'var(--ink-soft)', marginBottom: '8px', display: 'block' }}
                  >
                    Select Multiple Staff to Request <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {isFetchingTechs ? (
                    <div
                      style={{
                        width: '100%',
                        height: '42px',
                        background: 'var(--bg)',
                        borderRadius: '6px',
                        animation: 'pulse 1.5s infinite',
                      }}
                    ></div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <div
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '15px',
                          backgroundColor: 'var(--surface)',
                          color: 'var(--ink)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        <span>
                          {form.technicianIds.length > 0
                            ? `${form.technicianIds.length} staff selected`
                            : '-- Select Assignees --'}
                        </span>
                        <i
                          className={`fa-solid fa-chevron-${isDropdownOpen ? 'up' : 'down'}`}
                          style={{ color: '#94a3b8' }}
                        ></i>
                      </div>

                      {isDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: '8px',
                            maxHeight: '250px',
                            overflowY: 'auto',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '8px',
                            backgroundColor: 'var(--surface)',
                            zIndex: 50,
                            boxShadow:
                              '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                          }}
                        >
                          {techniciansList.length === 0 ? (
                            <div
                              style={{
                                padding: '8px',
                                color: 'var(--ink-soft)',
                                textAlign: 'center',
                              }}
                            >
                              No staff available
                            </div>
                          ) : (
                            techniciansList.map((t) => {
                              const status = getAvailability(t._id)
                              const statusText = status === 'Available' ? '✅ Available' : '🔴 Busy'
                              const isChecked = form.technicianIds.includes(t._id)
                              return (
                                <label
                                  key={t._id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    borderRadius: '6px',
                                    backgroundColor: isChecked ? '#eff6ff' : 'transparent',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setForm({
                                          ...form,
                                          technicianIds: [...form.technicianIds, t._id],
                                        })
                                      } else {
                                        setForm({
                                          ...form,
                                          technicianIds: form.technicianIds.filter(
                                            (id) => id !== t._id,
                                          ),
                                        })
                                      }
                                    }}
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      accentColor: '#2563eb',
                                    }}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ color: 'var(--ink)' }} className="fw-semibold">
                                      {t.name}
                                    </div>
                                    <div style={{ color: 'var(--ink-soft)' }} className="small">
                                      {t.department} - {statusText}
                                    </div>
                                  </div>
                                </label>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : assignmentType === 'staff' ? (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label
                    className="fw-semibold small form-label"
                    style={{ color: 'var(--ink-soft)', marginBottom: '8px', display: 'block' }}
                  >
                    Select Employee <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {isFetchingTechs ? (
                    <div
                      style={{
                        width: '100%',
                        height: '42px',
                        background: 'var(--bg)',
                        borderRadius: '6px',
                        animation: 'pulse 1.5s infinite',
                      }}
                    ></div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <select
                        className="form-control"
                        value={form.technicianId}
                        onChange={(e) => setForm({ ...form, technicianId: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '15px',
                          outline: 'none',
                          backgroundColor: 'var(--surface)',
                          color: 'var(--ink)',
                          appearance: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        <option value="">-- Choose Assignee --</option>
                        {techniciansList.map((t) => {
                          const status = getAvailability(t._id)
                          const statusText = status === 'Available' ? '✅ Available' : '🔴 Busy'
                          return (
                            <option key={t._id} value={t._id}>
                              {t.name} - {t.department} ({statusText})
                            </option>
                          )
                        })}
                      </select>
                      <i
                        className="fa-solid fa-chevron-down"
                        style={{
                          position: 'absolute',
                          right: '14px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#94a3b8',
                          pointerEvents: 'none',
                        }}
                      ></i>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label
                      className="fw-semibold small form-label"
                      style={{ color: 'var(--ink-soft)', marginBottom: '8px', display: 'block' }}
                    >
                      Vendor Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., John Doe"
                      value={form.temporaryAssigneeName}
                      onChange={(e) => setForm({ ...form, temporaryAssigneeName: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '15px',
                        outline: 'none',
                        color: 'var(--ink)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label
                      className="fw-semibold small form-label"
                      style={{ color: 'var(--ink-soft)', marginBottom: '8px', display: 'block' }}
                    >
                      Phone Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="+91 00000 00000"
                      value={form.phoneNumber}
                      onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '15px',
                        outline: 'none',
                        color: 'var(--ink)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label
                      className="fw-semibold small form-label"
                      style={{ color: 'var(--ink-soft)', marginBottom: '8px', display: 'block' }}
                    >
                      Company Name (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., QuickFix Services"
                      value={form.companyName}
                      onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '15px',
                        outline: 'none',
                        color: 'var(--ink)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label
                      className="fw-semibold small form-label"
                      style={{ color: 'var(--ink-soft)', marginBottom: '8px', display: 'block' }}
                    >
                      Specialization
                    </label>
                    <div style={{ position: 'relative' }}>
                      <select
                        className="form-control"
                        value={form.specialization}
                        onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '15px',
                          outline: 'none',
                          backgroundColor: 'var(--surface)',
                          color: 'var(--ink)',
                          appearance: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        <option value="">-- Select --</option>
                        <option value="Plumber">Plumber</option>
                        <option value="Electrician">Electrician</option>
                        <option value="Carpenter">Carpenter</option>
                        <option value="Painter">Painter</option>
                        <option value="Lift Technician">Lift Technician</option>
                        <option value="Gardener">Gardener</option>
                        <option value="Cleaning Service">Cleaning Service</option>
                        <option value="Other">Other</option>
                      </select>
                      <i
                        className="fa-solid fa-chevron-down"
                        style={{
                          position: 'absolute',
                          right: '14px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#94a3b8',
                          pointerEvents: 'none',
                        }}
                      ></i>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label
                  className="fw-semibold small form-label"
                  style={{ color: 'var(--ink-soft)', marginBottom: '8px', display: 'block' }}
                >
                  Expected Visit Time (Optional)
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <select
                      className="form-control"
                      value={form.expectedVisit}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          expectedVisit: e.target.value,
                          customVisitDate: '',
                          customVisitTime: '',
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '15px',
                        outline: 'none',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--ink)',
                        appearance: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    >
                      <option value="Immediately">Immediately</option>
                      <option value="Within 1 Hour">Within 1 Hour</option>
                      <option value="Today">Today</option>
                      <option value="Tomorrow">Tomorrow</option>
                      <option value="Custom Date & Time">Custom Date & Time</option>
                    </select>
                    <i
                      className="fa-solid fa-chevron-down"
                      style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8',
                        pointerEvents: 'none',
                      }}
                    ></i>
                  </div>

                  {form.expectedVisit === 'Custom Date & Time' && (
                    <>
                      <input
                        type="date"
                        className="form-control"
                        value={form.customVisitDate}
                        onChange={(e) => setForm({ ...form, customVisitDate: e.target.value })}
                        required
                        style={{
                          flex: 1,
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '15px',
                          outline: 'none',
                          color: 'var(--ink)',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      />
                      <input
                        type="time"
                        className="form-control"
                        value={form.customVisitTime}
                        onChange={(e) => setForm({ ...form, customVisitTime: e.target.value })}
                        required
                        style={{
                          flex: 1,
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '15px',
                          outline: 'none',
                          color: 'var(--ink)',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      />
                    </>
                  )}
                </div>
              </div>

              {(complaint?.assignedTechnicianId || complaint?.vendor) && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label
                    className="fw-semibold small form-label"
                    style={{ color: 'var(--ink-soft)', marginBottom: '8px', display: 'block' }}
                  >
                    Reassignment Reason <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter reason for reassignment..."
                    value={form.reassignmentReason}
                    onChange={(e) => setForm({ ...form, reassignmentReason: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '15px',
                      outline: 'none',
                      color: 'var(--ink)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}
                >
                  <label
                    className="fw-semibold small form-label"
                    style={{ color: 'var(--ink-soft)', margin: 0 }}
                  >
                    Admin Instructions (Optional)
                  </label>
                  <span
                    style={{
                      fontSize: '12px',
                      color: form.adminInstructions.length > 500 ? '#ef4444' : '#94a3b8',
                    }}
                  >
                    {form.adminInstructions.length}/500
                  </span>
                </div>
                <textarea
                  className="form-control"
                  rows="3"
                  maxLength="500"
                  placeholder="Example: Please call the resident before entering the apartment..."
                  value={form.adminInstructions}
                  onChange={(e) => setForm({ ...form, adminInstructions: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '15px',
                    outline: 'none',
                    resize: 'vertical',
                    minHeight: '80px',
                    fontFamily: 'inherit',
                    color: 'var(--ink)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                ></textarea>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}
                >
                  <label
                    className="fw-semibold small form-label"
                    style={{
                      color: 'var(--ink-soft)',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    Uploaded Attachments
                  </label>
                </div>
                {complaint?.attachments && complaint.attachments.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      flexWrap: 'wrap',
                      padding: '12px',
                      background: 'var(--bg)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {complaint.attachments.map((att, index) => {
                      const fileUrl = typeof att === 'string' ? att : att.url
                      const isImage = fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)
                      return (
                        <div
                          key={index}
                          style={{
                            position: 'relative',
                            width: '80px',
                            height: '80px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid #cbd5e1',
                            background: 'var(--surface)',
                          }}
                        >
                          {isImage ? (
                            <img
                              src={getImageUrl(fileUrl)}
                              alt={`Attachment ${index + 1}`}
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
                                style={{ color: '#2563eb', textDecoration: 'none' }}
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
                ) : (
                  <div
                    style={{
                      padding: '16px',
                      background: 'var(--bg)',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-focus)',
                      textAlign: 'center',
                      color: 'var(--ink-faint)',
                    }}
                    className="small"
                  >
                    No Attachments Uploaded
                  </div>
                )}
              </div>
            </div>

            {/* Assignment Summary */}
            <div
              style={{
                marginTop: '32px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <h5 style={{ margin: '0 0 16px 0', color: 'var(--ink)' }} className="fw-bold">
                Assignment Summary
              </h5>
              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}
                className="small"
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: 'var(--ink-soft)' }} className="small">
                    Complaint ID & Priority
                  </span>
                  <span style={{ color: 'var(--ink)' }} className="fw-semibold">
                    {complaint?.complaintNumber}{' '}
                    <span
                      style={{
                        background:
                          complaint?.priority === 'Critical'
                            ? 'var(--critical-light)'
                            : 'var(--bg)',
                        color:
                          complaint?.priority === 'Critical'
                            ? 'var(--critical)'
                            : 'var(--ink-soft)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        marginLeft: '6px',
                      }}
                      className="small"
                    >
                      {complaint?.priority || 'Medium'}
                    </span>
                  </span>
                </div>
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
                    Category & Dept
                  </span>
                  <span style={{ color: 'var(--ink)' }} className="fw-semibold">
                    {complaint?.category}{' '}
                    <i
                      className="small fa-solid fa-arrow-right"
                      style={{ margin: '0 6px', color: '#94a3b8' }}
                    ></i>{' '}
                    {selectedTechDept}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: 'var(--ink-soft)' }} className="small">
                    Assignee
                  </span>
                  <span style={{ color: 'var(--ink)' }} className="fw-semibold">
                    {selectedTechName}{' '}
                    <span style={{ color: '#2563eb' }} className="fw-medium small">
                      ({assignmentType === 'staff' ? 'Existing Staff' : 'Temp Vendor'})
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    gridColumn: 'span 2',
                  }}
                >
                  <span style={{ color: 'var(--ink-soft)' }} className="small">
                    Expected Visit Time
                  </span>
                  <span style={{ color: 'var(--ink)' }} className="fw-semibold">
                    {form.expectedVisit === 'Custom Date & Time'
                      ? `${form.customVisitDate} at ${form.customVisitTime}`
                      : form.expectedVisit}
                  </span>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            padding: '20px 28px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '16px',
          }}
        >
          <button
            type="button"
            className="btn btn-outline"
            onClick={onCancel}
            disabled={assignLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="assignForm"
            disabled={assignLoading}
            style={{
              padding: '12px 32px',
              borderRadius: '8px',
              border: 'none',
              background: '#2563eb',
              color: 'var(--surface)',
              cursor: assignLoading ? 'not-allowed' : 'pointer',
              opacity: assignLoading ? 0.7 : 1,
              transition:
                'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseOver={(e) => !assignLoading && (e.currentTarget.style.background = '#1d4ed8')}
            onMouseOut={(e) => !assignLoading && (e.currentTarget.style.background = '#2563eb')}
          >
            {assignLoading && <i className="fa-solid fa-spinner fa-spin"></i>}
            Confirm Assignment
          </button>
        </div>
      </div>
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
                color: 'var(--surface)',
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
                  color: 'var(--surface)',
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
    </div>
  )
}

export default AssignComplaint
