import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchFacilities,
  fetchResourcesByFacility,
  fetchImpactPreview,
  scheduleV2Maintenance,
} from '../../store/amenitySlice.js'

const V2MaintenanceFormModal = ({ visible, onClose, onSuccess, onConflictsDetected }) => {
  const dispatch = useDispatch()
  const { facilities, resources, loading, error } = useSelector((state) => state.amenities)

  const facilitiesList = Array.isArray(facilities)
    ? facilities
    : Array.isArray(facilities?.data)
      ? facilities.data
      : []

  const resourcesList = Array.isArray(resources)
    ? resources
    : Array.isArray(resources?.data)
      ? resources.data
      : []

  const [facilityId, setFacilityId] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [maintenanceType, setMaintenanceType] = useState('PREVENTIVE')
  const [internalNotes, setInternalNotes] = useState('')
  const [windows, setWindows] = useState([])
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(15)
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(15)
  const [isCompleteClosure, setIsCompleteClosure] = useState(true)
  const [degradedCapacity, setDegradedCapacity] = useState(0)

  const [validationError, setValidationError] = useState('')
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    if (visible) {
      dispatch(fetchFacilities())
      setFacilityId('')
      setResourceId('')
      setTitle('')
      setReason('')
      setMaintenanceType('PREVENTIVE')
      setInternalNotes('')

      // Default start today 00:00 to 17:00
      const now = new Date()
      const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10)
      const isoStart = `${todayStr}T00:00`
      const isoEnd = `${todayStr}T17:00`

      setWindows([
        {
          id: Date.now(),
          startDateTime: isoStart,
          endDateTime: isoEnd,
        },
      ])
      setBufferBeforeMinutes(15)
      setBufferAfterMinutes(15)
      setIsCompleteClosure(true)
      setDegradedCapacity(0)
      setValidationError('')
    }
  }, [visible, dispatch])

  const handleFacilityChange = (e) => {
    const selectedId = e.target.value
    setFacilityId(selectedId)
    setResourceId('')
    if (selectedId) {
      dispatch(fetchResourcesByFacility(selectedId))
    }
  }

  const handleAddWindow = () => {
    const lastWindow = windows[windows.length - 1]
    let nextStart = ''
    let nextEnd = ''
    if (lastWindow && lastWindow.startDateTime && lastWindow.endDateTime) {
      // Smart default: next day with same times
      const prevStart = new Date(lastWindow.startDateTime)
      const prevEnd = new Date(lastWindow.endDateTime)
      const durationMs = prevEnd.getTime() - prevStart.getTime()
      const nextStartDate = new Date(prevStart.getTime() + 24 * 60 * 60 * 1000)
      const nextEndDate = new Date(nextStartDate.getTime() + durationMs)

      nextStart = new Date(nextStartDate.getTime() - nextStartDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      nextEnd = new Date(nextEndDate.getTime() - nextEndDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    } else {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      nextStart = `${iso}T00:00`
      nextEnd = `${iso}T17:00`
    }

    setWindows((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        startDateTime: nextStart,
        endDateTime: nextEnd,
      },
    ])
  }

  const handleRemoveWindow = (id) => {
    if (windows.length <= 1) return
    setWindows((prev) => prev.filter((w) => w.id !== id))
  }

  const handleWindowChange = (id, field, value) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, [field]: value } : w)))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setValidationError('')

    if (!facilityId || !title.trim() || !reason.trim() || windows.length === 0) {
      setValidationError('Please complete all required fields.')
      return
    }

    // Validate each window
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i]
      if (!w.startDateTime || !w.endDateTime) {
        setValidationError(`Window #${i + 1}: Start and end date/time are required.`)
        return
      }
      const startEpoch = new Date(w.startDateTime).getTime()
      const endEpoch = new Date(w.endDateTime).getTime()
      if (endEpoch <= startEpoch) {
        setValidationError(`Window #${i + 1}: End time must be after start time.`)
        return
      }
    }

    const formattedWindows = windows.map((w) => ({
      startDateTime: new Date(w.startDateTime).toISOString(),
      endDateTime: new Date(w.endDateTime).toISOString(),
    }))

    const basePayload = {
      facilityId,
      resourceId: resourceId || null,
      resourceIds: resourceId ? [resourceId] : [],
      title: title.trim(),
      reason: reason.trim(),
      maintenanceType,
      internalNotes: internalNotes.trim() || undefined,
      startDateTime: formattedWindows[0].startDateTime,
      endDateTime: formattedWindows[0].endDateTime,
      windows: formattedWindows,
      bufferBeforeMinutes: parseInt(bufferBeforeMinutes, 10) || 0,
      bufferAfterMinutes: parseInt(bufferAfterMinutes, 10) || 0,
      isCompleteClosure,
      degradedCapacity: parseInt(degradedCapacity, 10) || 0,
    }

    // First check impact preview to protect against silent cancellations
    setPreviewing(true)
    try {
      const preview = await dispatch(
        fetchImpactPreview({
          facilityId: basePayload.facilityId,
          resourceId: basePayload.resourceId,
          resourceIds: basePayload.resourceIds,
          startDateTime: basePayload.startDateTime,
          endDateTime: basePayload.endDateTime,
          windows: basePayload.windows,
          bufferBeforeMinutes: basePayload.bufferBeforeMinutes,
          bufferAfterMinutes: basePayload.bufferAfterMinutes,
        }),
      ).unwrap()

      if (preview && preview.totalConflicts > 0 && onConflictsDetected) {
        // Hand off to impact resolution modal with pending payload
        onConflictsDetected(basePayload, preview.conflicts)
        onClose()
        return
      }

      // No conflicts: proceed directly
      const res = await dispatch(
        scheduleV2Maintenance({
          ...basePayload,
          conflictAction: 'CANCEL_AND_PROCEED',
          resolutions: [],
        }),
      ).unwrap()

      if (onSuccess) onSuccess(res)
      onClose()
    } catch (err) {
      if (err?.code === 'MAINTENANCE_IMPACT_NOT_RESOLVED' && onConflictsDetected) {
        onConflictsDetected(basePayload, err.details?.conflicts || [])
        onClose()
      } else {
        setValidationError(typeof err === 'object' ? err.message : err)
      }
    } finally {
      setPreviewing(false)
    }
  }

  if (!visible) return null

  return (
    <div className="modal-overlay active amenity-os-theme" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4 style={{ margin: 0 }} className="fs-4">
            Schedule Maintenance Block
          </h4>
          <button type="button" className="modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            {validationError && (
              <div className="alert alert-danger p-2 small mb-3">{validationError}</div>
            )}
            {error && (
              <div className="alert alert-danger p-2 small mb-3">
                {typeof error === 'object' ? error.message : error}
              </div>
            )}

            <div className="form-row-grid">
              <div className="form-group">
                <label className="form-label">Facility *</label>
                <select
                  className="form-control"
                  value={facilityId}
                  onChange={handleFacilityChange}
                  required
                >
                  <option value="">-- Select Facility --</option>
                  {facilitiesList.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name} ({f.facilityType || f.code || 'Facility'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Resource Scope</label>
                <select
                  className="form-control"
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  disabled={!facilityId}
                >
                  <option value="">Entire Facility (All Resources)</option>
                  {resourcesList.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name} ({r.code || 'Resource'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row-grid">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Annual Pool Resurfacing"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Maintenance Type</label>
                <select
                  className="form-control"
                  value={maintenanceType}
                  onChange={(e) => setMaintenanceType(e.target.value)}
                >
                  <option value="PREVENTIVE">PREVENTIVE</option>
                  <option value="CLEANING">CLEANING</option>
                  <option value="REPAIR">REPAIR</option>
                  <option value="INSPECTION">INSPECTION</option>
                  <option value="UPGRADE">UPGRADE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Public Reason *</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Reason displayed on resident calendar and notifications"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            {/* Maintenance Schedule Windows */}
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label m-0 fw-bold">
                  <i className="fa-solid fa-calendar-days me-1 text-primary"></i> Maintenance
                  Windows ({windows.length})
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={handleAddWindow}
                >
                  <i className="fa-solid fa-plus me-1"></i> Add Another Window
                </button>
              </div>

              {windows.map((w, idx) => (
                <div key={w.id} className="p-2.5 mb-2 border rounded bg-light position-relative">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="small fw-bold text-secondary">Window #{idx + 1}</span>
                    {windows.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-danger p-0 text-decoration-none"
                        style={{ fontSize: '12px' }}
                        onClick={() => handleRemoveWindow(w.id)}
                        title="Remove this window"
                      >
                        <i className="fa-solid fa-trash me-1"></i> Remove
                      </button>
                    )}
                  </div>
                  <div className="form-row-grid">
                    <div className="form-group mb-0">
                      <label className="form-label small">Start Date/Time *</label>
                      <input
                        type="datetime-local"
                        className="form-control form-control-sm"
                        value={w.startDateTime}
                        onChange={(e) => handleWindowChange(w.id, 'startDateTime', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label small">End Date/Time *</label>
                      <input
                        type="datetime-local"
                        className="form-control form-control-sm"
                        value={w.endDateTime}
                        onChange={(e) => handleWindowChange(w.id, 'endDateTime', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-muted small mt-1">
                You can schedule multiple maintenance periods (e.g. today 12:00 AM–5:00 PM, tomorrow
                12:00 AM–5:00 PM, and 10 days later) in this single submission.
              </div>
            </div>

            <div className="form-row-grid">
              <div className="form-group">
                <label className="form-label">Buffer Before (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={bufferBeforeMinutes}
                  onChange={(e) => setBufferBeforeMinutes(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Buffer After (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={bufferAfterMinutes}
                  onChange={(e) => setBufferAfterMinutes(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row-grid">
              <div className="form-group d-flex align-items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="completeClosureCheckbox"
                  checked={isCompleteClosure}
                  onChange={(e) => setIsCompleteClosure(e.target.checked)}
                />
                <label htmlFor="completeClosureCheckbox" className="m-0 fw-bold small">
                  Complete Closure (Zero Booking Capacity)
                </label>
              </div>

              {!isCompleteClosure && (
                <div className="form-group">
                  <label className="form-label">Degraded Capacity</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={degradedCapacity}
                    onChange={(e) => setDegradedCapacity(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Internal Notes</label>
              <input
                type="text"
                className="form-control"
                placeholder="Internal notes for operations staff"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={loading || previewing}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || previewing}>
              {previewing ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin me-1"></i> Checking Conflicts...
                </>
              ) : loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin me-1"></i> Scheduling...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-calendar-plus me-1"></i>{' '}
                  {windows.length > 1
                    ? `Schedule ${windows.length} Maintenance Blocks`
                    : 'Schedule Block'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default V2MaintenanceFormModal
