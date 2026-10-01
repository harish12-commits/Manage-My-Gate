import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchFacilities,
  fetchResourcesByFacility,
  previewRecurringMaintenance,
  scheduleRecurringMaintenance,
} from '../../store/amenitySlice.js'

const DAYS_OF_WEEK = [
  { id: 0, label: 'Sun' },
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
]

const RecurringMaintenanceModal = ({ visible, onClose, onSuccess }) => {
  const dispatch = useDispatch()
  const { facilities, resources, loading, error } = useSelector((state) => state.amenities)

  const [facilityId, setFacilityId] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [maintenanceType, setMaintenanceType] = useState('CLEANING')
  const [internalNotes, setInternalNotes] = useState('')
  const [startDateTime, setStartDateTime] = useState('')
  const [endDateTime, setEndDateTime] = useState('')
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(15)
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(15)
  const [isCompleteClosure, setIsCompleteClosure] = useState(true)

  // Recurrence config
  const [frequency, setFrequency] = useState('WEEKLY')
  const [interval, setInterval] = useState(1)
  const [selectedDays, setSelectedDays] = useState([1]) // Default to Monday
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [occurrenceCount, setOccurrenceCount] = useState(8)
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  )

  const [previewResult, setPreviewResult] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [validationError, setValidationError] = useState('')

  const facilitiesList = Array.isArray(facilities)
    ? facilities
    : Array.isArray(facilities?.data)
      ? facilities.data
      : Array.isArray(facilities?.records)
        ? facilities.records
        : []
  const resourcesList = Array.isArray(resources) ? resources : []

  useEffect(() => {
    if (visible) {
      dispatch(fetchFacilities())
      setFacilityId('')
      setResourceId('')
      setTitle('Scheduled Routine Upkeep')
      setReason('Periodic preventive maintenance')
      setMaintenanceType('CLEANING')
      setInternalNotes('')

      // Default start 1 day ahead, 08:00 to 10:00
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      tomorrow.setHours(8, 0, 0, 0)
      const isoStart = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      tomorrow.setHours(10, 0, 0, 0)
      const isoEnd = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)

      setStartDateTime(isoStart)
      setEndDateTime(isoEnd)
      setBufferBeforeMinutes(15)
      setBufferAfterMinutes(15)
      setIsCompleteClosure(true)

      setFrequency('WEEKLY')
      setInterval(1)
      setSelectedDays([1])
      setDayOfMonth(1)
      setOccurrenceCount(8)
      setPreviewResult(null)
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

  const toggleDayOfWeek = (dayId) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort(),
    )
  }

  const buildRecurrenceObject = () => {
    const rec = {
      frequency,
      interval: parseInt(interval, 10) || 1,
      occurrenceCount: Math.min(Math.max(parseInt(occurrenceCount, 10) || 1, 1), 60),
      timezone: timezone || 'UTC',
    }
    if (frequency === 'WEEKLY' || frequency === 'CUSTOM') {
      rec.daysOfWeek = selectedDays.length > 0 ? selectedDays : [1]
    }
    if (frequency === 'MONTHLY') {
      rec.dayOfMonth = parseInt(dayOfMonth, 10) || 1
    }
    return rec
  }

  const handlePreview = async () => {
    setValidationError('')
    if (!facilityId) {
      setValidationError('Facility is required for preview.')
      return
    }
    if (!startDateTime || !endDateTime) {
      setValidationError('Start and End times are required.')
      return
    }

    setPreviewLoading(true)
    try {
      const payload = {
        facilityId,
        resourceId: resourceId || null,
        resourceIds: resourceId ? [resourceId] : [],
        title: title.trim() || 'Maintenance',
        reason: reason.trim() || 'Maintenance',
        maintenanceType,
        startDateTime: new Date(startDateTime).toISOString(),
        endDateTime: new Date(endDateTime).toISOString(),
        bufferBeforeMinutes: parseInt(bufferBeforeMinutes, 10) || 0,
        bufferAfterMinutes: parseInt(bufferAfterMinutes, 10) || 0,
        recurrence: buildRecurrenceObject(),
      }
      const res = await dispatch(previewRecurringMaintenance(payload)).unwrap()
      setPreviewResult(res)
    } catch (err) {
      setValidationError(typeof err === 'object' ? err.message : err)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSchedule = async () => {
    setValidationError('')
    if (!facilityId || !title.trim() || !reason.trim() || !startDateTime || !endDateTime) {
      setValidationError('All required fields must be completed.')
      return
    }

    const payload = {
      facilityId,
      resourceId: resourceId || null,
      resourceIds: resourceId ? [resourceId] : [],
      title: title.trim(),
      reason: reason.trim(),
      maintenanceType,
      internalNotes: internalNotes.trim() || undefined,
      startDateTime: new Date(startDateTime).toISOString(),
      endDateTime: new Date(endDateTime).toISOString(),
      bufferBeforeMinutes: parseInt(bufferBeforeMinutes, 10) || 0,
      bufferAfterMinutes: parseInt(bufferAfterMinutes, 10) || 0,
      isCompleteClosure,
      degradedCapacity: 0,
      recurrence: buildRecurrenceObject(),
      conflictAction: 'CANCEL_AND_PROCEED',
      impactResolutions: [],
      resolutions: [],
    }

    try {
      const res = await dispatch(scheduleRecurringMaintenance(payload)).unwrap()
      if (onSuccess) onSuccess(res)
      onClose()
    } catch (err) {
      setValidationError(typeof err === 'object' ? err.message : err)
    }
  }

  if (!visible) return null

  return (
    <div className="modal-overlay active amenity-os-theme" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--primary)', fontSize: '20px' }}>
              <i className="fa-solid fa-arrows-rotate"></i>
            </span>
            <h4 style={{ margin: 0 }} className="fs-4">
              Schedule Recurring Maintenance
            </h4>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

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
                <option value="">All Resources (Facility-Wide)</option>
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
                <option value="CLEANING">CLEANING</option>
                <option value="REPAIR">REPAIR</option>
                <option value="INSPECTION">INSPECTION</option>
                <option value="UPGRADE">UPGRADE</option>
                <option value="PREVENTIVE">PREVENTIVE</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reason *</label>
            <input
              type="text"
              className="form-control"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div className="form-row-grid">
            <div className="form-group">
              <label className="form-label">First Start Window *</label>
              <input
                type="datetime-local"
                className="form-control"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">First End Window *</label>
              <input
                type="datetime-local"
                className="form-control"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                required
              />
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

          <hr className="my-3" />

          <h6 className="fw-bold mb-3">
            <i className="fa-regular fa-clock me-1"></i> Recurrence Rules
          </h6>

          <div className="form-row-grid">
            <div className="form-group">
              <label className="form-label">Frequency *</label>
              <select
                className="form-control"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="YEARLY">YEARLY</option>
                <option value="CUSTOM">CUSTOM</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Repeat Every (Interval)</label>
              <input
                type="number"
                min="1"
                className="form-control"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
              />
            </div>
          </div>

          {(frequency === 'WEEKLY' || frequency === 'CUSTOM') && (
            <div className="form-group">
              <label className="form-label">Days of Week</label>
              <div className="d-flex gap-2 flex-wrap">
                {DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`btn btn-sm ${selectedDays.includes(d.id) ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => toggleDayOfWeek(d.id)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frequency === 'MONTHLY' && (
            <div className="form-group">
              <label className="form-label">Day of Month (1-31)</label>
              <input
                type="number"
                min="1"
                max="31"
                className="form-control"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
            </div>
          )}

          <div className="form-row-grid">
            <div className="form-group">
              <label className="form-label">Total Occurrences (Max 60) *</label>
              <input
                type="number"
                min="1"
                max="60"
                className="form-control"
                value={occurrenceCount}
                onChange={(e) => setOccurrenceCount(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Timezone</label>
              <input
                type="text"
                className="form-control"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
          </div>

          <div className="d-flex justify-content-end mb-3">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={handlePreview}
              disabled={previewLoading}
            >
              {previewLoading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin me-1"></i> Calculating Series...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-eye me-1"></i> Preview Series Occurrences & Conflicts
                </>
              )}
            </button>
          </div>

          {/* Preview Results Box */}
          {previewResult && (
            <div className="p-3 border rounded mb-3 bg-light">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="m-0 fw-bold">
                  Generated{' '}
                  {previewResult.occurrenceCount || previewResult.occurrences?.length || 0}{' '}
                  Occurrence(s)
                </h6>
                <span
                  className={`badge ${(previewResult.totalConflicts || 0) > 0 ? 'badge-warning' : 'badge-success'}`}
                >
                  {previewResult.totalConflicts || 0} Conflict(s) Detected
                </span>
              </div>

              {previewResult.occurrences && (
                <div style={{ maxHeight: '180px', overflowY: 'auto' }} className="small">
                  {previewResult.occurrences.slice(0, 10).map((occ, idx) => (
                    <div key={idx} className="d-flex justify-content-between py-1 border-bottom">
                      <span>
                        #{idx + 1}: {new Date(occ.startDateTime).toLocaleDateString()}{' '}
                        {new Date(occ.startDateTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        -{' '}
                        {new Date(occ.endDateTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {occ.conflictsCount > 0 ? (
                        <span className="text-danger fw-bold">
                          {occ.conflictsCount} conflict(s)
                        </span>
                      ) : (
                        <span className="text-success">Clear</span>
                      )}
                    </div>
                  ))}
                  {previewResult.occurrences.length > 10 && (
                    <div className="text-muted text-center pt-1">
                      ...and {previewResult.occurrences.length - 10} more occurrences
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSchedule}
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin me-1"></i> Creating Series...
              </>
            ) : (
              <>
                <i className="fa-solid fa-calendar-check me-1"></i> Confirm & Schedule Series
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RecurringMaintenanceModal
