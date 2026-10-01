import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import AmenitiesTopNav from '../components/AmenitiesTopNav.jsx'
import V2MaintenanceFormModal from '../components/admin/V2MaintenanceFormModal.jsx'
import DeclareEmergencyModal from '../components/admin/DeclareEmergencyModal.jsx'
import RecurringMaintenanceModal from '../components/admin/RecurringMaintenanceModal.jsx'
import MaintenanceImpactModal from '../components/admin/MaintenanceImpactModal.jsx'
import MaintenanceExtensionModal from '../components/admin/MaintenanceExtensionModal.jsx'
import MaintenanceDetailModal from '../components/admin/MaintenanceDetailModal.jsx'
import {
  fetchV2Maintenance,
  fetchFacilities,
  getAmenities,
  mapAmenityToFacilityPayload,
  updateV2MaintenanceStatus,
  scheduleV2Maintenance,
  clearStatus,
} from '../store/amenitySlice.js'
import amenityManagementApi from '../services/amenityManagementApi.js'
import '../styles/_amenities.scss'

const AdminMaintenanceView = () => {
  const dispatch = useDispatch()
  const {
    maintenanceBlocks,
    maintenancePagination,
    facilities,
    items: v1Amenities,
    loading,
    error,
    successMsg,
  } = useSelector((state) => state.amenities)

  const facilitiesList = Array.isArray(facilities)
    ? facilities
    : Array.isArray(facilities?.data)
      ? facilities.data
      : []

  const blocksList = Array.isArray(maintenanceBlocks)
    ? maintenanceBlocks
    : Array.isArray(maintenanceBlocks?.data)
      ? maintenanceBlocks.data
      : []

  // Filter & Pagination States
  const [selectedFacility, setSelectedFacility] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  // Modal Visibility States
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false)
  const [recurringModalVisible, setRecurringModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [extensionModalVisible, setExtensionModalVisible] = useState(false)
  const [impactModalVisible, setImpactModalVisible] = useState(false)

  // Active item states
  const [activeBlock, setActiveBlock] = useState(null)
  const [activeConflicts, setActiveConflicts] = useState([])
  const [pendingSchedulePayload, setPendingSchedulePayload] = useState(null)

  const loadData = useCallback(() => {
    const params = { page: currentPage, limit: itemsPerPage }
    if (selectedFacility) params.facilityId = selectedFacility
    if (selectedStatus) params.status = selectedStatus
    dispatch(fetchV2Maintenance(params))
    dispatch(fetchFacilities())
    dispatch(getAmenities())
  }, [dispatch, currentPage, selectedFacility, selectedStatus])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-sync existing V1 amenities that do not yet have a matching V2 facility
  const syncedRef = React.useRef(new Set())
  useEffect(() => {
    if (Array.isArray(v1Amenities) && v1Amenities.length > 0 && facilitiesList.length >= 0) {
      const missing = v1Amenities.filter(
        (v1) =>
          v1 &&
          v1.name &&
          !syncedRef.current.has(v1._id) &&
          !facilitiesList.some(
            (f) =>
              f.name?.toLowerCase().trim() === v1.name?.toLowerCase().trim() ||
              (v1.code && f.code?.toUpperCase().trim() === v1.code?.toUpperCase().trim()),
          ),
      )

      if (missing.length > 0) {
        missing.forEach((v1) => syncedRef.current.add(v1._id))
        Promise.all(
          missing.map((v1) =>
            amenityManagementApi
              .createFacility(mapAmenityToFacilityPayload(v1))
              .catch((e) => console.warn('Auto-sync facility error:', e?.message || e)),
          ),
        ).then(() => {
          dispatch(fetchFacilities())
        })
      }
    }
  }, [v1Amenities, facilitiesList, dispatch])

  // Status badge style helper
  const getStatusBadge = (status, isEmergency) => {
    if (isEmergency && (status === 'IN_PROGRESS' || status === 'ACTIVE')) {
      return (
        <span className="badge badge-danger">
          <i className="fa-solid fa-bolt me-1"></i> EMERGENCY
        </span>
      )
    }
    switch (status) {
      case 'COMPLETED':
        return <span className="badge badge-success">Completed</span>
      case 'IN_PROGRESS':
      case 'ACTIVE':
        return <span className="badge badge-warning">In Progress</span>
      case 'CANCELLED':
        return <span className="badge badge-danger">Cancelled</span>
      case 'SCHEDULED':
      default:
        return (
          <span className="badge badge-primary" style={{ background: '#e0e7ff', color: '#4338ca' }}>
            Scheduled
          </span>
        )
    }
  }

  // Actions
  const handleComplete = async (block) => {
    if (window.confirm(`Mark maintenance "${block.title}" as completed?`)) {
      await dispatch(
        updateV2MaintenanceStatus({
          blockId: block._id,
          data: { status: 'COMPLETED' },
        }),
      )
      loadData()
    }
  }

  const handleCancel = async (block) => {
    if (window.confirm(`Are you sure you want to cancel maintenance "${block.title}"?`)) {
      await dispatch(
        updateV2MaintenanceStatus({
          blockId: block._id,
          data: { status: 'CANCELLED' },
        }),
      )
      loadData()
    }
  }

  // Handlers for conflicts from scheduling
  const handleConflictsDetectedDuringSchedule = (payload, conflicts) => {
    setPendingSchedulePayload(payload)
    setActiveConflicts(conflicts)
    setActiveBlock(null)
    setImpactModalVisible(true)
  }

  const handleResolutionsConfirmed = async (resolutions) => {
    if (pendingSchedulePayload) {
      // Proceed with scheduling using confirmed resolutions
      try {
        await dispatch(
          scheduleV2Maintenance({
            ...pendingSchedulePayload,
            resolutions,
            conflictAction: 'CANCEL_AND_PROCEED',
          }),
        ).unwrap()
        setPendingSchedulePayload(null)
        setActiveConflicts([])
        loadData()
      } catch (err) {
        // Redux handles error
      }
    } else if (activeBlock) {
      loadData()
    }
  }

  const totalItems = maintenancePagination?.total || blocksList?.length || 0
  const totalPages = maintenancePagination?.pages || Math.ceil(totalItems / itemsPerPage) || 1

  return (
    <div className="amenities-module-wrapper amenity-os-theme">
      <AmenitiesTopNav />
      <div className="view-container">
        <div className="view active" id="view-admin-maintenance">
          {/* Header & Main CTAs */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <h2 style={{ margin: 0 }} className="fs-2">
                Amenity Maintenance Subsystem
              </h2>
              <p style={{ color: 'var(--text-muted)', margin: 0 }} className="fw-medium">
                Manage scheduled blackouts, recurring upkeep series, and emergency closures.
              </p>
            </div>

            <div className="d-flex gap-2 flex-wrap">
              <button
                className="btn btn-outline-danger d-flex align-items-center gap-1"
                onClick={() => setEmergencyModalVisible(true)}
              >
                <i className="fa-solid fa-bolt"></i> Declare Emergency
              </button>
              <button
                className="btn btn-outline-primary d-flex align-items-center gap-1"
                onClick={() => setRecurringModalVisible(true)}
              >
                <i className="fa-solid fa-arrows-rotate"></i> Recurring Series
              </button>
              <button
                className="btn btn-primary d-flex align-items-center gap-1"
                onClick={() => setScheduleModalVisible(true)}
              >
                <i className="fa-solid fa-plus"></i> Schedule Maintenance
              </button>
            </div>
          </div>

          {/* Alert Banners */}
          {error && (
            <div
              className="alert alert-danger"
              style={{
                marginBottom: '20px',
                padding: '12px 16px',
                background: '#ffebee',
                color: '#c62828',
                borderRadius: '8px',
              }}
            >
              {typeof error === 'object' ? error.message : error}
            </div>
          )}
          {successMsg && (
            <div
              className="alert alert-success"
              style={{
                marginBottom: '20px',
                padding: '12px 16px',
                background: '#e8f5e9',
                color: '#2e7d32',
                borderRadius: '8px',
              }}
            >
              {successMsg}
            </div>
          )}

          {/* Filters Bar */}
          <div
            className="card p-3 mb-3"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-light)' }}
          >
            <div className="d-flex gap-3 flex-wrap align-items-center">
              <div style={{ minWidth: '200px' }}>
                <select
                  className="form-control form-control-sm"
                  value={selectedFacility}
                  onChange={(e) => {
                    setSelectedFacility(e.target.value)
                    setCurrentPage(1)
                  }}
                >
                  <option value="">All Facilities</option>
                  {facilitiesList.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ minWidth: '160px' }}>
                <select
                  className="form-control form-control-sm"
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value)
                    setCurrentPage(1)
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="SCHEDULED">SCHEDULED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              {(selectedFacility || selectedStatus) && (
                <button
                  className="btn btn-sm btn-link text-muted"
                  onClick={() => {
                    setSelectedFacility('')
                    setSelectedStatus('')
                    setCurrentPage(1)
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Maintenance Blocks Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Facility & Scope</th>
                    <th>Title & Type</th>
                    <th>Scheduled Window</th>
                    <th>Effective Window (Buffers)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && blocksList.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>
                        <i className="fa-solid fa-spinner fa-spin me-2"></i> Loading maintenance
                        schedules...
                      </td>
                    </tr>
                  ) : blocksList.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>
                        No maintenance blocks match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    blocksList.map((block) => {
                      const facilityName =
                        block.facilityId?.name || block.facilityName || 'Facility'
                      const resourceDesc = block.resourceId?.name
                        ? block.resourceId.name
                        : block.resourceIds && block.resourceIds.length > 0
                          ? `${block.resourceIds.length} Resources`
                          : 'Entire Facility'

                      return (
                        <tr key={block._id}>
                          <td>
                            <div className="fw-bold">{facilityName}</div>
                            <div className="text-muted small">{resourceDesc}</div>
                          </td>
                          <td>
                            <div className="fw-semibold">{block.title}</div>
                            <span className="badge badge-info mt-1" style={{ fontSize: '10px' }}>
                              {block.maintenanceType || 'UPKEEP'}
                            </span>
                          </td>
                          <td>
                            <div className="small">
                              {new Date(block.startDateTime).toLocaleDateString()}
                            </div>
                            <div className="text-muted small">
                              {new Date(block.startDateTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              -{' '}
                              {new Date(block.endDateTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>
                          <td>
                            <div className="small text-primary fw-medium">
                              {new Date(
                                block.effectiveStartDateTime || block.startDateTime,
                              ).toLocaleDateString()}
                            </div>
                            <div className="text-muted small">
                              {new Date(
                                block.effectiveStartDateTime || block.startDateTime,
                              ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                              -{' '}
                              {new Date(
                                block.effectiveEndDateTime || block.endDateTime,
                              ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td>{getStatusBadge(block.status, block.isEmergency)}</td>
                          <td>
                            <div className="d-flex gap-1 flex-wrap">
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                title="View Details"
                                onClick={() => {
                                  setActiveBlock(block)
                                  setDetailModalVisible(true)
                                }}
                              >
                                <i className="fa-solid fa-eye"></i>
                              </button>

                              {block.status !== 'COMPLETED' && block.status !== 'CANCELLED' && (
                                <>
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    title="Extend Window"
                                    onClick={() => {
                                      setActiveBlock(block)
                                      setExtensionModalVisible(true)
                                    }}
                                  >
                                    <i className="fa-solid fa-clock-rotate-left"></i>
                                  </button>

                                  <button
                                    className="btn btn-sm btn-outline-success"
                                    title="Mark Completed"
                                    onClick={() => handleComplete(block)}
                                  >
                                    <i className="fa-solid fa-check"></i>
                                  </button>

                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    title="Cancel Maintenance"
                                    onClick={() => handleCancel(block)}
                                  >
                                    <i className="fa-solid fa-ban"></i>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalItems > 0 && (
              <div className="card-footer bg-body border-top d-flex justify-content-between align-items-center p-3">
                <div className="text-muted small">
                  Showing page {currentPage} of {totalPages} ({totalItems} total records)
                </div>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <i className="fa-solid fa-chevron-left"></i> Prev
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Next <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <V2MaintenanceFormModal
        visible={scheduleModalVisible}
        onClose={() => {
          setScheduleModalVisible(false)
          dispatch(clearStatus())
        }}
        onSuccess={() => loadData()}
        onConflictsDetected={handleConflictsDetectedDuringSchedule}
      />

      <DeclareEmergencyModal
        visible={emergencyModalVisible}
        onClose={() => {
          setEmergencyModalVisible(false)
          dispatch(clearStatus())
        }}
        onSuccess={() => loadData()}
      />

      <RecurringMaintenanceModal
        visible={recurringModalVisible}
        onClose={() => {
          setRecurringModalVisible(false)
          dispatch(clearStatus())
        }}
        onSuccess={() => loadData()}
      />

      <MaintenanceExtensionModal
        visible={extensionModalVisible}
        onClose={() => {
          setExtensionModalVisible(false)
          setActiveBlock(null)
          dispatch(clearStatus())
        }}
        block={activeBlock}
        onSuccess={() => loadData()}
        onConflictsDetected={(blockId, conflicts) => {
          setActiveConflicts(conflicts)
          setImpactModalVisible(true)
        }}
      />

      <MaintenanceDetailModal
        visible={detailModalVisible}
        onClose={() => {
          setDetailModalVisible(false)
          setActiveBlock(null)
        }}
        block={activeBlock}
        onExtend={(block) => {
          setActiveBlock(block)
          setExtensionModalVisible(true)
        }}
        onResolveImpacts={(block, impacts) => {
          setActiveBlock(block)
          setActiveConflicts(impacts)
          setImpactModalVisible(true)
        }}
      />

      <MaintenanceImpactModal
        visible={impactModalVisible}
        onClose={() => {
          setImpactModalVisible(false)
          setActiveConflicts([])
          setActiveBlock(null)
          setPendingSchedulePayload(null)
        }}
        blockId={activeBlock?._id || null}
        conflicts={activeConflicts}
        onResolved={handleResolutionsConfirmed}
      />
    </div>
  )
}

export default AdminMaintenanceView
