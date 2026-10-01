import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  declareEmergencyMaintenance,
  fetchFacilities,
  fetchResourcesByFacility,
  clearStatus,
} from '../../store/amenitySlice.js'

const DeclareEmergencyModal = ({ visible, onClose, onSuccess }) => {
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
  const [maintenanceType, setMaintenanceType] = useState('REPAIR')
  const [internalNotes, setInternalNotes] = useState('')
  const [endDateTime, setEndDateTime] = useState('')
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(30)
  const [conflictAction, setConflictAction] = useState('CANCEL_AND_PROCEED')
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (visible) {
      dispatch(fetchFacilities())
      setFacilityId('')
      setResourceId('')
      setTitle('Emergency Repair')
      setReason('')
      setMaintenanceType('REPAIR')
      setInternalNotes('')
      // Default to 4 hours in the future
      const fourHoursAhead = new Date(Date.now() + 4 * 60 * 60 * 1000)
      const isoLocal = new Date(
        fourHoursAhead.getTime() - fourHoursAhead.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
      setEndDateTime(isoLocal)
      setBufferAfterMinutes(30)
      setConflictAction('CANCEL_AND_PROCEED')
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setValidationError('')

    if (!facilityId) {
      setValidationError('Facility is required.')
      return
    }
    if (!title.trim()) {
      setValidationError('Title is required.')
      return
    }
    if (!reason.trim()) {
      setValidationError('Reason is required.')
      return
    }
    if (!endDateTime) {
      setValidationError('End date/time is required.')
      return
    }

    const endEpoch = new Date(endDateTime).getTime()
    if (isNaN(endEpoch) || endEpoch <= Date.now()) {
      setValidationError('End date/time must be strictly in the future.')
      return
    }

    try {
      const res = await dispatch(
        declareEmergencyMaintenance({
          facilityId,
          resourceId: resourceId || null,
          title: title.trim(),
          reason: reason.trim(),
          maintenanceType,
          internalNotes: internalNotes.trim(),
          endDateTime: new Date(endDateTime).toISOString(),
          bufferAfterMinutes: Number(bufferAfterMinutes) || 0,
          conflictAction,
        }),
      ).unwrap()

      if (onSuccess) onSuccess(res)
      onClose()
    } catch (err) {
      setValidationError(typeof err === 'object' ? err.message : err)
    }
  }

  if (!visible) return null

  return (
    <div className="modal-overlay active amenity-os-theme" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--danger)', fontSize: '20px' }}>
              <i className="fa-solid fa-bolt"></i>
            </span>
            <h4 style={{ margin: 0, color: 'var(--danger)' }} className="fs-4">
              Declare Emergency Maintenance
            </h4>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div
              className="alert alert-danger"
              style={{
                background: '#fef2f2',
                border: '1px solid #f87171',
                color: '#991b1b',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '13px',
              }}
            >
              <strong>Urgent Immediate Action:</strong> This takes effect immediately (status:{' '}
              <code>IN_PROGRESS</code>). New bookings will be blocked instantly. Checked-in
              residents will be flagged for safety review.
            </div>

            {validationError && (
              <div className="alert alert-danger p-2 small mb-3">{validationError}</div>
            )}
            {error && (
              <div className="alert alert-danger p-2 small mb-3">
                {typeof error === 'object' ? error.message : error}
              </div>
            )}

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
              <label className="form-label">Target Resource (Optional)</label>
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
              <small className="text-muted">
                Leave as Entire Facility to perform complete facility closure.
              </small>
            </div>

            <div className="form-row-grid">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Electrical Short Circuit"
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
                  <option value="REPAIR">REPAIR</option>
                  <option value="CLEANING">CLEANING</option>
                  <option value="INSPECTION">INSPECTION</option>
                  <option value="UPGRADE">UPGRADE</option>
                  <option value="PREVENTIVE">PREVENTIVE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Emergency Reason *</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Public reason visible to impacted residents"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div className="form-row-grid">
              <div className="form-group">
                <label className="form-label">Estimated End Date/Time *</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={endDateTime}
                  onChange={(e) => setEndDateTime(e.target.value)}
                  required
                />
                <small className="text-muted">Must be strictly in the future.</small>
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

            <div className="form-group">
              <label className="form-label">Conflict Action *</label>
              <select
                className="form-control"
                value={conflictAction}
                onChange={(e) => setConflictAction(e.target.value)}
              >
                <option value="CANCEL_AND_PROCEED">
                  CANCEL_AND_PROCEED (Auto-cancel future bookings with 100% refund, review active)
                </option>
                <option value="REVIEW_ALL">
                  REVIEW_ALL (Keep all bookings pending manual manager review)
                </option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Internal Staff Notes</label>
              <input
                type="text"
                className="form-control"
                placeholder="Internal instructions for security and maintenance teams"
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
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={loading}>
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin me-1"></i> Declaring...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-bolt me-1"></i> Declare Emergency Now
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DeclareEmergencyModal
