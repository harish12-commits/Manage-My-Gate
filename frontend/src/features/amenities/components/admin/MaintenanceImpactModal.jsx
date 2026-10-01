import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  resolveV2Impact,
  fetchAlternativeSlots,
  clearAlternativeSlots,
} from '../../store/amenitySlice.js'

const MaintenanceImpactModal = ({ visible, onClose, blockId, conflicts = [], onResolved }) => {
  const dispatch = useDispatch()
  const { alternativeSlots, loading } = useSelector((state) => state.amenities)

  const [resolutions, setResolutions] = useState({})
  const [activeRescheduleTarget, setActiveRescheduleTarget] = useState(null)
  const [altSearching, setAltSearching] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (visible && conflicts && conflicts.length > 0) {
      const initialMap = {}
      conflicts.forEach((c) => {
        const id = c.targetId || c._id
        initialMap[id] =
          c.recommendedResolution || (c.requiresManualReview ? 'REVIEW_INDIVIDUALLY' : 'CANCEL')
      })
      setResolutions(initialMap)
      setActiveRescheduleTarget(null)
      setSubmitError('')
      dispatch(clearAlternativeSlots())
    }
  }, [visible, conflicts, dispatch])

  const handleResolutionChange = (targetId, value) => {
    setResolutions((prev) => ({
      ...prev,
      [targetId]: value,
    }))
  }

  const handleCheckAlternatives = async (conflict) => {
    setActiveRescheduleTarget(conflict)
    setAltSearching(true)
    try {
      await dispatch(
        fetchAlternativeSlots({
          facilityId: conflict.facilityId,
          resourceId: conflict.resourceId || null,
          originalStart: conflict.startTime || conflict.startDateTime,
          originalEnd: conflict.endTime || conflict.endDateTime,
          searchDaysAhead: 7,
        }),
      ).unwrap()
    } catch (err) {
      // Handled
    } finally {
      setAltSearching(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitError('')
    const resolutionPayload = Object.entries(resolutions).map(([targetId, resolution]) => {
      const target = conflicts.find((c) => (c.targetId || c._id) === targetId)
      return {
        targetId,
        targetType: target?.targetType || 'V1_BOOKING',
        resolution,
      }
    })

    if (blockId) {
      try {
        await dispatch(
          resolveV2Impact({
            blockId,
            data: { resolutions: resolutionPayload },
          }),
        ).unwrap()
        if (onResolved) onResolved(resolutionPayload)
        onClose()
      } catch (err) {
        setSubmitError(typeof err === 'object' ? err.message : err)
      }
    } else {
      // In pre-scheduling mode, pass resolutions back to caller
      if (onResolved) onResolved(resolutionPayload)
      onClose()
    }
  }

  if (!visible) return null

  return (
    <div className="modal-overlay active amenity-os-theme" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '850px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: '2px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#f59e0b', fontSize: '20px' }}>
              <i className="fa-solid fa-people-arrows"></i>
            </span>
            <h4 style={{ margin: 0 }} className="fs-4">
              Maintenance Impact Resolution
            </h4>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="modal-body">
          <p className="text-muted small mb-3">
            The proposed maintenance window intersects {conflicts.length} active
            reservation(s)/booking(s). Assign a resolution for each resident before proceeding.
          </p>

          {submitError && <div className="alert alert-danger p-2 small mb-3">{submitError}</div>}

          <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table className="ent-table table-sm" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Resident & Unit</th>
                  <th>Window</th>
                  <th>Current Status</th>
                  <th>Review Flag</th>
                  <th style={{ minWidth: '180px' }}>Resolution Action</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map((c) => {
                  const targetId = c.targetId || c._id
                  const isCheckedIn = c.status === 'checked-in' || c.status === 'CHECKED_IN'
                  return (
                    <tr key={targetId} style={isCheckedIn ? { background: '#fffbeb' } : {}}>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '11px' }}>
                          {c.targetType || 'V1_BOOKING'}
                        </span>
                      </td>
                      <td>
                        <div className="fw-bold">{c.residentName || 'Resident'}</div>
                        <div className="text-muted small">
                          {c.residentUnit || 'N/A'} {c.residentPhone ? `• ${c.residentPhone}` : ''}
                        </div>
                      </td>
                      <td>
                        <div>{new Date(c.startTime || c.startDateTime).toLocaleDateString()}</div>
                        <div className="text-muted small">
                          {new Date(c.startTime || c.startDateTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' - '}
                          {new Date(c.endTime || c.endDateTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${isCheckedIn ? 'badge-warning' : 'badge-primary'}`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td>
                        {c.requiresManualReview || isCheckedIn ? (
                          <span
                            className="badge badge-warning"
                            title="Checked-in resident requires individual care"
                          >
                            <i className="fa-solid fa-user-shield me-1"></i> Manual Review
                          </span>
                        ) : (
                          <span className="text-muted small">Standard</span>
                        )}
                      </td>
                      <td>
                        <select
                          className="form-control form-control-sm"
                          value={resolutions[targetId] || 'CANCEL'}
                          onChange={(e) => handleResolutionChange(targetId, e.target.value)}
                        >
                          <option value="CANCEL">CANCEL (100% Refund)</option>
                          <option value="RESCHEDULE">RESCHEDULE</option>
                          <option value="REVIEW_INDIVIDUALLY">REVIEW_INDIVIDUALLY</option>
                        </select>
                        {resolutions[targetId] === 'RESCHEDULE' && (
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 mt-1 small"
                            onClick={() => handleCheckAlternatives(c)}
                          >
                            <i className="fa-solid fa-calendar-days me-1"></i> Find Alternatives
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Alternative Slots Discovery Panel */}
          {activeRescheduleTarget && (
            <div
              className="mt-3 p-3 border rounded"
              style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}
            >
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="m-0 fw-bold">
                  Alternative Slots for {activeRescheduleTarget.residentName} (
                  {activeRescheduleTarget.residentUnit})
                </h6>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setActiveRescheduleTarget(null)}
                >
                  Close
                </button>
              </div>

              {altSearching ? (
                <div className="text-center py-2 text-muted small">
                  <i className="fa-solid fa-spinner fa-spin me-1"></i> Querying backend availability
                  engine...
                </div>
              ) : alternativeSlots && alternativeSlots.length > 0 ? (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {alternativeSlots.slice(0, 8).map((slot, idx) => (
                    <div
                      key={idx}
                      className="p-2 border rounded bg-white small"
                      style={{ minWidth: '150px' }}
                    >
                      <div className="fw-bold">
                        {new Date(slot.startTime || slot.date).toLocaleDateString()}
                      </div>
                      <div className="text-muted">
                        {slot.startTime
                          ? new Date(slot.startTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : slot.slot}
                      </div>
                      {slot.resourceName && (
                        <span className="badge badge-info mt-1" style={{ fontSize: '10px' }}>
                          {slot.resourceName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted small py-2">
                  No alternative slots discovered in the next 7 days for this resource.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin me-1"></i> Saving Resolutions...
              </>
            ) : (
              <>
                <i className="fa-solid fa-check me-1"></i> Confirm Resolutions
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MaintenanceImpactModal
