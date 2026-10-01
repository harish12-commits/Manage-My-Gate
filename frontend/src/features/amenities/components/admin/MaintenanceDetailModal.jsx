import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchV2Impacts } from '../../store/amenitySlice.js'

const MaintenanceDetailModal = ({ visible, onClose, block, onResolveImpacts, onExtend }) => {
  const dispatch = useDispatch()
  const { activeImpacts } = useSelector((state) => state.amenities)

  useEffect(() => {
    if (visible && block?._id) {
      dispatch(fetchV2Impacts(block._id))
    }
  }, [visible, block, dispatch])

  if (!visible || !block) return null

  const isEmergency = block.isEmergency
  const unresolvedImpacts = activeImpacts.filter(
    (i) => i.resolutionStatus === 'PENDING' || i.resolution === 'REVIEW_INDIVIDUALLY',
  )

  return (
    <div className="modal-overlay active amenity-os-theme" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                color: isEmergency ? '#ef4444' : 'var(--primary)',
                fontSize: '20px',
              }}
            >
              <i
                className={isEmergency ? 'fa-solid fa-bolt' : 'fa-solid fa-screwdriver-wrench'}
              ></i>
            </span>
            <h4 style={{ margin: 0 }} className="fs-4">
              {block.title}
            </h4>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div className="d-flex gap-2 mb-3">
            <span
              className={`badge ${
                block.status === 'COMPLETED'
                  ? 'badge-success'
                  : block.status === 'IN_PROGRESS' || block.status === 'ACTIVE'
                    ? 'badge-warning'
                    : block.status === 'CANCELLED'
                      ? 'badge-danger'
                      : 'badge-primary'
              }`}
            >
              {block.status}
            </span>
            {isEmergency && <span className="badge badge-danger">EMERGENCY</span>}
            <span className="badge badge-info">{block.maintenanceType || 'MAINTENANCE'}</span>
          </div>

          <div className="p-3 border rounded mb-3 bg-light">
            <div className="row g-2">
              <div className="col-6">
                <span className="text-muted small">Facility:</span>
                <div className="fw-bold">
                  {block.facilityId?.name || block.facilityName || 'Facility'}
                </div>
              </div>
              <div className="col-6">
                <span className="text-muted small">Resource Scope:</span>
                <div className="fw-bold">
                  {block.resourceId?.name ||
                    (block.resourceIds?.length
                      ? `${block.resourceIds.length} Resources`
                      : 'Entire Facility')}
                </div>
              </div>
              <div className="col-6 mt-2">
                <span className="text-muted small">Scheduled Window:</span>
                <div className="small">
                  {new Date(block.startDateTime).toLocaleString()} -{' '}
                  {new Date(block.endDateTime).toLocaleString()}
                </div>
              </div>
              <div className="col-6 mt-2">
                <span className="text-muted small">Effective Window (Buffers):</span>
                <div className="small text-primary fw-medium">
                  {new Date(block.effectiveStartDateTime || block.startDateTime).toLocaleString()} -{' '}
                  {new Date(block.effectiveEndDateTime || block.endDateTime).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <h6 className="fw-bold mb-1">Reason</h6>
            <p className="text-muted small">{block.reason || 'None specified'}</p>
          </div>

          {block.internalNotes && (
            <div className="mb-3">
              <h6 className="fw-bold mb-1">Internal Notes</h6>
              <p className="text-muted small">{block.internalNotes}</p>
            </div>
          )}

          {/* Associated Impacts */}
          <div className="mt-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold m-0">Impacted Bookings ({activeImpacts.length})</h6>
              {unresolvedImpacts.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-warning"
                  onClick={() => {
                    onClose()
                    if (onResolveImpacts) onResolveImpacts(block, activeImpacts)
                  }}
                >
                  <i className="fa-solid fa-triangle-exclamation me-1"></i> Resolve{' '}
                  {unresolvedImpacts.length} Pending
                </button>
              )}
            </div>

            {activeImpacts.length === 0 ? (
              <div className="text-muted small p-2 border rounded text-center">
                No bookings were impacted by this maintenance block.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="ent-table table-sm small">
                  <thead>
                    <tr>
                      <th>Target</th>
                      <th>Resident</th>
                      <th>Resolution</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeImpacts.map((imp) => (
                      <tr key={imp._id}>
                        <td>{imp.targetType}</td>
                        <td>{imp.residentName || imp.targetId}</td>
                        <td>
                          <span className="badge badge-info">{imp.resolution || 'PENDING'}</span>
                        </td>
                        <td>
                          <span className="badge badge-secondary">
                            {imp.resolutionStatus || 'RESOLVED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          {block.status !== 'COMPLETED' && block.status !== 'CANCELLED' && (
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => {
                onClose()
                if (onExtend) onExtend(block)
              }}
            >
              <i className="fa-solid fa-clock-rotate-left me-1"></i> Extend Window
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default MaintenanceDetailModal
