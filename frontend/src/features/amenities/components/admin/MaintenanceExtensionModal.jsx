import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { extendV2MaintenanceBlock } from '../../store/amenitySlice.js'

const MaintenanceExtensionModal = ({ visible, onClose, block, onSuccess, onConflictsDetected }) => {
  const dispatch = useDispatch()
  const { loading, error } = useSelector((state) => state.amenities)

  const [newEndDateTime, setNewEndDateTime] = useState('')
  const [conflictAction, setConflictAction] = useState('CANCEL_AND_PROCEED')
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (visible && block) {
      setValidationError('')
      const currentEnd = new Date(block.endDateTime || Date.now())
      // Suggest 2 hours past current end
      const extended = new Date(currentEnd.getTime() + 2 * 60 * 60 * 1000)
      const isoLocal = new Date(extended.getTime() - extended.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      setNewEndDateTime(isoLocal)
      setConflictAction('CANCEL_AND_PROCEED')
    }
  }, [visible, block])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setValidationError('')

    if (!newEndDateTime) {
      setValidationError('New end date/time is required.')
      return
    }

    const currentEpoch = new Date(block.endDateTime).getTime()
    const newEpoch = new Date(newEndDateTime).getTime()

    if (newEpoch <= currentEpoch) {
      setValidationError('New end date/time must be strictly after the current end time.')
      return
    }

    try {
      const res = await dispatch(
        extendV2MaintenanceBlock({
          blockId: block._id,
          data: {
            newEndDateTime: new Date(newEndDateTime).toISOString(),
            conflictAction,
            resolutions: [],
          },
        }),
      ).unwrap()

      if (onSuccess) onSuccess(res)
      onClose()
    } catch (err) {
      if (err?.code === 'MAINTENANCE_IMPACT_NOT_RESOLVED' && onConflictsDetected) {
        onConflictsDetected(block._id, err.details?.conflicts || [])
        onClose()
      } else {
        setValidationError(typeof err === 'object' ? err.message : err)
      }
    }
  }

  if (!visible || !block) return null

  return (
    <div className="modal-overlay active amenity-os-theme" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--primary)', fontSize: '20px' }}>
              <i className="fa-solid fa-clock-rotate-left"></i>
            </span>
            <h4 style={{ margin: 0 }} className="fs-4">
              Extend Maintenance Window
            </h4>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="p-3 border rounded mb-3 bg-light">
              <div className="fw-bold">{block.title}</div>
              <div className="text-muted small">
                Current End: {new Date(block.endDateTime).toLocaleString()}
              </div>
              <div className="text-muted small">
                Effective End (inc. buffer):{' '}
                {new Date(block.effectiveEndDateTime || block.endDateTime).toLocaleString()}
              </div>
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
              <label className="form-label">New End Date / Time *</label>
              <input
                type="datetime-local"
                className="form-control"
                value={newEndDateTime}
                onChange={(e) => setNewEndDateTime(e.target.value)}
                required
              />
              <small className="text-muted">Must be after current end date/time.</small>
            </div>

            <div className="form-group">
              <label className="form-label">Conflict Handling Action</label>
              <select
                className="form-control"
                value={conflictAction}
                onChange={(e) => setConflictAction(e.target.value)}
              >
                <option value="CANCEL_AND_PROCEED">
                  CANCEL_AND_PROCEED (Auto-cancel new conflicts with 100% refund)
                </option>
              </select>
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
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin me-1"></i> Extending...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check me-1"></i> Confirm Extension
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default MaintenanceExtensionModal
